// Applies every .sql file in ./migrations in filename order, once each.
// Applied files are tracked in the schema_migrations table.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function connectionConfig() {
  const url = new URL(env.databaseUrl);
  const cfg = {
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    charset: 'utf8mb4',
    // Migration files contain multiple statements.
    multipleStatements: true,
  };
  if (env.dbSocketPath) {
    cfg.socketPath = env.dbSocketPath;
  } else {
    cfg.host = url.hostname || '127.0.0.1';
    cfg.port = url.port ? Number(url.port) : 3306;
  }
  return cfg;
}

async function migrate() {
  const conn = await mysql.createConnection(connectionConfig());
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const [rows] = await conn.query('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((r) => r.name));

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await conn.beginTransaction();
      try {
        await conn.query(sql);
        await conn.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
        await conn.commit();
        console.log(`  applied ${file}`);
      } catch (err) {
        await conn.rollback();
        throw new Error(`Migration ${file} failed: ${err.message}`);
      }
    }
    console.log('Migrations up to date.');
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
