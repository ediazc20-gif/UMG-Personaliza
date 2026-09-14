async function cargarPerfil() {
  const contenedor = document.getElementById('section-container');
  contenedor.innerHTML = '<div class="p-4 text-center text-secondary"><i class="fa-solid fa-circle-notch fa-spin me-2"></i> Cargando perfil...</div>';

  try {
    const res = await fetch('/admin/perfil/' + localStorage.getItem('uid'));
    const user = await res.json();

    if (user.error) throw new Error(user.error);

    contenedor.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 class="h5 mb-1"><i class="fa-solid fa-id-card me-2 text-primary"></i> Mi Perfil de Administrador</h2>
          <p class="text-secondary small mb-0">Gestiona tus datos personales y credenciales de acceso</p>
        </div>
        <span class="badge bg-primary px-3 py-2">${escapeHtml(user.Rol || 'Administrador')}</span>
      </div>

      <div class="row g-4">
        <div class="col-lg-7">
          <div class="card p-4 border-0">
            <h3 class="h6 mb-3" style="color: var(--ink);">Datos de la cuenta</h3>
            <form id="formPerfil">
              <div class="row g-3">
                <div class="col-md-6">
                  <label class="form-label small text-secondary">Nombres</label>
                  <input type="text" class="form-control form-control-sm" name="nombres" value="${escapeHtml(user.Nombres_Usuario || '')}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label small text-secondary">Apellidos</label>
                  <input type="text" class="form-control form-control-sm" name="apellidos" value="${escapeHtml(user.Apellidos_Usuario || '')}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label small text-secondary">Correo Institucional</label>
                  <input type="email" class="form-control form-control-sm" name="correo" value="${escapeHtml(user.Email_Usuario || '')}" required>
                </div>
                <div class="col-md-6">
                  <label class="form-label small text-secondary">Teléfono / Celular</label>
                  <input type="text" class="form-control form-control-sm" name="telefono" value="${escapeHtml(user.Celular_Usuario || '')}">
                </div>
                <div class="col-12">
                  <label class="form-label small text-secondary">Nueva contraseña (opcional)</label>
                  <input type="password" class="form-control form-control-sm" name="contrasena" placeholder="Dejar vacío si no deseas cambiarla">
                </div>
              </div>
              <div class="mt-4">
                <button type="submit" class="btn btn-primary btn-sm px-4">
                  <i class="fa-solid fa-floppy-disk me-1"></i> Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="card p-4 border-0 text-center">
            <h3 class="h6 mb-3" style="color: var(--ink);">Foto de Perfil</h3>
            <div class="d-flex justify-content-center mb-3">
              <img id="fotoPerfil" 
                   src="${user.foto64 ? 'data:image/jpeg;base64,' + user.foto64 : '/assets/img/avatar-placeholder.png'}" 
                   alt="Foto de perfil"
                   style="width: 130px; height: 130px; border-radius: 50%; object-fit: cover; border: 3px solid var(--line-strong);"
                   onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.Nombres_Usuario || 'Admin')}&background=8b5cf6&color=fff&size=130';">
            </div>
            <div class="mb-3">
              <input type="file" class="form-control form-control-sm" id="nuevaFoto" accept="image/*">
            </div>
            <button id="btnGuardarFoto" class="btn btn-outline-primary btn-sm w-100">
              <i class="fa-solid fa-camera me-1"></i> Actualizar foto
            </button>
            <p id="msgFoto" class="mt-2 small mb-0"></p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('formPerfil').onsubmit = async (e) => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(e.target).entries());
      try {
        const resUpd = await fetch('/admin/perfil/' + user.Id_Usuario, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        const out = await resUpd.json();
        alert(out.mensaje || out.error || 'Perfil actualizado');
        if (out.ok) cargarPerfil();
      } catch (err) {
        alert('Error al actualizar perfil: ' + err.message);
      }
    };

    const inputFoto = document.getElementById('nuevaFoto');
    const imgPreview = document.getElementById('fotoPerfil');
    const msgFoto = document.getElementById('msgFoto');
    const btnGuardar = document.getElementById('btnGuardarFoto');

    inputFoto.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          msgFoto.textContent = '⚠️ Imagen demasiado grande (máximo 2MB)';
          msgFoto.className = 'mt-2 small text-danger';
          inputFoto.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => imgPreview.src = reader.result;
        reader.readAsDataURL(file);
      }
    });

    btnGuardar.addEventListener('click', async () => {
      const file = inputFoto.files[0];
      if (!file) {
        msgFoto.textContent = '⚠️ Selecciona una imagen antes de guardar.';
        msgFoto.className = 'mt-2 small text-warning';
        return;
      }

      const formData = new FormData();
      formData.append('foto', file);
      btnGuardar.disabled = true;

      try {
        const res = await fetch('/admin/perfil/foto', {
          method: 'POST',
          body: formData,
          credentials: 'include'
        });

        const data = await res.json();
        if (data.ok) {
          msgFoto.textContent = '✅ Foto actualizada correctamente.';
          msgFoto.className = 'mt-2 small text-success';
        } else {
          msgFoto.textContent = '❌ Error: ' + (data.error || 'No se pudo actualizar.');
          msgFoto.className = 'mt-2 small text-danger';
        }
      } catch (err) {
        console.error('Error subiendo foto:', err);
        msgFoto.textContent = '❌ Error al conectar con el servidor.';
        msgFoto.className = 'mt-2 small text-danger';
      } finally {
        btnGuardar.disabled = false;
      }
    });

  } catch (err) {
    contenedor.innerHTML = `<div class="p-3 text-danger"><i class="fa-solid fa-triangle-exclamation me-2"></i> Error al cargar perfil: ${escapeHtml(err.message)}</div>`;
  }
}

cargarPerfil();
