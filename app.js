/* ============================================================
   PH-GYS Weight & Balance Calculator — Core Calculation Engine
   Reims/Cessna F172N  |  Stichting Vliegmaterieel Schiphol
   ============================================================ */

'use strict';

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
  return isNaN(v) ? 0 : v;
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
  const taxiL   = readInput('input-taxi');
  const tripL   = readInput('input-trip');

  // 2. Convert fuel liters to kg
  const fuelKg = fuelL * AIRCRAFT.fuelDensity;
  const taxiKg = taxiL * AIRCRAFT.fuelDensity;
  const tripKg = tripL * AIRCRAFT.fuelDensity;

  // 3. Moments for each row
  const momentEmpty = AIRCRAFT.emptyMoment;
  const momentPilot = pilotKg * S.pilot.arm;
  const momentRear  = rearKg  * S.rear.arm;
  const momentBag1  = bag1Kg  * S.bag1.arm;
  const momentBag2  = bag2Kg  * S.bag2.arm;
  const momentFuel  = fuelKg  * S.fuel.arm;
  const momentTaxi  = taxiKg  * S.fuel.arm;
  const momentTrip  = tripKg  * S.fuel.arm;

  // 4. Subtotals
  const zfwWeight  = AIRCRAFT.emptyWeight + pilotKg + rearKg + bag1Kg + bag2Kg;
  const zfwMoment  = momentEmpty + momentPilot + momentRear + momentBag1 + momentBag2;
  const zfwArm     = zfwWeight > 0 ? zfwMoment / zfwWeight : 0;

  const rampWeight  = zfwWeight + fuelKg;
  const rampMoment  = zfwMoment + momentFuel;
  const rampArm     = rampWeight > 0 ? rampMoment / rampWeight : 0;

  const towWeight  = rampWeight - taxiKg;
  const towMoment  = rampMoment - momentTaxi;
  const towArm     = towWeight > 0 ? towMoment / towWeight : 0;

  const ldwWeight  = towWeight - tripKg;
  const ldwMoment  = towMoment - momentTrip;
  const ldwArm     = ldwWeight > 0 ? ldwMoment / ldwWeight : 0;

  // CG for TOW and LDW
  const cgTow = towWeight > 0 ? towMoment / towWeight : 0;
  const cgLdw = ldwWeight > 0 ? ldwMoment / ldwWeight : 0;

  // 5. Update the DOM — individual row moments
  setText('moment-empty', momentEmpty.toFixed(2));
  setText('moment-pilot', pilotKg ? momentPilot.toFixed(2) : '—');
  setText('moment-rear',  rearKg  ? momentRear.toFixed(2)  : '—');
  setText('moment-bag1',  bag1Kg  ? momentBag1.toFixed(2)  : '—');
  setText('moment-bag2',  bag2Kg  ? momentBag2.toFixed(2)  : '—');
  setText('moment-fuel',  fuelL   ? momentFuel.toFixed(2)  : '—');
  setText('moment-taxi',  taxiL   ? momentTaxi.toFixed(2)  : '—');
  setText('moment-trip',  tripL   ? momentTrip.toFixed(2)  : '—');

  // Fuel kg conversion displays
  setText('weight-fuel', fuelL ? fuelKg.toFixed(1) + ' kg' : '— kg');
  setText('weight-taxi', taxiL ? taxiKg.toFixed(1) + ' kg' : '— kg');
  setText('weight-trip', tripL ? tripKg.toFixed(1) + ' kg' : '— kg');

  // ZFW subtotal
  setText('total-zfw',  zfwWeight.toFixed(1));
  setText('arm-zfw',    zfwArm.toFixed(2));
  setText('moment-zfw', zfwMoment.toFixed(2));

  // Ramp subtotal
  setText('total-ramp',  rampWeight.toFixed(1));
  setText('arm-ramp',    rampArm.toFixed(2));
  setText('moment-ramp', rampMoment.toFixed(2));

  // TOW subtotal
  setText('total-tow',  towWeight.toFixed(1));
  setText('arm-tow',    towArm.toFixed(2));
  setText('moment-tow', towMoment.toFixed(2));
  setText('cg-tow',     cgTow.toFixed(2));

  // LDW subtotal
  setText('total-ldw',  ldwWeight.toFixed(1));
  setText('arm-ldw',    ldwArm.toFixed(2));
  setText('moment-ldw', ldwMoment.toFixed(2));
  setText('cg-ldw',     cgLdw.toFixed(2));

  // TODO: updateWarnings() — Task 5

  // Update graph data and redraw CG Moment Envelope
  graphData.towWeight = towWeight;
  graphData.towMoment = towMoment;
  graphData.ldwWeight = ldwWeight;
  graphData.ldwMoment = ldwMoment;
  drawGraph();
}

// ─── Graph State (set by calculate(), read by drawGraph()) ──
let graphData = {
  towWeight: 0, towMoment: 0,
  ldwWeight: 0, ldwMoment: 0,
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
  const padding = { top: 40, right: 30, bottom: 50, left: 65 };

  // Chart area
  const chartW = W - padding.left - padding.right;
  const chartH = H - padding.top - padding.bottom;

  // Data ranges
  const momentMin = 550;
  const momentMax = 1400;
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
  ctx.fillText('CG Moment Envelope', W / 2, 22);

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
  ctx.fillText('Moment (m\u00B7kg)', W / 2, H - 14);

  // Y-axis label (rotated)
  ctx.save();
  ctx.translate(14, padding.top + chartH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Weight (kg)', 0, 0);
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
  ctx.fillText('Normal', toX(1089 * 1.10), toY(1089) - 6);

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
  ctx.fillText('Utility', toX(952 * 0.96), toY(952) - 4);

  // ── 6. Plot Takeoff and Landing points ─────────────────────
  const { towWeight, towMoment, ldwWeight, ldwMoment } = graphData;

  function drawPoint(moment, weight, defaultColor, label) {
    if (weight <= 0) return;
    const inNormal = pointInPolygon(moment, weight, normalPoly);
    const color = inNormal ? defaultColor : '#C62828';
    const x = toX(moment);
    const y = toY(weight);

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
    ctx.fillStyle = color;
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 11, y);
  }

  drawPoint(towMoment, towWeight, '#1565C0', 'TOW');
  drawPoint(ldwMoment, ldwWeight, '#2E7D32', 'LDW');

  // ── 7. Legend ──────────────────────────────────────────────
  const legendX = W - padding.right - 120;
  const legendY = padding.top + 10;

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(legendX - 8, legendY - 6, 124, 68);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX - 8, legendY - 6, 124, 68);

  ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // TOW legend
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 8, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#1565C0';
  ctx.fill();
  ctx.fillText('Takeoff Weight', legendX + 16, legendY + 8);

  // LDW legend
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 24, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#2E7D32';
  ctx.fill();
  ctx.fillText('Landing Weight', legendX + 16, legendY + 24);

  // Outside legend
  ctx.beginPath();
  ctx.arc(legendX + 6, legendY + 40, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#C62828';
  ctx.fill();
  ctx.fillText('Outside Envelope', legendX + 16, legendY + 40);

  // Normal envelope legend
  ctx.fillStyle = 'rgba(232, 115, 26, 0.3)';
  ctx.fillRect(legendX, legendY + 52, 12, 4);
  ctx.strokeStyle = '#E8731A';
  ctx.lineWidth = 1;
  ctx.strokeRect(legendX, legendY + 52, 12, 4);
  ctx.fillStyle = '#555';
  ctx.fillText('Normal / Utility', legendX + 16, legendY + 54);
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
    'input-fuel',  'input-taxi', 'input-trip',
  ];

  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', calculate);
  });

  // Redraw graph on window resize (debounced)
  window.addEventListener('resize', debounce(drawGraph, 150));

  // Initialize on load
  calculate();
});
