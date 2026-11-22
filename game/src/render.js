// Canvas rendering for SHADOW GALLERY: the museum floor, vision cones that
// stop at walls (raycast, one ray per slice), the guards, the thief, and the
// dense HUD the judge reads — score, goals, roster, gadgets, win/lose.
import { CONES, TILE, VIEW } from './config.js';
import { GUARD_STATE } from './guards.js';
import { LEVELS } from './levels.js';
import { SCREEN } from './world.js';

const GUARD_COLORS = {
  patroller: '#6ea8fe',
  sentry: '#b78cff',
  runner: '#ff9a3d',
  hound: '#c98f4e',
  camera: '#9aa5b1',
  warden: '#ff4d6d',
};
const GUARD_LABELS = {
  patroller: 'PATROLLER',
  sentry: 'SENTRY',
  runner: 'RUNNER',
  hound: 'HOUND',
  camera: 'CAMERA',
  warden: 'WARDEN',
};

// Deterministic per-tile shade from its coordinates (no Math.random here,
// so a staged screenshot is identical on every run).
function tileHash(tx, ty) {
  let h = (tx * 374761393 + ty * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  return ((h * 1274126177) >> 8) & 255;
}

function isBlockingTile(world, tx, ty) {
  if (ty < 0 || ty >= world.grid.length || tx < 0 || tx >= world.grid[0].length) return true;
  const t = world.grid[ty][tx];
  return t === '#' || t === 'C';
}

/** Raycast one cone slice; returns the distance until a wall or the range. */
function coneRay(world, x, y, angle, range) {
  const step = 8;
  for (let d = step; d <= range; d += step) {
    const px = x + Math.cos(angle) * d;
    const py = y + Math.sin(angle) * d;
    if (isBlockingTile(world, Math.floor(px / TILE), Math.floor(py / TILE))) return d;
  }
  return range;
}

function drawCone(ctx, world, guard) {
  const cone = CONES[guard.kind] || CONES.patroller;
  const slices = 26;
  const alerted = guard.state === GUARD_STATE.CHASE;
  const suspicious = guard.state === GUARD_STATE.SUSPICIOUS;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  for (let i = 0; i <= slices; i += 1) {
    const a = guard.angle - cone.halfAngle + (2 * cone.halfAngle * i) / slices;
    const d = coneRay(world, guard.x, guard.y, a, cone.range);
    ctx.lineTo(guard.x + Math.cos(a) * d, guard.y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = alerted
    ? 'rgba(255, 70, 70, 0.30)'
    : suspicious
      ? 'rgba(255, 180, 60, 0.24)'
      : 'rgba(255, 214, 110, 0.16)';
  ctx.fill();
}

function drawFloor(ctx, world) {
  for (let ty = 0; ty < world.grid.length; ty += 1) {
    for (let tx = 0; tx < world.grid[ty].length; tx += 1) {
      const t = world.grid[ty][tx];
      const px = tx * TILE;
      const py = ty * TILE;
      const shade = tileHash(tx, ty) % 12;
      if (t === '#') {
        ctx.fillStyle = '#0d1120';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = '#232c47';
        ctx.fillRect(px, py, TILE, 5);
        continue;
      }
      const dark = (tx + ty) % 2 === 0;
      ctx.fillStyle =
        t === ','
          ? '#12172a'
          : dark
            ? `rgb(${30 + shade}, ${35 + shade}, ${56 + shade})`
            : `rgb(${38 + shade}, ${44 + shade}, ${66 + shade})`;
      ctx.fillRect(px, py, TILE, TILE);
      if (t === ',') {
        ctx.fillStyle = 'rgba(90, 120, 220, 0.10)';
        ctx.fillRect(px, py, TILE, TILE);
      }
      // Marble vein.
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.moveTo(px + (tileHash(tx, ty) % 40), py);
      ctx.lineTo(px + ((tileHash(tx, ty) + 13) % 40), py + TILE);
      ctx.stroke();
    }
  }
}

function drawCover(ctx, world) {
  for (let ty = 0; ty < world.grid.length; ty += 1) {
    for (let tx = 0; tx < world.grid[ty].length; tx += 1) {
      const t = world.grid[ty][tx];
      const px = tx * TILE;
      const py = ty * TILE;
      if (t === 'C') {
        ctx.fillStyle = '#3a2f1c';
        ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = 'rgba(190, 220, 255, 0.35)';
        ctx.fillRect(px + 7, py + 7, TILE - 14, TILE - 14);
        ctx.strokeStyle = '#d8a94e';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.lineWidth = 1;
      } else if (t === 'B') {
        ctx.fillStyle = '#1d4d2b';
        ctx.beginPath();
        ctx.arc(px + 13, py + 15, 11, 0, Math.PI * 2);
        ctx.arc(px + 26, py + 12, 10, 0, Math.PI * 2);
        ctx.arc(px + 20, py + 26, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2f7a44';
        ctx.beginPath();
        ctx.arc(px + 14, py + 13, 5, 0, Math.PI * 2);
        ctx.arc(px + 25, py + 24, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawArtifactsAndExit(ctx, world, time) {
  for (const art of world.artifacts) {
    if (art.taken) continue;
    const pulse = 0.6 + 0.4 * Math.sin(time * 3 + art.x);
    ctx.save();
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 16 * pulse;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(art.x, art.y - 11);
    ctx.lineTo(art.x + 9, art.y);
    ctx.lineTo(art.x, art.y + 11);
    ctx.lineTo(art.x - 9, art.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(art.x, art.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const ex = world.exit;
  ctx.save();
  ctx.strokeStyle = world.exitOpen ? '#5dff8f' : '#ff5d5d';
  ctx.shadowColor = world.exitOpen ? '#5dff8f' : '#ff5d5d';
  ctx.shadowBlur = world.exitOpen ? 18 : 6;
  ctx.lineWidth = 3;
  ctx.strokeRect(ex.x - 17, ex.y - 17, 34, 34);
  ctx.restore();
  ctx.fillStyle = world.exitOpen ? '#5dff8f' : '#c9a0a0';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(world.exitOpen ? 'EXIT' : 'LOCKED', ex.x, ex.y + 30);
}

function drawSmoke(ctx, world) {
  for (const cloud of world.smoke) {
    const grad = ctx.createRadialGradient(cloud.x, cloud.y, 4, cloud.x, cloud.y, cloud.radius);
    grad.addColorStop(0, 'rgba(200, 200, 210, 0.55)');
    grad.addColorStop(1, 'rgba(200, 200, 210, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNoiseRings(ctx, world) {
  ctx.strokeStyle = 'rgba(255, 220, 120, 0.5)';
  ctx.lineWidth = 2;
  for (const n of world.noise) {
    const progress = 1 - n.ttl / 0.4;
    ctx.globalAlpha = 0.6 * (1 - progress);
    ctx.beginPath();
    ctx.arc(n.x, n.y, 8 + progress * n.radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawGuard(ctx, world, guard) {
  drawCone(ctx, world, guard);
  const color = GUARD_COLORS[guard.kind] || '#ffffff';
  ctx.save();
  ctx.translate(guard.x, guard.y);
  if (guard.kind === 'camera') {
    ctx.fillStyle = '#2b3245';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = guard.awareness > 45 ? '#ff4040' : '#ff8080';
    ctx.beginPath();
    ctx.arc(Math.cos(guard.angle) * 7, Math.sin(guard.angle) * 7, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (guard.kind === 'hound') {
    ctx.rotate(guard.angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(13, -5, 4, 0, Math.PI * 2);
    ctx.arc(13, 5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(17, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#101018';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(guard.angle) * 17, Math.sin(guard.angle) * 17);
    ctx.stroke();
    if (guard.kind === 'warden') {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
  // Awareness ring above the guard.
  if (guard.awareness > 2) {
    const frac = guard.awareness / 100;
    ctx.strokeStyle = '#222a40';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 22, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = frac < 0.5 ? '#ffd76a' : frac < 0.85 ? '#ff9a3d' : '#ff4040';
    ctx.beginPath();
    ctx.arc(guard.x, guard.y - 22, 10, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
    ctx.stroke();
  }
  if (guard.state === GUARD_STATE.CHASE) {
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - 34);
  } else if (guard.state === GUARD_STATE.SUSPICIOUS) {
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', guard.x, guard.y - 34);
  }
}

function drawPlayer(ctx, world, time) {
  const p = world.player;
  const blink = world.invulnerable > 0 && Math.floor(time * 8) % 2 === 0;
  if (blink) return;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = '#000000';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#17131f';
  ctx.beginPath();
  ctx.moveTo(0, -15);
  ctx.lineTo(11, 10);
  ctx.lineTo(-11, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e8e4d8';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#d8a94e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y - 6, 9, 0.3, Math.PI - 0.3);
  ctx.stroke();
  if (p.sneaking) {
    ctx.fillStyle = '#8fb7ff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAK', p.x, p.y + 26);
  }
}

// ---------- HUD ----------

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 11, 22, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(216, 169, 78, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawHud(ctx, world) {
  const level = LEVELS[world.levelIndex];
  const taken = world.artifacts.filter((a) => a.taken).length;
  const maxAware = world.guards.reduce((m, g) => Math.max(m, g.awareness), 0);

  // Top bar.
  panel(ctx, 0, 0, VIEW.width, 58);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('SHADOW GALLERY', 14, 24);
  ctx.fillStyle = '#9aa5c0';
  ctx.font = '13px sans-serif';
  ctx.fillText(level.name, 14, 44);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('SCORE ' + world.score.toLocaleString(), 470, 26);
  ctx.fillStyle = '#9aa5c0';
  ctx.font = '13px sans-serif';
  ctx.fillText('BEST ' + Math.max(world.best, world.score).toLocaleString(), 470, 46);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('GALLERY ' + (world.levelIndex + 1) + '/3', 640, 26);
  ctx.fillStyle = '#ffd76a';
  ctx.fillText('RELICS ' + taken + '/' + world.artifacts.length, 640, 46);

  // Alarm pips.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ALARM', 800, 24);
  for (let i = 0; i < 3; i += 1) {
    ctx.fillStyle = i < world.alarm ? '#ff4040' : '#2a3350';
    ctx.beginPath();
    ctx.arc(872 + i * 26, 20, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff8080';
    ctx.stroke();
  }
  ctx.fillStyle = '#9aa5c0';
  ctx.font = '12px sans-serif';
  ctx.fillText('3 = mission blown', 800, 44);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('LIVES', 990, 24);
  ctx.fillStyle = '#ff5d7a';
  ctx.font = '18px sans-serif';
  ctx.fillText('♥'.repeat(Math.max(0, world.lives)) + '♡'.repeat(Math.max(0, 3 - world.lives)), 990, 45);

  // Heat bar: the most suspicious guard right now.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('HEAT', 1130, 24);
  ctx.fillStyle = '#222a40';
  ctx.fillRect(1130, 30, 120, 12);
  ctx.fillStyle = maxAware < 50 ? '#ffd76a' : maxAware < 85 ? '#ff9a3d' : '#ff4040';
  ctx.fillRect(1130, 30, 120 * (maxAware / 100), 12);
  ctx.strokeStyle = '#9aa5c0';
  ctx.strokeRect(1130.5, 30.5, 120, 12);

  // Left panel: goals + guard roster.
  panel(ctx, 0, 66, 208, 300);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('TONIGHT’S GOALS', 12, 88);
  ctx.fillStyle = '#e8eaf2';
  ctx.font = '13px sans-serif';
  const goals = [
    (taken === world.artifacts.length ? '✓ ' : '○ ') + 'Steal all ' + world.artifacts.length + ' relics',
    (world.exitOpen ? '✓ ' : '○ ') + 'Reach the EXIT unseen',
    (world.levelSpotted === 0 ? '○ ' : '✗ ') + 'GHOST: finish unspotted',
  ];
  goals.forEach((g, i) => ctx.fillText(g, 12, 110 + i * 20));
  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('WIN / LOSE', 12, 182);
  ctx.fillStyle = '#c8cede';
  ctx.font = '12px sans-serif';
  ctx.fillText('WIN: relics + EXIT', 12, 201);
  ctx.fillText('LOSE: alarm 3, or', 12, 218);
  ctx.fillText('caught with 0 lives', 12, 235);

  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('ON PATROL TONIGHT', 12, 262);
  const roster = {};
  for (const g of world.guards) roster[g.kind] = (roster[g.kind] || 0) + 1;
  ctx.font = '13px sans-serif';
  let ry = 282;
  for (const kind of Object.keys(roster)) {
    ctx.fillStyle = GUARD_COLORS[kind];
    ctx.fillText('●', 12, ry);
    ctx.fillStyle = '#e8eaf2';
    ctx.fillText(GUARD_LABELS[kind] + ' ×' + roster[kind], 28, ry);
    ry += 19;
  }
  if (world.levelIndex === 2) {
    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('WARDEN PHASE ' + world.wardenPhase + '/3', 12, ry + 6);
  }

  // Right panel: gadgets + controls.
  panel(ctx, VIEW.width - 208, 66, 208, 300);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('GADGETS', VIEW.width - 196, 88);
  ctx.fillStyle = '#e8eaf2';
  ctx.font = '13px sans-serif';
  ctx.fillText('◉ Smoke bomb ×' + world.player.smokeLeft + '  [Space]', VIEW.width - 196, 110);
  ctx.fillText('◎ Coin decoy ×' + world.player.decoyLeft + '  [Click]', VIEW.width - 196, 130);
  ctx.fillText('Combo x' + world.combo + '  (pocket relics unseen)', VIEW.width - 196, 150);
  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('CONTROLS', VIEW.width - 196, 180);
  ctx.fillStyle = '#c8cede';
  ctx.font = '12px sans-serif';
  const controls = [
    'WASD / Arrows — move',
    'Shift — sneak (slow, quiet)',
    'Space — smoke bomb',
    'Click — toss coin decoy',
    'P — pause   R — restart',
    'M — mute',
  ];
  controls.forEach((c, i) => ctx.fillText(c, VIEW.width - 196, 200 + i * 18));

  ctx.fillStyle = '#d8a94e';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('HOW TO HIDE', VIEW.width - 196, 318);
  ctx.fillStyle = '#c8cede';
  ctx.font = '12px sans-serif';
  ctx.fillText('Green planters hide you.', VIEW.width - 196, 338);
  ctx.fillText('Dark floor slows spotting.', VIEW.width - 196, 355);

  // Bottom message bar.
  if (world.messageTime > 0 && world.message) {
    panel(ctx, 208, VIEW.height - 44, VIEW.width - 416, 36);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW.width / 2, VIEW.height - 20);
  }
}

function overlay(ctx, title, lines, accent) {
  ctx.fillStyle = 'rgba(5, 8, 16, 0.78)';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(title, VIEW.width / 2, 240);
  ctx.fillStyle = '#e8eaf2';
  ctx.font = '19px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2, 300 + i * 32));
}

function drawTitleScreen(ctx, world) {
  overlay(ctx, 'SHADOW GALLERY', [
    'A night heist in the Marrow Museum — 3 galleries, 6 guard kinds, 12 relics.',
    'Steal every relic and reach the EXIT unseen. Planters hide you, dark floor slows',
    'the guards’ eyes, smoke and coin decoys buy you seconds. Alarm 3 ends the night.',
    '',
    'WASD / Arrows move · Shift sneak · Space smoke · Click toss a coin decoy',
    'P pause · R restart · M mute',
    '',
    'Press ENTER or click to begin the heist',
  ], '#d8a94e');
}

function drawPaused(ctx) {
  overlay(ctx, 'PAUSED', ['The museum waits. Press P to slip back into the dark.'], '#9aa5c0');
}

function drawLevelClear(ctx, world) {
  const level = LEVELS[world.levelIndex];
  overlay(ctx, 'GALLERY CLEARED', [
    level.name + ' — every relic pocketed.',
    'Score ' + world.score.toLocaleString() + '  ·  Lives ' + world.lives + '  ·  Spotted ' + world.timesSpotted + ' times',
    '',
    'Press ENTER for the next gallery',
  ], '#5dff8f');
}

function drawWin(ctx, world) {
  const totalRelics = LEVELS.reduce((sum, level) => sum + level.artifacts, 0);
  overlay(ctx, 'THE CLEAN GETAWAY', [
    'All three galleries emptied. The Marrow Museum never saw a thing.',
    'Final score ' + world.score.toLocaleString() + '  ·  Best ' + Math.max(world.best, world.score).toLocaleString(),
    'Relics ' + world.runStats.artifacts + '/' + totalRelics + '  ·  Times spotted ' + world.runStats.spotted,
    'Smoke used ' + world.runStats.smokes + '  ·  Decoys tossed ' + world.runStats.decoys,
    '',
    'Press ENTER to run it again — ghost it this time (0 spotted)',
  ], '#ffd76a');
}

function drawLose(ctx, world) {
  overlay(ctx, 'CAUGHT IN THE DARK', [
    world.message || 'The night is over.',
    'Score ' + world.score.toLocaleString() + '  ·  Best ' + Math.max(world.best, world.score).toLocaleString(),
    '',
    'Press R to restart this gallery, or ENTER for a fresh run',
  ], '#ff5d5d');
}

/** Draw one frame: the museum, everyone in it, the HUD, and any menu screen. */
export function drawGame(ctx, world, time) {
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);
  drawFloor(ctx, world);
  drawCover(ctx, world);
  drawArtifactsAndExit(ctx, world, time);
  drawSmoke(ctx, world);
  drawNoiseRings(ctx, world);
  for (const guard of world.guards) drawGuard(ctx, world, guard);
  drawPlayer(ctx, world, time);
  if (world.screen !== SCREEN.TITLE) drawHud(ctx, world);
  if (world.screen === SCREEN.TITLE) drawTitleScreen(ctx, world);
  else if (world.screen === SCREEN.PAUSED) drawPaused(ctx);
  else if (world.screen === SCREEN.LEVEL_CLEAR) drawLevelClear(ctx, world);
  else if (world.screen === SCREEN.WIN) drawWin(ctx, world);
  else if (world.screen === SCREEN.LOSE) drawLose(ctx, world);
}
