// redirect.js — Redireccion post-login por rol
function redirectByRole(rol) {
  const r = String(rol || '').toUpperCase();
  if (r === 'ADMIN' || r === 'ADMINISTRADOR') {
    window.location.replace('/admin/administrador.html');
    return;
  }
  if (r === 'SUPERVISOR') {
    window.location.replace('/supervisor/dashboard.html');
    return;
  }
  if (r === 'REPARTIDOR') {
    window.location.replace('/repartidor/entrega.html');
    return;
  }
  window.location.replace('/comprador/tienda.html');
}

window.redirectByRole = redirectByRole;
