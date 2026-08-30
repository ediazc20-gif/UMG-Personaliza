async function cargarUsuarios() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando usuarios...</div>';

  try {
    const res = await fetch('/admin/usuarios');
    if (!res.ok) throw new Error('Error al obtener usuarios');

    const data = await res.json();
    const usuarios = Array.isArray(data) ? data : data.usuarios;

    if (!usuarios || usuarios.length === 0) {
      contenedor.innerHTML = '<div class="empty-state p-4 text-center"><p class="lead">No hay usuarios registrados en la base de datos.</p></div>';
      return;
    }

    const filas = usuarios
      .map(
        (u) => `
      <tr>
        <td><code>#${u.Id_Usuario}</code></td>
        <td class="fw-semibold" style="color: var(--ink);">${u.Nombres_Usuario || ''} ${u.Apellidos_Usuario || ''}</td>
        <td><span class="text-secondary">${u.Email_Usuario}</span></td>
        <td>
          <select class="form-select form-select-sm rol-select" data-id="${u.Id_Usuario}" style="max-width: 160px;">
            <option value="1" ${u.Rol === 'Administrador' ? 'selected' : ''}>Administrador</option>
            <option value="2" ${u.Rol === 'Supervisor' ? 'selected' : ''}>Supervisor</option>
            <option value="3" ${u.Rol === 'Analista' ? 'selected' : ''}>Analista</option>
          </select>
        </td>
        <td>
          <button class="btn btn-sm ${u.Estado_Usuario == 1 ? 'btn-outline-success' : 'btn-outline-danger'} estado-btn" data-id="${u.Id_Usuario}" data-estado="${u.Estado_Usuario}">
            <i class="fa-solid ${u.Estado_Usuario == 1 ? 'fa-check' : 'fa-ban'} me-1"></i>
            ${u.Estado_Usuario == 1 ? 'Activo' : 'Inactivo'}
          </button>
        </td>
      </tr>`
      )
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
      select.addEventListener('change', async (e) => {
        const id = e.target.dataset.id;
        const nuevoRol = e.target.value;
        select.disabled = true;
        try {
          const res = await fetch(`/admin/usuarios/${id}/rol`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevoRol })
          });
          const data = await res.json();
          if (!data.ok && data.error) alert(data.error);
        } catch (err) {
          alert('Error al actualizar rol: ' + err.message);
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
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar usuarios: ${err.message}</div>`;
  }
}

cargarUsuarios();
