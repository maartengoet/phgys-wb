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
