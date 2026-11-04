// Paspuzzel engine: places as many words as possible in a square, crossing a lot (denser than the kriskras),
// and picks a solution word whose letters are hidden in numbered squares. No screen code, so it can be tested alone.
// Uses the same seeded random as the sudoku, so the daily puzzle is the same for everybody.
// WARNING: changing this file (or woorden.json) changes the daily puzzles: only do it between days.
import { seededRandom } from "../sudoku/engine.js";
export { seededRandom };

// size = square to build in, count = words we aim for, tries = builds to compare (the densest wins),
// given = letters filled in at the start, sol = length of the solution word
export const LEVEL = {
  makkelijk: { size: 9, count: 12, tries: 40, given: 2, sol: 5 },
  normaal:   { size: 11, count: 18, tries: 40, given: 1, sol: 6 },
  moeilijk:  { size: 13, count: 26, tries: 40, given: 1, sol: 7 }
};

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// One build: first word across in the middle, then again and again the placement with the most crossings
function build(pool, N, count, rnd) {
  const letter = new Array(N * N).fill(""), dirs = new Array(N * N).fill("");
  const at = (r, c) => (r < 0 || c < 0 || r >= N || c >= N) ? null : r * N + c;
  const empty = (r, c) => { const i = at(r, c); return i === null || letter[i] === ""; };
  const placed = [], used = new Set();

  // crossings if `w` fits at (r, c) in direction d, else -1 (same rules as the kruiswoord: no glued or fake words)
  function fits(w, r, c, d) {
    const [dr, dc] = d === "H" ? [0, 1] : [1, 0];
    if (!empty(r - dr, c - dc) || !empty(r + dr * w.length, c + dc * w.length)) return -1;
    let cross = 0;
    for (let k = 0; k < w.length; k++) {
      const y = r + dr * k, x = c + dc * k, i = at(y, x);
      if (i === null) return -1;
      if (letter[i]) { if (letter[i] !== w[k] || dirs[i].includes(d)) return -1; cross++; }
      else { const [sr, sc] = d === "H" ? [1, 0] : [0, 1]; if (!empty(y - sr, x - sc) || !empty(y + sr, x + sc)) return -1; }
    }
    return cross === w.length ? -1 : cross; // a word made only of crossings would add nothing
  }
  function put(w, r, c, d) {
    const [dr, dc] = d === "H" ? [0, 1] : [1, 0], cells = [];
    for (let k = 0; k < w.length; k++) { const i = at(r + dr * k, c + dc * k); letter[i] = w[k]; dirs[i] += d; cells.push(i); }
    placed.push({ w, dir: d, cells }); used.add(w);
  }
  const first = pool.find(w => w.length >= Math.min(7, N - 2)) || pool[0];
  put(first, Math.floor(N / 2), Math.floor((N - first.length) / 2), "H");

  // Keep adding: look at many candidate words, take the spot with the most crossings (ties: random)
  for (let round = 0; placed.length < count && round < count * 3; round++) {
    let best = [], bestCross = 0;
    for (const w of pool) {
      if (used.has(w)) continue;
      for (const p of placed) for (let a = 0; a < p.w.length; a++) for (let b = 0; b < w.length; b++) {
        if (p.w[a] !== w[b]) continue;
        const d = p.dir === "H" ? "V" : "H", pr = Math.floor(p.cells[a] / N), pc = p.cells[a] % N;
        const r = d === "V" ? pr - b : pr, c = d === "H" ? pc - b : pc;
        const cross = fits(w, r, c, d);
        if (cross < 1) continue;
        if (cross > bestCross) { best = []; bestCross = cross; }
        if (cross === bestCross) best.push([w, r, c, d]);
      }
    }
    if (!best.length) break;
    put(...best[Math.floor(rnd() * best.length)]);
  }
  return { placed, letter, N };
}

/**
 * Make one puzzle.
 * Returns { w, h, solution: [letter or ""], words: [{ w, dir, cells }], given: [cell], solWord, solCells: [cell] }
 */
export function makePuzzle(level, bank, rnd = Math.random) {
  const cfg = LEVEL[level];
  // Longer words fit badly in small squares
  const pool = bank.words.filter(w => w.length <= cfg.size - 1);
  let best = null;
  for (let t = 0; t < cfg.tries; t++) {
    // a different random part of the pool each try keeps it fast and varied
    const b = build(shuffled(pool, rnd).slice(0, 160), cfg.size, cfg.count, rnd);
    const filled = b.letter.filter(Boolean).length;
    const score = b.placed.length * 100 + filled;
    if (!best || score > best.score) best = { ...b, score };
  }
  const { placed, N } = best;

  // Crop to the letters
  const all = placed.flatMap(p => p.cells);
  const rows = all.map(i => Math.floor(i / N)), cols = all.map(i => i % N);
  const r0 = Math.min(...rows), c0 = Math.min(...cols);
  const h = Math.max(...rows) - r0 + 1, w = Math.max(...cols) - c0 + 1;
  const map = i => (Math.floor(i / N) - r0) * w + (i % N - c0);
  const solution = new Array(w * h).fill("");
  const words = placed.map(p => {
    const cells = p.cells.map(map);
    cells.forEach((i, k) => solution[i] = p.w[k]);
    return { w: p.w, dir: p.dir, cells };
  });

  // Given letters: the first letter of a few long words
  const given = shuffled(words.filter(x => x.w.length >= 5), rnd).slice(0, cfg.given).map(x => x.cells[0]);

  // Solution word: a word from the bank, not in the grid, whose letters can each take a different square
  const letterCells = solution.map((ch, i) => ch ? i : -1).filter(i => i >= 0 && !given.includes(i));
  let solWord = null, solCells = null;
  for (const cand of shuffled(bank.words.filter(x => x.length === cfg.sol && !words.some(y => y.w === x)), rnd)) {
    const free = shuffled(letterCells, rnd), pick = [];
    for (const ch of cand) {
      const i = free.findIndex(j => solution[j] === ch && !pick.includes(j));
      if (i < 0) break;
      pick.push(free[i]);
    }
    if (pick.length === cand.length) { solWord = cand; solCells = pick; break; }
  }
  return { w, h, solution, words, given, solWord, solCells };
}
