# PH-GYS Weight & Balance Calculator

Interactive weight & balance calculator for **PH-GYS**, a Reims/Cessna F172N operated by [Stichting Vliegmaterieel Schiphol](https://www.phgys.nl) (SVS) at EHTE.

**Live:** [www.phgys.com](https://www.phgys.com)

## Features

- Real-time W&B calculation with CG envelope check
- Interactive CG Moment Envelope graph (Normal + Utility category)
- Bilingual (NL/EN) with persistent language preference
- Print to A4 with PIC signature block
- Fuel display in liters, kg, and US gallons
- Zero cost hosting on Cloudflare Pages

## Tech

Pure HTML/CSS/JS — no framework, no build step, no backend. Deploys automatically on push to `main`.

## Documentation

- [Architecture](docs/architecture.md) — how the app works
- [Aircraft Data](docs/aircraft-data.md) — PH-GYS specific W&B data and sources
- [Deployment](docs/deployment.md) — CI/CD pipeline and hosting setup

## Disclaimer

The PIC is responsible for ensuring all calculations are correct. This tool is provided as-is without warranty.
