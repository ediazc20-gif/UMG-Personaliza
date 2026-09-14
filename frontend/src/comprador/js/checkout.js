let recaptchaEnabled = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('uid')) {
    window.location.replace('/');
    return;
  }
  const areaSel = document.getElementById('area');
  const msg = document.getElementById('msg');

  try {
    const cfg = await apiFetch('/api/config/public');
    recaptchaEnabled = cfg.recaptchaEnabled && cfg.recaptchaSiteKey;
    if (recaptchaEnabled) {
      const wrap = document.getElementById('recaptchaWrap');
      wrap.style.display = 'block';
      wrap.innerHTML = `<div class="g-recaptcha" data-sitekey="${cfg.recaptchaSiteKey}"></div>`;
    }
  } catch { /* dev sin recaptcha */ }

  try {
    const data = await apiFetch('/api/tienda/areas');
    areaSel.innerHTML = (data.areas || []).map(a =>
      `<option value="${escapeHtml(a.id)}">${escapeHtml(a.nombre)}</option>`
    ).join('');
  } catch (err) {
    msg.innerHTML = `<div class="msg-glass msg-glass--error">${escapeHtml(err.message)}</div>`;
  }

  document.getElementById('btnConfirm').addEventListener('click', async () => {
    msg.innerHTML = '';
    const metodo = document.querySelector('input[name="pago"]:checked')?.value || 'efectivo';
    let recaptcha_token = '';
    if (recaptchaEnabled && typeof grecaptcha !== 'undefined') {
      recaptcha_token = grecaptcha.getResponse();
      if (!recaptcha_token) {
        msg.innerHTML = '<div class="msg-glass msg-glass--error">Marca la casilla reCAPTCHA.</div>';
        return;
      }
    }
    try {
      const result = await apiFetch('/api/tienda/checkout', {
        method: 'POST',
        body: {
          id_area_entrega: Number(areaSel.value),
          notas_entrega: document.getElementById('notas').value.trim(),
          metodo_pago: metodo,
          recaptcha_token,
        },
      });
      // Pago con tarjeta: la orden queda creada y pendiente de cobro, y el
      // comprador va a la pagina de Recurrente a meter su tarjeta. Los datos de
      // la tarjeta no pasan nunca por este sitio. La orden solo se dara por
      // pagada cuando la pasarela nos avise por webhook, no al volver aqui.
      if (result.orden.url_pago) {
        msg.innerHTML = `<div class="msg-glass msg-glass--ok">Orden ${escapeHtml(result.orden.codigo)} creada — Te llevamos a la pasarela de pago…</div>`;
        window.location.href = result.orden.url_pago;
        return;
      }

      let extra = '';
      if (result.orden.ref_pago) {
        extra += `<p style="margin-top:8px;font-size:0.85rem;color:var(--ink-mute)">Ref. pago: ${escapeHtml(result.orden.ref_pago)}</p>`;
      }
      if (result.orden.pdf_constancia_url) {
        extra += `<p style="margin-top:12px"><a href="/api/tienda/ordenes/${encodeURIComponent(result.orden.codigo)}/constancia" class="btn-ghost-glass" style="display:inline-flex">Descargar constancia PDF</a></p>`;
      }
      msg.innerHTML = `<div class="msg-glass msg-glass--ok">Orden ${escapeHtml(result.orden.codigo)} creada — Total Q${Number(result.orden.total).toFixed(2)}</div>${extra}`;
      setTimeout(() => {
        window.location.href = `/comprador/tracking.html?codigo=${encodeURIComponent(result.orden.codigo)}`;
      }, 2000);
    } catch (err) {
      msg.innerHTML = `<div class="msg-glass msg-glass--error">${err.message}</div>`;
      if (recaptchaEnabled && typeof grecaptcha !== 'undefined') grecaptcha.reset();
    }
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });
});
