const crypto = require('crypto');
const { transporter } = require('../config/mailer');
const whatsappService = require('./whatsappService');

function generateVerificationCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

function normalizeWhatsAppNumber(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.startsWith('502') ? `whatsapp:+${digits}` : `whatsapp:+502${digits}`;
}

const WA_BRAND = 'UMG Personaliza';

function getPublicBaseUrl() {
  const base = (process.env.PUBLIC_BASE_URL || process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');
  return base || null;
}

function isPublicMediaUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) return false;
    const host = u.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) return false;
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

function buildCredentialPdfUrl(fileName) {
  const base = getPublicBaseUrl();
  if (!base || !fileName) return null;
  return `${base}/uploads/credenciales/${encodeURIComponent(fileName)}`;
}

async function isPdfUrlReachable(url) {
  if (!isPublicMediaUrl(url)) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    let res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    if (res.ok) return true;
    if (res.status === 405 || res.status === 404) {
      res = await fetch(url, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
        redirect: 'follow',
      });
      return res.ok || res.status === 206;
    }
    return false;
  } catch (err) {
    console.warn('⚠️ PDF no accesible en URL pública:', url, '-', err.message);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendVerificationEmail({ to, nombre, codigo }) {
  if (!to) return false;
  const fromUser = (process.env.GMAIL_USER || '').trim();
  if (!fromUser) throw new Error('GMAIL_USER no configurado');
  await transporter.sendMail({
    from: `UMG Personaliza <${fromUser}>`,
    to,
    subject: 'Código de verificación — UMG Personaliza',
    text: `Hola ${nombre || ''}, tu código de verificación es: ${codigo}`.trim(),
    html: `<p>Hola <b>${nombre || 'usuario'}</b>,</p><p>Tu código de verificación es:</p><h2>${codigo}</h2><p>Este código expira en 15 minutos.</p>`,
  });
  return true;
}

async function sendVerificationSMS({ phone, codigo }) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return false;
  
  const to = digits.startsWith('502') ? `+${digits}` : `+502${digits}`;
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !from) {
    console.warn('⚠️ Twilio SMS no configurado');
    return false;
  }

  try {
    const twilio = require('twilio')(accountSid, authToken);
    await twilio.messages.create({
      from,
      to,
      body: `Tu código de verificación es ${codigo}. Expira en 15 minutos.`,
    });
    console.log(`✅ SMS enviado a ${to}`);
    return true;
  } catch (err) {
    console.error('❌ Error enviando SMS:', err.message);
    return false;
  }
}

// ─── WhatsApp: Enviar código de verificación ───
async function sendWhatsAppVerificationCode({ phone, nombre, codigo }) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return false;
  
  try {
    const res = await whatsappService.sendWhatsAppVerificationCode({ phone: digits, nombre, codigo });
    return !!res.ok;
  } catch (err) {
    console.error('❌ Error enviando código por WhatsApp:', err.message);
    return false;
  }
}

// ─── WhatsApp: Enviar credencial PDF ───
async function sendWhatsAppCredential({ phone, nombre, fileName, credencialEnviadaPorCorreo = false }) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return false;

  try {
    const res = await whatsappService.sendWhatsAppCredential({
      phone: digits,
      nombre,
      fileName,
      credencialEnviadaPorCorreo
    });
    return res.ok ? { ok: true, attached: !!res.attached } : false;
  } catch (err) {
    console.error('❌ Error enviando credencial por WhatsApp:', err.message);
    return false;
  }
}

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  sendVerificationSMS,
  sendWhatsAppVerificationCode,
  sendWhatsAppCredential,
  buildCredentialPdfUrl,
  getPublicBaseUrl,
  isPublicMediaUrl,
  isPdfUrlReachable,
};