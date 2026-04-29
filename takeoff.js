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

  // De-duplicate per-runway warnings: keep one entry per (code, runway).
  const seenWarnings = new Set();

  for (const rwyId of selectedRunways) {
    const rwy = EHHV_RUNWAYS.find((r) => r.id === rwyId);
    if (!rwy) continue;

    // Wind: lower of (steady, gust) for headwind benefit; higher for tailwind/crosswind risk
    const lowerSpeed = windGust === null ? windSpeed : Math.min(windSpeed, windGust);
    const upperSpeed = windGust === null ? windSpeed : Math.max(windSpeed, windGust);

    const lowerComp = windComponents(rwy.brgTrue, windDir, lowerSpeed);
    const upperComp = windComponents(rwy.brgTrue, windDir, upperSpeed);

    let headwind = 0;
    let tailwind = 0;
    if (lowerComp.headwind > 0) {
      headwind = lowerComp.headwind;
    } else {
      // No headwind benefit even at the lower wind → use upper as worst-case tailwind
      tailwind = -upperComp.headwind;
    }
    const crosswindLimit = upperComp.crosswind;

    const v = validateInputs({ tow, oat, pa, tailwind, crosswind: crosswindLimit });
    for (const w of v) {
      const key = `${w.code}|${rwy.id}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);
      appendWarning(warningsEl, w.severity, `${rwy.id}: ${w.message}`);
    }

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
