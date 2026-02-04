# Costi chilometrici

Applicazione React/Vite + backend Express per calcolare i costi chilometrici ACI 2026 con distanza reale (OpenRouteService).

## Configurazione

- Crea `.env` partendo da `.env.example`
- Imposta `ORS_API_KEY`

Nota: **non** usiamo PostgreSQL e non serve `DATABASE_URL`. L'app usa SQLite locale in `data/costi.sqlite`.

## Avvio

```bash
npm run dev
```

## Workflow sviluppo e deploy

Vedi `docs/development.md` per sviluppo locale, provisioning VM e CI/CD.

## Import dati ACI

I file Excel ACI sono in `data/aci-xlsx/`.
Per rigenerare il DB:

```bash
npm run import:aci
```
