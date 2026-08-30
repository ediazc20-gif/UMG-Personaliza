function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function parsePerso(raw) {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function persoSummaryHtml(perso) {
  if (!perso) return '';
  const parts = [];
  if (perso.lado_a) {
    const a = perso.lado_a;
    const thumb = a.imagen_url
      ? `<img src="${esc(a.imagen_url)}" alt="Lado A" />`
      : '';
    parts.push(`<div class="perso-line">${thumb}<span><strong>Lado A</strong>${a.texto ? ` · "${esc(a.texto)}"` : ''}${a.filtro && a.filtro !== 'none' ? ` · ${esc(a.filtro)}` : ''}</span></div>`);
  }
  if (perso.lado_b) {
    const b = perso.lado_b;
    const thumb = b.imagen_url
      ? `<img src="${esc(b.imagen_url)}" alt="Lado B" />`
      : '';
    parts.push(`<div class="perso-line">${thumb}<span><strong>Lado B</strong>${b.texto ? ` · "${esc(b.texto)}"` : ''}${b.filtro && b.filtro !== 'none' ? ` · ${esc(b.filtro)}` : ''}</span></div>`);
  }
  return parts.join('');
}

function formatQ(v) {
  return `Q${Number(v).toFixed(2)}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('uid')) {
    window.location.replace('/');
    return;
  }

  const list = document.getElementById('cartList');
  const totalEl = document.getElementById('cartTotal');
  const totalValue = totalEl?.querySelector('[data-total-value]');
  const checkoutBtn = document.getElementById('btnCheckout');

  async function render() {
    try {
      const data = await apiFetch('/api/tienda/carrito');
      const items = data.items || [];
      if (!items.length) {
        list.innerHTML = '<div class="empty-state"><p class="lead">Tu carrito esta vacio.</p><p style="margin-top:12px"><a href="/comprador/tienda.html">Explorar tienda</a></p></div>';
        if (totalEl) totalEl.hidden = true;
        if (checkoutBtn) checkoutBtn.style.display = 'none';
        return;
      }

      if (checkoutBtn) checkoutBtn.style.display = 'inline-flex';
      if (totalEl) totalEl.hidden = false;
      if (totalValue) totalValue.textContent = formatQ(data.total);

      list.innerHTML = items.map((item) => {
        const perso = parsePerso(item.personalizacion_json);
        return `
        <div class="item-glass glass-card" data-id="${item.id}">
          <div class="item-glass__title">${esc(item.nombre)}</div>
          <div class="item-glass__meta">${formatQ(item.precio_unitario)} × ${item.cantidad}</div>
          ${persoSummaryHtml(perso)}
          <div class="item-glass__row">
            <button type="button" class="btn-ghost-glass btn-qty" data-d="-1" aria-label="Menos">−</button>
            <span class="item-glass__qty">${item.cantidad}</span>
            <button type="button" class="btn-ghost-glass btn-qty" data-d="1" aria-label="Mas">+</button>
            <button type="button" class="btn-ghost-glass btn-del item-glass__danger">Eliminar</button>
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('.btn-del').forEach((btn, i) => {
        btn.addEventListener('click', async () => {
          await apiFetch(`/api/tienda/carrito/items/${items[i].id}`, { method: 'DELETE' });
          render();
        });
      });

      list.querySelectorAll('.item-glass').forEach((row, i) => {
        row.querySelectorAll('.btn-qty').forEach((b) => {
          b.addEventListener('click', async () => {
            const d = parseInt(b.dataset.d, 10);
            const qty = Math.max(1, items[i].cantidad + d);
            await apiFetch(`/api/tienda/carrito/items/${items[i].id}`, {
              method: 'PUT',
              body: { cantidad: qty },
            });
            render();
          });
        });
      });
    } catch (err) {
      list.innerHTML = `<p class="msg-glass msg-glass--error">${esc(err.message)}</p>`;
    }
  }

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });

  render();
});
