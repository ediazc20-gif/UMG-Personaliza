/**
 * Máquina de Estados Finita (FSM) para el ciclo de vida de Órdenes y Envíos
 * Define los estados formales, transiciones legales y permisos por rol.
 */

const ESTADOS_VALIDOS = {
  RECIBIDA: 'recibida',
  EN_ELABORACION: 'en_elaboracion',
  EN_RUTA: 'en_ruta',
  LISTA_ENTREGA: 'lista_entrega',
  ENTREGADA: 'entregada',
  CANCELADA: 'cancelada',
  NO_ENCONTRADO: 'no_encontrado'
};

const LABELS_ESTADOS = {
  recibida: 'Recibida',
  en_elaboracion: 'En elaboración / taller',
  en_ruta: 'En ruta con repartidor',
  lista_entrega: 'Lista para entrega en punto',
  entregada: 'Entregada con éxito',
  cancelada: 'Cancelada',
  no_encontrado: 'No encontrado / Reintento'
};

/**
 * Tabla de Transiciones del Autómata:
 * Cada estado lista los únicos estados a los que puede transitar (aristas dirigidas del grafo)
 * y los roles que pueden accionar dicho cambio.
 */
const MAQUINA_ESTADOS = {
  recibida: {
    transicionesPermitidas: ['en_elaboracion', 'cancelada'],
    rolesPermitidos: ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'COMPRADOR'],
    descripcion: 'Pedido recibido y registrado en sistema.'
  },
  en_elaboracion: {
    transicionesPermitidas: ['en_ruta', 'lista_entrega', 'cancelada'],
    rolesPermitidos: ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR'],
    descripcion: 'En proceso de fabricación/estampado en taller.'
  },
  en_ruta: {
    transicionesPermitidas: ['entregada', 'no_encontrado', 'cancelada'],
    rolesPermitidos: ['ADMIN', 'ADMINISTRADOR', 'REPARTIDOR'],
    descripcion: 'El repartidor lleva el paquete hacia el punto del campus.'
  },
  lista_entrega: {
    transicionesPermitidas: ['entregada', 'no_encontrado', 'cancelada'],
    rolesPermitidos: ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'REPARTIDOR'],
    descripcion: 'Listo para retiro en recepción/punto de entrega.'
  },
  no_encontrado: {
    transicionesPermitidas: ['en_ruta', 'cancelada'],
    rolesPermitidos: ['ADMIN', 'ADMINISTRADOR', 'SUPERVISOR', 'REPARTIDOR'],
    descripcion: 'El cliente no se encontraba; pendiente reintento o retorno.'
  },
  entregada: {
    transicionesPermitidas: [], // Estado Final / Terminal
    rolesPermitidos: [],
    descripcion: 'Orden completada y firmada.'
  },
  cancelada: {
    transicionesPermitidas: [], // Estado Final / Terminal
    rolesPermitidos: [],
    descripcion: 'Orden cancelada.'
  }
};

/**
 * Valida si la transición solicitada es legal según el autómata y rol del actor.
 */
function validarTransicionAutomata(estadoActual, nuevoEstado, rolUsuario) {
  if (!estadoActual || !MAQUINA_ESTADOS[estadoActual]) {
    return {
      valido: false,
      error: `Estado actual desconocido: '${estadoActual}'`
    };
  }

  if (estadoActual === nuevoEstado) {
    return { valido: true, sinCambio: true };
  }

  const nodo = MAQUINA_ESTADOS[estadoActual];

  // 1. Validar si el estado actual es terminal
  if (nodo.transicionesPermitidas.length === 0) {
    return {
      valido: false,
      error: `La orden ya está en estado final '${LABELS_ESTADOS[estadoActual] || estadoActual}' y no admite más cambios.`
    };
  }

  // 2. Validar si la transición es permitida en el grafo del autómata
  if (!nodo.transicionesPermitidas.includes(nuevoEstado)) {
    const validasStr = nodo.transicionesPermitidas.map(s => `'${LABELS_ESTADOS[s] || s}'`).join(', ');
    return {
      valido: false,
      error: `Transición inválida: No se puede cambiar de '${LABELS_ESTADOS[estadoActual] || estadoActual}' a '${LABELS_ESTADOS[nuevoEstado] || nuevoEstado}'. Solo se permite: ${validasStr}.`
    };
  }

  // 3. Validar permisos por rol
  const rolUpper = String(rolUsuario || '').toUpperCase();
  if (rolUpper !== 'ADMIN' && rolUpper !== 'ADMINISTRADOR') {
    if (!nodo.rolesPermitidos.includes(rolUpper)) {
      return {
        valido: false,
        error: `El rol '${rolUsuario}' no tiene autorización para realizar la transición de '${estadoActual}' a '${nuevoEstado}'.`
      };
    }
  }

  return {
    valido: true,
    estadoAnterior: estadoActual,
    nuevoEstado,
    descripcion: MAQUINA_ESTADOS[nuevoEstado]?.descripcion || ''
  };
}

/**
 * Retorna las opciones válidas a las que puede pasar una orden en base a su estado actual
 */
function getSiguientesEstadosPermitidos(estadoActual) {
  const nodo = MAQUINA_ESTADOS[estadoActual];
  if (!nodo) return [];
  return nodo.transicionesPermitidas.map(key => ({
    valor: key,
    label: LABELS_ESTADOS[key] || key
  }));
}

module.exports = {
  ESTADOS_VALIDOS,
  LABELS_ESTADOS,
  MAQUINA_ESTADOS,
  validarTransicionAutomata,
  getSiguientesEstadosPermitidos
};
