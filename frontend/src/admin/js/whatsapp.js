(function() {
  const container = document.getElementById('section-container');
  if (!container) return;

  let pollInterval = null;

  async function loadWhatsAppView() {
    container.innerHTML = `
      <div style="max-width:920px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
          <div>
            <h3 style="margin:0 0 4px;font-family:var(--font-display,serif);font-size:1.6rem;color:var(--ink);">
              <i class="fa-brands fa-whatsapp" style="color:#25D366;margin-right:8px;"></i> Servidor de WhatsApp Open Source
            </h3>
            <p style="margin:0;font-size:0.9rem;color:var(--ink-mute);">
              Conexión directa vía Baileys Multi-Device. Envío gratuito de credenciales PDF, códigos OTP y alertas de pedidos.
            </p>
          </div>
          <div style="display:flex;gap:8px;">
            <button id="btnRefreshStatus" class="btn-ghost-glass" style="padding:8px 14px;font-size:0.85rem;">
              <i class="fa-solid fa-rotate"></i> Actualizar
            </button>
            <button id="btnRestartSession" class="btn-ghost-glass" style="padding:8px 14px;font-size:0.85rem;color:#b91c1c;">
              <i class="fa-solid fa-power-off"></i> Reiniciar sesión
            </button>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:20px;">
          <!-- Estado y Código QR -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;">
            <h4 style="font-size:1.1rem;margin:0 0 16px;display:flex;align-items:center;gap:8px;color:var(--ink);">
              <i class="fa-solid fa-satellite-dish" style="color:var(--primary);"></i> Estado del servicio
            </h4>

            <div id="waStatusBox" style="margin-bottom:16px;padding:14px;border-radius:var(--radius-md);background:var(--surface-muted);border:1px solid var(--line);">
              <div style="display:flex;align-items:center;gap:10px;">
                <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
                <span style="font-size:0.9rem;color:var(--ink-mute);">Consultando estado del servidor...</span>
              </div>
            </div>

            <div id="waQrContainer" style="text-align:center;display:none;padding:16px;background:var(--surface-muted);border-radius:var(--radius-md);border:1px dashed var(--line);">
              <p style="font-size:0.85rem;font-weight:600;color:var(--ink);margin:0 0 12px;">
                <i class="fa-solid fa-qrcode"></i> Escanea este código desde WhatsApp en tu celular:
              </p>
              <div id="waQrImageWrap" style="display:inline-block;padding:12px;background:#ffffff;border-radius:12px;box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                <img id="waQrImage" src="" alt="Código QR WhatsApp" style="width:200px;height:200px;display:block;" />
              </div>
              <p style="font-size:0.75rem;color:var(--ink-mute);margin:10px 0 0;">
                Abre WhatsApp > Dispositivos vinculados > Vincular un dispositivo.
              </p>
            </div>

            <div id="waConnectedDetails" style="display:none;padding:14px;border-radius:var(--radius-md);background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.25);">
              <p style="font-weight:600;color:#166534;margin:0 0 4px;font-size:0.95rem;">
                <i class="fa-solid fa-circle-check"></i> Dispositivo vinculado activamente
              </p>
              <p style="font-size:0.825rem;color:var(--ink-mute);margin:0;" id="waUserDisplay">
                El bot está listo para enviar notificaciones automáticas.
              </p>
            </div>
          </div>

          <!-- Prueba de envío -->
          <div class="glass-card" style="background:var(--surface);border:1px solid var(--line);border-radius:var(--radius-lg);padding:24px;">
            <h4 style="font-size:1.1rem;margin:0 0 16px;display:flex;align-items:center;gap:8px;color:var(--ink);">
              <i class="fa-solid fa-paper-plane" style="color:var(--primary);"></i> Enviar mensaje de prueba
            </h4>

            <form id="waTestForm" style="display:flex;flex-direction:column;gap:14px;">
              <div>
                <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--ink-mute);margin-bottom:4px;">
                  Número de WhatsApp (8 dígitos Guatemala o internacional):
                </label>
                <div style="position:relative;">
                  <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:0.85rem;color:var(--ink-mute);">+502</span>
                  <input type="text" id="waTestPhone" class="form-control" placeholder="Ej: 55443322" style="padding-left:54px;border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface-muted);color:var(--ink);" required />
                </div>
              </div>

              <div>
                <label style="display:block;font-size:0.8rem;font-weight:600;color:var(--ink-mute);margin-bottom:4px;">
                  Mensaje de prueba:
                </label>
                <textarea id="waTestMsg" class="form-control" rows="3" style="border-radius:var(--radius-sm);border:1px solid var(--line);background:var(--surface-muted);color:var(--ink);" required>¡Hola! Este es un mensaje de prueba enviado desde UMG Personaliza con el servidor Open Source de WhatsApp.</textarea>
              </div>

              <div id="waTestAlert" style="display:none;padding:10px 14px;border-radius:var(--radius-sm);font-size:0.85rem;"></div>

              <button type="submit" id="btnSendTest" class="btn-glass" style="padding:10px 18px;justify-content:center;">
                <i class="fa-solid fa-paper-plane"></i> Enviar WhatsApp
              </button>
            </form>

            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line);">
              <p style="font-size:0.8rem;color:var(--ink-mute);margin:0;line-height:1.4;">
                <i class="fa-solid fa-circle-info" style="color:var(--primary);"></i> <strong>Ventajas del módulo Open Source:</strong> No requiere suscripción a Twilio, no requiere verificación de Meta, no requiere saldo en dólares y permite adjuntar credenciales PDF generadas al instante.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btnRefreshStatus')?.addEventListener('click', checkStatus);
    document.getElementById('btnRestartSession')?.addEventListener('click', handleRestartSession);
    document.getElementById('waTestForm')?.addEventListener('submit', handleSendTest);

    await checkStatus();
    startPolling();
  }

  async function checkStatus() {
    const statusBox = document.getElementById('waStatusBox');
    const qrContainer = document.getElementById('waQrContainer');
    const qrImage = document.getElementById('waQrImage');
    const connectedDetails = document.getElementById('waConnectedDetails');
    const userDisplay = document.getElementById('waUserDisplay');
    if (!statusBox) return;

    try {
      const res = await fetch('/api/whatsapp/status', { credentials: 'include' });
      const data = await res.json();
      const status = data.status || {};

      if (status.connected) {
        statusBox.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#22c55e;"></span>
            <strong style="color:#166534;font-size:0.95rem;">WhatsApp Conectado y Listo</strong>
          </div>
        `;
        if (qrContainer) qrContainer.style.display = 'none';
        if (connectedDetails) {
          connectedDetails.style.display = 'block';
          if (userDisplay) {
            userDisplay.textContent = `Sesión activa con el ID: ${status.user?.id || 'Dispositivo vinculado'}`;
          }
        }
      } else if (status.qrDataUrl) {
        statusBox.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f59e0b;"></span>
            <strong style="color:#b45309;font-size:0.95rem;">Esperando escaneo de código QR</strong>
          </div>
        `;
        if (connectedDetails) connectedDetails.style.display = 'none';
        if (qrContainer && qrImage) {
          qrContainer.style.display = 'block';
          qrImage.src = status.qrDataUrl;
        }
      } else {
        statusBox.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            <span style="color:var(--ink-mute);font-size:0.9rem;">Generando código QR de conexión...</span>
          </div>
        `;
        if (connectedDetails) connectedDetails.style.display = 'none';
      }
    } catch (err) {
      statusBox.innerHTML = `
        <div style="color:#b91c1c;font-size:0.9rem;">
          <i class="fa-solid fa-circle-exclamation"></i> Error al consultar estado: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(checkStatus, 5000);
  }

  async function handleRestartSession() {
    if (!confirm('¿Deseas reiniciar la sesión de WhatsApp y generar un nuevo código QR?')) return;
    try {
      const res = await fetch('/api/whatsapp/restart', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      alert(data.message || 'Sesión reiniciada.');
      await checkStatus();
    } catch (err) {
      alert('Error al reiniciar: ' + err.message);
    }
  }

  async function handleSendTest(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('waTestPhone');
    const msgInput = document.getElementById('waTestMsg');
    const alertBox = document.getElementById('waTestAlert');
    const btnSend = document.getElementById('btnSendTest');

    if (!phoneInput || !msgInput || !alertBox || !btnSend) return;

    btnSend.disabled = true;
    btnSend.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
    alertBox.style.display = 'none';

    try {
      let rawPhone = phoneInput.value.trim();
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: rawPhone,
          message: msgInput.value.trim()
        })
      });
      const data = await res.json();

      if (data.ok) {
        alertBox.className = 'alert-success';
        alertBox.style.background = 'rgba(34, 197, 94, 0.12)';
        alertBox.style.color = '#166534';
        alertBox.style.border = '1px solid rgba(34, 197, 94, 0.3)';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<i class="fa-solid fa-check"></i> Mensaje enviado con éxito a <strong>${escapeHtml(data.to || rawPhone)}</strong> (${escapeHtml(data.provider || 'WhatsApp')}).`;
      } else {
        alertBox.className = 'alert-danger';
        alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
        alertBox.style.color = '#991b1b';
        alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
        alertBox.style.display = 'block';
        alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(data.error || 'No se pudo enviar el mensaje')}`;
      }
    } catch (err) {
      alertBox.className = 'alert-danger';
      alertBox.style.background = 'rgba(239, 68, 68, 0.12)';
      alertBox.style.color = '#991b1b';
      alertBox.style.border = '1px solid rgba(239, 68, 68, 0.3)';
      alertBox.style.display = 'block';
      alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error de red: ${escapeHtml(err.message)}`;
    } finally {
      btnSend.disabled = false;
      btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar WhatsApp';
    }
  }

  loadWhatsAppView();
})();
