const { queryCentralP } = require('../database');

/**
 * Registra un evento de auditoría en la base de datos central de forma segura.
 * @param {Object} params
 * @param {number|null} params.id_usuario - ID del usuario que ejecuta la acción
 * @param {string} params.accion - Código de acción (ej: 'COMPRA_TIENDA', 'ENTREGA_ORDEN', 'UPDATE_PRODUCTO')
 * @param {string} params.descripcion - Detalle legible del evento
 * @param {string} [params.ip_origen] - IP de procedencia
 * @param {string} [params.indice] - Índice o módulo ('TIENDA', 'ADM-TIENDA', 'LOGISTICA')
 */
async function registrarAuditoria({ id_usuario, accion, descripcion, ip_origen = '::1', indice = 'TIENDA' }) {
  try {
    await queryCentralP(
      `INSERT INTO auditoria 
       (id_usuario, accion, descripcion, ip_origen, fecha_evento, indice_accion)
       VALUES (?, ?, ?, ?, NOW(), ?)`,
      [id_usuario || null, accion, descripcion, ip_origen || '::1', indice]
    );
  } catch (err) {
    console.warn('[Auditoria Warning] No se pudo registrar log:', err.message);
  }
}

module.exports = { registrarAuditoria };
