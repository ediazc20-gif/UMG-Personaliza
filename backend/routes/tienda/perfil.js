const express = require('express');
const multer = require('multer');
const { queryLocal, queryCentralP } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');
const { verificarPassword, hashPassword, validarPasswordNueva } = require('../../utils/password');
const { createRateLimiter } = require('../../utils/rateLimit');
const { registrarAuditoria } = require('../../utils/auditLogger');

const router = express.Router();
const authComprador = makeAuth({
  requireAuth: true,
  allowedRoles: ['Comprador', 'Usuario', 'Administrador'],
});

// Las fotos se quedan en memoria porque acaban como base64 en la base, igual
// que en el registro: no hace falta escribirlas a disco para luego leerlas.
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
});

// Cambiar la contrasena exige acertar la actual, asi que es un sitio donde
// probar a ciegas. Se limita por usuario, no por IP: la sesion ya identifica a
// quien lo intenta y asi no se castiga a todo un campus tras el mismo NAT.
const passwordLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10 });

router.get('/perfil', authComprador, async (req, res) => {
  try {
    const uid = req.auth?.uid || req.auth?.payload?.sub;
    const rows = await queryCentralP(
      `SELECT Id_Usuario AS id, Nombres_Usuario AS nombres, Apellidos_Usuario AS apellidos,
              Email_Usuario AS email, Nickname_Usuario AS nickname
       FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
      [uid]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ ok: true, perfil: rows[0] });
  } catch (err) {
    console.error('[perfil GET]', err);
    res.status(500).json({ error: 'Error al cargar perfil.' });
  }
});

router.put('/perfil', authComprador, async (req, res) => {
  try {
    const uid = req.auth?.uid || req.auth?.payload?.sub;
    const { nickname } = req.body;
    if (!nickname || String(nickname).trim().length < 2) {
      return res.status(400).json({ error: 'Nickname invalido (min 2 caracteres).' });
    }
    await queryCentralP(
      `UPDATE usuarios SET Nickname_Usuario = ? WHERE Id_Usuario = ?`,
      [String(nickname).trim().substring(0, 60), uid]
    );
    res.json({ ok: true, nickname: String(nickname).trim() });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
  }
});

/* ==================== Cambiar la propia contrasena ====================
 * El documento lo pide expresamente: "El comprador podra cambiar password y
 * foto". Hasta ahora no existia ninguna ruta para ello en todo el backend: la
 * unica forma de cambiar la contrasena era el flujo de "la olvide", que manda
 * un codigo por correo.
 */
router.put('/perfil/password', authComprador, async (req, res) => {
  const uid = req.auth?.uid || req.auth?.payload?.sub;

  const limite = passwordLimiter(String(uid));
  if (!limite.ok) {
    return res.status(429).json({
      error: `Demasiados intentos. Espera ${limite.retryAfterSec} segundos.`,
    });
  }

  try {
    const actual = String(req.body?.contrasena_actual ?? '');
    const nueva = String(req.body?.nueva_contrasena ?? '');

    if (!actual || !nueva) {
      return res.status(400).json({ error: 'Indica tu contrasena actual y la nueva.' });
    }

    const problema = validarPasswordNueva(nueva);
    if (problema) return res.status(400).json({ error: problema });

    if (actual === nueva) {
      return res.status(400).json({ error: 'La contrasena nueva debe ser distinta de la actual.' });
    }

    const filas = await queryCentralP(
      `SELECT Password_Usuario FROM usuarios WHERE Id_Usuario = ? LIMIT 1`,
      [uid]
    );
    if (!filas.length) return res.status(404).json({ error: 'Usuario no encontrado.' });

    // Sin esta comprobacion, cualquiera que pillase una sesion abierta podria
    // cambiar la contrasena y quedarse con la cuenta.
    const correcta = await verificarPassword(actual, filas[0].Password_Usuario);
    if (!correcta) {
      return res.status(401).json({ error: 'La contrasena actual no es correcta.' });
    }

    await queryCentralP(
      `UPDATE usuarios SET Password_Usuario = ? WHERE Id_Usuario = ?`,
      [await hashPassword(nueva), uid]
    );

    registrarAuditoria({
      id_usuario: uid,
      accion: 'CAMBIO_PASSWORD',
      descripcion: 'El comprador cambio su contrasena desde el perfil',
      ip_origen: req.ip || '::1',
      indice: 'TIENDA-PERFIL',
    });

    res.json({ ok: true, mensaje: 'Contrasena actualizada.' });
  } catch (err) {
    console.error('[perfil password]', err);
    res.status(500).json({ error: 'No se pudo cambiar la contrasena.' });
  }
});

/* ==================== Cambiar la propia foto ====================
 * Subir foto solo existia como ruta de administrador (`requireAdmin`), asi que
 * un comprador no podia cambiar la suya.
 *
 * Se piden las dos fotos por separado, igual que en el registro, y no una sola
 * como hace la ruta de admin: el documento distingue la foto ORIGINAL, que es
 * la que usa el reconocimiento facial para entrar, de la MODIFICADA con filtros
 * que se enluce en la barra de estado. Guardar la de filtros en las dos
 * columnas, que es lo que hace la ruta de admin, deja al usuario sin poder
 * entrar con la cara.
 */
router.post(
  '/perfil/foto',
  authComprador,
  uploadFoto.fields([
    { name: 'foto_original', maxCount: 1 },
    { name: 'foto_modificada', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const uid = req.auth?.uid || req.auth?.payload?.sub;

      const original = req.files?.['foto_original']?.[0] || null;
      const modificada = req.files?.['foto_modificada']?.[0] || null;

      if (!original && !modificada) {
        return res.status(400).json({ error: 'No se recibio ninguna imagen.' });
      }

      const campos = [];
      const valores = [];
      if (original) {
        campos.push('Foto_String64_Usuario = ?');
        valores.push(original.buffer.toString('base64'));
      }
      if (modificada) {
        campos.push('Foto_Modificada_String64_Usuario = ?');
        valores.push(modificada.buffer.toString('base64'));
      }
      valores.push(uid);

      await queryCentralP(
        `UPDATE usuarios SET ${campos.join(', ')} WHERE Id_Usuario = ?`,
        valores
      );

      const queCambio = [original && 'original', modificada && 'con filtros']
        .filter(Boolean)
        .join(' y ');

      registrarAuditoria({
        id_usuario: uid,
        accion: 'ACTUALIZAR_FOTO',
        descripcion: `El comprador actualizo su foto (${queCambio}) desde el perfil`,
        ip_origen: req.ip || '::1',
        indice: 'TIENDA-PERFIL',
      });

      res.json({ ok: true, mensaje: 'Foto actualizada.', actualizadas: queCambio });
    } catch (err) {
      console.error('[perfil foto]', err);
      res.status(500).json({ error: 'No se pudo actualizar la foto.' });
    }
  }
);

module.exports = router;
