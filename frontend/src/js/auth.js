// auth.js — Login (contraseña, facial, QR) y cerrar sesión
// Solo contiene UNA versión del handler de login (la más completa con manejo de roles)

// === Cerrar sesión ===
async function cerrarSesion() {
  await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  try { window.__qrStop?.(); } catch { }
  try { window.__camStop?.(); } catch { }
  document.querySelectorAll('video').forEach(v => {
    const s = v.srcObject;
    if (s && typeof s.getTracks === 'function') {
      try { s.getTracks().forEach(t => t.stop()); } catch { }
      v.srcObject = null;
    }
  });
  try { sessionStorage.removeItem('usuario'); } catch { }
  try { localStorage.removeItem('uid'); localStorage.removeItem('rol'); localStorage.removeItem('nombre'); localStorage.removeItem('token'); } catch { }

  const msgLogin = document.getElementById('login-central-msg');
  if (msgLogin) { msgLogin.className = 'msg'; msgLogin.textContent = ''; }

  document.getElementById('login-central-form')?.reset();
  document.getElementById('registro-central-form')?.reset();
  window.location.replace('/');
}

document.getElementById('btnLogout')?.addEventListener('click', (e) => {
  e.preventDefault();
  cerrarSesion();
});

function setLoginIdentificador(val) {
  const id = String(val || '').trim();
  const pw = document.getElementById('lc-identificador');
  const facial = document.getElementById('user-mail');
  if (pw) pw.value = id;
  if (facial) facial.value = id;
}

window.setLoginIdentificador = setLoginIdentificador;
window.applyPrefillLoginIdentificador = applyPrefillLoginIdentificador;

function applyPrefillLoginIdentificador() {
  let id = '';
  try { id = (sessionStorage.getItem('prefillLoginIdentificador') || '').trim(); } catch { /* ignore */ }
  if (!id) return;
  setLoginIdentificador(id);
  try { sessionStorage.removeItem('prefillLoginIdentificador'); } catch { /* ignore */ }
  const pass = document.getElementById('lc-contrasena');
  pass?.focus();
  let afterReset = false;
  try {
    afterReset = sessionStorage.getItem('loginMsgAfterReset') === '1';
    if (afterReset) sessionStorage.removeItem('loginMsgAfterReset');
  } catch { /* ignore */ }
  if (afterReset) {
    const msgLogin = document.getElementById('login-central-msg');
    if (msgLogin) {
      msgLogin.textContent = 'Contraseña actualizada. Inicia sesión con tu nueva contraseña.';
      msgLogin.className = 'msg success';
    }
  }
}

function limpiarEstadoMetodosLogin() {
  try { window.__qrStop?.(); } catch { /* ignore */ }
  document.getElementById('login-central-form')?.reset();
  setLoginIdentificador('');
  const msgLogin = document.getElementById('login-central-msg');
  if (msgLogin) { msgLogin.textContent = ''; msgLogin.className = 'msg'; }
  const facialMsg = document.getElementById('o');
  if (facialMsg) { facialMsg.textContent = ''; facialMsg.style.color = ''; }
  const qrStatus = document.getElementById('status');
  if (qrStatus) { qrStatus.textContent = ''; qrStatus.style.color = ''; }
  try { window.__resetFacialLoginState?.(); } catch { }
}
window.limpiarEstadoMetodosLogin = limpiarEstadoMetodosLogin;

// === LOGIN CONTRASEÑA (handler único y completo con manejo de roles) ===
document.addEventListener('DOMContentLoaded', () => {
  applyPrefillLoginIdentificador();
  const form = document.getElementById('login-central-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const identificador = e.target.identificador.value.trim();
    const contrasena    = e.target.contrasena.value.trim();
    const msg = document.getElementById('login-central-msg');
    if (msg) { msg.textContent = 'Verificando...'; msg.className = 'msg'; }

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, contrasena }),
        credentials: 'include',
      });

      if (!res.ok) {
        const errText = getHttpErrorMessage(
          res.status,
          await res.text(),
          res.headers.get('content-type') || ''
        );
        if (msg) { msg.textContent = errText; msg.className = 'msg error'; }
        return;
      }

      const data = await res.json();
      console.log('Respuesta del login:', data);

      if (data.ok && data.usuario) {
        sessionStorage.setItem('usuario', JSON.stringify(data.usuario));
        localStorage.setItem('uid',    data.usuario.id);
        localStorage.setItem('rol',    data.usuario.rol);
        localStorage.setItem('nombre', data.usuario.nombre);
        localStorage.setItem('token',  data.token);

        if (msg) { msg.textContent = 'Sesion iniciada correctamente'; msg.className = 'msg success'; }

        // Notificación WhatsApp
        const u = getUsuario();
        if (u) {
          const notWhatsappBool = Boolean(u.notif_whatsapp?.data?.[0]);
          if (notWhatsappBool) {
            const to = '+502' + u.celular;
            const message = `Hola ${u.nombre}, acabas de iniciar sesion en UMG Basic Rover 2.0`;
            fetch('/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ to, message }),
              credentials: 'include',
            }).catch(console.error);
          }
        }

        setTimeout(() => {
          redirectByRole(data.usuario.rol);
        }, 500);
      } else {
        if (msg) { msg.textContent = 'Usuario o contrasena incorrectos'; msg.className = 'msg error'; }
      }
    } catch (err) {
      console.error('Error en login:', err);
      if (msg) { msg.textContent = 'Error al intentar iniciar sesion.'; msg.className = 'msg error'; }
    }
  });
});

// === LOGIN FACIAL ===
(async () => {
  const v = document.getElementById('v');
  const msgEl = document.getElementById('o');
  const mailInput = document.getElementById('user-mail');
  const panel = document.getElementById('method-facial');
  if (!v || !panel) return;

  let stream = null;
  let busy = false;
  let timer = null;
  let esperaHasta = 0;

  const showMsg = (txt, ok = true) => {
    if (!msgEl) return;
    msgEl.textContent = txt || '';
    msgEl.style.color = ok ? '#1B5E20' : '#9B1C1C';
  };

  async function iniciarCamara() {
    if (stream) return;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      v.srcObject = stream;
      await v.play();
    } catch (e) {
      showMsg('No se pudo abrir la cámara. Revisa el permiso del navegador.', false);
    }
  }

  async function detenerCamara() {
    try { stream?.getTracks().forEach(t => t.stop()); } catch { }
    stream = null;
    v.srcObject = null;
  }

  function panelActivo() {
    return panel.classList.contains('active');
  }

  async function hayCara() {
    if (!v.videoWidth || v.readyState < 2 || typeof faceapi === 'undefined') return true;
    try {
      if (window.UmgFaceFilter?.ensureModels) await window.UmgFaceFilter.ensureModels();
      const det = await faceapi.detectSingleFace(
        v,
        new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 })
      );
      return !!det;
    } catch {
      return true;
    }
  }

  async function intentarLogin() {
    if (busy || !panelActivo() || Date.now() < esperaHasta) return;
    const identificador = (mailInput?.value || '').trim();
    if (identificador.length < 3 || !v.videoWidth) return;
    if (!(await hayCara())) return;

    busy = true;
    showMsg('Reconociendo tu rostro…', true);
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const img = c.toDataURL('image/jpeg', 0.8);

    try {
      const res = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identificador, photo_base64: img }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok && data.usuario) {
        clearInterval(timer);
        sessionStorage.setItem('usuario', JSON.stringify(data.usuario || {}));
        localStorage.setItem('uid', data.usuario.id);
        localStorage.setItem('rol', data.usuario.rol);
        localStorage.setItem('nombre', data.usuario.nombre);
        if (data.token) localStorage.setItem('token', data.token);
        await detenerCamara();
        redirectByRole(data.usuario.rol);
        return;
      }
      showMsg(data.error || 'No coincide el rostro. Mira a la cámara.', false);
      esperaHasta = Date.now() + 4000;
    } catch (e) {
      showMsg('Error de red: ' + e.message, false);
      esperaHasta = Date.now() + 4000;
    } finally {
      busy = false;
    }
  }

  async function activarFacial() {
    await iniciarCamara();
    if (!timer) timer = setInterval(intentarLogin, 1800);
  }

  window.__resetFacialLoginState = () => {
    busy = false;
    esperaHasta = 0;
    showMsg('');
  };

  document.querySelectorAll('.method-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.dataset.method === 'facial') activarFacial();
      else {
        clearInterval(timer);
        timer = null;
        detenerCamara();
        window.__resetFacialLoginState();
      }
    });
  });

  mailInput?.addEventListener('input', () => {
    if (panelActivo()) activarFacial();
  });
})();

// === LOGIN QR ===
(function () {
  const readerEl     = document.getElementById("reader");
  const statusEl     = document.getElementById("status");
  const scanDebugEl  = document.getElementById("scanDebug");
  const cameraSelect = document.getElementById("cameraSelect");
  const startBtn     = document.getElementById("startBtn");
  const stopBtn      = document.getElementById("stopBtn");
  const panel = document.getElementById("method-qr");
  if (!readerEl || !statusEl || !panel) return;

  let html5QrCode, currentCameraId = null, scanning = false;
  let zxingReader = null;
  let usingZXing = false;
  let scanHandled = false;
  let autoScanInterval = null;
  let scanAttempts = 0;
  let scanTickBusy = false;

  function videoActivo() {
    if (usingZXing) return document.getElementById('readerVideo');
    return readerEl.querySelector('video');
  }

  function crearCanvasDesdeVideo(video, processFn = null) {
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    if (typeof processFn === 'function') processFn(ctx, w, h);
    return canvas;
  }

  function recortarCanvas(canvas, x, y, w, h) {
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return out;
  }

  function aplicarAltoContraste(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = (0.299 * d[i]) + (0.587 * d[i + 1]) + (0.114 * d[i + 2]);
      const bw = gray > 130 ? 255 : 0;
      d[i] = bw;
      d[i + 1] = bw;
      d[i + 2] = bw;
    }
    ctx.putImageData(img, 0, 0);
  }

  async function decodeConBarcodeDetector(canvas) {
    if (typeof globalThis.BarcodeDetector === 'undefined') return null;
    try {
      const detector = new globalThis.BarcodeDetector({ formats: ['code_128', 'code_39', 'codabar', 'qr_code'] });
      const result = await detector.detect(canvas);
      const first = Array.isArray(result) ? result.find(x => x?.rawValue) : null;
      return first?.rawValue || null;
    } catch {
      return null;
    }
  }

  async function decodeConZXing(canvas) {
    if (!puedeUsarZXing()) return null;
    try {
      // Lector separado para captura, evita conflicto con el stream activo.
      const ZX = globalThis.ZXing;
      const stillReader = new ZX.BrowserMultiFormatReader(construirHintsZXing(), 250);
      const img = new Image();
      img.src = canvas.toDataURL('image/png');
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const res = await stillReader.decodeFromImageElement(img);
      if (res) return typeof res.getText === 'function' ? res.getText() : String(res.text || '');
    } catch {
      return null;
    }
    return null;
  }

  async function decodificarFrameActual() {
    const video = videoActivo();
    if (!video || video.readyState < 2) return null;

    const canvasOriginal = crearCanvasDesdeVideo(video);
    const canvasAltoContraste = crearCanvasDesdeVideo(video, aplicarAltoContraste);
    const w = canvasOriginal.width;
    const h = canvasOriginal.height;
    const cropW = Math.floor(w * 0.78);
    const cropH = Math.floor(h * 0.36);
    const cropX = Math.floor((w - cropW) / 2);
    const cropY = Math.floor(h * 0.42);
    const canvasRecorte = recortarCanvas(canvasOriginal, cropX, cropY, cropW, cropH);
    const canvasRecorteContraste = recortarCanvas(canvasAltoContraste, cropX, cropY, cropW, cropH);

    const candidatos = [canvasRecorte, canvasRecorteContraste, canvasOriginal, canvasAltoContraste];

    for (const c of candidatos) {
      const byNative = await decodeConBarcodeDetector(c);
      if (byNative) return byNative;
      const byZXing = await decodeConZXing(c);
      if (byZXing) return byZXing;
    }
    return null;
  }

  async function listarCamaras() {
    const devices = await Html5Qrcode.getCameras();
    if (cameraSelect) {
      cameraSelect.innerHTML = "";
      devices.forEach((d, i) => {
        const opt = document.createElement("option");
        opt.value = d.id; opt.textContent = d.label || `Cámara ${i + 1}`;
        cameraSelect.appendChild(opt);
      });
    }
    if (devices.length > 0) currentCameraId = devices[0].id;
  }

  cameraSelect?.addEventListener("change", e => { currentCameraId = e.target.value; });

  function puedeUsarZXing() {
    return !!(globalThis.ZXing && globalThis.ZXing.BrowserMultiFormatReader);
  }

  function construirHintsZXing() {
    const ZX = globalThis.ZXing;
    const formats = [];
    const BF = ZX.BarcodeFormat;
    const DH = ZX.DecodeHintType;
    if (typeof BF.QR_CODE !== 'undefined') formats.push(BF.QR_CODE);
    if (typeof BF.CODE_128 !== 'undefined') formats.push(BF.CODE_128);
    if (typeof BF.CODE_39 !== 'undefined') formats.push(BF.CODE_39);
    if (typeof BF.CODABAR !== 'undefined') formats.push(BF.CODABAR);

    const hints = new Map();
    if (formats.length) hints.set(DH.POSSIBLE_FORMATS, formats);
    return hints;
  }

  function crearZXingReader() {
    const ZX = globalThis.ZXing;
    return new ZX.BrowserMultiFormatReader(construirHintsZXing(), 250);
  }

  function obtenerFormatosSoportados() {
    const f = globalThis.Html5QrcodeSupportedFormats;
    if (!f) return null;

    const formatos = [];
    if (typeof f.QR_CODE !== 'undefined') formatos.push(f.QR_CODE);
    if (typeof f.CODE_128 !== 'undefined') formatos.push(f.CODE_128);
    if (typeof f.CODE_39 !== 'undefined') formatos.push(f.CODE_39);
    if (typeof f.CODABAR !== 'undefined') formatos.push(f.CODABAR);

    return formatos.length ? formatos : null;
  }

  function normalizarCodigoLeido(texto) {
    const raw = String(texto || '').trim();
    const compacto = raw.replace(/\s+/g, '');
    const soloHex = compacto.replace(/[^0-9a-fA-F]/g, '');
    if (/^[0-9a-fA-F]{128}$/.test(soloHex)) return soloHex.toLowerCase();
    if (/^[0-9a-fA-F]{16,64}$/.test(soloHex)) return soloHex.toLowerCase();
    return raw;
  }

  function mostrarCodigoLeido(rawText) {
    if (scanDebugEl) {
      scanDebugEl.textContent = `Leído: ${String(rawText || '').trim()}`;
    }
  }

  async function procesarLecturaDetectada(rawText) {
    if (!rawText || scanHandled) return;
    const codigoLeido = normalizarCodigoLeido(rawText);
    if (!codigoLeido) return;
    mostrarCodigoLeido(codigoLeido);
    await onScanSuccess(codigoLeido);
  }

  function mostrarEstadoEscaneo(extra = '') {
    if (!scanDebugEl) return;
    const sufijo = extra ? ` | ${extra}` : '';
    scanDebugEl.textContent = `Debug escaneo: activo | intentos: ${scanAttempts}${sufijo}`;
  }

  async function iniciar() {
    if (scanning) return;
    try {
      scanHandled = false;
      scanAttempts = 0;
      scanTickBusy = false;
      scanning = true;
      if (startBtn) startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      statusEl.textContent = "Iniciando cámara...";
      mostrarEstadoEscaneo('esperando lectura');

      if (puedeUsarZXing()) {
        usingZXing = true;
        readerEl.innerHTML = '<video id="readerVideo" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;border-radius:12px;"></video>';
        const videoEl = document.getElementById('readerVideo');
        // Iniciar cámara manualmente
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
        }
        videoEl.srcObject = stream;
        await videoEl.play();
        statusEl.textContent = "";
        // Escaneo automático cada 300ms usando la lógica robusta
        autoScanInterval = setInterval(async () => {
          if (!scanning || scanHandled || scanTickBusy) return;
          scanTickBusy = true;
          scanAttempts += 1;
          if (scanAttempts % 4 === 0) mostrarEstadoEscaneo('sin detección');
          try {
            const code = await decodificarFrameActual();
            if (code) {
              await procesarLecturaDetectada(code);
            }
          } finally {
            scanTickBusy = false;
          }
        }, 300);
        return;
      }

      usingZXing = false;
      const formatos = obtenerFormatosSoportados();
      const constructorConfig = { experimentalFeatures: { useBarCodeDetectorIfSupported: true } };
      if (formatos) constructorConfig.formatsToSupport = formatos;
      html5QrCode = new Html5Qrcode("reader", constructorConfig);
      await html5QrCode.start(
        { deviceId: { exact: currentCameraId } },
        { fps: 6, disableFlip: false },
        (rawText) => { procesarLecturaDetectada(rawText); },
        () => {}
      );
      statusEl.textContent = "Escaneando QR o código de barras... (fallback html5-qrcode)";
      mostrarEstadoEscaneo('fallback activo');
    } catch (err) {
      scanning = false; if (startBtn) startBtn.disabled = false; if (stopBtn) stopBtn.disabled = true;
      usingZXing = false;
      statusEl.textContent = "No se pudo iniciar la cámara: " + (err?.message || err);
      if (scanDebugEl) scanDebugEl.textContent = 'Debug escaneo: error al iniciar cámara';
    }
  }

  async function detener() {
    if (!scanning) return;

    if (autoScanInterval) {
      clearInterval(autoScanInterval);
      autoScanInterval = null;
    }

    if (usingZXing) {
      const videoEl = document.getElementById('readerVideo');
      if (videoEl && videoEl.srcObject) {
        try { videoEl.srcObject.getTracks().forEach(t => t.stop()); } catch { }
        videoEl.srcObject = null;
      }
      zxingReader = null;
      usingZXing = false;
    }

    if (html5QrCode) {
      try { await html5QrCode.stop(); } catch { }
      try { await html5QrCode.clear(); } catch { }
      html5QrCode = null;
    }

    scanning = false; if (startBtn) startBtn.disabled = false; if (stopBtn) stopBtn.disabled = true;
    statusEl.textContent = "";
    if (scanDebugEl) scanDebugEl.textContent = 'Debug escaneo: detenido';
  }

  function mensajeQrLegible(error, statusCode) {
    const err = String(error || '').toLowerCase();
    if (err.includes('qr inválido') || err.includes('qr invalido') || err.includes('expirado')) {
      return 'El código QR no es válido o ya venció. Genera uno nuevo e inténtalo otra vez.';
    }
    if (err.includes('contraseña requerida') || err.includes('contrasena requerida')) {
      return 'No se pudo leer correctamente el QR. Intenta escanear nuevamente.';
    }
    if (statusCode === 401) {
      return 'No fue posible verificar tu QR. Revisa que sea tu credencial activa.';
    }
    if (statusCode === 400) {
      return 'El QR escaneado tiene un formato no válido.';
    }
    if (statusCode >= 500) {
      return 'El servidor no está disponible por el momento. Intenta en unos segundos.';
    }
    return 'No se pudo iniciar sesión con el QR. Intenta nuevamente.';
  }

  async function onScanSuccess(qrText) {
    if (scanHandled) return;
    scanHandled = true;
    const codigoLeido = normalizarCodigoLeido(qrText);
    mostrarCodigoLeido(codigoLeido);
    statusEl.textContent = "Código leído. Validando...";
    await detener();
    try {
      const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: codigoLeido }),
        credentials: 'include',
      });
      const raw = await res.text();
      let data = null; try { data = JSON.parse(raw); } catch { }

      if (res.ok && data && data.usuario) {
        sessionStorage.setItem("usuario", JSON.stringify(data.usuario || {}));
        localStorage.setItem('uid',    data.usuario.id);
        localStorage.setItem('rol',    data.usuario.rol);
        localStorage.setItem('nombre', data.usuario.nombre);
        if (data.token) localStorage.setItem('token', data.token);
        const rol = (data.usuario.rol || '').toUpperCase();
        redirectByRole(data.usuario.rol);
        statusEl.textContent = 'Inicio de sesión exitoso. Redirigiendo...';
      } else {
        const detalle = data?.error || raw || `HTTP ${res.status}`;
        statusEl.textContent = mensajeQrLegible(detalle, res.status);
        setTimeout(iniciar, 1200);
      }
    } catch (e) {
      statusEl.textContent = 'No hay conexión con el servidor. Verifica tu red e inténtalo nuevamente.';
    }
  }

  (async () => {
    try { await listarCamaras(); }
    catch { statusEl.textContent = "No se pudieron listar cámaras. ¿Permisos concedidos?"; }
  })();

  function activarQr() {
    if (!panel.classList.contains('active') || scanning) return;
    iniciar();
  }

  document.querySelectorAll('.method-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      queueMicrotask(() => {
        if (tab.dataset.method === 'qr') activarQr();
        else detener();
      });
    });
  });

  window.__qrStop = detener;
  window.__qrStart = activarQr;
})();

window.cerrarSesion = cerrarSesion;
