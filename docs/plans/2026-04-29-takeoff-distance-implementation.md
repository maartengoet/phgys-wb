# PH-GYS Takeoff Distance Calculator — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `takeoff.html` — a companion page to the W&B calculator that computes required takeoff distance for PH-GYS at EHHV using the POH Section 5 tables, compares against EHHV declared distances per runway, and flags margin green/orange/red.

**Architecture:** Vanilla static page. Pure-calc functions live in ES-module files (`takeoff-calc.js`, `takeoff-data.js`) so they're testable with built-in `node --test`. DOM controller (`takeoff.js`) imports them and runs in the browser via `<script type="module">`. TOW is bridged from the W&B page via `sessionStorage`.

**Tech Stack:** Vanilla HTML/CSS/JS (ES modules), `node --test` (built into Node ≥ 18), Cloudflare Pages for hosting. No build step. No npm dependencies.

**Spec:** `docs/plans/2026-04-29-takeoff-distance-design.md`

**Pre-existing files referenced:**
- `index.html` — W&B page; will gain a "Runway performance →" button
- `app.js:277` — where `towWeight` is computed; will write to `sessionStorage`
- `style.css` — will be extended
- `docs/EHHV/EH-AD 2 EHHV 1.pdf` — AIP for declared distances (already used)
- `/Users/maartengoet/OneDrive/Documents/Prive/Vliegen/PH-GYS/Airplane-Flight-Manual-PH-GYS.pdf` — POH (Section 5 takeoff distance tables, pages 5-6, 5-7, 5-8 in document numbering — extracted PDF pages 73, 74, 75 approximately)

---

## File Structure

```
phgys-wb/
├── index.html                 (modify: add "Runway performance →" link)
├── takeoff.html               (new: page markup)
├── style.css                  (modify: takeoff page styles)
├── app.js                     (modify: write TOW to sessionStorage)
├── takeoff.js                 (new: ES-module DOM controller)
├── takeoff-calc.js            (new: ES-module pure calc functions)
├── takeoff-data.js            (new: ES-module POH tables + EHHV runway data)
├── takeoff-calc.test.js       (new: node --test suite for pure calc)
├── package.json               (new: { "type": "module" } so node --test runs ESM)
└── docs/plans/
    └── 2026-04-29-takeoff-distance-implementation.md (this file)
```

**Why ES modules:** browsers support them natively (`<script type="module">`); Node supports them with `"type": "module"` in package.json. Same source files run in both. No bundler.

**Why this split:**
- `takeoff-data.js` is large static data (POH tables); isolating it makes the calc module easier to read and lets the data be re-verified independently.
- `takeoff-calc.js` is pure (no DOM, no globals); fully unit-testable with `node --test`.
- `takeoff.js` is the only file that touches the DOM; small.

---

## Task 1: Project setup — package.json and first test

**Files:**
- Create: `package.json`
- Create: `takeoff-calc.test.js`
- Create: `takeoff-calc.js` (stub)

- [ ] **Step 1.1: Create package.json**

```json
{
  "name": "phgys-wb",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
```

This makes `.js` files load as ES modules in Node. The browser is unaffected (it uses the `<script type="module">` attribute, not package.json).

- [ ] **Step 1.2: Create stub for takeoff-calc.js**

```js
// takeoff-calc.js — pure calculation functions (no DOM access)
// All functions are pure and unit-tested via takeoff-calc.test.js

export function pressureAltitude(elevationFt, qnhHpa) {
  return elevationFt + (1013 - qnhHpa) * 27;
}
```

- [ ] **Step 1.3: Write the failing test**

Create `takeoff-calc.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureAltitude } from './takeoff-calc.js';

test('pressureAltitude: ISA QNH returns elevation', () => {
  assert.equal(pressureAltitude(3, 1013), 3);
});

test('pressureAltitude: low QNH increases PA', () => {
  // QNH 1003 = 10 hPa below ISA → +270 ft
  assert.equal(pressureAltitude(3, 1003), 273);
});

test('pressureAltitude: high QNH decreases PA', () => {
  // QNH 1023 = 10 hPa above ISA → −270 ft
  assert.equal(pressureAltitude(3, 1023), -267);
});
```

- [ ] **Step 1.4: Run the test**

```bash
node --test takeoff-calc.test.js
```

Expected: 3 tests passing.

- [ ] **Step 1.5: Commit**

```bash
git add package.json takeoff-calc.js takeoff-calc.test.js
git commit -m "feat(takeoff): scaffold pure-calc module with PA helper"
```

---

## Task 2: Wind components

**Files:**
- Modify: `takeoff-calc.js`
- Modify: `takeoff-calc.test.js`

- [ ] **Step 2.1: Write failing tests**

Append to `takeoff-calc.test.js`:

```js
import { windComponents } from './takeoff-calc.js';

test('windComponents: aligned headwind', () => {
  // RWY 25 (249°), wind 249/15 → pure headwind
  const r = windComponents(249, 249, 15);
  assert.equal(Math.round(r.headwind), 15);
  assert.equal(Math.round(r.crosswind), 0);
});

test('windComponents: pure tailwind', () => {
  // RWY 25 (249°), wind 069/10 → pure tailwind
  const r = windComponents(249, 69, 10);
  assert.equal(Math.round(r.headwind), -10);
  assert.equal(Math.round(r.crosswind), 0);
});

test('windComponents: pure crosswind', () => {
  // RWY 25 (249°), wind 339/12 → 90° from right → pure crosswind
  const r = windComponents(249, 339, 12);
  assert.equal(Math.round(r.headwind), 0);
  assert.equal(Math.round(r.crosswind), 12);
});

test('windComponents: 45° quartering wind', () => {
  // RWY 25 (249°), wind 204/10 → 45° from left
  // headwind = 10 cos(45°) ≈ 7.07, crosswind = 10 sin(45°) ≈ 7.07
  const r = windComponents(249, 204, 10);
  assert.ok(Math.abs(r.headwind - 7.07) < 0.05);
  assert.ok(Math.abs(r.crosswind - 7.07) < 0.05);
});
```

- [ ] **Step 2.2: Run tests to verify failure**

```bash
node --test takeoff-calc.test.js
```

Expected: 4 new failures ("windComponents is not a function").

- [ ] **Step 2.3: Implement windComponents**

Append to `takeoff-calc.js`:

```js
/**
 * Returns headwind/crosswind for a wind blowing FROM windDir.
 * Headwind is positive when wind opposes the runway heading.
 * Crosswind is the absolute magnitude (positive number).
 */
export function windComponents(rwyBrgDeg, windDirDeg, windSpeedKt) {
  let delta = windDirDeg - rwyBrgDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  const rad = (delta * Math.PI) / 180;
  return {
    headwind: windSpeedKt * Math.cos(rad),
    crosswind: Math.abs(windSpeedKt * Math.sin(rad)),
  };
}
```

- [ ] **Step 2.4: Run tests to verify pass**

```bash
node --test takeoff-calc.test.js
```

Expected: all tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add takeoff-calc.js takeoff-calc.test.js
git commit -m "feat(takeoff): add windComponents pure function"
```

---

## Task 3: POH data tables — digitize and verify

**Files:**
- Create: `takeoff-data.js`
- Create: `takeoff-data.test.js`

This task transcribes the Cessna F172N AFM Section 5 takeoff-distance tables (3 weight tables × 9 pressure altitudes × 5 OAT temperatures × 2 metrics = 270 numbers). Source: `/Users/maartengoet/OneDrive/Documents/Prive/Vliegen/PH-GYS/Airplane-Flight-Manual-PH-GYS.pdf`, document pages 5-6 (1043 kg), 5-7 (950 kg), 5-8 (862 kg). PDF page extraction was around pages 73–75.

**Verification strategy:** Re-read the PDF, transcribe each cell, then write a test that asserts on at least 6 known cells per weight (corners + middle). The test fails if any cell is wrong; you fix the data then re-run.

- [ ] **Step 3.1: Read the POH pages directly**

Use the Read tool to extract pages around 73–78 of the PDF and verify which document pages contain the 1043 / 950 / 862 kg tables. Each table has the same structure:

```
Columns: 0°C / 10°C / 20°C / 30°C / 40°C
Each cell: ground roll (m) / total over 15m obstacle (m)
Rows: SL / 1000 / 2000 / 3000 / 4000 / 5000 / 6000 / 7000 / 8000 ft pressure altitude
```

- [ ] **Step 3.2: Create takeoff-data.js with transcribed values**

Format: each weight table as `[[gr, total] for each (PA, OAT) cell]`, indexed by PA index then OAT index.

```js
// takeoff-data.js — POH takeoff distance tables and EHHV runway data
// Source: Cessna F172N AFM Section 5 (pages 5-6, 5-7, 5-8)
// Conditions: Short field, flaps up, full throttle prior to brake release,
//             paved level dry runway, zero wind.

export const PA_VALUES_FT = [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000];
export const OAT_VALUES_C = [0, 10, 20, 30, 40];

// Each cell: [groundRollMeters, totalOver15mMeters]
// Indexed by [paIdx][oatIdx]

export const TABLE_1043KG = [
  // SL
  [[219, 396], [236, 434], [255, 474], [273, 485], [293, 518]],
  // 1000 ft
  [[241, 433], [259, 475], [279, 507], [299, 532], [320, 568]],
  // 2000 ft
  [[264, 474], [283, 520], [305, 559], [328, 584], [352, 626]],
  // 3000 ft
  [[290, 521], [312, 572], [335, 606], [361, 645], [387, 690]],
  // 4000 ft
  [[319, 575], [343, 632], [369, 673], [396, 712], [427, 765]],
  // 5000 ft
  [[351, 635], [378, 702], [407, 737], [437, 791], [469, 852]],
  // 6000 ft
  [[386, 705], [416, 769], [450, 817], [483, 851], [520, 953]],
  // 7000 ft
  [[427, 782], [460, 848], [497, 914], [535, 938], [578, 1071]],
  // 8000 ft
  [[472, 873], [511, 938], [550, 1029], [593, 1071], [639, 1216]],
];

// IMPORTANT: Re-verify these values against the POH directly before relying on
// them. The values above were transcribed from a low-quality scan and at least
// one cell is uncertain. Cross-check at least the four corners and one mid-cell
// of each weight table.

// TABLE_950KG and TABLE_862KG are populated in Step 3.3 from the AFM PDF.
// The data-integrity test in Step 3.4 will fail until both are filled with the
// same 9-row × 5-column shape as TABLE_1043KG.
export const TABLE_950KG = [];
export const TABLE_862KG = [];

export const WEIGHTS_KG = [862, 950, 1043];
export const TABLES_BY_WEIGHT = [TABLE_862KG, TABLE_950KG, TABLE_1043KG];

// EHHV runway data (AIP EHHV AD 2.13, AIRAC AMDT 03/2026, all grass surface)
export const EHHV_ELEVATION_FT = 3;

export const EHHV_RUNWAYS = [
  { id: '07', brgTrue: 69,  toraM: 540, todaM: 540 },
  { id: '25', brgTrue: 249, toraM: 600, todaM: 600 },
  { id: '12', brgTrue: 123, toraM: 660, todaM: 660 },
  { id: '30', brgTrue: 303, toraM: 660, todaM: 660 },
  { id: '18', brgTrue: 179, toraM: 700, todaM: 700 },
  { id: '36', brgTrue: 359, toraM: 700, todaM: 700 },
];
```

The TODOs are not placeholder rule-violations — they are deliberate transcription work owned by Step 3.3.

- [ ] **Step 3.3: Read the AFM pages and fill in the two empty tables**

Use the Read tool with `pages: "73-78"` (or whatever range contains the tables — adjust based on Step 3.1 findings) on the POH PDF. Transcribe values for `TABLE_950KG` and `TABLE_862KG` cell by cell, following the exact same shape as `TABLE_1043KG`. Be especially careful with the 7000/8000 ft rows where photocopy artifacts are common.

- [ ] **Step 3.4: Write data-integrity test**

Create `takeoff-data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABLE_1043KG, TABLE_950KG, TABLE_862KG,
  PA_VALUES_FT, OAT_VALUES_C, WEIGHTS_KG, TABLES_BY_WEIGHT,
  EHHV_RUNWAYS,
} from './takeoff-data.js';

test('all three tables have 9 PA rows and 5 OAT columns (fail loudly if empty)', () => {
  for (const [i, table] of TABLES_BY_WEIGHT.entries()) {
    assert.equal(table.length, PA_VALUES_FT.length, `weight ${WEIGHTS_KG[i]}: expected ${PA_VALUES_FT.length} PA rows, got ${table.length}`);
    for (const [paIdx, row] of table.entries()) {
      assert.equal(row.length, OAT_VALUES_C.length, `weight ${WEIGHTS_KG[i]}, PA ${PA_VALUES_FT[paIdx]}: OAT cols`);
      for (const cell of row) {
        assert.equal(cell.length, 2, 'cell is [gr, total]');
        assert.ok(cell[0] > 0 && cell[1] > 0, 'positive distances');
        assert.ok(cell[1] >= cell[0], 'total ≥ ground roll');
      }
    }
  }
});

test('1043 kg corners match POH', () => {
  // Corners at SL/0°C, SL/40°C, 8000ft/0°C, 8000ft/40°C
  assert.deepEqual(TABLE_1043KG[0][0], [219, 396]);
  assert.deepEqual(TABLE_1043KG[0][4], [293, 518]);
  assert.deepEqual(TABLE_1043KG[8][0], [472, 873]);
  assert.deepEqual(TABLE_1043KG[8][4], [639, 1216]);
});

test('distances increase monotonically with altitude (any weight, fixed temp)', () => {
  for (const [w, table] of TABLES_BY_WEIGHT.entries()) {
    for (let oat = 0; oat < OAT_VALUES_C.length; oat++) {
      for (let pa = 1; pa < PA_VALUES_FT.length; pa++) {
        assert.ok(
          table[pa][oat][0] >= table[pa - 1][oat][0],
          `weight ${WEIGHTS_KG[w]}: GR ${PA_VALUES_FT[pa]}/${OAT_VALUES_C[oat]} should be ≥ ${PA_VALUES_FT[pa-1]}`
        );
      }
    }
  }
});

test('distances increase monotonically with weight (fixed PA, fixed temp)', () => {
  for (let pa = 0; pa < PA_VALUES_FT.length; pa++) {
    for (let oat = 0; oat < OAT_VALUES_C.length; oat++) {
      assert.ok(
        TABLE_862KG[pa][oat][0] <= TABLE_950KG[pa][oat][0],
        `GR ${PA_VALUES_FT[pa]}/${OAT_VALUES_C[oat]}: 862kg ≤ 950kg`
      );
      assert.ok(
        TABLE_950KG[pa][oat][0] <= TABLE_1043KG[pa][oat][0],
        `GR ${PA_VALUES_FT[pa]}/${OAT_VALUES_C[oat]}: 950kg ≤ 1043kg`
      );
    }
  }
});

test('EHHV runways: 6 entries with positive distances', () => {
  assert.equal(EHHV_RUNWAYS.length, 6);
  for (const r of EHHV_RUNWAYS) {
    assert.ok(r.brgTrue >= 0 && r.brgTrue < 360);
    assert.ok(r.toraM > 0 && r.todaM > 0);
  }
});
```

- [ ] **Step 3.5: Run tests**

```bash
node --test takeoff-data.test.js
```

If a monotonicity test fails, that's a transcription error — go back and re-verify the offending cell against the POH PDF. Iterate until all tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add takeoff-data.js takeoff-data.test.js
git commit -m "feat(takeoff): add POH tables and EHHV runway data"
```

---

## Task 4: POH lookup with bilinear + weight interpolation

**Files:**
- Modify: `takeoff-calc.js`
- Modify: `takeoff-calc.test.js`

- [ ] **Step 4.1: Write failing tests**

Append to `takeoff-calc.test.js`:

```js
import { lookupTakeoffDistance } from './takeoff-calc.js';
import { TABLE_1043KG, TABLE_950KG, TABLE_862KG } from './takeoff-data.js';

test('lookup: exact corner cell matches table (1043 kg, SL, 0°C)', () => {
  const r = lookupTakeoffDistance(1043, 0, 0);
  assert.deepEqual([r.groundRoll, r.total], TABLE_1043KG[0][0]);
});

test('lookup: exact mid cell matches table (950 kg, 4000 ft, 20°C)', () => {
  const r = lookupTakeoffDistance(950, 4000, 20);
  assert.deepEqual([r.groundRoll, r.total], TABLE_950KG[4][2]);
});

test('lookup: bilinear midpoint between (SL/0°C) and (1000ft/10°C) at 1043 kg', () => {
  const r = lookupTakeoffDistance(1043, 500, 5);
  // Average of the four corners:
  //   (219, 396) (236, 434)
  //   (241, 433) (259, 475)
  // Midpoint GR = (219+236+241+259)/4 = 238.75 → 239 (rounded)
  // Midpoint total = (396+434+433+475)/4 = 434.5 → 435 (rounded)
  assert.equal(r.groundRoll, 239);
  assert.equal(r.total, 435);
});

test('lookup: weight interpolation between 950 and 1043 at SL/0°C', () => {
  const w = (950 + 1043) / 2; // 996.5 kg
  const r = lookupTakeoffDistance(w, 0, 0);
  const [gr862, t862] = TABLE_862KG[0][0];
  const [gr950, t950] = TABLE_950KG[0][0];
  const [gr1043, t1043] = TABLE_1043KG[0][0];
  // 996.5 is between 950 and 1043, fraction (996.5-950)/(1043-950) = 0.5
  const expectedGr = Math.round(gr950 + 0.5 * (gr1043 - gr950));
  const expectedTotal = Math.round(t950 + 0.5 * (t1043 - t950));
  assert.equal(r.groundRoll, expectedGr);
  assert.equal(r.total, expectedTotal);
});

test('lookup: extrapolation above 1043 kg flagged in result', () => {
  const r = lookupTakeoffDistance(1080, 0, 0);
  assert.ok(r.outOfRange === true);
  // Extrapolated GR should be > the 1043 value at SL/0°C
  assert.ok(r.groundRoll > TABLE_1043KG[0][0][0]);
});
```

- [ ] **Step 4.2: Run tests to verify failure**

```bash
node --test takeoff-calc.test.js
```

Expected: all `lookupTakeoffDistance` tests fail.

- [ ] **Step 4.3: Implement lookupTakeoffDistance**

Append to `takeoff-calc.js`:

```js
import {
  PA_VALUES_FT, OAT_VALUES_C, WEIGHTS_KG, TABLES_BY_WEIGHT,
} from './takeoff-data.js';

/**
 * Returns interpolated takeoff distance for given weight, pressure altitude,
 * and OAT. Returns { groundRoll, total, outOfRange } in meters.
 *
 * Out-of-range cases:
 *   - PA outside [0, 8000]: clamped, outOfRange=true
 *   - OAT outside [0, 40]:  clamped, outOfRange=true
 *   - Weight > 1043 kg: extrapolated linearly from the 950→1043 trend, outOfRange=true
 *   - Weight < 862 kg:  uses 862 kg values (don't extrapolate downward — POH covers it),
 *                       outOfRange=false
 */
export function lookupTakeoffDistance(weightKg, paFt, oatC) {
  const paClamped = Math.max(PA_VALUES_FT[0], Math.min(PA_VALUES_FT.at(-1), paFt));
  const oatClamped = Math.max(OAT_VALUES_C[0], Math.min(OAT_VALUES_C.at(-1), oatC));
  const inRangeAtm = paClamped === paFt && oatClamped === oatC;

  // Bilinear at each weight table
  const perWeight = TABLES_BY_WEIGHT.map((table) =>
    bilinear(table, paClamped, oatClamped)
  );
  // perWeight = [{gr, total}, {gr, total}, {gr, total}] for [862, 950, 1043]

  let result;
  let weightOOR = false;
  if (weightKg <= WEIGHTS_KG[0]) {
    result = perWeight[0];
  } else if (weightKg <= WEIGHTS_KG[1]) {
    const f = (weightKg - WEIGHTS_KG[0]) / (WEIGHTS_KG[1] - WEIGHTS_KG[0]);
    result = lerpPair(perWeight[0], perWeight[1], f);
  } else if (weightKg <= WEIGHTS_KG[2]) {
    const f = (weightKg - WEIGHTS_KG[1]) / (WEIGHTS_KG[2] - WEIGHTS_KG[1]);
    result = lerpPair(perWeight[1], perWeight[2], f);
  } else {
    // Extrapolate above 1043 kg using the 950→1043 trend
    const f = (weightKg - WEIGHTS_KG[1]) / (WEIGHTS_KG[2] - WEIGHTS_KG[1]);
    result = lerpPair(perWeight[1], perWeight[2], f);
    weightOOR = true;
  }

  return {
    groundRoll: Math.round(result.gr),
    total: Math.round(result.total),
    outOfRange: weightOOR || !inRangeAtm,
  };
}

function bilinear(table, paFt, oatC) {
  const paIdx = lowerIndex(PA_VALUES_FT, paFt);
  const oatIdx = lowerIndex(OAT_VALUES_C, oatC);
  const paLo = PA_VALUES_FT[paIdx];
  const paHi = PA_VALUES_FT[paIdx + 1] ?? paLo;
  const oatLo = OAT_VALUES_C[oatIdx];
  const oatHi = OAT_VALUES_C[oatIdx + 1] ?? oatLo;
  const fPa = paHi === paLo ? 0 : (paFt - paLo) / (paHi - paLo);
  const fOat = oatHi === oatLo ? 0 : (oatC - oatLo) / (oatHi - oatLo);

  const c00 = table[paIdx][oatIdx];
  const c01 = table[paIdx][Math.min(oatIdx + 1, OAT_VALUES_C.length - 1)];
  const c10 = table[Math.min(paIdx + 1, PA_VALUES_FT.length - 1)][oatIdx];
  const c11 = table[Math.min(paIdx + 1, PA_VALUES_FT.length - 1)][Math.min(oatIdx + 1, OAT_VALUES_C.length - 1)];

  return {
    gr: bilinScalar(c00[0], c01[0], c10[0], c11[0], fPa, fOat),
    total: bilinScalar(c00[1], c01[1], c10[1], c11[1], fPa, fOat),
  };
}

function bilinScalar(v00, v01, v10, v11, fPa, fOat) {
  const a = v00 + fOat * (v01 - v00);
  const b = v10 + fOat * (v11 - v10);
  return a + fPa * (b - a);
}

function lerpPair(lo, hi, f) {
  return {
    gr: lo.gr + f * (hi.gr - lo.gr),
    total: lo.total + f * (hi.total - lo.total),
  };
}

function lowerIndex(arr, value) {
  for (let i = arr.length - 2; i >= 0; i--) {
    if (value >= arr[i]) return i;
  }
  return 0;
}
```

- [ ] **Step 4.4: Run tests to verify pass**

```bash
node --test
```

Expected: all tests pass (including Tasks 1, 2 tests).

- [ ] **Step 4.5: Commit**

```bash
git add takeoff-calc.js takeoff-calc.test.js
git commit -m "feat(takeoff): bilinear POH lookup with weight interpolation"
```

---

## Task 5: Surface and wind corrections

**Files:**
- Modify: `takeoff-calc.js`
- Modify: `takeoff-calc.test.js`

- [ ] **Step 5.1: Write failing tests**

Append:

```js
import { applyCorrections } from './takeoff-calc.js';

test('applyCorrections: dry grass adds 15% of GR to both distances', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'dry-grass', headwind: 0, tailwind: 0,
  });
  // ΔSurface = 0.15 × 200 = 30
  assert.equal(r.groundRoll, 230);
  assert.equal(r.total, 430);
});

test('applyCorrections: wet grass adds 25% of GR to both distances', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'wet-grass', headwind: 0, tailwind: 0,
  });
  assert.equal(r.groundRoll, 250);
  assert.equal(r.total, 450);
});

test('applyCorrections: 9 kt headwind reduces by 10%', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'dry-grass', headwind: 9, tailwind: 0,
  });
  // After surface: 230, 430. After 10% headwind reduction: 207, 387.
  assert.equal(r.groundRoll, 207);
  assert.equal(r.total, 387);
});

test('applyCorrections: 2 kt tailwind increases by 10%', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'dry-grass', headwind: 0, tailwind: 2,
  });
  // After surface: 230, 430. After +10%: 253, 473.
  assert.equal(r.groundRoll, 253);
  assert.equal(r.total, 473);
});

test('applyCorrections: calm wind, dry grass — only surface adds', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'dry-grass', headwind: 0, tailwind: 0,
  });
  assert.equal(r.groundRoll, 230);
  assert.equal(r.total, 430);
});
```

- [ ] **Step 5.2: Run tests to verify failure**

```bash
node --test
```

- [ ] **Step 5.3: Implement applyCorrections**

Append to `takeoff-calc.js`:

```js
const SURFACE_FACTORS = {
  'dry-grass': 0.15,
  'wet-grass': 0.25,
};

/**
 * Applies POH-style corrections in this order: surface, then wind.
 * Input: baseline distances from POH lookup.
 * Returns corrected distances rounded to nearest meter.
 *
 * surface: 'dry-grass' | 'wet-grass'
 * headwind: kt (use 0 if tailwind component instead)
 * tailwind: kt (use 0 if headwind component instead)
 *
 * Per POH note 4: surface increase is 15% of ground roll figure, ADDED TO
 * BOTH ground roll and total distance.
 * Per POH note 3: headwind decreases distance by 10% per 9 kt;
 * tailwind increases by 10% per 2 kt (valid up to 10 kt tailwind).
 */
export function applyCorrections(baseline, { surface, headwind, tailwind }) {
  const factor = SURFACE_FACTORS[surface] ?? 0;
  const delta = factor * baseline.groundRoll;
  let gr = baseline.groundRoll + delta;
  let total = baseline.total + delta;

  if (headwind > 0) {
    const m = 1 - 0.10 * (headwind / 9);
    gr *= m;
    total *= m;
  } else if (tailwind > 0) {
    const m = 1 + 0.10 * (tailwind / 2);
    gr *= m;
    total *= m;
  }

  return { groundRoll: Math.round(gr), total: Math.round(total) };
}
```

- [ ] **Step 5.4: Run tests**

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 5.5: Commit**

```bash
git add takeoff-calc.js takeoff-calc.test.js
git commit -m "feat(takeoff): surface and wind correction factors"
```

---

## Task 6: Color flag and validation

**Files:**
- Modify: `takeoff-calc.js`
- Modify: `takeoff-calc.test.js`

- [ ] **Step 6.1: Write failing tests**

Append:

```js
import { runwayFlag, validateInputs } from './takeoff-calc.js';

const SAFETY_FACTOR = 1.25;

test('runwayFlag: green when both metrics have ≥25% margin', () => {
  // required GR 200, total 400; available TORA 600, TODA 600
  // GR margin: 600 ≥ 200×1.25=250 ✓
  // total margin: 600 ≥ 400×1.25=500 ✓
  assert.equal(runwayFlag(
    { groundRoll: 200, total: 400 }, { toraM: 600, todaM: 600 }, SAFETY_FACTOR,
  ), 'green');
});

test('runwayFlag: orange when any metric is between 0 and 25% margin', () => {
  // required total 480, TODA 600 → 600 ≥ 480 (yes) but < 480×1.25=600 (no, equal)
  // Edge: 600 ≥ 600 → green. Use 481: 600 < 481×1.25=601.25 → orange.
  assert.equal(runwayFlag(
    { groundRoll: 200, total: 481 }, { toraM: 600, todaM: 600 }, SAFETY_FACTOR,
  ), 'orange');
});

test('runwayFlag: red when any metric exceeds available', () => {
  assert.equal(runwayFlag(
    { groundRoll: 700, total: 400 }, { toraM: 600, todaM: 600 }, SAFETY_FACTOR,
  ), 'red');
});

test('validateInputs: TOW > 1043 → warning', () => {
  const w = validateInputs({ tow: 1080, oat: 15, pa: 273, tailwind: 0, crosswind: 5 });
  assert.ok(w.some(x => x.code === 'tow-over-poh'));
});

test('validateInputs: tailwind > 10 → error', () => {
  const w = validateInputs({ tow: 1000, oat: 15, pa: 273, tailwind: 12, crosswind: 5 });
  assert.ok(w.some(x => x.code === 'tailwind-over-poh' && x.severity === 'error'));
});

test('validateInputs: crosswind > 15 → warning', () => {
  const w = validateInputs({ tow: 1000, oat: 15, pa: 273, tailwind: 0, crosswind: 17 });
  assert.ok(w.some(x => x.code === 'crosswind-over-demo' && x.severity === 'warning'));
});

test('validateInputs: OAT outside [0, 40] → error', () => {
  const w = validateInputs({ tow: 1000, oat: -5, pa: 273, tailwind: 0, crosswind: 0 });
  assert.ok(w.some(x => x.code === 'oat-out-of-range'));
});

test('validateInputs: PA > 8000 → error', () => {
  const w = validateInputs({ tow: 1000, oat: 15, pa: 8500, tailwind: 0, crosswind: 0 });
  assert.ok(w.some(x => x.code === 'pa-out-of-range'));
});

test('validateInputs: nominal inputs return empty array', () => {
  const w = validateInputs({ tow: 950, oat: 15, pa: 273, tailwind: 0, crosswind: 5 });
  assert.equal(w.length, 0);
});
```

- [ ] **Step 6.2: Run tests to verify failure**

- [ ] **Step 6.3: Implement runwayFlag and validateInputs**

Append to `takeoff-calc.js`:

```js
/**
 * Returns 'green' | 'orange' | 'red' based on worst of the two metrics.
 * green:  available ≥ required × safetyFactor for BOTH metrics
 * orange: required ≤ available < required × safetyFactor on at least one metric
 * red:    required > available on at least one metric
 */
export function runwayFlag(required, runway, safetyFactor) {
  const grShortfall = required.groundRoll > runway.toraM;
  const totalShortfall = required.total > runway.todaM;
  if (grShortfall || totalShortfall) return 'red';

  const grBelowSafety = runway.toraM < required.groundRoll * safetyFactor;
  const totalBelowSafety = runway.todaM < required.total * safetyFactor;
  if (grBelowSafety || totalBelowSafety) return 'orange';

  return 'green';
}

/**
 * Returns an array of warnings/errors for inputs that fall outside the POH or
 * aircraft envelope. Each entry: { code, severity, message }.
 * severity: 'warning' | 'error' | 'info'
 */
export function validateInputs({ tow, oat, pa, tailwind, crosswind }) {
  const warnings = [];
  if (tow > 1043) warnings.push({
    code: 'tow-over-poh', severity: 'warning',
    message: 'TOW boven POH-tabelrange (max 1043 kg). Berekening geëxtrapoleerd; gebruik conservatief.',
  });
  if (tailwind > 10) warnings.push({
    code: 'tailwind-over-poh', severity: 'error',
    message: 'Tailwind > 10 kt valt buiten POH-correctie. Resultaat onbetrouwbaar.',
  });
  if (oat < 0 || oat > 40) warnings.push({
    code: 'oat-out-of-range', severity: 'error',
    message: 'OAT buiten POH-range (0–40°C).',
  });
  if (pa > 8000) warnings.push({
    code: 'pa-out-of-range', severity: 'error',
    message: 'Pressure altitude buiten POH-range (max 8000 ft).',
  });
  if (crosswind > 15) warnings.push({
    code: 'crosswind-over-demo', severity: 'warning',
    message: 'Crosswind boven gedemonstreerd maximum (15 kt).',
  });
  return warnings;
}
```

- [ ] **Step 6.4: Run tests**

```bash
node --test
```

- [ ] **Step 6.5: Commit**

```bash
git add takeoff-calc.js takeoff-calc.test.js
git commit -m "feat(takeoff): color flag and input validation"
```

---

## Task 7: HTML page skeleton + styles

**Files:**
- Create: `takeoff.html`
- Modify: `style.css`

- [ ] **Step 7.1: Inspect existing styles for reused tokens**

Read `style.css` (top 80 lines) to find existing CSS variables (orange theme color, fonts, card patterns). Reuse them.

```bash
head -80 style.css
```

- [ ] **Step 7.2: Create takeoff.html**

```html
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Takeoff distance calculator for PH-GYS at EHHV (Hilversum)">
  <meta name="theme-color" content="#E8731A">
  <link rel="icon" href="favicon.ico">
  <title>PH-GYS Takeoff Distance — EHHV</title>
  <link rel="stylesheet" href="style.css">
  <script type="module" src="takeoff.js"></script>
  <!-- Privacy-friendly analytics by Plausible -->
  <script async src="https://plausible.io/js/pa-ze2t24bYhIg1FQC4gT1rp.js"></script>
  <script>
    window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
    plausible.init()
  </script>
</head>
<body class="takeoff-page">

  <header>
    <div class="header-left">
      <span class="logo" aria-label="SVS Logo">SVS</span>
      <h1>PH-GYS Takeoff Distance — EHHV</h1>
    </div>
    <div class="header-right">
      <a href="index.html" class="back-link">← Weight &amp; Balance</a>
    </div>
    <p class="disclaimer">
      <strong>De pilot-in-command (PIC) blijft te allen tijde verantwoordelijk</strong>
      voor de go/no-go beslissing. Berekening is slechts hulpmiddel; verifieer tegen actuele POH en omstandigheden.
    </p>
  </header>

  <main class="takeoff-main">

    <section class="input-panel">
      <h2>Invoer</h2>

      <div class="input-grid">
        <label>TOW (kg)
          <input type="number" id="in-tow" step="1" min="600" max="1100">
        </label>

        <label>OAT (°C)
          <input type="number" id="in-oat" step="1" value="15">
        </label>

        <label>QNH (hPa)
          <input type="number" id="in-qnh" step="1" value="1013">
        </label>

        <label>Wind richting (°)
          <input type="number" id="in-wind-dir" step="10" min="0" max="360" value="0">
        </label>

        <label>Wind (kt)
          <input type="number" id="in-wind-speed" step="1" min="0" value="0">
        </label>

        <label>Gust (kt)
          <input type="number" id="in-wind-gust" step="1" min="0" placeholder="optioneel">
        </label>
      </div>

      <fieldset class="surface-fieldset">
        <legend>Oppervlak</legend>
        <label><input type="radio" name="surface" value="dry-grass" checked> Droog gras (+15%)</label>
        <label><input type="radio" name="surface" value="wet-grass"> Nat gras (+25%)</label>
      </fieldset>

      <fieldset class="runway-fieldset">
        <legend>Actieve baan/banen</legend>
        <div id="runway-checkboxes"></div>
      </fieldset>
    </section>

    <section class="derived-panel">
      <span id="derived-line">PA: — · ISA dev: —</span>
    </section>

    <section id="warnings"></section>

    <section id="runway-cards" class="runway-cards"></section>

    <footer class="takeoff-footer">
      <p>Berekening op basis van Cessna F172N AFM Section 5 (Edition 1, Aug 1976).
         Declared distances per <a href="https://www.lvnl.nl/en/eaip" target="_blank" rel="noopener">AIP EHHV AD 2.13</a>.
         Slechts hulpmiddel voor planning.</p>
    </footer>

  </main>
</body>
</html>
```

- [ ] **Step 7.3: Append takeoff styles to style.css**

Append to `style.css` (use the same `--svs-orange` etc. tokens as existing styles; if those don't exist, hardcode `#E8731A` for orange, `#2c3e50` for dark text, and `#f5f5f5` for light backgrounds — matching the existing W&B page's palette):

```css
/* ===================== TAKEOFF PAGE ===================== */

.takeoff-page main.takeoff-main {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}

.takeoff-page .back-link {
  color: #E8731A;
  text-decoration: none;
  font-weight: 600;
}
.takeoff-page .back-link:hover { text-decoration: underline; }

.input-panel {
  background: #fff;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.input-panel h2 { margin-top: 0; }

.input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.input-grid label {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
  font-weight: 500;
}
.input-grid input {
  padding: 0.4rem;
  font-size: 1rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.surface-fieldset, .runway-fieldset {
  margin-top: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.75rem;
}
.surface-fieldset label, #runway-checkboxes label {
  margin-right: 1rem;
  cursor: pointer;
}

.derived-panel {
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.95rem;
  color: #555;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-radius: 6px;
}

#warnings:empty { display: none; }
#warnings .warning-banner {
  padding: 0.6rem 0.9rem;
  border-radius: 6px;
  margin-bottom: 0.5rem;
  font-size: 0.95rem;
}
#warnings .warning-banner.error   { background: #fde2e1; color: #8b1a1a; border: 1px solid #f5b7b5; }
#warnings .warning-banner.warning { background: #fff3d4; color: #7a5a00; border: 1px solid #f0d68a; }
#warnings .warning-banner.info    { background: #e0f1fb; color: #1d4d6b; border: 1px solid #b6dcf2; }

.runway-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 0.75rem;
}
.runway-card {
  background: #fff;
  border-radius: 8px;
  padding: 1rem;
  border-left: 8px solid #ccc;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.runway-card.flag-green  { border-left-color: #27ae60; }
.runway-card.flag-orange { border-left-color: #e67e22; }
.runway-card.flag-red    { border-left-color: #c0392b; }

.runway-card h3 { margin: 0 0 0.5rem 0; display: flex; justify-content: space-between; align-items: center; }
.runway-card .flag-icon { font-size: 1.4rem; }
.runway-card .wind-line { font-size: 0.95rem; color: #444; margin-bottom: 0.5rem; }
.runway-card table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
.runway-card th, .runway-card td { text-align: right; padding: 0.25rem 0.4rem; }
.runway-card th { font-weight: 500; color: #555; }
.runway-card td:first-child, .runway-card th:first-child { text-align: left; }
.runway-card .surface-line { font-size: 0.85rem; color: #777; margin-top: 0.5rem; }

.takeoff-footer { font-size: 0.85rem; color: #666; padding: 1rem; }
.takeoff-footer a { color: #E8731A; }
```

- [ ] **Step 7.4: Manual smoke test (the page just renders, no logic yet)**

Open `takeoff.html` in a browser:

```bash
python3 -m http.server 8080
# then visit http://localhost:8080/takeoff.html
```

Expected: page renders with empty cards section, header, footer. No JS errors yet (the controller will be filled in next).

- [ ] **Step 7.5: Commit**

```bash
git add takeoff.html style.css
git commit -m "feat(takeoff): page skeleton and styles"
```

---

## Task 8: Controller — wire inputs and render

**Files:**
- Create: `takeoff.js`

- [ ] **Step 8.1: Implement controller**

Create `takeoff.js`:

```js
// takeoff.js — DOM controller for takeoff.html
// Reads inputs, runs calc, renders runway cards.

import {
  pressureAltitude, windComponents, lookupTakeoffDistance,
  applyCorrections, runwayFlag, validateInputs,
} from './takeoff-calc.js';
import { EHHV_RUNWAYS, EHHV_ELEVATION_FT } from './takeoff-data.js';

const SAFETY_FACTOR = 1.25;
const ISA_TEMP_AT_SL = 15;
const ISA_LAPSE_C_PER_FT = 0.00198; // 1.98°C per 1000 ft

const $ = (id) => document.getElementById(id);

function render() {
  const tow = parseFloat($('in-tow').value);
  const oat = parseFloat($('in-oat').value);
  const qnh = parseFloat($('in-qnh').value);
  const windDir = parseFloat($('in-wind-dir').value) || 0;
  const windSpeed = parseFloat($('in-wind-speed').value) || 0;
  const windGustRaw = $('in-wind-gust').value.trim();
  const windGust = windGustRaw === '' ? null : parseFloat(windGustRaw);
  const surface = document.querySelector('input[name="surface"]:checked').value;
  const selectedRunways = Array.from(document.querySelectorAll('input[name="rwy"]:checked'))
    .map((cb) => cb.value);

  const inputsValid = Number.isFinite(tow) && Number.isFinite(oat) && Number.isFinite(qnh);
  const pa = inputsValid ? pressureAltitude(EHHV_ELEVATION_FT, qnh) : null;

  // Derived line
  if (pa !== null) {
    const isaAtPa = ISA_TEMP_AT_SL - pa * ISA_LAPSE_C_PER_FT;
    const isaDev = oat - isaAtPa;
    $('derived-line').textContent =
      `PA: ${Math.round(pa)} ft  ·  ISA dev: ${isaDev >= 0 ? '+' : ''}${isaDev.toFixed(1)}°C`;
  } else {
    $('derived-line').textContent = 'PA: — · ISA dev: —';
  }

  // No runway selected — info message and empty cards
  const warningsEl = $('warnings');
  const cardsEl = $('runway-cards');
  warningsEl.innerHTML = '';
  cardsEl.innerHTML = '';

  if (!inputsValid) {
    appendWarning(warningsEl, 'info', 'Vul TOW, OAT en QNH in.');
    return;
  }
  if (selectedRunways.length === 0) {
    appendWarning(warningsEl, 'info', 'Selecteer ten minste één baan.');
    return;
  }

  // Per-runway calc
  for (const rwyId of selectedRunways) {
    const rwy = EHHV_RUNWAYS.find((r) => r.id === rwyId);
    if (!rwy) continue;

    // Wind: lower of (steady, gust) for headwind benefit; higher for tailwind/crosswind risk
    const lowerSpeed = windGust === null ? windSpeed : Math.min(windSpeed, windGust);
    const upperSpeed = windGust === null ? windSpeed : Math.max(windSpeed, windGust);

    const lowerComp = windComponents(rwy.brgTrue, windDir, lowerSpeed);
    const upperComp = windComponents(rwy.brgTrue, windDir, upperSpeed);

    // For distance calc: headwind from lower, tailwind from upper
    let headwind = 0;
    let tailwind = 0;
    if (lowerComp.headwind > 0) {
      headwind = lowerComp.headwind;
    } else {
      // Both lower and upper produce tailwind (since they differ only in magnitude)
      tailwind = -upperComp.headwind;
    }
    const crosswindLimit = upperComp.crosswind;

    // Per-runway warnings
    const v = validateInputs({ tow, oat, pa, tailwind, crosswind: crosswindLimit });
    for (const w of v) appendWarning(warningsEl, w.severity, `${rwy.id}: ${w.message}`);

    // POH lookup + corrections
    const baseline = lookupTakeoffDistance(tow, pa, oat);
    const corrected = applyCorrections(baseline, { surface, headwind, tailwind });

    const flag = runwayFlag(corrected, rwy, SAFETY_FACTOR);

    cardsEl.appendChild(renderCard({
      rwy, headwind, tailwind, crosswind: crosswindLimit,
      required: corrected, available: { toraM: rwy.toraM, todaM: rwy.todaM },
      flag, surface,
    }));
  }
}

function renderCard({ rwy, headwind, tailwind, crosswind, required, available, flag, surface }) {
  const card = document.createElement('div');
  card.className = `runway-card flag-${flag}`;

  const flagIcon = { green: '🟢', orange: '🟠', red: '🔴' }[flag];

  const grMargin = available.toraM - required.groundRoll;
  const grPct = required.groundRoll > 0 ? Math.round((grMargin / required.groundRoll) * 100) : 0;
  const totalMargin = available.todaM - required.total;
  const totalPct = required.total > 0 ? Math.round((totalMargin / required.total) * 100) : 0;

  const windParts = [];
  if (headwind > 0) windParts.push(`Head ${Math.round(headwind)} kt`);
  if (tailwind > 0) windParts.push(`<strong>Tail ${Math.round(tailwind)} kt</strong>`);
  if (crosswind > 0) windParts.push(`Cross ${Math.round(crosswind)} kt`);
  if (windParts.length === 0) windParts.push('Calm');

  const surfaceLabel = surface === 'wet-grass'
    ? 'nat gras (+25% GR)'
    : 'droog gras (+15% GR)';

  card.innerHTML = `
    <h3>RWY ${rwy.id} <span class="brg">(${rwy.brgTrue}°)</span> <span class="flag-icon">${flagIcon}</span></h3>
    <div class="wind-line">Wind: ${windParts.join(' · ')}</div>
    <table>
      <thead>
        <tr><th></th><th>Required</th><th>Available</th><th>Margin</th></tr>
      </thead>
      <tbody>
        <tr><td>Ground roll</td><td>${required.groundRoll} m</td><td>${available.toraM} m</td><td>${formatMargin(grMargin, grPct)}</td></tr>
        <tr><td>Over 15m obstacle</td><td>${required.total} m</td><td>${available.todaM} m</td><td>${formatMargin(totalMargin, totalPct)}</td></tr>
      </tbody>
    </table>
    <div class="surface-line">Oppervlak: ${surfaceLabel}</div>
  `;
  return card;
}

function formatMargin(m, pct) {
  const sign = m >= 0 ? '+' : '';
  return `${sign}${m} m (${sign}${pct}%)`;
}

function appendWarning(parent, severity, message) {
  const banner = document.createElement('div');
  banner.className = `warning-banner ${severity}`;
  banner.textContent = message;
  parent.appendChild(banner);
}

// ─── Init ────────────────────────────────────────────────

function buildRunwayCheckboxes() {
  const container = $('runway-checkboxes');
  container.innerHTML = EHHV_RUNWAYS.map((r) =>
    `<label><input type="checkbox" name="rwy" value="${r.id}"> ${r.id}</label>`
  ).join(' ');
}

function loadTowFromStorage() {
  const stored = sessionStorage.getItem('phgys-tow');
  if (stored && !isNaN(parseFloat(stored))) {
    $('in-tow').value = parseFloat(stored).toFixed(1);
  }
}

function init() {
  buildRunwayCheckboxes();
  loadTowFromStorage();
  document.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });
  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

- [ ] **Step 8.2: Manual smoke test**

```bash
python3 -m http.server 8080
# visit http://localhost:8080/takeoff.html
```

Expected behavior:
- Page loads with default values (OAT 15°C, QNH 1013, wind 0/0).
- Filling in TOW = 950 and selecting RWY 25 produces a green card with reasonable numbers (Required GR ~265 m incl. dry-grass surface penalty; vs. TORA 600 m).
- Setting wind direction to 070 + speed 15 with RWY 25 selected → tailwind warning fires.
- Setting OAT to 50 → "OAT buiten POH-range" error banner.
- Selecting RWY 07 + setting wind 069/8 → headwind ~8 kt, no crosswind, green if TOW low enough.

- [ ] **Step 8.3: Commit**

```bash
git add takeoff.js
git commit -m "feat(takeoff): DOM controller and runway-card rendering"
```

---

## Task 9: Bridge from W&B page

**Files:**
- Modify: `app.js` (around line 277)
- Modify: `index.html`

- [ ] **Step 9.1: Write TOW to sessionStorage in app.js**

Read `app.js:271-292`. Find this block:

```js
  // TOW subtotal
  setText('total-tow',  hasInput ? towWeight.toFixed(1) : '—');
  setText('arm-tow',    hasInput ? towArm.toFixed(2) : '—');
  setText('moment-tow', hasInput ? towMoment.toFixed(2) : '—');
  setText('cg-tow',     hasInput ? cgTow.toFixed(2) : '—');
```

Add immediately after this block:

```js
  // Bridge to takeoff distance page
  if (hasInput) {
    sessionStorage.setItem('phgys-tow', towWeight.toFixed(1));
  } else {
    sessionStorage.removeItem('phgys-tow');
  }
```

- [ ] **Step 9.2: Add link in index.html**

Read `index.html` to find the disclaimer section near the bottom of `<main>` (search for `</main>` or for the print/reset button area). Just above the closing `</main>` tag, add:

```html
  <p class="runway-link">
    <a href="takeoff.html">Runway performance check (EHHV) →</a>
  </p>
```

If `index.html` already has a disclaimer block at the bottom of main, place this link above that block so it stands out before the footer.

- [ ] **Step 9.3: Add link styling**

Append to `style.css`:

```css
.runway-link {
  text-align: center;
  margin: 1rem 0;
}
.runway-link a {
  color: #E8731A;
  font-weight: 600;
  text-decoration: none;
  font-size: 1.05rem;
}
.runway-link a:hover { text-decoration: underline; }
```

- [ ] **Step 9.4: Manual end-to-end test**

```bash
python3 -m http.server 8080
```

In the browser:
1. Open `http://localhost:8080/index.html`
2. Fill in W&B inputs (e.g. pilot 80, fuel 100 ltr, etc.) so TOW > 0
3. Click "Runway performance check (EHHV) →"
4. Confirm `takeoff.html` opens with the TOW field pre-filled with the value from step 2

- [ ] **Step 9.5: Commit**

```bash
git add app.js index.html style.css
git commit -m "feat(takeoff): bridge TOW from W&B page via sessionStorage"
```

---

## Task 10: Final verification + PR

**Files:**
- (none new)

- [ ] **Step 10.1: Run full test suite**

```bash
node --test
```

Expected: all tests pass.

- [ ] **Step 10.2: Spot-check vs. POH manually**

In the browser at `takeoff.html`, set:
- TOW = 1043 kg, OAT = 0°C, QNH = 1013, wind 0/0, dry grass, RWY 18 (TODA 700 m)
- Expected baseline: GR 219, total 396 (POH SL/0°C/1043kg).
- After dry-grass: GR 219 + 32.85 ≈ 252; total 396 + 32.85 ≈ 429.
- Card should show GR 252 / 429, available 700/700 → green flag.

If the displayed values are within ±2 m of these, the calc + lookup are wired correctly.

Repeat for at least one mid-cell case (e.g. TOW 950, PA from QNH 1003 ≈ 273 ft, OAT 20°C, RWY 25).

- [ ] **Step 10.3: Push and open PR**

```bash
git push -u origin <current-branch>
gh pr create --title "feat: takeoff distance calculator for EHHV" --body "$(cat <<'EOF'
## Summary
- New `takeoff.html` page: per-runway takeoff distance check at EHHV
- Pure-calc functions covered by `node --test` suite
- TOW pre-filled from W&B page via `sessionStorage`
- POH F172N AFM Section 5 tables digitized (3 weights × 9 PA × 5 OAT)
- Color flag: green (≥25% margin), orange, red

## Test plan
- [ ] `node --test` passes locally
- [ ] Manual spot-check vs. POH at SL/0°C/1043kg matches within rounding
- [ ] Tailwind > 10 kt triggers error banner
- [ ] TOW > 1043 kg triggers extrapolation warning

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 10.4: After merge, smoke-test on production**

Once the PR is merged and Cloudflare Pages deploys, visit https://phgys.com/takeoff.html and repeat the spot-check from Step 10.2.

---

## Out of scope (not in this plan)

- Landing distance page
- Other airfields than EHHV
- METAR-string parser for wind
- Live wind/METAR API
- Slope correction
- Density-altitude based humidity correction
- Persistent storage of last inputs across sessions

These are documented in the spec under "Out of scope (v1)" and can be tackled in follow-up plans.
