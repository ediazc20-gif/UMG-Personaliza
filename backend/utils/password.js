/**
 * Verificacion y cifrado de contrasenas.
 *
 * Esta logica vivia suelta dentro de routes/auth/login.js. Al anadir el cambio
 * de contrasena desde el perfil del comprador hacia falta en dos sitios, y
 * duplicarla era la forma segura de que las dos copias se separaran con el
 * tiempo: bastaria arreglar un formato en una y olvidarlo en la otra.
 *
 * La base trae contrasenas en varios formatos porque el proyecto ha ido
 * cambiando: bcrypt (lo que se usa hoy al registrar), y sha256/sha512 heredados.
 * Se aceptan todos al comparar, pero al ESCRIBIR una contrasena nueva siempre
 * se usa bcrypt, asi que los formatos viejos se van extinguiendo solos.
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;

function esHashBcrypt(s) {
  return typeof s === 'string' && /^\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{53}$/.test(s);
}
function esHex(s) { return typeof s === 'string' && /^[0-9a-fA-F]+$/.test(s); }
function esSha256(s) { return typeof s === 'string' && s.length === 64 && esHex(s); }
function esSha512(s) { return typeof s === 'string' && s.length === 128 && esHex(s); }

function sha256Hex(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function sha512Hex(s) { return crypto.createHash('sha512').update(String(s)).digest('hex'); }

/**
 * Comparacion en tiempo constante. Con `===` el tiempo de respuesta depende de
 * cuantos caracteres coinciden, y eso deja filtrar el hash a base de medir.
 */
function igualdadConstante(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return crypto.timingSafeEqual(A, B);
}

/**
 * Comprueba una contrasena en claro contra el hash guardado, sea cual sea su
 * formato. Devuelve false ante cualquier combinacion que no reconozca, nunca
 * lanza: quien llama solo necesita saber si entra o no.
 *
 * El caso de "la contrasena recibida ya viene hasheada" existe porque algunos
 * clientes antiguos mandaban el hash en vez del texto; se acepta solo si
 * coincide exactamente con el formato del hash guardado.
 */
async function verificarPassword(plano, hashGuardado) {
  const hash = String(hashGuardado || '');
  const candidata = String(plano ?? '');
  if (!hash || !candidata) return false;

  if (esHashBcrypt(hash)) {
    if (esHashBcrypt(candidata)) return igualdadConstante(candidata, hash);
    if (esSha256(candidata) || esSha512(candidata)) return false;
    return bcrypt.compare(candidata, hash);
  }

  if (esSha256(hash)) {
    const guardado = hash.toLowerCase();
    if (esSha256(candidata)) return igualdadConstante(candidata.toLowerCase(), guardado);
    if (esSha512(candidata) || esHashBcrypt(candidata)) return false;
    return igualdadConstante(sha256Hex(candidata), guardado);
  }

  if (esSha512(hash)) {
    const guardado = hash.toLowerCase();
    if (esSha512(candidata)) return igualdadConstante(candidata.toLowerCase(), guardado);
    if (esSha256(candidata) || esHashBcrypt(candidata)) return false;
    return igualdadConstante(sha512Hex(candidata), guardado);
  }

  // Formato desconocido: no se adivina.
  return false;
}

/** Toda contrasena nueva se guarda con bcrypt, nunca con los formatos viejos. */
function hashPassword(plano) {
  return bcrypt.hash(String(plano), BCRYPT_ROUNDS);
}

/**
 * Reglas minimas de una contrasena nueva. Devuelve null si vale, o el motivo.
 * Se mantiene el minimo de 6 que ya usaba el reinicio de contrasena, para no
 * dejar dos criterios distintos segun por donde se cambie.
 */
function validarPasswordNueva(plano) {
  const p = String(plano ?? '');
  if (p.length < 6) return 'La contrasena debe tener al menos 6 caracteres.';
  if (p.length > 200) return 'La contrasena es demasiado larga.';
  return null;
}

module.exports = {
  esHashBcrypt,
  verificarPassword,
  hashPassword,
  validarPasswordNueva,
  BCRYPT_ROUNDS,
};
