# PH-GYS Takeoff Distance Calculator — Design Document

## Overview

Companion page to the existing W&B calculator that answers a single question: "Met mijn W&B en de huidige condities, kom ik weg van de geselecteerde EHHV-baan?" Output is a per-runway performance card with required vs. available distances and a green/orange/red flag — informational only, the pilot-in-command (PIC) decides.

Hosted at `phgys.com/takeoff.html` (or similar) on the same Cloudflare Pages deploy as the existing site. Vanilla HTML/CSS/JS; no build step.

## Scope (v1)

In scope:
- Takeoff distance calculation for PH-GYS at EHHV (Hilversum, 6 grass runways)
- POH-table lookup (Cessna F172N AFM Section 5) with interpolation
- Wind, gust, surface (dry/wet grass), pressure altitude, OAT corrections
- Multi-runway selection (pilot picks active runway(s) from ATC/AFIS)
- TOW pre-filled from W&B page via `sessionStorage`
- Bilingual labels consistent with existing W&B page
- Color flags + safety thresholds + edge-case warnings

Out of scope (v1):
- Landing distance (separate future page)
- Other airfields than EHHV
- Slope (EHHV is flat per AIP)
- METAR-string parser for wind input
- Live wind/METAR data fetch
- Density-altitude-based humidity correction

## Architecture

Static page in same repo: `takeoff.html` + `takeoff.js` + extends `style.css`.

**Modules in `takeoff.js`** (logical, single-file is fine):
- **POH lookup** — embedded data tables (3 weights × 9 pressure altitudes × 5 temperatures × 2 metrics) + interpolation
- **Corrections** — wind, surface, tailwind factors
- **Runways** — EHHV runway data + wind component math
- **Controller** — input wiring, render

**Data flow:**
1. User completes W&B on `index.html`
2. New "Runway performance →" button stores TOW in `sessionStorage` and navigates to `takeoff.html`
3. `takeoff.html` reads TOW (overridable), accepts atmosphere + wind + runway selection
4. On every input change: recompute and re-render runway cards

## Inputs

### Aircraft
| Field | Type | Notes |
|---|---|---|
| TOW | number, kg | Pre-filled from W&B page; user can override |

### Atmosphere
| Field | Type | Notes |
|---|---|---|
| OAT | number, °C | Outside air temperature |
| QNH | number, hPa | Used to derive pressure altitude |

Pressure altitude is computed and shown read-only:
`PA = 3 ft + (1013 − QNH) × 27 ft/hPa`
(EHHV elevation = 3 ft AMSL.)

### Wind
| Field | Type | Notes |
|---|---|---|
| Direction | number, °true (0–360) | "Calm" = 0 |
| Speed | number, kt | Steady wind |
| Gust | number, kt | Optional; if blank, no gust |

### Surface
Radio buttons:
- **Dry grass** (default for EHHV)
- **Wet grass**

(No "paved" option — EHHV is grass-only.)

### Runway selection
Multi-select checkboxes for the six EHHV runways: 07 / 25 / 12 / 30 / 18 / 36. User selects whichever runway(s) ATC/AFIS reports active.

## Calculation

For each selected runway, in order:

### 1. Wind components
Given runway true bearing `rwy_brg` and wind direction `wind_dir`:
- `Δ = wind_dir − rwy_brg` (normalized to [−180°, 180°])
- `headwind = wind_speed × cos(Δ)` (negative = tailwind)
- `crosswind = wind_speed × |sin(Δ)|`

Gust handling (conservative pilot practice):
- For **headwind benefit** in distance calculation: use the **lower** of `wind_speed` and `gust` (i.e., baseline only — no credit for gust)
- For **tailwind penalty**: use the **higher** value (gust if present)
- For **crosswind limit check**: use the **higher** value (gust if present)

### 2. Pressure altitude
`PA = 3 + (1013 − QNH) × 27` (in feet)

### 3. POH lookup
Tables digitized from AFM Section 5 (pages 5-6, 5-7, 5-8) for weights 862 / 950 / 1043 kg, pressure altitudes SL / 1000 / 2000 / 3000 / 4000 / 5000 / 6000 / 7000 / 8000 ft, temperatures 0 / 10 / 20 / 30 / 40 °C, with both ground roll and total-distance-over-15m-obstacle.

Interpolation order:
1. Bilinear over (PA, OAT) within each weight table → produces (GR, total) for each of the three weights
2. Linear over weight between the three resulting pairs → final (GR, total) at actual TOW

For TOW > 1043 kg: linearly extrapolate using the 950→1043 trend; flag prominently as out-of-range.

### 4. Corrections
Applied in this order (per POH notes 3 and 4):

a) **Surface** (POH note 4 — "for operation on a dry grass runway, increase distances by 15% of the ground roll figure"):
   - Compute `Δ_surface = factor × GR_baseline` where `factor` is 0.15 (dry grass) or 0.25 (wet grass)
   - `GR_corrected = GR_baseline + Δ_surface`
   - `total_corrected = total_baseline + Δ_surface` (same absolute meters added to both per POH wording)

b) **Wind** (POH note 3):
   - Headwind: `distance *= (1 − 0.10 × headwind / 9)`
   - Tailwind: `distance *= (1 + 0.10 × tailwind / 2)` (only valid up to 10 kt tailwind per POH)

Crosswind does **not** affect distance — it's evaluated separately for limit check.

### 5. Compare to declared distances
| Required | Compared against |
|---|---|
| Ground roll (after corrections) | TORA |
| Total over 15m obstacle (after corrections) | TODA |

EHHV declared distances (from AIP EHHV AD 2.13, AIRAC AMDT 03/2026):

| RWY | True BRG | TORA | TODA |
|---|---|---|---|
| 07 | 069° | 540 | 540 |
| 25 | 249° | 600 | 600 |
| 12 | 123° | 660 | 660 |
| 30 | 303° | 660 | 660 |
| 18 | 179° | 700 | 700 |
| 36 | 359° | 700 | 700 |

### 6. Color flag
Worst of the two metrics (ground roll and obstacle distance) determines the flag:
- 🟢 **Green** — `available ≥ required × 1.25` for both metrics (≥25% margin)
- 🟠 **Orange** — `required ≤ available < required × 1.25` (any metric in this band)
- 🔴 **Red** — `required > available` (any metric)

Crosswind check (independent of distance):
- ⚠️ Extra warning if max crosswind > **15 kt** (F172N demonstrated maximum)

## Output / UI

Single page, two-column on desktop, stacked on mobile.

**Header:** title + back-link to W&B page.

**Input panel** (top, collapsible on mobile): all inputs from the section above.

**Derived values** (one line, read-only):
> `PA: 273 ft  ·  ISA dev: +5°C`

**Runway cards** (one per selected runway):
```
┌─────────────────────────────────────────────────────┐
│ RWY 25  (249°)                              🟢      │
│                                                     │
│ Wind:    Head 12 kt  ·  Cross 6 kt L                │
│                                                     │
│              Required    Available   Margin         │
│ Ground roll   285 m       600 m      +315 m (52%)   │
│ Over 15m obs  510 m       600 m      +90 m  (15%)   │
│                                                     │
│ Surface: dry grass (+15% GR)                        │
└─────────────────────────────────────────────────────┘
```

**Disclaimer / footer:**
- "Berekening op basis van Cessna F172N AFM Section 5 (Edition 1, Aug 1976). Slechts hulpmiddel voor planning."
- "**De pilot-in-command (PIC) blijft te allen tijde verantwoordelijk** voor de go/no-go beslissing en moet de berekening verifiëren tegen de actuele POH en omstandigheden."
- Link to EHHV AIP for declared distances.

## Edge cases / warnings

Rendered as a banner at the top of the results when triggered:

| Condition | Severity | Message |
|---|---|---|
| TOW > 1043 kg | 🟠 Warning | "TOW boven POH-tabelrange (max 1043 kg). Berekening geëxtrapoleerd; gebruik conservatief." |
| Tailwind > 10 kt op een geselecteerde baan | 🔴 Error | "Tailwind > 10 kt valt buiten POH-correctie. Resultaat onbetrouwbaar." |
| OAT > 40°C of < 0°C | 🔴 Error | "OAT buiten POH-range (0–40°C)." |
| PA > 8000 ft | 🔴 Error | "Pressure altitude buiten POH-range (max 8000 ft)." |
| Crosswind (incl. gust) > 15 kt | 🔴 Warning | "Crosswind boven gedemonstreerd maximum (15 kt) op RWY xx." |
| Geen baan geselecteerd | ℹ️ Info | "Selecteer ten minste één baan." |

## Testing

Manual verification (no test framework yet in repo):
1. Sea-level / 0°C / no wind / 1043 kg / dry grass → match POH table value × 1.15 GR
2. SL / 20°C / 9 kt headwind / 950 kg / dry grass → table lookup × 0.9 (wind) × 1.15 (surface)
3. 5000 ft / 30°C / calm / 862 kg → bilinear interpolation matches POH table cell
4. RWY 07, wind 250/15 → tailwind 14.1 kt, crosswind 5.1 kt → tailwind > 10 kt error fires
5. TOW 1080 kg → out-of-range warning fires; extrapolation gives plausible monotonic increase
6. Flag boundaries on RWY 25 (TODA 600 m): required = 480 m → 25% margin → green/orange boundary; required = 550 m → 9% margin → orange; required = 700 m → red.

## Open items

- Wet-grass factor: design uses **+25% on ground roll**. The handwritten annotation on the POH chart ("wet grass +4-5°"?) is unclear. Implementation should preserve the current factor as a documented constant for easy adjustment later.

## File layout

```
phgys-wb/
├── index.html          (existing — add "Runway performance →" button)
├── takeoff.html        (new)
├── style.css           (extend)
├── app.js              (existing — emit TOW to sessionStorage on calc)
├── takeoff.js          (new — controller + POH data + corrections + runways)
└── docs/
    └── plans/
        └── 2026-04-29-takeoff-distance-design.md   (this file)
```
