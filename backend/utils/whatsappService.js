const fs = require('fs');
const path = require('path');
const pino = require('pino');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

// Directorio para persistir credenciales de sesión de WhatsApp
const AUTH_DIR = path.resolve(__dirname, '..', 'data', 'whatsapp-auth');
if (!fs.existsSync(AUTH_DIR)) {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

let sock = null;
let isConnected = false;
let currentQR = null;
let qrDataUrl = null;
let qrTimestamp = null;
let connectionState = 'connecting';
let userInfo = null;
let reconnectTimer = null;
let isInitializing = false;

const WA_BRAND = 'UMG Personaliza';

/**
 * Normaliza cualquier formato de teléfono al JID de WhatsApp (@s.whatsapp.net)
 * Ej: '50212345678', '+502 1234 5678', '12345678' -> '50212345678@s.whatsapp.net'
 */
function normalizeToJid(phone) {
  if (!phone) return null;
  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  // Si es un número local de Guatemala de 8 dígitos, agregar prefijo 502
  if (digits.length === 8) {
    digits = '502' + digits;
  }
  return `${digits}@s.whatsapp.net`;
}

/**
 * Inicializa el socket de WhatsApp usando Baileys (Open Source Multi-Device)
 */
async function initWhatsApp() {
  if (isInitializing) return;
  isInitializing = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v?.version) version = v.version;
    } catch {
      // Usar versión por defecto
    }

    sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['UMG Personaliza', 'Chrome', '120.0.0'],
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        currentQR = qr;
        qrTimestamp = Date.now();
        connectionState = 'qr_ready';
        try {
          qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            scale: 6,
            color: { dark: '#1A1A1A', light: '#FDFBF7' }
          });
          console.log('[WhatsApp Open Source] 📱 Código QR generado para vincular dispositivo.');
        } catch (err) {
          console.error('[WhatsApp Open Source] Error generando QR DataURL:', err.message);
        }
      }

      if (connection === 'close') {
        isConnected = false;
        connectionState = 'disconnected';
        userInfo = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp Open Source] 🔌 Conexión cerrada. Razón: ${statusCode || 'desconocida'}. Reconectar: ${shouldReconnect}`);

        if (shouldReconnect) {
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            initWhatsApp();
          }, 4000);
        } else {
          console.log('[WhatsApp Open Source] ⚠️ Sesión cerrada por el usuario. Limpiando credenciales para nuevo QR...');
          try {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            fs.mkdirSync(AUTH_DIR, { recursive: true });
          } catch {}
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            initWhatsApp();
          }, 3000);
        }
      } else if (connection === 'open') {
        isConnected = true;
        connectionState = 'connected';
        currentQR = null;
        qrDataUrl = null;
        userInfo = sock.user || { id: 'whatsapp-connected' };
        console.log(`[WhatsApp Open Source] ✅ ¡WhatsApp conectado exitosamente! Usuario: ${userInfo?.name || userInfo?.id || 'OK'}`);
      }
    });

  } catch (err) {
    console.error('[WhatsApp Open Source] Error inicializando cliente:', err.message);
    connectionState = 'error';
  } finally {
    isInitializing = false;
  }
}

/**
 * Retorna el estado actual del servicio de WhatsApp
 */
function getWhatsAppStatus() {
  return {
    provider: 'baileys_opensource',
    connected: isConnected,
    connectionState,
    qrDataUrl: isConnected ? null : qrDataUrl,
    qrTimestamp,
    user: userInfo ? {
      id: userInfo.id,
      name: userInfo.name || 'UMG Personaliza Notifier'
    } : null
  };
}

/**
 * Envía un mensaje de texto por WhatsApp
 */
async function sendWhatsAppText(phone, message) {
  const jid = normalizeToJid(phone);
  if (!jid) {
    console.warn('[WhatsApp] Teléfono inválido:', phone);
    return { ok: false, error: 'Número de teléfono inválido' };
  }

  // 1. Intentar con cliente Open Source (Baileys)
  if (isConnected && sock) {
    try {
      const sent = await sock.sendMessage(jid, { text: message });
      console.log(`[WhatsApp Open Source] ✅ Mensaje enviado a ${phone}`);
      return { ok: true, provider: 'baileys', messageId: sent.key.id };
    } catch (err) {
      console.error('[WhatsApp Open Source] Error enviando mensaje:', err.message);
    }
  }

  // 2. Fallback a Twilio si está configurado en .env
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  if (accountSid && authToken) {
    try {
      const twilio = require('twilio')(accountSid, authToken);
      const digits = String(phone).replace(/\D/g, '');
      const to = digits.startsWith('502') ? `whatsapp:+${digits}` : `whatsapp:+502${digits}`;
      const msg = await twilio.messages.create({ from, to, body: message });
      console.log(`[WhatsApp Twilio Fallback] ✅ Mensaje enviado a ${to} (SID: ${msg.sid})`);
      return { ok: true, provider: 'twilio', sid: msg.sid };
    } catch (err) {
      console.error('[WhatsApp Twilio Fallback] Error:', err.message);
    }
  }

  console.warn(`[WhatsApp] ⚠️ No se pudo enviar WhatsApp a ${phone}. WhatsApp no está vinculado y Twilio no respondió.`);
  return { ok: false, error: 'WhatsApp no está conectado. Escanea el código QR en el panel de administración.' };
}

/**
 * Envía un archivo PDF o documento por WhatsApp
 */
async function sendWhatsAppPdf(phone, bufferOrPath, fileName = 'documento.pdf', caption = '') {
  const jid = normalizeToJid(phone);
  if (!jid) {
    return { ok: false, error: 'Número de teléfono inválido' };
  }

  let fileBuffer = null;
  if (Buffer.isBuffer(bufferOrPath)) {
    fileBuffer = bufferOrPath;
  } else if (typeof bufferOrPath === 'string' && fs.existsSync(bufferOrPath)) {
    try {
      fileBuffer = fs.readFileSync(bufferOrPath);
    } catch (e) {
      console.error('[WhatsApp] Error leyendo archivo para adjuntar:', e.message);
    }
  }

  // 1. Enviar directamente mediante Baileys (No necesita URL pública externa)
  if (isConnected && sock && fileBuffer) {
    try {
      const sent = await sock.sendMessage(jid, {
        document: fileBuffer,
        mimetype: 'application/pdf',
        fileName: fileName,
        caption: caption
      });
      console.log(`[WhatsApp Open Source] ✅ Archivo PDF '${fileName}' enviado directamente a ${phone}`);
      return { ok: true, provider: 'baileys', messageId: sent.key.id, attached: true };
    } catch (err) {
      console.error('[WhatsApp Open Source] Error enviando documento:', err.message);
    }
  }

  // Si no se pudo adjuntar directo, enviar como texto explicativo
  const textBody = caption ? `${caption}\n\n*(Nota: Descarga tu documento desde el sistema)*` : 'Adjunto documento digital.';
  return sendWhatsAppText(phone, textBody);
}

/**
 * Envía el código de verificación por WhatsApp
 */
async function sendWhatsAppVerificationCode({ phone, nombre, codigo }) {
  const body = `*${WA_BRAND}*

Hola ${nombre || 'usuario'},

Tu código de verificación es: *${codigo}*

Válido por 15 minutos. No lo compartas con nadie.

_UMG Personaliza_`;

  return sendWhatsAppText(phone, body);
}

/**
 * Envía la credencial oficial en PDF por WhatsApp
 */
async function sendWhatsAppCredential({ phone, nombre, fileName, filePath, credencialEnviadaPorCorreo = false }) {
  const targetPath = filePath || (fileName ? path.resolve(__dirname, '..', 'uploads', 'credenciales', fileName) : null);
  
  const caption = `*${WA_BRAND}*

Hola ${nombre || 'usuario'},

Tu cuenta fue verificada correctamente. Adjuntamos tu *Credencial Digital de Acceso UMG Personaliza*.

Consérvala en un lugar seguro para ingresar al campus y autenticar tus compras.

_UMG Personaliza_`;

  if (targetPath && fs.existsSync(targetPath)) {
    const res = await sendWhatsAppPdf(phone, targetPath, fileName || 'Credencial_UMG_Personaliza.pdf', caption);
    if (res.ok) return { ok: true, attached: true };
  }

  // Si no hay archivo físico disponible, enviar texto
  const textOnly = `*${WA_BRAND}*

Hola ${nombre || 'usuario'},

Tu cuenta fue verificada correctamente. Tu credencial digital ha sido generada con éxito ${credencialEnviadaPorCorreo ? 'y enviada a tu correo electrónico' : ''}.

_UMG Personaliza_`;

  return sendWhatsAppText(phone, textOnly);
}

/**
 * Envía notificación de estado de orden de compra por WhatsApp.
 *
 * @param {string} [constanciaPath] Ruta del PDF de constancia. Si viene, se manda
 *   ademas como documento. El documento del curso pide que la constancia de
 *   compra con su QR llegue al canal de notificacion elegido, y hasta ahora esta
 *   funcion solo mandaba texto aunque sendWhatsAppPdf ya existia y se usaba para
 *   la credencial.
 */
async function sendOrderWhatsApp({ phone, nombre, codigo, estado, total, areaEntrega, trackingUrl, constanciaPath = null }) {
  if (!phone) return { ok: false, error: 'Sin teléfono' };

  let icon = '📦';
  let estadoTexto = estado;
  if (estado === 'recibida') { icon = '🛒'; estadoTexto = 'Pedido recibido y registrado'; }
  else if (estado === 'preparacion') { icon = '⚙️'; estadoTexto = 'En preparación en taller'; }
  else if (estado === 'en_camino') { icon = '🚚'; estadoTexto = 'En camino con el repartidor'; }
  else if (estado === 'entregada') { icon = '✅'; estadoTexto = 'Entregado con éxito'; }
  else if (estado === 'cancelada') { icon = '❌'; estadoTexto = 'Pedido cancelado'; }

  const body = `*${WA_BRAND} — Actualización de Pedido*

Hola ${nombre || 'Cliente'},

${icon} *Estado:* ${estadoTexto}
📋 *No. de Guía:* \`${codigo}\`
💰 *Total:* Q${Number(total || 0).toFixed(2)}
📍 *Lugar de entrega:* ${areaEntrega || 'Campus Central UMG'}

🔗 *Rastreo en vivo:*
${trackingUrl || `http://localhost:8081/comprador/tracking.html?codigo=${encodeURIComponent(codigo)}`}

¡Gracias por tu compra!
_UMG Personaliza — Tienda Campus_`;

  const resultado = await sendWhatsAppText(phone, body);

  // La constancia va como documento aparte, despues del texto. Que falle el
  // adjunto no invalida el aviso, que es lo que el comprador espera de verdad.
  if (constanciaPath && fs.existsSync(constanciaPath)) {
    try {
      await sendWhatsAppPdf(
        phone,
        constanciaPath,
        `constancia_${codigo}.pdf`,
        `Constancia de tu compra ${codigo}`
      );
    } catch (err) {
      console.warn('[WhatsApp] No se pudo enviar la constancia:', err.message);
    }
  }

  return resultado;
}

/**
 * Reinicia la sesión / genera nuevo QR
 */
async function restartWhatsAppSession() {
  try {
    if (sock) {
      try { sock.end(); } catch {}
    }
    isConnected = false;
    currentQR = null;
    qrDataUrl = null;
    userInfo = null;
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await initWhatsApp();
    return { ok: true, message: 'Sesión reiniciada. Generando nuevo código QR...' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Iniciar WhatsApp al cargar el módulo
setTimeout(() => {
  initWhatsApp();
}, 1000);

module.exports = {
  initWhatsApp,
  getWhatsAppStatus,
  sendWhatsAppText,
  sendWhatsAppPdf,
  sendWhatsAppVerificationCode,
  sendWhatsAppCredential,
  sendOrderWhatsApp,
  restartWhatsAppSession,
  normalizeToJid
};
