# PH-GYS Weight & Balance Calculator — Design Document

## Overview

Interactive weight & balance calculator for the Cessna F172N PH-GYS, hosted at www.phgys.com. Built as a static single-page app on Cloudflare Pages (free tier). Bilingual (NL/EN), SVS branding (orange/white).

## Aircraft Data

| Parameter | Value |
|---|---|
| Aircraft | Reims/Cessna F172N |
| Registration | PH-GYS |
| Serial | F17201871 |
| Owner | Stichting Vliegmaterieel Schiphol (SVS) |
| Base | EHTE (Vliegveld Hilversum) |
| Basic Empty Weight | 680.00 kg |
| Empty CG Arm | 1.02 m |
| Empty Moment | 696.42 m.kg |
| MTOW Normal | 1089 kg |
| MTOW Utility | 952 kg |
| Max Ramp Weight | 1092 kg |
| Useful Load | 409 kg |
| Fuel (long range tanks) | max 190 ltr / 137 kg |
| Fuel density | 0.72 kg/ltr |

### Station Arms

| Station | Arm (m) | Max Weight |
|---|---|---|
| Pilot & Front Passenger | 0.94 | - |
| Rear Passengers | 1.85 | - |
| Fuel | 1.22 | 137 kg (190 ltr) |
| Baggage Area 1 | 2.41 | 54 kg* |
| Baggage Area 2 | 3.12 | 23 kg* |

*Combined baggage max: 54 kg

### CG Limits — Normal Category

| Condition | CG (m) |
|---|---|
| Aft @ 1089 kg | +1.20 |
| Forward @ ≤885 kg | +0.89 |
| Forward @ 1089 kg | +1.00 |
| Interpolation | Linear between 885–1089 kg |

### CG Limits — Utility Category

| Condition | CG (m) |
|---|---|
| Aft @ 952 kg | +1.03 |
| Forward @ ≤885 kg | +0.89 |
| Forward @ 952 kg | +0.93 |
| Interpolation | Linear between 885–952 kg |

## Architecture

### Tech Stack

- Pure HTML/CSS/JS — no framework, no backend
- HTML Canvas for CG envelope graph
- No build step required

### Hosting

- Cloudflare Pages (free tier)
- Auto-deploy from GitHub repo `phgys-wb`
- Custom domain: www.phgys.com via Cloudflare DNS (free SSL)

### File Structure

```
phgys-wb/
├── index.html          # Single page
├── style.css           # SVS branding
├── app.js              # W&B logic + canvas graph + i18n
├── favicon.ico
└── docs/plans/         # This design doc
```

## UI Design

### Layout (Desktop)

- **Header:** SVS logo, "PH-GYS" + aircraft type, language toggle (NL/EN), PIC disclaimer
- **Left panel:** W&B input table with realtime calculation
- **Right panel:** Interactive CG Moment Envelope graph (Canvas)
- **Footer:** Links (Aviatize, phgys.nl), SVS credit, print button

### Layout (Mobile)

- Single column: header → table → graph → footer

### Calculator Rows

1. **Basic Empty Weight** — 680 kg (prefilled, readonly), arm 1.02 m
2. **Pilot & Front Passenger** — kg input, arm 0.94 m
3. **Rear Passengers** — kg input, arm 1.85 m
4. **Baggage Area 1** — kg input (max 54), arm 2.41 m
5. **Baggage Area 2** — kg input (max 23), arm 3.12 m
6. → **Zero Fuel Weight** — subtotal, envelope check
7. **Fuel** — input in liters (max 190), ×0.72 = kg, arm 1.22 m
8. → **Ramp Weight** — subtotal (max 1092 kg)
9. **Taxi Fuel** — liters input (subtracted), arm 1.22 m
10. → **Takeoff Weight** — subtotal (max 1089 kg), CG calculated, envelope check, plotted on graph
11. **Trip Fuel** — liters input (subtracted), arm 1.22 m
12. → **Landing Weight** — subtotal, CG calculated, envelope check, plotted on graph

### Behavior

- Realtime calculation on every input change (no submit button)
- Red warning when max weight or baggage limit exceeded
- Red warning when CG falls outside envelope
- Green indication when all within limits

### Interactive Graph

- X-axis: Moment (m.kg)
- Y-axis: Weight (kg)
- Normal Category envelope as shaded area
- Utility Category envelope as dashed line
- Two moving points: Takeoff (blue) and Landing (green)
- Points turn red when outside envelope

### Bilingual (i18n)

- NL/EN toggle button in header
- All labels and messages stored as a JS translations object
- Language preference saved in localStorage

## Print Layout

One A4 page (portrait), triggered by print button. Uses `@media print` CSS.

From top to bottom:
1. **Compact header:** SVS logo small + "PH-GYS Weight & Balance" + date/time
2. **W&B table:** compact version with all filled values
3. **CG Moment Envelope graph:** scaled down but readable
4. **PIC signature block:**
   - Date (auto, local) + Time (auto, UTC)
   - PIC Name: _____________ (blank line for pen)
   - PIC Signature: _____________ (blank line for pen)
   - Disclaimer text

Hidden in print: language toggle, print button, footer links.

## Styling

SVS brand colors (derived from Operations Manual):
- Primary: Orange (#E8731A or similar — to be extracted from SVS logo)
- Background: White
- Text: Dark gray/black
- Accent: Light orange for table header backgrounds
- Error: Red
- Success: Green

## Footer Links

- Aviatize: https://one.aviatize.com/users/sign-in
- SVS Website: https://www.phgys.nl
- Credit: "Stichting Vliegmaterieel Schiphol"

## Data Sources

- Basic Empty Weight & Arm: Mass and Balance Report AMN-F19A (29-7-2024)
- Station arms & CG limits: Airplane Flight Manual Reims/Cessna F172N (Edition 4, September 1978) with handwritten corrections for PH-GYS
- Quick reference: W&B quick reference card PH-GYS (C172-P long range tanks)
