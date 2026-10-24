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

    const catOptions = categorias.map(c => `<option value="${Number(c.id)}">${escapeHTML(c.nombre)}</option>`).join('');

    const formProdHtml = `
        <h4 style="font-size:1.05rem;margin:0 0 16px;color:var(--ink);" id="formProdTitle">Editar producto</h4>
        <input type="hidden" id="prodId" />
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Nombre</label>
            <input class="form-control" id="prodNombre" required placeholder="Ej: Llavero NFC" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
          </div>
          <div class="col-md-6">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Slug identificador</label>
            <input class="form-control" id="prodSlug" required placeholder="llavero-nfc" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Categoría</label>
            <select class="form-select" id="prodCat" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);">${catOptions}</select>
          </div>
          <div class="col-md-3">
            <label class="form-label" style="font-size:0.8rem;font-weight:600;color:var(--ink-mute);">Precio (Q)</label>
            <input type="number" step="0.01" class="form-control" id="prodPrecio" required placeholder="0.00" style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);" />
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
            <textarea class="form-control" id="prodDesc" rows="2" placeholder="Detalle del producto..." style="border-radius:var(--radius-sm);background:var(--surface-muted);border:1px solid var(--line);color:var(--ink);"></textarea>
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
        </div>`;

    contenedor.innerHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="margin:0 0 4px;font-family:var(--font-display,serif);font-size:1.5rem;color:var(--ink);">
          <i class="fa-solid fa-boxes-stacked" style="color:var(--primary);margin-right:8px;"></i> Catálogo y Control de Stock
        </h3>
        <p style="margin:0;font-size:0.875rem;color:var(--ink-mute);">Solo <strong>Llavero NFC</strong> y <strong>Tarjeta NFC</strong> — edita precio y stock con <em>Editar</em>.</p>
      </div>

      <div id="prodFormHost" style="display:none;" aria-hidden="true">
        <div id="formProd" class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;">
          ${formProdHtml}
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
    let editingId = null;

    function stockBadge(stockNum) {
      if (stockNum <= 0) {
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(198,40,40,0.12);color:#C62828;font-size:0.75rem;font-weight:700;"><i class="fa-solid fa-circle-xmark"></i> 0 (Agotado)</span>';
      }
      if (stockNum <= 5) {
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(184,92,58,0.12);color:var(--primary);font-size:0.75rem;font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${stockNum} (Últimas unidades)</span>`;
      }
      return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:99px;background:rgba(46,125,50,0.10);color:#2E7D32;font-size:0.75rem;font-weight:600;"><i class="fa-solid fa-check"></i> ${stockNum} disponibles</span>`;
    }

    tbody.innerHTML = productos.map(p => {
      const stockNum = Number(p.stock ?? 50);
      return `
        <tr class="prod-data-row" data-prod-id="${Number(p.id)}" style="border-bottom:1px solid var(--line);">
          <td style="padding:14px 16px;font-weight:600;color:var(--ink-mute);">${Number(p.id)}</td>
          <td style="padding:14px 16px;">
            <strong style="color:var(--ink);">${escapeHTML(p.nombre)}</strong>
            <div style="font-size:0.75rem;color:var(--ink-mute);">${escapeHTML(p.slug)}</div>
          </td>
          <td style="padding:14px 16px;color:var(--ink);">${escapeHTML(p.categoria)}</td>
          <td style="padding:14px 16px;font-weight:700;color:var(--ink);">Q${Number(p.precio).toFixed(2)}</td>
          <td style="padding:14px 16px;">${stockBadge(stockNum)}</td>
          <td style="padding:14px 16px;">
            <span style="display:inline-block;padding:2px 8px;border-radius:99px;font-size:0.75rem;font-weight:600;background:${p.activo ? 'rgba(46,125,50,0.1)' : 'rgba(112,112,112,0.1)'};color:${p.activo ? '#2E7D32' : 'var(--ink-mute)'};">
              ${p.activo ? 'Activo' : 'Inactivo'}
            </span>
          </td>
          <td style="padding:14px 16px;text-align:right;">
            <button type="button" class="btn-ghost-glass btn-edit" data-id="${Number(p.id)}" style="padding:6px 12px;font-size:0.8rem;">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
          </td>
        </tr>
        <tr class="prod-inline-form-row" data-for-prod="${Number(p.id)}">
          <td colspan="7" class="prod-inline-form-cell">
            <div class="prod-inline-form-collapse">
              <div class="prod-inline-form-slot" data-slot-for="${Number(p.id)}"></div>
            </div>
          </td>
        </tr>`;
    }).join('');

    const form = document.getElementById('formProd');
    const formHost = document.getElementById('prodFormHost');

    function finalizeFormHost() {
      formHost.appendChild(form);
      formHost.style.display = 'none';
      editingId = null;
    }

    function closeInlineForm(instant) {
      const prevId = editingId;
      if (prevId == null) return Promise.resolve();

      const formRow = tbody.querySelector(`.prod-inline-form-row[data-for-prod="${prevId}"]`);
      tbody.querySelectorAll('.prod-data-row').forEach(tr => tr.classList.remove('prod-row--editing'));
      formRow?.classList.remove('is-open');

      if (instant) {
        finalizeFormHost();
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        const ms = 420;
        const t = setTimeout(() => {
          finalizeFormHost();
          resolve();
        }, ms);
        formRow?.querySelector('.prod-inline-form-collapse')?.addEventListener('transitionend', () => {
          clearTimeout(t);
          finalizeFormHost();
          resolve();
        }, { once: true });
      });
    }

    async function openFormBelow(prod) {
      if (!prod) return;
      const pid = String(prod.id);
      if (editingId === pid) {
        await closeInlineForm(false);
        return;
      }
      await closeInlineForm(true);

      editingId = pid;
      const dataRow = tbody.querySelector(`.prod-data-row[data-prod-id="${prod.id}"]`);
      const formRow = tbody.querySelector(`.prod-inline-form-row[data-for-prod="${prod.id}"]`);
      const slot = formRow?.querySelector('.prod-inline-form-slot');
      if (!dataRow || !formRow || !slot) return;

      document.getElementById('formProdTitle').textContent = `Editar producto: ${prod.nombre}`;
      document.getElementById('prodId').value = prod.id;
      document.getElementById('prodNombre').value = prod.nombre || '';
      document.getElementById('prodSlug').value = prod.slug || '';
      document.getElementById('prodCat').value = prod.id_categoria || categorias[0]?.id || '';
      document.getElementById('prodPrecio').value = prod.precio ?? '';
      document.getElementById('prodStock').value = prod.stock ?? 50;
      document.getElementById('prodDesc').value = prod.descripcion || '';
      document.getElementById('prodLadoB').value = prod.tiene_lado_b ? '1' : '0';
      document.getElementById('prodActivo').value = prod.activo ? '1' : '0';

      slot.appendChild(form);
      dataRow.classList.add('prod-row--editing');
      requestAnimationFrame(() => {
        formRow.classList.add('is-open');
        formRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    document.getElementById('btnCancelProd').onclick = () => { closeInlineForm(false); };

    document.getElementById('btnGuardarProd').onclick = async () => {
      const nombreInp = document.getElementById('prodNombre');
      const slugInp = document.getElementById('prodSlug');
      const precioInp = document.getElementById('prodPrecio');
      for (const inp of [nombreInp, slugInp, precioInp]) {
        if (window.UmgFormValidate && !window.UmgFormValidate.validateControl(inp)) return;
      }
      const id = document.getElementById('prodId').value;
      const body = {
        id_categoria: Number(document.getElementById('prodCat').value),
        nombre: nombreInp.value.trim(),
        slug: slugInp.value.trim(),
        descripcion: document.getElementById('prodDesc').value.trim(),
        precio: Number(precioInp.value),
        stock: parseInt(document.getElementById('prodStock').value, 10) || 0,
        tiene_lado_b: document.getElementById('prodLadoB').value === '1',
        activo: document.getElementById('prodActivo').value === '1',
      };
      if (isNaN(body.precio)) {
        precioInp.setCustomValidity('Completa este campo.');
        precioInp.reportValidity();
        return;
      }
      precioInp.setCustomValidity('');
      try {
        await apiFetch(`/api/tienda/productos/${id}`, { method: 'PUT', body });
        await closeInlineForm(false);
        cargarProductos();
      } catch (e) {
        alert(e.message);
      }
    };

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.onclick = () => {
        const p = productos.find(x => String(x.id) === btn.dataset.id);
        openFormBelow(p);
      };
    });
  } catch (err) {
    contenedor.innerHTML = `<p class="text-danger">${escapeHTML(err.message)}</p>`;
  }
}

cargarProductos();
