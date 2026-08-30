// auth-password-toggle.js — Mostrar/ocultar contraseña (login + registro)

(function () {
  const SELECTORS = [
    '#lc-contrasena',
    '#contrasena',
    '#confirmar_contrasena',
  ];

  function wireToggleButton(input, btn) {
    if (!input || !btn || btn.dataset.pwWired === '1') return;
    btn.dataset.pwWired = '1';

    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });

    btn.addEventListener('click', () => {
      const hidden = input.type === 'password';
      input.type = hidden ? 'text' : 'password';
      btn.setAttribute('aria-label', hidden ? 'Ocultar contraseña' : 'Mostrar contraseña');
      btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
      const icon = btn.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-eye', !hidden);
        icon.classList.toggle('fa-eye-slash', hidden);
      }
    });
  }

  function enhancePasswordField(input) {
    if (!input) return;

    let wrap = input.parentElement;
    if (!wrap?.classList.contains('field-input-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'field-input-wrap field-input-wrap--password';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
    } else {
      wrap.classList.add('field-input-wrap--password');
    }

    input.classList.add('field-input--password');

    let btn = wrap.querySelector('.field-toggle-pw');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'field-toggle-pw';
      btn.setAttribute('aria-label', 'Mostrar contraseña');
      btn.setAttribute('aria-pressed', 'false');
      btn.tabIndex = -1;
      btn.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
      wrap.appendChild(btn);
    }

    wireToggleButton(input, btn);
  }

  function init() {
    SELECTORS.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) enhancePasswordField(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
