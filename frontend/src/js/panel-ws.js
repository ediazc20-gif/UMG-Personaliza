/**
 * Conexion al canal de panel del WebSocket, para los dashboards.
 *
 * El documento pide que "el dashboard, al igual que el tracking, mostrara la
 * informacion de ventas en tiempo real". El de supervisor se refrescaba por
 * sondeo cada 15 s y el de administrador no se refrescaba solo en absoluto.
 *
 * El canal de tracking no servia para esto porque esta indexado por codigo de
 * orden: un dashboard tendria que suscribirse a todas las ordenes, incluidas las
 * que aun no existen. El backend expone ahora un canal de panel sin clave, al
 * que solo pueden entrar administrador y supervisor.
 *
 * Uso:
 *     conectarPanelEnVivo(() => recargarMisDatos());
 */
function conectarPanelEnVivo(alCambiar, opciones = {}) {
  const { debounceMs = 700, onEstado = null } = opciones;

  let ws = null;
  let reintento = null;
  let esperaMs = 1000;
  let temporizadorDebounce = null;
  let cerradoAposta = false;

  function avisar(estado) {
    if (typeof onEstado === 'function') {
      try { onEstado(estado); } catch (_) { /* ignore */ }
    }
  }

  // Varios cambios seguidos (el avance automatico mueve varias ordenes en la
  // misma vuelta) no deben disparar una recarga por cada uno.
  function pedirRecarga() {
    clearTimeout(temporizadorDebounce);
    temporizadorDebounce = setTimeout(() => {
      try { alCambiar(); } catch (e) { console.warn('[panel] recarga fallida:', e.message); }
    }, debounceMs);
  }

  function conectar() {
    const protocolo = location.protocol === 'https:' ? 'wss:' : 'ws:';
    try {
      ws = new WebSocket(`${protocolo}//${location.host}/ws/tienda?panel=1`);
    } catch (e) {
      programarReintento();
      return;
    }

    ws.addEventListener('open', () => {
      esperaMs = 1000;
      avisar('conectado');
    });

    ws.addEventListener('message', (ev) => {
      let data;
      try { data = JSON.parse(ev.data); } catch { return; }
      if (data.type === 'panel.cambio') pedirRecarga();
      if (data.type === 'error') console.warn('[panel]', data.error);
    });

    ws.addEventListener('close', () => {
      avisar('desconectado');
      if (!cerradoAposta) programarReintento();
    });

    // El evento 'error' siempre viene seguido de 'close', que es quien reintenta.
    ws.addEventListener('error', () => { try { ws.close(); } catch (_) { /* ignore */ } });
  }

  // Reintento con espera creciente hasta 30 s, para no martillear el servidor
  // si se cae: sin esto, un backend reiniciandose recibiria una conexion por
  // segundo de cada dashboard abierto.
  function programarReintento() {
    clearTimeout(reintento);
    reintento = setTimeout(() => {
      esperaMs = Math.min(esperaMs * 2, 30000);
      conectar();
    }, esperaMs);
  }

  conectar();

  return {
    cerrar() {
      cerradoAposta = true;
      clearTimeout(reintento);
      clearTimeout(temporizadorDebounce);
      try { ws?.close(); } catch (_) { /* ignore */ }
    },
  };
}

window.conectarPanelEnVivo = conectarPanelEnVivo;
