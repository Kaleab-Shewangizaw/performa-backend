const mysql = require('mysql2/promise');
const env = require('./env');

// Builds the pool config from DATABASE_URL (mysql://user:pass@host:port/db).
// On cPanel, MySQL users are granted @'localhost', which matches SOCKET
// connections — set DB_SOCKET_PATH to connect that way; locally we use TCP.
function poolConfig() {
  const url = new URL(env.databaseUrl);
  const cfg = {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10,
    idleTimeout: 60000,
    enableKeepAlive: true,
  };
  if (env.dbSocketPath) {
    cfg.socketPath = env.dbSocketPath;
  } else {
    cfg.host = url.hostname || '127.0.0.1';
    cfg.port = url.port ? Number(url.port) : 3306;
  }
  return cfg;
}

const pool = mysql.createPool(poolConfig());

// Runs a query and returns the first element of mysql2's [result, fields]:
// a rows array for SELECT, or a ResultSetHeader (insertId/affectedRows) for
// INSERT/UPDATE/DELETE.
async function query(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

// Runs `fn` inside a transaction. `fn` receives a `tx` with the same
// query(sql, params) -> result contract, bound to the transaction connection.
async function withTransaction(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const tx = {
      query: async (sql, params = []) => {
        const [result] = await conn.query(sql, params);
        return result;
      },
    };
    const out = await fn(tx);
    await conn.commit();
    return out;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, query, withTransaction };
