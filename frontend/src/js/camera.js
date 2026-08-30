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
    dog: filtersPath + "dog.png",
    glasses: filtersPath + "glasses.png",
    hat: filtersPath + "hat.png"
  };

  let currentStream = null;
  let currentFilter = "none";
  let overlayNudged = false;

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
    if (!window.UmgFaceFilter || currentFilter === "none") return;
    const usingVideo = currentStream && video.srcObject && video.style.display !== "none";
    const media = usingVideo ? video : (stageStill?.style.display !== "none" ? stageStill : null);
    if (!media) {
      resetOverlay();
      return;
    }
    const ok = await window.UmgFaceFilter.snap(overlay, stage, media, currentFilter, userScale());
    if (!ok) resetOverlay();
  }

  function resetOverlay() {
    overlay.style.left = "50%";
    overlay.style.top = "50%";
    overlay.style.width = "42%";
    overlay.style.transform = `translate(-50%,-50%) scale(${scaleRange.value})`;
  }

  function setFilter(name) {
    currentFilter = name;
    overlayNudged = false;
    window.UmgFaceFilter?.setPaused(false);
    if (FILTERS[name]) {
      overlay.src = FILTERS[name];
      overlay.style.display = "";
      snapFaceIfPossible();
    } else {
      overlay.removeAttribute("src");
      overlay.style.display = "none";
    }
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

  scaleRange.addEventListener("input", () => {
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
      startFaceFollow();
    } catch (err) {
      alert("No se pudo activar la cámara: " + err.message);
    }
  });

  btnStopCam.addEventListener("click", () => {
    window.UmgFaceFilter?.stop();
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
    video.srcObject = null;
  });

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
      snapFaceIfPossible();
    };
    img.src = previewOriginal.src;
  });

  btnCapture.addEventListener("click", async () => {
    const usingVideo = currentStream && video.srcObject;
    const width = usingVideo ? video.videoWidth : stage.clientWidth;
    const height = usingVideo ? video.videoHeight : stage.clientHeight;

    if (!width || !height) {
      alert("Activa la cámara o sube una imagen primero.");
      return;
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

    if (FILTERS[currentFilter] && overlay.src) {
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
  });

  btnResetOverlay.addEventListener("click", () => {
    overlayNudged = false;
    window.UmgFaceFilter?.setPaused(false);
    snapFaceIfPossible();
  });
  resetOverlay();
})();
