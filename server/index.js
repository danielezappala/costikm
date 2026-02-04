require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { z } = require('zod');
const path = require('path');
const { db } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

const ORS_API_KEY = process.env.ORS_API_KEY;
const ORS_DIRECTIONS = 'https://api.openrouteservice.org/v2/directions/driving-car';
const ORS_GEOCODE = 'https://api.openrouteservice.org/geocode/search';

function getDistinct(query, params = []) {
  const rows = db.prepare(query).all(params);
  return rows.map((r) => r.value);
}

app.get('/api/categories', (req, res) => {
  const rows = getDistinct('SELECT DISTINCT category as value FROM vehicles ORDER BY value');
  res.json(rows);
});

app.get('/api/brands', (req, res) => {
  const category = req.query.category || 'auto';
  const rows = getDistinct(
    'SELECT DISTINCT brand as value FROM vehicles WHERE category = ? ORDER BY value',
    [category]
  );
  res.json(rows);
});

app.get('/api/models', (req, res) => {
  const { category = 'auto', brand } = req.query;
  if (!brand) return res.status(400).json({ error: 'brand required' });
  const rows = getDistinct(
    'SELECT DISTINCT model as value FROM vehicles WHERE category = ? AND brand = ? ORDER BY value',
    [category, brand]
  );
  res.json(rows);
});

app.get('/api/fuels', (req, res) => {
  const { category = 'auto', brand, model } = req.query;
  if (!brand || !model) return res.status(400).json({ error: 'brand and model required' });
  const rows = getDistinct(
    'SELECT DISTINCT fuel as value FROM vehicles WHERE category = ? AND brand = ? AND model = ? ORDER BY value',
    [category, brand, model]
  );
  res.json(rows);
});

app.post('/api/route', async (req, res) => {
  if (!ORS_API_KEY) return res.status(500).json({ error: 'ORS_API_KEY missing' });
  const schema = z.object({
    start: z.object({ lat: z.number(), lon: z.number() }),
    end: z.object({ lat: z.number(), lon: z.number() }),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', details: parsed.error.errors });

  const { start, end } = parsed.data;

  try {
    const response = await fetch(ORS_DIRECTIONS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        coordinates: [
          [start.lon, start.lat],
          [end.lon, end.lat],
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: 'ORS error', details: text });
    }

    const data = await response.json();
    // ORS can return either GeoJSON (features) or JSON (routes)
    const meters =
      data?.features?.[0]?.properties?.summary?.distance ??
      data?.routes?.[0]?.summary?.distance;
    if (!Number.isFinite(meters) || meters <= 0) {
      console.error('ORS route missing distance', {
        status: response.status,
        body: data,
      });
      return res.status(502).json({ error: 'route not found', details: data });
    }
    res.json({ distance_km: meters / 1000 });
  } catch (err) {
    res.status(500).json({ error: 'route failed' });
  }
});

app.post('/api/geocode', async (req, res) => {
  if (!ORS_API_KEY) return res.status(500).json({ error: 'ORS_API_KEY missing' });
  const schema = z.object({ query: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', details: parsed.error.errors });

  try {
    const url = `${ORS_GEOCODE}?text=${encodeURIComponent(parsed.data.query)}&size=1`;
    const response = await fetch(url, {
      headers: { Authorization: ORS_API_KEY },
    });
    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: 'ORS geocode error', details: text });
    }
    const data = await response.json();
    const feature = data?.features?.[0];
    if (!feature) return res.status(404).json({ error: 'not found' });
    const [lon, lat] = feature.geometry.coordinates;
    res.json({ lat, lon });
  } catch (err) {
    res.status(500).json({ error: 'geocode failed' });
  }
});

app.post('/api/calculate', (req, res) => {
  const schema = z.object({
    category: z.string(),
    brand: z.string(),
    model: z.string(),
    fuel: z.string(),
    distance_km: z.number().nonnegative(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', details: parsed.error.errors });

  const { category, brand, model, fuel, distance_km } = parsed.data;
  if (!(distance_km > 0)) {
    return res.status(400).json({ error: 'distance_km must be > 0' });
  }
  const row = db
    .prepare(
      `SELECT cost_per_km_eur, displacement_cc, power_cv, model_id, source_year
       FROM vehicles
       WHERE category = ? AND brand = ? AND model = ? AND fuel = ?
       LIMIT 1`
    )
    .get(category, brand, model, fuel);

  if (!row) return res.status(404).json({ error: 'vehicle not found' });

  const total = row.cost_per_km_eur * distance_km;

  res.json({
    cost_per_km_eur: row.cost_per_km_eur,
    distance_km,
    total_eur: total,
    displacement_cc: row.displacement_cc,
    power_cv: row.power_cv,
    model_id: row.model_id,
    source_year: row.source_year,
  });
});

app.get('/api/calculations', (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, created_at, category, brand, model, fuel, start, end, distance_km, cost_per_km_eur,
              total_eur, power_cv, model_id, source_year
       FROM calculations
       ORDER BY datetime(created_at) DESC
       LIMIT 50`
    )
    .all();
  res.json(rows);
});

app.post('/api/calculations', (req, res) => {
  const schema = z.object({
    category: z.string(),
    brand: z.string(),
    model: z.string(),
    fuel: z.string(),
    start: z.string(),
    end: z.string(),
    distance_km: z.number().positive(),
    cost_per_km_eur: z.number().positive(),
    total_eur: z.number().positive(),
    power_cv: z.number().nullable(),
    model_id: z.number().nullable(),
    source_year: z.number(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'invalid payload', details: parsed.error.errors });

  const payload = parsed.data;
  const createdAt = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO calculations
      (created_at, category, brand, model, fuel, start, end, distance_km, cost_per_km_eur, total_eur, power_cv, model_id, source_year)
     VALUES
      (@created_at, @category, @brand, @model, @fuel, @start, @end, @distance_km, @cost_per_km_eur, @total_eur, @power_cv, @model_id, @source_year)`
  );
  const info = insert.run({ created_at: createdAt, ...payload });
  res.json({ id: info.lastInsertRowid, created_at: createdAt });
});

if (process.env.NODE_ENV === 'production') {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
});
