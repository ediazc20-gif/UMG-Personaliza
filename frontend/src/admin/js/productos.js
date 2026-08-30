async function cargarProductos() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<p style="color:var(--ink-mute);">Cargando catálogo de productos...</p>';

  try {
    const [prodRes, catRes] = await Promise.all([
      apiFetch('/api/tienda/productos/admin/list'),
      apiFetch('/api/tienda/categorias'),
    ]);
    const productos = prodRes.productos || [];
    const categorias = catRes.categorias || [];

    const catOptions = categorias.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    contenedor.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">
        <div>
          <h3 style="margin:0 0 4px;font-family:var(--font-display,serif);font-size:1.5rem;color:var(--ink);">
            <i class="fa-solid fa-boxes-stacked" style="color:var(--primary);margin-right:8px;"></i> Catálogo y Control de Stock
          </h3>
          <p style="margin:0;font-size:0.875rem;color:var(--ink-mute);">Gestiona productos, precios, descripciones y existencias en tiempo real.</p>
        </div>
        <button type="button" class="btn-glass" id="btnNuevoProd" style="padding:8px 16px;font-size:0.875rem;">
          <i class="fa-solid fa-plus"></i> Nuevo producto
        </button>
      </div>

      <div id="formProd" class="glass-card" style="display:none;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;margin-bottom:24px;">
        <h4 style="font-size:1.15rem;margin:0 0 16px;color:var(--ink);" id="formProdTitle">Nuevo producto</h4>
        <input type="hidden" id="prodId" />
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Nombre</label>
            <input class="form-control" id="prodNombre" placeholder="Ej: Taza Mágica UMG" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
          </div>
          <div class="col-md-6">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Slug identificador</label>
            <input class="form-control" id="prodSlug" placeholder="ej-taza-magica" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Categoría</label>
            <select class="form-select" id="prodCat" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);">${catOptions}</select>
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Precio (Q)</label>
            <input type="number" step="0.01" class="form-control" id="prodPrecio" placeholder="0.00" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">
              <i class="fa-solid fa-warehouse" style="color:var(--primary);"></i> Stock (Existencias)
            </label>
            <input type="number" min="0" step="1" class="form-control" id="prodStock" placeholder="50" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);font-weight:600;" />
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Lado B (Personalización doble)</label>
            <select class="form-select" id="prodLadoB" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);">
              <option value="1">Sí (Admite Lado A y B)</option>
              <option value="0">No (Solo frontal)</option>
            </select>
          </div>
          <div class="col-12">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Descripción</label>
            <textarea class="form-control" id="prodDesc" rows="2" placeholder="Detalle o especificaciones del producto..." style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);"></textarea>
          </div>
          <div class="col-md-6">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Estado del producto</label>
            <select class="form-select" id="prodActivo" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);">
              <option value="1">Activo (Visible en tienda)</option>
              <option value="0">Inactivo (Oculto)</option>
            </select>
          </div>
        </div>
        <div class="mt-3 d-flex gap-2">
          <button type="button" class="btn-glass" id="btnGuardarProd" style="padding:8px 18px;">
            <i class="fa-solid fa-floppy-disk"></i> Guardar producto
          </button>
          <button type="button" class="btn-ghost-glass" id="btnCancelProd" style="padding:8px 14px;">
            Cancelar
          </button>
        </div>
      </div>

      <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;">
        <table class="table table-hover mb-0" style="color:var(--ink);vertical-align:middle;">
          <thead style="background:var(--surface-muted);border-bottom:1px solid var(--line);">
            <tr>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">ID</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Producto</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Categoría</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Precio</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Stock (Existencias)</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Estado</th>
              <th style="padding:12px 16px;text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody id="prodTableBody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('prodTableBody');
    tbody.innerHTML = productos.map(p => {
      const stockNum = Number(p.stock ?? 50);
      let stockBadge = '';
      if (stockNum <= 0) {
        stockBadge = '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(198,40,40,0.12);color:#C62828;font-size:0.75rem;font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> 0 (Agotado)</span>';
      } else if (stockNum <= 5) {
        stockBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(184,92,58,0.12);color:var(--primary);font-size:0.75rem;font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${stockNum} (Últimas unidades)</span>`;
      } else {
        stockBadge = `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(46,125,50,0.10);color:#2E7D32;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-check"></i> ${stockNum} disponibles</span>`;
      }

      return `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:14px 16px;font-weight:600;color:var(--ink-mute);">${p.id}</td>
          <td style="padding:14px 16px;">
            <strong style="color:var(--ink);">${p.nombre}</strong>
            <div style="font-size:0.75rem;color:var(--ink-mute);">${p.slug}</div>
          </td>
          <td style="padding:14px 16px;color:var(--ink);">${p.categoria}</td>
          <td style="padding:14px 16px;font-weight:700;color:var(--ink);">Q${Number(p.precio).toFixed(2)}</td>
          <td style="padding:14px 16px;">${stockBadge}</td>
          <td style="padding:14px 16px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.75rem;font-weight:600;background:${p.activo ? 'rgba(46,125,50,0.1)' : 'rgba(112,112,112,0.1)'};color:${p.activo ? '#2E7D32' : 'var(--ink-mute)'};">
              ${p.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td style="padding:14px 16px;text-align:right;">
            <button type="button" class="btn-ghost-glass btn-edit" data-id="${p.id}" style="padding:6px 12px;font-size:0.8rem;">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
          </td>
        </tr>`;
    }).join('');

    const form = document.getElementById('formProd');
    const slugify = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    document.getElementById('prodNombre')?.addEventListener('input', e => {
      if (!document.getElementById('prodId').value) {
        document.getElementById('prodSlug').value = slugify(e.target.value);
      }
    });

    function openForm(prod) {
      form.style.display = 'block';
      document.getElementById('formProdTitle').textContent = prod ? `Editar producto: ${prod.nombre}` : 'Nuevo producto';
      document.getElementById('prodId').value = prod?.id || '';
      document.getElementById('prodNombre').value = prod?.nombre || '';
      document.getElementById('prodSlug').value = prod?.slug || '';
      document.getElementById('prodCat').value = prod?.id_categoria || categorias[0]?.id || '';
      document.getElementById('prodPrecio').value = prod?.precio ?? '';
      document.getElementById('prodStock').value = prod?.stock ?? 50;
      document.getElementById('prodDesc').value = prod?.descripcion || '';
      document.getElementById('prodLadoB').value = prod?.tiene_lado_b ? '1' : '0';
      document.getElementById('prodActivo').value = prod?.activo ? '1' : '0';
      form.scrollIntoView({ behavior: 'smooth' });
    }

    document.getElementById('btnNuevoProd').onclick = () => openForm(null);
    document.getElementById('btnCancelProd').onclick = () => { form.style.display = 'none'; };

    document.getElementById('btnGuardarProd').onclick = async () => {
      const id = document.getElementById('prodId').value;
      const body = {
        id_categoria: Number(document.getElementById('prodCat').value),
        nombre: document.getElementById('prodNombre').value.trim(),
        slug: document.getElementById('prodSlug').value.trim(),
        descripcion: document.getElementById('prodDesc').value.trim(),
        precio: Number(document.getElementById('prodPrecio').value),
        stock: parseInt(document.getElementById('prodStock').value, 10) || 0,
        tiene_lado_b: document.getElementById('prodLadoB').value === '1',
        activo: document.getElementById('prodActivo').value === '1',
      };
      if (!body.nombre || !body.slug || isNaN(body.precio)) {
        alert('Completa nombre, slug y precio.');
        return;
      }
      try {
        if (id) {
          await apiFetch(`/api/tienda/productos/${id}`, { method: 'PUT', body });
        } else {
          await apiFetch('/api/tienda/productos', { method: 'POST', body });
        }
        cargarProductos();
      } catch (e) {
        alert(e.message);
      }
    };

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        const p = productos.find(x => String(x.id) === btn.dataset.id);
        openForm(p);
      };
    });
  } catch (err) {
    contenedor.innerHTML = `<p class="text-danger">${err.message}</p>`;
  }
}

cargarProductos();
