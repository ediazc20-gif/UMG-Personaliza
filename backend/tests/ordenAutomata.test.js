const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ESTADOS_VALIDOS,
  MAQUINA_ESTADOS,
  validarTransicionAutomata,
  getSiguientesEstadosPermitidos,
} = require('../utils/ordenAutomata');

test('el autómata conoce los 7 estados del ciclo de vida', () => {
  assert.deepEqual(Object.values(ESTADOS_VALIDOS).sort(), Object.keys(MAQUINA_ESTADOS).sort());
  assert.equal(Object.keys(MAQUINA_ESTADOS).length, 7);
});

test('rechaza un estado actual desconocido o vacío', () => {
  for (const actual of [undefined, null, '', 'inventado']) {
    const r = validarTransicionAutomata(actual, 'en_ruta', 'ADMIN');
    assert.equal(r.valido, false);
    assert.match(r.error, /Estado actual desconocido/);
  }
});

test('mantener el mismo estado es válido y se marca sin cambio', () => {
  const r = validarTransicionAutomata('en_ruta', 'en_ruta', 'REPARTIDOR');
  assert.deepEqual(r, { valido: true, sinCambio: true });
});

test('los estados terminales no admiten más cambios', () => {
  for (const terminal of ['entregada', 'cancelada']) {
    const r = validarTransicionAutomata(terminal, 'en_ruta', 'ADMIN');
    assert.equal(r.valido, false);
    assert.match(r.error, /estado final/);
  }
});

test('rechaza saltos que no son aristas del grafo', () => {
  const r = validarTransicionAutomata('recibida', 'entregada', 'ADMIN');
  assert.equal(r.valido, false);
  assert.match(r.error, /Transición inválida/);
  assert.match(r.error, /Solo se permite/);
});

test('acepta todas las aristas del grafo para el administrador', () => {
  for (const [origen, nodo] of Object.entries(MAQUINA_ESTADOS)) {
    for (const destino of nodo.transicionesPermitidas) {
      const r = validarTransicionAutomata(origen, destino, 'ADMIN');
      assert.equal(r.valido, true, `${origen} -> ${destino}`);
      assert.equal(r.estadoAnterior, origen);
      assert.equal(r.nuevoEstado, destino);
    }
  }
});

test('ADMINISTRADOR se trata igual que ADMIN y sin distinguir mayúsculas', () => {
  assert.equal(validarTransicionAutomata('en_ruta', 'entregada', 'administrador').valido, true);
});

test('aplica los permisos por rol', () => {
  // El repartidor entrega, pero no manda al taller.
  assert.equal(validarTransicionAutomata('en_ruta', 'entregada', 'REPARTIDOR').valido, true);
  const taller = validarTransicionAutomata('recibida', 'en_elaboracion', 'REPARTIDOR');
  assert.equal(taller.valido, false);
  assert.match(taller.error, /no tiene autorización/);

  // El comprador solo puede actuar mientras la orden está recibida.
  assert.equal(validarTransicionAutomata('recibida', 'cancelada', 'COMPRADOR').valido, true);
  assert.equal(validarTransicionAutomata('en_elaboracion', 'cancelada', 'COMPRADOR').valido, false);

  // Sin rol no hay permiso.
  assert.equal(validarTransicionAutomata('en_ruta', 'entregada', undefined).valido, false);
});

test('una orden no encontrada puede volver a ruta', () => {
  assert.equal(validarTransicionAutomata('no_encontrado', 'en_ruta', 'REPARTIDOR').valido, true);
});

test('getSiguientesEstadosPermitidos devuelve valor y etiqueta', () => {
  assert.deepEqual(getSiguientesEstadosPermitidos('recibida'), [
    { valor: 'en_elaboracion', label: 'En elaboración / taller' },
    { valor: 'cancelada', label: 'Cancelada' },
  ]);
  assert.deepEqual(getSiguientesEstadosPermitidos('entregada'), []);
  assert.deepEqual(getSiguientesEstadosPermitidos('inexistente'), []);
});
