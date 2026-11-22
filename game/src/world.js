// The game state: levels, scoring, alarm, lives, win and lose.
// Pure logic — no canvas, no DOM — so the headless tests can play it too.
import { LEVELS } from './levels.js';
import { MAX_ALARM, MAX_LIVES, SCORE, TILE } from './config.js';
import { createGuard, updateGuard } from './guards.js';
import { createPlayer, movePlayer, playerNoiseRadius, useDecoy, useSmoke } from './player.js';

export const SCREEN = {
  TITLE: 'title',
  PLAYING: 'playing',
  PAUSED: 'paused',
  LEVEL_CLEAR: 'levelclear',
  WIN: 'win',
  LOSE: 'lose',
};

export function createWorld() {
  const world = {
    screen: SCREEN.TITLE,
    levelIndex: 0,
    grid: [],
    player: null,
    playerStart: { x: 0, y: 0 },
    guards: [],
    artifacts: [],
    exit: { x: 0, y: 0 },
    exitOpen: false,
    smoke: [],
    noise: [],
    score: 0,
    best: 0,
    combo: 1,
    lives: MAX_LIVES,
    alarm: 0,
    alarmTimer: 0,
    levelSpotted: 0,
    timesSpotted: 0,
    levelTime: 0,
    levelStartScore: 0,
    invulnerable: 0,
    message: '',
    messageTime: 0,
    events: [],
    wardenPhase: 1,
    wardenSpeedFactor: 1,
    runStats: { artifacts: 0, spotted: 0, smokes: 0, decoys: 0 },
  };
  // Parse gallery I so the title screen already shows the museum behind it.
  parseLevel(world, LEVELS[0]);
  return world;
}

function parseLevel(world, level) {
  world.grid = level.map.map((row) => row.split(''));
  world.artifacts = [];
  world.guards = level.guards.map((def) => createGuard(def));
  for (let y = 0; y < level.map.length; y += 1) {
    for (let x = 0; x < level.map[y].length; x += 1) {
      const ch = level.map[y][x];
      const cx = x * TILE + TILE / 2;
      const cy = y * TILE + TILE / 2;
      if (ch === 'P') {
        world.playerStart = { x: cx, y: cy };
      } else if (ch === 'A') {
        world.artifacts.push({ x: cx, y: cy, taken: false });
      } else if (ch === 'E') {
        world.exit = { x: cx, y: cy };
      }
    }
  }
  world.player = createPlayer(world.playerStart.x, world.playerStart.y);
  world.exitOpen = false;
  world.smoke = [];
  world.noise = [];
  world.alarm = 0;
  world.alarmTimer = 0;
  world.levelSpotted = 0;
  world.levelTime = 0;
  world.levelStartScore = world.score;
  world.invulnerable = 0;
  world.wardenPhase = 1;
  world.wardenSpeedFactor = 1;
}

export function startRun(world) {
  world.score = 0;
  world.combo = 1;
  world.lives = MAX_LIVES;
  world.timesSpotted = 0;
  world.runStats = { artifacts: 0, spotted: 0, smokes: 0, decoys: 0 };
  startLevel(world, 0);
}

export function startLevel(world, index) {
  world.levelIndex = index;
  parseLevel(world, LEVELS[index]);
  world.screen = SCREEN.PLAYING;
  world.message = LEVELS[index].name;
  world.messageTime = 3;
}

export function restartLevel(world) {
  const keepScore = world.levelStartScore;
  const keepLives = world.lives;
  const keepSpotted = world.timesSpotted;
  parseLevel(world, LEVELS[world.levelIndex]);
  world.score = keepScore;
  world.lives = keepLives;
  world.timesSpotted = keepSpotted;
  world.combo = 1;
  world.screen = SCREEN.PLAYING;
}

export function currentLevel(world) {
  return LEVELS[world.levelIndex];
}

export function tileAt(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.grid[0].length) return '#';
  return world.grid[ty][tx];
}

export function isBlockingPx(world, x, y) {
  const t = tileAt(world, x, y);
  return t === '#' || t === 'C';
}

function playerCover(world) {
  const t = tileAt(world, world.player.x, world.player.y);
  return { inBush: t === 'B', inShadow: t === ',' };
}

function updateWardenPhase(world) {
  if (world.levelIndex !== 2) return;
  const taken = world.artifacts.filter((a) => a.taken).length;
  const phase = taken === 0 ? 1 : taken < 3 ? 2 : 3;
  if (phase !== world.wardenPhase) {
    world.wardenPhase = phase;
    world.wardenSpeedFactor = phase === 1 ? 1 : phase === 2 ? 1.3 : 1.6;
    world.events.push({ type: 'phase', phase });
    world.message =
      phase === 2
        ? 'THE WARDEN IS SWEEPING — wider cones, faster patrol'
        : 'THE WARDEN IS HUNTING — phase 3, it never stops';
    world.messageTime = 3;
  }
}

function onSpotted(world, guard) {
  world.alarm = Math.min(MAX_ALARM, world.alarm + 1);
  world.levelSpotted += 1;
  world.timesSpotted += 1;
  world.runStats.spotted += 1;
  world.combo = 1;
  world.alarmTimer = 0;
  world.events.push({ type: 'spotted', guard: guard.kind, alarm: world.alarm });
  world.message = 'SPOTTED! Alarm ' + world.alarm + '/' + MAX_ALARM + ' — break line of sight!';
  world.messageTime = 2.5;
  if (world.alarm >= MAX_ALARM) {
    loseRun(world, 'The alarm hit 3 — the museum is locked down.');
  }
}

function onCaught(world, guard) {
  if (world.invulnerable > 0 || world.screen !== SCREEN.PLAYING) return;
  world.lives -= 1;
  world.events.push({ type: 'caught', guard: guard.kind, lives: world.lives });
  world.combo = 1;
  if (world.lives <= 0) {
    loseRun(world, 'The ' + guard.kind + ' caught you — no lives left.');
    return;
  }
  world.message = 'CAUGHT by the ' + guard.kind + '! A life is gone — back to the entrance.';
  world.messageTime = 3;
  world.player.x = world.playerStart.x;
  world.player.y = world.playerStart.y;
  world.invulnerable = 2;
  for (const g of world.guards) {
    g.awareness = 0;
    g.state = 'return';
    g.stateTime = 0;
    g.lastSeen = null;
  }
}

function loseRun(world, reason) {
  world.screen = SCREEN.LOSE;
  world.message = reason;
  world.events.push({ type: 'lose', reason });
  if (world.score > world.best) world.best = world.score;
}

function clearLevel(world) {
  const timeBonus = Math.max(
    0,
    Math.round(SCORE.timeBonusMax * (1 - world.levelTime / SCORE.timeBonusSeconds)),
  );
  const ghost = world.levelSpotted === 0 ? SCORE.ghostBonus : 0;
  world.score += SCORE.levelClear + ghost + timeBonus;
  world.events.push({ type: 'levelclear', ghost, timeBonus });
  if (world.levelIndex >= LEVELS.length - 1) {
    world.screen = SCREEN.WIN;
    world.events.push({ type: 'win', score: world.score });
    if (world.score > world.best) world.best = world.score;
  } else {
    world.screen = SCREEN.LEVEL_CLEAR;
  }
}

/**
 * One tick. `input` is { moveX, moveY, sneak, smokePressed, decoyAt }.
 * One-shot flags (smokePressed, decoyAt) are consumed here.
 */
export function updateWorld(world, input, dt) {
  world.events = [];
  if (world.screen !== SCREEN.PLAYING) return;
  const player = world.player;
  world.levelTime += dt;
  if (world.invulnerable > 0) world.invulnerable -= dt;
  if (world.messageTime > 0) world.messageTime -= dt;

  // Gadgets.
  if (input.smokePressed) {
    input.smokePressed = false;
    const cloud = useSmoke(player);
    if (cloud) {
      world.smoke.push(cloud);
      world.runStats.smokes += 1;
      world.events.push({ type: 'smoke' });
    }
  }
  if (input.decoyAt) {
    const noise = useDecoy(player, input.decoyAt.x, input.decoyAt.y);
    input.decoyAt = null;
    if (noise) {
      world.noise.push(noise);
      world.runStats.decoys += 1;
      world.events.push({ type: 'decoy' });
    }
  }

  // Movement and footsteps.
  player.sneaking = !!input.sneak;
  player.running = !player.sneaking && player.moving;
  movePlayer(player, input.moveX, input.moveY, world.grid, dt);
  const noiseRadius = playerNoiseRadius(player, dt);
  if (noiseRadius > 0) {
    world.noise.push({ x: player.x, y: player.y, radius: noiseRadius, ttl: 0.35 });
    world.events.push({ type: 'step', sneaking: player.sneaking });
  }

  // Smoke clouds and noises fade.
  for (const cloud of world.smoke) cloud.ttl -= dt;
  world.smoke = world.smoke.filter((c) => c.ttl > 0);
  for (const n of world.noise) n.ttl -= dt;
  world.noise = world.noise.filter((n) => n.ttl > 0);

  // Cover under the player's feet.
  const cover = playerCover(world);
  const view = {
    player: {
      x: player.x,
      y: player.y,
      sneaking: player.sneaking,
      running: !player.sneaking && player.moving,
      inBush: cover.inBush,
      inShadow: cover.inShadow,
    },
    isBlockingPx: (x, y) => isBlockingPx(world, x, y),
    noise: world.noise,
    smoke: world.smoke,
    wardenSpeedFactor: world.wardenSpeedFactor,
  };

  // Guards think and move; a filled awareness meter raises the alarm.
  const guardEvents = [];
  for (const guard of world.guards) {
    updateGuard(guard, dt, view, guardEvents);
  }
  for (const ev of guardEvents) {
    if (ev.type === 'spotted') onSpotted(world, ev.guard);
  }
  if (world.screen !== SCREEN.PLAYING) return;

  // A guard that reaches the thief catches them.
  for (const guard of world.guards) {
    if (guard.state === 'chase' && world.invulnerable <= 0) {
      const d = Math.hypot(guard.x - player.x, guard.y - player.y);
      if (d < 30) {
        onCaught(world, guard);
        break;
      }
    }
  }
  if (world.screen !== SCREEN.PLAYING) return;

  // Artifacts: walk over one to pocket it.
  for (const art of world.artifacts) {
    if (art.taken) continue;
    if (Math.hypot(art.x - player.x, art.y - player.y) < 30) {
      art.taken = true;
      const gained = SCORE.artifact * world.combo;
      world.score += gained;
      world.runStats.artifacts += 1;
      world.events.push({ type: 'pickup', gained, combo: world.combo });
      world.combo = Math.min(3, world.combo + 1);
      world.message = 'Relic pocketed! +' + gained + '  (combo x' + world.combo + ')';
      world.messageTime = 2;
      updateWardenPhase(world);
    }
  }

  // The exit opens once every relic in the gallery is pocketed.
  const takenCount = world.artifacts.filter((a) => a.taken).length;
  if (!world.exitOpen && takenCount === world.artifacts.length) {
    world.exitOpen = true;
    world.events.push({ type: 'exitopen' });
    world.message = 'All relics taken — the EXIT is open. Go, unseen!';
    world.messageTime = 3;
  }
  if (world.exitOpen && Math.hypot(world.exit.x - player.x, world.exit.y - player.y) < 32) {
    clearLevel(world);
    return;
  }

  // The alarm slowly cools when nobody is watching.
  const anyoneWatching = world.guards.some((g) => g.awareness > 0);
  if (!anyoneWatching && world.alarm > 0) {
    world.alarmTimer += dt;
    if (world.alarmTimer > 20) {
      world.alarm -= 1;
      world.alarmTimer = 0;
      world.events.push({ type: 'alarmcool', alarm: world.alarm });
    }
  } else {
    world.alarmTimer = 0;
  }
}
