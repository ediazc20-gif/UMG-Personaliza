const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY || '';
const ALLOW_SKIP =
  process.env.RECAPTCHA_SKIP === 'true' ||
  (process.env.NODE_ENV !== 'production' && !RECAPTCHA_SECRET);

async function verifyRecaptcha(token, remoteIp) {
  if (!RECAPTCHA_SECRET) {
    if (ALLOW_SKIP) {
      return { ok: true, skipped: true };
    }
    return {
      ok: false,
      error: 'reCAPTCHA no configurado en el servidor. Define RECAPTCHA_SECRET_KEY o RECAPTCHA_SKIP=true solo en desarrollo.',
    };
  }
  if (!token) {
    return { ok: false, error: 'Completa la verificacion reCAPTCHA.' };
  }
  const params = new URLSearchParams({
    secret: RECAPTCHA_SECRET,
    response: token,
  });
  if (remoteIp) params.set('remoteip', remoteIp);

  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json();
  if (!data.success) {
    return { ok: false, error: 'reCAPTCHA invalido. Intenta de nuevo.' };
  }
  return { ok: true };
}

module.exports = { verifyRecaptcha };
