// Boot and game loop for SHADOW GALLERY. ?shot=<name> stages one screenshot
// scene instead of starting interactive play.
import { VIEW } from './config.js';
import { createInput } from './input.js';
import { drawGame } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, restartLevel, SCREEN, startLevel, startRun, updateWorld } from './world.js';
import {
  ensureAudio,
  playAlert,
  playClear,
  playDecoy,
  playPickup,
  playSmoke,
  playStep,
  toggleMute,
} from './audio.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const ctx = canvas.getContext('2d');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const world = createWorld();
try {
  world.best = Number(localStorage.getItem('shadow-gallery-best') || 0) || 0;
} catch {
  world.best = 0;
}
const input = createInput(canvas);
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

function saveBest() {
  try {
    localStorage.setItem('shadow-gallery-best', String(Math.max(world.best, world.score)));
  } catch {
    // Private mode: the best score just lives for this session.
  }
}

function handleEvents() {
  for (const ev of world.events) {
    if (ev.type === 'step') playStep(ev.sneaking, 0);
    else if (ev.type === 'spotted') playAlert();
    else if (ev.type === 'pickup') playPickup(ev.combo);
    else if (ev.type === 'smoke') playSmoke();
    else if (ev.type === 'decoy') playDecoy();
    else if (ev.type === 'levelclear' || ev.type === 'win') playClear();
  }
}

function handleMenuKeys() {
  if (input.mutePressed) {
    input.mutePressed = false;
    toggleMute();
  }
  if (input.startPressed) {
    input.startPressed = false;
    ensureAudio();
    if (world.screen === SCREEN.TITLE || world.screen === SCREEN.WIN) startRun(world);
    else if (world.screen === SCREEN.LEVEL_CLEAR) startLevel(world, world.levelIndex + 1);
    else if (world.screen === SCREEN.LOSE) startRun(world);
  }
  if (input.pausePressed) {
    input.pausePressed = false;
    if (world.screen === SCREEN.PLAYING) world.screen = SCREEN.PAUSED;
    else if (world.screen === SCREEN.PAUSED) world.screen = SCREEN.PLAYING;
  }
  if (input.restartPressed) {
    input.restartPressed = false;
    if (world.screen === SCREEN.PLAYING || world.screen === SCREEN.PAUSED) restartLevel(world);
    else if (world.screen === SCREEN.LOSE) startRun(world);
  }
}

let lastTime = performance.now();

if (shotName) {
  // Staged screenshot: play the real rules forward, then hold the frame.
  const staged = stageShot(shotName, world);
  window.__shotReady = true;
  window.__shotInfo = {
    shot: shotName,
    screen: world.screen,
    level: world.levelIndex + 1,
    score: world.score,
    artifacts: world.artifacts.filter((a) => a.taken).length + '/' + world.artifacts.length,
    alarm: world.alarm,
    lives: world.lives,
    best: staged.best,
  };
  drawGame(ctx, world, 1.2);
  const repaint = (now) => {
    drawGame(ctx, world, now / 1000);
    requestAnimationFrame(repaint);
  };
  requestAnimationFrame(repaint);
} else {
  const liveFrame = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    handleMenuKeys();
    if (world.screen === SCREEN.PLAYING) {
      updateWorld(world, input, dt);
      handleEvents();
      if (world.screen === SCREEN.WIN || world.screen === SCREEN.LOSE) saveBest();
    }
    drawGame(ctx, world, now / 1000);
    const levelName =
      world.screen === SCREEN.TITLE ? 'title screen' : 'gallery ' + (world.levelIndex + 1);
    statusEl.textContent =
      'Shadow Gallery, ' + levelName + '. Score ' + world.score +
      ', alarm ' + world.alarm + ' of 3, lives ' + world.lives + '.';
    requestAnimationFrame(liveFrame);
  };
  requestAnimationFrame(liveFrame);
}
