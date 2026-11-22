// Keyboard and mouse input. WASD / arrows move, Shift sneaks, Space drops a
// smoke bomb, click tosses a coin decoy toward the mouse, P pauses,
// R restarts, M mutes, Enter / Space starts from a menu screen.
export function createInput(canvas) {
  const input = {
    moveX: 0,
    moveY: 0,
    sneak: false,
    smokePressed: false,
    decoyAt: null,
    // Edge-triggered actions main.js reads once per frame.
    startPressed: false,
    pausePressed: false,
    restartPressed: false,
    mutePressed: false,
    mouseX: 0,
    mouseY: 0,
  };
  const keys = new Set();

  function recomputeMove() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    input.moveX = x;
    input.moveY = y;
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space') input.smokePressed = true;
    if (event.code === 'Enter' || event.code === 'Space') input.startPressed = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pausePressed = true;
    if (event.code === 'KeyR') input.restartPressed = true;
    if (event.code === 'KeyM') input.mutePressed = true;
    recomputeMove();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    recomputeMove();
  });
  window.addEventListener('blur', () => {
    keys.clear();
    recomputeMove();
  });

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * canvas.width;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    input.decoyAt = { x, y };
  });

  return input;
}
