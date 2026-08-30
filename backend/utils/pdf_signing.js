const axios = require('axios');

async function signPdfBuffer(buffer) {
  const signingServiceUrl = process.env.SIGNING_SERVICE_URL;
  const signingRequired = String(process.env.SIGNING_REQUIRED || 'false').toLowerCase() === 'true';

  // Si no está explícitamente requerido o no hay URL, continuar de inmediato con el PDF estándar
  if (!signingServiceUrl || !signingRequired) {
    return { signed: false, buffer };
  }

  const endpoint = `${signingServiceUrl.replace(/\/+$/, '')}/sign-pdf`;
  const headers = {};
  if (process.env.SIGNING_SERVICE_API_KEY) {
    headers.Authorization = `Bearer ${process.env.SIGNING_SERVICE_API_KEY}`;
  }

  const payload = {
    pdfBase64: Buffer.from(buffer).toString('base64'),
    reason: process.env.SIGNING_REASON || 'Firma credencial UMG',
    location: process.env.SIGNING_LOCATION || 'Guatemala',
  };

  try {
    const { data } = await axios.post(endpoint, payload, {
      headers,
      timeout: Number(process.env.SIGNING_TIMEOUT_MS || 3000),
    });

    if (data?.signedPdfBase64) {
      return {
        signed: true,
        buffer: Buffer.from(data.signedPdfBase64, 'base64'),
        provider: data.provider || 'RemoteSigner',
      };
    }
  } catch (error) {
    console.warn('⚠️ [pdf_signing] Firma remota no disponible, se conserva PDF estándar:', error.message);
  }

  return { signed: false, buffer };
}

module.exports = { signPdfBuffer };
