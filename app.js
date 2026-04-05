/* ============================================================
   PH-GYS Weight & Balance Calculator — Core Calculation Engine
   Reims/Cessna F172N  |  Stichting Vliegmaterieel Schiphol
   ============================================================ */

'use strict';

// ─── Translations ──────────────────────────────────────────
const TRANSLATIONS = {
  nl: {
    title: 'Gewicht & Balans',
    subtitle: 'PH-GYS — Reims/Cessna F172N',
    disclaimer: 'De gezagvoerder is verantwoordelijk voor de juistheid van alle berekeningen.',
    langToggle: 'EN',
    colItem: 'Item',
    colWeight: 'Gewicht (kg)',
    colArm: 'Arm (m)',
    colMoment: 'Moment (m.kg)',
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
    liters: 'liter',
    print: 'Afdrukken',
    reset: 'Herstellen',
    graphTitle: 'Zwaartepunt Moment Envelope',
    cgLabel: 'ZP',
    svsWebsite: 'SVS Website',
    dateLabel: 'Datum:',
    timeLabel: 'Tijd (UTC):',
    picName: 'Naam Gezagvoerder:',
    picSignature: 'Handtekening Gezagvoerder:',
    picBlock: 'Ondertekening Gezagvoerder',
    picDisclaimer: 'De gezagvoerder is verantwoordelijk voor de juistheid van alle berekeningen.',
    // Graph labels
    graphWeight: 'Gewicht (kg)',
    graphMoment: 'Moment (m\u00B7kg)',
    graphNormal: 'Normaal',
    graphUtility: 'Utility',
    graphTakeoff: 'Startgewicht',
    graphLanding: 'Landingsgewicht',
    graphOutside: 'Buiten Envelope',
    graphEnvelope: 'Normaal / Utility',
    // Warning messages
    ok: 'OK',
    overMax: 'BOVEN MAX',
    cgAft: 'ZP ACHTER',
    cgFwd: 'ZP VOOR',
    bag1Over: 'BAG1 OVER',
    bag2Over: 'BAG2 OVER',
    bagTotalOver: 'BAG TOTAAL OVER',
    fuelOver: 'BRANDSTOF OVER',
    taxiOver: 'TAXI > BRANDSTOF',
    tripOver: 'REIS > BRANDSTOF',
    maxRamp: 'max 1092 kg',
    maxTow: 'max 1089 kg',
  },
  en: {
    title: 'Weight & Balance',
    subtitle: 'PH-GYS — Reims/Cessna F172N',
    disclaimer: 'The PIC is responsible for ensuring all calculations are correct.',
    langToggle: 'NL',
    colItem: 'Item',
    colWeight: 'Weight (kg)',
    colArm: 'Arm (m)',
    colMoment: 'Moment (m.kg)',
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
    liters: 'liters',
    print: 'Print',
    reset: 'Reset',
    graphTitle: 'CG Moment Envelope',
    cgLabel: 'CG',
    svsWebsite: 'SVS Website',
    dateLabel: 'Date:',
    timeLabel: 'Time (UTC):',
    picName: 'PIC Name:',
    picSignature: 'PIC Signature:',
    picBlock: 'PIC Declaration',
    picDisclaimer: 'The PIC is responsible for ensuring all calculations are correct.',
    // Graph labels
    graphWeight: 'Weight (kg)',
    graphMoment: 'Moment (m\u00B7kg)',
    graphNormal: 'Normal',
    graphUtility: 'Utility',
    graphTakeoff: 'Takeoff Weight',
    graphLanding: 'Landing Weight',
    graphOutside: 'Outside Envelope',
    graphEnvelope: 'Normal / Utility',
    // Warning messages
    ok: 'OK',
    overMax: 'OVER MAX',
    cgAft: 'CG AFT',
    cgFwd: 'CG FWD',
    bag1Over: 'BAG1 OVER',
    bag2Over: 'BAG2 OVER',
    bagTotalOver: 'BAG TOTAL OVER',
    fuelOver: 'FUEL OVER',
    taxiOver: 'TAXI > FUEL',
    tripOver: 'TRIP > FUEL',
    maxRamp: 'max 1092 kg',
    maxTow: 'max 1089 kg',
  },
};

let currentLang = localStorage.getItem('lang') || 'nl';

// ─── Language Switching ────────────────────────────────────
function setLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key];
    }
  });
  localStorage.setItem('lang', lang);
  // Re-run calculate to update warnings and redraw graph with translated labels
  calculate();
}

// ─── Aircraft Data Constants ────────────────────────────────
const AIRCRAFT = {
  registration: 'PH-GYS',
  type: 'Reims/Cessna F172N',
  emptyWeight: 680.00,
  emptyArm: 1.02,
  emptyMoment: 696.42,
  fuelDensity: 0.72,     // kg per liter
  maxFuelLiters: 190,
  maxRampWeight: 1092,
  maxTakeoffWeight: 1089,
  stations: {
    pilot: { arm: 0.94 },
    rear:  { arm: 1.85 },
    bag1:  { arm: 2.41, maxKg: 54 },
    bag2:  { arm: 3.12, maxKg: 23 },
    fuel:  { arm: 1.22 },
  },
  maxBaggageCombined: 54,
  cg: {
    normal: {
      maxWeight: 1089,
      aft:     { weight: 1089, cg: 1.20 },
      fwdLow:  { weight: 885,  cg: 0.89 },
      fwdHigh: { weight: 1089, cg: 1.00 },
    },
    utility: {
      maxWeight: 952,
      aft:     { weight: 952, cg: 1.03 },
      fwdLow:  { weight: 885, cg: 0.89 },
      fwdHigh: { weight: 952, cg: 0.93 },
    },
  },
};

// ─── CG Envelope Limit Functions ────────────────────────────

/**
 * Forward CG limit for a given weight and category.
 * Linearly interpolates between fwdLow and fwdHigh.
 */
function getForwardCGLimit(weight, category) {
  const cat = AIRCRAFT.cg[category];
  if (weight <= cat.fwdLow.weight) return cat.fwdLow.cg;
  if (weight >= cat.fwdHigh.weight) return cat.fwdHigh.cg;
  const ratio = (weight - cat.fwdLow.weight) / (cat.fwdHigh.weight - cat.fwdLow.weight);
  return cat.fwdLow.cg + ratio * (cat.fwdHigh.cg - cat.fwdLow.cg);
}

/**
 * Aft CG limit — constant for each category.
 */
function getAftCGLimit(_weight, category) {
  return AIRCRAFT.cg[category].aft.cg;
}

/**
 * Returns true if (weight, cg) is within the envelope for the given category.
 */
function isInEnvelope(weight, cg, category) {
  if (weight > AIRCRAFT.cg[category].maxWeight) return false;
  if (weight < AIRCRAFT.emptyWeight) return true; // below empty weight — N/A
  const fwd = getForwardCGLimit(weight, category);
  const aft = getAftCGLimit(weight, category);
  return cg >= fwd && cg <= aft;
}

// ─── Helper: read an input value safely ─────────────────────
function readInput(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : Math.max(0, v);
}

// ─── Helper: set text content of an element ─────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ─── Main Calculation Function ──────────────────────────────
function calculate() {
  const S = AIRCRAFT.stations;

  // 1. Read all input values
  const pilotKg = readInput('input-pilot');
  const rearKg  = readInput('input-rear');
  const bag1Kg  = readInput('input-bag1');
  const bag2Kg  = readInput('input-bag2');
  const fuelL   = readInput('input-fuel');

  // 2. Convert fuel liters to kg
  const fuelKg = fuelL * AIRCRAFT.fuelDensity;

  // 3. Moments for each row
  const momentEmpty = AIRCRAFT.emptyMoment;
  const momentPilot = pilotKg * S.pilot.arm;
  const momentRear  = rearKg  * S.rear.arm;
  const momentBag1  = bag1Kg  * S.bag1.arm;
  const momentBag2  = bag2Kg  * S.bag2.arm;
  const momentFuel  = fuelKg  * S.fuel.arm;

  // 4. Subtotals
  const zfwWeight  = AIRCRAFT.emptyWeight + pilotKg + rearKg + bag1Kg + bag2Kg;
  const zfwMoment  = momentEmpty + momentPilot + momentRear + momentBag1 + momentBag2;
  const zfwArm     = zfwWeight > 0 ? zfwMoment / zfwWeight : 0;

  const towWeight  = zfwWeight + fuelKg;
  const towMoment  = zfwMoment + momentFuel;
  const towArm     = towWeight > 0 ? towMoment / towWeight : 0;

  // CG for TOW
  const cgTow = towWeight > 0 ? towMoment / towWeight : 0;

  // Detect whether any user input was provided (not just empty weight)
  const hasInput = (pilotKg + rearKg + bag1Kg + bag2Kg + fuelL) > 0;

  // 5. Update the DOM — individual row moments
  setText('moment-empty', momentEmpty.toFixed(2));
  setText('moment-pilot', pilotKg ? momentPilot.toFixed(2) : '—');
  setText('moment-rear',  rearKg  ? momentRear.toFixed(2)  : '—');
  setText('moment-bag1',  bag1Kg  ? momentBag1.toFixed(2)  : '—');
  setText('moment-bag2',  bag2Kg  ? momentBag2.toFixed(2)  : '—');
  setText('moment-fuel',  fuelL   ? momentFuel.toFixed(2)  : '—');

  // Fuel kg conversion display
  setText('weight-fuel', fuelL ? fuelKg.toFixed(1) + ' kg' : '— kg');

  // ZFW subtotal
  setText('total-zfw',  hasInput ? zfwWeight.toFixed(1) : '—');
  setText('arm-zfw',    hasInput ? zfwArm.toFixed(2) : '—');
  setText('moment-zfw', hasInput ? zfwMoment.toFixed(2) : '—');

  // TOW subtotal
  setText('total-tow',  hasInput ? towWeight.toFixed(1) : '—');
  setText('arm-tow',    hasInput ? towArm.toFixed(2) : '—');
  setText('moment-tow', hasInput ? towMoment.toFixed(2) : '—');
  setText('cg-tow',     hasInput ? cgTow.toFixed(2) : '—');

  // Validation & warnings
  updateWarnings({
    bag1Kg, bag2Kg, fuelL,
    towWeight, cgTow, hasInput,
  });

  // Update graph data and redraw CG Moment Envelope
  graphData.towWeight = hasInput ? towWeight : 0;
  graphData.towMoment = hasInput ? towMoment : 0;
  drawGraph();
}

// ─── Validation & Warnings ─────────────────────────────────

/**
 * Helper: set or clear the input-error class on an element.
 */
function setInputError(id, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('input-error', isError);
}

/**
 * Helper: update a status span with ok/warn state and message.
 */
function setStatus(id, ok, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('ok', 'warn');
  if (message) {
    el.classList.add(ok ? 'ok' : 'warn');
    el.textContent = message;
  } else {
    el.textContent = '';
  }
}

/**
 * Check all weight / CG limits and update DOM indicators.
 * Called from calculate() after every recalc.
 */
function updateWarnings({ bag1Kg, bag2Kg, fuelL,
                          towWeight, cgTow, hasInput }) {
  const S = AIRCRAFT.stations;

  // ── Input-level checks ────────────────────────────────────
  const bag1Over    = bag1Kg > S.bag1.maxKg;
  const bag2Over    = bag2Kg > S.bag2.maxKg;
  const combBagOver = (bag1Kg + bag2Kg) > AIRCRAFT.maxBaggageCombined;
  const fuelOver    = fuelL > AIRCRAFT.maxFuelLiters;

  setInputError('input-bag1', bag1Over || combBagOver);
  setInputError('input-bag2', bag2Over || combBagOver);
  setInputError('input-fuel', fuelOver);

  // ── ZFW status ────────────────────────────────────────────
  const t = TRANSLATIONS[currentLang];
  const zfwIssues = [];
  if (bag1Over)    zfwIssues.push(t.bag1Over);
  if (bag2Over)    zfwIssues.push(t.bag2Over);
  if (combBagOver && !bag1Over && !bag2Over) zfwIssues.push(t.bagTotalOver);
  if (zfwIssues.length > 0) {
    setStatus('status-zfw', false, zfwIssues[0]);
  } else if (hasInput) {
    setStatus('status-zfw', true, t.ok);
  } else {
    setStatus('status-zfw', true, '');
  }

  // ── Takeoff Weight status ─────────────────────────────────
  const towOver     = towWeight > AIRCRAFT.maxTakeoffWeight;
  const towCgFwd    = towWeight > 0 && !towOver &&
                      cgTow < getForwardCGLimit(towWeight, 'normal');
  const towCgAft    = towWeight > 0 && !towOver &&
                      cgTow > getAftCGLimit(towWeight, 'normal');
  if (fuelOver) {
    setStatus('status-tow', false, t.fuelOver);
  } else if (towOver) {
    setStatus('status-tow', false, t.overMax);
  } else if (towCgFwd) {
    setStatus('status-tow', false, t.cgFwd);
  } else if (towCgAft) {
    setStatus('status-tow', false, t.cgAft);
  } else if (hasInput) {
    setStatus('status-tow', true, t.ok);
  } else {
    setStatus('status-tow', true, '');
  }
}

// ─── Graph State (set by calculate(), read by drawGraph()) ──
let graphData = {
  towWeight: 0, towMoment: 0,
};

// ─── Point-in-Polygon test (ray-casting) ────────────────────
function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].m, yi = polygon[i].w;
    const xj = polygon[j].m, yj = polygon[j].w;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── CG Moment Envelope Graph ──────────────────────────────
function drawGraph() {
  const canvas = document.getElementById('cg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Make canvas responsive — match container width
  const container = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const cssW = container.clientWidth;
  const cssH = Math.min(cssW * 0.85, 500);
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = cssW;
  const H = cssH;
  const padding = { top: 40, right: 40, bottom: 50, left: 65 };

  // Chart area
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  // Data ranges — enough room for Normal envelope (max moment ~1307) + labels
  const momentMin = 550;
  const momentMax = 1450;
  const weightMin = 600;
  const weightMax = 1150;

  // Coordinate transforms
  function toX(moment) { return padding.left + (moment - momentMin) / (momentMax - momentMin) * chartW; }
  function toY(weight) { return padding.top + (1 - (weight - weightMin) / (weightMax - weightMin)) * chartH; }

  // ── 1. Clear ──────────────────────────────────────────────
  ctx.clearRect(0, 0, W, H);

  // ── 2. Title ──────────────────────────────────────────────
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(TRANSLATIONS[currentLang].graphTitle, W / 2, 22);

  // ── 3. Grid lines & labels ────────────────────────────────
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Y-axis grid (weight)
  const weightSteps = [600, 700, 800, 900, 1000, 1100];
  weightSteps.forEach(w => {
    const y = toY(w);
    // Grid line
    ctx.beginPath();
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.moveTo(padding.left, y);
    ctx.lineTo(W - padding.right, y);
    ctx.stroke();
    // Label
    ctx.fillStyle = '#666';
    ctx.fillText(w.toString(), padding.left - 8, y);
  });

  // X-axis grid (moment)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const momentSteps = [600, 700, 800, 900, 1000, 1100, 1200, 1300];
  momentSteps.forEach(m => {
    const x = toX(m);
    // Grid line
    ctx.beginPath();
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, H - padding.bottom);
    ctx.stroke();
    // Label
    ctx.fillStyle = '#666';
    ctx.fillText(m.toString(), x, H - padding.bottom + 6);
  });

  // Axes border
  ctx.beginPath();
  ctx.strokeStyle = '#aaa';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, H - padding.bottom);
  ctx.lineTo(W - padding.right, H - padding.bottom);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#555';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(TRANSLATIONS[currentLang].graphMoment, W / 2, H - 14);

  // Y-axis label (rotated)
  ctx.save();
  ctx.translate(14, padding.top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(TRANSLATIONS[currentLang].graphWeight, 0, 0);
  ctx.restore();

  // ── 4. Normal Category envelope (filled) ──────────────────
  const normalPoly = [
    { m: 680 * 0.89, w: 680 },
    { m: 885 * 0.89, w: 885 },
    { m: 1089 * 1.00, w: 1089 },
    { m: 1089 * 1.20, w: 1089 },
    { m: 885 * 1.20, w: 885 },
    { m: 680 * 1.20, w: 680 },
  ];

  // Filled polygon
  ctx.beginPath();
  ctx.moveTo(toX(normalPoly[0].m), toY(normalPoly[0].w));
  for (let i = 1; i < normalPoly.length; i++) {
    ctx.lineTo(toX(normalPoly[i].m), toY(normalPoly[i].w));
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(232, 115, 26, 0.15)';
  ctx.fill();
  ctx.strokeStyle = '#E8731A';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.stroke();

  // Normal label
  ctx.fillStyle = '#E8731A';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(TRANSLATIONS[currentLang].graphNormal, toX(1089 * 1.10), toY(1089) - 6);

  // ── 5. Utility Category envelope (dashed) ─────────────────
  const utilityPoly = [
    { m: 680 * 0.89, w: 680 },
    { m: 885 * 0.89, w: 885 },
    { m: 952 * 0.93, w: 952 },
    { m: 952 * 1.03, w: 952 },
    { m: 885 * 1.03, w: 885 },
    { m: 680 * 1.03, w: 680 },
  ];

  ctx.beginPath();
  ctx.moveTo(toX(utilityPoly[0].m), toY(utilityPoly[0].w));
  for (let i = 1; i < utilityPoly.length; i++) {
    ctx.lineTo(toX(utilityPoly[i].m), toY(utilityPoly[i].w));
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(232, 115, 26, 0.05)';
  ctx.fill();
  ctx.strokeStyle = '#C45F10';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Utility label
  ctx.fillStyle = '#C45F10';
  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(TRANSLATIONS[currentLang].graphUtility, toX(952 * 0.96), toY(952) - 4);

  // ── 6. Plot Takeoff Weight point ────────────────────────────
  const { towWeight, towMoment } = graphData;

  if (towWeight > 0) {
    const inNormal = pointInPolygon(towMoment, towWeight, normalPoly);
    const color = inNormal ? '#1565C0' : '#C62828';
    const x = toX(towMoment);
    const y = toY(towWeight);

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Label
    const label = TRANSLATIONS[currentLang].graphTakeoff;
    ctx.fillStyle = color;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 11, y);
  }

  // ── 7. Legend ──────────────────────────────────────────────
  const legendX = W - padding.right - 130;
  const legendY = H - padding.bottom - 60;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(legendX - 8, legendY - 6, 134, 52);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 8, legendY - 6, 134, 52);

  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Takeoff weight legend
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 8, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1565C0';
  ctx.fill();
  ctx.fillText(TRANSLATIONS[currentLang].graphTakeoff, legendX + 16, legendY + 8);

  // Outside legend
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 24, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#C62828';
  ctx.fill();
  ctx.fillText(TRANSLATIONS[currentLang].graphOutside, legendX + 16, legendY + 24);

  // Normal envelope legend
  ctx.fillStyle = 'rgba(232, 115, 26, 0.3)';
  ctx.fillRect(legendX, legendY + 36, 12, 4);
  ctx.strokeStyle = '#E8731A';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY + 36, 12, 4);
  ctx.fillStyle = '#555';
  ctx.fillText(TRANSLATIONS[currentLang].graphEnvelope, legendX + 16, legendY + 38);
}

// ─── Debounce helper ────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── Event Listeners ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const inputIds = [
    'input-pilot', 'input-rear',
    'input-bag1',  'input-bag2',
    'input-fuel',
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculate);
  });

  // Language toggle
  document.getElementById('lang-toggle').addEventListener('click', () => {
    setLanguage(currentLang === 'nl' ? 'en' : 'nl');
  });

  // Print button
  document.getElementById('btn-print').addEventListener('click', printPage);

  // Reset button
  document.getElementById('btn-reset').addEventListener('click', resetForm);

  // Redraw graph on window resize (debounced)
  window.addEventListener('resize', debounce(drawGraph, 150));

  // Initialize on load — apply saved or default language
  setLanguage(currentLang);
});

// ─── Print Page ─────────────────────────────────────────────
function printPage() {
  // Auto-fill date (DD-MM-YYYY local) and time (HH:MM UTC)
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  setText('print-date', `${dd}-${mm}-${yyyy}`);

  const utcH = String(now.getUTCHours()).padStart(2, '0');
  const utcM = String(now.getUTCMinutes()).padStart(2, '0');
  setText('print-time', `${utcH}:${utcM} UTC`);

  // Convert canvas to image for reliable print rendering
  const canvas = document.getElementById('cg-canvas');
  const printImg = document.getElementById('cg-canvas-print');
  if (canvas && printImg) {
    printImg.src = canvas.toDataURL('image/png');
    printImg.removeAttribute('hidden');
  }

  window.print();
}

// ─── Reset Form ─────────────────────────────────────────────
function resetForm() {
  const inputIds = [
    'input-pilot', 'input-rear',
    'input-bag1',  'input-bag2',
    'input-fuel',
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  calculate();
}
