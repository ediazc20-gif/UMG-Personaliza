const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimiter } = require('../utils/rateLimit');

// Reloj controlado: el limitador lee Date.now() en cada llamada.
function conReloj(fn) {
  const original = Date.now;
  let ahora = 1_000_000;
  Date.now = () => ahora;
  try {
    return fn((ms) => { ahora += ms; });
  } finally {
    Date.now = original;
  }
}

test('permite hasta max intentos y bloquea el siguiente', () => {
  conReloj(() => {
    const check = createRateLimiter({ windowMs: 60_000, max: 3 });
    assert.deepEqual(check('ip-1'), { ok: true, remaining: 2 });
    assert.deepEqual(check('ip-1'), { ok: true, remaining: 1 });
    assert.deepEqual(check('ip-1'), { ok: true, remaining: 0 });
    const bloqueado = check('ip-1');
    assert.equal(bloqueado.ok, false);
    assert.equal(bloqueado.retryAfterSec, 60);
  });
});

test('cada clave lleva su propio contador', () => {
  conReloj(() => {
    const check = createRateLimiter({ windowMs: 60_000, max: 1 });
    assert.equal(check('ip-1').ok, true);
    assert.equal(check('ip-1').ok, false);
    assert.equal(check('ip-2').ok, true);
  });
});

test('la ventana se reinicia al cumplirse el tiempo', () => {
  conReloj((avanzar) => {
    const check = createRateLimiter({ windowMs: 60_000, max: 1 });
    check('ip-1');
    avanzar(30_000);
    const r = check('ip-1');
    assert.equal(r.ok, false);
    assert.equal(r.retryAfterSec, 30);
    avanzar(30_000);
    assert.equal(check('ip-1').ok, true);
  });
});

test('una clave vacía se agrupa como anónima', () => {
  conReloj(() => {
    const check = createRateLimiter({ max: 1 });
    assert.equal(check(undefined).ok, true);
    assert.equal(check('').ok, false);
  });
});
