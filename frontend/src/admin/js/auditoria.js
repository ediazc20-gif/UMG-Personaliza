async function cargarAuditoria() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando registros de auditoría...</div>';

  try {
    const resp = await fetch('/admin/auditoria', { credentials: 'include' });
    if (resp.status === 401 || resp.status === 403) {
      contenedor.innerHTML = '<div class="p-4 text-center text-danger"><i class="fa-solid fa-ban me-2"></i> Sin permisos para consultar la auditoría.</div>';
      return;
    }
    const logs = await resp.json();

    if (!Array.isArray(logs)) {
      contenedor.innerHTML = '<div class="p-4 text-center text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar la auditoría.</div>';
      return;
    }

    if (logs.length === 0) {
      contenedor.innerHTML = '<div class="empty-state p-4 text-center"><p class="lead">No hay registros de auditoría disponibles.</p></div>';
      return;
    }

    const filas = logs.map(log => `
      <tr>
        <td><code>#${log.id_auditoria}</code></td>
        <td class="fw-semibold" style="color: var(--ink);">${log.usuario_nombre || 'Sistema'}</td>
        <td><span class="badge bg-secondary">${log.accion}</span></td>
        <td class="text-secondary small">${log.descripcion || '—'}</td>
        <td><code class="text-info small">${log.ip_origen || '127.0.0.1'}</code></td>
        <td class="text-secondary small">${new Date(log.fecha_evento).toLocaleString('es-GT')}</td>
      </tr>
    `).join('');

    contenedor.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2 class="h5 mb-0"><i class="fa-solid fa-clock-rotate-left me-2 text-primary"></i> Registro de Auditoría</h2>
        <span class="badge bg-secondary">${logs.length} eventos</span>
      </div>
      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th style="width:70px">ID</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Descripción</th>
              <th>IP Origen</th>
              <th>Fecha y Hora</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `;

  } catch (err) {
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error: ${err.message}</div>`;
  }
}

cargarAuditoria();
