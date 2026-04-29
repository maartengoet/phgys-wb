// takeoff-calc.js — pure calculation functions (no DOM access)
// All functions are pure and unit-tested via takeoff-calc.test.js

export function pressureAltitude(elevationFt, qnhHpa) {
  return elevationFt + (1013 - qnhHpa) * 27;
}

/**
 * Returns headwind/crosswind for a wind blowing FROM windDir.
 * Headwind is positive when wind opposes the runway heading.
 * Crosswind is the absolute magnitude (positive number).
 */
export function windComponents(rwyBrgDeg, windDirDeg, windSpeedKt) {
  let delta = windDirDeg - rwyBrgDeg;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  const rad = (delta * Math.PI) / 180;
  return {
    headwind: windSpeedKt * Math.cos(rad),
    crosswind: Math.abs(windSpeedKt * Math.sin(rad)),
  };
}
