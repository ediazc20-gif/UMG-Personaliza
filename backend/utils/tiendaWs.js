const jwt = require('jsonwebtoken');
const { getEnv } = require('../config/load-env');
const { queryLocal } = require('../database');

/** Suscripciones WebSocket autenticadas para tracking de ordenes. */
const subsByCodigo = new Map();

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
}

function broadcastOrdenEstado(payload) {
  const codigo = String(payload?.codigo || '').trim();
  if (!codigo) return;
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

module.exports = { attachTiendaWs, broadcastOrdenEstado };
