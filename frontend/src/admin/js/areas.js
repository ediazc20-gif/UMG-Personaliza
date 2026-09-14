async function cargarAreas() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando áreas de entrega...</div>';

  try {
    const data = await apiFetch('/api/tienda/areas/admin');
    const areas = data.areas || [];

    contenedor.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 class="h5 mb-0"><i class="fa-solid fa-location-dot me-2 text-primary"></i> Áreas de Entrega del Campus</h2>
          <p class="text-secondary small mb-0">Zonas de recepción y entrega de pedidos para repartidores</p>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnNuevaArea">
          <i class="fa-solid fa-plus me-1"></i> Nueva área
        </button>
      </div>

      <div id="formArea" class="card mb-4 border-0" style="display:none">
        <div class="card-body p-4">
          <h3 class="h6 mb-3" style="color: var(--ink);" id="formAreaTitle">Nueva área de entrega</h3>
          <input type="hidden" id="areaId" />
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label small text-secondary">Nombre de la zona / edificio</label>
              <input class="form-control form-control-sm" id="areaNombre" placeholder="Ej. Edificio T - Sala de Estudio" required />
            </div>
            <div class="col-md-6">
              <label class="form-label small text-secondary">Estado</label>
              <select class="form-select form-select-sm" id="areaActivo">
                <option value="1">Activo (Visible para compradores)</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label small text-secondary">Descripción o referencia de entrega</label>
              <input class="form-control form-control-sm" id="areaDesc" placeholder="Ej. Nivel 2, junto a las escaleras principales" />
            </div>
          </div>
          <div class="mt-3 d-flex gap-2">
            <button type="button" class="btn btn-success btn-sm px-3" id="btnGuardarArea">
              <i class="fa-solid fa-floppy-disk me-1"></i> Guardar
            </button>
            <button type="button" class="btn btn-secondary btn-sm px-3" id="btnCancelArea">Cancelar</button>
          </div>
        </div>
      </div>

      <div class="table-responsive">
        <table class="table table-sm table-hover align-middle">
          <thead>
            <tr>
              <th style="width: 70px;">ID</th>
              <th>Zona / Ubicación</th>
              <th>Descripción</th>
              <th style="width: 120px;">Estado</th>
              <th style="width: 140px;" class="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody id="areasTableBody"></tbody>
        </table>
      </div>
    `;

    const tbody = document.getElementById('areasTableBody');
    const form = document.getElementById('formArea');

    function renderTable() {
      if (!areas.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-secondary py-3">No hay áreas de entrega registradas.</td></tr>';
        return;
      }
      tbody.innerHTML = areas.map(a => `
        <tr>
          <td><code>#${escapeHtml(a.id)}</code></td>
          <td class="fw-semibold" style="color: var(--ink);">${escapeHtml(a.nombre)}</td>
          <td class="text-secondary small">${escapeHtml(a.descripcion || '—')}</td>
          <td>
            <span class="badge ${a.activo ? 'bg-success' : 'bg-secondary'}">
              ${a.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td class="text-end">
            <button type="button" class="btn btn-outline-primary btn-sm btn-edit-area me-1" data-id="${escapeHtml(a.id)}">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            ${a.activo ? `
              <button type="button" class="btn btn-outline-danger btn-sm btn-del-area" data-id="${escapeHtml(a.id)}" title="Desactivar">
                <i class="fa-solid fa-ban"></i>
              </button>
            ` : ''}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-edit-area').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.id);
          const area = areas.find(x => x.id === id);
          if (area) openForm(area);
        });
      });

      tbody.querySelectorAll('.btn-del-area').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          if (!confirm('¿Deseas desactivar esta área de entrega?')) return;
          try {
            await apiFetch(`/api/tienda/areas/${id}`, { method: 'DELETE' });
            cargarAreas();
          } catch (err) {
            alert('Error: ' + err.message);
          }
        });
      });
    }

    function openForm(area) {
      form.style.display = 'block';
      document.getElementById('formAreaTitle').textContent = area ? 'Editar área de entrega' : 'Nueva área de entrega';
      document.getElementById('areaId').value = area?.id || '';
      document.getElementById('areaNombre').value = area?.nombre || '';
      document.getElementById('areaDesc').value = area?.descripcion || '';
      document.getElementById('areaActivo').value = area?.activo ? '1' : '0';
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    document.getElementById('btnNuevaArea').onclick = () => openForm(null);
    document.getElementById('btnCancelArea').onclick = () => { form.style.display = 'none'; };

    document.getElementById('btnGuardarArea').onclick = async () => {
      const id = document.getElementById('areaId').value;
      const nombre = document.getElementById('areaNombre').value.trim();
      const descripcion = document.getElementById('areaDesc').value.trim();
      const activo = document.getElementById('areaActivo').value === '1';

      if (!nombre) {
        alert('Ingresa el nombre del área.');
        return;
      }

      const body = { nombre, descripcion, activo };
      try {
        if (id) {
          await apiFetch(`/api/tienda/areas/${id}`, { method: 'PUT', body });
        } else {
          await apiFetch('/api/tienda/areas', { method: 'POST', body });
        }
        cargarAreas();
      } catch (err) {
        alert('Error al guardar: ' + err.message);
      }
    };

    renderTable();
  } catch (err) {
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error: ${escapeHtml(err.message)}</div>`;
  }
}

cargarAreas();
