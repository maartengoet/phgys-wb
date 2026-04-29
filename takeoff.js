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

// ─── i18n ────────────────────────────────────────────────

const TRANSLATIONS = {
  nl: {
    title: 'PH-GYS Takeoff Distance — EHHV',
    backLink: '← Weight & Balance',
    langToggle: 'EN',
    disclaimer: '<strong>De pilot-in-command (PIC) blijft te allen tijde verantwoordelijk</strong> voor de go/no-go beslissing. Berekening is slechts hulpmiddel; verifieer tegen actuele POH en omstandigheden.',
    inputHeader: 'Invoer',
    lblTow: 'TOW (kg)',
    lblOat: 'OAT (°C)',
    lblQnh: 'QNH (hPa)',
    lblWindDir: 'Wind richting (°)',
    lblWindSpeed: 'Wind (kt)',
    lblWindGust: 'Gust (kt)',
    lblSurface: 'Oppervlak',
    dryGrass: 'Droog gras (+15%)',
    wetGrass: 'Nat gras (+45%)',
    lblRwy: 'Actieve baan/banen',
    printBtn: 'Print / Save as PDF',
    pohLink: '📄 POH-tabellen',
    footer: 'Berekening op basis van Cessna F172N AFM Section 5 (Edition 1, Aug 1976). Declared distances per <a href="https://www.lvnl.nl/en/eaip" target="_blank" rel="noopener">AIP EHHV AD 2.13</a>. Slechts hulpmiddel voor planning.',
    fillInputs: 'Vul TOW, OAT en QNH in.',
    selectRunway: 'Selecteer ten minste één baan.',
    cardRequired: 'Required',
    cardAvailable: 'Available',
    cardMargin: 'Margin',
    cardGroundRoll: 'Ground roll',
    cardOverObstacle: 'Over 15m obstacle',
    cardSurfaceDry: 'Oppervlak: droog gras (+15% GR)',
    cardSurfaceWet: 'Oppervlak: nat gras (+45% GR)',
    windHead: 'Head',
    windTail: 'Tail',
    windCross: 'Cross',
    windCalm: 'Calm',
  },
  en: {
    title: 'PH-GYS Takeoff Distance — EHHV',
    backLink: '← Weight & Balance',
    langToggle: 'NL',
    disclaimer: '<strong>The pilot-in-command (PIC) remains responsible at all times</strong> for the go/no-go decision. This calculation is an aid only; verify against the current POH and conditions.',
    inputHeader: 'Inputs',
    lblTow: 'TOW (kg)',
    lblOat: 'OAT (°C)',
    lblQnh: 'QNH (hPa)',
    lblWindDir: 'Wind direction (°)',
    lblWindSpeed: 'Wind (kt)',
    lblWindGust: 'Gust (kt)',
    lblSurface: 'Surface',
    dryGrass: 'Dry grass (+15%)',
    wetGrass: 'Wet grass (+45%)',
    lblRwy: 'Active runway(s)',
    printBtn: 'Print / Save as PDF',
    pohLink: '📄 POH tables',
    footer: 'Based on Cessna F172N AFM Section 5 (Edition 1, Aug 1976). Declared distances per <a href="https://www.lvnl.nl/en/eaip" target="_blank" rel="noopener">AIP EHHV AD 2.13</a>. Planning aid only.',
    fillInputs: 'Enter TOW, OAT and QNH.',
    selectRunway: 'Select at least one runway.',
    cardRequired: 'Required',
    cardAvailable: 'Available',
    cardMargin: 'Margin',
    cardGroundRoll: 'Ground roll',
    cardOverObstacle: 'Over 15m obstacle',
    cardSurfaceDry: 'Surface: dry grass (+15% GR)',
    cardSurfaceWet: 'Surface: wet grass (+45% GR)',
    windHead: 'Head',
    windTail: 'Tail',
    windCross: 'Cross',
    windCalm: 'Calm',
  },
};

let currentLang = localStorage.getItem('lang') || 'nl';

function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS.nl[key] ?? key;
}

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const value = TRANSLATIONS[lang][key];
    if (value !== undefined) {
      // disclaimer/footer contain HTML markup, the rest is plain text
      if (key === 'disclaimer' || key === 'footer') el.innerHTML = value;
      else el.textContent = value;
    }
  });
  render();
}

// ─── Render ──────────────────────────────────────────────

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
    appendWarning(warningsEl, 'info', t('fillInputs'));
    return;
  }
  if (selectedRunways.length === 0) {
    appendWarning(warningsEl, 'info', t('selectRunway'));
    return;
  }

  const seenWarnings = new Set();

  for (const rwyId of selectedRunways) {
    const rwy = EHHV_RUNWAYS.find((r) => r.id === rwyId);
    if (!rwy) continue;

    const lowerSpeed = windGust === null ? windSpeed : Math.min(windSpeed, windGust);
    const upperSpeed = windGust === null ? windSpeed : Math.max(windSpeed, windGust);

    const lowerComp = windComponents(rwy.brgTrue, windDir, lowerSpeed);
    const upperComp = windComponents(rwy.brgTrue, windDir, upperSpeed);

    let headwind = 0;
    let tailwind = 0;
    if (lowerComp.headwind > 0) {
      headwind = lowerComp.headwind;
    } else {
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
      windDir, windSpeed, windGust,
      windDisplaySpeed: upperSpeed, // used by chart (worst-case for arrow length consistency)
    }));
  }
}

function renderCard({ rwy, headwind, tailwind, crosswind, required, available, flag, surface, windDir, windSpeed, windGust, windDisplaySpeed }) {
  const card = document.createElement('div');
  card.className = `runway-card flag-${flag}`;

  const grMargin = available.toraM - required.groundRoll;
  const grPct = required.groundRoll > 0 ? Math.round((grMargin / required.groundRoll) * 100) : 0;
  const totalMargin = available.todaM - required.total;
  const totalPct = required.total > 0 ? Math.round((totalMargin / required.total) * 100) : 0;

  const windParts = [];
  if (headwind > 0) windParts.push(`${t('windHead')} ${Math.round(headwind)} kt`);
  if (tailwind > 0) windParts.push(`<strong>${t('windTail')} ${Math.round(tailwind)} kt</strong>`);
  if (crosswind > 0) windParts.push(`${t('windCross')} ${Math.round(crosswind)} kt`);
  if (windParts.length === 0) windParts.push(t('windCalm'));

  const surfaceLabel = surface === 'wet-grass' ? t('cardSurfaceWet') : t('cardSurfaceDry');

  card.innerHTML = `
    <div class="card-head">
      <div class="card-head-text">
        <h3>RWY ${rwy.id} <span class="brg">(${rwy.brgTrue}°)</span></h3>
        <div class="wind-line">Wind: ${windParts.join(' · ')}</div>
      </div>
      <button type="button" class="runway-chart-button" aria-label="Open runway ${rwy.id} chart">${renderRunwayChart(rwy, flag, windDir, windDisplaySpeed)}</button>
    </div>
    <table>
      <thead>
        <tr><th></th><th>${t('cardRequired')}</th><th>${t('cardAvailable')}</th><th>${t('cardMargin')}</th></tr>
      </thead>
      <tbody>
        <tr><td>${t('cardGroundRoll')}</td><td>${required.groundRoll} m</td><td>${available.toraM} m</td><td>${formatMargin(grMargin, grPct)}</td></tr>
        <tr><td>${t('cardOverObstacle')}</td><td>${required.total} m</td><td>${available.todaM} m</td><td>${formatMargin(totalMargin, totalPct)}</td></tr>
      </tbody>
    </table>
    <div class="surface-line">${surfaceLabel}</div>
  `;

  // Wire chart click → modal with the closure data
  const chartBtn = card.querySelector('.runway-chart-button');
  chartBtn.addEventListener('click', () => openRunwayModal({
    rwy, flag,
    windDir, windSpeed, windGust, windDisplaySpeed,
    headwind, tailwind, crosswind,
    required, available, surface,
  }));

  return card;
}

// Mini compass chart per runway: SVG 100×100 viewBox, runway oriented to true
// bearing in the flag colour, optional wind-from arrow.
function renderRunwayChart(rwy, flag, windDir, windSpeed) {
  const flagColor = { green: '#27ae60', orange: '#e67e22', red: '#c0392b' }[flag];
  const oppositeNum = ((parseInt(rwy.id, 10) + 18 - 1) % 36) + 1;
  const oppositeStr = String(oppositeNum).padStart(2, '0');

  // Counter-rotate the labels so they stay upright relative to the page
  const labelRot = -rwy.brgTrue;

  let windSvg = '';
  if (windSpeed > 0) {
    // Wind FROM windDir → tail at the wind-from edge, head pointing inward
    const R = 40;
    const inner = 18;
    const rad = windDir * Math.PI / 180;
    const tailX = 50 + Math.sin(rad) * R;
    const tailY = 50 - Math.cos(rad) * R;
    const headX = 50 + Math.sin(rad) * inner;
    const headY = 50 - Math.cos(rad) * inner;
    windSvg = `
      <g class="wind-arrow">
        <line x1="${tailX.toFixed(1)}" y1="${tailY.toFixed(1)}" x2="${headX.toFixed(1)}" y2="${headY.toFixed(1)}"
              stroke="#3498db" stroke-width="2" stroke-linecap="round" marker-end="url(#wind-head)"/>
      </g>
    `;
  }

  return `
    <svg class="runway-chart" viewBox="0 0 100 100" role="img" aria-label="Runway ${rwy.id} oriëntatie">
      <defs>
        <marker id="wind-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 Z" fill="#3498db"/>
        </marker>
      </defs>
      <circle cx="50" cy="50" r="46" fill="#fafafa" stroke="#ccc" stroke-width="1"/>
      <text x="50" y="9" text-anchor="middle" font-size="8" fill="#777">N</text>
      <g transform="rotate(${rwy.brgTrue}, 50, 50)">
        <rect x="44" y="14" width="12" height="72" rx="3" fill="${flagColor}" opacity="0.92"/>
        <g transform="rotate(${labelRot}, 50, 19)"><text x="50" y="21" text-anchor="middle" font-size="7" fill="#fff" font-weight="700">${rwy.id}</text></g>
        <g transform="rotate(${labelRot}, 50, 81)"><text x="50" y="83" text-anchor="middle" font-size="7" fill="#fff" font-weight="700">${oppositeStr}</text></g>
      </g>
      ${windSvg}
    </svg>
  `;
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

// ─── Runway chart modal ─────────────────────────────────

function openRunwayModal({ rwy, flag, windDir, windSpeed, windGust, windDisplaySpeed, headwind, tailwind, crosswind, required, available, surface }) {
  const modal = $('rwy-modal');
  const flagIcon = { green: '🟢', orange: '🟠', red: '🔴' }[flag];
  $('rwy-modal-title').textContent = `RWY ${rwy.id} (${rwy.brgTrue}°) ${flagIcon}`;
  $('rwy-modal-chart').innerHTML = renderRunwayChart(rwy, flag, windDir, windDisplaySpeed);

  const surfaceLabel = surface === 'wet-grass' ? t('cardSurfaceWet') : t('cardSurfaceDry');
  const windRows = [];
  if (headwind > 0) windRows.push([t('windHead'), `${Math.round(headwind)} kt`]);
  if (tailwind > 0) windRows.push([t('windTail'), `${Math.round(tailwind)} kt`]);
  if (crosswind > 0) windRows.push([t('windCross'), `${Math.round(crosswind)} kt`]);
  if (windRows.length === 0) windRows.push([t('windCalm'), '—']);
  if (windSpeed > 0 || windGust !== null) {
    const dir = String(windDir).padStart(3, '0');
    const gustPart = (windGust !== null && windGust !== windSpeed) ? ` G${Math.round(windGust)}` : '';
    windRows.unshift(['Wind', `${dir}° / ${Math.round(windSpeed)} kt${gustPart}`]);
  }

  const distRows = [
    [t('cardGroundRoll'), `${required.groundRoll} m / ${available.toraM} m TORA`],
    [t('cardOverObstacle'), `${required.total} m / ${available.todaM} m TODA`],
    [t('lblSurface'), surfaceLabel.replace(/^[^:]+:\s*/, '')],
  ];

  $('rwy-modal-info').innerHTML =
    [...windRows, ...distRows].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeRunwayModal() {
  const modal = $('rwy-modal');
  modal.hidden = true;
  document.body.style.overflow = '';
}

function initModal() {
  const modal = $('rwy-modal');
  if (!modal) return;
  modal.querySelectorAll('[data-modal-close]').forEach((el) => {
    el.addEventListener('click', closeRunwayModal);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeRunwayModal();
  });
}

// ─── Init ────────────────────────────────────────────────

function buildRunwayCheckboxes() {
  const container = $('runway-checkboxes');
  container.innerHTML = EHHV_RUNWAYS.map((r) =>
    `<label><input type="checkbox" name="rwy" value="${r.id}"> ${r.id}</label>`
  ).join(' ');
}

// Persist all takeoff-page inputs so a round-trip to /takeoff-tables.html
// (or anywhere else) doesn't lose what the pilot entered. Each persisted
// number/string is keyed under "phgys-takeoff-<id>" in sessionStorage.
const PERSISTED_INPUT_IDS = [
  'in-tow', 'in-oat', 'in-qnh',
  'in-wind-dir', 'in-wind-speed', 'in-wind-gust',
];
const SURFACE_KEY = 'phgys-takeoff-surface';
const RUNWAYS_KEY = 'phgys-takeoff-runways';

function persistInputs() {
  for (const id of PERSISTED_INPUT_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.value !== '') sessionStorage.setItem(`phgys-takeoff-${id}`, el.value);
    else sessionStorage.removeItem(`phgys-takeoff-${id}`);
  }
  const surface = document.querySelector('input[name="surface"]:checked');
  if (surface) sessionStorage.setItem(SURFACE_KEY, surface.value);
  const rwys = Array.from(document.querySelectorAll('input[name="rwy"]:checked')).map((cb) => cb.value);
  sessionStorage.setItem(RUNWAYS_KEY, JSON.stringify(rwys));
}

function restoreInputs() {
  // TOW: prefer the takeoff-page value if present, otherwise fall back to
  // the W&B-page-bridged value (phgys-tow). This way an explicit override on
  // the takeoff page survives a round-trip; first-time visitors still get
  // their W&B TOW pre-filled.
  const towLocal = sessionStorage.getItem('phgys-takeoff-in-tow');
  const towBridge = sessionStorage.getItem('phgys-tow');
  if (towLocal !== null) {
    $('in-tow').value = towLocal;
  } else if (towBridge && !isNaN(parseFloat(towBridge))) {
    $('in-tow').value = parseFloat(towBridge).toFixed(1);
  }

  for (const id of PERSISTED_INPUT_IDS) {
    if (id === 'in-tow') continue;
    const stored = sessionStorage.getItem(`phgys-takeoff-${id}`);
    if (stored !== null) {
      const el = document.getElementById(id);
      if (el) el.value = stored;
    }
  }

  const surface = sessionStorage.getItem(SURFACE_KEY);
  if (surface) {
    const radio = document.querySelector(`input[name="surface"][value="${surface}"]`);
    if (radio) radio.checked = true;
  }

  try {
    const rwys = JSON.parse(sessionStorage.getItem(RUNWAYS_KEY) || '[]');
    for (const id of rwys) {
      const cb = document.querySelector(`input[name="rwy"][value="${id}"]`);
      if (cb) cb.checked = true;
    }
  } catch { /* ignore malformed payload */ }
}

function init() {
  buildRunwayCheckboxes();
  restoreInputs();
  document.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', () => { persistInputs(); render(); });
    el.addEventListener('change', () => { persistInputs(); render(); });
  });
  $('lang-toggle').addEventListener('click', () => {
    setLanguage(currentLang === 'nl' ? 'en' : 'nl');
  });
  $('btn-print').addEventListener('click', () => window.print());
  initModal();
  setLanguage(currentLang); // applies translations + initial render
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
