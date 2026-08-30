document.addEventListener('DOMContentLoaded', () => {
  const btnLogout = document.getElementById('btnLogout');
  const menuLinks = document.querySelectorAll('#sidebar [data-section]');
  const container = document.getElementById('section-container');
  const nombreAdmin = document.getElementById('admin-nombre');

  // Guard de sesión: verificar rol Administrador
  var uid = localStorage.getItem('uid');
  var rolGuard = (localStorage.getItem('rol') || '').toUpperCase();
  if (!uid || (rolGuard !== 'ADMINISTRADOR' && rolGuard !== 'ADMIN')) {
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
    return;
  }

  // Validar token contra el servidor
  (async function() {
    try {
      var res = await fetch('/api/roles', { credentials: 'include' });
      if (res.status === 401 || res.status === 403) {
        localStorage.clear();
        sessionStorage.clear();
        window.location.replace('/');
        return;
      }
    } catch (e) {}
  })();

  // Mostrar nombre de usuario en cabecera y sidebar
  var nombre = localStorage.getItem('nombre') || 'Administrador';
  if (nombreAdmin) nombreAdmin.textContent = nombre;
  var elUsername = document.getElementById('sidebarUsername');
  var elAvatar = document.getElementById('sidebarAvatar');
  if (elUsername) elUsername.textContent = nombre;
  if (elAvatar) elAvatar.textContent = nombre.charAt(0).toUpperCase();

  function setSidebarOpen(open) {
    document.body.classList.toggle('admin-nav-open', open);
    var toggle = document.getElementById('btnSidebarToggle');
    var backdrop = document.getElementById('sidebarBackdrop');
    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (backdrop) {
      if (open) backdrop.removeAttribute('hidden');
      else backdrop.setAttribute('hidden', '');
    }
  }

  function closeSidebar() { setSidebarOpen(false); }
  function toggleSidebar() {
    setSidebarOpen(!document.body.classList.contains('admin-nav-open'));
  }

  document.getElementById('btnSidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('btnSidebarClose')?.addEventListener('click', closeSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeSidebar();
  });

  // Evento para cada link del menú
  menuLinks.forEach(function(link) {
    link.addEventListener('click', async function(e) {
      e.preventDefault();
      var section = link.dataset.section;

      // Feedback visual
      menuLinks.forEach(function(l) {
        l.classList.remove('active');
      });
      link.classList.add('active');
      closeSidebar();

      // Carga dinámica del módulo correspondiente
      container.innerHTML = '<p class="text-center text-secondary">Cargando ' + section + '...</p>';
      try {
        document.querySelectorAll('script[data-dynamic]').forEach(function(s) { s.remove(); });
        var script = document.createElement('script');
        script.src = '/admin/js/' + section + '.js?' + Date.now();
        script.dataset.dynamic = 'true';
        document.body.appendChild(script);
      } catch (err) {
        container.innerHTML = '<p class="text-danger text-center">Error cargando seccion: ' + err.message + '</p>';
      }
    });
  });

  // Links externos del sidebar (dashboard ventas) también cierran el drawer
  document.querySelectorAll('#sidebar a:not([data-section])').forEach(function(a) {
    a.addEventListener('click', closeSidebar);
  });

  // Cerrar sesión (único handler)
  function doLogout() {
    fetch('/logout', { method: 'POST', credentials: 'include' }).catch(function() {});
    localStorage.clear();
    sessionStorage.clear();
    window.location.replace('/');
  }

  if (btnLogout) btnLogout.addEventListener('click', doLogout);

  // Cargar sección inicial por defecto (usuarios)
  const initialLink = document.querySelector('#sidebar [data-section="usuarios"]');
  if (initialLink) {
    initialLink.click();
  }
});
