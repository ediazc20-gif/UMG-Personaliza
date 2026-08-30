// ui.js — Helpers de UI, alertas, estado de sesión y navegación de tabs

function showLoadingMessage(show) {
  const el = document.getElementById('loading-message');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
}

function showCustomAlert(message) {
  const alertBox = document.getElementById('custom-alert');
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
}

function notifyUser(message, isError = false) {
  const el = document.getElementById('recognition-result');
  if (!el) return;
  el.style.display = 'block';
  el.style.color = isError ? 'red' : 'green';
  el.style.fontWeight = 'bold';
  el.style.fontSize = '20px';
  el.style.backgroundColor = isError ? '#ffcccc' : '#ccffcc';
  el.style.padding = '10px';
  el.style.borderRadius = '5px';
  el.style.border = `2px solid ${isError ? 'red' : 'green'}`;
  el.textContent = message;
}

function hideEmpresaForm() {
  const el = document.getElementById('empresa-selection');
  if (el) el.style.display = 'none';
}

function refreshAuthUI() {
  // No-op: el redirect post-login se maneja en auth.js
}

// Carga de roles en el select (registro)
document.addEventListener('DOMContentLoaded', function () {
  fetch('/api/roles')
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const select = document.getElementById('rolSelect');
      if (!select) return;
      select.innerHTML = '<option value="">Seleccione un rol</option>';
      data.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r.nombre;
        opt.textContent = r.nombre;
        select.appendChild(opt);
      });
    })
    .catch(err => console.error('Error cargando roles:', err));

  refreshAuthUI();
});

// Exponer globalmente
window.showLoadingMessage = showLoadingMessage;
window.showCustomAlert = showCustomAlert;
window.notifyUser = notifyUser;
window.hideEmpresaForm = hideEmpresaForm;
window.refreshAuthUI = refreshAuthUI;
