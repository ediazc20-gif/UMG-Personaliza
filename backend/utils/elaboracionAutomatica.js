/**
 * Avance automatico de la elaboracion del pedido.
 *
 * El documento lo pide asi: "A partir de la generacion de la orden de compra, se
 * tomara con un tiempo aceptable para la elaboracion del producto un tiempo
 * maximo de 60 segundos", y ademas: "La ultima etapa o step del tracking
 * consistira en el estado: 'Listo para entrega'".
 *
 * Hasta ahora no existia: los estados solo avanzaban si alguien pulsaba el boton
 * en el panel. Eso incumplia el requisito y, sobre todo, hacia que el tracking en
 * vivo y el dashboard "en tiempo real" se vieran muertos en la presentacion, que
 * es justo donde se califican.
 *
 * El recorrido automatico es:
 *
 *     recibida  --(15 s)-->  en_elaboracion  --(60 s desde la creacion)-->  lista_entrega
 *
 * y ahi se detiene. De 'lista_entrega' en adelante manda una persona: el
 * repartidor entrega, o marca que no encontro al comprador. El automata nunca
 * da una orden por entregada sola.
 */

const { queryLocal } = require('../database');
const { broadcastOrdenEstado } = require('./tiendaWs');
const { validarTransicionAutomata } = require('./ordenAutomata');

const ACTIVO = process.env.ELABORACION_AUTOMATICA !== 'false';
const CADA_MS = Number(process.env.ELABORACION_INTERVALO_MS || 5000);
const A_ELABORACION_SEG = Number(process.env.ELABORACION_INICIO_SEG || 15);
const A_LISTA_SEG = Number(process.env.ELABORACION_TOTAL_SEG || 60);

// El sistema actua con permisos de administrador: es quien mueve la orden, no
// un usuario con sesion. El automata lo acepta en todas las transiciones.
const ROL_SISTEMA = 'ADMINISTRADOR';

let temporizador = null;
// Si una vuelta tarda mas que el intervalo, la siguiente no debe solaparse y
// procesar dos veces la misma orden.
let enCurso = false;

/**
 * Ordenes que llevan al menos `segundos` desde su creacion y siguen en `estado`.
 *
 * Se excluyen a proposito las que esperan cobro con tarjeta: una orden cuyo pago
 * no ha confirmado la pasarela no debe entrar en produccion. Las de efectivo
 * tienen estado_pago 'no_aplica' y si avanzan, que para eso se cobra al entregar.
 */
async function ordenesMaduras(estado, segundos) {
  return queryLocal(
    `SELECT id, codigo, estado
       FROM ordenes
      WHERE estado = ?
        AND estado_pago <> 'pendiente'
        AND creado <= (NOW() - INTERVAL ? SECOND)
      LIMIT 50`,
    [estado, segundos]
  );
}

async function avanzar(orden, nuevoEstado, nota) {
  // Se vuelve a validar contra el automata aunque la consulta ya filtre por
  // estado: si alguien cambia la orden a mano entre la consulta y este punto,
  // la transicion deja de ser legal y no debe aplicarse.
  const validacion = validarTransicionAutomata(orden.estado, nuevoEstado, ROL_SISTEMA);
  if (!validacion.valido || validacion.sinCambio) return false;

  await queryLocal(`UPDATE ordenes SET estado = ? WHERE id = ? AND estado = ?`, [
    nuevoEstado,
    orden.id,
    orden.estado,
  ]);
  await queryLocal(`INSERT INTO orden_estado_log (id_orden, estado, nota) VALUES (?, ?, ?)`, [
    orden.id,
    nuevoEstado,
    nota,
  ]);

  // Esto es lo que hace que el tracking del comprador se mueva solo en pantalla.
  broadcastOrdenEstado({ codigo: orden.codigo, estado: nuevoEstado, nota });
  console.log(`[elaboracion] ${orden.codigo}: ${orden.estado} -> ${nuevoEstado}`);
  return true;
}

async function unaVuelta() {
  if (enCurso) return;
  enCurso = true;
  try {
    for (const orden of await ordenesMaduras('recibida', A_ELABORACION_SEG)) {
      await avanzar(orden, 'en_elaboracion', 'El taller empezo a elaborar tu pedido');
    }
    for (const orden of await ordenesMaduras('en_elaboracion', A_LISTA_SEG)) {
      await avanzar(orden, 'lista_entrega', 'Tu pedido esta listo para entrega');
    }
  } catch (err) {
    // Un fallo puntual (la base reiniciandose, por ejemplo) no debe matar el
    // temporizador: la siguiente vuelta lo reintenta.
    console.error('[elaboracion] error en la vuelta:', err.message);
  } finally {
    enCurso = false;
  }
}

function iniciarElaboracionAutomatica() {
  if (!ACTIVO) {
    console.log('[elaboracion] avance automatico desactivado (ELABORACION_AUTOMATICA=false)');
    return null;
  }
  if (temporizador) return temporizador;

  temporizador = setInterval(unaVuelta, CADA_MS);
  // Sin unref, este temporizador mantendria vivo el proceso e impediria que
  // Node se cerrara limpiamente.
  temporizador.unref?.();

  console.log(
    `[elaboracion] avance automatico activo: recibida -> en_elaboracion a los ${A_ELABORACION_SEG} s, ` +
    `-> lista_entrega a los ${A_LISTA_SEG} s, revisando cada ${CADA_MS / 1000} s`
  );
  return temporizador;
}

function detenerElaboracionAutomatica() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
}

module.exports = { iniciarElaboracionAutomatica, detenerElaboracionAutomatica, unaVuelta };
