/**
 * Coloca filtros (lentes, gorro, perro) sobre landmarks de la cara.
 * Requiere face-api (tinyFaceDetector + faceLandmark68Net).
 */
(function (global) {
  const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model';
  const DETECT_MS = 90;

  let modelsPromise = null;
  let raf = 0;
  let lastDetect = 0;
  let paused = false;
  let running = false;
  let ctx = null;
  let ticket = 0;
  const workCanvas = document.createElement('canvas');

  function avg(pts) {
    let x = 0;
    let y = 0;
    pts.forEach((p) => {
      x += p.x;
      y += p.y;
    });
    const n = pts.length || 1;
    return { x: x / n, y: y / n };
  }

  function mediaSize(el) {
    if (el instanceof HTMLVideoElement) {
      return { w: el.videoWidth, h: el.videoHeight };
    }
    return { w: el.naturalWidth || el.width || 0, h: el.naturalHeight || el.height || 0 };
  }

  /** Dibuja lo que se ve con object-fit:cover, para detectar sobre el recuadro real. */
  function drawVisible(el, stage) {
    const { w: srcW, h: srcH } = mediaSize(el);
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (!srcW || !srcH || !sw || !sh) return null;
    const stageRatio = sw / sh;
    const cw = 320;
    const ch = Math.max(1, Math.round(cw / stageRatio));
    workCanvas.width = cw;
    workCanvas.height = ch;
    const g = workCanvas.getContext('2d', { willReadFrequently: true });
    const mediaRatio = srcW / srcH;
    let dw;
    let dh;
    let dx;
    let dy;
    if (mediaRatio > stageRatio) {
      dh = ch;
      dw = ch * mediaRatio;
      dx = (cw - dw) / 2;
      dy = 0;
    } else {
      dw = cw;
      dh = cw / mediaRatio;
      dx = 0;
      dy = (ch - dh) / 2;
    }
    g.drawImage(el, dx, dy, dw, dh);
    return workCanvas;
  }

  function mapBox(el, stage, mx, my, mw) {
    const { w: srcW, h: srcH } = mediaSize(el);
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (!srcW || !srcH || !sw || !sh) return null;
    const mediaRatio = srcW / srcH;
    const stageRatio = sw / sh;
    let renderedW;
    let renderedH;
    let ox;
    let oy;
    if (mediaRatio > stageRatio) {
      renderedH = sh;
      renderedW = sh * mediaRatio;
      ox = (sw - renderedW) / 2;
      oy = 0;
    } else {
      renderedW = sw;
      renderedH = sw / mediaRatio;
      ox = 0;
      oy = (sh - renderedH) / 2;
    }
    const px = renderedW / srcW;
    return {
      leftPct: ((ox + mx * px) / sw) * 100,
      topPct: ((oy + my * px) / sh) * 100,
      widthPct: (mw * px / sw) * 100,
    };
  }

  function mapFromVisible(canvas, x, y, w) {
    return {
      leftPct: (x / canvas.width) * 100,
      topPct: (y / canvas.height) * 100,
      widthPct: (w / canvas.width) * 100,
    };
  }

  function layoutForFilter(name, det) {
    const box = det.detection.box;
    const lm = det.landmarks;
    const leftEye = avg(lm.getLeftEye());
    const rightEye = avg(lm.getRightEye());
    const eyeMid = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);
    const nose = (lm.positions && lm.positions[30]) || eyeMid;

    if (name === 'glasses') {
      return { x: eyeMid.x, y: eyeMid.y, w: eyeDist * 3.2, rot: angle, anchorY: 0.6 };
    }
    if (name === 'hat' || name === 'unicorn') {
      return {
        x: box.x + box.width / 2,
        y: eyeMid.y + eyeDist * 0.35,
        w: eyeDist * 3.1,
        rot: angle * 0.2,
        anchorY: 0.9,
      };
    }
    if (name === 'dog') {
      return { x: nose.x, y: nose.y, w: box.width * 1.35, rot: angle * 0.15, anchorY: 0.5 };
    }
    return null;
  }

  function applyLayout(overlay, mapped, rot, userScale, anchorY) {
    const ay = (anchorY == null ? 0.5 : anchorY) * 100;
    overlay.style.left = `${mapped.leftPct}%`;
    overlay.style.top = `${mapped.topPct}%`;
    overlay.style.width = `${Math.max(8, mapped.widthPct)}%`;
    overlay.style.maxWidth = 'none';
    overlay.style.transform = `translate(-50%, -${ay}%) rotate(${rot}deg) scale(${userScale})`;
  }

  async function ensureModels() {
    if (typeof faceapi === 'undefined') throw new Error('face-api no cargado');
    if (!modelsPromise) {
      modelsPromise = (async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
      })();
    }
    await modelsPromise;
  }

  async function detectOn(el) {
    await ensureModels();
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 });
    return faceapi.detectSingleFace(el, opts).withFaceLandmarks();
  }

  async function placeOn(overlay, stage, mediaEl, filterName, userScale) {
    const layoutSource = drawVisible(mediaEl, stage);
    if (!layoutSource) return false;
    const det = await detectOn(layoutSource);
    if (!det) return false;
    const layout = layoutForFilter(filterName, det);
    if (!layout) return false;
    const mapped = mapFromVisible(layoutSource, layout.x, layout.y, layout.w);
    if (!mapped) return false;
    applyLayout(overlay, mapped, layout.rot, userScale, layout.anchorY);
    return true;
  }

  async function snap(overlay, stage, mediaEl, filterName, userScale, matchVisible) {
    if (!overlay || !stage || !mediaEl || !filterName || filterName === 'none') return false;
    try {
      const ready = mediaEl instanceof HTMLVideoElement
        ? mediaEl.readyState >= 2 && mediaEl.videoWidth > 0
        : (mediaEl.complete && (mediaEl.naturalWidth || mediaEl.width));
      if (!ready) return false;
      return await placeOn(overlay, stage, mediaEl, filterName, userScale);
    } catch (err) {
      console.warn('Filtro facial:', err.message);
      return false;
    }
  }

  function loop() {
    if (!running || !ctx) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    if (paused || now - lastDetect < DETECT_MS) return;
    lastDetect = now;
    const { overlay, stage, video, getFilter, getScale } = ctx;
    const name = getFilter();
    if (!name || name === 'none' || !video || video.readyState < 2) {
      if (overlay) overlay.style.visibility = 'hidden';
      return;
    }
    const mine = ++ticket;
    placeOn(overlay, stage, video, name, Number(getScale()) || 1).then((ok) => {
      if (!running || mine !== ticket || !ctx || ctx.getFilter() !== name) return;
      overlay.style.display = 'block';
      overlay.style.visibility = ok ? 'visible' : 'hidden';
    }).catch(() => {
      if (mine === ticket && overlay) overlay.style.visibility = 'hidden';
    });
  }

  function start(options) {
    stop();
    ctx = options;
    running = true;
    paused = false;
    lastDetect = 0;
    ensureModels().catch((err) => console.warn('Modelos faciales:', err.message));
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    ctx = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function setPaused(value) {
    paused = !!value;
  }

  global.UmgFaceFilter = {
    ensureModels,
    snap,
    start,
    stop,
    setPaused,
  };
})(window);
