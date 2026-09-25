const express = require('express');
const router = express.Router();
const { initAll, closeAll, queryLocal, queryCentralP } = require('../../database');
const { issueTokens } = require('../../middlewares/auth');
const { descriptorFromBase64 } = require('../face/face_node');
const { createRateLimiter } = require('../../utils/rateLimit');
const { verificarPassword } = require('../../utils/password');

const SP_QUALIFIED_NAME = '`Login`';
const loginLimiter = createRateLimiter({ windowMs: 5 * 60 * 1000, max: 25 });

function sendError(res, code, msg, extra = {}) {
  return res.status(code).json({ error: msg, ...extra });
}

/* Los helpers de verificación flexible se movieron a utils/password.js, que es
   donde los comparte con el cambio de contraseña del perfil del comprador. */

/* ===== QR parseo (sin cambios de negocio) ===== */
function parseQR(qrText = '') {
  const t = String(qrText || '').trim();
  if (!t) return {};
  try {
    const o = JSON.parse(t);
    return {
      usuario: o.usuario || o.U || o.u || null,
      correo: o.correo || o.email || null,
      identificador: o.identificador || null,
      contrasena: o.contrasena || o.password || o.pass || o.P || o.p || o.clave || ''
    };
  } catch {}

  const out = {};
  t.replace(/\r?\n/g, ';')
    .split(/[;,&/]/)
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(part => {
      const m = part.split(/[:=]/);
      if (m.length < 2) return;
      const key = m[0].trim().toLowerCase();
      const val = m.slice(1).join(':').trim().replace(/^"(.*)"$/, '$1');

      if (key === 'usuario') out.usuario = val;
      else if (key === 'correo' || key === 'email') out.correo = val;
      else if (key === 'identificador') out.identificador = val;
      else if (['contrasena', 'contraseña', 'password', 'pass', 'pwd', 'clave'].includes(key)) out.contrasena = val;

      if (key === 'u') out.usuario = val;
      if (key === 'p') out.contrasena = val;
    });

  if (!out.contrasena && t.includes(':') && !/[;,&/]/.test(t) && !/^\s*[up]\s*:/.test(t)) {
    const [a, b] = t.split(':');
    if ((a || '').includes('@')) out.correo = (a || '').trim(); else out.usuario = (a || '').trim();
    out.contrasena = (b || '').trim().replace(/^"(.*)"$/, '$1');
  }
  return out;
}

function normalizeLoginBody(body = {}) {
  const qrRaw = typeof body.qr === 'string' ? body.qr.trim() : '';
  if (typeof body.qr === 'string') {
    body = { ...body, ...parseQR(body.qr) };
  }

  let { identificador, usuario, correo, email, contrasena } = body;
  identificador = (identificador || '').trim();
  usuario = (usuario || '').trim();
  correo = (correo || email || '').trim();
  contrasena = (contrasena || '').trim();

  // Si el QR viene como token crudo (sin pares clave/valor), tratarlo como credencial
  if (!contrasena && qrRaw) contrasena = qrRaw;

  if (!usuario && !correo && identificador) {
    if (identificador.includes('@')) correo = identificador;
    else usuario = identificador;
  }

  let photo_base64 = typeof body.photo_base64 === 'string' ? body.photo_base64.trim() : null;
  if (photo_base64 === '') photo_base64 = null;

  return { usuario: usuario || null, correo: correo || null, contrasena, photo_base64, qrRaw };
}

/* ===== Utilidad timing ===== */
function nowMs() { const [s, ns] = process.hrtime(); return (s * 1e3) + (ns / 1e6); }
function setTimingsHeader(res, timings) {
  Object.entries(timings).forEach(([k, v]) => res.setHeader(`X-Timing-${k}`, `${v.toFixed(1)}ms`));
}

async function logAccess({ req, userId, metodo, exitoso = true }) {
  try {
    // req.ip ya resuelve la IP real gracias al `trust proxy` de server.js.
    const ip = String(req.ip || '').trim();
    const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);
    await queryCentralP(
      `INSERT INTO access_logs (id_usuario, metodo_login, ip, user_agent, exitoso)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, metodo, ip || null, userAgent || null, exitoso ? 1 : 0]
    );
  } catch (err) {
    console.error('[access_logs] No se pudo registrar ingreso:', err.message);
  }
}

/* =========================== POST /login =========================== */
router.post('/login', async (req, res) => {
  // Se limita por la IP que resuelve Express con `trust proxy`. Antes se leia
  // X-Forwarded-For a mano y se tomaba el primer valor: como ese lo manda el
  // cliente, bastaba con variarlo en cada peticion para intentar contrasenas
  // sin limite.
  const ip = String(req.ip || '').trim();
  const limit = loginLimiter(ip);
  if (!limit.ok) {
    return sendError(res, 429, `Demasiados intentos de acceso. Por favor espera ${limit.retryAfterSec} segundos.`);
  }

  const t0 = nowMs();
  const { usuario, correo, contrasena, photo_base64, qrRaw } = normalizeLoginBody(req.body);
  const timings = {};
  const THRESH = 0.6; // 0.55–0.70

  // ---------- MODO 1: Login por reconocimiento facial ----------
  // Optimizaciones:
  // - límite de tamaño base64 (~2.5MB aprox en texto) para evitar imágenes enormes
  // - timeout suave al calcular descriptores (race con timer)
  if (photo_base64 && (usuario || correo)) {
    try {
      if (photo_base64.length > 3_500_000) { // ~2.5–3MB base64
        return sendError(res, 413, 'Imagen demasiado grande para validación facial');
      }

      const tDb1 = nowMs();
      const sql = `
        SELECT Foto_String64_Usuario
        FROM usuarios
        WHERE Estado_Usuario = 1
          AND (Email_Usuario = ? OR Usuario = ?)
        LIMIT 1
      `;
      const p1 = correo || usuario || '';
      const p2 = usuario || correo || '';
      const rows = await queryCentralP(sql, [p1, p2]);
      timings.db_face_user = nowMs() - tDb1;

      if (!rows?.length) { setTimingsHeader(res, timings); return sendError(res, 401, 'Usuario no encontrado o inactivo'); }

      const fotoDB = rows[0].Foto_String64_Usuario;
      if (!fotoDB) { setTimingsHeader(res, timings); return sendError(res, 400, 'El usuario no tiene foto registrada en BD'); }

      // Timeout helper
      const withTimeout = (p, ms, name='op') => Promise.race([
        p,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout:${name}`)), ms))
      ]);

      const tFD = nowMs();
      const A = await withTimeout(descriptorFromBase64(fotoDB), 15000, 'descA'); // 15s máx
      if (!A) { setTimingsHeader(res, timings); return sendError(res, 400, 'No se pudo obtener rostro de la foto en BD'); }
      const B = await withTimeout(descriptorFromBase64(photo_base64), 15000, 'descB'); // 15s máx
      if (!B) { setTimingsHeader(res, timings); return sendError(res, 400, 'No se detectó un rostro válido en la imagen enviada'); }
      timings.face_descriptors = nowMs() - tFD;

      // Distancia euclídea
      let d = 0;
      for (let i = 0; i < 128; i++) {
        const x = (A[i] ?? 0) - (B[i] ?? 0);
        d += x * x;
      }
      d = Math.sqrt(d);
      timings.face_distance = nowMs() - tFD;

      if (d >= THRESH) {
        setTimingsHeader(res, timings);
        return sendError(res, 401, 'Rostro no coincide', { dist: d });
      }

      const tSp = nowMs();
      const sqlInfo = `CALL ${SP_QUALIFIED_NAME}(?, ?, ?, ?)`;
      const paramsInfo = [usuario || null, correo || null, null, fotoDB];
      const spRows = await queryCentralP(sqlInfo, paramsInfo);
      timings.db_sp = nowMs() - tSp;

      const rs0 = Array.isArray(spRows) && Array.isArray(spRows[0]) ? spRows[0] : spRows;
      const u = rs0[0];

      const payload = {
        sub: String(u.Id_Usuario),
        uid: u.Id_Usuario,
        usuario: u.Usuario,
        correo: u.Email_Usuario,
        rol: u.Rol ?? null,
        mfa: 'face_rec',
        iat: Math.floor(Date.now() / 1000)
      };
      const { access: faceToken } = issueTokens(res, payload);

      timings.total = nowMs() - t0;
      setTimingsHeader(res, timings);

      await logAccess({ req, userId: u.Id_Usuario, metodo: 'facial', exitoso: true });

      return res.json({
        ok: true,
        metodo: 'face_rec',
        token: faceToken,
        dist: d,
        usuario: {
          id: u.Id_Usuario,
          nombre: u.NombreUsuario,
          celular: u.Celular_Usuario,
          fecha_nacimiento: u.Fecha_Nacimiento_Usuario,
          correo: u.Email_Usuario,
          usuario: u.Usuario,
          rol: u.Rol ?? null,
          notif_correo: u.Notificaciones_Correo_Usuario,
          notif_whatsapp: u.Notificaciones_WhatsApp_Usuario,
          foto64: fotoDB || null
        }
      });

    } catch (e) {
      timings.total = nowMs() - t0;
      setTimingsHeader(res, timings);
      if (String(e.message || '').startsWith('timeout:')) {
        return sendError(res, 504, 'Validación facial tardó demasiado');
      }
      console.error('Error en login (face):', e);
      return sendError(res, 500, 'Error en el servidor (face/DB)');
    }
  }

  // ---------- MODO 2: Login por credencial QR / código de barras ----------
  if (qrRaw && !usuario && !correo) {
    try {
      const tQr = nowMs();
      const isShortBarcode = qrRaw.length <= 16;
      let uid = null;

      if (!isShortBarcode) {
        // QR completo: descifrar token para obtener idUsuario sin depender de la tabla credenciales
        try {
          const { decryptCredentialPayload } = require('../../utils/credential_security');
          const decoded = decryptCredentialPayload(qrRaw);
          uid = decoded?.idUsuario || null;
        } catch (decErr) {
          console.warn('QR: no se pudo descifrar:', decErr.message);
        }
      }

      let qrRows = [];
      if (uid) {
        qrRows = await queryCentralP(`
          SELECT u.Id_Usuario, u.Nombres_Usuario AS NombreUsuario, u.Usuario, u.Email_Usuario,
                 u.Celular_Usuario, u.Fecha_Nacimiento_Usuario,
                 u.Foto_Modificada_String64_Usuario, u.Foto_String64_Usuario,
                 r.Rol, u.Notificaciones_Correo_Usuario, u.Notificaciones_WhatsApp_Usuario
          FROM usuarios u
          INNER JOIN Roles r ON r.IdRol = u.Id_Rol_Usuario
          WHERE u.Estado_Usuario = 1 AND u.Id_Usuario = ?
          LIMIT 1`, [uid]);
      } else {
        // Barcode (16 chars): buscar por prefijo del token en la tabla credenciales
        qrRows = await queryCentralP(`
          SELECT u.Id_Usuario, u.Nombres_Usuario AS NombreUsuario, u.Usuario, u.Email_Usuario,
                 u.Celular_Usuario, u.Fecha_Nacimiento_Usuario,
                 u.Foto_Modificada_String64_Usuario, u.Foto_String64_Usuario,
                 r.Rol, u.Notificaciones_Correo_Usuario, u.Notificaciones_WhatsApp_Usuario
          FROM credenciales c
          INNER JOIN usuarios u ON u.Id_Usuario = c.id_usuario
          INNER JOIN Roles r ON r.IdRol = u.Id_Rol_Usuario
          WHERE u.Estado_Usuario = 1
            AND UPPER(LEFT(c.qr_data_cifrado, 16)) = UPPER(?)
          LIMIT 1`, [qrRaw]);
      }

      timings.db_qr = nowMs() - tQr;

      if (Array.isArray(qrRows) && qrRows.length > 0) {
        const u = qrRows[0];
        const metodo = isShortBarcode ? 'barcode_credential' : 'qr_credential';
        const payload = {
          sub: String(u.Id_Usuario), uid: u.Id_Usuario,
          usuario: u.Usuario, correo: u.Email_Usuario,
          rol: u.Rol ?? null, mfa: metodo,
          iat: Math.floor(Date.now() / 1000)
        };
        const { access: qrToken } = issueTokens(res, payload);
        timings.total = nowMs() - t0;
        setTimingsHeader(res, timings);
        await logAccess({ req, userId: u.Id_Usuario, metodo, exitoso: true });
        return res.json({
          ok: true, metodo, mensaje: 'Login por credencial exitoso',
          token: qrToken, token_type: 'Bearer',
          usuario: {
            id: u.Id_Usuario, nombre: u.NombreUsuario,
            celular: u.Celular_Usuario, fecha_nacimiento: u.Fecha_Nacimiento_Usuario,
            correo: u.Email_Usuario, usuario: u.Usuario, rol: u.Rol ?? null,
            notif_correo: u.Notificaciones_Correo_Usuario,
            notif_whatsapp: u.Notificaciones_WhatsApp_Usuario,
            foto64: u.Foto_Modificada_String64_Usuario || u.Foto_String64_Usuario || null
          }
        });
      }
    } catch (qrErr) {
      console.error('Error en login por credencial QR:', qrErr.message);
    }
    // Un QR que no corresponde a ninguna credencial caia al login por
    // contrasena y respondia "Faltan datos", que no explica nada. El texto
    // "QR inválido" es el que reconoce la pantalla de login (js/auth.js).
    setTimingsHeader(res, timings);
    return sendError(res, 401, 'QR inválido o expirado.');
  }

  // ---------- MODO 3: Login por contraseña ----------
  if (!contrasena || (!usuario && !correo)) {
    return sendError(res, 400, 'Faltan datos', { requerido: 'usuario o correo + contrasena' });
  }

  try {
    const tDb1 = nowMs();
    const sqlPw = `
      SELECT Password_Usuario
      FROM usuarios
      WHERE Estado_Usuario = 1
        AND (Email_Usuario = ? OR Usuario = ?)
      LIMIT 1
    `;
    const p1 = correo || usuario || '';
    const p2 = usuario || correo || '';
    const pwRows = await queryCentralP(sqlPw, [p1, p2]);
    timings.db_pw = nowMs() - tDb1;

    if (!Array.isArray(pwRows) || pwRows.length === 0) {
      setTimingsHeader(res, timings);
      return sendError(res, 401, 'Usuario o contraseña inválidos');
    }

    const hash = String(pwRows[0].Password_Usuario || '');

    // Verificación flexible (texto, bcrypt, sha256, sha512).
    // La lógica vive en utils/password.js porque el cambio de contraseña desde
    // el perfil del comprador necesita exactamente la misma comparación.
    // IMPORTANTE: bcrypt usa threadpool; considera aumentar UV_THREADPOOL_SIZE si hay mucha concurrencia
    const tCmp = nowMs();
    const ok = await verificarPassword(contrasena, hash);
    timings.compare = nowMs() - tCmp;

    if (!ok) {
      setTimingsHeader(res, timings);
      return sendError(res, 401, 'Usuario o contraseña inválidos');
    }

    const tSp = nowMs();
    const sqlInfo = `CALL ${SP_QUALIFIED_NAME}(?, ?, ?, ?)`;
    const paramsInfo = [usuario || null, correo || null, hash, null];
    const spRows = await queryCentralP(sqlInfo, paramsInfo);
    timings.db_sp = nowMs() - tSp;

    const rs0 = Array.isArray(spRows) && Array.isArray(spRows[0]) ? spRows[0] : spRows;
    if (!Array.isArray(rs0) || rs0.length === 0) {
      setTimingsHeader(res, timings);
      return sendError(res, 401, 'Usuario o contraseña inválidos');
    }
    const r = rs0[0];

    const payload = {
      sub: String(r.Id_Usuario),
      uid: r.Id_Usuario,
      usuario: r.Usuario,
      correo: r.Email_Usuario,
      rol: r.Rol ?? null,
      mfa: 'password',
      iat: Math.floor(Date.now() / 1000)
    };
    const { access: pwToken } = issueTokens(res, payload);

    await logAccess({ req, userId: r.Id_Usuario, metodo: 'password', exitoso: true });

    timings.total = nowMs() - t0;
    setTimingsHeader(res, timings);

    return res.json({
      ok: true,
      metodo: 'password',
      mensaje: 'Login exitoso',
      token: pwToken,
      token_type: 'Bearer',
      usuario: {
        id: r.Id_Usuario,
        nombre: r.NombreUsuario,
        celular: r.Celular_Usuario,
        fecha_nacimiento: r.Fecha_Nacimiento_Usuario,
        correo: r.Email_Usuario,
        usuario: r.Usuario,
        rol: r.Rol ?? null,
        notif_correo: r.Notificaciones_Correo_Usuario,
        notif_whatsapp: r.Notificaciones_WhatsApp_Usuario,
        foto64: r.Foto_Modificada_String64_Usuario || r.Foto_String64_Usuario || null
      }
    });

  } catch (e) {
    console.error('Error en login (hash/SP):', e);
    return sendError(res, 500, 'Error en el servidor (DB/SP)');
  }
});

module.exports = router;