async function cargarRoles() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando roles...</div>';

  try {
    const resp = await fetch('/admin/roles');
    const roles = await resp.json();

    const filas = (Array.isArray(roles) ? roles : []).map(r => `
      <tr>
        <td><code>#${r.IdRol}</code></td>
        <td class="fw-semibold" style="color: var(--ink);">
          <i class="fa-solid ${r.Rol === 'Administrador' ? 'fa-shield-halved' : r.Rol === 'Supervisor' ? 'fa-chart-pie' : 'fa-user'} me-2 text-primary"></i>
          ${r.Rol}
        </td>
        <td>
          <span class="badge bg-secondary px-3 py-2 fs-7">${r.TotalUsuarios} usuarios</span>
        </td>
      </tr>
    `).join('');

    contenedor.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h5 mb-0"><i class="fa-solid fa-layer-group me-2 text-primary"></i> Roles del Sistema</h2>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th style="width: 80px;">ID</th>
              <th>Nombre del Rol</th>
              <th style="width: 180px;">Total Asignados</th>
            </tr>
          </thead>
          <tbody>
            ${filas || '<tr><td colspan="3" class="text-center text-secondary">No se encontraron roles</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar roles: ${err.message}</div>`;
  }
}

cargarRoles();
