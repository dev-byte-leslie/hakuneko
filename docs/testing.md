# Testing

## Connector Smoke Tests

Tiered smoke test suite that validates connector functionality **outside Electron**. Lives in `tools/smoke-test/`.

### Setup

```bash
cd tools/smoke-test && bun install
```

### Running Locally

```bash
cd tools/smoke-test
bun run tier1          # URL validation — all 1,334 connectors (~30 min)
bun run tier2          # Manga list — top 50 connectors (~5 min)
bun run tier3          # Full pipeline — top 10 connectors (~5 min)
```

Or from the project root:

```bash
bun run test:smoke:tier1
bun run test:smoke:tier2
bun run test:smoke:tier3
```

### Tiers

| Tier | What it tests | Connectors | Trigger (CI) |
|------|--------------|------------|--------------|
| 1 | HTTP HEAD on base URL (site alive?) | All 1,334 | Every push to master |
| 2 | `_getMangas()` returns data | Top 50 (curated) | Weekly cron (Monday 04:00 UTC) |
| 3 | Full pipeline: manga → chapters → pages | Top 10 (curated) | Weekly cron (Monday 04:00 UTC) |

### Reports

Reports are written to `tools/smoke-test/reports/` (gitignored):
- `tier{N}-junit.xml` — JUnit XML for CI dashboards
- `tier{N}-summary.json` — machine-readable pass/fail per connector

### Curated Lists

- `tools/smoke-test/curations/tier2-top50.json` — top 50 by popularity and template diversity
- `tools/smoke-test/curations/tier3-top10.json` — top 10 with seed manga data for full pipeline

### CI Workflows

- `.github/workflows/smoke-tier1.yml` — runs on push to master
- `.github/workflows/smoke-tier2-3.yml` — weekly cron + manual dispatch

Both use `continue-on-error: true` — individual connector failures are informational, not build-blocking. No API tokens or paid services required.

### Key Files

| File | Purpose |
|------|---------|
| `tools/smoke-test/run.mjs` | CLI entry point (`--tier=1\|2\|3`) |
| `tools/smoke-test/lib/engine-mock.mjs` | Stubs Electron/browser globals for Bun |
| `tools/smoke-test/lib/connector-loader.mjs` | Dynamic import with optional ID filter |
| `tools/smoke-test/lib/url-extractor.mjs` | Lightweight text-based URL extraction (no imports) |
| `tools/smoke-test/lib/http-client.mjs` | `headOrGet()` with concurrency limiting |
| `tools/smoke-test/lib/report-writer.mjs` | JUnit XML + JSON output |

---

## E2E Tests (Electron)

Legacy Electron+Puppeteer test suite. Currently disabled in CI (marked unreliable).

```bash
bun run test:e2e
```

---

## Unit Tests

```bash
bun run test
```
