const tf = require('@tensorflow/tfjs');
const wasm = require('@tensorflow/tfjs-backend-wasm');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { Canvas, Image, ImageData, loadImage } = require('canvas');
const path = require('path');

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let initialized = false;

async function init(modelsPath = process.env.MODELS_PATH || path.join(__dirname, '../../models')) {
  if (initialized) return;
  wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/', true);
  await tf.setBackend('wasm');
  await tf.ready();
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
  initialized = true;
}

async function descriptorFromBase64(b64, minConfidence = 0.35) {
  if (!initialized) await init();
  const pure = b64.includes(',') ? b64.split(',')[1] : b64; // soporta data URI
  const buf = Buffer.from(pure, 'base64');
  console.log(`[face_node] Buffer size: ${buf.length} bytes`);

  const img = await loadImage(buf);
  console.log(`[face_node] Image loaded: ${img.width}x${img.height}`);

  let det = await faceapi
    .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  // Retry con confianzas progresivamente más bajas si no detectó rostro
  const retryLevels = [0.15, 0.05];
  for (const lvl of retryLevels) {
    if (det) break;
    console.log(`[face_node] No face at confidence ${minConfidence}, retrying at ${lvl}...`);
    det = await faceapi
      .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: lvl }))
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  if (!det || !det.descriptor) {
    console.log('[face_node] No face descriptor obtained after retries');
    return null;
  }
  console.log(`[face_node] Face detected with confidence ${det.detection.score.toFixed(3)}`);
  return Array.from(det.descriptor); // Float32Array -> number[]
}

module.exports = { init, descriptorFromBase64 };
