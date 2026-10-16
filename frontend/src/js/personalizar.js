/**
 * Modal de personalizacion Lado A / B — reutiliza logica de filtros del registro
 */
(function (global) {
  const FILTERS_PATH = '/assets/filters/';
  const FILTERS = {
    none: null,
    glasses: FILTERS_PATH + 'glasses.png',
    dog: FILTERS_PATH + 'dog.png',
    unicorn: FILTERS_PATH + 'hat.png',
    hat: FILTERS_PATH + 'hat.png',
  };

  const dialog = document.getElementById('persoDialog');
  if (!dialog) return;

  const els = {
    title: dialog.querySelector('[data-perso-title]'),
    subtitle: dialog.querySelector('[data-perso-subtitle]'),
    tabs: dialog.querySelector('.perso-tabs'),
    tabA: dialog.querySelector('[data-perso-tab="a"]'),
    tabB: dialog.querySelector('[data-perso-tab="b"]'),
    stage: dialog.querySelector('.perso-stage'),
    video: dialog.querySelector('#persoVideo'),
    still: dialog.querySelector('#persoStill'),
    overlay: dialog.querySelector('#persoOverlay'),
    scale: dialog.querySelector('#persoScale'),
    previewOrig: dialog.querySelector('#persoPreviewOrig'),
    previewMod: dialog.querySelector('#persoPreviewMod'),
    texto: dialog.querySelector('#persoTexto'),
    status: dialog.querySelector('[data-perso-status]'),
    btnCancel: dialog.querySelectorAll('[data-perso-cancel]'),
    btnConfirm: dialog.querySelector('[data-perso-confirm]'),
    btnVista: dialog.querySelector('[data-perso-vista]'),
    vista: dialog.querySelector('#persoVista'),
    btnUpload: dialog.querySelector('[data-perso-upload]'),
    btnCam: dialog.querySelector('[data-perso-cam]'),
    btnCapture: dialog.querySelector('[data-perso-capture]'),
    btnStop: dialog.querySelector('[data-perso-stop]'),
    fileInput: dialog.querySelector('#persoFile'),
    nfcWrap: dialog.querySelector('#persoNfcWrap'),
    nfcUrl: dialog.querySelector('#persoNfcUrl'),
  };

  function normalizeNfcUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
    try {
      const parsed = new URL(u);
      if (!['http:', 'https:'].includes(parsed.protocol)) return '';
      return parsed.href;
    } catch {
      return '';
    }
  }

  let product = null;
  let resolveFn = null;
  let rejectFn = null;
  let currentSide = 'a';
  let stream = null;
  let currentFilter = 'none';
  let overlayNudged = false;

  function normalizeFilterName(name) {
    if (name === 'hat') return 'unicorn';
    return name || 'none';
  }

  const sides = {
    a: { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null },
    b: { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null },
  };

  function setStatus(msg, isError) {
    if (!els.status) return;
    els.status.textContent = msg || '';
    els.status.classList.toggle('is-error', !!isError);
  }

  function activeSide() {
    return sides[currentSide];
  }

  function saveSideFields() {
    const s = activeSide();
    s.texto = (els.texto?.value || '').trim();
    s.filtro = currentFilter;
  }

  function loadSideFields() {
    const s = activeSide();
    currentFilter = normalizeFilterName(s.filtro);
    if (els.texto) els.texto.value = s.texto || '';
    document.querySelectorAll('.perso-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
    applyFilter(currentFilter);
    if (s.previewUrl && els.previewMod) {
      els.previewMod.src = s.previewUrl;
    } else if (els.previewMod) {
      els.previewMod.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }
    if (s.blobOriginal && els.previewOrig) {
      els.previewOrig.src = URL.createObjectURL(s.blobOriginal);
    }
  }

  function userScale() {
    return Number(els.scale?.value) || 1;
  }

  function startFaceFollow() {
    if (!global.UmgFaceFilter || !els.video || !els.overlay || !els.stage) return;
    overlayNudged = false;
    global.UmgFaceFilter?.setPaused(false);
    global.UmgFaceFilter.start({
      video: els.video,
      overlay: els.overlay,
      stage: els.stage,
      getFilter: () => (overlayNudged ? 'none' : currentFilter),
      getScale: userScale,
      matchVisible: true,
    });
  }

  async function snapFaceIfPossible() {
    if (!global.UmgFaceFilter || !els.overlay || !els.stage || currentFilter === 'none') {
      refreshCapturaEstado();
      return true;
    }
    const usingVideo = stream && els.video?.srcObject && els.video.style.display !== 'none';
    const media = usingVideo ? els.video : (els.still?.style.display !== 'none' ? els.still : null);
    if (!media) {
      els.overlay.style.visibility = 'hidden';
      if (!overlayNudged) resetOverlayPos();
      refreshCapturaEstado();
      return false;
    }
    const ok = await global.UmgFaceFilter.snap(els.overlay, els.stage, media, currentFilter, userScale(), true);
    els.overlay.style.visibility = ok ? 'visible' : 'hidden';
    refreshCapturaEstado();
    return ok;
  }

  function filterEnCara() {
    if (currentFilter === 'none') return true;
    if (!els.overlay?.src || els.overlay.style.display === 'none') return false;
    return els.overlay.style.visibility === 'visible';
  }

  function refreshCapturaEstado() {
    if (currentFilter === 'none' || !hayVista()) {
      setCapturaLista(false);
      return;
    }
    setCapturaLista(filterEnCara());
  }

  let capturaWatchTimer = null;
  function startCapturaWatch() {
    stopCapturaWatch();
    capturaWatchTimer = window.setInterval(refreshCapturaEstado, 100);
  }
  function stopCapturaWatch() {
    if (capturaWatchTimer) {
      clearInterval(capturaWatchTimer);
      capturaWatchTimer = null;
    }
  }

  function hayVista() {
    const camara = !!(
      stream &&
      els.video?.srcObject &&
      els.video.style.display !== 'none' &&
      els.video.readyState >= 2
    );
    const foto = !!(
      els.still &&
      els.still.style.display !== 'none' &&
      els.still.src &&
      els.still.complete &&
      (els.still.naturalWidth || 0) > 0
    );
    return camara || foto;
  }

  function applyFilter(name) {
    if (name !== 'none' && !hayVista()) {
      setStatus('Enciende la cámara o sube una foto para usar un filtro.', true);
      return;
    }
    currentFilter = name;
    overlayNudged = false;
    global.UmgFaceFilter?.setPaused(false);
    if (!els.overlay) return;
    if (FILTERS[name]) {
      els.overlay.src = FILTERS[name];
      els.overlay.style.display = 'block';
      els.overlay.style.visibility = 'hidden';
      if (stream && els.video?.srcObject && els.video.style.display !== 'none') {
        startFaceFollow();
      } else {
        snapFaceIfPossible();
      }
    } else {
      els.overlay.removeAttribute('src');
      els.overlay.style.display = 'none';
      els.overlay.style.visibility = 'hidden';
      global.UmgFaceFilter?.stop();
    }
    dialog.querySelectorAll('.perso-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === name);
    });
    refreshCapturaEstado();
    if (hayVista()) startCapturaWatch();
  }

  function resetOverlayPos() {
    if (!els.overlay) return;
    els.overlay.style.left = '50%';
    els.overlay.style.top = '50%';
    els.overlay.style.width = '42%';
    els.overlay.style.transform = `translate(-50%,-50%) scale(${userScale()})`;
  }

  function switchSide(side) {
    saveSideFields();
    currentSide = side;
    els.tabA?.classList.toggle('active', side === 'a');
    els.tabB?.classList.toggle('active', side === 'b');
    loadSideFields();
  }

  async function blobToFile(blob, filename) {
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
  }

  async function renderWithFilter(sourceImg, filterName, overlayEl, scaleVal) {
    const canvas = document.createElement('canvas');
    canvas.width = sourceImg.width;
    canvas.height = sourceImg.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sourceImg, 0, 0);

    if (FILTERS[filterName] && overlayEl?.src) {
      const parentRect = els.stage.getBoundingClientRect();
      const ovRect = overlayEl.getBoundingClientRect();
      const ovImg = new Image();
      await new Promise((res, rej) => {
        ovImg.onload = res;
        ovImg.onerror = rej;
        ovImg.src = overlayEl.src;
      });
      const wPct = ovRect.width / parentRect.width;
      const leftPct = (ovRect.left - parentRect.left) / parentRect.width;
      const topPct = (ovRect.top - parentRect.top) / parentRect.height;
      const w = canvas.width * wPct;
      const h = ovImg.height * (w / ovImg.width);
      const x = canvas.width * leftPct;
      const y = canvas.height * topPct;
      ctx.drawImage(ovImg, x, y, w, h);
    }

    return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  }

  async function processImageFromFile(file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });

    const blobOriginal = await new Promise(r => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(r, 'image/jpeg', 0.92);
    });

    let blobMod = blobOriginal;
    if (currentFilter !== 'none') {
      if (!filterEnCara()) {
        setStatus('En la foto debe verse tu rostro para aplicar el filtro, o elige Original.', true);
        refreshCapturaEstado();
        return;
      }
      blobMod = await renderWithFilter(img, currentFilter, els.overlay, els.scale?.value);
    }

    const s = activeSide();
    s.blobOriginal = blobOriginal;
    s.blobMod = blobMod;
    s.previewUrl = URL.createObjectURL(blobMod);
    if (els.previewOrig) els.previewOrig.src = url;
    if (els.previewMod) els.previewMod.src = s.previewUrl;
    if (els.still) {
      els.still.src = url;
      els.still.style.display = 'block';
    }
    if (els.video) els.video.style.display = 'none';
    global.UmgFaceFilter?.stop();
    await snapFaceIfPossible();
    startCapturaWatch();
    refreshCapturaEstado();
    setStatus('');
  }

  async function captureFromCamera() {
    if (currentFilter === 'none') {
      setStatus('En Original la foto va sin filtro. Sube una imagen o elige un filtro para capturar.', true);
      return;
    }
    if (els.btnCapture?.disabled || !hayVista()) {
      setStatus('Enciende la cámara o sube una foto antes de capturar.', true);
      return;
    }

    const usingVideo = !!(stream && els.video?.srcObject && els.video.style.display !== 'none');
    const usingStill = !!(els.still?.style.display !== 'none' && els.still?.src);

    let width = 0;
    let height = 0;
    if (usingVideo) {
      width = els.video.videoWidth;
      height = els.video.videoHeight;
    } else if (usingStill) {
      await new Promise((r) => {
        if (els.still.complete) r();
        else els.still.onload = r;
      });
      width = els.still.naturalWidth;
      height = els.still.naturalHeight;
    }

    if (!width || !height) {
      setStatus('Espera a que la cámara cargue o sube una imagen válida.', true);
      return;
    }

    if (currentFilter !== 'none') {
      if (!filterEnCara()) await snapFaceIfPossible();
      if (!filterEnCara()) {
        setStatus('Mira a la cámara hasta que se vea el filtro en tu rostro.', true);
        refreshCapturaEstado();
        return;
      }
    }

    const drawSource = (ctx) => {
      if (usingVideo) ctx.drawImage(els.video, 0, 0, width, height);
      else ctx.drawImage(els.still, 0, 0, width, height);
    };

    const canvasO = document.createElement('canvas');
    canvasO.width = width;
    canvasO.height = height;
    drawSource(canvasO.getContext('2d'));
    const blobOriginal = await new Promise(r => canvasO.toBlob(r, 'image/jpeg', 0.92));

    const canvasM = document.createElement('canvas');
    canvasM.width = width;
    canvasM.height = height;
    const ctxM = canvasM.getContext('2d');
    drawSource(ctxM);

    if (currentFilter !== 'none' && FILTERS[currentFilter] && els.overlay?.src && filterEnCara()) {
      const parentRect = els.stage.getBoundingClientRect();
      const ovRect = els.overlay.getBoundingClientRect();
      const ovImg = new Image();
      await new Promise(res => {
        ovImg.onload = res;
        ovImg.src = els.overlay.src;
      });
      const wPct = ovRect.width / parentRect.width;
      const leftPct = (ovRect.left - parentRect.left) / parentRect.width;
      const topPct = (ovRect.top - parentRect.top) / parentRect.height;
      const w = width * wPct;
      const h = ovImg.height * (w / ovImg.width);
      ctxM.drawImage(ovImg, width * leftPct, height * topPct, w, h);
    }

    const blobMod = await new Promise(r => canvasM.toBlob(r, 'image/jpeg', 0.92));
    const s = activeSide();
    s.blobOriginal = blobOriginal;
    s.blobMod = blobMod;
    s.previewUrl = URL.createObjectURL(blobMod);
    if (els.previewOrig) els.previewOrig.src = URL.createObjectURL(blobOriginal);
    if (els.previewMod) els.previewMod.src = s.previewUrl;
    if (usingStill && els.still) {
      els.still.src = els.previewOrig.src;
    }
    setStatus('');
    refreshCapturaEstado();
  }

  async function uploadSide(sideKey) {
    const s = sides[sideKey];
    if (!s.blobMod) return null;
    const fd = new FormData();
    fd.append('imagen', await blobToFile(s.blobMod, `${sideKey}.jpg`));
    fd.append('lado', sideKey);
    const headers = {};
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/api/tienda/personalizacion/imagen', {
      method: 'POST',
      body: fd,
      credentials: 'include',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Error al subir imagen');
    s.imagen_url = data.url;
    return data.url;
  }

  function setCapturaLista(lista) {
    const btn = els.btnCapture;
    if (!btn) return;
    btn.disabled = !lista;
    btn.classList.toggle('is-blocked', !lista);
    const icon = btn.querySelector('i');
    if (icon) icon.className = lista ? 'fas fa-circle-dot' : 'fas fa-ban';
  }

  function stopCamera() {
    global.UmgFaceFilter?.stop();
    stopCapturaWatch();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (els.video) {
      els.video.srcObject = null;
      els.video.style.display = 'none';
    }
    refreshCapturaEstado();
  }

  function resetState(prod) {
    product = prod;
    currentSide = 'a';
    currentFilter = 'none';
    sides.a = { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null };
    sides.b = { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null };
    stopCamera();
    if (els.still) els.still.style.display = 'none';
    const vacio = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    if (els.previewOrig) els.previewOrig.src = vacio;
    if (els.previewMod) els.previewMod.src = vacio;
    setStatus('');

    const tieneB = prod.tiene_lado_b === true || prod.tiene_lado_b === 1 || prod.tiene_lado_b === '1';
    if (els.tabs) els.tabs.style.display = tieneB ? 'flex' : 'none';
    if (els.title) els.title.textContent = prod.nombre;
    if (els.subtitle) {
      els.subtitle.textContent = tieneB
        ? 'Foto en lado A y lado B.'
        : 'Foto del producto.';
    }
    const showNfc = global.PersoMock?.isNfcProduct(prod.slug, prod.nombre) ?? true;
    if (els.nfcWrap) els.nfcWrap.hidden = !showNfc;
    if (els.nfcUrl) {
      els.nfcUrl.value = '';
      els.nfcUrl.required = showNfc;
    }
    switchSide('a');
    setCapturaLista(false);
    global.UmgFaceFilter?.ensureModels?.().catch(() => {});
  }

  async function confirmPersonalizacion() {
    saveSideFields();
    const tieneB = product.tiene_lado_b === true || product.tiene_lado_b === 1 || product.tiene_lado_b === '1';

    if (!sides.a.blobMod) {
      setStatus('Sube o captura la imagen del Lado A.', true);
      switchSide('a');
      return;
    }
    if (tieneB && !sides.b.blobMod) {
      setStatus('Sube o captura la imagen del Lado B.', true);
      switchSide('b');
      return;
    }

    const showNfc = global.PersoMock?.isNfcProduct(product?.slug, product?.nombre) ?? true;
    let nfc_url = '';
    if (showNfc && els.nfcUrl) {
      nfc_url = normalizeNfcUrl(els.nfcUrl.value);
      if (!nfc_url) {
        els.nfcUrl.setCustomValidity('Ingresa un enlace válido (https://…).');
        els.nfcUrl.reportValidity();
        els.nfcUrl.focus();
        return;
      }
      els.nfcUrl.setCustomValidity('');
    }

    els.btnConfirm.disabled = true;
    setStatus('Guardando personalizacion...');

    try {
      await uploadSide('a');
      if (tieneB) await uploadSide('b');

      const payload = {
        nfc_url: nfc_url || undefined,
        lado_a: {
          filtro: sides.a.filtro,
          texto: sides.a.texto,
          imagen_url: sides.a.imagen_url,
        },
      };
      if (tieneB) {
        payload.lado_b = {
          filtro: sides.b.filtro,
          texto: sides.b.texto,
          imagen_url: sides.b.imagen_url,
        };
      }

      dialog.close();
      const fn = resolveFn;
      resolveFn = null;
      rejectFn = null;
      fn?.(payload);
    } catch (err) {
      setStatus(err.message, true);
    } finally {
      els.btnConfirm.disabled = false;
    }
  }

  // Overlay drag
  (function enableDrag() {
    if (!els.overlay || !els.stage) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    els.overlay.style.pointerEvents = 'auto';
    els.overlay.addEventListener('mousedown', e => {
      dragging = true;
      overlayNudged = true;
      global.UmgFaceFilter?.setPaused(true);
      startX = e.clientX;
      startY = e.clientY;
      const rect = els.overlay.getBoundingClientRect();
      const parentRect = els.stage.getBoundingClientRect();
      originLeft = rect.left - parentRect.left;
      originTop = rect.top - parentRect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', e => {
      if (!dragging) return;
      const parentRect = els.stage.getBoundingClientRect();
      const newLeft = originLeft + (e.clientX - startX);
      const newTop = originTop + (e.clientY - startY);
      els.overlay.style.left = `${(newLeft / parentRect.width) * 100}%`;
      els.overlay.style.top = `${(newTop / parentRect.height) * 100}%`;
      els.overlay.style.transform = `translate(-50%, -50%) scale(${els.scale?.value || 1})`;
    });
    window.addEventListener('mouseup', () => { dragging = false; });
  })();

  els.scale?.addEventListener('input', () => {
    const t = els.overlay?.style.transform || '';
    if (/scale\(/.test(t)) {
      els.overlay.style.transform = t.replace(/scale\([^)]+\)/, `scale(${els.scale.value})`);
    } else {
      resetOverlayPos();
    }
  });

  document.querySelectorAll('.perso-filter').forEach(btn => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  els.tabA?.addEventListener('click', () => switchSide('a'));
  els.tabB?.addEventListener('click', () => switchSide('b'));

  els.btnUpload?.addEventListener('click', () => els.fileInput?.click());
  els.fileInput?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await processImageFromFile(file);
    } catch (err) {
      setStatus(err.message, true);
    }
    e.target.value = '';
  });

  els.btnCam?.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      els.video.srcObject = stream;
      els.video.style.display = 'block';
      if (els.still) els.still.style.display = 'none';
      overlayNudged = false;
      await els.video.play?.();
      const ready = () => {
        if (els.video.readyState >= 2) {
          startFaceFollow();
          if (currentFilter !== 'none') snapFaceIfPossible();
          startCapturaWatch();
          refreshCapturaEstado();
          setStatus('');
          return;
        }
        requestAnimationFrame(ready);
      };
      ready();
    } catch (err) {
      setStatus('No se pudo usar la camara: ' + err.message, true);
    }
  });

  els.btnStop?.addEventListener('click', () => {
    stopCamera();
    setStatus('');
  });

  els.btnCapture?.addEventListener('click', () => captureFromCamera());

  function onCancelPerso() {
    stopCamera();
    resolveFn = null;
    rejectFn?.(new Error('cancelado'));
    rejectFn = null;
    dialog.close();
  }
  els.btnCancel?.forEach((btn) => btn.addEventListener('click', onCancelPerso));

  dialog.addEventListener('cancel', e => {
    e.preventDefault();
    stopCamera();
    resolveFn = null;
    rejectFn?.(new Error('cancelado'));
    rejectFn = null;
    dialog.close();
  });

  let scrollY = 0;
  function lockPage(on) {
    if (on) {
      scrollY = window.scrollY || 0;
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      return;
    }
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
  }

  dialog.addEventListener('close', () => {
    stopCamera();
    lockPage(false);
  });

  function mockKind() {
    return global.PersoMock?.productKind(product?.slug, product?.nombre) || 'llavero';
  }

  function abrirVista() {
    saveSideFields();
    if (!sides.a.previewUrl && !sides.b.previewUrl) {
      setStatus('Captura o sube la foto del lado A para visualizar el producto.', true);
      return;
    }
    const kind = mockKind();
    const mocks = global.PersoMock?.MOCKS;
    els.vista?.querySelectorAll('.perso-mock').forEach((fig) => {
      const side = fig.dataset.vista;
      fig.classList.toggle('perso-mock--llavero', kind === 'llavero');
      fig.classList.toggle('perso-mock--tarjeta', kind === 'tarjeta');
      const base = fig.querySelector('.perso-mock__base');
      const photo = fig.querySelector('.perso-mock__photo');
      if (base && mocks) base.src = mocks[kind][side];
      if (photo) {
        const url = sides[side]?.previewUrl;
        if (url) { photo.src = url; photo.hidden = false; }
        else { photo.removeAttribute('src'); photo.hidden = true; }
      }
    });
    if (els.vista) els.vista.hidden = false;
  }

  els.btnVista?.addEventListener('click', (e) => {
    e.preventDefault();
    abrirVista();
  });
  els.vista?.querySelector('[data-vista-close]')?.addEventListener('click', () => {
    if (els.vista) els.vista.hidden = true;
  });

  els.btnConfirm?.addEventListener('click', e => {
    e.preventDefault();
    confirmPersonalizacion();
  });

  /**
   * @param {object} prod - producto del catalogo
   * @returns {Promise<object>} personalizacion JSON
   */
  function openPersonalizar(prod) {
    resetState(prod);
    return new Promise((resolve, reject) => {
      resolveFn = val => {
        resolveFn = null;
        rejectFn = null;
        resolve(val);
      };
      rejectFn = err => {
        resolveFn = null;
        rejectFn = null;
        reject(err);
      };
      lockPage(true);
      dialog.showModal();
    });
  }

  global.openPersonalizar = openPersonalizar;
})(window);
