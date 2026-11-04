// Blokjes engine: cuts a rectangle into pieces, so the pieces always fit back in. No screen code, so it can be tested alone.
// Uses the same seeded random as the sudoku, so the daily puzzle is the same for everybody.
// WARNING: changing this file changes the daily puzzles: only do it between days.
import { seededRandom } from "../sudoku/engine.js";
export { seededRandom };

// w x h frame, `pieces` pieces of 3 to 5 squares, rotate = pieces are shown turned (he must turn them back)
export const LEVEL = {
  makkelijk: { w: 4, h: 4, pieces: 4, rotate: false },
  normaal:   { w: 5, h: 5, pieces: 6, rotate: true },
  moeilijk:  { w: 6, h: 6, pieces: 8, rotate: true }
};

const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

// Split `total` squares into n piece sizes of 3 to 5
function sizes(total, n, rnd) {
  for (let t = 0; t < 1000; t++) {
    const s = [...Array(n)].map(() => 3 + Math.floor(rnd() * 3));
    if (s.reduce((a, b) => a + b, 0) === total) return s;
  }
  throw new Error("no sizes");
}

// Try to cut the frame into pieces with these sizes. Each piece grows from the first free square
// (reading order) to random free neighbours. Returns owner[] (piece number per square) or null.
function cut(w, h, sz, rnd) {
  const owner = new Array(w * h).fill(-1);
  const nb = i => {
    const r = Math.floor(i / w), c = i % w, out = [];
    if (r > 0) out.push(i - w); if (r < h - 1) out.push(i + w);
    if (c > 0) out.push(i - 1); if (c < w - 1) out.push(i + 1);
    return out;
  };
  for (let p = 0; p < sz.length; p++) {
    const start = owner.indexOf(-1);
    const cells = [start]; owner[start] = p;
    while (cells.length < sz[p]) {
      const frontier = [...new Set(cells.flatMap(nb))].filter(j => owner[j] === -1);
      if (!frontier.length) return null;
      const j = pick(frontier, rnd);
      owner[j] = p; cells.push(j);
    }
    // A closed-in empty pocket smaller than 3 squares can never become a piece: start again
    const seen = new Set();
    for (let i = 0; i < owner.length; i++) {
      if (owner[i] !== -1 || seen.has(i)) continue;
      const stack = [i], pocket = []; seen.add(i);
      while (stack.length) { const k = stack.pop(); pocket.push(k); for (const n of nb(k)) if (owner[n] === -1 && !seen.has(n)) { seen.add(n); stack.push(n); } }
      if (pocket.length < 3) return null;
    }
  }
  return owner.includes(-1) ? null : owner;
}

// Shape helpers. A shape is a list of [row, col], moved so the smallest row and col are 0.
export function normalize(cells) {
  const r0 = Math.min(...cells.map(x => x[0])), c0 = Math.min(...cells.map(x => x[1]));
  return cells.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}
// Turn a quarter clockwise, `times` times
export function rotate(cells, times = 1) {
  let out = cells;
  for (let t = 0; t < ((times % 4) + 4) % 4; t++) out = normalize(out.map(([r, c]) => [c, -r]));
  return normalize(out);
}

/**
 * Make one puzzle. Returns { w, h, pieces: [{ shape, turn, home: { r, c, turn: 0 } }] }
 * shape = the piece as shown at the start (already turned by `turn` quarters on rotate levels),
 * home  = where its unturned shape sits in the solution (used by the hint).
 */
export function makePuzzle(level, rnd = Math.random) {
  const { w, h, pieces: n, rotate: rot } = LEVEL[level];
  let owner = null;
  for (let t = 0; t < 500 && !owner; t++) owner = cut(w, h, sizes(w * h, n, rnd), rnd);
  if (!owner) throw new Error("no puzzle possible");
  const pieces = [];
  for (let p = 0; p < n; p++) {
    const cells = owner.map((o, i) => o === p ? [Math.floor(i / w), i % w] : null).filter(Boolean);
    const solved = normalize(cells);
    const home = { r: Math.min(...cells.map(x => x[0])), c: Math.min(...cells.map(x => x[1])) };
    // On turning levels, each piece starts turned 1-3 quarters (if that looks different from the solution)
    let turn = 0;
    if (rot) {
      const options = [1, 2, 3].filter(k => JSON.stringify(rotate(solved, k)) !== JSON.stringify(solved));
      if (options.length) turn = pick(options, rnd);
    }
    pieces.push({ solved, turn, home });
  }
  // Mix the order in the tray, so the order gives no clue
  for (let i = pieces.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pieces[i], pieces[j]] = [pieces[j], pieces[i]]; }
  return { w, h, pieces };
}
