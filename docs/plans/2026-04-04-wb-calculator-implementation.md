# PH-GYS W&B Calculator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an interactive Weight & Balance calculator for PH-GYS at www.phgys.com

**Architecture:** Pure static HTML/CSS/JS single-page app. All W&B calculations run client-side. CG envelope rendered on HTML Canvas. Bilingual via JS translations object. No build step, no framework.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, HTML Canvas API

**Design doc:** `docs/plans/2026-04-04-wb-calculator-design.md`

---

### Task 1: HTML Skeleton

**Files:**
- Create: `index.html`

**Step 1: Create the HTML structure**

Create `index.html` with:
- DOCTYPE, lang attribute, meta viewport, charset
- Link to `style.css`, defer `app.js`
- `<header>`: SVS logo placeholder (text for now), "PH-GYS — Reims/Cessna F172N", language toggle button, PIC disclaimer
- `<main>` with two columns: `.calculator` (left) and `.envelope-graph` (right)
- Calculator: `<table>` with rows per the design doc (all 12 rows). Input fields get `id` attributes matching their role: `input-pilot`, `input-rear`, `input-bag1`, `input-bag2`, `input-fuel`, `input-taxi`, `input-trip`. Computed fields get ids: `total-zfw`, `total-ramp`, `total-tow`, `total-ldw`, `cg-tow`, `cg-ldw`, `moment-*` for each row.
- Subtotal rows (ZFW, Ramp, TOW, LDW) are visually distinct (`<tr class="subtotal">`)
- Status indicators per subtotal row: `<span class="status">` for OK/warning
- `<canvas id="cg-canvas">` in the right column
- `<footer>`: links (Aviatize, phgys.nl), SVS credit, print button
- PIC signature block (visible only in print): date/time, name line, signature line, disclaimer

**Step 2: Verify in browser**

Run: `open index.html` (or live-server)
Expected: Unstyled but complete HTML structure visible. All input fields present. Canvas placeholder visible.

**Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add HTML skeleton with calculator table and canvas"
```

---

### Task 2: CSS — SVS Branding & Responsive Layout

**Files:**
- Create: `style.css`

**Step 1: Write the stylesheet**

Implement in `style.css`:

**Variables:**
```css
:root {
  --svs-orange: #E8731A;
  --svs-orange-light: #FFF3EB;
  --svs-orange-dark: #C45F10;
  --text-dark: #333;
  --bg-white: #fff;
  --success: #2E7D32;
  --error: #C62828;
}
```

**Layout:**
- `main`: CSS Grid, 2 columns (1fr 1fr) on desktop, 1 column on mobile (`@media max-width: 768px`)
- Header: flex, space-between, orange background, white text
- Language toggle: styled button, top-right
- Calculator table: full width, clean borders, `--svs-orange-light` header backgrounds
- Subtotal rows: bold, slightly darker background
- Input fields: right-aligned numbers, consistent width
- Readonly fields: light gray background
- Status spans: small pill badges (green/red)
- Canvas container: sticky top on desktop so graph stays visible while scrolling table
- Footer: centered, subtle gray background, orange links

**Print styles** (`@media print`):
- Hide: header nav, language toggle, print button, footer links
- Show: PIC signature block
- Scale everything to fit A4 portrait (max-width: 190mm)
- Table: compact font (10px), reduced padding
- Canvas: max-height ~40% of page
- PIC block: border, padding, positioned at bottom
- `@page { margin: 10mm; size: A4 portrait; }`

**Step 2: Verify in browser**

Run: `open index.html`
Expected: Orange header, clean table layout, two-column desktop, single column on narrow window. Print preview shows A4 fit with signature block.

**Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add SVS-branded stylesheet with responsive and print layout"
```

---

### Task 3: W&B Calculation Engine

**Files:**
- Create: `app.js`

**Step 1: Define aircraft data constants**

```javascript
const AIRCRAFT = {
  registration: 'PH-GYS',
  type: 'Reims/Cessna F172N',
  emptyWeight: 680.00,
  emptyArm: 1.02,
  emptyMoment: 696.42,
  fuelDensity: 0.72,
  fuelArm: 1.22,
  maxFuelLiters: 190,
  maxRampWeight: 1092,
  maxTakeoffWeight: 1089,
  stations: {
    pilot:  { arm: 0.94 },
    rear:   { arm: 1.85 },
    bag1:   { arm: 2.41, maxKg: 54 },
    bag2:   { arm: 3.12, maxKg: 23 },
    fuel:   { arm: 1.22 },
  },
  maxBaggageCombined: 54,
  cg: {
    normal: {
      maxWeight: 1089,
      aft:  { weight: 1089, cg: 1.20 },
      fwdLow:  { weight: 885, cg: 0.89 },
      fwdHigh: { weight: 1089, cg: 1.00 },
    },
    utility: {
      maxWeight: 952,
      aft:  { weight: 952, cg: 1.03 },
      fwdLow:  { weight: 885, cg: 0.89 },
      fwdHigh: { weight: 952, cg: 0.93 },
    },
  },
};
```

**Step 2: Implement calculation functions**

```javascript
function calculate() {
  // 1. Read all inputs (parse as float, default 0)
  // 2. Convert fuel liters to kg (* 0.72)
  // 3. For each row: weight × arm = moment
  // 4. Compute subtotals: ZFW, Ramp, TOW, LDW
  // 5. Compute CG for TOW and LDW: total moment / total weight
  // 6. Check limits (weight limits, baggage limits, CG envelope)
  // 7. Update all display fields
  // 8. Update graph
}
```

Key calculations:
- ZFW = empty + pilot + rear + bag1 + bag2
- Ramp = ZFW + fuel
- TOW = Ramp - taxi fuel
- LDW = TOW - trip fuel
- CG = total moment / total weight

**Step 3: Implement CG limit checking**

```javascript
function getCGLimits(weight, category) {
  const cat = AIRCRAFT.cg[category];
  if (weight <= cat.fwdLow.weight) {
    return { fwd: cat.fwdLow.cg, aft: /* interpolate aft */ };
  }
  // Linear interpolation for forward limit between fwdLow and fwdHigh
  // Aft limit: constant at cat.aft.cg for normal, or interpolate for utility
}

function isInEnvelope(weight, cg, category) {
  const limits = getCGLimits(weight, category);
  return cg >= limits.fwd && cg <= limits.aft;
}
```

**Step 4: Wire up event listeners**

- Add `input` event listener to all input fields
- Each triggers `calculate()`
- `calculate()` updates DOM and calls `drawGraph()`

**Step 5: Verify in browser**

Enter sample values from Flight Manual (Figure 4-1):
- Pilot: 154 kg → moment should be ~145 m.kg
- Rear: 77 kg → moment should be ~142 m.kg
- Fuel: 152 liters (standard) = 109 kg → moment should be ~133 m.kg
- Baggage: 53 kg → moment should be ~128 m.kg

Expected: All moments calculate correctly, subtotals update in realtime.

**Step 6: Commit**

```bash
git add app.js
git commit -m "feat: add W&B calculation engine with realtime updates"
```

---

### Task 4: CG Moment Envelope Graph

**Files:**
- Modify: `app.js` (add graph drawing functions)

**Step 1: Define envelope polygon coordinates**

The CG Moment Envelope uses Weight (Y) vs Moment (X). Convert CG limits to moment limits:
- moment = weight × cg

Normal Category envelope polygon (weight, moment) points:
```javascript
const NORMAL_ENVELOPE = [
  // Forward limit (bottom to top)
  { weight: 680, moment: 680 * 0.89 },   // ~605
  { weight: 885, moment: 885 * 0.89 },   // ~788
  { weight: 1089, moment: 1089 * 1.00 }, // 1089
  // Aft limit (top to bottom)
  { weight: 1089, moment: 1089 * 1.20 }, // ~1307
  { weight: 885, moment: 885 * 1.20 },   // ~1062
  { weight: 680, moment: 680 * 1.20 },   // ~816
];
```

Similarly for Utility Category.

**Step 2: Implement drawGraph()**

```javascript
function drawGraph() {
  const canvas = document.getElementById('cg-canvas');
  const ctx = canvas.getContext('2d');
  // 1. Clear canvas
  // 2. Set up coordinate system (moment on X, weight on Y, Y inverted)
  // 3. Draw grid lines and axis labels
  // 4. Draw Normal envelope (filled, semi-transparent orange)
  // 5. Draw Utility envelope (dashed line)
  // 6. Plot Takeoff point (blue dot, or red if outside)
  // 7. Plot Landing point (green dot, or red if outside)
  // 8. Draw legend
}
```

Handle canvas sizing: set canvas width/height from container, redraw on resize.

**Step 3: Verify in browser**

Expected: Envelope shape matches Figure 4-4 from Flight Manual. Takeoff/landing points move as inputs change. Points turn red when dragged outside envelope.

**Step 4: Commit**

```bash
git add app.js
git commit -m "feat: add interactive CG moment envelope graph on canvas"
```

---

### Task 5: Validation & Warning Indicators

**Files:**
- Modify: `app.js` (add validation logic)
- Modify: `style.css` (if needed for warning styles)

**Step 1: Implement validation checks**

In `calculate()`, after computing all values, check:
- Baggage Area 1 > 54 kg → warning
- Baggage Area 2 > 23 kg → warning
- Combined baggage > 54 kg → warning
- Ramp Weight > 1092 kg → warning
- Takeoff Weight > 1089 kg → warning
- Fuel > 190 liters → warning
- Taxi fuel > total fuel → warning (negative fuel)
- Trip fuel > (fuel - taxi) → warning
- CG at TOW outside Normal envelope → warning
- CG at LDW outside Normal envelope → warning

**Step 2: Update status indicators**

For each check, update the corresponding `<span class="status">`:
- Within limits: green pill "OK" / checkmark
- Exceeded: red pill with specific message (e.g. "OVER MAX" / "CG AFT" / "CG FWD")

Highlight the input field border red if its value exceeds a limit.

**Step 3: Verify in browser**

Test cases:
- Enter 600 kg fuel (>190 liters) → fuel field red, ramp/TOW warnings
- Enter 60 kg baggage 1 → bag1 red warning
- Enter values that put CG forward of limit → CG warning + red dot on graph
- Enter normal values → all green

**Step 4: Commit**

```bash
git add app.js style.css
git commit -m "feat: add weight and CG limit validation with visual warnings"
```

---

### Task 6: Bilingual Support (NL/EN)

**Files:**
- Modify: `app.js` (add translations + toggle logic)
- Modify: `index.html` (add `data-i18n` attributes to translatable elements)

**Step 1: Define translations object**

```javascript
const TRANSLATIONS = {
  nl: {
    title: 'Gewicht & Balans',
    subtitle: 'PH-GYS — Reims/Cessna F172N',
    disclaimer: 'De gezagvoerder is verantwoordelijk voor de juistheid van alle berekeningen.',
    emptyWeight: 'Leeg Gewicht',
    pilotFrontPax: 'Piloot & Voorpassagier',
    rearPax: 'Achterpassagiers',
    baggage1: 'Bagageruimte 1 (max 54 kg)',
    baggage2: 'Bagageruimte 2 (max 23 kg)',
    zfw: 'Gewicht Zonder Brandstof',
    fuel: 'Brandstof (max 190 ltr)',
    rampWeight: 'Platformgewicht',
    taxiFuel: 'Taxibrandstof',
    takeoffWeight: 'Startgewicht',
    tripFuel: 'Reisbrandstof',
    landingWeight: 'Landingsgewicht',
    weight: 'Gewicht (kg)',
    arm: 'Arm (m)',
    moment: 'Moment (m.kg)',
    liters: 'Liters',
    print: 'Afdrukken',
    picName: 'Naam Gezagvoerder',
    picSignature: 'Handtekening Gezagvoerder',
    ok: 'OK',
    overMax: 'BOVEN MAX',
    cgAft: 'ZP ACHTER',
    cgFwd: 'ZP VOOR',
    normal: 'Normaal',
    utility: 'Utility',
    takeoff: 'Start',
    landing: 'Landing',
    // ... etc
  },
  en: {
    title: 'Weight & Balance',
    subtitle: 'PH-GYS — Reims/Cessna F172N',
    disclaimer: 'The PIC is responsible for ensuring all calculations are correct.',
    emptyWeight: 'Empty Weight',
    pilotFrontPax: 'Pilot & Front Passenger',
    rearPax: 'Rear Passengers',
    baggage1: 'Baggage Area 1 (max 54 kg)',
    baggage2: 'Baggage Area 2 (max 23 kg)',
    zfw: 'Zero Fuel Weight',
    fuel: 'Fuel (max 190 ltr)',
    rampWeight: 'Ramp Weight',
    taxiFuel: 'Taxi Fuel',
    takeoffWeight: 'Takeoff Weight',
    tripFuel: 'Trip Fuel',
    landingWeight: 'Landing Weight',
    weight: 'Weight (kg)',
    arm: 'Arm (m)',
    moment: 'Moment (m.kg)',
    liters: 'Liters',
    print: 'Print',
    picName: 'PIC Name',
    picSignature: 'PIC Signature',
    ok: 'OK',
    overMax: 'OVER MAX',
    cgAft: 'CG AFT',
    cgFwd: 'CG FWD',
    normal: 'Normal',
    utility: 'Utility',
    takeoff: 'Takeoff',
    landing: 'Landing',
    // ... etc
  },
};
```

**Step 2: Implement language switching**

```javascript
function setLanguage(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = TRANSLATIONS[lang][el.dataset.i18n];
  });
  localStorage.setItem('lang', lang);
  drawGraph(); // redraw with translated labels
}
```

- On page load: check `localStorage.getItem('lang')` or default to `'nl'`
- Toggle button switches between `'nl'` and `'en'`

**Step 3: Add data-i18n attributes to HTML**

Add `data-i18n="key"` to all translatable `<th>`, `<td>`, `<span>`, `<button>` elements in `index.html`.

**Step 4: Verify in browser**

Toggle NL→EN→NL. All labels, headers, warnings, graph labels should switch. Preference persists after page reload.

**Step 5: Commit**

```bash
git add index.html app.js
git commit -m "feat: add bilingual NL/EN support with localStorage persistence"
```

---

### Task 7: Print Layout & PIC Signature Block

**Files:**
- Modify: `style.css` (refine print styles)
- Modify: `app.js` (auto-fill date/time on print)
- Modify: `index.html` (PIC signature block markup)

**Step 1: Refine the PIC signature block HTML**

Ensure the signature block in `index.html` contains:
- Auto-filled date (local format) and time (UTC)
- Blank lines for PIC name and signature
- Disclaimer text

**Step 2: Add print trigger in JS**

```javascript
function printPage() {
  // Fill in date/time fields
  const now = new Date();
  document.getElementById('print-date').textContent = now.toLocaleDateString();
  document.getElementById('print-time').textContent = now.toUTCString().slice(-12, -4) + ' UTC';
  window.print();
}
```

**Step 3: Refine @media print CSS**

- Ensure canvas renders in print (may need to convert to image via `canvas.toDataURL()` and insert an `<img>`)
- Test A4 fit: table + graph + signature block all on one page
- Compact spacing, smaller fonts where needed
- Page break control: `break-inside: avoid` on major sections

**Step 4: Verify**

Print preview in browser (Cmd+P). Check:
- Fits on 1 A4 page
- Table values visible and correct
- Graph visible
- PIC block with date/time, empty name/signature lines
- No screen-only elements (buttons, links) visible

**Step 5: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add print layout with PIC signature block, A4 page fit"
```

---

### Task 8: Polish & Final Touches

**Files:**
- Modify: `index.html` (meta tags, favicon link)
- Modify: `style.css` (final tweaks)
- Modify: `app.js` (edge cases)
- Create: `favicon.ico` (SVS-themed, can be generated or placeholder)

**Step 1: Add meta tags**

```html
<meta name="description" content="Weight & Balance Calculator for PH-GYS (Reims/Cessna F172N) - Stichting Vliegmaterieel Schiphol">
<meta name="theme-color" content="#E8731A">
<link rel="icon" href="favicon.ico">
<title>PH-GYS Weight & Balance</title>
```

**Step 2: Handle edge cases**

- Empty inputs treated as 0 (not NaN)
- Negative values prevented (input min="0")
- Graph handles zero-weight gracefully (no division by zero for CG)
- Canvas resizes correctly on window resize (debounced)

**Step 3: Add a Reset button**

Clear all input fields back to defaults. Place next to Print button.

**Step 4: Cross-browser verify**

Open in Chrome and Safari. Check:
- Layout renders correctly
- Inputs work
- Graph draws
- Print preview OK
- Language toggle works

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add meta tags, edge case handling, reset button, final polish"
```

---

### Task 9: Deploy to Cloudflare Pages

**This task is manual / assisted:**

**Step 1: Connect GitHub repo to Cloudflare Pages**

1. Go to Cloudflare Dashboard → Pages
2. Create new project → Connect to Git → Select `phgys-wb` repo
3. Build settings: Framework preset = None, Build command = (empty), Output directory = `/`
4. Deploy

**Step 2: Add custom domain**

1. In Cloudflare Pages project settings → Custom domains
2. Add `www.phgys.com` and `phgys.com`
3. Cloudflare handles DNS + SSL automatically (domain is already on Cloudflare)

**Step 3: Verify live site**

Open https://www.phgys.com
- Calculator works
- Graph renders
- Print fits A4
- Language toggle works
- Mobile responsive

**Step 4: Commit any deploy config if needed**

---

## Task Summary

| Task | Description | Files |
|---|---|---|
| 1 | HTML skeleton | `index.html` |
| 2 | CSS SVS branding + responsive | `style.css` |
| 3 | W&B calculation engine | `app.js` |
| 4 | CG envelope graph (Canvas) | `app.js` |
| 5 | Validation & warnings | `app.js`, `style.css` |
| 6 | Bilingual NL/EN | `index.html`, `app.js` |
| 7 | Print layout + PIC block | `index.html`, `style.css`, `app.js` |
| 8 | Polish & edge cases | all files |
| 9 | Deploy to Cloudflare Pages | manual |
