// Screenshot scenes for ?shot=…. Each one plays the real rules forward from
// a fresh run, steered by an autopilot that plans a route on the tile grid
// (Dijkstra, where a tile inside a vision cone costs far more than a safe
// one) and waits out patrols instead of walking into them, so the frame is
// what a real game looks like and the same seed always gives the same frame.
import { TILE } from './config.js';
import { guardCanSee } from './guards.js';
import { SCREEN, startLevel, startRun, updateWorld } from './world.js';

const STEP = 1 / 30;

function tileAt(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.grid[0].length) return '#';
  return world.grid[ty][tx];
}

function isBlockingTile(world, tx, ty) {
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.grid[0].length) return true;
  const t = world.grid[ty][tx];
  return t === '#' || t === 'C';
}

/** Is this point inside any guard's cone right now? */
function dangerAt(world, x, y) {
  let danger = 0;
  const probe = { x, y, sneaking: true, running: false, inBush: false, inShadow: false };
  for (const guard of world.guards) {
    const check = guardCanSee(guard, probe, (px, py) => {
      const t = tileAt(world, px, py);
      return t === '#' || t === 'C';
    });
    if (check.seen) danger += 1 + (1 - check.dist / 260);
  }
  return danger;
}

/** One danger value per tile, from the guards' cones as they stand now. */
function dangerGrid(world) {
  const grid = [];
  for (let ty = 0; ty < world.grid.length; ty += 1) {
    grid.push([]);
    for (let tx = 0; tx < world.grid[ty].length; tx += 1) {
      grid[ty].push(dangerAt(world, tx * TILE + TILE / 2, ty * TILE + TILE / 2));
    }
  }
  // Keep a body-length away from every guard: tiles near a guard cost extra
  // even outside its cone, so the route never walks into a patrol head-on.
  for (const guard of world.guards) {
    const gx = Math.floor(guard.x / TILE);
    const gy = Math.floor(guard.y / TILE);
    for (let ty = gy - 2; ty <= gy + 2; ty += 1) {
      for (let tx = gx - 2; tx <= gx + 2; tx += 1) {
        if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) continue;
        const d = Math.hypot(tx - gx, ty - gy);
        if (d <= 2) grid[ty][tx] += 2.5 - d;
      }
    }
  }
  return grid;
}

function walkable(world, tx, ty) {
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.grid[0].length) return false;
  const t = world.grid[ty][tx];
  return t !== '#' && t !== 'C';
}

/**
 * Cheapest route across the tile grid. A tile inside a cone costs far more
 * than a safe one, so the route bends around patrols instead of through them.
 * Returns pixel waypoints (tile centres), start excluded, or null.
 */
function findPath(world, from, to, danger) {
  const rows = world.grid.length;
  const cols = world.grid[0].length;
  const key = (x, y) => y * cols + x;
  const dist = new Map([[key(from.tx, from.ty), 0]]);
  const prev = new Map();
  const open = [[0, from.tx, from.ty]];
  const closed = new Set();
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i += 1) if (open[i][0] < open[best][0]) best = i;
    const [, cx, cy] = open.splice(best, 1)[0];
    const ck = key(cx, cy);
    if (closed.has(ck)) continue;
    closed.add(ck);
    if (cx === to.tx && cy === to.ty) {
      const path = [];
      let cur = ck;
      while (prev.has(cur)) {
        const px = cur % cols;
        const py = Math.floor(cur / cols);
        path.unshift({ x: px * TILE + TILE / 2, y: py * TILE + TILE / 2 });
        cur = prev.get(cur);
      }
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(world, nx, ny)) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const cost = dist.get(ck) + 1 + danger[ny][nx] * 12;
      if (cost < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, cost);
        prev.set(nk, ck);
        open.push([cost, nx, ny]);
      }
    }
  }
  return null;
}

/** Nearest planter or shadow tile no cone is covering right now. */
function nearestHideout(world, danger) {
  const px = Math.floor(world.player.x / TILE);
  const py = Math.floor(world.player.y / TILE);
  let best = null;
  let bestD = Infinity;
  for (let ty = 0; ty < world.grid.length; ty += 1) {
    for (let tx = 0; tx < world.grid[ty].length; tx += 1) {
      const t = world.grid[ty][tx];
      if (t !== 'B' && t !== ',') continue;
      if (danger[ty][tx] > 0) continue;
      const d = Math.abs(tx - px) + Math.abs(ty - py);
      if (d < bestD) {
        bestD = d;
        best = { tx, ty };
      }
    }
  }
  if (best) return best;
  return { tx: Math.floor(world.playerStart.x / TILE), ty: Math.floor(world.playerStart.y / TILE) };
}

function waitInput() {
  return { moveX: 0, moveY: 0, sneak: true, smokePressed: false, decoyAt: null };
}

/** One tick of the autopilot: plan a route, wait out cones, hide when seen. */
function autopilotInput(world, state) {
  const player = world.player;
  const chasing = world.guards.some((g) => g.state === 'chase');
  const watched = world.guards.some((g) => g.awareness > 25);
  const fleeing = chasing || watched;

  state.replan -= STEP;
  const px = Math.floor(player.x / TILE);
  const py = Math.floor(player.y / TILE);

  // Pick a destination tile.
  let dest = null;
  if (fleeing) {
    const danger = dangerGrid(world);
    dest = nearestHideout(world, danger);
    // Already hidden and nobody is close to spotting: hold still.
    const here = tileAt(world, player.x, player.y);
    if ((here === 'B' || here === ',') && danger[py][px] === 0 && !chasing) {
      return waitInput();
    }
  } else {
    const remaining = world.artifacts.filter((a) => !a.taken);
    if (remaining.length > 0) {
      remaining.sort(
        (a, b) =>
          Math.hypot(a.x - player.x, a.y - player.y) -
          Math.hypot(b.x - player.x, b.y - player.y),
      );
      const t = remaining[0];
      dest = { tx: Math.floor(t.x / TILE), ty: Math.floor(t.y / TILE) };
    } else if (world.exitOpen) {
      dest = { tx: Math.floor(world.exit.x / TILE), ty: Math.floor(world.exit.y / TILE) };
    }
  }
  if (!dest) return waitInput();

  const destKey = dest.tx + ',' + dest.ty + (fleeing ? '!' : '');
  if (!state.path || state.pathTarget !== destKey || state.replan <= 0) {
    const danger = dangerGrid(world);
    state.path = findPath(world, { tx: px, ty: py }, dest, danger);
    state.pathTarget = destKey;
    state.replan = 1;
    state.danger = danger;
  }
  if (!state.path || state.path.length === 0) {
    // Already standing on the destination.
    if (px === dest.tx && py === dest.ty) return waitInput();
    return waitInput();
  }

  const next = state.path[0];
  if (Math.hypot(next.x - player.x, next.y - player.y) < 10) {
    state.path.shift();
    return autopilotInput(world, state);
  }
  // Patience: the next step is watched and this one is safe — wait it out.
  const nextDanger = dangerAt(world, next.x, next.y);
  const hereDanger = dangerAt(world, player.x, player.y);
  if (nextDanger > 0 && hereDanger === 0 && !fleeing) return waitInput();

  const dx = next.x - player.x;
  const dy = next.y - player.y;
  const len = Math.hypot(dx, dy);
  // Sneak whenever a guard is near: quiet feet and slower eyes on you.
  const nearestGuard = Math.min(...world.guards.map((g) => Math.hypot(g.x - player.x, g.y - player.y)));
  return {
    moveX: dx / len,
    moveY: dy / len,
    sneak: fleeing || hereDanger > 0 || nextDanger > 0 || nearestGuard < 260,
    smokePressed: false,
    decoyAt: null,
  };
}

/**
 * Play the autopilot forward for `seconds` of game time (or until the run
 * ends). Returns the screen the run is on when the time runs out.
 */
export function playForward(world, seconds) {
  const state = { path: null, pathTarget: null, replan: 0, danger: null };
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (world.screen === SCREEN.WIN || world.screen === SCREEN.LOSE) break;
    if (world.screen === SCREEN.LEVEL_CLEAR) {
      if (world.levelIndex >= 2) break;
      startLevel(world, world.levelIndex + 1);
      state.path = null;
      state.pathTarget = null;
    }
    updateWorld(world, autopilotInput(world, state), STEP);
  }
  return world.screen;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * lategame: gallery III deep in, warden hunting. midgame: gallery II mid-run.
 * patrol: gallery I early, cones sweeping. win: a full clean run to the end.
 */
export function stageShot(name, world) {
  startRun(world);
  if (name === 'win') {
    playForward(world, 600);
    return { screen: world.screen, best: world.score };
  }
  if (name === 'lategame') {
    startLevel(world, 2);
    playForward(world, 30);
    return { screen: world.screen, best: world.score };
  }
  if (name === 'midgame') {
    startLevel(world, 1);
    playForward(world, 30);
    return { screen: world.screen, best: world.score };
  }
  // patrol: gallery I, early minutes, cones and cover on show.
  playForward(world, 30);
  return { screen: world.screen, best: world.score };
}
