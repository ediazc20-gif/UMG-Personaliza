const express = require('express');
const { queryLocal, queryCentralP } = require('../../database');
const { makeAuth } = require('../../middlewares/auth');

const router = express.Router();
const authComprador = makeAuth({
  requireAuth: true,
  allowedRoles: ['Comprador', 'Usuario', 'Administrador'],
});

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

module.exports = router;
