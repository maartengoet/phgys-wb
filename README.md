# PH-GYS Weight & Balance Calculator

Interactive weight & balance plus takeoff-distance planning tools for **PH-GYS**, a Reims/Cessna F172N operated by [Stichting Vliegmaterieel Schiphol](https://www.phgys.nl) (SVS) at EHTE.

**Live:** [www.phgys.com](https://www.phgys.com)

## Features

### Weight & Balance (`/`)
- Real-time W&B calculation with CG envelope check
- Ramp, takeoff, and landing weight calculation with taxi/trip fuel burn
- Interactive CG Moment Envelope graph (Normal + Utility category, takeoff + landing points)
- Bilingual (NL/EN) with persistent language preference
- Print to A4 with PIC signature block
- Fuel display in liters, kg, and US gallons

### Takeoff Distance — EHHV (`/takeoff.html`)
- Per-runway takeoff performance check for EHHV (Hilversum)
- POH lookup with bilinear interpolation over pressure altitude / OAT and linear interpolation over weight
- Wind, gust, dry-grass correction per POH note 4 and PH-GYS wet-grass correction
- Color flag (green/orange/red) against TORA/TODA with 1.25× safety factor
- Edge-case warnings: TOW > 1043 kg (POH-table extrapolation), tailwind > 10 kt, OAT/PA out of range, crosswind > 15 kt
- Per-runway compass mini-chart (click to enlarge with details)
- TOW pre-filled from the W&B page via `sessionStorage`
- Print / Save-as-PDF (browser-native)

### POH Tables Reference (`/takeoff-tables.html`)
- All three POH takeoff-distance tables (862 / 953 / 1043 kg) rendered for printing
- Correction factors and PIC disclaimer
- High-resolution PDF via browser Print → Save as PDF

## Tech

Pure HTML/CSS/JS — no framework, no build step, no backend. Pure-calc functions are unit-tested with built-in `node --test` (no npm dependencies). Deploys automatically on push to `main` (Cloudflare Pages, free tier).

## Tests

```bash
node --test
```

## Documentation

- [Architecture](docs/architecture.md) — how the app works
- [Aircraft Data](docs/aircraft-data.md) — PH-GYS specific W&B data and sources
- [Deployment](docs/deployment.md) — CI/CD pipeline and hosting setup
- [Takeoff Calculator — design](docs/plans/2026-04-29-takeoff-distance-design.md)
- [Takeoff Calculator — implementation plan](docs/plans/2026-04-29-takeoff-distance-implementation.md)

## Disclaimer

The PIC is responsible for ensuring all calculations are correct. These tools are planning aids only; verify against the actual POH and current conditions before each flight.
