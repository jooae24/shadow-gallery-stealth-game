// Guard brains: patrols, vision cones, hearing, suspicion and the chase.
// Pure logic — no canvas, no DOM — so the headless tests can run it too.
import { CONES, DETECTION, GUARD_SPEED, TILE } from './config.js';

// Guard states. SUSPICIOUS means "something caught my eye, I am looking";
// CHASE means "I see the thief, I am coming"; INVESTIGATE means "I heard
// a noise and I am walking over to check it".
export const GUARD_STATE = {
  PATROL: 'patrol',
  SUSPICIOUS: 'suspicious',
  CHASE: 'chase',
  INVESTIGATE: 'investigate',
  RETURN: 'return',
};

const TWO_PI = Math.PI * 2;

export function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleDifference(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  if (d < -Math.PI) d += TWO_PI;
  return d;
}

/** Step the segment in small hops; true when no wall or case blocks the view. */
export function hasLineOfSight(x0, y0, x1, y1, isBlockingPx) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlockingPx(x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

/** Is the player inside this guard's vision cone, with a clear line of sight? */
export function guardCanSee(guard, player, isBlockingPx) {
  const cone = CONES[guard.kind] || CONES.patroller;
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > cone.range) return { seen: false, dist };
  const angleTo = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angleTo, guard.angle)) > cone.halfAngle) {
    return { seen: false, dist };
  }
  if (!hasLineOfSight(guard.x, guard.y, player.x, player.y, isBlockingPx)) {
    return { seen: false, dist };
  }
  return { seen: true, dist };
}

export function createGuard(def) {
  const start = def.waypoints
    ? tileCentre(def.waypoints[0][0], def.waypoints[0][1])
    : tileCentre(def.x, def.y);
  return {
    kind: def.kind,
    x: start.x,
    y: start.y,
    angle: def.facing ?? -Math.PI / 2,
    baseAngle: def.facing ?? -Math.PI / 2,
    sweep: def.sweep ?? 0,
    sweepPhase: 0,
    waypoints: (def.waypoints ?? []).map(([tx, ty]) => tileCentre(tx, ty)),
    waypointIndex: 1,
    state: GUARD_STATE.PATROL,
    awareness: 0,
    stateTime: 0,
    lastSeen: null,
    investigateTarget: null,
    speed: GUARD_SPEED[def.kind] ?? 60,
    pauseTime: 0,
    hearCooldown: 0,
  };
}

function moveToward(guard, tx, ty, dt, speed) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) return true;
  const step = Math.min(dist, speed * dt);
  guard.x += (dx / dist) * step;
  guard.y += (dy / dist) * step;
  guard.angle = Math.atan2(dy, dx);
  return dist - step < 2;
}

/**
 * One tick of one guard. `world` carries the player, the tile queries and the
 * live noise list; `events` collects what the world must act on
 * ({ type: 'spotted', guard } when awareness fills).
 */
export function updateGuard(guard, dt, world, events) {
  const { player } = world;
  guard.stateTime += dt;

  // Sentries and cameras never walk: they sweep their cone back and forth.
  if (guard.kind === 'sentry' || guard.kind === 'camera') {
    guard.sweepPhase += dt * 0.55;
    guard.angle = guard.baseAngle + Math.sin(guard.sweepPhase) * (guard.sweep || 1.0);
  }

  // Hearing: a fresh noise pulls patrolling hounds and runners over to look.
  // A guard that just investigated ignores new noises for a while, so one
  // footstep cannot drag the whole museum onto the thief.
  if (guard.hearCooldown > 0) guard.hearCooldown -= dt;
  if (
    (guard.kind === 'hound' || guard.kind === 'runner' || guard.kind === 'patroller') &&
    guard.state === GUARD_STATE.PATROL &&
    guard.hearCooldown <= 0 &&
    world.noise.length > 0
  ) {
    const heard = world.noise.find(
      (n) => Math.hypot(n.x - guard.x, n.y - guard.y) < n.radius,
    );
    if (heard) {
      guard.state = GUARD_STATE.INVESTIGATE;
      guard.stateTime = 0;
      guard.hearCooldown = 6;
      guard.investigateTarget = { x: heard.x, y: heard.y };
    }
  }

  // Vision: awareness fills while the player is in the cone and in the open.
  const inSmoke = world.smoke.some(
    (s) => Math.hypot(s.x - player.x, s.y - player.y) < s.radius,
  );
  let visible = false;
  let seenDist = Infinity;
  if (!inSmoke && !player.inBush) {
    const check = guardCanSee(guard, player, world.isBlockingPx);
    visible = check.seen;
    seenDist = check.dist;
  } else if (!inSmoke && player.inBush) {
    // Hidden in a planter: only spotted at point-blank range.
    const d = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (d < 46) {
      const check = guardCanSee(guard, player, world.isBlockingPx);
      visible = check.seen;
      seenDist = d;
    }
  }

  if (visible) {
    let rate = DETECTION.baseRate;
    const cone = CONES[guard.kind] || CONES.patroller;
    rate += DETECTION.closeBonus * (1 - seenDist / cone.range);
    if (player.inShadow) rate *= DETECTION.shadowFactor;
    if (player.sneaking) rate *= DETECTION.sneakFactor;
    if (player.running) rate *= DETECTION.runFactor;
    guard.awareness = Math.min(100, guard.awareness + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (guard.awareness >= 100 && guard.state !== GUARD_STATE.CHASE) {
      guard.state = GUARD_STATE.CHASE;
      guard.stateTime = 0;
      events.push({ type: 'spotted', guard });
    } else if (guard.awareness > 45 && guard.state === GUARD_STATE.PATROL) {
      guard.state = GUARD_STATE.SUSPICIOUS;
      guard.stateTime = 0;
    }
  } else {
    guard.awareness = Math.max(0, guard.awareness - DETECTION.decayRate * dt);
    if (guard.state === GUARD_STATE.SUSPICIOUS && guard.awareness < 15) {
      guard.state = GUARD_STATE.PATROL;
      guard.stateTime = 0;
    }
  }

  // Movement by state.
  const chaseSpeed = guard.speed * (guard.kind === 'warden' ? world.wardenSpeedFactor : 1.7);
  if (guard.kind === 'sentry' || guard.kind === 'camera') return;

  if (guard.state === GUARD_STATE.CHASE) {
    if (guard.lastSeen) {
      const arrived = moveToward(guard, guard.lastSeen.x, guard.lastSeen.y, dt, chaseSpeed);
      if (!visible && guard.stateTime > DETECTION.huntSeconds) {
        guard.state = GUARD_STATE.RETURN;
        guard.stateTime = 0;
      } else if (arrived && !visible) {
        guard.state = GUARD_STATE.RETURN;
        guard.stateTime = 0;
      }
    }
  } else if (guard.state === GUARD_STATE.INVESTIGATE && guard.investigateTarget) {
    const arrived = moveToward(
      guard,
      guard.investigateTarget.x,
      guard.investigateTarget.y,
      dt,
      guard.speed * 1.3,
    );
    if (arrived || guard.stateTime > 6) {
      guard.state = GUARD_STATE.RETURN;
      guard.stateTime = 0;
    }
  } else if (guard.state === GUARD_STATE.RETURN) {
    const home = guard.waypoints[0];
    if (home && moveToward(guard, home.x, home.y, dt, guard.speed)) {
      guard.state = GUARD_STATE.PATROL;
      guard.stateTime = 0;
      guard.waypointIndex = 1;
    }
  } else {
    // PATROL (and SUSPICIOUS, which pauses to stare at the last seen spot).
    if (guard.state === GUARD_STATE.SUSPICIOUS) {
      if (guard.lastSeen) {
        guard.angle = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      }
      if (guard.stateTime > 1.6) {
        guard.state = GUARD_STATE.PATROL;
        guard.stateTime = 0;
      }
      return;
    }
    if (guard.waypoints.length === 0) return;
    if (guard.pauseTime > 0) {
      guard.pauseTime -= dt;
      return;
    }
    const target = guard.waypoints[guard.waypointIndex % guard.waypoints.length];
    if (moveToward(guard, target.x, target.y, dt, guard.speed)) {
      guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      guard.pauseTime = 0.7;
    }
  }
}
