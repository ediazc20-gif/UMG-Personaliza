const express = require('express');
const router = express.Router();
const { clearAllAuthCookies } = require('../../middlewares/auth');

router.post('/logout', (req, res) => {
  try {
    //limpia la cookie JWT
    clearAllAuthCookies(res);

    // puedes limpiar más cosas
    res.json({ ok: true, mensaje: 'Sesión cerrada correctamente' });
  } catch (err) {
    console.error('Error al cerrar sesión:', err);
    res.status(500).json({ ok: false, error: 'Error al cerrar sesión' });
  }
});

module.exports = router;
