// The thief: movement, wall collision, footsteps and gadgets.
// Pure logic — the renderer and the input layer live elsewhere.
import { GADGETS, PLAYER, SMOKE_SECONDS, TILE } from './config.js';

export function createPlayer(x, y) {
  return {
    x,
    y,
    radius: PLAYER.radius,
    sneaking: false,
    running: false,
    moving: false,
    stepTime: 0,
    smokeLeft: GADGETS.smoke,
    decoyLeft: GADGETS.decoy,
  };
}

/** Is the tile at (tx, ty) solid for the player? Walls and cases block. */
export function isSolidTile(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  const t = grid[ty][tx];
  return t === '#' || t === 'C';
}

/** Circle-vs-tile collision: slide along walls instead of sticking to them. */
export function movePlayer(player, dx, dy, grid, dt) {
  const speed = player.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) {
    player.moving = false;
    return;
  }
  player.moving = true;
  const nx = (dx / len) * speed * dt;
  const ny = (dy / len) * speed * dt;
  tryAxis(player, nx, 0, grid);
  tryAxis(player, 0, ny, grid);
}

function tryAxis(player, mx, my, grid) {
  const nextX = player.x + mx;
  const nextY = player.y + my;
  const r = player.radius;
  const minTx = Math.floor((nextX - r) / TILE);
  const maxTx = Math.floor((nextX + r) / TILE);
  const minTy = Math.floor((nextY - r) / TILE);
  const maxTy = Math.floor((nextY + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (!isSolidTile(grid, tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(nextX, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(nextY, ty * TILE + TILE));
      const ddx = nextX - cx;
      const ddy = nextY - cy;
      if (ddx * ddx + ddy * ddy < r * r) return;
    }
  }
  player.x = nextX;
  player.y = nextY;
}

/** Footstep noise the guards can hear. Returns the noise radius, or 0. */
export function playerNoiseRadius(player, dt) {
  if (!player.moving) return 0;
  player.stepTime -= dt;
  if (player.stepTime > 0) return 0;
  // A step every ~0.45 s walking, ~0.8 s sneaking.
  player.stepTime = player.sneaking ? 0.8 : 0.45;
  return player.sneaking ? PLAYER.noiseSneak : PLAYER.noiseWalk;
}

/** Throw a smoke bomb at the player's feet. Returns the cloud, or null. */
export function useSmoke(player) {
  if (player.smokeLeft <= 0) return null;
  player.smokeLeft -= 1;
  return { x: player.x, y: player.y, radius: 110, ttl: SMOKE_SECONDS };
}

/** Toss a coin decoy toward a point. Returns the noise event, or null. */
export function useDecoy(player, tx, ty) {
  if (player.decoyLeft <= 0) return null;
  player.decoyLeft -= 1;
  return { x: tx, y: ty, radius: 320, ttl: 0.4 };
}
