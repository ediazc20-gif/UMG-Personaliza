// api.js — Wrapper de fetch y helpers de sesión

function getUsuario() {
  let usuario = null;
  const raw = sessionStorage.getItem('usuario');
  if (raw) { try { usuario = JSON.parse(raw); } catch { usuario = null; } }
  if (usuario && typeof usuario !== 'object') usuario = null;
  return usuario;
}

function getUsuarioSesion() {
  try { return JSON.parse(sessionStorage.getItem('usuario') || 'null'); }
  catch { return null; }
}

async function apiFetch(path, { method = 'GET', headers = {}, body = null } = {}) {
  const opts = { method, credentials: 'include', headers: { ...headers } };

  // Enviar token como header Authorization (respaldo a cookies)
  const token = localStorage.getItem('token');
  if (token && !opts.headers['Authorization']) {
    opts.headers['Authorization'] = 'Bearer ' + token;
  }

  if (body != null) {
    if (body instanceof FormData) {
      opts.body = body;
    } else if (typeof body === 'string') {
      opts.body = body;
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    } else {
      opts.body = JSON.stringify(body);
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(path, opts);
  const raw = await res.text();
  let data = null; try { data = JSON.parse(raw); } catch { }

  if (!res.ok) {
    const msg = (data && (data.error || data.mensaje)) || raw || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data ?? {};
}

/**
 * Escapa texto antes de interpolarlo en una plantilla que termina en innerHTML.
 * Obligatorio para cualquier dato que venga de la base de datos: el nombre, el
 * correo o el telefono los escribe el propio usuario al registrarse, asi que
 * sin esto un nombre como <img src=x onerror=...> ejecuta script en la sesion
 * de quien abra el panel.
 */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c]);
}

// Exponer globalmente para uso en otros módulos
window.getUsuario = getUsuario;
window.getUsuarioSesion = getUsuarioSesion;
window.apiFetch = apiFetch;
window.escapeHtml = escapeHtml;
