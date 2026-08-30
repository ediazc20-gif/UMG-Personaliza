const ICONS = {
  llaveros: { fa: 'fa-key', tone: 'cta' },
  playeras: { fa: 'fa-shirt', tone: 'primary' },
  tazas: { fa: 'fa-mug-hot', tone: 'cta' },
  tarjetas: { fa: 'fa-id-card', tone: 'primary' },
  default: { fa: 'fa-sparkles', tone: 'primary' },
};

const productCache = new Map();

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function formatQ(v) {

  return `Q${Number(v).toFixed(2)}`;

}



function requireLogin() {

  const rol = (localStorage.getItem('rol') || '').toLowerCase();

  if (!localStorage.getItem('uid')) {

    window.location.replace('/');

    return false;

  }

  if (rol === 'administrador') {

    window.location.replace('/admin/administrador.html');

    return false;

  }

  if (rol === 'supervisor') {

    window.location.replace('/supervisor/dashboard.html');

    return false;

  }

  if (rol === 'repartidor') {

    window.location.replace('/repartidor/entrega.html');

    return false;

  }

  return true;

}



async function loadCartCount() {

  try {

    const data = await apiFetch('/api/tienda/carrito');

    const n = (data.items || []).reduce((s, i) => s + i.cantidad, 0);

    const badge = document.getElementById('cartBadge');

    if (badge) badge.textContent = n;

  } catch { /* sin sesion */ }

}



let currentFilter = '';
let currentSearch = '';
let currentSort = 'default';
let allLoadedProducts = [];

function renderProductList() {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  let list = [...allLoadedProducts];

  if (currentSearch.trim()) {
    const q = currentSearch.toLowerCase().trim();
    list = list.filter(p =>
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.descripcion || '').toLowerCase().includes(q) ||
      (p.categoria || '').toLowerCase().includes(q)
    );
  }

  if (currentSort === 'price-asc') {
    list.sort((a, b) => Number(a.precio) - Number(b.precio));
  } else if (currentSort === 'price-desc') {
    list.sort((a, b) => Number(b.precio) - Number(a.precio));
  } else if (currentSort === 'name-asc') {
    list.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
  }

  if (!list.length) {
    grid.innerHTML = '<p class="lead" style="grid-column:1/-1;text-align:center;padding:32px 0;">No se encontraron productos con ese criterio.</p>';
    return;
  }

  grid.innerHTML = list.map(p => {
    const icon = ICONS[p.categoria_slug] || ICONS.default;
    const tone = icon.tone === 'cta' ? ' product-glass__visual--cta' : '';
    const isOutOfStock = p.stock != null && Number(p.stock) <= 0;
    const stockBadge = isOutOfStock
      ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:rgba(198,40,40,0.12);color:#C62828;font-size:0.7rem;font-weight:700;margin-left:6px;"><i class="fa-solid fa-circle-xmark" style="font-size:0.65rem;"></i> Agotado</span>`
      : (p.stock != null && Number(p.stock) <= 5
        ? `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:rgba(184,92,58,0.12);color:var(--primary);font-size:0.7rem;font-weight:700;margin-left:6px;"><i class="fa-solid fa-fire" style="font-size:0.65rem;"></i> ¡Últimas ${p.stock} disp.!</span>`
        : `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:99px;background:rgba(46,125,50,0.10);color:#2E7D32;font-size:0.7rem;font-weight:600;margin-left:6px;"><i class="fa-solid fa-boxes-stacked" style="font-size:0.65rem;"></i> ${p.stock || 50} en stock</span>`);

    return `
      <article class="product-glass glass-card reveal" data-id="${p.id}">
        <div class="product-glass__visual${tone}" aria-hidden="true"><i class="fas ${icon.fa}"></i></div>
        <div class="product-glass__body">
          <div class="product-glass__cat">${esc(p.categoria)}${stockBadge}</div>
          <h3 class="product-glass__name">${esc(p.nombre)}</h3>
          <p class="product-glass__desc">${esc(p.descripcion || '')}</p>
          <div class="product-glass__foot">
            <span class="product-glass__price">${formatQ(p.precio)}</span>
            ${isOutOfStock
              ? `<button type="button" class="btn-ghost-glass" style="opacity:0.6;cursor:not-allowed;" disabled>Agotado</button>`
              : `<button type="button" class="btn-glass btn-magnetic btn-add" data-id="${p.id}">Personalizar</button>`
            }
          </div>
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('.btn-add').forEach(btn => {
    btn.addEventListener('click', () => addToCart(btn.dataset.id));
  });

  if (typeof gsap !== 'undefined' && document.body.classList.contains('umg-app--shop')) {
    gsap.from('.product-glass', { opacity: 0.94, y: 12, duration: 0.35, stagger: 0.05, ease: 'power2.out' });
  }
}

async function loadCatalog(filter = '') {
  currentFilter = filter;
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  grid.innerHTML = '<p class="lead" style="grid-column:1/-1;text-align:center">Cargando catálogo...</p>';

  try {
    const qs = filter ? `?categoria=${encodeURIComponent(filter)}` : '';
    const data = await apiFetch(`/api/tienda/productos${qs}`);
    allLoadedProducts = data.productos || [];

    productCache.clear();
    allLoadedProducts.forEach(p => productCache.set(p.id, p));

    renderProductList();
  } catch (err) {
    grid.innerHTML = `<p class="msg-glass msg-glass--error" style="grid-column:1/-1">${err.message}</p>`;
  }
}



async function addToCart(productId) {

  const prod = productCache.get(Number(productId));

  if (!prod) return;



  if (typeof openPersonalizar !== 'function') {

    alert('El editor de personalizacion no esta disponible.');

    return;

  }



  try {

    const personalizacion = await openPersonalizar(prod);

    await apiFetch('/api/tienda/carrito/items', {

      method: 'POST',

      body: { id_producto: Number(productId), cantidad: 1, personalizacion },

    });

    await loadCartCount();

    const toast = document.createElement('div');

    toast.className = 'msg-glass msg-glass--ok umg-toast';

    toast.textContent = 'Agregado al carrito';

    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 2200);

  } catch (err) {

    if (err.message === 'cancelado') return;

    alert(err.message || 'Error al agregar');

  }

}



document.addEventListener('DOMContentLoaded', () => {

  if (!requireLogin()) return;

  const nombre = localStorage.getItem('nombre') || 'Comprador';

  const el = document.getElementById('userGreeting');

  if (el) el.textContent = `Hola, ${nombre.split(' ')[0]}`;



  document.getElementById('btnLogout')?.addEventListener('click', async () => {

    await fetch('/logout', { method: 'POST', credentials: 'include' });

    localStorage.clear();

    sessionStorage.clear();

    window.location.replace('/');

  });



  document.getElementById('searchProd')?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderProductList();
  });

  document.getElementById('sortProd')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderProductList();
  });

  loadCartCount();
  loadCatalog();



  document.querySelectorAll('.filter-pill').forEach(btn => {

    btn.addEventListener('click', () => {

      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));

      btn.classList.add('active');

      loadCatalog(btn.dataset.cat || '');

    });

  });

});



window.loadCatalog = loadCatalog;

window.loadCartCount = loadCartCount;

window.formatQ = formatQ;

