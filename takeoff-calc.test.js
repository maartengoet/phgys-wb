import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureAltitude, windComponents, lookupTakeoffDistance, applyCorrections, runwayFlag, validateInputs } from './takeoff-calc.js';
import { TABLE_1043KG, TABLE_953KG, TABLE_862KG } from './takeoff-data.js';

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

test('lookup: exact corner cell matches table (1043 kg, SL, 0°C)', () => {
  const r = lookupTakeoffDistance(1043, 0, 0);
  assert.deepEqual([r.groundRoll, r.total], TABLE_1043KG[0][0]);
});

test('lookup: exact mid cell matches table (953 kg, 4000 ft, 20°C)', () => {
  const r = lookupTakeoffDistance(953, 4000, 20);
  assert.deepEqual([r.groundRoll, r.total], TABLE_953KG[4][2]);
});

test('lookup: bilinear midpoint between (SL/0°C) and (1000ft/10°C) at 1043 kg', () => {
  // Compute expected midpoint analytically from the four corner cells of the
  // (SL/0°C)–(1000ft/10°C) rectangle on TABLE_1043KG.
  const c00 = TABLE_1043KG[0][0];
  const c01 = TABLE_1043KG[0][1];
  const c10 = TABLE_1043KG[1][0];
  const c11 = TABLE_1043KG[1][1];
  const expectedGr = Math.round((c00[0] + c01[0] + c10[0] + c11[0]) / 4);
  const expectedTotal = Math.round((c00[1] + c01[1] + c10[1] + c11[1]) / 4);

  const r = lookupTakeoffDistance(1043, 500, 5);
  assert.equal(r.groundRoll, expectedGr);
  assert.equal(r.total, expectedTotal);
});

test('lookup: weight interpolation between 953 and 1043 at SL/0°C', () => {
  const w = (953 + 1043) / 2; // 998 kg
  const r = lookupTakeoffDistance(w, 0, 0);
  const [gr953, t953] = TABLE_953KG[0][0];
  const [gr1043, t1043] = TABLE_1043KG[0][0];
  // Fraction (998 - 953) / (1043 - 953) = 0.5
  const expectedGr = Math.round(gr953 + 0.5 * (gr1043 - gr953));
  const expectedTotal = Math.round(t953 + 0.5 * (t1043 - t953));
  assert.equal(r.groundRoll, expectedGr);
  assert.equal(r.total, expectedTotal);
});

test('lookup: extrapolation above 1043 kg flagged in result', () => {
  const r = lookupTakeoffDistance(1080, 0, 0);
  assert.ok(r.outOfRange === true, 'outOfRange should be true');
  // Extrapolated GR should exceed the 1043 value at SL/0°C
  assert.ok(r.groundRoll > TABLE_1043KG[0][0][0], 'extrapolated GR should be > 1043 kg value');
});

test('applyCorrections: dry grass adds 15% of GR to both distances', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'dry-grass', headwind: 0, tailwind: 0,
  });
  // ΔSurface = 0.15 × 200 = 30
  assert.equal(r.groundRoll, 230);
  assert.equal(r.total, 430);
});

test('applyCorrections: wet grass adds 45% of GR to both distances', () => {
  const r = applyCorrections({ groundRoll: 200, total: 400 }, {
    surface: 'wet-grass', headwind: 0, tailwind: 0,
  });
  assert.equal(r.groundRoll, 290);
  assert.equal(r.total, 490);
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
  // required total 481, TODA 600 → 600 ≥ 481 (yes) but 600 < 481×1.25=601.25 → orange
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
