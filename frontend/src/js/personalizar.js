/**
 * Modal de personalizacion Lado A / B — reutiliza logica de filtros del registro
 */
(function (global) {
  const FILTERS_PATH = '/assets/filters/';
  const FILTERS = {
    none: null,
    dog: FILTERS_PATH + 'dog.png',
    glasses: FILTERS_PATH + 'glasses.png',
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
    btnUpload: dialog.querySelector('[data-perso-upload]'),
    btnCam: dialog.querySelector('[data-perso-cam]'),
    btnCapture: dialog.querySelector('[data-perso-capture]'),
    btnStop: dialog.querySelector('[data-perso-stop]'),
    fileInput: dialog.querySelector('#persoFile'),
  };

  let product = null;
  let resolveFn = null;
  let rejectFn = null;
  let currentSide = 'a';
  let stream = null;
  let currentFilter = 'none';
  let overlayNudged = false;

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
    currentFilter = s.filtro || 'none';
    if (els.texto) els.texto.value = s.texto || '';
    document.querySelectorAll('.perso-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
    applyFilter(currentFilter);
    if (s.previewUrl && els.previewMod) {
      els.previewMod.src = s.previewUrl;
    } else if (els.previewMod) {
      els.previewMod.removeAttribute('src');
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
    });
  }

  async function snapFaceIfPossible() {
    if (!global.UmgFaceFilter || !els.overlay || !els.stage || currentFilter === 'none') return;
    const usingVideo = stream && els.video?.srcObject && els.video.style.display !== 'none';
    const media = usingVideo ? els.video : (els.still?.style.display !== 'none' ? els.still : null);
    if (!media) {
      resetOverlayPos();
      return;
    }
    const ok = await global.UmgFaceFilter.snap(els.overlay, els.stage, media, currentFilter, userScale());
    if (!ok) resetOverlayPos();
  }

  function applyFilter(name) {
    currentFilter = name;
    overlayNudged = false;
    global.UmgFaceFilter?.setPaused(false);
    if (!els.overlay) return;
    if (FILTERS[name]) {
      els.overlay.src = FILTERS[name];
      els.overlay.style.display = 'block';
      snapFaceIfPossible();
    } else {
      els.overlay.removeAttribute('src');
      els.overlay.style.display = 'none';
    }
    document.querySelectorAll('.perso-filter').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === name);
    });
  }

  function resetOverlayPos() {
    if (!els.overlay || !els.scale) return;
    els.overlay.style.left = '50%';
    els.overlay.style.top = '50%';
    els.overlay.style.width = '42%';
    els.overlay.style.transform = `translate(-50%, -50%) scale(${els.scale.value})`;
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

    const blobMod = await renderWithFilter(img, currentFilter, els.overlay, els.scale?.value);

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
    setStatus(currentFilter !== 'none'
      ? 'Filtro alineado a la cara. Arrastra si quieres ajustar.'
      : 'Vista previa lista.');
  }

  async function captureFromCamera() {
    const usingVideo = stream && els.video?.srcObject;
    const width = usingVideo ? els.video.videoWidth : els.stage.clientWidth;
    const height = usingVideo ? els.video.videoHeight : els.stage.clientHeight;
    if (!width || !height) {
      setStatus('Activa la camara o sube una imagen.', true);
      return;
    }

    const canvasO = document.createElement('canvas');
    canvasO.width = width;
    canvasO.height = height;
    const ctxO = canvasO.getContext('2d');
    if (usingVideo) ctxO.drawImage(els.video, 0, 0, width, height);
    else {
      await new Promise(r => {
        if (els.still.complete) r();
        else els.still.onload = r;
      });
      ctxO.drawImage(els.still, 0, 0, width, height);
    }
    const blobOriginal = await new Promise(r => canvasO.toBlob(r, 'image/jpeg', 0.92));

    const canvasM = document.createElement('canvas');
    canvasM.width = width;
    canvasM.height = height;
    const ctxM = canvasM.getContext('2d');
    if (usingVideo) ctxM.drawImage(els.video, 0, 0, width, height);
    else ctxM.drawImage(els.still, 0, 0, width, height);

    if (FILTERS[currentFilter] && els.overlay?.src) {
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
    setStatus('Captura guardada.');
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

  function stopCamera() {
    global.UmgFaceFilter?.stop();
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (els.video) {
      els.video.srcObject = null;
      els.video.style.display = 'none';
    }
  }

  function resetState(prod) {
    product = prod;
    currentSide = 'a';
    currentFilter = 'none';
    sides.a = { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null };
    sides.b = { filtro: 'none', texto: '', blobOriginal: null, blobMod: null, previewUrl: null, imagen_url: null };
    stopCamera();
    if (els.still) els.still.style.display = 'none';
    if (els.previewOrig) els.previewOrig.removeAttribute('src');
    if (els.previewMod) els.previewMod.removeAttribute('src');
    setStatus('');

    const tieneB = prod.tiene_lado_b === true || prod.tiene_lado_b === 1 || prod.tiene_lado_b === '1';
    if (els.tabs) els.tabs.style.display = tieneB ? 'flex' : 'none';
    if (els.title) els.title.textContent = prod.nombre;
    if (els.subtitle) {
      els.subtitle.textContent = tieneB
        ? 'Personaliza lado A y B con foto, filtro y texto.'
        : 'Personaliza con foto, filtro y texto.';
    }
    switchSide('a');
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

    els.btnConfirm.disabled = true;
    setStatus('Guardando personalizacion...');

    try {
      await uploadSide('a');
      if (tieneB) await uploadSide('b');

      const payload = {
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
      startFaceFollow();
      setStatus('Camara activa. El filtro sigue tu cara.');
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

  dialog.addEventListener('close', () => {
    stopCamera();
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
      dialog.showModal();
    });
  }

  global.openPersonalizar = openPersonalizar;
})(window);
