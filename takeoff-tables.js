// takeoff-tables.js — renders the POH takeoff distance tables for printing.

import {
  TABLE_862KG, TABLE_953KG, TABLE_1043KG,
  PA_VALUES_FT, OAT_VALUES_C,
} from './takeoff-data.js';

const liftoffSpeeds = {
  862:  { lo: '87 km/h / 47 kt', obs: '100 km/h / 54 kt' },
  953:  { lo: '93 km/h / 50 kt', obs: '104 km/h / 56 kt' },
  1043: { lo: '96 km/h / 52 kt', obs: '109 km/h / 59 kt' },
};

const TABLES = [
  { weight: 1043, table: TABLE_1043KG, blockId: 'block-1043' },
  { weight: 953,  table: TABLE_953KG,  blockId: 'block-953' },
  { weight: 862,  table: TABLE_862KG,  blockId: 'block-862' },
];

function renderTable({ weight, table, blockId }) {
  const block = document.getElementById(blockId);
  if (!block) return;
  const speeds = liftoffSpeeds[weight];

  const headerCols = OAT_VALUES_C.map((t) =>
    `<th colspan="2">${t}°C</th>`
  ).join('');
  const subHeaderCols = OAT_VALUES_C.map(() =>
    `<th class="sub">GR</th><th class="sub">15m</th>`
  ).join('');

  const rows = table.map((row, paIdx) => {
    const pa = PA_VALUES_FT[paIdx];
    const paLabel = pa === 0 ? 'SL' : `${pa}`;
    const cells = row.map(([gr, total]) =>
      `<td>${gr}</td><td>${total}</td>`
    ).join('');
    return `<tr><th>${paLabel}</th>${cells}</tr>`;
  }).join('');

  block.innerHTML = `
    <h2>${weight} kg — Maximum Weight</h2>
    <p class="speeds">Lift-off IAS: ${speeds.lo} · At 15 m: ${speeds.obs}</p>
    <table class="poh-table">
      <thead>
        <tr><th rowspan="2">PA (ft)</th>${headerCols}</tr>
        <tr>${subHeaderCols}</tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function init() {
  for (const t of TABLES) renderTable(t);
  const btn = document.getElementById('btn-print-tables');
  if (btn) btn.addEventListener('click', () => window.print());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
