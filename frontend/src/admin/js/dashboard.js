// Dashboard module integrado (Ventas + Métricas de órdenes e ingresos)
(function() {
  let chartVentas = null;
  let chartLogins = null;
  let latestVentasData = null;

  async function initDashboard() {
    const container = document.getElementById('section-container');
    if (!container) return;

    container.innerHTML = `
      <div style="max-width:1100px;margin:0 auto;">
        <!-- Cabecera con selector de rango y exportación -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:16px;">
          <div>
            <h3 style="margin:0 0 4px;font-family:var(--font-display,serif);font-size:1.6rem;color:var(--ink);">
              <i class="fa-solid fa-chart-pie" style="color:var(--primary);margin-right:8px;"></i> Dashboard de Ventas y Métricas
            </h3>
            <p style="margin:0;font-size:0.9rem;color:var(--ink-mute);">
              Resumen financiero, rendimiento de catálogo y trazabilidad de ingresos en el campus.
            </p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            <select id="rangoVentas" class="form-select form-select-sm" style="max-width:160px;border-radius:var(--radius-pill);background:var(--surface);border:1px solid var(--line);color:var(--ink);font-weight:600;">
              <option value="dia">Hoy</option>
              <option value="semana">Esta semana</option>
              <option value="total" selected>Histórico total</option>
            </select>
            <button type="button" class="btn-ghost-glass" id="btnExportVentasCsv" style="padding:7px 16px;font-size:0.85rem;">
              <i class="fa-solid fa-file-csv me-1"></i> Exportar CSV
            </button>
          </div>
        </div>

        <!-- Tarjetas KPI -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:24px;">
          <!-- 1. Órdenes -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;display:flex;align-items:center;gap:16px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(184, 92, 58, 0.12);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
              <i class="fa-solid fa-receipt"></i>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--ink-mute);letter-spacing:0.04em;">Total Órdenes</div>
              <div style="font-size:1.75rem;font-weight:800;color:var(--ink);font-family:var(--font-display,serif);" id="kpiOrdenes">—</div>
            </div>
          </div>

          <!-- 2. Ingresos -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;display:flex;align-items:center;gap:16px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(46, 125, 50, 0.12);color:#2E7D32;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
              <i class="fa-solid fa-money-bill-trend-up"></i>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--ink-mute);letter-spacing:0.04em;">Ingresos Totales</div>
              <div style="font-size:1.75rem;font-weight:800;color:#2E7D32;font-family:var(--font-display,serif);" id="kpiIngresos">—</div>
            </div>
          </div>

          <!-- 3. Entregadas -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;display:flex;align-items:center;gap:16px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(59, 130, 246, 0.12);color:#2563eb;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--ink-mute);letter-spacing:0.04em;">Entregadas con Éxito</div>
              <div style="font-size:1.75rem;font-weight:800;color:var(--ink);font-family:var(--font-display,serif);" id="kpiEntregadas">—</div>
            </div>
          </div>

          <!-- 4. Ticket promedio -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:20px;display:flex;align-items:center;gap:16px;">
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(245, 158, 11, 0.12);color:#d97706;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">
              <i class="fa-solid fa-chart-line"></i>
            </div>
            <div>
              <div style="font-size:0.75rem;font-weight:600;text-transform:uppercase;color:var(--ink-mute);letter-spacing:0.04em;">Ticket Promedio</div>
              <div style="font-size:1.75rem;font-weight:800;color:var(--ink);font-family:var(--font-display,serif);" id="kpiTicket">—</div>
            </div>
          </div>
        </div>

        <!-- Gráfica de distribución y Top Productos -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:20px;margin-bottom:24px;">
          <!-- Gráfica por Estado -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;">
            <h4 style="font-size:1.05rem;margin:0 0 16px;color:var(--ink);display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-chart-column" style="color:var(--primary);"></i> Distribución de Órdenes por Estado
            </h4>
            <div style="position:relative;height:220px;width:100%;">
              <canvas id="chartEstados"></canvas>
            </div>
          </div>

          <!-- Top Productos Vendidos -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;">
            <h4 style="font-size:1.05rem;margin:0 0 16px;color:var(--ink);display:flex;align-items:center;gap:8px;">
              <i class="fa-solid fa-trophy" style="color:var(--primary);"></i> Productos Más Vendidos
            </h4>
            <div id="topProductos" style="display:flex;flex-direction:column;gap:10px;max-height:220px;overflow-y:auto;">
              <p style="color:var(--ink-mute);font-size:0.9rem;">Cargando productos...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('rangoVentas')?.addEventListener('change', loadVentas);
    document.getElementById('btnExportVentasCsv')?.addEventListener('click', exportarCsv);

    await loadVentas();
  }

  async function loadVentas() {
    const rango = document.getElementById('rangoVentas')?.value || 'total';
    try {
      const data = await apiFetch(`/api/tienda/dashboard/ventas?rango=${rango}`);
      latestVentasData = data;
      const r = data.resumen || {};
      
      const elOrd = document.getElementById('kpiOrdenes');
      const elIng = document.getElementById('kpiIngresos');
      const elEnt = document.getElementById('kpiEntregadas');
      const elTic = document.getElementById('kpiTicket');

      const totalOrdenes = Number(r.total_ordenes) || 0;
      const totalIngresos = Number(r.ingresos) || 0;
      const ticketPromedio = totalOrdenes > 0 ? (totalIngresos / totalOrdenes) : 0;

      if (elOrd) elOrd.textContent = totalOrdenes;
      if (elIng) elIng.textContent = `Q${totalIngresos.toFixed(2)}`;
      if (elEnt) elEnt.textContent = Number(r.entregadas) || 0;
      if (elTic) elTic.textContent = `Q${ticketPromedio.toFixed(2)}`;

      // Renderizar Gráfica
      const estados = data.por_estado || [];
      const ctx = document.getElementById('chartEstados');
      if (ctx) {
        if (chartVentas) chartVentas.destroy();
        
        const labelsMap = {
          recibida: 'Recibida',
          en_elaboracion: 'Elaboración',
          en_ruta: 'En ruta',
          lista_entrega: 'Lista entrega',
          entregada: 'Entregada',
          cancelada: 'Cancelada',
          no_encontrado: 'No encontrado'
        };

        chartVentas = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: estados.map(e => labelsMap[e.estado] || e.estado),
            datasets: [{
              data: estados.map(e => e.cantidad),
              backgroundColor: ['#B85C3A', '#4A5D3A', '#2563eb', '#9333ea', '#16a34a', '#dc2626', '#ea580c'],
              borderRadius: 8,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1, color: '#707070' }, grid: { color: 'rgba(26,26,26,0.06)' } },
              x: { ticks: { color: '#707070', font: { size: 11 } }, grid: { display: false } },
            },
          },
        });
      }

      // Renderizar Top Productos
      const topContainer = document.getElementById('topProductos');
      if (topContainer) {
        const rows = data.por_producto || [];
        if (!rows.length) {
          topContainer.innerHTML = '<p style="color:var(--ink-mute);font-size:0.85rem;margin:0;padding:12px 0;">Sin ventas registradas en este período.</p>';
        } else {
          topContainer.innerHTML = rows.map((p, idx) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface-muted);border-radius:var(--radius-sm);border:1px solid var(--line);">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-weight:700;font-size:0.85rem;color:var(--primary);width:18px;">#${idx + 1}</span>
                <div>
                  <strong style="color:var(--ink);font-size:0.9rem;">${p.nombre_producto}</strong>
                  <div style="font-size:0.75rem;color:var(--ink-mute);">${p.unidades} unidades vendidas</div>
                </div>
              </div>
              <div style="font-weight:700;color:var(--ink);font-size:0.95rem;">Q${Number(p.ingresos || 0).toFixed(2)}</div>
            </div>
          `).join('');
        }
      }

    } catch (err) {
      console.error('[Dashboard Error]', err);
    }
  }

  function exportarCsv() {
    if (!latestVentasData) {
      alert('Cargando datos...');
      return;
    }
    const rango = document.getElementById('rangoVentas')?.value || 'total';
    const r = latestVentasData.resumen || {};
    const prods = latestVentasData.por_producto || [];

    let csv = '\uFEFFReporte de Ventas UMG Personaliza\n';
    csv += `Rango_Seleccionado,${rango}\n`;
    csv += `Fecha_Generado,${new Date().toLocaleString('es-GT').replace(/,/g, '')}\n`;
    csv += `Total_Ordenes,${r.total_ordenes || 0}\n`;
    csv += `Ingresos_Totales_GTQ,${Number(r.ingresos || 0).toFixed(2)}\n`;
    csv += `Ordenes_Entregadas,${r.entregadas || 0}\n\n`;
    csv += 'Producto,Unidades_Vendidas,Ingresos_GTQ\n';
    prods.forEach(p => {
      csv += `"${(p.nombre_producto || '').replace(/"/g, '""')}",${p.unidades || 0},${Number(p.ingresos || 0).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ventas_${rango}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  }

  initDashboard();
})();
