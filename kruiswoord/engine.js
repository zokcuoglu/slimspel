// Kruiswoord engine: builds a small crossword from the word bank. No screen code, so it can be tested alone.
// Uses the same seeded random as the sudoku, so the daily puzzle is the same for everybody.
// WARNING: changing this file (or woorden.json) changes the daily puzzles: only do it between days.
import { seededRandom } from "../sudoku/engine.js";
export { seededRandom };

// count = words in the puzzle, maxLen = longest word, size = the space we build in (cropped afterwards),
// emoji = only words that have an emoji (the emoji is shown as the clue on 'makkelijk')
export const LEVEL = {
  makkelijk: { count: 5, maxLen: 6, size: 9, emoji: true },
  normaal:   { count: 7, maxLen: 8, size: 11, emoji: false },
  moeilijk:  { count: 9, maxLen: 9, size: 13, emoji: false }
};

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Try to build one crossword from a shuffled list. Returns the placed words or null.
function build(pool, cfg, rnd) {
  const N = cfg.size;
  const letter = new Array(N * N).fill("");     // letter in each cell
  const dirs = new Array(N * N).fill("");       // "H", "V" or "HV": which word directions use the cell
  const at = (r, c) => (r < 0 || c < 0 || r >= N || c >= N) ? null : r * N + c;
  const empty = (r, c) => { const i = at(r, c); return i === null || letter[i] === ""; };
  const placed = [];

  // Can `word` go at (r, c) in direction d? Returns the number of crossings, or -1 if not.
  function fits(word, r, c, d) {
    const [dr, dc] = d === "H" ? [0, 1] : [1, 0];
    // The cell before the first letter and after the last letter must be free (no glued words)
    if (!empty(r - dr, c - dc) || !empty(r + dr * word.length, c + dc * word.length)) return -1;
    let cross = 0;
    for (let k = 0; k < word.length; k++) {
      const y = r + dr * k, x = c + dc * k, i = at(y, x);
      if (i === null) return -1;
      if (letter[i]) {
        // Crossing: same letter, and the cell may only be used by a word in the OTHER direction
        if (letter[i] !== word[k] || dirs[i].includes(d)) return -1;
        cross++;
      } else {
        // New letter: its side neighbours must be empty, otherwise we would make extra (fake) words
        const [sr, sc] = d === "H" ? [1, 0] : [0, 1];
        if (!empty(y - sr, x - sc) || !empty(y + sr, x + sc)) return -1;
      }
    }
    return cross;
  }

  function put(entry, r, c, d) {
    const [dr, dc] = d === "H" ? [0, 1] : [1, 0];
    const cells = [];
    for (let k = 0; k < entry.w.length; k++) {
      const i = at(r + dr * k, c + dc * k);
      letter[i] = entry.w[k]; dirs[i] += d; cells.push(i);
    }
    placed.push({ ...entry, dir: d, cells });
  }

  // First word in the middle, across
  const first = pool[0];
  put(first, Math.floor(N / 2), Math.floor((N - first.w.length) / 2), "H");

  for (const entry of pool.slice(1)) {
    if (placed.length === cfg.count) break;
    // All spots where this word crosses a letter that is already there
    let best = [], bestCross = 0;
    for (const p of placed) for (let a = 0; a < p.w.length; a++) for (let b = 0; b < entry.w.length; b++) {
      if (p.w[a] !== entry.w[b]) continue;
      const d = p.dir === "H" ? "V" : "H";
      const pr = Math.floor(p.cells[a] / N), pc = p.cells[a] % N;
      const r = d === "V" ? pr - b : pr, c = d === "H" ? pc - b : pc;
      const cross = fits(entry.w, r, c, d);
      if (cross < 1) continue;
      if (cross > bestCross) { best = []; bestCross = cross; }
      if (cross === bestCross) best.push([r, c, d]);
    }
    if (best.length) put(entry, ...best[Math.floor(rnd() * best.length)]);
  }
  return placed.length === cfg.count ? { placed, N } : null;
}

/**
 * Make a crossword for one level.
 * Returns { w, h, solution: [letter or ""], words: [{ w, c, e, dir, num, cells }] }
 * Cell numbers are for the cropped grid (w columns, h rows).
 */
// `level` is a name from LEVEL, or an own settings object { count, maxLen, size, emoji } (used by the
// NT2 crossword of NL Oefenbank). Passing an object does not change the Slimspel daily puzzles.
export function makePuzzle(level, bank, rnd = Math.random) {
  const cfg = typeof level === "string" ? LEVEL[level] : level;
  const pool = bank.words.filter(x => x.w.length >= 3 && x.w.length <= cfg.maxLen && (!cfg.emoji || x.e));
  let result = null;
  for (let tries = 0; tries < 50 && !result; tries++) result = build(shuffled(pool, rnd), cfg, rnd);
  if (!result) throw new Error("no crossword possible");
  const { placed, N } = result;

  // Crop to the smallest rectangle around the letters
  const used = placed.flatMap(p => p.cells);
  const rows = used.map(i => Math.floor(i / N)), cols = used.map(i => i % N);
  const r0 = Math.min(...rows), c0 = Math.min(...cols);
  const h = Math.max(...rows) - r0 + 1, w = Math.max(...cols) - c0 + 1;
  const map = i => (Math.floor(i / N) - r0) * w + (i % N - c0);
  const solution = new Array(w * h).fill("");
  const words = placed.map(p => {
    const cells = p.cells.map(map);
    cells.forEach((i, k) => solution[i] = p.w[k]);
    return { w: p.w, c: p.c, e: p.e || "", dir: p.dir, cells };
  });

  // Numbers: reading order of the first cells; across and down starting in one cell share a number
  const starts = [...new Set(words.map(x => x.cells[0]))].sort((a, b) => a - b);
  words.forEach(x => x.num = starts.indexOf(x.cells[0]) + 1);
  words.sort((a, b) => a.num - b.num || (a.dir === "H" ? -1 : 1));
  return { w, h, solution, words };
}
