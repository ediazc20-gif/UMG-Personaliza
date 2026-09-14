document.addEventListener('DOMContentLoaded', async () => {
  if (!localStorage.getItem('uid')) {
    location.replace('/');
    return;
  }
  const msg = document.getElementById('msg');
  try {
    const data = await apiFetch('/api/tienda/perfil');
    const p = data.perfil;
    document.getElementById('nombreCompleto').value = `${p.nombres || ''} ${p.apellidos || ''}`.trim();
    document.getElementById('email').value = p.email || '';
    document.getElementById('nickname').value = p.nickname || localStorage.getItem('nombre') || '';
  } catch (e) {
    msg.innerHTML = `<div class="msg-glass msg-glass--error">${escapeHtml(e.message)}</div>`;
  }

  document.getElementById('btnSave').onclick = async () => {
    msg.innerHTML = '';
    try {
      const nickname = document.getElementById('nickname').value.trim();
      await apiFetch('/api/tienda/perfil', { method: 'PUT', body: { nickname } });
      localStorage.setItem('nombre', nickname);
      msg.innerHTML = '<div class="msg-glass msg-glass--ok">Perfil actualizado.</div>';
    } catch (e) {
      msg.innerHTML = `<div class="msg-glass msg-glass--error">${escapeHtml(e.message)}</div>`;
    }
  };

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });
});
