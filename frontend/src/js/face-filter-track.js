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

  function layoutForFilter(name, det) {
    const box = det.detection.box;
    const lm = det.landmarks;
    const leftEye = avg(lm.getLeftEye());
    const rightEye = avg(lm.getRightEye());
    const eyeMid = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    const angle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * (180 / Math.PI);

    if (name === 'glasses') {
      return {
        x: eyeMid.x,
        y: eyeMid.y + eyeDist * 0.08,
        w: eyeDist * 2.55,
        rot: angle,
      };
    }
    if (name === 'hat') {
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height * 0.02,
        w: box.width * 1.55,
        rot: angle * 0.35,
      };
    }
    if (name === 'dog') {
      return {
        x: box.x + box.width / 2,
        y: box.y + box.height * 0.38,
        w: box.width * 1.72,
        rot: angle * 0.25,
      };
    }
    return null;
  }

  function applyLayout(overlay, mapped, rot, userScale) {
    overlay.style.left = `${mapped.leftPct}%`;
    overlay.style.top = `${mapped.topPct}%`;
    overlay.style.width = `${Math.max(8, mapped.widthPct)}%`;
    overlay.style.maxWidth = 'none';
    overlay.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(${userScale})`;
  }

  async function ensureModels() {
    if (typeof faceapi === 'undefined') throw new Error('face-api no cargado');
    if (!modelsPromise) {
      modelsPromise = (async () => {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        // Igual que en face-models.js: la primera inferencia compila los shaders
        // de WebGL y cuesta segundos. Se paga aqui, al cargar, y no cuando el
        // usuario elige un filtro. Se usan las mismas opciones que detectOn para
        // que se compilen los shaders de esas formas de tensor y no otras.
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 320; canvas.height = 320;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#808080';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 });
          await faceapi.detectSingleFace(canvas, opts).withFaceLandmarks();
        } catch (e) {
          console.warn('Precalentado de filtros omitido:', e.message);
        }
      })();
    }
    await modelsPromise;
  }

  async function detectOn(el) {
    await ensureModels();
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.38 });
    return faceapi.detectSingleFace(el, opts).withFaceLandmarks();
  }

  function place(overlay, stage, mediaEl, filterName, userScale, det) {
    const layout = layoutForFilter(filterName, det);
    if (!layout) return false;
    const mapped = mapBox(mediaEl, stage, layout.x, layout.y, layout.w);
    if (!mapped) return false;
    applyLayout(overlay, mapped, layout.rot, userScale);
    return true;
  }

  async function snap(overlay, stage, mediaEl, filterName, userScale) {
    if (!overlay || !stage || !mediaEl || !filterName || filterName === 'none') return false;
    try {
      const ready = mediaEl instanceof HTMLVideoElement
        ? mediaEl.readyState >= 2 && mediaEl.videoWidth > 0
        : (mediaEl.complete && (mediaEl.naturalWidth || mediaEl.width));
      if (!ready) return false;
      const det = await detectOn(mediaEl);
      if (!det) return false;
      return place(overlay, stage, mediaEl, filterName, userScale, det);
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
    if (!name || name === 'none' || overlay.style.display === 'none') return;
    if (!video || video.readyState < 2) return;
    detectOn(video).then((det) => {
      if (!running || paused || !det) return;
      if (getFilter() !== name) return;
      place(overlay, stage, video, name, Number(getScale()) || 1, det);
    }).catch(() => {});
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
