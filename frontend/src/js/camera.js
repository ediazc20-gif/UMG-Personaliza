// camera.js — Lógica de cámara, filtros y overlay arrastrable (Registro)
(() => {
  const filePicker = document.getElementById("filePicker");
  const video = document.getElementById("video");
  const stageStill = document.getElementById("stageStill");
  const overlay = document.getElementById("overlay");
  const stage = document.getElementById("stage");

  const previewOriginal = document.getElementById("previewOriginal");
  const previewMod = document.getElementById("previewMod");
  const thumbOriginal = document.getElementById("thumbOriginal");
  const thumbMod = document.getElementById("thumbMod");

  const inpFotoOriginal = document.getElementById("inpFotoOriginal");
  const inpFotoMod = document.getElementById("inpFotoMod");

  const btnStartCam = document.getElementById("btnStartCam");
  const btnStopCam = document.getElementById("btnStopCam");
  const btnCapture = document.getElementById("btnCapture");
  const btnResetOverlay = document.getElementById("btnResetOverlay");
  const scaleRange = document.getElementById("scaleRange");

  if (!video || !stage) return; // no estamos en la página de registro

  const filtersPath = "/assets/filters/";
  const FILTERS = {
    none: null,
    glasses: filtersPath + "glasses.png",
    dog: filtersPath + "dog.png",
    unicorn: filtersPath + "hat.png",
    hat: filtersPath + "hat.png",
  };

  let currentStream = null;
  let currentFilter = "none";
  let overlayNudged = false;

  function hayVista() {
    const camara = !!(
      currentStream &&
      video.srcObject &&
      video.style.display !== "none" &&
      video.readyState >= 2
    );
    const foto = !!(
      stageStill &&
      stageStill.style.display !== "none" &&
      stageStill.src &&
      stageStill.complete &&
      stageStill.naturalWidth > 0
    );
    return camara || foto;
  }

  function setFotoFeedback(text, isError) {
    const fb = document.getElementById("feedback-foto");
    if (!fb) return;
    if (!text) {
      fb.className = "field-feedback";
      fb.textContent = "";
      return;
    }
    fb.className = isError ? "field-feedback field-feedback--error" : "field-feedback";
    fb.textContent = text;
  }

  function setCapturaLista(lista) {
    if (!btnCapture) return;
    btnCapture.disabled = !lista;
    btnCapture.classList.toggle("is-blocked", !lista);
    const icon = btnCapture.querySelector("i");
    if (icon) icon.className = lista ? "fas fa-circle-dot" : "fas fa-ban";
  }

  function filterEnCara() {
    if (currentFilter === "none") return true;
    if (!overlay?.src || overlay.style.display === "none") return false;
    return overlay.style.visibility === "visible";
  }

  function refreshCapturaEstado() {
    // Original = sin filtro: no se usa Capturar (usa Subir foto o elige un filtro)
    if (currentFilter === "none" || !hayVista()) {
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

  function markPreviewHasPhoto(has) {
    previewOriginal?.classList.toggle("has-photo", has);
    previewMod?.classList.toggle("has-photo", has);
  }

  function dataURLtoBlob(dataUrl) {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  async function blobToFileInput(inputEl, blob, filename) {
    const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
    const dt = new DataTransfer();
    dt.items.add(file);
    inputEl.files = dt.files;
  }

  function userScale() {
    return Number(scaleRange?.value) || 1;
  }

  function startFaceFollow() {
    if (!window.UmgFaceFilter || !video || !overlay || !stage) return;
    overlayNudged = false;
    window.UmgFaceFilter?.setPaused(false);
    window.UmgFaceFilter.start({
      video,
      overlay,
      stage,
      getFilter: () => (overlayNudged ? "none" : currentFilter),
      getScale: userScale,
    });
  }

  async function snapFaceIfPossible() {
    if (!window.UmgFaceFilter || currentFilter === "none") {
      refreshCapturaEstado();
      return true;
    }
    const usingVideo = currentStream && video.srcObject && video.style.display !== "none";
    const media = usingVideo ? video : (stageStill?.style.display !== "none" ? stageStill : null);
    if (!media) {
      overlay.style.visibility = "hidden";
      if (!overlayNudged) resetOverlay();
      refreshCapturaEstado();
      return false;
    }
    const ok = await window.UmgFaceFilter.snap(overlay, stage, media, currentFilter, userScale());
    overlay.style.visibility = ok ? "visible" : "hidden";
    if (!ok && !overlayNudged) resetOverlay();
    refreshCapturaEstado();
    return ok;
  }

  function resetOverlay() {
    overlay.style.left = "50%";
    overlay.style.top = "50%";
    overlay.style.width = "42%";
    overlay.style.transform = `translate(-50%,-50%) scale(${scaleRange.value})`;
  }

  function setFilter(name) {
    if (name !== "none" && !hayVista()) {
      setFotoFeedback("Enciende la cámara o sube una foto para usar un filtro.", true);
      return;
    }
    setFotoFeedback("");
    currentFilter = name;
    overlayNudged = false;
    window.UmgFaceFilter?.setPaused(false);
    if (FILTERS[name]) {
      overlay.src = FILTERS[name];
      overlay.style.display = "";
      overlay.style.visibility = "hidden";
      if (currentStream && video.srcObject && video.style.display !== "none") {
        startFaceFollow();
      } else {
        snapFaceIfPossible();
      }
    } else {
      overlay.removeAttribute("src");
      overlay.style.display = "none";
      overlay.style.visibility = "hidden";
      window.UmgFaceFilter?.stop();
    }
    document.querySelectorAll(".reg-filter-row [data-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === name);
    });
    refreshCapturaEstado();
    if (hayVista()) startCapturaWatch();
  }

  (function enableDrag() {
    let dragging = false, startX = 0, startY = 0, originLeft = 0, originTop = 0;

    overlay.addEventListener("mousedown", e => {
      dragging = true;
      overlayNudged = true;
      window.UmgFaceFilter?.setPaused(true);
      startX = e.clientX; startY = e.clientY;
      const rect = overlay.getBoundingClientRect();
      const parentRect = stage.getBoundingClientRect();
      originLeft = rect.left - parentRect.left;
      originTop = rect.top - parentRect.top;
      e.preventDefault();
    });

    window.addEventListener("mousemove", e => {
      if (!dragging) return;
      const parentRect = stage.getBoundingClientRect();
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = originLeft + dx;
      const newTop = originTop + dy;
      overlay.style.left = (newLeft / parentRect.width * 100) + "%";
      overlay.style.top = (newTop / parentRect.height * 100) + "%";
      overlay.style.transform = `translate(-50%,-50%) scale(${scaleRange.value})`;
    });

    window.addEventListener("mouseup", () => dragging = false);
  })();

  scaleRange?.addEventListener("input", () => {
    const t = overlay.style.transform || "";
    if (/scale\(/.test(t)) {
      overlay.style.transform = t.replace(/scale\([^)]+\)/, `scale(${scaleRange.value})`);
    } else {
      overlay.style.transform = `translate(-50%,-50%) scale(${scaleRange.value})`;
    }
  });

  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter));
  });
  setFilter("none");

  btnStartCam.addEventListener("click", async () => {
    try {
      currentStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      video.srcObject = currentStream;
      video.style.display = "";
      stageStill.style.display = "none";
      overlayNudged = false;
      await video.play?.();
      const ready = () => {
        if (video.videoWidth > 0) {
          setFotoFeedback("");
          startFaceFollow();
          startCapturaWatch();
          refreshCapturaEstado();
          return;
        }
        requestAnimationFrame(ready);
      };
      ready();
    } catch (err) {
      refreshCapturaEstado();
      alert("No se pudo activar la cámara: " + err.message);
    }
  });

  function stopCam() {
    window.UmgFaceFilter?.stop();
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    if (video) {
      video.srcObject = null;
      video.style.display = "none";
    }
    if (!hayVista()) stopCapturaWatch();
    refreshCapturaEstado();
  }

  btnStopCam?.addEventListener("click", stopCam);
  document.getElementById("btnRegFotoNext")?.addEventListener("click", stopCam);

  (filePicker || document.querySelector('label.btn-ghost input[type="file"]'))?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    previewOriginal.src = URL.createObjectURL(file);
    thumbOriginal.src = previewOriginal.src;
    await blobToFileInput(inpFotoOriginal, file, file.name || "original.jpg");

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (FILTERS[currentFilter]) {
        const ov = new Image(); ov.crossOrigin = "anonymous";
        ov.onload = async () => {
          const scale = parseFloat(scaleRange.value);
          const w = canvas.width * 0.4 * scale;
          const h = ov.height * (w / ov.width);
          const x = (canvas.width - w) / 2;
          const y = (canvas.height - h) / 2;
          ctx.drawImage(ov, x, y, w, h);

          const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9));
          previewMod.src = URL.createObjectURL(blob);
          thumbMod.src = previewMod.src;
          await blobToFileInput(inpFotoMod, blob, "modificada.jpg");
        };
        ov.src = FILTERS[currentFilter];
      } else {
        const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.9));
        previewMod.src = URL.createObjectURL(blob);
        thumbMod.src = previewMod.src;
        await blobToFileInput(inpFotoMod, blob, "modificada.jpg");
      }

      stageStill.src = previewOriginal.src;
      stageStill.style.display = "";
      video.style.display = "none";
      window.UmgFaceFilter?.stop();
      markPreviewHasPhoto(true);
      await snapFaceIfPossible();
      startCapturaWatch();
    };
    img.src = previewOriginal.src;
  });

  btnCapture.addEventListener("click", async () => {
    if (currentFilter === "none") {
      setFotoFeedback("En Original la foto va sin filtro. Sube una imagen o elige Gafas, Perro o Unicornio para capturar.", true);
      return;
    }
    if (btnCapture.disabled || !hayVista()) {
      setFotoFeedback("Enciende la cámara o sube una foto antes de capturar.", true);
      return;
    }

    const usingVideo = !!(currentStream && video.srcObject && video.style.display !== "none");
    const usingStill = !!(stageStill?.style.display !== "none" && stageStill?.src);

    let width = 0;
    let height = 0;
    if (usingVideo) {
      width = video.videoWidth;
      height = video.videoHeight;
    } else if (usingStill) {
      await new Promise((r) => {
        if (stageStill.complete) r();
        else stageStill.onload = r;
      });
      width = stageStill.naturalWidth;
      height = stageStill.naturalHeight;
    }

    if (!width || !height) {
      setFotoFeedback("Espera a que la cámara cargue o sube una imagen válida.", true);
      return;
    }

    if (currentFilter !== "none") {
      const media = usingVideo ? video : stageStill;
      if (!filterEnCara()) await snapFaceIfPossible();
      if (!filterEnCara()) {
        setFotoFeedback("Mira a la cámara hasta que se vea el filtro en tu rostro.", true);
        refreshCapturaEstado();
        return;
      }
    }

    const canvasO = document.createElement("canvas");
    canvasO.width = width; canvasO.height = height;
    const ctxO = canvasO.getContext("2d");
    if (usingVideo) ctxO.drawImage(video, 0, 0, width, height);
    else {
      await new Promise(r => { if (stageStill.complete) r(); else stageStill.onload = r; });
      ctxO.drawImage(stageStill, 0, 0, width, height);
    }
    const blobOriginal = await new Promise(r => canvasO.toBlob(r, "image/jpeg", 0.95));

    const canvasM = document.createElement("canvas");
    canvasM.width = width; canvasM.height = height;
    const ctxM = canvasM.getContext("2d");
    if (usingVideo) ctxM.drawImage(video, 0, 0, width, height);
    else ctxM.drawImage(stageStill, 0, 0, width, height);

    if (currentFilter !== "none" && FILTERS[currentFilter] && overlay.src && filterEnCara()) {
      const parentRect = stage.getBoundingClientRect();
      const ovRect = overlay.getBoundingClientRect();
      const leftPct = (ovRect.left - parentRect.left) / parentRect.width;
      const topPct = (ovRect.top - parentRect.top) / parentRect.height;
      const wPct = ovRect.width / parentRect.width;

      const ovImg = new Image();
      await new Promise(res => { ovImg.onload = res; ovImg.src = overlay.src; });

      const w = width * wPct;
      const h = ovImg.height * (w / ovImg.width);
      const x = width * leftPct;
      const y = height * topPct;
      ctxM.drawImage(ovImg, x, y, w, h);
    }

    const blobMod = await new Promise(r => canvasM.toBlob(r, "image/jpeg", 0.95));

    const urlO = URL.createObjectURL(blobOriginal);
    const urlM = URL.createObjectURL(blobMod);
    previewOriginal.src = urlO;
    thumbOriginal.src = urlO;
    previewMod.src = urlM;
    thumbMod.src = urlM;

    await blobToFileInput(inpFotoOriginal, blobOriginal, "original.jpg");
    await blobToFileInput(inpFotoMod, blobMod, "modificada.jpg");
    markPreviewHasPhoto(true);
    setFotoFeedback("");
  });

  btnResetOverlay.addEventListener("click", () => {
    overlayNudged = false;
    window.UmgFaceFilter?.setPaused(false);
    snapFaceIfPossible();
  });
  resetOverlay();
  refreshCapturaEstado();

  window.resetRegistroCamara = function resetRegistroCamara() {
    stopCapturaWatch();
    stopCam();
    currentFilter = "none";
    overlayNudged = false;
    document.querySelectorAll(".reg-filter-row [data-filter]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === "none");
    });
    if (overlay) {
      overlay.removeAttribute("src");
      overlay.style.display = "none";
      overlay.style.visibility = "hidden";
    }
    if (stageStill) {
      stageStill.style.display = "none";
      stageStill.removeAttribute("src");
    }
    if (video) video.style.display = "none";
    markPreviewHasPhoto(false);
    setFotoFeedback("");
    resetOverlay();
    refreshCapturaEstado();
  };
})();
