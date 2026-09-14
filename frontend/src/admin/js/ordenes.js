const ESTADOS_MAP = {
  recibida: { label: 'Recibida', badge: 'badge-recibida', bg: 'rgba(184, 92, 58, 0.12)', color: 'var(--primary)', icon: 'fa-cart-shopping' },
  en_elaboracion: { label: 'En elaboración', badge: 'badge-elaboracion', bg: 'rgba(245, 158, 11, 0.12)', color: '#b45309', icon: 'fa-gears' },
  en_ruta: { label: 'En ruta', badge: 'badge-ruta', bg: 'rgba(59, 130, 246, 0.12)', color: '#1d4ed8', icon: 'fa-truck-fast' },
  lista_entrega: { label: 'Lista entrega', badge: 'badge-lista', bg: 'rgba(168, 85, 247, 0.12)', color: '#7e22ce', icon: 'fa-box-open' },
  entregada: { label: 'Entregada', badge: 'badge-entregada', bg: 'rgba(34, 197, 94, 0.12)', color: '#15803d', icon: 'fa-circle-check' },
  cancelada: { label: 'Cancelada', badge: 'badge-cancelada', bg: 'rgba(239, 68, 68, 0.12)', color: '#b91c1c', icon: 'fa-circle-xmark' },
  no_encontrado: { label: 'No encontrado', badge: 'badge-no-enc', bg: 'rgba(234, 88, 12, 0.12)', color: '#c2410c', icon: 'fa-triangle-exclamation' },
};

// Transiciones válidas del autómata en frontend para guiar visualmente los botones
const TRANSICIONES_AUTOMATA = {
  recibida: [
    { target: 'en_elaboracion', label: 'Iniciar elaboración', icon: 'fa-gears', btnClass: 'btn-glass' },
    { target: 'cancelada', label: 'Cancelar', icon: 'fa-xmark', btnClass: 'btn-ghost-glass', isDanger: true }
  ],
  en_elaboracion: [
    { target: 'en_ruta', label: 'Despachar (En ruta)', icon: 'fa-truck-fast', btnClass: 'btn-glass' },
    { target: 'cancelada', label: 'Cancelar', icon: 'fa-xmark', btnClass: 'btn-ghost-glass', isDanger: true }
  ],
  en_ruta: [
    { target: 'entregada', label: 'Entregada', icon: 'fa-check', btnClass: 'btn-glass' },
    { target: 'no_encontrado', label: 'No encontrado', icon: 'fa-triangle-exclamation', btnClass: 'btn-ghost-glass' }
  ],
  lista_entrega: [
    { target: 'entregada', label: 'Entregar', icon: 'fa-check', btnClass: 'btn-glass' },
    { target: 'no_encontrado', label: 'No encontrado', icon: 'fa-triangle-exclamation', btnClass: 'btn-ghost-glass' }
  ],
  no_encontrado: [
    { target: 'en_ruta', label: 'Reintentar ruta', icon: 'fa-rotate-right', btnClass: 'btn-glass' },
    { target: 'cancelada', label: 'Cancelar/Retornar', icon: 'fa-xmark', btnClass: 'btn-ghost-glass', isDanger: true }
  ],
  entregada: [], // Terminal
  cancelada: []  // Terminal
};

async function cargarOrdenes() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center" style="color:var(--ink-mute);"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando órdenes y autómata de estados...</div>';

  try {
    const data = await apiFetch('/api/tienda/ordenes/admin/list');
    const ordenes = data.ordenes || [];

    const optsFiltro = Object.entries(ESTADOS_MAP).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

    contenedor.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:14px;">
        <div>
          <h3 style="margin:0 0 4px;font-family:var(--font-display,serif);font-size:1.5rem;color:var(--ink);">
            <i class="fa-solid fa-receipt" style="color:var(--primary);margin-right:8px;"></i> Control de Órdenes y Entregas
          </h3>
          <p style="margin:0;font-size:0.875rem;color:var(--ink-mute);">
            Identificación de compradores, productos solicitados y transiciones guiadas por Máquina de Estados (FSM).
          </p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
          <div style="position:relative;min-width:230px;">
            <i class="fa-solid fa-magnifying-glass" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--ink-mute);font-size:0.8rem;"></i>
            <input type="search" id="buscarOrdenes" class="form-control form-control-sm" placeholder="Buscar comprador, carnet, guía o producto..." style="padding-left:34px;border-radius:var(--radius-pill);background:var(--surface);border:1px solid var(--line);color:var(--ink);font-size:0.85rem;" />
          </div>
          <select id="filtroEstado" class="form-select form-select-sm" style="max-width:180px;border-radius:var(--radius-pill);background:var(--surface);border:1px solid var(--line);color:var(--ink);font-size:0.85rem;">
            <option value="">Todos los estados</option>
            ${optsFiltro}
          </select>
          <button type="button" class="btn-ghost-glass" id="btnExportCsv" style="padding:6px 14px;font-size:0.85rem;">
            <i class="fa-solid fa-file-csv me-1"></i> Exportar CSV
          </button>
        </div>
      </div>

      <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.03);">
        <table class="table table-hover mb-0" style="color:var(--ink);vertical-align:middle;">
          <thead style="background:var(--surface-muted);border-bottom:1px solid var(--line);">
            <tr>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Comprador / Estudiante</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">No. Guía y Fecha</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Productos</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Entrega / Pago</th>
              <th style="padding:12px 16px;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Estado Actual</th>
              <th style="padding:12px 16px;text-align:right;font-size:0.8rem;color:var(--ink-mute);text-transform:uppercase;">Siguiente Paso (Autómata)</th>
            </tr>
          </thead>
          <tbody id="ordenesBody"></tbody>
        </table>
      </div>`;

    const tbody = document.getElementById('ordenesBody');
    const filtro = document.getElementById('filtroEstado');
    const inputBuscar = document.getElementById('buscarOrdenes');
    let listaActual = ordenes;

    function render(list) {
      listaActual = list;
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4" style="color:var(--ink-mute);"><i class="fa-solid fa-inbox me-2"></i> No hay órdenes registradas para esta búsqueda o filtro.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(o => {
        const estInfo = ESTADOS_MAP[o.estado] || { label: o.estado, bg: 'rgba(0,0,0,0.05)', color: 'var(--ink)', icon: 'fa-circle' };
        const transiciones = TRANSICIONES_AUTOMATA[o.estado] || [];
        const isTerminal = transiciones.length === 0;

        // Nombre formateado del comprador
        const nombreCompleto = [o.Nombres_Usuario, o.Apellidos_Usuario].filter(Boolean).join(' ') || o.Usuario || 'Estudiante UMG';
        const usuarioIdentificador = o.Usuario || o.Email_Usuario || '—';
        const telefono = o.Celular_Usuario ? `<span style="font-size:0.75rem;color:var(--ink-mute);"><i class="fa-solid fa-phone me-1"></i>${escapeHtml(o.Celular_Usuario)}</span>` : '';
        const inicial = escapeHtml(nombreCompleto.charAt(0).toUpperCase());

        // Resumen de productos
        const productosTxt = o.productos_resumen || 'Artículos personalizados';
        const totalArts = o.total_articulos ? `<span style="font-size:0.75rem;color:var(--primary);font-weight:600;">(${escapeHtml(o.total_articulos)} ${o.total_articulos === 1 ? 'ítem' : 'ítems'})</span>` : '';

        // Botones de acción del autómata
        let botonesAccion = '';
        if (isTerminal) {
          botonesAccion = `<span style="font-size:0.75rem;color:var(--ink-mute);font-style:italic;"><i class="fa-solid fa-lock me-1"></i> Estado final</span>`;
        } else {
          botonesAccion = transiciones.map(t => {
            const dangerStyle = t.isDanger ? 'color:#b91c1c;' : '';
            return `
              <button type="button" class="${t.btnClass} btn-transicion" data-id="${escapeHtml(o.id)}" data-target="${t.target}" data-codigo="${escapeHtml(o.codigo)}" style="padding:5px 11px;font-size:0.75rem;${dangerStyle}">
                <i class="fa-solid ${t.icon}"></i> ${t.label}
              </button>`;
          }).join(' ');
        }

        return `
          <tr style="border-bottom:1px solid var(--line);" id="row-orden-${escapeHtml(o.id)}">
            <!-- 1. IDENTIFICACIÓN CLARA DEL COMPRADOR -->
            <td style="padding:14px 16px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:50%;background:rgba(184,92,58,0.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9rem;flex-shrink:0;">
                  ${inicial}
                </div>
                <div>
                  <div style="font-weight:700;color:var(--ink);font-size:0.95rem;">${escapeHtml(nombreCompleto)}</div>
                  <div style="font-size:0.75rem;color:var(--ink-mute);display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                    <span><i class="fa-solid fa-user me-1"></i>${escapeHtml(usuarioIdentificador)}</span>
                    ${telefono}
                  </div>
                </div>
              </div>
            </td>

            <!-- 2. NO. DE GUÍA Y FECHA -->
            <td style="padding:14px 16px;">
              <strong style="color:var(--primary);font-family:'Courier New',monospace;letter-spacing:0.04em;font-size:0.9rem;">
                <i class="fa-solid fa-barcode me-1"></i>${escapeHtml(o.codigo)}
              </strong>
              <div style="font-size:0.75rem;color:var(--ink-mute);margin-top:2px;">
                <i class="fa-regular fa-clock me-1"></i>${new Date(o.creado).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </div>
            </td>

            <!-- 3. PRODUCTOS EN LA ORDEN -->
            <td style="padding:14px 16px;max-width:240px;">
              <div style="font-size:0.85rem;font-weight:600;color:var(--ink);line-height:1.3;">
                ${escapeHtml(productosTxt)} ${totalArts}
              </div>
              <div style="font-size:0.85rem;font-weight:700;color:var(--primary);margin-top:2px;">
                Total: Q${Number(o.total).toFixed(2)}
              </div>
            </td>

            <!-- 4. LUGAR DE ENTREGA Y PAGO -->
            <td style="padding:14px 16px;">
              <div style="font-size:0.85rem;color:var(--ink);font-weight:600;">
                <i class="fa-solid fa-location-dot me-1" style="color:var(--primary);"></i> ${escapeHtml(o.area_entrega || 'Campus Central UMG')}
              </div>
              <div style="margin-top:3px;">
                <span style="display:inline-block;padding:2px 8px;border-radius:6px;background:var(--surface-muted);border:1px solid var(--line);font-size:0.72rem;color:var(--ink-mute);text-transform:capitalize;">
                  ${o.metodo_pago === 'efectivo' ? '<i class="fa-solid fa-money-bill-wave me-1"></i>Efectivo' : '<i class="fa-solid fa-credit-card me-1"></i>Tarjeta'}
                </span>
              </div>
            </td>

            <!-- 5. ESTADO ACTUAL -->
            <td style="padding:14px 16px;">
              <span class="badge-estado" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;font-size:0.75rem;font-weight:700;background:${estInfo.bg};color:${estInfo.color};white-space:nowrap;">
                <i class="fa-solid ${estInfo.icon}"></i> ${estInfo.label}
              </span>
            </td>

            <!-- 6. ACCIONES GUIADAS -->
            <td style="padding:14px 16px;text-align:right;">
              <div style="display:inline-flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap;">
                ${botonesAccion}
              </div>
            </td>
          </tr>`;
      }).join('');

      // Event listeners para los botones de acción del autómata
      tbody.querySelectorAll('.btn-transicion').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const target = btn.dataset.target;
          const codigo = btn.dataset.codigo;
          const targetLabel = ESTADOS_MAP[target]?.label || target;

          if (target === 'cancelada' && !confirm(`¿Estás seguro de cancelar la orden ${codigo}?`)) {
            return;
          }

          btn.disabled = true;
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

          try {
            await apiFetch(`/api/tienda/ordenes/${id}/estado`, {
              method: 'PUT',
              body: { estado: target, nota: `Transición autómata ejecutada hacia ${targetLabel}` },
            });
            // Recargar órdenes para refrescar las opciones del autómata
            await cargarOrdenes();
          } catch (err) {
            alert(err.message || 'Error en la transición de estado');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
          }
        });
      });
    }

    function aplicarFiltros() {
      const q = (inputBuscar?.value || '').toLowerCase().trim();
      const est = filtro?.value || '';

      let filtradas = ordenes;

      if (est) {
        filtradas = filtradas.filter(o => o.estado === est);
      }

      if (q) {
        filtradas = filtradas.filter(o => {
          const nombre = `${o.Nombres_Usuario || ''} ${o.Apellidos_Usuario || ''}`.toLowerCase();
          const user = (o.Usuario || '').toLowerCase();
          const email = (o.Email_Usuario || '').toLowerCase();
          const codigo = (o.codigo || '').toLowerCase();
          const prods = (o.productos_resumen || '').toLowerCase();
          const area = (o.area_entrega || '').toLowerCase();
          return nombre.includes(q) || user.includes(q) || email.includes(q) || codigo.includes(q) || prods.includes(q) || area.includes(q);
        });
      }

      render(filtradas);
    }

    render(ordenes);
    filtro?.addEventListener('change', aplicarFiltros);
    inputBuscar?.addEventListener('input', aplicarFiltros);

    document.getElementById('btnExportCsv')?.addEventListener('click', () => {
      if (!listaActual.length) {
        alert('No hay datos para exportar.');
        return;
      }
      let csvContent = '\uFEFFID,Codigo,Comprador,Usuario,Email,Telefono,Productos,Total_GTQ,Metodo_Pago,Area_Entrega,Estado,Fecha\n';
      listaActual.forEach(o => {
        const fecha = new Date(o.creado).toLocaleString('es-GT').replace(/,/g, '');
        const area = (o.area_entrega || '').replace(/,/g, ' ');
        const nombre = `${o.Nombres_Usuario || ''} ${o.Apellidos_Usuario || ''}`.trim() || 'Estudiante UMG';
        const prods = (o.productos_resumen || '').replace(/"/g, '""');
        csvContent += `${o.id},"${o.codigo}","${nombre}","${o.Usuario || ''}","${o.Email_Usuario || ''}","${o.Celular_Usuario || ''}","${prods}",${Number(o.total).toFixed(2)},"${o.metodo_pago}","${area}","${o.estado}","${fecha}"\n`;
      });
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ordenes_campus_${Date.now()}.csv`;
      link.click();
    });

  } catch (err) {
    contenedor.innerHTML = `<p class="text-danger">${escapeHtml(err.message)}</p>`;
  }
}

cargarOrdenes();
