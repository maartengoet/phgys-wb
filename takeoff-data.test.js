import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABLE_1043KG, TABLE_953KG, TABLE_862KG,
  PA_VALUES_FT, OAT_VALUES_C, WEIGHTS_KG, TABLES_BY_WEIGHT,
  EHHV_RUNWAYS,
} from './takeoff-data.js';

test('all three tables have 9 PA rows and 5 OAT columns', () => {
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

test('1043 kg corners match POH (per CSV)', () => {
  // Corners at SL/0°C, SL/40°C, 8000ft/0°C, 8000ft/40°C
  // Values per soft_field_takeoff_distance.csv (1043 kg group).
  assert.deepEqual(TABLE_1043KG[0][0], [219, 394]);
  assert.deepEqual(TABLE_1043KG[0][4], [293, 518]);
  assert.deepEqual(TABLE_1043KG[8][0], [472, 875]);
  assert.deepEqual(TABLE_1043KG[8][4], [639, 1216]);
});

test('862 kg sea level row matches CSV', () => {
  assert.deepEqual(TABLE_862KG[0], [
    [143, 254], [154, 280], [165, 300], [177, 319], [189, 340],
  ]);
});

test('953 kg sea level row matches CSV', () => {
  assert.deepEqual(TABLE_953KG[0], [
    [178, 326], [192, 347], [207, 372], [221, 396], [234, 424],
  ]);
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
        TABLE_862KG[pa][oat][0] <= TABLE_953KG[pa][oat][0],
        `GR ${PA_VALUES_FT[pa]}/${OAT_VALUES_C[oat]}: 862kg ≤ 953kg`
      );
      assert.ok(
        TABLE_953KG[pa][oat][0] <= TABLE_1043KG[pa][oat][0],
        `GR ${PA_VALUES_FT[pa]}/${OAT_VALUES_C[oat]}: 953kg ≤ 1043kg`
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
