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
  // TODO: drawGraph()     — Task 4
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

  // Initialize on load
  calculate();
});
