const jwt = require('jsonwebtoken');
const { getEnv } = require('../config/load-env');

/* =======================
   Config (.env)
   ======================= */
const JWT_SECRET = getEnv('JWT_SECRET');
const JWT_ISSUER = getEnv('JWT_ISSUER');
const JWT_AUDIENCE = getEnv('JWT_AUDIENCE');
const JWT_EXPIRES = getEnv('JWT_EXPIRES', '15m');
const REFRESH_EXPIRES = getEnv('REFRESH_EXPIRES', '7d');
const NODE_ENV = getEnv('NODE_ENV');

if (!JWT_SECRET) throw new Error('Falta JWT_SECRET en .env');

const isProd = NODE_ENV === 'production';
const publicBase = (getEnv('PUBLIC_BASE_URL') || getEnv('PUBLIC_URL') || '').trim();
// Secure cookies solo sobre HTTPS (o COOKIE_SECURE=true). Evita cookies rotas en HTTP local con NODE_ENV=production.
const cookieSecure =
  getEnv('COOKIE_SECURE') === 'true' ||
  (getEnv('COOKIE_SECURE') !== 'false' && /^https:/i.test(publicBase));
const cookieSameSite = cookieSecure ? 'none' : 'lax';

//token y cookies
function signJWT(payload = {}) {
  if (!payload.sub && !payload.uid) {
    throw new Error('Payload JWT debe contener sub o uid');
  }
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  });
}

function setJwtCookie(res, token, cookieOpts = {}) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    ...cookieOpts
  });
}

// Genera y setea access + refresh
function issueTokens(res, payload = {}) {
  const access = signJWT(payload);
  const refresh = jwt.sign({ uid: payload.uid || payload.sub, rt: true }, JWT_SECRET, {
    expiresIn: REFRESH_EXPIRES,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    algorithm: 'HS256'
  });

  setJwtCookie(res, access);
  res.cookie('refresh', refresh, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite
  });

  return { access, refresh };
}

function clearAllAuthCookies(res) {
  res.clearCookie('token',   { httpOnly:true, secure:cookieSecure, sameSite: cookieSameSite });
  res.clearCookie('refresh', { httpOnly:true, secure:cookieSecure, sameSite: cookieSameSite });
}

//extraer token del request
function extractToken(req) {
  const h = req.headers?.authorization || '';
  const fromHeader = h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  const fromCookie = req.cookies?.token || null;
  return fromHeader || fromCookie || null;
}

/* =======================
   ÚNICO middleware: verifica y auto-refresca
   ======================= */
function makeAuth({ requireAuth = true, allowedRoles = null, clockTolerance = 5 } = {}) {
  return function auth(req, res, next) {
    const token = extractToken(req);

    // Si no hay token
    if (!token) {
      if (!requireAuth) { req.auth = null; return next(); }
      return res.status(401).json({ error: 'Token requerido', code: 'no_token' });
    }

    // Verificar rol despues de poblar req.auth
    function checkRole() {
      if (allowedRoles && Array.isArray(allowedRoles) && allowedRoles.length > 0) {
        const userRol = (req.auth?.rol || '').trim();
        if (!allowedRoles.some(r => r.toLowerCase() === userRol.toLowerCase())) {
          return res.status(403).json({ error: 'No tienes permisos para esta accion', code: 'forbidden' });
        }
      }
      return next();
    }

    try {
      // validar access
      const payload = jwt.verify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        clockTolerance,
        algorithms: ['HS256']
      });

      if (!payload.sub && !payload.uid) {
        return res.status(401).json({ error: 'Token inválido', code: 'invalid_token' });
      }

      req.auth = {
        token,
        payload,
        uid: payload.uid || payload.sub,
        rol: payload.rol ?? null,
        correo: payload.correo ?? null,
        usuario: payload.usuario ?? null
      };
      return checkRole();
    } catch (err) {
      // Si no es expiración, error directo
      if (err?.name !== 'TokenExpiredError') {
        if (!requireAuth) { req.auth = null; return next(); }
        return res.status(401).json({ error: 'Token inválido', code: 'invalid_token' });
      }

      // expirado: intentar refresh
      const r = req.cookies?.refresh;
      if (!r) {
        if (!requireAuth) { req.auth = null; return next(); }
        return res.status(401).json({ error: 'Token expirado', code: 'token_expired' });
      }

      try {
        const rPayload = jwt.verify(r, JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ['HS256']
        });
        if (!rPayload?.rt || !rPayload?.uid) {
          if (!requireAuth) { req.auth = null; return next(); }
          return res.status(401).json({ error: 'Refresh inválido', code: 'invalid_refresh' });
        }

        // Recuperar datos del token expirado (sin verificar firma, ya lo hicimos)
        const expired = jwt.decode(token) || {};
        const newPayload = {
          uid: rPayload.uid,
          sub: String(rPayload.uid),
          rol: expired.rol ?? null,
          usuario: expired.usuario ?? null,
          correo: expired.correo ?? null
        };
        const { access } = issueTokens(res, newPayload); // setea nuevas cookies

        // Verificar nuevo access para poblar req.auth
        const payload = jwt.verify(access, JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
          algorithms: ['HS256']
        });

        req.auth = {
          token: access,
          payload,
          uid: payload.uid || payload.sub,
          rol: payload.rol ?? null
        };
        return checkRole();
      } catch {
        if (!requireAuth) { req.auth = null; return next(); }
        return res.status(401).json({ error: 'Refresh falló', code: 'refresh_failed' });
      }
    }
  };
}

module.exports = {
  signJWT,
  setJwtCookie,
  issueTokens,         
  clearAllAuthCookies,

  makeAuth
};
