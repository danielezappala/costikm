const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { db } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data', 'aci-xlsx');
const YEAR = 2026;

function fuelFromFilename(filename) {
  const name = filename.toUpperCase();
  if (name.includes('ELETTR')) return 'Elettrica';
  if (name.includes('IBR-BZ')) return 'Ibrida Benzina';
  if (name.includes('IBR-GA')) return 'Ibrida Diesel';
  if (name.includes('PLUG-IN')) return 'Plug-in';
  if (name.includes('BZ-GPL')) return 'Benzina/GPL';
  if (name.includes('BZ-OUT') || name.includes('BZ-IN')) return 'Benzina';
  if (name.includes('GA-OUT') || name.includes('GA-IN')) return 'Diesel';
  if (name.includes('MOTOVEICOLI')) return 'Benzina';
  return 'ND';
}

function fuelFromSection(label, fallback) {
  const l = label.toUpperCase();
  if (l.includes('PLUG-IN BENZINA')) return 'Plug-in Benzina';
  if (l.includes('PLUG-IN GASOLIO')) return 'Plug-in Diesel';
  if (l.includes('IBRIDO') && l.includes('BENZINA') && l.includes('GPL')) return 'Ibrida Benzina/GPL';
  if (l.includes('IBRIDO') && l.includes('BENZINA')) return 'Ibrida Benzina';
  if (l.includes('IBRIDO') && l.includes('GASOLIO')) return 'Ibrida Diesel';
  if (l.includes('BENZINA-GPL')) return 'Benzina/GPL';
  if (l.includes('BENZINA-METANO')) return 'Benzina/Metano';
  if (l.includes('METANO')) return 'Metano';
  if (l.includes('ELETTR')) return 'Elettrica';
  if (l.includes('IBRIDO')) return 'Ibrida';
  return fallback;
}

function categoryFromFilename(filename) {
  return filename.toUpperCase().includes('MOTOVEICOLI') ? 'moto' : 'auto';
}

function readWorkbook(filePath, filename) {
  const wb = xlsx.readFile(filePath, { cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, blankrows: false });

  const entries = [];
  const baseFuel = fuelFromFilename(filename);
  const category = categoryFromFilename(filename);
  let currentFuel = baseFuel;

  for (const row of rows) {
    if (!row || row.length === 0) continue;

    if (row.length === 1 && typeof row[0] === 'string') {
      currentFuel = fuelFromSection(row[0], baseFuel);
      continue;
    }

    if (String(row[0]).toUpperCase().includes('ID MODELLO')) continue;

    const modelId = Number(row[0]);
    const brand = row[1];
    const model = row[2];
    const cost = Number(row[3]);
    if (!brand || !model || !Number.isFinite(cost)) continue;

    const modelStr = String(model).replace(/\u00a0/g, ' ').trim();
    const cvMatches = modelStr.match(/(\d{2,4})\s*CV/gi);
    const power_cv = cvMatches ? Number(cvMatches[cvMatches.length - 1].replace(/\D/g, '')) : null;

    entries.push({
      category,
      brand: String(brand).trim(),
      model: modelStr,
      fuel: currentFuel,
      displacement_cc: null,
      power_cv: Number.isFinite(power_cv) ? power_cv : null,
      model_id: Number.isFinite(modelId) ? modelId : null,
      cost_per_km_eur: cost,
      source_year: YEAR,
    });
  }

  return entries;
}

function run() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error('Missing directory', DATA_DIR);
    process.exit(1);
  }

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.toLowerCase().endsWith('.xlsx'));
  if (files.length === 0) {
    console.error('No xlsx files in', DATA_DIR);
    process.exit(1);
  }

  const allEntries = [];
  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    allEntries.push(...readWorkbook(filePath, file));
  }

  db.exec('DELETE FROM vehicles');
  const insert = db.prepare(`
    INSERT INTO vehicles (category, brand, model, fuel, displacement_cc, power_cv, model_id, cost_per_km_eur, source_year)
    VALUES (@category, @brand, @model, @fuel, @displacement_cc, @power_cv, @model_id, @cost_per_km_eur, @source_year)
  `);

  const tx = db.transaction((rows) => {
    for (const row of rows) insert.run(row);
  });

  tx(allEntries);
  console.log('Imported entries:', allEntries.length);
}

run();
