const crypto = require('crypto');

/** Codigo de orden con CSPRNG (no Math.random). */
function generarCodigoOrden() {
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  const rnd = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `UMG-${ts}${rnd}`;
}

module.exports = { generarCodigoOrden };
