const jwt = require('jsonwebtoken');
const { getEnv } = require('../config/load-env');
const { queryLocal } = require('../database');

/** Suscripciones WebSocket autenticadas para tracking de ordenes. */
const subsByCodigo = new Map();

/**
 * Canal del panel: staff que mira el dashboard y quiere enterarse de CUALQUIER
 * cambio, no de una orden concreta.
 *
 * El canal de tracking no vale para esto porque esta indexado por codigo de
 * orden (`addClient(codigo, ws)`): un dashboard tendria que suscribirse a todas
 * las ordenes existentes y a las que aun no se han creado. De ahi este segundo
 * canal, sin clave.
 */
const subsPanel = new Set();

const ROLES_PANEL = ['administrador', 'admin', 'supervisor'];

function puedeVerPanel(payload) {
  return ROLES_PANEL.includes(String(payload?.rol || '').toLowerCase());
}

/** Avisa al panel de que algo cambio, para que refresque sus cifras. */
function broadcastPanel(payload) {
  if (!subsPanel.size) return;
  const msg = JSON.stringify({ type: 'panel.cambio', ...payload });
  for (const client of subsPanel) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (_) { /* ignore */ }
    }
  }
}

const JWT_SECRET = getEnv('JWT_SECRET');
const JWT_ISSUER = getEnv('JWT_ISSUER');
const JWT_AUDIENCE = getEnv('JWT_AUDIENCE');

function addClient(codigo, ws) {
  const key = String(codigo || '').trim();
  if (!key) return;
  if (!subsByCodigo.has(key)) subsByCodigo.set(key, new Set());
  subsByCodigo.get(key).add(ws);
}

function removeClient(ws) {
  for (const [codigo, set] of subsByCodigo.entries()) {
    set.delete(ws);
    if (!set.size) subsByCodigo.delete(codigo);
  }
  subsPanel.delete(ws);
}

function broadcastOrdenEstado(payload) {
  const codigo = String(payload?.codigo || '').trim();
  if (!codigo) return;

  // El panel se entera de todo cambio de estado, venga de donde venga: del
  // checkout, del boton del panel, de la entrega del repartidor, del cobro con
  // tarjeta o del avance automatico. Enganchandolo aqui no hay que tocar cada
  // sitio que ya emitia, y ninguno se queda fuera por olvido.
  broadcastPanel({ codigo, estado: payload?.estado || null, nota: payload?.nota || null });

  const set = subsByCodigo.get(codigo);
  if (!set?.size) return;
  const msg = JSON.stringify({ type: 'orden.estado', ...payload });
  for (const client of set) {
    if (client.readyState === 1) {
      try { client.send(msg); } catch (_) { /* ignore */ }
    }
  }
}

function extractTokenFromReq(req) {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams.get('token');
  if (q) return q;
  const auth = req.headers?.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  const cookie = req.headers?.cookie || '';
  const m = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithms: ['HS256'],
  });
}

async function canSubscribe(payload, codigo) {
  const rol = String(payload.rol || '').toLowerCase();
  if (['administrador', 'admin', 'supervisor', 'repartidor'].includes(rol)) {
    return true;
  }
  const uid = payload.uid || payload.sub;
  const rows = await queryLocal(
    `SELECT id FROM ordenes WHERE codigo = ? AND id_usuario = ? LIMIT 1`,
    [codigo, uid]
  );
  return rows.length > 0;
}

function attachTiendaWs(wss) {
  wss.on('connection', async (ws, req) => {
    let authed = null;
    try {
      const token = extractTokenFromReq(req);
      if (!token) throw new Error('no_token');
      authed = verifyAccessToken(token);
      ws.auth = {
        uid: authed.uid || authed.sub,
        rol: authed.rol || null,
      };
    } catch {
      try {
        ws.send(JSON.stringify({ type: 'error', error: 'Auth requerida para tracking.' }));
      } catch (_) { /* ignore */ }
      ws.close(4401, 'Unauthorized');
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    // Un dashboard se conecta con ?panel=1 y no con un codigo de orden.
    if (url.searchParams.get('panel') === '1') {
      if (puedeVerPanel(authed)) {
        subsPanel.add(ws);
        ws.send(JSON.stringify({ type: 'subscribed.panel' }));
      } else {
        ws.send(JSON.stringify({ type: 'error', error: 'Sin permiso para el panel.' }));
      }
    }

    const codigoInit = url.searchParams.get('codigo');
    if (codigoInit) {
      try {
        if (await canSubscribe(authed, codigoInit)) {
          addClient(codigoInit, ws);
          ws.send(JSON.stringify({ type: 'subscribed', codigo: codigoInit }));
        } else {
          ws.send(JSON.stringify({ type: 'error', error: 'Sin permiso para esta orden.' }));
        }
      } catch (err) {
        console.warn('[tiendaWs] subscribe init:', err.message);
      }
    }

    ws.on('message', async (raw) => {
      try {
        const data = JSON.parse(String(raw));
        if (data.type === 'subscribe.panel') {
          if (puedeVerPanel(authed)) {
            subsPanel.add(ws);
            ws.send(JSON.stringify({ type: 'subscribed.panel' }));
          } else {
            ws.send(JSON.stringify({ type: 'error', error: 'Sin permiso para el panel.' }));
          }
          return;
        }
        if (data.type === 'subscribe' && data.codigo) {
          if (await canSubscribe(authed, data.codigo)) {
            addClient(data.codigo, ws);
            ws.send(JSON.stringify({ type: 'subscribed', codigo: data.codigo }));
          } else {
            ws.send(JSON.stringify({ type: 'error', error: 'Sin permiso para esta orden.' }));
          }
        }
      } catch (_) { /* ignore */ }
    });

    ws.on('close', () => removeClient(ws));
    ws.on('error', () => removeClient(ws));
  });
}

module.exports = { attachTiendaWs, broadcastOrdenEstado, broadcastPanel };
