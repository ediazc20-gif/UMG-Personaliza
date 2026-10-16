const API_BASE = 'https://app.recurrente.com/api';

function secretKey() {
  return (process.env.RECURRENTE_SECRET_KEY || '').trim();
}

function isRecurrenteEnabled() {
  return secretKey().length > 0;
}

function publicBaseUrl() {
  return (
    process.env.PUBLIC_BASE_URL ||
    process.env.PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    'http://localhost:8081'
  ).replace(/\/$/, '');
}

async function recurrenteFetch(path, options = {}) {
  const key = secretKey();
  if (!key) {
    const err = new Error('Recurrente no está configurado (RECURRENTE_SECRET_KEY).');
    err.code = 'RECURRENTE_NOT_CONFIGURED';
    throw err;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-SECRET-KEY': key,
      ...(options.headers || {}),
    },
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const msg = data.message || data.error || data.detail || `Recurrente HTTP ${res.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

/**
 * @param {{ codigo: string, totalQ: number, uid: number }} params
 */
async function createCheckoutForOrden({ codigo, totalQ, uid }) {
  const amountCents = Math.max(500, Math.round(Number(totalQ) * 100));
  const base = publicBaseUrl();
  const successUrl = `${base}/comprador/pago-recurrente.html?codigo=${encodeURIComponent(codigo)}`;
  const cancelUrl = `${base}/comprador/checkout.html?pago=cancelado`;

  const body = {
    items: [
      {
        name: `Pedido ${codigo} — UMG Personaliza`,
        amount_in_cents: amountCents,
        currency: 'GTQ',
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orden_codigo: codigo,
      id_usuario: String(uid),
    },
  };

  const data = await recurrenteFetch('/checkouts', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const checkoutId = data.id || data.checkout_id;
  const checkoutUrl = data.checkout_url || data.url;
  if (!checkoutId || !checkoutUrl) {
    throw new Error('Recurrente no devolvió checkout_url.');
  }
  return { checkoutId, checkoutUrl, raw: data };
}

async function getCheckout(checkoutId) {
  if (!checkoutId) throw new Error('checkout_id requerido');
  return recurrenteFetch(`/checkouts/${encodeURIComponent(checkoutId)}`, { method: 'GET' });
}

module.exports = {
  isRecurrenteEnabled,
  publicBaseUrl,
  createCheckoutForOrden,
  getCheckout,
};
