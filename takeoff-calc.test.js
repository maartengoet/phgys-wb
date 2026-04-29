import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressureAltitude, windComponents } from './takeoff-calc.js';

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
