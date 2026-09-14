// face-models.js — Estado global y lógica de face-api para reconocimiento facial

let labeledFaceDescriptors = [];
let modelsLoaded = false;
let cedulaNombreMap = {};
let selectedEmpresaId = null;
let descriptorsCache = {};
let loadedUsers = new Set();
let recognitionActive = false;

/**
 * Descargar los pesos no basta: TensorFlow.js compila los shaders de WebGL en la
 * PRIMERA inferencia, y esa compilacion tarda ~15 s en un equipo de escritorio.
 * Sin esto el usuario se comia esos 15 s justo al pulsar "entrar con mi cara",
 * que es exactamente el limite de 15 s que pone el documento para el login.
 *
 * La solucion es pagar ese coste mientras el usuario todavia esta escribiendo
 * sus datos: una inferencia de mentira sobre un lienzo vacio, del mismo tamano
 * que usa capturePhoto (200x200), para que se compilen los mismos shaders.
 */
async function warmUpModels() {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const t0 = performance.now();
    await faceapi.detectSingleFace(canvas).withFaceLandmarks().withFaceDescriptor();
    console.log(`Modelos precalentados en ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  } catch (e) {
    // Que falle el precalentado no debe impedir usar la camara.
    console.warn('Precalentado de modelos omitido:', e.message);
  }
}

async function loadModels() {
  const MODEL_URL = '/models';
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
  modelsLoaded = true;
  console.log("Modelos cargados");
  await warmUpModels();
}

async function loadLabeledImagesAsync() {
  if (!selectedEmpresaId) {
    console.error("No se ha seleccionado una empresa");
    return [];
  }
  showLoadingMessage(true);
  try {
    const response = await fetch(`/get-labels?empresaId=${selectedEmpresaId}`);
    const { labels } = await response.json();
    labeledFaceDescriptors = [];
    loadedUsers.clear();
    const batchSize = 10;
    for (let i = 0; i < labels.length; i += batchSize) {
      const batch = labels.slice(i, i + batchSize);
      await processBatch(batch);
    }
    console.log("Descriptores cargados:", labeledFaceDescriptors);
  } catch (error) {
    console.error("Error al cargar descriptores:", error);
  } finally {
    showLoadingMessage(false);
  }
}

async function processBatch(batch) {
  await Promise.all(batch.map(async (label) => {
    if (loadedUsers.has(label)) return;
    loadedUsers.add(label);
    try {
      const resp = await fetch(`/get-image?name=${encodeURIComponent(label)}&empresaId=${encodeURIComponent(selectedEmpresaId)}`);
      if (!resp.ok) { console.error('Imagen no disponible para', label); return; }
      const blob = await resp.blob();
      const img = await faceapi.bufferToImage(blob);
      const det = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
      if (det?.descriptor) {
        const ld = new faceapi.LabeledFaceDescriptors(label, [det.descriptor]);
        if (!labeledFaceDescriptors.some(d => d.label === label)) {
          labeledFaceDescriptors.push(ld);
          descriptorsCache[label] = ld;
        }
      } else {
        console.error(`No se detectó rostro para: ${label}`);
      }
    } catch (e) {
      console.error(`Error con ${label}:`, e);
    }
  }));
}

function capturePhoto(videoElement) {
  const canvas = document.createElement('canvas');
  canvas.width = 200; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
}

async function startCamera() {
  if (recognitionActive) return;
  recognitionActive = true;
  if (!modelsLoaded) { console.error("Modelos no cargados aún."); return; }

  const video = document.getElementById('video');
  if (!video) { console.error('Elemento #video no encontrado'); return; }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
    video.srcObject = stream;
    await video.play();
    console.log("Cámara activada");
  } catch (e) { console.error("Error al activar cámara:", e); return; }

  const container = document.getElementById('camera') || video.parentElement;
  const oldCanvas = container.querySelector('canvas');
  if (oldCanvas) oldCanvas.remove();
  const canvas = faceapi.createCanvasFromMedia(video);
  Object.assign(canvas.style, { position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' });
  container.appendChild(canvas);

  const updateCanvasSize = () => {
    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    faceapi.matchDimensions(canvas, displaySize);
  };
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);

  let previousBox = null, stillFrames = 0, noBlinkFrames = 0;

  const getEyeAspectRatio = (eye) => {
    const A = faceapi.euclideanDistance(eye[1], eye[5]);
    const B = faceapi.euclideanDistance(eye[2], eye[4]);
    const C = faceapi.euclideanDistance(eye[0], eye[3]);
    return (A + B) / (2.0 * C);
  };
  const isBlinking = (landmarks) => {
    const EAR = (getEyeAspectRatio(landmarks.getLeftEye()) + getEyeAspectRatio(landmarks.getRightEye())) / 2.0;
    return EAR < 0.25;
  };

  setInterval(async () => {
    const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();

    if (detections.length > 0) {
      const currentBox = detections[0].detection.box;
      if (previousBox) {
        const deltaX = Math.abs(currentBox.x - previousBox.x);
        const deltaY = Math.abs(currentBox.y - previousBox.y);
        stillFrames = (deltaX < 0.8 && deltaY < 0.8) ? stillFrames + 1 : 0;
      }
      previousBox = currentBox;
      const blinkDetected = isBlinking(detections[0].landmarks);
      noBlinkFrames = blinkDetected ? 0 : (noBlinkFrames + 1);
      if (stillFrames >= 1 && noBlinkFrames >= 3) {
        notifyUser("No hay parpadeo ni movimiento facial, posible imagen o pantalla.", true);
      }
    }

    const displaySize = { width: video.clientWidth, height: video.clientHeight };
    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);

    if (labeledFaceDescriptors.length > 0) {
      const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5);
      const results = resized.map(d => faceMatcher.findBestMatch(d.descriptor));

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const box = resized[i].detection.box;
        new faceapi.draw.DrawBox(box, {
          label: result.toString(),
          boxColor: result.label === 'unknown' ? 'red' : 'green'
        }).draw(canvas);

        if (result.label === 'unknown') {
          notifyUser('🔴 Usuario no reconocido', true);
          const photoBase64 = capturePhoto(video);
          try {
            await apiFetch('/register-failed-attempt', {
              method: 'POST',
              body: { nombre: 'Desconocido', empresaId: selectedEmpresaId, motivo: 'Usuario no registrado', fotoIntento: photoBase64, deviceCode: DEVICE_CODE }
            });
          } catch (e) { console.error('Fallo registrar intento fallido:', e.message); }
        } else if (result.distance < 0.5) {
          const nombre = result.label;
          const userId = await getUserIdByName(nombre);
          if (!userId) return;
          const photoBase64 = capturePhoto(video);
          const tipo = document.getElementById('tipoRegistro')?.value;
          if (!tipo) { notifyUser("⚠️ Debe seleccionar si es Entrada o Salida", true); return; }
          let ok = false;
          if (tipo === 'entrada') ok = await registerEntry(userId, photoBase64);
          else ok = await registerExit(userId);
          if (ok) {
            notifyUser(`✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)} registrada para ${nombre}`);
            showCustomAlert(`✅ ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}: ${nombre}`);
            if (typeof mostrarAccesoReconocido === 'function') mostrarAccesoReconocido(nombre);
          }
        }
      }
    }
  }, 1000);
}

async function registerEntry(userId, photoBase64) {
  try {
    await apiFetch('/register-entry', {
      method: 'POST',
      body: { usuarioId: userId, empresaId: selectedEmpresaId, deviceCode: DEVICE_CODE, resultado_autenticacion: "Exitosa", foto_intento: photoBase64 }
    });
    notifyUser('✅ Entrada registrada exitosamente.');
    return true;
  } catch (e) { notifyUser(e.message || 'Error al registrar la entrada.', true); return false; }
}

async function registerExit(userId) {
  try {
    await apiFetch('/register-exit', {
      method: 'POST',
      body: { usuarioId: userId, empresaId: selectedEmpresaId, deviceCode: DEVICE_CODE }
    });
    notifyUser('✅ Salida registrada exitosamente.');
    return true;
  } catch (e) { notifyUser(e.message || 'Error al registrar la salida.', true); return false; }
}

async function getUserIdByName(name) {
  const response = await fetch(`/get-user-id?name=${encodeURIComponent(name)}&empresaId=${encodeURIComponent(selectedEmpresaId)}`);
  if (!response.ok) return null;
  const data = await response.json();
  return data.id;
}

// Exponer globalmente
window.labeledFaceDescriptors = labeledFaceDescriptors;
window.modelsLoaded = modelsLoaded;
window.selectedEmpresaId = selectedEmpresaId;
window.loadModels = loadModels;
window.loadLabeledImagesAsync = loadLabeledImagesAsync;
window.capturePhoto = capturePhoto;
window.startCamera = startCamera;
window.registerEntry = registerEntry;
window.registerExit = registerExit;
window.getUserIdByName = getUserIdByName;
