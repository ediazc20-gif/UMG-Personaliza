/**
 * Cliente de la pasarela de pagos Recurrente (https://recurrente.com).
 *
 * Se usa el "checkout alojado": nosotros creamos el cobro desde el backend y
 * mandamos al comprador a la pagina de Recurrente, que es quien pide y guarda
 * los datos de la tarjeta. El numero de tarjeta NUNCA pasa por este servidor ni
 * por nuestro formulario; esa es la parte "de forma segura" que pide el
 * documento del curso, y ademas nos deja fuera del alcance de PCI-DSS.
 *
 * QUEDA PENDIENTE PARA QUIEN TENGA LA CUENTA: rellenar en el .env
 *
 *     RECURRENTE_PUBLIC_KEY=...
 *     RECURRENTE_SECRET_KEY=...
 *
 * Las claves salen de la cuenta de Recurrente en Ajustes -> API Keys. Existe un
 * entorno Sandbox con claves de prueba y saldos simulados: se puede probar el
 * ciclo completo sin dinero real y SIN usar una tarjeta propia. Empezad por ahi.
 *
 * Mientras las claves esten vacias, isConfigured() devuelve false y el checkout
 * rechaza el pago con tarjeta con un mensaje claro en vez de fingir que se
 * cobro, que es lo que hacia el codigo anterior con su `MOCK-RCC-<hora>`.
 */

const API_BASE = (process.env.RECURRENTE_API_BASE || 'https://app.recurrente.com/api').replace(/\/+$/, '');
const PUBLIC_KEY = (process.env.RECURRENTE_PUBLIC_KEY || '').trim();
const SECRET_KEY = (process.env.RECURRENTE_SECRET_KEY || '').trim();
const TIMEOUT_MS = Number(process.env.RECURRENTE_TIMEOUT_MS || 15000);

// Minimos que impone la pasarela por moneda, en centavos.
const MINIMOS_POR_MONEDA = { GTQ: 500, USD: 100 };

function isConfigured() {
  return Boolean(SECRET_KEY);
}

/**
 * La documentacion publica de Recurrente muestra la autenticacion con
 * X-SECRET-KEY. Algunas guias mencionan tambien X-PUBLIC-KEY, asi que se manda
 * la publica cuando esta definida: si la pasarela la ignora no molesta, y si la
 * exige, ya va puesta. Si al integrar resulta que sobra, se quita esta linea.
 */
function authHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-SECRET-KEY': SECRET_KEY,
  };
  if (PUBLIC_KEY) headers['X-PUBLIC-KEY'] = PUBLIC_KEY;
  return headers;
}

/**
 * Convierte los articulos del carrito al formato que espera la pasarela.
 * Los precios se guardan en quetzales con dos decimales y Recurrente los quiere
 * en centavos enteros, de ahi el redondeo explicito: un Number con decimales
 * mandaria un importe invalido.
 */
function mapItems(items, moneda) {
  return items.map((item) => ({
    name: String(item.nombre || item.nombre_producto || 'Articulo personalizado').slice(0, 120),
    amount_in_cents: Math.round(Number(item.precio_unitario) * 100),
    currency: moneda,
    quantity: Number(item.cantidad) || 1,
  }));
}

function validarMinimo(items, moneda) {
  const minimo = MINIMOS_POR_MONEDA[moneda];
  if (!minimo) return `Moneda no soportada por la pasarela: ${moneda}.`;
  const total = items.reduce((acc, i) => acc + i.amount_in_cents * i.quantity, 0);
  if (total < minimo) {
    return `El total es inferior al minimo que acepta la pasarela (${(minimo / 100).toFixed(2)} ${moneda}).`;
  }
  return null;
}

/**
 * Crea un checkout alojado y devuelve a donde hay que mandar al comprador.
 *
 * @returns {Promise<{ok: true, checkoutId: string, checkoutUrl: string} | {ok: false, error: string}>}
 */
async function crearCheckout({ items, moneda = 'GTQ', successUrl, cancelUrl }) {
  if (!isConfigured()) {
    return {
      ok: false,
      error: 'El pago con tarjeta no esta disponible: falta configurar RECURRENTE_SECRET_KEY en el servidor.',
    };
  }
  if (!Array.isArray(items) || !items.length) {
    return { ok: false, error: 'No hay articulos que cobrar.' };
  }

  const payload = {
    items: mapItems(items, moneda),
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  const problema = validarMinimo(payload.items, moneda);
  if (problema) return { ok: false, error: problema };

  // Sin timeout, una pasarela que no responde deja colgado el checkout entero y
  // con el la conexion de base de datos que el handler tiene abierta.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}/checkouts`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: abort.signal,
    });

    const texto = await res.text();
    let data = {};
    try { data = texto ? JSON.parse(texto) : {}; } catch { /* respuesta no JSON */ }

    if (!res.ok) {
      // El detalle va al log del servidor; al comprador solo un mensaje neutro,
      // porque la respuesta de la pasarela puede traer datos de la cuenta.
      console.error('[recurrente] checkout rechazado', res.status, texto.slice(0, 500));
      return { ok: false, error: data.error || 'La pasarela de pagos rechazo la solicitud.' };
    }

    const checkoutUrl = data.checkout_url || data.url || null;
    const checkoutId = data.id || data.checkout_id || null;

    if (!checkoutUrl || !checkoutId) {
      console.error('[recurrente] respuesta sin checkout_url/id', texto.slice(0, 500));
      return { ok: false, error: 'La pasarela no devolvio una URL de pago valida.' };
    }

    return { ok: true, checkoutId: String(checkoutId), checkoutUrl: String(checkoutUrl) };
  } catch (err) {
    const motivo = err.name === 'AbortError'
      ? `La pasarela no respondio en ${TIMEOUT_MS / 1000} s.`
      : 'No se pudo contactar con la pasarela de pagos.';
    console.error('[recurrente] error de red:', err.message);
    return { ok: false, error: motivo };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Nombres de evento que manda Recurrente por webhook y que nos interesan.
 * La lista completa incluye ademas los de suscripciones, que este proyecto no
 * usa (subscription.create, subscription.past_due, subscription.cancel).
 */
const EVENTOS = {
  PAGO_OK: 'payment_intent.succeeded',
  PAGO_FALLIDO: 'payment_intent.failed',
};

module.exports = { isConfigured, crearCheckout, EVENTOS, API_BASE };
