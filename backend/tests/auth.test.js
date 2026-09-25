const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// El middleware exige un secreto; si el .env no lo trae se usa uno de prueba.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-solo-para-pruebas';

const { makeAuth, signJWT } = require('../middlewares/auth');
const { getEnv } = require('../config/load-env');

const SECRET = getEnv('JWT_SECRET');
const opciones = {};
if (getEnv('JWT_ISSUER')) opciones.issuer = getEnv('JWT_ISSUER');
if (getEnv('JWT_AUDIENCE')) opciones.audience = getEnv('JWT_AUDIENCE');

function respuestaFalsa() {
  return {
    statusCode: 200,
    body: null,
    cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; },
  };
}

function ejecutar(mw, req) {
  const res = respuestaFalsa();
  let siguio = false;
  mw({ headers: {}, cookies: {}, ...req }, res, () => { siguio = true; });
  return { res, siguio };
}

function reqConToken(token, extra = {}) {
  return { headers: { authorization: `Bearer ${token}` }, ...extra };
}

test('signJWT exige sub o uid en el payload', () => {
  assert.throws(() => signJWT({ rol: 'Comprador' }), /sub o uid/);
  assert.ok(signJWT({ uid: 1 }));
});

test('sin token responde 401 si la ruta lo exige', () => {
  const { res, siguio } = ejecutar(makeAuth(), {});
  assert.equal(siguio, false);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'no_token');
});

test('sin token deja pasar si la ruta es opcional', () => {
  const req = { headers: {}, cookies: {} };
  let siguio = false;
  makeAuth({ requireAuth: false })(req, respuestaFalsa(), () => { siguio = true; });
  assert.equal(siguio, true);
  assert.equal(req.auth, null);
});

test('token válido en la cabecera puebla req.auth', () => {
  const token = signJWT({ uid: 7, rol: 'Comprador', usuario: 'ana' });
  const req = { ...reqConToken(token), cookies: {} };
  let siguio = false;
  makeAuth()(req, respuestaFalsa(), () => { siguio = true; });
  assert.equal(siguio, true);
  assert.equal(req.auth.uid, 7);
  assert.equal(req.auth.rol, 'Comprador');
  assert.equal(req.auth.usuario, 'ana');
});

test('también acepta el token desde la cookie', () => {
  const token = signJWT({ uid: 7, rol: 'Comprador' });
  const { siguio } = ejecutar(makeAuth(), { cookies: { token } });
  assert.equal(siguio, true);
});

test('el rol se compara sin distinguir mayúsculas', () => {
  const token = signJWT({ uid: 1, rol: 'administrador' });
  const { siguio } = ejecutar(makeAuth({ allowedRoles: ['Administrador'] }), reqConToken(token));
  assert.equal(siguio, true);
});

test('un rol no permitido recibe 403', () => {
  const token = signJWT({ uid: 2, rol: 'Comprador' });
  const { res, siguio } = ejecutar(makeAuth({ allowedRoles: ['Administrador'] }), reqConToken(token));
  assert.equal(siguio, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'forbidden');
});

test('un token firmado con otro secreto es inválido', () => {
  const falso = jwt.sign({ uid: 1, rol: 'Administrador' }, 'otro-secreto', opciones);
  const { res } = ejecutar(makeAuth(), reqConToken(falso));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'invalid_token');
});

test('rechaza el algoritmo none', () => {
  const sinFirma = jwt.sign({ uid: 1, rol: 'Administrador' }, null, { ...opciones, algorithm: 'none' });
  const { res } = ejecutar(makeAuth(), reqConToken(sinFirma));
  assert.equal(res.statusCode, 401);
});

test('token expirado sin refresh responde token_expired', () => {
  const vencido = jwt.sign({ uid: 3, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, opciones);
  const { res } = ejecutar(makeAuth(), reqConToken(vencido));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'token_expired');
});

test('token expirado con refresh válido emite cookies nuevas y conserva el rol', () => {
  const vencido = jwt.sign({ uid: 3, rol: 'Repartidor', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, opciones);
  const refresh = jwt.sign({ uid: 3, rt: true }, SECRET, { ...opciones, expiresIn: '1h' });
  const req = { ...reqConToken(vencido), cookies: { refresh } };
  const res = respuestaFalsa();
  let siguio = false;
  makeAuth({ allowedRoles: ['Repartidor'] })(req, res, () => { siguio = true; });
  assert.equal(siguio, true);
  assert.ok(res.cookies.token, 'emite access nuevo');
  assert.ok(res.cookies.refresh, 'emite refresh nuevo');
  assert.equal(req.auth.rol, 'Repartidor');
});

test('un refresh sin la marca rt no renueva la sesión', () => {
  const vencido = jwt.sign({ uid: 3, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, opciones);
  const noEsRefresh = jwt.sign({ uid: 3 }, SECRET, { ...opciones, expiresIn: '1h' });
  const { res } = ejecutar(makeAuth(), { ...reqConToken(vencido), cookies: { refresh: noEsRefresh } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'invalid_refresh');
});

test('un token bien firmado pero sin sub ni uid es inválido', () => {
  const sinSujeto = jwt.sign({ rol: 'Administrador' }, SECRET, { ...opciones, expiresIn: '5m' });
  const { res } = ejecutar(makeAuth(), reqConToken(sinSujeto));
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'invalid_token');
});

test('un token inválido en una ruta opcional deja pasar como anónimo', () => {
  const req = { ...reqConToken('no-es-un-jwt'), cookies: {} };
  let siguio = false;
  makeAuth({ requireAuth: false })(req, respuestaFalsa(), () => { siguio = true; });
  assert.equal(siguio, true);
  assert.equal(req.auth, null);
});

test('un refresh con firma falsa no renueva la sesión', () => {
  const vencido = jwt.sign({ uid: 3, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, opciones);
  const refreshFalso = jwt.sign({ uid: 3, rt: true }, 'otro-secreto', { ...opciones, expiresIn: '1h' });
  const { res } = ejecutar(makeAuth(), { ...reqConToken(vencido), cookies: { refresh: refreshFalso } });
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.code, 'refresh_failed');
});

test('en una ruta opcional, cualquier fallo del refresh deja pasar como anónimo', () => {
  const vencido = jwt.sign({ uid: 3, exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, opciones);
  const sinRt = jwt.sign({ uid: 3 }, SECRET, { ...opciones, expiresIn: '1h' });
  const falso = jwt.sign({ uid: 3, rt: true }, 'otro-secreto', { ...opciones, expiresIn: '1h' });
  for (const cookies of [{}, { refresh: sinRt }, { refresh: falso }]) {
    const req = { ...reqConToken(vencido), cookies };
    let siguio = false;
    makeAuth({ requireAuth: false })(req, respuestaFalsa(), () => { siguio = true; });
    assert.equal(siguio, true);
    assert.equal(req.auth, null);
  }
});
