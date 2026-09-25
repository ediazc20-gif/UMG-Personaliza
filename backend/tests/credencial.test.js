const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Llaves RSA en una carpeta temporal para no tocar las reales.
const dirLlaves = fs.mkdtempSync(path.join(os.tmpdir(), 'umg-llaves-'));
process.env.CREDENTIAL_KEYS_DIR = dirLlaves;
process.env.CREDENTIAL_QR_SECRET = process.env.CREDENTIAL_QR_SECRET || 'secreto-qr-de-prueba';

const {
  buildCredentialPayload,
  encryptCredentialPayload,
  decryptCredentialPayload,
  signCredentialPayload,
  verifyCredentialSignature,
  stableStringify,
  generateQrBuffer,
} = require('../utils/credential_security');

test.after(() => fs.rmSync(dirLlaves, { recursive: true, force: true }));

const datos = { idUsuario: '15', usuario: 'ana', correo: 'ana@umg.edu.gt', rol: 'Comprador', telefono: '55551234' };

test('stableStringify no depende del orden de las claves', () => {
  assert.equal(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] }), stableStringify({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test('buildCredentialPayload normaliza tipos y añade nonce y checksum', () => {
  const p = buildCredentialPayload(datos);
  assert.equal(p.idUsuario, 15);
  assert.equal(p.nickname, 'ana', 'sin nickname usa el usuario');
  assert.match(p.nonce, /^[0-9a-f]{24}$/);
  assert.match(p.checksum, /^[0-9a-f]{64}$/);
  assert.notEqual(buildCredentialPayload(datos).nonce, p.nonce);
});

test('el QR cifrado se descifra al mismo contenido', () => {
  const p = buildCredentialPayload(datos);
  const { token, algorithm } = encryptCredentialPayload(p);
  assert.equal(algorithm, 'aes-256-gcm');
  assert.deepEqual(decryptCredentialPayload(token), p);
});

test('un QR alterado no se puede descifrar', () => {
  const { token } = encryptCredentialPayload(buildCredentialPayload(datos));
  const bytes = Buffer.from(token, 'base64url');
  bytes[bytes.length - 1] ^= 0xff;
  assert.throws(() => decryptCredentialPayload(bytes.toString('base64url')));
  assert.throws(() => decryptCredentialPayload(''));
});

test('la firma RSA valida el payload original y rechaza uno modificado', () => {
  const p = buildCredentialPayload(datos);
  const { signature } = signCredentialPayload(p);
  assert.equal(verifyCredentialSignature(p, signature), true);
  assert.equal(verifyCredentialSignature({ ...p, rol: 'Administrador' }, signature), false);
  assert.equal(verifyCredentialSignature(p, 'firma-falsa'), false);
});

test('genera la imagen PNG del código QR', async () => {
  const png = await generateQrBuffer('UMG-PRUEBA');
  assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
});
