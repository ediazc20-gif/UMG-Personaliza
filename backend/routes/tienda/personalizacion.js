const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { makeAuth } = require('../../middlewares/auth');

const router = express.Router();
const authComprador = makeAuth({
  requireAuth: true,
  allowedRoles: ['Comprador', 'Usuario', 'Administrador'],
});

const persoDir = path.join(__dirname, '..', '..', 'uploads', 'personalizaciones');
fs.mkdirSync(persoDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, persoDir),
    filename: (req, file, cb) => {
      const uid = req.auth?.uid || req.auth?.payload?.sub || 'anon';
      const lado = (req.body.lado || 'a').replace(/[^ab]/gi, '').toLowerCase() || 'a';
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `p_${uid}_${Date.now()}_${lado}${ext}`);
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Solo se permiten imagenes.'));
    }
    cb(null, true);
  },
});

router.post('/personalizacion/imagen', authComprador, upload.single('imagen'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Imagen requerida.' });
    }
    const url = `/uploads/personalizaciones/${req.file.filename}`;
    res.status(201).json({ ok: true, url, lado: req.body.lado || 'a' });
  } catch (err) {
    console.error('[personalizacion upload]', err);
    res.status(500).json({ error: 'No se pudo guardar la imagen.' });
  }
});

module.exports = router;
