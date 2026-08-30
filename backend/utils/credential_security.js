const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bwipjs = require('bwip-js');

const QR_SECRET = process.env.CREDENTIAL_QR_SECRET || process.env.JWT_SECRET;
if (!QR_SECRET) {
  throw new Error('Define CREDENTIAL_QR_SECRET o JWT_SECRET en .env (sin secreto por defecto).');
}
const QR_KEY = crypto.createHash('sha256').update(String(QR_SECRET)).digest();

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(text) {
  return crypto.createHash('sha256').update(String(text)).digest('hex');
}

function getKeyDir() {
  return process.env.CREDENTIAL_KEYS_DIR || path.join(__dirname, '..', 'config', 'credential-keys');
}

function ensureRsaKeyPair() {
  const keyDir = getKeyDir();
  const privatePath = path.join(keyDir, 'credential-private.pem');
  const publicPath = path.join(keyDir, 'credential-public.pem');

  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    return {
      privateKey: fs.readFileSync(privatePath, 'utf8'),
      publicKey: fs.readFileSync(publicPath, 'utf8'),
      privatePath,
      publicPath,
    };
  }

  fs.mkdirSync(keyDir, { recursive: true });
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  fs.writeFileSync(privatePath, pair.privateKey, 'utf8');
  fs.writeFileSync(publicPath, pair.publicKey, 'utf8');

  return {
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
    privatePath,
    publicPath,
  };
}

function encryptCredentialPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', QR_KEY, iv);
  cipher.setAAD(Buffer.from('credential-v2'));

  const json = stableStringify(payload);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = Buffer.concat([iv, tag, encrypted]).toString('base64url');

  return {
    token: packed,
    iv: iv.toString('base64url'),
    tag: tag.toString('base64url'),
    checksum: sha256(json),
    algorithm: 'aes-256-gcm',
  };
}

function decryptCredentialPayload(token) {
  const packed = Buffer.from(String(token || ''), 'base64url');
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', QR_KEY, iv);
  decipher.setAAD(Buffer.from('credential-v2'));
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

function signCredentialPayload(payload) {
  const { privateKey } = ensureRsaKeyPair();
  const sign = crypto.createSign('RSA-SHA256');
  const body = stableStringify(payload);
  sign.update(body);
  sign.end();
  return {
    signature: sign.sign(privateKey).toString('base64url'),
    payloadHash: sha256(body),
  };
}

function verifyCredentialSignature(payload, signature) {
  const { publicKey } = ensureRsaKeyPair();
  const verify = crypto.createVerify('RSA-SHA256');
  const body = stableStringify(payload);
  verify.update(body);
  verify.end();
  return verify.verify(publicKey, Buffer.from(String(signature || ''), 'base64url'));
}

function barcodeOptions(kind, text) {
  return {
    bcid: kind,
    text,
    scale: kind === 'qrcode' ? 4 : 2,
    height: kind === 'qrcode' ? 18 : 12,
    includetext: false,
    padding: 4,
    backgroundcolor: 'FFFFFF',
  };
}

function toBuffer(options) {
  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(options, (err, png) => {
      if (err) return reject(err);
      resolve(png);
    });
  });
}

async function generateQrBuffer(text) {
  return toBuffer(barcodeOptions('qrcode', text));
}

async function generateCode128Buffer(text) {
  return toBuffer(barcodeOptions('code128', text));
}

function buildCredentialPayload({ idUsuario, usuario, correo, nickname, rol, telefono }) {
  const base = {
    idUsuario: Number(idUsuario),
    usuario: String(usuario || ''),
    correo: String(correo || ''),
    nickname: String(nickname || usuario || ''),
    rol: String(rol || 'Usuario'),
    telefono: String(telefono || ''),
    issuedAt: new Date().toISOString(),
    nonce: crypto.randomBytes(12).toString('hex'),
  };
  const checksum = sha256(stableStringify(base));
  return { ...base, checksum };
}

module.exports = {
  buildCredentialPayload,
  decryptCredentialPayload,
  encryptCredentialPayload,
  generateCode128Buffer,
  generateQrBuffer,
  ensureRsaKeyPair,
  signCredentialPayload,
  verifyCredentialSignature,
  stableStringify,
};