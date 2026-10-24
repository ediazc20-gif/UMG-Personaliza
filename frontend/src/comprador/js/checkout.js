let recaptchaEnabled = false;

function showCheckoutMsg(html, isOk) {
  const msg = document.getElementById('msg');
  if (!msg) return;
  if (!html) {
    msg.hidden = true;
    msg.innerHTML = '';
    return;
  }
  msg.hidden = false;
  msg.innerHTML = `<div class="msg-glass ${isOk ? 'msg-glass--ok' : 'msg-glass--error'}">${html}</div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('uid')) {
    window.location.replace('/');
    return;
  }
  const form = document.getElementById('checkoutForm');
  const areaInput = document.getElementById('area');
  const recaptchaErr = document.getElementById('recaptchaErr');

  try {
    const cfg = await apiFetch('/api/config/public');
    recaptchaEnabled = cfg.recaptchaEnabled && cfg.recaptchaSiteKey;
    if (recaptchaEnabled) {
      const wrap = document.getElementById('recaptchaWrap');
      wrap.style.display = 'block';
      const widget = document.createElement('div');
      widget.className = 'g-recaptcha';
      widget.dataset.sitekey = cfg.recaptchaSiteKey;
      wrap.replaceChildren(widget);
    }
  } catch { /* dev sin recaptcha */ }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showCheckoutMsg('');
    if (recaptchaErr) {
      recaptchaErr.hidden = true;
      recaptchaErr.textContent = '';
    }

    if (window.UmgFormValidate && !window.UmgFormValidate.validateForm(form)) {
      return;
    }

    const area_entrega = areaInput.value.trim();
    const metodo = document.querySelector('input[name="pago"]:checked')?.value || 'efectivo';
    let recaptcha_token = '';
    if (recaptchaEnabled && typeof grecaptcha !== 'undefined') {
      recaptcha_token = grecaptcha.getResponse();
      if (!recaptcha_token) {
        if (recaptchaErr) {
          recaptchaErr.textContent = 'Marca la casilla reCAPTCHA.';
          recaptchaErr.hidden = false;
        }
        return;
      }
    }

    const btn = document.getElementById('btnConfirm');
    if (btn) btn.disabled = true;

    try {
      const result = await apiFetch('/api/tienda/checkout', {
        method: 'POST',
        body: {
          area_entrega,
          notas_entrega: document.getElementById('notas').value.trim(),
          metodo_pago: metodo,
          recaptcha_token,
        },
      });

      if (result.recurrente?.checkout_url) {
        window.location.href = result.recurrente.checkout_url;
        return;
      }

      let extra = '';
      if (result.orden.ref_pago) {
        extra += `<p style="margin-top:8px;font-size:0.85rem;color:var(--ink-mute)">Ref. pago: ${escapeHTML(result.orden.ref_pago)}</p>`;
      }
      if (result.orden.pdf_constancia_url) {
        extra += `<p style="margin-top:12px"><a href="/api/tienda/ordenes/${encodeURIComponent(result.orden.codigo)}/constancia" class="btn-ghost-glass" style="display:inline-flex">Descargar constancia PDF</a></p>`;
      }
      showCheckoutMsg(`Orden ${escapeHTML(result.orden.codigo)} creada — Total Q${Number(result.orden.total).toFixed(2)}${extra}`, true);
      setTimeout(() => {
        window.location.href = `/comprador/tracking.html?codigo=${encodeURIComponent(result.orden.codigo)}`;
      }, 2000);
    } catch (err) {
      showCheckoutMsg(escapeHTML(err.message || 'No se pudo completar el checkout.'), false);
      if (recaptchaEnabled && typeof grecaptcha !== 'undefined') grecaptcha.reset();
      if (btn) btn.disabled = false;
    }
  });

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });
});
