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

  /* ---------------------- Cambiar contrasena ---------------------- */
  const msgPassword = document.getElementById('msgPassword');
  const btnPassword = document.getElementById('btnPassword');

  btnPassword.onclick = async () => {
    msgPassword.innerHTML = '';
    const actual = document.getElementById('passActual').value;
    const nueva = document.getElementById('passNueva').value;
    const repetir = document.getElementById('passRepetir').value;

    // Se comprueba aqui para no gastar un intento del limitador del servidor
    // en un error de tecleo.
    if (!actual || !nueva) {
      msgPassword.innerHTML = '<div class="msg-glass msg-glass--error">Rellena tu contrasena actual y la nueva.</div>';
      return;
    }
    if (nueva !== repetir) {
      msgPassword.innerHTML = '<div class="msg-glass msg-glass--error">Las dos contrasenas nuevas no coinciden.</div>';
      return;
    }

    btnPassword.disabled = true;
    try {
      const r = await apiFetch('/api/tienda/perfil/password', {
        method: 'PUT',
        body: { contrasena_actual: actual, nueva_contrasena: nueva },
      });
      msgPassword.innerHTML = `<div class="msg-glass msg-glass--ok">${escapeHtml(r.mensaje || 'Contrasena actualizada.')}</div>`;
      document.getElementById('passActual').value = '';
      document.getElementById('passNueva').value = '';
      document.getElementById('passRepetir').value = '';
    } catch (e) {
      msgPassword.innerHTML = `<div class="msg-glass msg-glass--error">${escapeHtml(e.message)}</div>`;
    } finally {
      btnPassword.disabled = false;
    }
  };

  /* ---------------------- Cambiar fotografia ---------------------- */
  const msgFoto = document.getElementById('msgFoto');
  const btnFoto = document.getElementById('btnFoto');

  btnFoto.onclick = async () => {
    msgFoto.innerHTML = '';
    const original = document.getElementById('fotoOriginal').files[0];
    const modificada = document.getElementById('fotoModificada').files[0];

    if (!original && !modificada) {
      msgFoto.innerHTML = '<div class="msg-glass msg-glass--error">Elige al menos una imagen.</div>';
      return;
    }

    // Va por FormData y no por apiFetch: son ficheros, no JSON.
    const datos = new FormData();
    if (original) datos.append('foto_original', original);
    if (modificada) datos.append('foto_modificada', modificada);

    btnFoto.disabled = true;
    try {
      const res = await fetch('/api/tienda/perfil/foto', {
        method: 'POST',
        credentials: 'include',
        body: datos,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || 'No se pudo actualizar la foto.');
      msgFoto.innerHTML = `<div class="msg-glass msg-glass--ok">Foto actualizada (${escapeHtml(data.actualizadas || '')}).</div>`;
      document.getElementById('fotoOriginal').value = '';
      document.getElementById('fotoModificada').value = '';
    } catch (e) {
      msgFoto.innerHTML = `<div class="msg-glass msg-glass--error">${escapeHtml(e.message)}</div>`;
    } finally {
      btnFoto.disabled = false;
    }
  };

  document.getElementById('btnLogout')?.addEventListener('click', async () => {
    await fetch('/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
    localStorage.clear();
    sessionStorage.clear();
    location.replace('/');
  });
});
