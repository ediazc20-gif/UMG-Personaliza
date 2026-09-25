/**
 * Preferencias de notificacion del usuario.
 *
 * Notificaciones_Correo_Usuario y Notificaciones_WhatsApp_Usuario son columnas
 * `bit(1)`, y mysql2 devuelve los BIT como Buffer, no como numero. Por eso
 * `Number(valor) === 1` es SIEMPRE falso: Number(<Buffer 01>) es NaN.
 *
 * Era un fallo silencioso y caro. En routes/tienda/ordenes.js habia tres sitios
 * comparando asi (checkout, cambio de estado y entrega), de modo que el aviso
 * por WhatsApp de una orden no salia nunca, aunque el comprador lo hubiera
 * elegido y el telefono estuviera emparejado. No daba error: simplemente el
 * `if` no entraba.
 *
 * verification.js ya resolvia esto con un helper propio, pero estaba suelto
 * dentro de ese fichero y nadie mas lo veia.
 */

/**
 * ¿Esta activa esta preferencia? Acepta el Buffer de un bit(1), y tambien
 * numero, booleano o cadena, por si alguna consulta la castea antes.
 */
function notificacionActiva(valor) {
  if (valor === null || valor === undefined) return false;
  if (Buffer.isBuffer(valor)) return valor[0] === 1;
  if (typeof valor === 'boolean') return valor;
  if (typeof valor === 'number') return valor === 1;
  // 'on' es lo que manda un checkbox HTML marcado.
  if (typeof valor === 'string') return ['1', 'true', 'on'].includes(valor.trim().toLowerCase());
  // Objetos tipo array de bytes que no son Buffer.
  return valor?.[0] === 1;
}

module.exports = { notificacionActiva };
