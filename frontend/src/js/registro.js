// registro.js — Formulario de registro y validación en tiempo real

const PASSWORD_RULES = [
  { key: 'len', text: 'Más de 8 caracteres',  test: (v) => v.length > 8 },
  { key: 'low', text: 'Al menos 1 minúscula',  test: (v) => /[a-z]/.test(v) },
  { key: 'upp', text: 'Al menos 1 mayúscula',  test: (v) => /[A-Z]/.test(v) },
  { key: 'num', text: 'Al menos 1 número',     test: (v) => /\d/.test(v) },
  { key: 'sym', text: 'Al menos 1 signo',      test: (v) => /[^A-Za-z0-9\s]/.test(v) },
];

function registroPasswordValid(value) {
  const v = value || '';
  return PASSWORD_RULES.every((r) => r.test(v));
}

function registroPasswordsMatch() {
  const p = document.getElementById('contrasena')?.value || '';
  const c = document.getElementById('confirmar_contrasena')?.value || '';
  return p.length > 0 && p === c;
}

function registroHasPhoto() {
  const inpO = document.getElementById('inpFotoOriginal');
  const inpM = document.getElementById('inpFotoMod');
  if (inpO?.files?.length > 0 || inpM?.files?.length > 0) return true;
  const prev = document.getElementById('previewOriginal');
  return !!(prev?.src && !prev.src.includes('data:image/svg'));
}

function clearFotoFeedback() {
  const fb = document.getElementById('feedback-foto');
  if (fb) {
    fb.className = 'field-feedback';
    fb.textContent = '';
  }
}

function registroValidateStep1() {
  if (registroHasPhoto()) {
    clearFotoFeedback();
    return { ok: true };
  }
  const msg = 'Debes subir o capturar una foto de perfil antes de continuar.';
  const fb = document.getElementById('feedback-foto');
  if (fb) {
    fb.className = 'field-feedback field-feedback--error';
    fb.textContent = msg;
  }
  return { ok: false, message: msg };
}

function registroScrollTo(el) {
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Muestra el globo nativo del navegador (ej. "Completa este campo") */
function showNativeRequiredHint(input) {
  if (!input) return;
  input.focus();
  input.reportValidity();
}

function registroTelefonoDigits(value) {
  return (value || '').replace(/\D/g, '');
}

function registroTelefonoValid(value) {
  return registroTelefonoDigits(value).length >= 8;
}

function registroCorreoValid(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());
}

function getRegistroNotifChannels() {
  const form = document.getElementById('registro-central-form');
  return {
    correo: !!form?.querySelector('[name="notif_correo"]')?.checked,
    whatsapp: !!form?.querySelector('[name="notif_whatsapp"]')?.checked,
  };
}

/** Etiqueta: "correo" | "WhatsApp" | "correo o WhatsApp" */
function getOtpCanalLabel() {
  const { correo, whatsapp } = getRegistroNotifChannels();
  if (correo && whatsapp) return 'correo o WhatsApp';
  if (whatsapp) return 'WhatsApp';
  return 'correo';
}

function getOtpRevisaTitle() {
  const { correo, whatsapp } = getRegistroNotifChannels();
  if (correo && whatsapp) return 'Revisa tu correo o WhatsApp';
  if (whatsapp) return 'Revisa tu WhatsApp';
  return 'Revisa tu correo';
}

function updateOtpChannelTexts() {
  const canal = getOtpCanalLabel();
  const subtitle = document.getElementById('otp-subtitle');
  const infoTitle = document.getElementById('otp-info-title');
  const infoBody = document.getElementById('otp-info-body');

  if (subtitle) {
    subtitle.textContent = `Ingresa el código enviado a tu ${canal} para activar la cuenta.`;
  }
  if (infoTitle) {
    infoTitle.textContent = getOtpRevisaTitle();
  }
  if (infoBody) {
    infoBody.textContent =
      'Cuando recibas el código, escríbelo aquí para terminar la activación. '
      + 'Si no llega, usa el botón de reenviar código.';
  }
}

function otpStatusSentMessage() {
  return `Código enviado a tu ${getOtpCanalLabel()}. Ingrésalo para activar tu cuenta.`;
}

function otpResendSuccessMessage() {
  return `Nuevo código enviado. Revisa tu ${getOtpCanalLabel()}.`;
}

function getResendNotifPayload(form) {
  return {
    correo: form.querySelector('[name="correo"]')?.value.trim(),
    telefono: form.querySelector('[name="telefono"]')?.value.trim(),
    notif_correo: !!form.querySelector('[name="notif_correo"]')?.checked,
    notif_whatsapp: !!form.querySelector('[name="notif_whatsapp"]')?.checked,
  };
}

function wireOtpNotifChannelListeners() {
  const form = document.getElementById('registro-central-form');
  if (!form) return;
  ['notif_correo', 'notif_whatsapp'].forEach((name) => {
    const el = form.querySelector(`[name="${name}"]`);
    el?.addEventListener('change', () => {
      updateOtpChannelTexts();
      const otpPanel = document.getElementById('otp-verification-panel');
      if (otpPanel?.style.display !== 'none' && document.getElementById('otp-status')?.textContent) {
        const status = document.getElementById('otp-status');
        if (status?.classList.contains('success') || status?.textContent.includes('enviado')) {
          status.textContent = otpStatusSentMessage();
        }
      }
    });
  });
}

function setInlineFieldError(input, feedbackId, message) {
  if (!input) return;
  const fb = document.getElementById(feedbackId) ||
    input.closest('.field')?.querySelector('.field-feedback');
  if (fb) {
    fb.className = 'field-feedback field-feedback--error';
    fb.textContent = message;
  }
  input.classList.add('is-invalid');
}

function registroFocusStep1Error() {
  const fb = document.getElementById('feedback-foto');
  registroScrollTo(fb || document.getElementById('reg-stage'));
}

function registroFocusStep2Error() {
  const step2 = document.getElementById('reg-step-2');
  if (!step2) return;

  const dupInput = step2.querySelector('input.is-invalid');
  if (dupInput) {
    dupInput.focus();
    registroScrollTo(dupInput);
    return;
  }

  for (const inp of step2.querySelectorAll('input[required], select[required], textarea[required]')) {
    if (!inp.value.trim()) {
      registroScrollTo(inp);
      showNativeRequiredHint(inp);
      return;
    }
  }

  const pw = document.getElementById('contrasena');
  if (pw && !registroPasswordValid(pw.value)) {
    pw.focus();
    registroScrollTo(pw);
    return;
  }

  const confirm = document.getElementById('confirmar_contrasena');
  const passwordHelp = document.getElementById('passwordHelp');
  if (confirm && !registroPasswordsMatch()) {
    if (passwordHelp) {
      passwordHelp.classList.remove('d-none');
      passwordHelp.style.display = 'block';
    }
    confirm.focus();
    registroScrollTo(confirm);
  }
}

// ── Modal de alerta reutilizable ──
function showAlertModal(title, msg, type) {
  const modal  = document.getElementById('alertModal');
  const iconEl = document.getElementById('alertModalIcon');
  const titleEl= document.getElementById('alertModalTitle');
  const textEl = document.getElementById('alertModalText');
  const btn    = document.getElementById('btnAlertOk');
  if (!modal) return;

  const styles = {
    error:   { bg: 'rgba(239,68,68,.15)',   color: '#ef4444', icon: 'fas fa-circle-exclamation' },
    success: { bg: 'rgba(34,197,94,.15)',   color: '#22c55e', icon: 'fas fa-circle-check'       },
    warning: { bg: 'rgba(245,158,11,.15)',  color: '#f59e0b', icon: 'fas fa-triangle-exclamation'},
    info:    { bg: 'rgba(15,184,142,.15)',  color: '#0fb88e', icon: 'fas fa-circle-info'         },
  };
  const s = styles[type] || styles.error;
  iconEl.style.cssText  = `width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;background:${s.bg};color:${s.color};`;
  iconEl.innerHTML      = `<i class="${s.icon}"></i>`;
  titleEl.textContent   = title;
  textEl.textContent    = msg;
  modal.classList.add('show');

  const close = () => { modal.classList.remove('show'); btn.removeEventListener('click', close); modal.removeEventListener('click', onBg); };
  const onBg  = (e) => { if (e.target === modal) close(); };
  btn.addEventListener('click', close);
  modal.addEventListener('click', onBg);
}
window.showAlertModal = showAlertModal;

// === Validador de contraseña ===
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('contrasena');
  if (!input) return;

  let rulesEl = document.getElementById('contrasena-rules');
  if (!rulesEl) {
    rulesEl = document.createElement('ul');
    rulesEl.id = 'contrasena-rules';
    rulesEl.setAttribute('aria-live', 'polite');
    rulesEl.style.margin = '8px 0 0';
    rulesEl.style.paddingLeft = '18px';
    const field = input.closest('.field');
    (field || input).appendChild(rulesEl);
  } else {
    rulesEl.innerHTML = '';
  }

  const items = {};
  for (const r of PASSWORD_RULES) {
    const li = document.createElement('li');
    li.className = 'pw-rule bad';
    li.dataset.key = r.key;
    li.textContent = '• ' + r.text;
    rulesEl.appendChild(li);
    items[r.key] = li;
  }

  const update = () => {
    const v = input.value || '';
    let allOk = true;
    for (const r of PASSWORD_RULES) {
      const ok = r.test(v);
      items[r.key].classList.toggle('ok', ok);
      items[r.key].classList.toggle('bad', !ok);
      allOk = allOk && ok;
    }
    input.setAttribute('aria-invalid', String(!allOk));
  };

  input.addEventListener('input', update, { passive: true });
  input.addEventListener('keyup', update, { passive: true });
  input.addEventListener('change', update);
  update();

  const submitBtn = document.getElementById('submit-button');
  const setButtonState = () => {
    const valid = registroPasswordValid(input.value);
    if (submitBtn) submitBtn.disabled = !valid;
  };
  input.addEventListener('input', setButtonState);
  input.addEventListener('keyup', setButtonState);
  input.addEventListener('change', setButtonState);
  setButtonState();
});

// === Formulario de registro ===
document.getElementById('registro-central-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form       = e.target;
  const mensajeDiv = document.getElementById('registroMensaje');
  const submitBtn  = document.getElementById('submit-button');

  if (!registroHasPhoto()) {
    registroValidateStep1();
    if (window.regStepper) await window.regStepper.goTo(1);
    registroFocusStep1Error();
    return;
  }

  const step2Check = await registroValidateStep2();
  if (!step2Check.ok) {
    if (window.regStepper) await window.regStepper.goTo(2);
    registroFocusStep2Error();
    return;
  }

  if (typeof registroUniqueHasErrors === 'function' && registroUniqueHasErrors()) {
    if (window.regStepper) await window.regStepper.goTo(2);
    registroFocusStep2Error();
    return;
  }

  if (mensajeDiv) { mensajeDiv.textContent = ''; mensajeDiv.className = 'mt-2'; }

  const originalBtnText = submitBtn?.innerHTML || 'Registrar';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
  }

  // ── Overlay de carga ──
  let overlay = document.getElementById('registro-loading-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'registro-loading-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(12,15,20,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;';
    overlay.innerHTML =
      '<div style="width:48px;height:48px;border:3px solid rgba(15,184,142,.2);border-top-color:#0fb88e;border-radius:50%;animation:spin 1s linear infinite"></div>'
      + '<div style="color:#eef0f4;font-size:.95rem;font-weight:600">Creando tu cuenta...</div>'
      + '<div style="color:#5c6678;font-size:.8rem">Esto puede tardar unos segundos</div>'
      + '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';

  // ── Helpers OTP ──
  const otpPanel        = document.getElementById('otp-verification-panel');
  const otpInput        = document.getElementById('codigo_verificacion');
  const otpStatus       = document.getElementById('otp-status');
  const btnVerificarOtp = document.getElementById('btn-verificar-otp');
  const btnReenviarOtp  = document.getElementById('btn-reenviar-otp');

  const setOtpStatus = (text, kind = '') => {
    if (!otpStatus) return;
    otpStatus.textContent = text || '';
    otpStatus.className   = 'qr-status' + (kind ? ` ${kind}` : '');
  };

  const showOtpPanel = (show) => {
    if (otpPanel) otpPanel.style.display = show ? 'block' : 'none';
  };

  // ── Pantalla de éxito con spinner → redirige a login ──
  function showSuccessAndGoToLogin() {
    const ovSuccess = document.getElementById('registro-loading-overlay');
    if (ovSuccess) {
      ovSuccess.style.display = 'flex';
      ovSuccess.innerHTML =
        '<div style="width:60px;height:60px;border-radius:50%;background:rgba(34,197,94,.15);display:flex;align-items:center;justify-content:center">'
        +   '<i class="fas fa-check" style="color:#22c55e;font-size:1.6rem"></i>'
        + '</div>'
        + '<div style="color:#eef0f4;font-size:1.1rem;font-weight:700">¡Cuenta verificada exitosamente!</div>'
        + '<div style="color:#8b95a8;font-size:.85rem;text-align:center;max-width:320px">Redirigiendo al inicio de sesión...</div>'
        + '<div style="width:36px;height:36px;border:3px solid rgba(15,184,142,.2);border-top-color:#0fb88e;border-radius:50%;animation:spin 1s linear infinite;margin-top:4px"></div>'
        + '<style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    }
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
    resetRegistroFormForNewUser();

    setTimeout(function () {
      if (ovSuccess) ovSuccess.style.display = 'none';
      document.querySelectorAll('.view-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      const loginTab = document.querySelector('.view-tab[data-view="login"]');
      if (loginTab) loginTab.classList.add('active');
      const loginPanel = document.getElementById('panel-login');
      if (loginPanel) loginPanel.classList.add('active');
      const container = document.getElementById('authContainer');
      if (container) container.classList.remove('expanded');
      if (typeof regStepper !== 'undefined') regStepper.goTo(1);
      const loginMsg = document.getElementById('login-central-msg');
      if (loginMsg) {
        loginMsg.textContent = 'Cuenta activada. Inicia sesión con tus credenciales.';
        loginMsg.className   = 'msg success';
      }
    }, 2800);
  }

  // ── Verificar OTP ──
  const verifyOtpCode = async () => {
    const correo   = form.querySelector('[name="correo"]')?.value.trim();
    const telefono = form.querySelector('[name="telefono"]')?.value.trim();
    const codigo   = String(otpInput?.value || '').trim();

    if (!codigo || codigo.length < 6) {
      setOtpStatus('Ingresa un código válido de 6 dígitos.', 'error');
      return false;
    }

    if (btnVerificarOtp) btnVerificarOtp.disabled = true;
    if (btnReenviarOtp)  btnReenviarOtp.disabled  = true;
    setOtpStatus('Verificando código...', '');

    try {
      const verifyRes = await fetch('/verify-registration-code', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ codigo, correo, telefono }),
      });

      const verifyRaw = await verifyRes.text();
      let verifyData  = null;
      try { verifyData = JSON.parse(verifyRaw); } catch { verifyData = null; }

      if (verifyRes.ok && verifyData?.ok) {
        setOtpStatus('', '');
        showOtpPanel(false);
        showSuccessAndGoToLogin();
        return true;
      }

      const verifyMsg = (verifyData && (verifyData.error || verifyData.mensaje)) || verifyRaw || 'Código inválido o expirado.';
      setOtpStatus(verifyMsg, 'error');
      showAlertModal('Código incorrecto', verifyMsg, 'error');
      return false;
    } catch (err) {
      const msg = 'No se pudo verificar el código. Revisa tu conexión e intenta de nuevo.';
      setOtpStatus(msg, 'error');
      showAlertModal('Error de conexión', msg, 'error');
      return false;
    } finally {
      if (btnVerificarOtp) btnVerificarOtp.disabled = false;
      if (btnReenviarOtp)  btnReenviarOtp.disabled  = false;
    }
  };

  if (btnVerificarOtp) btnVerificarOtp.onclick = async () => { await verifyOtpCode(); };

  if (btnReenviarOtp) {
    btnReenviarOtp.onclick = async () => {
      const { correo, whatsapp } = getRegistroNotifChannels();
      if (!correo && !whatsapp) {
        setOtpStatus('Selecciona al menos Correo o WhatsApp en notificaciones.', 'error');
        return;
      }

      btnReenviarOtp.disabled = true;
      setOtpStatus('Reenviando código...', '');

      try {
        const resendRes = await fetch('/resend-verification-code', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(getResendNotifPayload(form)),
        });

        const resendRaw = await resendRes.text();
        let resendData  = null;
        try { resendData = JSON.parse(resendRaw); } catch { resendData = null; }

        if (resendRes.ok && resendData?.ok) {
          updateOtpChannelTexts();
          setOtpStatus(otpResendSuccessMessage(), 'success');
          return;
        }

        const resendMsg = (resendData && (resendData.error || resendData.mensaje)) || resendRaw || 'No se pudo reenviar el código.';
        setOtpStatus(resendMsg, 'error');
        showAlertModal('Error al reenviar', resendMsg, 'warning');
      } catch (err) {
        const msg = 'Error de conexión al reenviar el código.';
        setOtpStatus(msg, 'error');
        showAlertModal('Error de conexión', msg, 'error');
      } finally {
        btnReenviarOtp.disabled = false;
      }
    };
  }

  // ── Enviar formulario al servidor ──
  try {
    const formData = new FormData(form);
    const res      = await fetch('/registro', { method: 'POST', body: formData });
    const raw      = await res.text();
    let payload    = null;
    try { payload = JSON.parse(raw); } catch { payload = null; }

    if (!res.ok) {
      overlay.style.display = 'none';
      if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
      const errorMsg = (payload && (payload.error || payload.mensaje)) || raw || 'Error al registrar usuario.';
      showAlertModal('Error al registrar', errorMsg, 'error');
      return;
    }

    // Pendiente de verificación OTP
    if (payload && payload.pendiente_verificacion) {
      document.querySelectorAll('.reg-step').forEach(p => p.classList.remove('active'));
      const step3 = document.getElementById('reg-step-3');
      if (step3) step3.classList.add('active');
      if (typeof regStepper !== 'undefined') regStepper.goTo(3);
      showOtpPanel(true);
      updateOtpChannelTexts();
      setOtpStatus(otpStatusSentMessage(), 'success');
      if (otpInput) otpInput.focus();
      if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-lock"></i> Pendiente de verificación'; }
      overlay.style.display = 'none';
      return;
    }

    // Registro exitoso sin OTP
    showSuccessAndGoToLogin();

  } catch (err) {
    console.error('Error en /registro:', err);
    overlay.style.display = 'none';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalBtnText; }
    showAlertModal('Error de conexión', 'No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.', 'error');
  }
});

// === Validación en tiempo real de duplicados ===
const UNIQUE_FIELDS = [
  {
    campo: 'correo',
    input: document.getElementById('correo'),
    feedbackId: 'feedback-correo',
    minLen: 5,
    match: (msg) => /correo/i.test(msg),
    okMsg: 'Correo disponible',
    buildBody: (v) => ({ correo: v, telefono: null, usuario: null }),
  },
  {
    campo: 'telefono',
    input: document.getElementById('telefono'),
    feedbackId: 'feedback-telefono',
    minLen: 8,
    match: (msg) => /celular|tel[eé]fono/i.test(msg),
    okMsg: 'Teléfono disponible',
    buildBody: (v) => ({ correo: null, telefono: v, usuario: null }),
  },
  {
    campo: 'usuario',
    input: document.getElementById('nombre_usuario'),
    feedbackId: 'feedback-usuario',
    minLen: 3,
    match: (msg) => /usuario/i.test(msg),
    okMsg: 'Usuario disponible',
    buildBody: (v) => ({ correo: null, telefono: null, usuario: v }),
  },
];

const uniqueTimers = {};
const uniqueState = {};

const REGISTRO_PHOTO_PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect fill='%230c0f14' width='80' height='80' rx='12'/%3E%3Ctext x='40' y='46' text-anchor='middle' fill='%235c6678' font-size='26'%3E+%3C/text%3E%3C/svg%3E";

const REGISTRO_THUMB_PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Crect fill='%23151921' width='48' height='48'/%3E%3C/svg%3E";

/** Limpia validaciones en tiempo real (duplicados, bordes, mensajes) */
function clearRegistroValidationState() {
  Object.keys(uniqueTimers).forEach((k) => {
    clearTimeout(uniqueTimers[k]);
    delete uniqueTimers[k];
  });
  Object.keys(uniqueState).forEach((k) => {
    delete uniqueState[k];
  });

  UNIQUE_FIELDS.forEach((cfg) => {
    if (!cfg.input) return;
    cfg.input.setCustomValidity('');
    cfg.input.classList.remove('is-invalid', 'is-valid-unique');
    const fb = document.getElementById(cfg.feedbackId);
    if (fb) {
      fb.className = 'field-feedback';
      fb.textContent = '';
    }
    cfg.input.closest('.field')?.querySelectorAll('.field-feedback--required')
      .forEach((el) => el.remove());
  });

  document.querySelectorAll('#panel-registro .field-feedback--required').forEach((el) => el.remove());
  document.querySelectorAll('#panel-registro input.is-invalid, #panel-registro input.is-valid-unique')
    .forEach((inp) => inp.classList.remove('is-invalid', 'is-valid-unique'));

  const passwordHelp = document.getElementById('passwordHelp');
  if (passwordHelp) {
    passwordHelp.classList.add('d-none');
    passwordHelp.style.display = 'none';
  }

  clearFotoFeedback();

  const otpStatus = document.getElementById('otp-status');
  if (otpStatus) {
    otpStatus.textContent = '';
    otpStatus.className = 'qr-status';
  }
}

/** Reinicia el formulario de registro para un usuario nuevo (sin recargar la página) */
function resetRegistroFormForNewUser() {
  clearRegistroValidationState();

  const form = document.getElementById('registro-central-form');
  form?.reset();

  const otpPanel = document.getElementById('otp-verification-panel');
  if (otpPanel) otpPanel.style.display = 'none';

  const otpInput = document.getElementById('codigo_verificacion');
  if (otpInput) otpInput.value = '';

  const submitBtn = document.getElementById('submit-button');
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-user-plus"></i> Crear mi Cuenta';
  }

  const mensajeDiv = document.getElementById('registroMensaje');
  if (mensajeDiv) {
    mensajeDiv.textContent = '';
    mensajeDiv.className = 'msg';
  }

  if (typeof regStepper !== 'undefined') {
    regStepper.goTo(1);
  }

  const previewMap = {
    previewOriginal: REGISTRO_PHOTO_PLACEHOLDER_SVG,
    previewMod: REGISTRO_PHOTO_PLACEHOLDER_SVG,
    thumbOriginal: REGISTRO_THUMB_PLACEHOLDER_SVG,
    thumbMod: REGISTRO_THUMB_PLACEHOLDER_SVG,
  };
  Object.entries(previewMap).forEach(([id, src]) => {
    const img = document.getElementById(id);
    if (img) img.src = src;
  });

  const stageStill = document.getElementById('stageStill');
  if (stageStill) {
    stageStill.style.display = 'none';
    stageStill.removeAttribute('src');
  }
  const video = document.getElementById('video');
  if (video) video.style.display = '';

  ['inpFotoOriginal', 'inpFotoMod', 'filePicker'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  document.querySelectorAll('#contrasena-rules .pw-rule').forEach((li) => {
    li.classList.remove('ok');
    li.classList.add('bad');
  });
  const contrasena = document.getElementById('contrasena');
  if (contrasena) contrasena.setAttribute('aria-invalid', 'true');

  const notifCorreo = form?.querySelector('[name="notif_correo"]');
  const notifWhatsapp = form?.querySelector('[name="notif_whatsapp"]');
  if (notifCorreo) notifCorreo.checked = true;
  if (notifWhatsapp) notifWhatsapp.checked = false;

  updateOtpChannelTexts();
}

window.clearRegistroValidationState = clearRegistroValidationState;
window.resetRegistroFormForNewUser = resetRegistroFormForNewUser;

function getFeedback(cfg) {
  if (!cfg.input) return null;
  let fb = document.getElementById(cfg.feedbackId);
  if (!fb) {
    const field = cfg.input.closest('.field');
    if (!field) return null;
    fb = document.createElement('div');
    fb.id = cfg.feedbackId;
    fb.className = 'field-feedback';
    fb.setAttribute('role', 'status');
    fb.setAttribute('aria-live', 'polite');
    field.appendChild(fb);
  }
  return fb;
}

function setFieldState(input, state) {
  if (!input) return;
  input.classList.remove('is-invalid', 'is-valid-unique');
  if (state === 'error') input.classList.add('is-invalid');
  if (state === 'ok') input.classList.add('is-valid-unique');
}

function setFeedback(cfg, type, message) {
  const fb = getFeedback(cfg);
  if (!fb) return;
  fb.className = 'field-feedback' + (type ? ` field-feedback--${type}` : '');
  fb.textContent = message || '';
  if (type === 'checking') {
    cfg.input?.setCustomValidity('');
    uniqueState[cfg.campo] = 'checking';
    setFieldState(cfg.input, null);
  } else if (type === 'error') {
    cfg.input?.setCustomValidity(message || 'Valor no disponible');
    uniqueState[cfg.campo] = 'error';
    setFieldState(cfg.input, 'error');
  } else if (type === 'ok') {
    cfg.input?.setCustomValidity('');
    uniqueState[cfg.campo] = 'ok';
    setFieldState(cfg.input, 'ok');
  } else {
    cfg.input?.setCustomValidity('');
    uniqueState[cfg.campo] = '';
    setFieldState(cfg.input, null);
  }
}

function clearFeedback(cfg) {
  setFeedback(cfg, '', '');
}

async function validarCampoUnico(cfg) {
  if (!cfg.input) return;

  const value = cfg.input.value.trim();
  if (cfg.campo === 'telefono' && value && !registroTelefonoValid(value)) {
    setInlineFieldError(cfg.input, cfg.feedbackId, 'Ingresa un número de teléfono válido (mínimo 8 dígitos).');
    uniqueState[cfg.campo] = 'error';
    return;
  }
  if (cfg.campo === 'correo' && value && !registroCorreoValid(value)) {
    setInlineFieldError(cfg.input, cfg.feedbackId, 'Ingresa un correo electrónico válido.');
    uniqueState[cfg.campo] = 'error';
    return;
  }
  if (!value || value.length < cfg.minLen) {
    clearFeedback(cfg);
    return;
  }

  setFeedback(cfg, 'checking', 'Verificando…');

  try {
    const res = await fetch('/validar_unico', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg.buildBody(value)),
    });
    const data = await res.json();
    const respuesta = String(data?.respuesta ?? '').trim();

    if (!res.ok) {
      setFeedback(cfg, 'error', respuesta || 'No se pudo validar. Intenta de nuevo.');
      return;
    }

    if (respuesta === '1') {
      setFeedback(cfg, 'ok', cfg.okMsg);
      return;
    }

    if (cfg.match(respuesta)) {
      setFeedback(cfg, 'error', respuesta);
      return;
    }

    clearFeedback(cfg);
  } catch (e) {
    console.error('Error en validación:', e);
    setFeedback(cfg, 'error', 'Sin conexión. Revisa tu red e intenta de nuevo.');
  }
}

function scheduleUniqueCheck(cfg) {
  clearTimeout(uniqueTimers[cfg.campo]);
  uniqueTimers[cfg.campo] = setTimeout(() => validarCampoUnico(cfg), 450);
}

UNIQUE_FIELDS.forEach((cfg) => {
  if (!cfg.input) return;
  cfg.input.addEventListener('input', () => scheduleUniqueCheck(cfg));
  cfg.input.addEventListener('blur', () => validarCampoUnico(cfg));
});

window.registroUniqueHasErrors = function registroUniqueHasErrors() {
  const telefono = document.getElementById('telefono')?.value.trim() || '';
  if (!telefono || !registroTelefonoValid(telefono)) return true;

  const correo = document.getElementById('correo')?.value.trim() || '';
  if (!correo || !registroCorreoValid(correo)) return true;

  return UNIQUE_FIELDS.some((cfg) => {
    const v = cfg.input?.value.trim() || '';
    if (cfg.campo === 'telefono' || cfg.campo === 'correo' || cfg.campo === 'usuario') {
      if (!v) return true;
    }
    if (!v || v.length < cfg.minLen) return false;
    return uniqueState[cfg.campo] === 'error' || uniqueState[cfg.campo] === 'checking';
  });
};

async function registroValidateStep2() {
  const step2 = document.getElementById('reg-step-2');
  if (!step2) return { ok: false, message: 'Formulario no encontrado.' };

  const requiredInputs = step2.querySelectorAll('input[required], select[required], textarea[required]');
  for (const inp of requiredInputs) {
    if (!inp.value.trim()) {
      registroScrollTo(inp);
      showNativeRequiredHint(inp);
      return { ok: false };
    }
  }

  const telefonoInput = document.getElementById('telefono');
  const telefonoVal = telefonoInput?.value.trim() || '';
  if (!registroTelefonoValid(telefonoVal)) {
    setInlineFieldError(
      telefonoInput,
      'feedback-telefono',
      'Ingresa un número de teléfono válido (mínimo 8 dígitos).'
    );
    telefonoInput?.focus();
    registroScrollTo(telefonoInput);
    return { ok: false };
  }

  const correoInput = document.getElementById('correo');
  const correoVal = correoInput?.value.trim() || '';
  if (!registroCorreoValid(correoVal)) {
    setInlineFieldError(
      correoInput,
      'feedback-correo',
      'Ingresa un correo electrónico válido (ejemplo: nombre@dominio.com).'
    );
    correoInput?.focus();
    registroScrollTo(correoInput);
    return { ok: false };
  }

  const pwInput = document.getElementById('contrasena');
  const pw = pwInput?.value || '';
  if (!registroPasswordValid(pw)) {
    pwInput?.focus();
    return { ok: false, message: 'La contraseña no cumple todos los requisitos.' };
  }

  const confirmInput = document.getElementById('confirmar_contrasena');
  const passwordHelp = document.getElementById('passwordHelp');
  if (!registroPasswordsMatch()) {
    if (passwordHelp) {
      passwordHelp.classList.remove('d-none');
      passwordHelp.style.display = 'block';
    }
    confirmInput?.setCustomValidity('Las contraseñas no coinciden');
    return { ok: false, message: 'Las contraseñas no coinciden.' };
  }
  if (passwordHelp) {
    passwordHelp.classList.add('d-none');
    passwordHelp.style.display = 'none';
  }
  confirmInput?.setCustomValidity('');

  for (const cfg of UNIQUE_FIELDS) {
    const v = cfg.input?.value.trim() || '';
    if (!v || v.length < cfg.minLen) continue;

    await validarCampoUnico(cfg);

    if (uniqueState[cfg.campo] === 'checking') {
      return { ok: false, message: 'Espera a que termine la verificación de tus datos.' };
    }
    if (uniqueState[cfg.campo] === 'error') {
      cfg.input?.focus();
      const fb = getFeedback(cfg);
      return { ok: false, message: fb?.textContent || 'Hay datos duplicados en el formulario.' };
    }
    if (uniqueState[cfg.campo] !== 'ok') {
      cfg.input?.focus();
      return { ok: false, message: 'No se pudo verificar la disponibilidad. Intenta de nuevo.' };
    }
  }

  const requiredUnique = ['correo', 'usuario', 'telefono'];
  for (const campo of requiredUnique) {
    const cfg = UNIQUE_FIELDS.find((c) => c.campo === campo);
    if (!cfg?.input) continue;
    const v = cfg.input.value.trim();
    if (!v) continue;
    if (uniqueState[cfg.campo] !== 'ok') {
      await validarCampoUnico(cfg);
      if (uniqueState[cfg.campo] !== 'ok') {
        cfg.input.focus();
        registroScrollTo(cfg.input);
        return { ok: false };
      }
    }
  }

  return { ok: true };
}

// ── Stepper con validación antes de avanzar ──
window.regStepper = {
  current: 1,
  total: 3,
  _busy: false,

  async goTo(step) {
    if (step < 1 || step > this.total || this._busy) return;

    if (step > this.current) {
      if (this.current === 1 && step >= 2) {
        const r1 = registroValidateStep1();
        if (!r1.ok) {
          registroFocusStep1Error();
          return;
        }
      }

      if (this.current === 2 && step >= 3) {
        this._busy = true;
        const nextBtn = document.querySelector('#reg-step-2 .btn-next');
        if (nextBtn) nextBtn.disabled = true;
        try {
          const r2 = await registroValidateStep2();
          if (!r2.ok) {
            registroFocusStep2Error();
            return;
          }
          this.populateSummary();
        } finally {
          this._busy = false;
          if (nextBtn) nextBtn.disabled = false;
        }
      }
    }

    document.querySelectorAll('.reg-step').forEach((p) => p.classList.remove('active'));
    document.getElementById('reg-step-' + step)?.classList.add('active');

    document.querySelectorAll('.step-item').forEach((item) => {
      const s = parseInt(item.dataset.step, 10);
      item.classList.remove('active', 'done');
      if (s === step) item.classList.add('active');
      else if (s < step) item.classList.add('done');
    });

    const line12 = document.getElementById('line-1-2');
    const line23 = document.getElementById('line-2-3');
    if (line12) line12.classList.toggle('done', step >= 2);
    if (line23) line23.classList.toggle('done', step >= 3);

    this.current = step;
  },

  populateSummary() {
    const v = (id) => (document.getElementById(id)?.value || '').trim();
    document.getElementById('sum-nombre').textContent =
      (v('reg-nombres') + ' ' + v('reg-apellidos')).trim() || '—';
    document.getElementById('sum-usuario').textContent = v('nombre_usuario') || '—';
    document.getElementById('sum-correo').textContent = v('correo') || '—';
    document.getElementById('sum-telefono').textContent = v('telefono') || 'No proporcionado';
    document.getElementById('sum-fecha').textContent = v('reg-fecha') || '—';
    document.getElementById('sum-foto').textContent =
      registroHasPhoto() ? 'Foto agregada' : 'Sin foto';
  },
};

document.addEventListener('DOMContentLoaded', () => {
  ['inpFotoOriginal', 'inpFotoMod', 'filePicker'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', clearFotoFeedback);
  });
  document.getElementById('btnCapture')?.addEventListener('click', () => {
    setTimeout(clearFotoFeedback, 300);
  });
  wireOtpNotifChannelListeners();
  updateOtpChannelTexts();

  document.querySelectorAll('.view-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.view === 'registro') {
        clearRegistroValidationState();
      }
    });
  });
});

// === Validación de coincidencia de contraseñas ===
document.addEventListener('DOMContentLoaded', () => {
  const password        = document.getElementById('contrasena');
  const confirmPassword = document.getElementById('confirmar_contrasena');
  const passwordHelp    = document.getElementById('passwordHelp');
  if (!password || !confirmPassword) return;

  function validatePasswords() {
    if (confirmPassword.value === '') {
      confirmPassword.setCustomValidity('');
      if (passwordHelp) { passwordHelp.classList.add('d-none'); passwordHelp.style.display = 'none'; }
    } else if (password.value !== confirmPassword.value) {
      confirmPassword.setCustomValidity('Las contraseñas no coinciden');
      if (passwordHelp) { passwordHelp.classList.remove('d-none'); passwordHelp.style.display = 'block'; }
    } else {
      confirmPassword.setCustomValidity('');
      if (passwordHelp) { passwordHelp.classList.add('d-none'); passwordHelp.style.display = 'none'; }
    }
  }

  password.addEventListener('input', validatePasswords);
  confirmPassword.addEventListener('input', validatePasswords);
});
