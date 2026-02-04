import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription as DialogDesc,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatEuro, formatEuroKm } from '@/utils/formatCurrency';
import { formatNumber } from '@/utils/formatNumber';
import { jsPDF } from 'jspdf';

const API_BASE = 'http://localhost:4000';

type CalcResult = {
  cost_per_km_eur: number;
  distance_km: number;
  total_eur: number;
  power_cv: number | null;
  model_id: number | null;
  source_year: number;
};

type SavedCalculation = CalcResult & {
  id: number;
  created_at: string;
  category: string;
  brand: string;
  model: string;
  fuel: string;
  start: string;
  end: string;
};

export function Home() {
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);
  const [fuels, setFuels] = useState<string[]>([]);

  const [category, setCategory] = useState('auto');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [fuel, setFuel] = useState('');

  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedCalculation[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [autoSave, setAutoSave] = useState(false);
  const [lastCalculatedKey, setLastCalculatedKey] = useState('');
  const [searchSaved, setSearchSaved] = useState('');
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfName, setPdfName] = useState('');
  const [pdfDate, setPdfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pdfProject, setPdfProject] = useState('');
  const [pdfError, setPdfError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/categories`)
      .then((r) => r.json())
      .then((data: string[]) => setCategories(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/calculations`)
      .then((r) => r.json())
      .then((data: SavedCalculation[]) => setSaved(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!category) return;
    fetch(`${API_BASE}/api/brands?category=${encodeURIComponent(category)}`)
      .then((r) => r.json())
      .then((data: string[]) => setBrands(data))
      .catch(() => {});
  }, [category]);

  useEffect(() => {
    if (!brand) return;
    fetch(
      `${API_BASE}/api/models?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(
        brand
      )}`
    )
      .then((r) => r.json())
      .then((data: string[]) => setModels(data))
      .catch(() => {});
  }, [category, brand]);

  useEffect(() => {
    if (!brand || !model) return;
    fetch(
      `${API_BASE}/api/fuels?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(
        brand
      )}&model=${encodeURIComponent(model)}`
    )
      .then((r) => r.json())
      .then((data: string[]) => setFuels(data))
      .catch(() => {});
  }, [category, brand, model]);

  const canCalculate = useMemo(() => {
    return start.trim() && end.trim() && brand && model && fuel;
  }, [start, end, brand, model, fuel]);

  const currentKey = useMemo(() => {
    return [category, brand, model, fuel, start.trim(), end.trim()].join('|');
  }, [category, brand, model, fuel, start, end]);

  const isCalculated = canCalculate && lastCalculatedKey === currentKey;

  async function geocode(query: string) {
    const resp = await fetch(`${API_BASE}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) throw new Error('Indirizzo non trovato');
    const data = await resp.json();
    return { lat: Number(data.lat), lon: Number(data.lon) };
  }

  function formatDateIt(value: string) {
    if (!value) return '';
    const [year, month, day] = value.split('-');
    if (!year || !month || !day) return value;
    return `${day}/${month}/${year}`;
  }

  function handleDownloadPdf() {
    if (!result) return;
    if (!pdfName.trim() || !pdfDate) {
      setPdfError('Inserisci nominativo e data.');
      return;
    }
    setPdfError('');

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 20;
    let y = 20;

    const pageRight = 190;
    const contentW = pageRight - marginX;
    const labelW = 30;
    const valueX = marginX + labelW;
    const valueW = contentW - labelW;

    const fieldRow = (yPos: number, label: string, value: string, boldValue = false) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(110);
      doc.text(`${label}:`, marginX, yPos);
      doc.setTextColor(20);
      if (boldValue) doc.setFont('helvetica', 'bold');
      const lines = doc.splitTextToSize(value, valueW);
      doc.text(lines, valueX, yPos);
      if (boldValue) doc.setFont('helvetica', 'normal');
      return yPos + lines.length * 5 + 3;
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text('Calcolo costi chilometrici', marginX, y);
    y += 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Dati veicolo', marginX, y);
    y += 6;
    y = fieldRow(y, 'Veicolo', `${brand} ${model} (${fuel})`);
    y = fieldRow(y, 'Categoria', `${category}`);
    y = fieldRow(y, 'ID modello', `${result.model_id ?? 'ND'}`);
    y = fieldRow(y, 'Anno fonte', `${result.source_year}`);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Dati itinerario', marginX, y);
    y += 6;
    y = fieldRow(y, 'Nominativo', pdfName);
    y = fieldRow(y, 'Data', formatDateIt(pdfDate));
    if (pdfProject.trim()) {
      y = fieldRow(y, 'Progetto', pdfProject);
    }
    y = fieldRow(y, 'Tragitto', `${start} - ${end}`);

    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Dettaglio costi', marginX, y);
    y += 6;

    y = fieldRow(y, 'Distanza', `${distanceKm ? formatNumber(distanceKm, 2) : '—'} km`);
    y = fieldRow(y, 'Costo €/km', `${formatEuroKm(result.cost_per_km_eur)}`);
    y = fieldRow(y, 'Totale stimato', `${formatEuro(result.total_eur)}`, true);

    const safeDate = pdfDate.replace(/-/g, '');
    const filename = `certificazione-costi-chilometrici-${safeDate}.pdf`;
    doc.save(filename);
    setPdfOpen(false);
  }

  async function handleCalculateWith(values: {
    category: string;
    brand: string;
    model: string;
    fuel: string;
    start: string;
    end: string;
  }) {
    setError('');
    setResult(null);
    setLoading(true);

    try {
      if (!values.start.trim() || !values.end.trim() || !values.brand || !values.model || !values.fuel) {
        throw new Error('Compila tutti i campi per calcolare il costo.');
      }
      const startCoord = await geocode(values.start);
      const endCoord = await geocode(values.end);

      const routeResp = await fetch(`${API_BASE}/api/route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startCoord, end: endCoord }),
      });
      if (!routeResp.ok) throw new Error('Errore calcolo distanza');
      const routeData = await routeResp.json();

      const dist = routeData.distance_km as number;
      if (!Number.isFinite(dist) || dist <= 0) {
        throw new Error('Distanza non valida');
      }
      setDistanceKm(dist);

      const calcResp = await fetch(`${API_BASE}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: values.category,
          brand: values.brand,
          model: values.model,
          fuel: values.fuel,
          distance_km: dist,
        }),
      });
      if (!calcResp.ok) {
        let msg = 'Errore calcolo costi';
        try {
          const err = await calcResp.json();
          if (err?.error) msg = err.error;
        } catch (_) {}
        throw new Error(msg);
      }
      const calcData = (await calcResp.json()) as CalcResult;
      setResult(calcData);
      setLastCalculatedKey(currentKey);
      if (autoSave) {
        await handleSave(calcData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore');
    } finally {
      setLoading(false);
    }
  }

  function handleCalculate() {
    return handleCalculateWith({ category, brand, model, fuel, start, end });
  }

  function resetAll() {
    setBrand('');
    setModel('');
    setFuel('');
    setStart('');
    setEnd('');
    setDistanceKm(null);
    setResult(null);
    setError('');
    setLastCalculatedKey('');
  }

  async function handleSave(payload?: CalcResult) {
    const data = payload ?? result;
    if (!data) return;
    setSaving(true);
    setSaveMessage('');
    try {
      const resp = await fetch(`${API_BASE}/api/calculations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          brand,
          model,
          fuel,
          start,
          end,
          distance_km: data.distance_km,
          cost_per_km_eur: data.cost_per_km_eur,
          total_eur: data.total_eur,
          power_cv: data.power_cv,
          model_id: data.model_id,
          source_year: data.source_year,
        }),
      });
      if (!resp.ok) throw new Error('Salvataggio non riuscito');
      const savedItem = await resp.json();
      setSaved((prev) => [{ ...data, ...savedItem, category, brand, model, fuel, start, end }, ...prev]);
      setSaveMessage('Calcolo salvato');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Errore');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(''), 2000);
    }
  }

  function loadSaved(item: SavedCalculation, recalc: boolean) {
    setCategory(item.category);
    setBrand(item.brand);
    setModel(item.model);
    setFuel(item.fuel);
    setStart(item.start);
    setEnd(item.end);
    setResult(null);
    if (recalc) {
      setTimeout(() => {
        handleCalculateWith({
          category: item.category,
          brand: item.brand,
          model: item.model,
          fuel: item.fuel,
          start: item.start,
          end: item.end,
        });
      }, 0);
    }
  }

  const filteredSaved = useMemo(() => {
    const query = searchSaved.trim().toLowerCase();
    if (!query) return saved;
    return saved.filter((item) => {
      return (
        item.brand.toLowerCase().includes(query) ||
        item.model.toLowerCase().includes(query) ||
        item.start.toLowerCase().includes(query) ||
        item.end.toLowerCase().includes(query)
      );
    });
  }, [saved, searchSaved]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-white via-white to-slate-50/60">
      <img
        src="/watermark-grid.svg"
        alt=""
        className="pointer-events-none absolute left-0 top-0 h-[520px] w-[520px] opacity-[0.08]"
      />
      <img
        src="/watermark-car.svg"
        alt=""
        className="pointer-events-none absolute right-12 top-24 hidden w-[420px] opacity-[0.08] md:block"
      />

      <div className="relative mx-auto w-full max-w-6xl px-6 py-12 md:px-10">
        <header className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Aggiornato 2026
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Costi chilometrici veicoli
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Calcolo basato su tabelle ACI pubbliche con distanza reale.
            </p>
          </div>
        </header>

        <Card className="bg-white/80">
          <CardHeader>
            <CardTitle>Calcolatore</CardTitle>
            <CardDescription>Seleziona il veicolo e inserisci l'itinerario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="grid gap-6 md:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Categoria
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    setBrand('');
                    setModel('');
                    setFuel('');
                    setBrands([]);
                    setModels([]);
                    setFuels([]);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Marca
                </label>
                <Select
                  value={brand}
                  onValueChange={(value) => {
                    setBrand(value);
                    setModel('');
                    setFuel('');
                    setModels([]);
                    setFuels([]);
                  }}
                  disabled={!category}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Modello
                </label>
                <Select
                  value={model}
                  onValueChange={(value) => {
                    setModel(value);
                    setFuel('');
                    setFuels([]);
                  }}
                  disabled={!brand}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Alimentazione
                </label>
                <Select value={fuel} onValueChange={setFuel} disabled={!model}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {fuels.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Partenza
                </label>
                <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Milano" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Destinazione
                </label>
                <Input value={end} onChange={(e) => setEnd(e.target.value)} placeholder="Torino" />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button onClick={handleCalculate} loading={loading} disabled={loading || !canCalculate || isCalculated}>
              Calcola
            </Button>
            <Button variant="secondary" onClick={resetAll}>
              Reset
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost">Recupera veicoli precedenti</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Recupera veicoli precedenti</DialogTitle>
                  <DialogDesc>Apri un calcolo salvato e ricalcola.</DialogDesc>
                </DialogHeader>
                <div className="mt-6 space-y-4">
                  <Input
                    value={searchSaved}
                    onChange={(e) => setSearchSaved(e.target.value)}
                    placeholder="Cerca per marca, modello o località"
                  />
                  {saved.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nessun calcolo salvato.</p>
                  ) : filteredSaved.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nessun risultato.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredSaved.map((item) => (
                        <div key={item.id} className="rounded-xl border bg-white/70 p-4">
                          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="text-sm font-semibold">{item.brand} · {item.model}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.start} → {item.end} · {formatEuro(item.total_eur)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <DialogClose asChild>
                                <Button variant="secondary" onClick={() => loadSaved(item, false)}>Riprendi</Button>
                              </DialogClose>
                              <DialogClose asChild>
                                <Button variant="ghost" onClick={() => loadSaved(item, true)}>Ricalcola</Button>
                              </DialogClose>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              Salva automaticamente
            </label>
          </CardFooter>
        </Card>

        <Card className="mt-10 bg-white/80">
          <CardHeader>
            <CardTitle>Risultato</CardTitle>
            <CardDescription>Costo stimato per il tragitto selezionato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {result ? (
              <div className="space-y-8" role="status" aria-live="polite">
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                    Totale stimato
                  </p>
                  <div className="text-4xl font-semibold tracking-tight md:text-5xl">
                    {formatEuro(result.total_eur)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-base font-semibold text-slate-700">
                    <span className="rounded-xl border bg-white/70 px-3 py-2">
                      {distanceKm ? formatNumber(distanceKm, 2) : '—'} km
                    </span>
                    <span className="rounded-xl border bg-white/70 px-3 py-2">
                      {formatEuroKm(result.cost_per_km_eur)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                  <div className="rounded-xl border bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Potenza</p>
                    <p className="text-lg font-semibold">{result.power_cv ?? 'ND'} CV</p>
                  </div>
                  <div className="rounded-xl border bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">ID modello</p>
                    <p className="text-lg font-semibold">{result.model_id ?? 'ND'}</p>
                  </div>
                  <div className="rounded-xl border bg-white/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Anno fonte</p>
                    <p className="text-lg font-semibold">{result.source_year}</p>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voce</TableHead>
                      <TableHead>€/km</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Costo ACI (tariffa 15.000 km)</TableCell>
                      <TableCell>{formatEuro(result.cost_per_km_eur)}</TableCell>
                      <TableCell>{result.source_year} · {fuel}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <div className="flex flex-wrap gap-3">
                  <Dialog
                    open={pdfOpen}
                    onOpenChange={(open) => {
                      setPdfOpen(open);
                      if (open) setPdfError('');
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="secondary">Scarica PDF</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xl">
                      <DialogHeader>
                        <DialogTitle>Certificazione interna</DialogTitle>
                        <DialogDesc>
                          Inserisci i dati per generare il PDF. Queste informazioni non vengono salvate.
                        </DialogDesc>
                      </DialogHeader>
                      <div className="mt-6 grid gap-4">
                        <label className="grid gap-2 text-sm text-slate-700">
                          Nominativo
                          <Input
                            value={pdfName}
                            onChange={(e) => setPdfName(e.target.value)}
                            placeholder="Es. Mario Rossi"
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-slate-700">
                          Data
                          <Input
                            type="date"
                            value={pdfDate}
                            onChange={(e) => setPdfDate(e.target.value)}
                          />
                        </label>
                        <label className="grid gap-2 text-sm text-slate-700">
                          Progetto (facoltativo)
                          <Input
                            value={pdfProject}
                            onChange={(e) => setPdfProject(e.target.value)}
                            placeholder="Es. Trasferta cliente X"
                          />
                        </label>
                        {pdfError && <p className="text-xs text-rose-600">{pdfError}</p>}
                      </div>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <Button variant="secondary" onClick={handleDownloadPdf}>
                          Genera PDF
                        </Button>
                        <DialogClose asChild>
                          <Button variant="ghost">Annulla</Button>
                        </DialogClose>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button variant="ghost" onClick={handleSave} loading={saving}>
                    Salva calcolo
                  </Button>
                </div>
                {saveMessage && <p className="text-xs text-muted-foreground">{saveMessage}</p>}

              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Compila i campi per vedere il risultato.</p>
            )}
          </CardContent>
        </Card>

        <Card id="fonti" className="mt-10 bg-white/80">
          <CardHeader>
            <CardTitle>Trasparenza</CardTitle>
            <CardDescription>Fonti e responsabilità</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Non affiliato ad ACI. Dati da Gazzetta Ufficiale n. 297 del 23/12/2025, Suppl. Ord. n. 40.
              Distanze da OpenRouteService / OpenStreetMap.
            </p>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
