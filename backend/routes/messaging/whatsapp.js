const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const r = require('express').Router();
const multer = require('multer');
const mime = require('mime-types');
const { body, validationResult } = require('express-validator');
require('../../config/load-env');
const { makeAuth } = require('../../middlewares/auth');
const whatsappService = require('../../utils/whatsappService');

const requireAuth = makeAuth({ requireAuth: true });
const requireAdmin = makeAuth({ requireAuth: true, allowedRoles: ['Admin', 'Administrador'] });

// =====================[ ESTADO Y CÓDIGO QR ]=====================
/**
 * Retorna el estado de la conexión de WhatsApp y el QR si está pendiente de vincular
 */
r.get('/status', (req, res) => {
  const status = whatsappService.getWhatsAppStatus();
  return res.json({ ok: true, status });
});

r.get('/qr', (req, res) => {
  const status = whatsappService.getWhatsAppStatus();
  return res.json({
    ok: true,
    connected: status.connected,
    connectionState: status.connectionState,
    qrDataUrl: status.qrDataUrl,
    user: status.user
  });
});

/**
 * Reinicia la sesión para generar un nuevo código QR
 */
r.post('/restart', requireAdmin, async (req, res) => {
  const result = await whatsappService.restartWhatsAppSession();
  return res.json(result);
});

// =====================[ HELPERS ]=====================
function isValidWhatsAppNumber(num) {
  const number = String(num || '').replace(/[^\d]/g, '');
  return number.length >= 8 && number.length <= 15;
}

// =====================[ RUTA: TEXTO ]=====================
r.post(
  '/send',
  requireAuth,
  [
    body('to')
      .exists().withMessage('to es requerido')
      .custom(isValidWhatsAppNumber).withMessage('Número de WhatsApp inválido (mínimo 8 dígitos)'),
    body('message')
      .exists().withMessage('message es requerido')
      .isLength({ min: 1, max: 2500 }).withMessage('Mensaje debe tener entre 1 y 2500 caracteres')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    try {
      const { to, message } = req.body;
      const sendResult = await whatsappService.sendWhatsAppText(to, message);

      if (!sendResult.ok) {
        return res.status(502).json({
          ok: false,
          error: sendResult.error || 'No se pudo enviar el mensaje por WhatsApp'
        });
      }

      return res.json({
        ok: true,
        provider: sendResult.provider,
        to,
        messageId: sendResult.messageId || sendResult.sid
      });
    } catch (err) {
      console.error('[whatsapp/send] Error:', err?.message || err);
      return res.status(500).json({
        ok: false,
        error: 'Error interno enviando WhatsApp',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// =====================[ UPLOADS ]=====================
const uploadsDir = path.resolve(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = mime.extension(file.mimetype) || 'bin';
      const name = 'wa_' + crypto.randomBytes(8).toString('hex') + '.' + ext;
      cb(null, name);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF o imágenes'), false);
    }
  }
});

// =====================[ RUTA: ARCHIVO PDF / DOCUMENTO ]=====================
r.post(
  '/send-file',
  requireAuth,
  upload.single('file'),
  [
    body('to')
      .exists().withMessage('to es requerido')
      .custom(isValidWhatsAppNumber).withMessage('Número de WhatsApp inválido'),
    body('message')
      .optional()
      .isLength({ max: 2500 }).withMessage('Mensaje muy largo')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Falta archivo PDF' });
      }

      const { to, message = '' } = req.body;
      const sendResult = await whatsappService.sendWhatsAppPdf(to, req.file.path, req.file.originalname, message);

      if (!sendResult.ok) {
        return res.status(502).json({
          ok: false,
          error: sendResult.error || 'No se pudo enviar el archivo por WhatsApp'
        });
      }

      return res.json({
        ok: true,
        to,
        provider: sendResult.provider,
        fileName: req.file.originalname,
        fileSize: req.file.size
      });
    } catch (err) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      console.error('[whatsapp/send-file] Error:', err);
      return res.status(500).json({
        ok: false,
        error: 'Error enviando WhatsApp con archivo',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

// =====================[ ERRORES MULTER ]=====================
r.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        error: 'Archivo demasiado grande. Máximo 10MB permitido.'
      });
    }
  }
  if (error && error.message) {
    return res.status(400).json({ ok: false, error: error.message });
  }
  next(error);
});

module.exports = r;
