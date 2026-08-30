const mysqlp = require('mysql2/promise');

const {
  DB_TZ,

  // ---- localDB (servidor 1) ----
  LOCAL_DB_HOST,
  LOCAL_DB_PORT,
  LOCAL_DB_USER,
  LOCAL_DB_PASSWORD,
  LOCAL_DB_NAME,
  LOCAL_DB_CONN_LIMIT,
  LOCAL_DB_QUEUE_LIMIT,
  LOCAL_DB_SSL,         // 'false' | 'true'
  LOCAL_DB_MULTIPLE,    // 'true' | 'false'

  // ---- centralDBp (servidor 2) ----
  CENTRALP_DB_HOST,
  CENTRALP_DB_PORT,
  CENTRALP_DB_USER,
  CENTRALP_DB_PASSWORD,
  CENTRALP_DB_NAME,
  CENTRALP_DB_CONN_LIMIT,
  CENTRALP_DB_QUEUE_LIMIT,
  CENTRALP_DB_SSL,    
  CENTRALP_DB_MULTIPLE, 
} = process.env;

// ---------- util: crea pool con opciones comunes ----------
function makePool(label, cfg) {
  // ssl config (igual a tu expectativa: false/true)
  let sslOpt = undefined;
  const sslFlag = String(cfg.ssl ?? 'false').toLowerCase();
  if (sslFlag === 'true') sslOpt = { rejectUnauthorized: true };
  if (sslFlag === 'false') sslOpt = false;

  const pool = mysqlp.createPool({
    host: cfg.host,
    port: Number(cfg.port),
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: Number(cfg.connectionLimit),
    queueLimit: Number(cfg.queueLimit),
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 15000, // válido en mysql2
    multipleStatements: String(cfg.multipleStatements ?? 'false').toLowerCase() === 'true',
    ssl: sslOpt,
    timezone: DB_TZ,
  });

  pool.on('connection', (conn) => {
    conn.query('SET time_zone = ?', [DB_TZ], (err) => {
      if (err) console.error(`[DB:${label}] No pude fijar time_zone:`, err.message);
    });
  });

  return pool;
}

async function ensureDatabaseExists(label, cfg) {
  const connection = await mysqlp.createConnection({
    host: cfg.host,
    port: Number(cfg.port),
    user: cfg.user,
    password: cfg.password,
    connectTimeout: 15000,
  });

  try {
    const databaseName = String(cfg.database || '').replace(/`/g, '');
    if (!databaseName) return;
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`[DB:${label}] Base de datos creada o ya existente: ${databaseName}`);
  } finally {
    await connection.end();
  }
}

const DEFAULT_DB_NAME = process.env.DB_NAME || 'umg_personaliza_db';

// ---------- pools ----------
const _localPool = makePool('localDB', {
  host: LOCAL_DB_HOST || 'mysql',
  port: LOCAL_DB_PORT || 3306,
  user: LOCAL_DB_USER || 'root',
  password: LOCAL_DB_PASSWORD || process.env.MYSQL_ROOT_PASSWORD,
  database: LOCAL_DB_NAME || DEFAULT_DB_NAME,
  connectionLimit: LOCAL_DB_CONN_LIMIT || 10,
  queueLimit: LOCAL_DB_QUEUE_LIMIT || 0,
  ssl: LOCAL_DB_SSL,
  multipleStatements: LOCAL_DB_MULTIPLE,
});

const _centralPPool = makePool('centralDBp', {
  host: CENTRALP_DB_HOST || 'mysql',
  port: CENTRALP_DB_PORT || 3306,
  user: CENTRALP_DB_USER || 'root',
  password: CENTRALP_DB_PASSWORD || process.env.MYSQL_ROOT_PASSWORD,
  database: CENTRALP_DB_NAME || DEFAULT_DB_NAME,
  connectionLimit: CENTRALP_DB_CONN_LIMIT || 10,
  queueLimit: CENTRALP_DB_QUEUE_LIMIT || 0,
  ssl: CENTRALP_DB_SSL,                 // ← false
  multipleStatements: CENTRALP_DB_MULTIPLE, // ← true
});

// ---------- ping de arranque y estado ----------
const unavailable = { localDB: false, centralDBp: false };

async function _ping(label, pool) {
  const conn = await pool.getConnection(); // conexión promesa
  try {
    await conn.ping();
    await conn.query('SET time_zone = ?', [DB_TZ]); // refuerzo inicial
    console.log(`[DB:${label}] ping OK`);
  } finally {
    conn.release();
  }
}

async function _pingWithRetry(label, pool, retries = 15, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await _ping(label, pool);
      return;
    } catch (e) {
      if (e?.code === 'ER_BAD_DB_ERROR' && label === 'localDB') {
        await ensureDatabaseExists(label, {
          host: LOCAL_DB_HOST,
          port: LOCAL_DB_PORT,
          user: LOCAL_DB_USER,
          password: LOCAL_DB_PASSWORD,
          database: LOCAL_DB_NAME,
        });
        continue;
      }
      console.log(`[DB:${label}] intento ${i}/${retries} fallo: ${e.code || e.message}`);
      if (i < retries) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error(`${label} no disponible despues de ${retries} intentos`);
}

async function initAll() {
  await Promise.all([
    (async () => { try { await _pingWithRetry('localDB', _localPool); }
      catch (e) { unavailable.localDB = true; console.error('[DB:localDB] UNAVAILABLE:', e.message); } })(),
    (async () => { try { await _pingWithRetry('centralDBp', _centralPPool); }
      catch (e) { unavailable.centralDBp = true; console.error('[DB:centralDBp] UNAVAILABLE:', e.message); } })(),
  ]);
  console.log('[DB] Init done:', { localDB: !unavailable.localDB, centralDBp: !unavailable.centralDBp });
}

async function closeAll() {
  console.log('[DB] Cerrando pools...');
  await Promise.allSettled([ _localPool.end(), _centralPPool.end() ]);
  console.log('[DB] Pools cerrados.');
}

// ---------- helpers async/await (recomendados) ----------
async function queryLocal(sql, params) {
  if (unavailable.localDB) throw new Error('localDB no disponible (init falló)');
  const [rows] = await _localPool.execute(sql, params);
  return rows;
}

async function queryCentralP(sql, params) {
  if (unavailable.centralDBp) throw new Error('centralDBp no disponible (init falló)');
  const [rows] = await _centralPPool.execute(sql, params);
  return rows;
}

// ---------- capa de compatibilidad .query(...) ----------
function compatPool(pool, label) {
  return {
    query(sql, params, cb) {
      if (typeof params === 'function') { cb = params; params = undefined; }
      const p = pool.execute(sql, params).then(([rows]) => rows);
      if (typeof cb === 'function') { p.then(r => cb(null, r)).catch(cb); return; }
      return p; // permite: const rows = await localDB.query('SELECT ...');
    },
    execute: (sql, params) => pool.execute(sql, params),
    getConnection: (...args) => pool.getConnection(...args),
    _pool: pool,
    _label: label,
  };
}

const localDB    = compatPool(_localPool, 'localDB');
const centralDBp = compatPool(_centralPPool, 'centralDBp');

// ---------- exports ----------
module.exports = {
  // Pools compatibles (mantienen .query / .execute)
  localDB,
  centralDBp,

  // Ciclo de vida
  initAll,
  closeAll,
  unavailable,

  // Helpers recomendados
  queryLocal,
  queryCentralP,
};
