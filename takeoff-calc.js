// takeoff-calc.js — pure calculation functions (no DOM access)
// All functions are pure and unit-tested via takeoff-calc.test.js

export function pressureAltitude(elevationFt, qnhHpa) {
  return elevationFt + (1013 - qnhHpa) * 27;
}
