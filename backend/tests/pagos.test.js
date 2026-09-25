const test = require('node:test');
const assert = require('node:assert/strict');

const { mapItems, validarMinimo } = require('../utils/recurrente');
const { generarCodigoOrden } = require('../utils/ordenCodigo');

test('mapItems convierte quetzales a centavos enteros', () => {
  const [item] = mapItems([{ nombre: 'Taza', precio_unitario: '45.10', cantidad: 2 }], 'GTQ');
  assert.deepEqual(item, { name: 'Taza', amount_in_cents: 4510, currency: 'GTQ', quantity: 2 });
  // 19.99 * 100 da 1998.9999... en coma flotante; debe redondear a 1999.
  assert.equal(mapItems([{ precio_unitario: 19.99 }], 'GTQ')[0].amount_in_cents, 1999);
});

test('mapItems pone valores por defecto y recorta nombres largos', () => {
  const [item] = mapItems([{ nombre_producto: 'x'.repeat(200), precio_unitario: 10 }], 'GTQ');
  assert.equal(item.name.length, 120);
  assert.equal(item.quantity, 1);
  assert.equal(mapItems([{ precio_unitario: 10 }], 'GTQ')[0].name, 'Articulo personalizado');
});

test('validarMinimo: valores límite del mínimo de la pasarela', () => {
  const total = (centavos) => [{ amount_in_cents: centavos, quantity: 1 }];
  assert.match(validarMinimo(total(499), 'GTQ'), /inferior al minimo/);
  assert.equal(validarMinimo(total(500), 'GTQ'), null);
  assert.equal(validarMinimo([{ amount_in_cents: 250, quantity: 2 }], 'GTQ'), null);
  assert.match(validarMinimo(total(99), 'USD'), /inferior al minimo/);
  assert.equal(validarMinimo(total(100), 'USD'), null);
  assert.match(validarMinimo(total(10_000), 'EUR'), /Moneda no soportada/);
});

test('generarCodigoOrden produce códigos UMG únicos', () => {
  const codigos = new Set(Array.from({ length: 500 }, generarCodigoOrden));
  assert.equal(codigos.size, 500);
  for (const c of codigos) assert.match(c, /^UMG-[0-9A-Z]{4}[0-9A-F]{10}$/);
});
