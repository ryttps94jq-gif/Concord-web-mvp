import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let Database = null;
try {
  Database = (await import('better-sqlite3')).default;
} catch {
  Database = null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const dbDir = path.join(DATA_DIR, 'db');
const legacyPath = path.join(DATA_DIR, 'concord.db');
const dbPath = process.env.DB_PATH || path.join(dbDir, 'concord.db');
const migrationsDir = path.join(__dirname, 'migrations');

export function runSqliteMigrations(targetDb) {
  if (!targetDb) throw new Error('runSqliteMigrations requires an open sqlite database instance');

  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const appliedRows = targetDb.prepare('SELECT version FROM schema_version').all();
  const applied = new Set(appliedRows.map((r) => Number(r.version)));

  const parseMigrationName = (fileName) => {
    const match = fileName.match(/^(\d+)_([\w-]+)\.sql$/);
    if (!match) return null;
    return { version: Number(match[1]), name: match[2] };
  };

  const files = fs
    .readdirSync(migrationsDir)
    .map((fileName) => ({ fileName, parsed: parseMigrationName(fileName) }))
    .filter((entry) => entry.parsed)
    .sort((a, b) => a.parsed.version - b.parsed.version);

  let appliedCount = 0;
  for (const { fileName, parsed } of files) {
    if (applied.has(parsed.version)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    const tx = targetDb.transaction(() => {
      targetDb.exec(sql);
      targetDb
        .prepare('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)')
        .run(parsed.version, parsed.name, new Date().toISOString());
    });
    tx();
    appliedCount += 1;
    console.log(`[Migrate] applied ${fileName}`);
  }

  const current = targetDb.prepare('SELECT MAX(version) AS version FROM schema_version').get();
  return { ok: true, applied: appliedCount, currentVersion: Number(current?.version || 0), dbPath };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!Database) {
    console.error('[Migrate] better-sqlite3 is required for migrations.');
    process.exit(1);
  }

  fs.mkdirSync(dbDir, { recursive: true });
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    fs.renameSync(legacyPath, dbPath);
    console.log(`[Migrate] moved legacy database ${legacyPath} -> ${dbPath}`);
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const result = runSqliteMigrations(db);
  console.log(`[Migrate] complete: applied=${result.applied} currentVersion=${result.currentVersion} db=${result.dbPath}`);
  db.close();
}
