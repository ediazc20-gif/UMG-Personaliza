const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const {
  esHashBcrypt,
  verificarPassword,
  hashPassword,
  validarPasswordNueva,
  BCRYPT_ROUNDS,
} = require('../utils/password');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const sha512 = (s) => crypto.createHash('sha512').update(s).digest('hex');

test('validarPasswordNueva: valores límite de longitud', () => {
  assert.match(validarPasswordNueva(''), /al menos 6/);
  assert.match(validarPasswordNueva(undefined), /al menos 6/);
  assert.match(validarPasswordNueva('12345'), /al menos 6/);
  assert.equal(validarPasswordNueva('123456'), null);
  assert.equal(validarPasswordNueva('a'.repeat(200)), null);
  assert.match(validarPasswordNueva('a'.repeat(201)), /demasiado larga/);
});

test('hashPassword genera bcrypt con el costo configurado', async () => {
  const hash = await hashPassword('Secreta123');
  assert.equal(esHashBcrypt(hash), true);
  assert.ok(hash.startsWith(`$2b$${String(BCRYPT_ROUNDS).padStart(2, '0')}$`));
  assert.notEqual(hash, await hashPassword('Secreta123'), 'cada hash lleva su propia sal');
});

test('verificarPassword con hash bcrypt', async () => {
  const hash = await hashPassword('Secreta123');
  assert.equal(await verificarPassword('Secreta123', hash), true);
  assert.equal(await verificarPassword('secreta123', hash), false);
  // Un cliente que manda el hash exacto se acepta; uno sha no.
  assert.equal(await verificarPassword(hash, hash), true);
  assert.equal(await verificarPassword(sha256('Secreta123'), hash), false);
});

test('verificarPassword con hashes heredados sha256 y sha512', async () => {
  const h256 = sha256('clave-vieja');
  assert.equal(await verificarPassword('clave-vieja', h256), true);
  assert.equal(await verificarPassword('otra', h256), false);
  assert.equal(await verificarPassword(h256.toUpperCase(), h256), true);
  assert.equal(await verificarPassword(sha512('clave-vieja'), h256), false);

  const h512 = sha512('clave-vieja');
  assert.equal(await verificarPassword('clave-vieja', h512), true);
  assert.equal(await verificarPassword('otra', h512), false);
  assert.equal(await verificarPassword(h512, h512), true);
  assert.equal(await verificarPassword(h256, h512), false);
});

test('verificarPassword nunca acepta entradas vacías ni formatos desconocidos', async () => {
  const hash = await hashPassword('x123456');
  assert.equal(await verificarPassword('', hash), false);
  assert.equal(await verificarPassword(null, hash), false);
  assert.equal(await verificarPassword('x123456', ''), false);
  assert.equal(await verificarPassword('x123456', null), false);
  assert.equal(await verificarPassword('x123456', 'texto-plano'), false);
});

test('esHashBcrypt distingue un hash real de cadenas parecidas', () => {
  assert.equal(esHashBcrypt('$2b$10$' + 'a'.repeat(53)), true);
  assert.equal(esHashBcrypt('$2b$10$' + 'a'.repeat(52)), false);
  assert.equal(esHashBcrypt(sha256('x')), false);
  assert.equal(esHashBcrypt(123), false);
});
