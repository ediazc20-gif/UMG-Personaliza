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

// Exponer globalmente para uso en otros módulos
window.getUsuario = getUsuario;
window.getUsuarioSesion = getUsuarioSesion;
window.apiFetch = apiFetch;
