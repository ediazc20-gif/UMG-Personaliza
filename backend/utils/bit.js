/** Normaliza BIT/Buffer/boolean/number de MySQL a boolean JS. */
function asBool(value) {
  if (value === true || value === 1 || value === '1') return true;
  if (value === false || value === 0 || value === '0' || value == null) return false;
  if (Buffer.isBuffer(value)) return value.length > 0 && value[0] === 1;
  if (typeof value === 'object' && Array.isArray(value.data)) {
    return value.data[0] === 1;
  }
  return Boolean(Number(value));
}

function mapProductoFlags(row) {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    tiene_lado_b: asBool(row.tiene_lado_b),
    activo: row.activo === undefined ? undefined : asBool(row.activo),
  };
}

module.exports = { asBool, mapProductoFlags };
