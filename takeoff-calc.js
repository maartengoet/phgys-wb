// takeoff-calc.js — pure calculation functions (no DOM access)
// All functions are pure and unit-tested via takeoff-calc.test.js

import {
  PA_VALUES_FT, OAT_VALUES_C, WEIGHTS_KG, TABLES_BY_WEIGHT,
} from './takeoff-data.js';

export function pressureAltitude(elevationFt, qnhHpa) {
  return elevationFt + (1013 - qnhHpa) * 27;
}

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

/**
 * Returns interpolated takeoff distance for given weight, pressure altitude,
 * and OAT. Returns { groundRoll, total, outOfRange } in meters.
 *
 * Out-of-range cases:
 *   - PA outside [0, 8000]: clamped, outOfRange=true
 *   - OAT outside [0, 40]:  clamped, outOfRange=true
 *   - Weight > 1043 kg: extrapolated linearly from the 953→1043 trend, outOfRange=true
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
  // perWeight = [{gr, total}, {gr, total}, {gr, total}] for [862, 953, 1043]

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
    // Extrapolate above 1043 kg using the 953→1043 trend
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

const SURFACE_FACTORS = {
  'dry-grass': 0.15,
  // PH-GYS POH copy has a handwritten wet-grass note reading +45%.
  'wet-grass': 0.45,
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
    message: 'TOW boven POH-tabel (max 1043 kg). PH-GYS MTOW is 1089 kg (gecorrigeerd), maar Section 5 gaat alleen tot 1043 kg — afstand wordt geëxtrapoleerd, gebruik conservatief.',
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
