const express = require('express');
const bcrypt = require('bcrypt');
const { centralDBp, queryCentralP } = require('../../database');
const { generateVerificationCode, sendVerificationEmail } = require('../../utils/verification');
const { isMailConfigured } = require('../../config/mailer');
const { createRateLimiter } = require('../../utils/rateLimit');

const router = express.Router();
const limitForgot = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 });
const limitReset = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });

async function findUserByIdentificador(identificador) {
  const id = String(identificador || '').trim();
  if (!id) return null;
  const rows = await queryCentralP(
    `SELECT Id_Usuario, Nombres_Usuario, Email_Usuario, Usuario
     FROM usuarios
     WHERE Email_Usuario = ? OR Usuario = ?
     LIMIT 1`,
    [id, id]
  );
  return rows[0] || null;
}

function clientKey(req, identificador) {
  // req.ip viene del `trust proxy` de server.js; leer X-Forwarded-For a mano
  // dejaba que el cliente eligiera su propia clave de rate limit.
  const ip = String(req.ip || '').trim();
  return `${ip}|${String(identificador || '').toLowerCase()}`;
}

/** POST /api/auth/forgot-password */
router.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const identificador = String(req.body?.identificador || req.body?.email || '').trim();
    if (!identificador) {
      return res.status(400).json({ error: 'Indica tu correo o usuario.' });
    }

    const rl = limitForgot(clientKey(req, identificador));
    if (!rl.ok) {
      return res.status(429).json({
        error: `Demasiados intentos. Espera ${rl.retryAfterSec}s.`,
      });
    }

    const user = await findUserByIdentificador(identificador);
    // Respuesta uniforme (anti-enumeracion)
    const generic = { ok: true, message: 'Si el usuario existe, enviaremos un codigo al correo registrado.' };

    if (!user?.Email_Usuario) {
      return res.json(generic);
    }

    const codigo = generateVerificationCode();
    await queryCentralP(
      `INSERT INTO verificaciones (id_usuario, tipo, codigo, expira) VALUES (?, 'correo', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))`,
      [user.Id_Usuario, codigo]
    );

    if (!isMailConfigured()) {
      console.warn('[forgot-password] GMAIL no configurado; codigo no enviado por correo.');
      return res.json(generic);
    }

    try {
      await sendVerificationEmail({
        to: user.Email_Usuario,
        nombre: user.Nombres_Usuario,
        codigo,
      });
    } catch (mailErr) {
      console.warn('[forgot-password] correo omitido:', mailErr.message);
    }

    res.json(generic);
  } catch (err) {
    console.error('[forgot-password]', err);
    res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
  }
});

/** POST /api/auth/reset-password */
router.post('/api/auth/reset-password', async (req, res) => {
  const conn = await centralDBp.getConnection();
  try {
    const identificador = String(req.body?.identificador || req.body?.email || '').trim();
    const codigo = String(req.body?.codigo || '').trim();
    const nueva = String(req.body?.nueva_contrasena || req.body?.password || '').trim();

    if (!identificador || !codigo || !nueva) {
      return res.status(400).json({ error: 'Faltan datos (usuario, codigo o nueva contrasena).' });
    }
    if (nueva.length < 6) {
      return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });
    }

    const rl = limitReset(clientKey(req, identificador));
    if (!rl.ok) {
      return res.status(429).json({
        error: `Demasiados intentos. Espera ${rl.retryAfterSec}s.`,
      });
    }

    const user = await findUserByIdentificador(identificador);
    if (!user) return res.status(400).json({ error: 'Codigo invalido o expirado.' });

    const [verRows] = await conn.execute(
      `SELECT id FROM verificaciones
       WHERE id_usuario = ? AND codigo = ? AND usado = 0 AND expira > NOW()
       ORDER BY creado DESC LIMIT 1`,
      [user.Id_Usuario, codigo]
    );
    if (!verRows.length) return res.status(400).json({ error: 'Codigo invalido o expirado.' });

    const hash = await bcrypt.hash(nueva, 10);
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE usuarios SET Password_Usuario = ? WHERE Id_Usuario = ?`,
      [hash, user.Id_Usuario]
    );
    await conn.execute(`UPDATE verificaciones SET usado = 1 WHERE id = ?`, [verRows[0].id]);
    await conn.commit();

    res.json({ ok: true, message: 'Contrasena actualizada. Ya puedes iniciar sesion.' });
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    console.error('[reset-password]', err);
    res.status(500).json({ error: 'No se pudo restablecer la contrasena.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
