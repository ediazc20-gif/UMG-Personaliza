async function cargarUsuarios() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando usuarios...</div>';

  try {
    // Los roles se leen de la base, no se escriben a mano: los IdRol reales son
    // 4=Administrador, 5=Supervisor, 6=Comprador y 7=Repartidor. La lista fija
    // que habia antes (1,2,3) no existia en la tabla Roles y cualquier cambio
    // de rol moria contra la llave foranea.
    const [res, resRoles] = await Promise.all([
      fetch('/admin/usuarios', { credentials: 'include' }),
      fetch('/admin/roles', { credentials: 'include' }).catch(() => null),
    ]);
    if (!res.ok) throw new Error('Error al obtener usuarios');

    const data = await res.json();
    const usuarios = Array.isArray(data) ? data : data.usuarios;

    // Un supervisor puede listar usuarios pero no consultar /admin/roles: en ese
    // caso el rol se muestra como texto y no como selector editable.
    let roles = [];
    if (resRoles && resRoles.ok) {
      const rolesData = await resRoles.json().catch(() => []);
      if (Array.isArray(rolesData)) roles = rolesData;
    }
    const puedeEditarRol = roles.length > 0;

    if (!usuarios || usuarios.length === 0) {
      contenedor.innerHTML = '<div class="empty-state p-4 text-center"><p class="lead">No hay usuarios registrados en la base de datos.</p></div>';
      return;
    }

    const filas = usuarios
      .map((u) => {
        const nombre = `${escapeHtml(u.Nombres_Usuario || '')} ${escapeHtml(u.Apellidos_Usuario || '')}`.trim();
        const rolActual = Number(u.Id_Rol_Usuario);

        const celdaRol = puedeEditarRol
          ? `<select class="form-select form-select-sm rol-select" data-id="${escapeHtml(u.Id_Usuario)}" style="max-width: 170px;">
               ${roles
                 .map(
                   (r) =>
                     `<option value="${escapeHtml(r.IdRol)}" ${Number(r.IdRol) === rolActual ? 'selected' : ''}>${escapeHtml(r.Rol)}</option>`
                 )
                 .join('')}
             </select>`
          : `<span class="badge bg-secondary">${escapeHtml(u.Rol || '—')}</span>`;

        return `
      <tr>
        <td><code>#${escapeHtml(u.Id_Usuario)}</code></td>
        <td class="fw-semibold" style="color: var(--ink);">${nombre || '—'}</td>
        <td><span class="text-secondary">${escapeHtml(u.Email_Usuario || '')}</span></td>
        <td>${celdaRol}</td>
        <td>
          <button class="btn btn-sm ${u.Estado_Usuario == 1 ? 'btn-outline-success' : 'btn-outline-danger'} estado-btn" data-id="${escapeHtml(u.Id_Usuario)}" data-estado="${escapeHtml(u.Estado_Usuario)}">
            <i class="fa-solid ${u.Estado_Usuario == 1 ? 'fa-check' : 'fa-ban'} me-1"></i>
            ${u.Estado_Usuario == 1 ? 'Activo' : 'Inactivo'}
          </button>
        </td>
      </tr>`;
      })
      .join('');

    contenedor.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h5 mb-0"><i class="fa-solid fa-users me-2 text-primary"></i> Gestión de Usuarios</h2>
        <span class="badge bg-secondary">${usuarios.length} cuentas</span>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th>ID</th><th>Nombre completo</th><th>Correo institucional</th><th>Rol</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;

    // Cambio de rol
    document.querySelectorAll('.rol-select').forEach(select => {
      // Se guarda el valor previo para poder revertir el selector si el backend rechaza el cambio.
      select.dataset.anterior = select.value;
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const nuevoRol = e.target.value;
        const anterior = e.target.dataset.anterior;
        select.disabled = true;
        try {
          const res = await fetch(`/admin/usuarios/${id}/rol`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoRol })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            alert(data.error || 'No se pudo actualizar el rol.');
            e.target.value = anterior;
          } else {
            e.target.dataset.anterior = nuevoRol;
          }
        } catch (err) {
          alert('Error al actualizar rol: ' + err.message);
          e.target.value = anterior;
        } finally {
          select.disabled = false;
        }
      });
    });

    // Activar / desactivar usuario
    document.querySelectorAll('.estado-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const estadoActual = btn.dataset.estado;
        const nuevoEstado = estadoActual == 1 ? 0 : 1;
        btn.disabled = true;
        try {
          const res = await fetch(`/admin/usuarios/${id}/estado`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoEstado })
          });
          const data = await res.json();
          if (data.ok) {
            cargarUsuarios();
          } else {
            alert(data.error || 'Error al cambiar estado');
          }
        } catch (err) {
          alert('Error de conexión: ' + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });

  } catch (err) {
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar usuarios: ${escapeHtml(err.message)}</div>`;
  }
}

cargarUsuarios();
