const test = require('node:test');
const assert = require('node:assert/strict');

const { asBool, mapProductoFlags } = require('../utils/bit');
const { notificacionActiva } = require('../utils/notificaciones');

test('asBool convierte los BIT de MySQL y los valores primitivos', () => {
  for (const v of [true, 1, '1', Buffer.from([1]), { data: [1] }, 5, '2']) {
    assert.equal(asBool(v), true, `asBool(${JSON.stringify(v)})`);
  }
  for (const v of [false, 0, '0', null, undefined, Buffer.from([0]), Buffer.alloc(0), { data: [0] }, 'abc']) {
    assert.equal(asBool(v), false, `asBool(${JSON.stringify(v)})`);
  }
});

test('mapProductoFlags normaliza tiene_lado_b y activo sin tocar lo demás', () => {
  const fila = { id: 3, nombre: 'Taza', tiene_lado_b: Buffer.from([1]), activo: Buffer.from([0]) };
  assert.deepEqual(mapProductoFlags(fila), { id: 3, nombre: 'Taza', tiene_lado_b: true, activo: false });
  assert.equal(mapProductoFlags({ tiene_lado_b: 0 }).activo, undefined);
  assert.equal(mapProductoFlags(null), null);
});

test('notificacionActiva interpreta el bit(1) como Buffer', () => {
  // Este es el caso que antes fallaba en silencio: Number(<Buffer 01>) es NaN.
  assert.equal(notificacionActiva(Buffer.from([1])), true);
  assert.equal(notificacionActiva(Buffer.from([0])), false);
});

test('notificacionActiva acepta número, booleano, cadena y arrays de bytes', () => {
  assert.equal(notificacionActiva(1), true);
  assert.equal(notificacionActiva(0), false);
  assert.equal(notificacionActiva(true), true);
  assert.equal(notificacionActiva(false), false);
  assert.equal(notificacionActiva('1'), true);
  assert.equal(notificacionActiva('TRUE'), true);
  assert.equal(notificacionActiva('0'), false);
  assert.equal(notificacionActiva('on'), true, 'checkbox HTML marcado');
  assert.equal(notificacionActiva('off'), false);
  assert.equal(notificacionActiva([1]), true);
  assert.equal(notificacionActiva(null), false);
  assert.equal(notificacionActiva(undefined), false);
});
