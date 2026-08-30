const express = require('express');
const { centralDBp } = require('../../database');

const router = express.Router();

router.post('/validar_unico', async (req, res) => {
  const { correo, telefono, usuario } = req.body;

  if (!correo && !telefono && !usuario) {
    return res.status(400).json({ respuesta: 'Faltan parámetros para validar' });
  }

  let conn;
  try {
    conn = await centralDBp.getConnection();

    // 1) Ejecuta el SP que setea @respuesta
    await conn.query('CALL Validacion_Unico(?, ?, ?, @respuesta)', [
      correo || null,
      telefono || null,
      usuario || null,
    ]);

    // 2) Lee la variable de sesión en la MISMA conexión
    const [rows] = await conn.query('SELECT @respuesta AS respuesta');
    const respuesta = rows?.[0]?.respuesta ?? '1';

    return res.json({ respuesta });
  } catch (err) {
    console.error('❌ Error en SP Validacion_Unico:', err);
    return res.status(500).json({ respuesta: 'Error al validar usuario' });
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;
