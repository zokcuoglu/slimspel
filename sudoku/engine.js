// Sudoku engine: makes puzzles and checks them. No screen code here, so it can be tested alone.
// A grid is a flat array of size*size numbers, 0 = empty, read row by row.
// size 4 -> boxes of 2 rows x 2 columns, size 6 -> boxes of 2 rows x 3 columns.

export const BOX = { 4: [2, 2], 6: [2, 3] }; // [rows per box, columns per box]

// Cells that "see" each other: same row, same column or same box
export function peers(size, i) {
  const [br, bc] = BOX[size];
  const r = Math.floor(i / size), c = i % size;
  const r0 = r - r % br, c0 = c - c % bc;
  const out = new Set();
  for (let k = 0; k < size; k++) { out.add(r * size + k); out.add(k * size + c); }
  for (let y = r0; y < r0 + br; y++) for (let x = c0; x < c0 + bc; x++) out.add(y * size + x);
  out.delete(i);
  return [...out];
}

// Can number n go in cell i without breaking a rule?
function fits(grid, size, i, n, P) {
  return P[i].every(j => grid[j] !== n);
}

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Count solutions, but stop at `limit` (we only need to know: 0, 1 or "more than 1").
// Backtracking: fill the empty cell with the fewest options first, try each option.
export function countSolutions(grid, size, limit = 2) {
  const P = peersTable(size);
  const g = grid.slice();
  let count = 0;
  (function walk() {
    if (count >= limit) return;
    let best = -1, bestOpts = null;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      const opts = [];
      for (let n = 1; n <= size; n++) if (fits(g, size, i, n, P)) opts.push(n);
      if (!opts.length) return;               // dead end
      if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
    }
    if (best === -1) { count++; return; }     // no empty cells left: one full solution
    for (const n of bestOpts) { g[best] = n; walk(); g[best] = 0; if (count >= limit) return; }
  })();
  return count;
}

// A random complete, valid grid
function fullGrid(size) {
  const P = peersTable(size);
  const g = new Array(size * size).fill(0);
  (function fill(i) {
    if (i === g.length) return true;
    for (const n of shuffled([...Array(size)].map((_, k) => k + 1))) {
      if (fits(g, size, i, n, P)) { g[i] = n; if (fill(i + 1)) return true; g[i] = 0; }
    }
    return false;
  })(0);
  return g;
}

// Given numbers we aim for per level. "moeilijk" = remove as many as possible.
export const TARGET = {
  4: { makkelijk: 10, normaal: 7, moeilijk: 0 },
  6: { makkelijk: 22, normaal: 16, moeilijk: 0 }
};

/**
 * Make a puzzle with exactly one solution.
 * Empties cells in random order; a cell stays empty only if the puzzle still has one solution.
 * Returns { puzzle, solution }.
 */
export function makePuzzle(size, level) {
  const solution = fullGrid(size);
  const puzzle = solution.slice();
  let given = puzzle.length;
  for (const i of shuffled([...puzzle.keys()])) {
    if (given <= TARGET[size][level]) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (countSolutions(puzzle, size) === 1) given--;
    else puzzle[i] = keep; // removing this one would allow two answers: put it back
  }
  return { puzzle, solution };
}

// Cells whose number also appears in a peer cell (shown in red)
export function conflicts(grid, size) {
  const P = peersTable(size);
  const bad = new Set();
  grid.forEach((n, i) => { if (n && P[i].some(j => grid[j] === n)) bad.add(i); });
  return bad;
}

// Peers never change for a size, so work them out once
const cache = {};
function peersTable(size) {
  return cache[size] ||= [...Array(size * size).keys()].map(i => peers(size, i));
}
