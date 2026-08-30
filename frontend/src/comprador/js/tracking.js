const STEPS = [
  { key: 'recibida', label: 'Orden Recibida', icon: 'fa-box-archive', desc: 'Pedido ingresado en el sistema y validado.' },
  { key: 'en_elaboracion', label: 'En Preparación / Taller', icon: 'fa-wand-magic-sparkles', desc: 'Personalización e impresión en proceso.' },
  { key: 'en_ruta', label: 'En Ruta de Reparto', icon: 'fa-truck-fast', desc: 'Asignado a mensajero en tránsito dentro del campus.' },
  { key: 'lista_entrega', label: 'En Punto de Encuentro', icon: 'fa-location-dot', desc: 'Listo para recibir en el área seleccionada.' },
  { key: 'entregada', label: 'Entregado con Éxito', icon: 'fa-circle-check', desc: 'Paquete recibido y entrega firmada.' },
];

const STATUS_MAP = {
  recibida: { label: 'RECIBIDA EN SISTEMA', color: '#B85C3A', bg: 'rgba(184, 92, 58, 0.12)' },
  en_elaboracion: { label: 'EN ELABORACIÓN', color: '#D97706', bg: 'rgba(217, 119, 6, 0.12)' },
  en_ruta: { label: 'EN CAMINO', color: '#2563EB', bg: 'rgba(37, 99, 235, 0.12)' },
  lista_entrega: { label: 'LISTO PARA ENTREGA', color: '#4A5D3A', bg: 'rgba(74, 93, 58, 0.12)' },
  entregada: { label: 'ENTREGADO', color: '#2E7D32', bg: 'rgba(46, 125, 50, 0.12)' },
  cancelada: { label: 'CANCELADA', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
  no_encontrado: { label: 'NO LOCALIZADO', color: '#DC2626', bg: 'rgba(220, 38, 38, 0.12)' },
};

function formatFecha(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('es-GT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

let activeWs = null;

function connectWs(codigo, onUpdate) {
  if (activeWs) {
    try { activeWs.close(); } catch (_) {}
  }
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const token = localStorage.getItem('token') || '';
  const qs = new URLSearchParams({ codigo, token });
  activeWs = new WebSocket(`${proto}://${location.host}/ws/tienda?${qs}`);

  activeWs.addEventListener('message', (ev) => {
    try {
      const data = JSON.parse(ev.data);
      if (data.type === 'orden.estado' && data.codigo === codigo) {
        onUpdate(data.estado, data.nota);
      }
    } catch (_) { /* ignore */ }
  });

  activeWs.addEventListener('open', () => {
    activeWs.send(JSON.stringify({ type: 'subscribe', codigo }));
  });
}

async function fetchAndRenderTracking(codigo) {
  const container = document.getElementById('trackResult');
  if (!container) return;

  container.innerHTML = `
    <div class="glass-card glass-card--pad" style="text-align:center;padding:40px;">
      <i class="fas fa-spinner fa-spin" style="font-size:2rem;color:var(--primary);margin-bottom:12px;"></i>
      <p class="lead">Consultando guía <strong>${codigo}</strong> en Cargo Express...</p>
    </div>`;

  try {
    // Intenta endpoint público primero
    let res = await fetch(`/api/tienda/ordenes/rastreo/${encodeURIComponent(codigo)}`);
    if (!res.ok && localStorage.getItem('token')) {
      // Fallback a endpoint autenticado
      res = await fetch(`/api/tienda/ordenes/${encodeURIComponent(codigo)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
    }

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'No se encontró información para la guía especificada.');
    }

    const o = data.orden;
    const logs = data.historial || [];
    const items = data.items || [];
    const statusMeta = STATUS_MAP[o.estado] || { label: o.estado.toUpperCase(), color: 'var(--ink)', bg: 'var(--surface-muted)' };

    // Construcción de la línea de tiempo Cargo Expreso
    const currentStepIdx = STEPS.findIndex(s => s.key === o.estado);

    const timelineHtml = STEPS.map((step, idx) => {
      let isDone = false;
      let isActive = false;
      if (o.estado === 'entregada') {
        isDone = true;
      } else if (currentStepIdx >= 0) {
        if (idx < currentStepIdx) isDone = true;
        else if (idx === currentStepIdx) isActive = true;
      }

      const matchLog = logs.find(l => l.estado === step.key);
      const logFecha = matchLog ? formatFecha(matchLog.fecha) : (isDone ? 'Completado' : 'Pendiente');
      const logNota = matchLog?.nota ? matchLog.nota : step.desc;

      const cls = isDone ? 'is-done' : (isActive ? 'is-active' : '');
      const icon = isDone ? 'fa-check' : (isActive ? 'fa-circle-dot' : 'fa-clock');

      return `
        <div class="timeline-node ${cls}">
          <div class="timeline-dot"><i class="fas ${icon}"></i></div>
          <div class="timeline-time">${logFecha}</div>
          <div class="timeline-title">${step.label}</div>
          <div class="timeline-desc">${logNota}</div>
        </div>
      `;
    }).join('');

    const itemsHtml = items.length ? `
      <div style="margin-top:20px;border-top:1px solid var(--line);padding-top:16px;">
        <h4 style="font-size:0.85rem;color:var(--ink-mute);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px;">
          <i class="fas fa-boxes-stacked"></i> Contenido del Paquete (${items.length} ${items.length === 1 ? 'artículo' : 'artículos'})
        </h4>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${items.map(it => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--surface-muted);border-radius:6px;font-size:0.875rem;">
              <span><strong>${it.cantidad}x</strong> ${it.nombre_producto}</span>
              <span style="font-weight:600;color:var(--ink);">Q${(Number(it.precio_unitario) * it.cantidad).toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    container.innerHTML = `
      <div class="waybill-card reveal">
        <div class="waybill-header">
          <div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
              <span class="barcode-display"><i class="fas fa-barcode"></i> ${o.codigo}</span>
              <span id="liveIndicator" style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:99px;background:rgba(46,125,50,0.12);color:#2E7D32;font-size:0.75rem;font-weight:700;">
                <i class="fas fa-satellite-dish fa-fade"></i> En vivo
              </span>
            </div>
            <p style="font-size:0.85rem;color:var(--ink-mute);margin:0;">Servicio: <strong>UMG Campus Express Delivery</strong></p>
          </div>
          <div style="text-align:right;">
            <span style="display:inline-block;padding:6px 14px;border-radius:99px;font-size:0.8rem;font-weight:700;color:${statusMeta.color};background:${statusMeta.bg};border:1px solid ${statusMeta.color}33;">
              ${statusMeta.label}
            </span>
          </div>
        </div>

        <div class="waybill-grid">
          <div>
            <div class="waybill-item__lbl"><i class="fas fa-paper-plane"></i> Origen</div>
            <div class="waybill-item__val">Tienda Campus Central UMG</div>
          </div>
          <div>
            <div class="waybill-item__lbl"><i class="fas fa-location-dot"></i> Destino</div>
            <div class="waybill-item__val">${o.area_entrega || 'Campus UMG'}</div>
          </div>
          <div>
            <div class="waybill-item__lbl"><i class="fas fa-calendar-day"></i> Fecha Emisión</div>
            <div class="waybill-item__val">${formatFecha(o.creado)}</div>
          </div>
          <div>
            <div class="waybill-item__lbl"><i class="fas fa-receipt"></i> Total Guía</div>
            <div class="waybill-item__val">Q${Number(o.total).toFixed(2)} (${o.metodo_pago === 'efectivo' ? 'Efectivo' : 'Tarjeta'})</div>
          </div>
        </div>

        <h3 style="font-size:1.05rem;margin:24px 0 12px;color:var(--ink);display:flex;align-items:center;gap:8px;">
          <i class="fas fa-route"></i> Historial de Movimientos de la Guía
        </h3>
        
        <div class="timeline-wrap">
          ${timelineHtml}
        </div>

        ${itemsHtml}

        <div style="margin-top:24px;display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:18px;">
          ${o.pdf_constancia_url ? `
            <a href="/api/tienda/ordenes/${encodeURIComponent(o.codigo)}/constancia" class="btn-glass" style="font-size:0.85rem;">
              <i class="fas fa-file-pdf"></i> Descargar Comprobante PDF
            </a>
          ` : ''}
          <button type="button" class="btn-ghost-glass" onclick="window.print()" style="font-size:0.85rem;">
            <i class="fas fa-print"></i> Imprimir Guía
          </button>
        </div>
      </div>
    `;

    // Conectar WebSocket para actualizaciones en caliente
    connectWs(codigo, (nuevoEstado, nota) => {
      fetchAndRenderTracking(codigo);
    });

  } catch (err) {
    container.innerHTML = `
      <div class="glass-card glass-card--pad" style="text-align:center;padding:32px;">
        <i class="fas fa-triangle-exclamation" style="font-size:2rem;color:var(--primary);margin-bottom:12px;"></i>
        <h3 style="margin-bottom:8px;">Guía no localizada</h3>
        <p class="lead">${err.message}</p>
        <p style="font-size:0.85rem;color:var(--ink-mute);margin-top:12px;">Verifica que el número de guía ingresado sea correcto.</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const codigo = params.get('codigo');
  const trackInput = document.getElementById('trackInput');

  if (codigo) {
    if (trackInput) trackInput.value = codigo;
    fetchAndRenderTracking(codigo);
  }

  document.getElementById('trackForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const val = trackInput.value.trim().toUpperCase();
    if (!val) return;
    const url = new URL(location);
    url.searchParams.set('codigo', val);
    history.pushState({}, '', url);
    fetchAndRenderTracking(val);
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });
});
