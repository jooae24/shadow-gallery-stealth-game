// Seeded random numbers, so a screenshot scene replays exactly the same way
// every time it is staged. The game itself uses Math.random for live play;
// the staged scenes and the headless tests use this one.
export function makeRng(seed) {
  let state = seed >>> 0 || 1;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Pick one element of `items` with the seeded generator. */
export function pickRandom(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
