const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'costi.sqlite');

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY,
    category TEXT NOT NULL, -- auto | moto
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    fuel TEXT NOT NULL,
    displacement_cc INTEGER,
    power_cv INTEGER,
    model_id INTEGER,
    cost_per_km_eur REAL NOT NULL,
    source_year INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_vehicles_brand ON vehicles(brand);
  CREATE INDEX IF NOT EXISTS idx_vehicles_model ON vehicles(model);
  CREATE INDEX IF NOT EXISTS idx_vehicles_fuel ON vehicles(fuel);

  CREATE TABLE IF NOT EXISTS calculations (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    category TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    fuel TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    distance_km REAL NOT NULL,
    cost_per_km_eur REAL NOT NULL,
    total_eur REAL NOT NULL,
    power_cv INTEGER,
    model_id INTEGER,
    source_year INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_calculations_created_at ON calculations(created_at);
`);

function ensureColumn(name, type) {
  const cols = db.prepare('PRAGMA table_info(vehicles)').all().map((c) => c.name);
  if (!cols.includes(name)) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN ${name} ${type}`);
  }
}

ensureColumn('displacement_cc', 'INTEGER');
ensureColumn('power_cv', 'INTEGER');
ensureColumn('model_id', 'INTEGER');

module.exports = { db };
