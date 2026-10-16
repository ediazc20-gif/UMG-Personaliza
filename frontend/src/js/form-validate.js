/**
 * Validación nativa del navegador (globo "Completa este campo") en campos obligatorios.
 * Trata espacios en blanco como vacío en textos.
 */
(function (global) {
  const MSG = 'Completa este campo.';

  function isTextLikeControl(el) {
    if (!el || el.disabled) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'SELECT') return true;
    if (tag !== 'INPUT') return false;
    const type = (el.type || 'text').toLowerCase();
    return !['hidden', 'submit', 'button', 'file', 'radio', 'checkbox', 'range', 'color'].includes(type);
  }

  function prepareControl(el) {
    if (!el || !el.hasAttribute('required')) return;
    if (!isTextLikeControl(el)) return;
    el.setCustomValidity('');
    const empty = el.tagName === 'SELECT'
      ? !String(el.value || '').trim()
      : !String(el.value || '').trim();
    if (empty) el.setCustomValidity(MSG);
  }

  function prepareForm(form) {
    if (!form) return;
    form.querySelectorAll('input, textarea, select').forEach(prepareControl);
  }

  function validateControl(el, { report = true, focus = true } = {}) {
    if (!el) return true;
    prepareControl(el);
    const ok = el.checkValidity();
    if (!ok) {
      if (focus) el.focus();
      if (report) el.reportValidity();
    }
    return ok;
  }

  function validateForm(form, { report = true, focus = true } = {}) {
    if (!form) return true;
    prepareForm(form);
    const ok = form.checkValidity();
    if (!ok) {
      const first = form.querySelector(':invalid');
      if (focus && first) first.focus();
      if (report) form.reportValidity();
    }
    return ok;
  }

  function bindForm(form) {
    if (!form || form.dataset.umgValidateBound === '1') return;
    form.dataset.umgValidateBound = '1';
    if (!form.hasAttribute('novalidate')) form.setAttribute('novalidate', '');
    form.addEventListener(
      'input',
      (e) => {
        const t = e.target;
        if (
          t instanceof HTMLInputElement ||
          t instanceof HTMLTextAreaElement ||
          t instanceof HTMLSelectElement
        ) {
          if (t.validity.customError) {
            t.setCustomValidity('');
          }
        }
      },
      true
    );
  }

  function scanForms(root) {
    (root || document).querySelectorAll('form').forEach(bindForm);
  }

  function onSubmitCapture(e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.dataset.skipNativeValidate !== undefined) return;
    prepareForm(form);
    if (!form.checkValidity()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      form.reportValidity();
      form.querySelector(':invalid')?.focus();
    }
  }

  function init() {
    scanForms(document);
    document.addEventListener('submit', onSubmitCapture, true);
    const mo = new MutationObserver(() => scanForms(document));
    if (document.body) mo.observe(document.body, { childList: true, subtree: true });
  }

  global.UmgFormValidate = {
    MSG,
    prepareControl,
    prepareForm,
    validateControl,
    validateForm,
    bindForm,
    scanForms,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
