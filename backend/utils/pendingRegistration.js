/** Usuario creado en /registro pero aún sin verificar OTP (Estado_Usuario = 0). */
function bitIsActive(value) {
  return value === 1 || value === true || value?.[0] === 1;
}

function isPendingRegistration(user) {
  if (!user) return false;
  return !bitIsActive(user.Estado_Usuario);
}

function isFullyRegistered(user) {
  if (!user) return false;
  return bitIsActive(user.Estado_Usuario) || bitIsActive(user.Correo_Verificado_Usuario);
}

async function findUserByEmail(conn, correo) {
  if (!correo) return null;
  const [rows] = await conn.query(
    `SELECT Id_Usuario, Estado_Usuario, Correo_Verificado_Usuario, Email_Usuario, Usuario, Celular_Usuario
     FROM usuarios WHERE Email_Usuario = ? LIMIT 1`,
    [correo]
  );
  return rows[0] || null;
}

async function findUserByUsuario(conn, usuario) {
  if (!usuario) return null;
  const [rows] = await conn.query(
    `SELECT Id_Usuario, Estado_Usuario, Correo_Verificado_Usuario, Email_Usuario, Usuario, Celular_Usuario
     FROM usuarios WHERE Usuario = ? LIMIT 1`,
    [usuario]
  );
  return rows[0] || null;
}

async function findUserByTelefono(conn, telefono) {
  if (!telefono) return null;
  const [rows] = await conn.query(
    `SELECT Id_Usuario, Estado_Usuario, Correo_Verificado_Usuario, Email_Usuario, Usuario, Celular_Usuario
     FROM usuarios WHERE Celular_Usuario = ? LIMIT 1`,
    [telefono]
  );
  return rows[0] || null;
}

/**
 * Si el SP dice "ya registrado" pero solo existe un pendiente, tratar como disponible.
 */
async function softenUniqueValidation(conn, respuesta, { correo, telefono, usuario }) {
  if (respuesta === '1') return '1';

  if (/correo/i.test(respuesta || '') && correo) {
    const u = await findUserByEmail(conn, correo);
    if (u && isPendingRegistration(u)) return '1';
  }
  if (/tel[eé]fono|celular/i.test(respuesta || '') && telefono) {
    const u = await findUserByTelefono(conn, telefono);
    if (u && isPendingRegistration(u)) return '1';
  }
  if (/usuario/i.test(respuesta || '') && usuario) {
    const u = await findUserByUsuario(conn, usuario);
    if (u && isPendingRegistration(u)) return '1';
  }
  return respuesta;
}

module.exports = {
  bitIsActive,
  isPendingRegistration,
  isFullyRegistered,
  findUserByEmail,
  findUserByUsuario,
  findUserByTelefono,
  softenUniqueValidation,
};
