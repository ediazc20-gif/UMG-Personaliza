const r = require('express').Router();
const jwt = require('jsonwebtoken');
const { queryCentralP } = require('../../database');
const { descriptorFromBase64 } = require('./face_node');
require('../../config/load-env');
const { makeAuth } = require('../../middlewares/auth');
const requireAuth = makeAuth({ requireAuth: true });


r.post('/compare', requireAuth, async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ ok:false, error: 'Falta userId en query' });

    // 1) Traer Base64 desde la BD (queryCentralP devuelve rows directamente)
    const rows = await queryCentralP(
      `SELECT u.Foto_String64_Usuario
         FROM usuarios u
        WHERE u.Id_Usuario = ?
        LIMIT 1`,
      [userId]
    );
    const u = rows && rows[0];
    if (!u) return res.status(404).json({ ok:false, error: 'Usuario no encontrado' });
    if (!u.Foto_String64_Usuario) {
      return res.status(400).json({ ok:false, error: 'Usuario sin foto base64 en BD' });
    }

    // 2) Descriptor A (desde Base64 en BD)
    const A = await descriptorFromBase64(u.Foto_String64_Usuario);
    if (!A) return res.json({ ok:true, match: false, reason: 'no-face-db' });

    // 3) Descriptor B (del body o desde photo_base64)
    let B = req.body?.descriptor;
    if ((!B || !Array.isArray(B)) && req.body?.photo_base64) {
      B = await descriptorFromBase64(req.body.photo_base64);
    }
    if (!B) return res.json({ ok:true, match: false, reason: 'no-desc' });
    if (!Array.isArray(B) || B.length !== 128) {
      return res.status(400).json({ ok:false, error: 'descriptor inválido (debe ser array[128])' });
    }

    // 4) Distancia euclídea
    let d = 0;
    for (let i = 0; i < 128; i++) {
      const x = (A[i] ?? 0) - (B[i] ?? 0);
      d += x * x;
    }
    d = Math.sqrt(d);

    // 5) Respuesta
    const THRESH = 0.6; // ajusta según tus pruebas (0.55–0.70)
    return res.json({ ok:true, match: d < THRESH, dist: d, thresh: THRESH });
  } catch (err) {
    console.error('[compare] Error:', err);
    return res.status(500).json({ ok:false, error: err.message });
  }
});

module.exports = r;