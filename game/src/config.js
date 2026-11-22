// Shared numbers for SHADOW GALLERY. One place for every tuning value, so a
// balance change never has to hunt through the update code.
export const VIEW = { width: 1280, height: 800 };
export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;

// Player movement, in pixels per second.
export const PLAYER = {
  walkSpeed: 150,
  sneakSpeed: 78,
  radius: 13,
  // A running player is loud; a sneaking one is almost silent.
  noiseWalk: 90,
  noiseSneak: 26,
};

// How a guard's awareness fills while it can see the player, per second.
export const DETECTION = {
  baseRate: 55,
  closeBonus: 60,
  shadowFactor: 0.35,
  sneakFactor: 0.55,
  runFactor: 1.35,
  decayRate: 26,
  // A guard that just lost the player keeps hunting this long.
  huntSeconds: 4,
};

// Vision cone shape per guard kind.
export const CONES = {
  patroller: { range: 210, halfAngle: 0.61 },
  sentry: { range: 230, halfAngle: 0.55 },
  runner: { range: 190, halfAngle: 0.66 },
  hound: { range: 150, halfAngle: 0.85 },
  camera: { range: 250, halfAngle: 0.5 },
  warden: { range: 260, halfAngle: 0.6 },
};

export const GUARD_SPEED = {
  patroller: 62,
  sentry: 0,
  runner: 132,
  hound: 168,
  camera: 0,
  warden: 78,
};

// Gadgets the player starts each gallery with.
export const GADGETS = { smoke: 2, decoy: 3 };

// Scoring.
export const SCORE = {
  artifact: 500,
  levelClear: 1000,
  ghostBonus: 1500,
  timeBonusMax: 500,
  timeBonusSeconds: 120,
};

export const MAX_LIVES = 3;
export const MAX_ALARM = 3;
export const SMOKE_SECONDS = 4;
export const DECOY_SECONDS = 6;
