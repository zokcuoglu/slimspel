// Woordzoeker engine: hides words in a letter grid. No screen code, so it can be tested alone.
// The grid is a flat array of size*size letters, read row by row.
// Uses the same seeded random as the sudoku, so the daily puzzle is the same for everybody.
// WARNING: changing this file (or woorden.json) changes the daily puzzles: only do it between days.
import { seededRandom } from "../sudoku/engine.js";
export { seededRandom };

// Directions as [row step, column step]
const R = [0, 1], D = [1, 0], DR = [1, 1], UR = [-1, 1], L = [0, -1], U = [-1, 0], UL = [-1, -1], DL = [1, -1];
export const LEVEL = {
  makkelijk: { size: 8, words: 6, dirs: [R, D] },                       // → ↓
  normaal:   { size: 10, words: 8, dirs: [R, D, DR] },                  // → ↓ ↘
  moeilijk:  { size: 12, words: 10, dirs: [R, D, DR, UR, L, U, UL, DL] } // all, also backwards
};

// Letters for the empty cells, roughly as common as in Dutch, so the grid looks natural
const FILL = "AAAAABBCDDDDEEEEEEEEEFGGGHHIIIIJKKKLLLLMMMNNNNNNNOOOOOPPRRRRRRSSSSTTTTTTUUUVVWWZZ";

function shuffled(list, rnd) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Make a puzzle for one level from the word bank.
 * Returns { theme: {id,title}, size, grid: [letters], words: [{ word, cells: [index, ...] }] }
 */
export function makePuzzle(level, bank, rnd = Math.random) {
  const { size, words: count, dirs } = LEVEL[level];
  const theme = bank.themes[Math.floor(rnd() * bank.themes.length)];
  const grid = new Array(size * size).fill("");
  const placed = [];

  // Try the theme's words in random order; a word goes in if some position and direction fits
  for (const word of shuffled(theme.words.filter(w => w.length <= size), rnd)) {
    if (placed.length === count) break;
    const options = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of dirs) {
      const endR = r + dr * (word.length - 1), endC = c + dc * (word.length - 1);
      if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;
      const cells = [...word].map((_, k) => (r + dr * k) * size + (c + dc * k));
      // A cell may be shared with another word only if it has the same letter
      if (cells.every((i, k) => grid[i] === "" || grid[i] === word[k])) options.push(cells);
    }
    if (!options.length) continue;
    const cells = options[Math.floor(rnd() * options.length)];
    cells.forEach((i, k) => grid[i] = word[k]);
    placed.push({ word, cells });
  }

  // Fill the rest with random letters
  for (let i = 0; i < grid.length; i++) if (!grid[i]) grid[i] = FILL[Math.floor(rnd() * FILL.length)];

  // Show the list alphabetically, so the order gives no clue
  placed.sort((a, b) => a.word.localeCompare(b.word));
  return { theme: { id: theme.id, title: theme.title }, size, grid, words: placed };
}

// Cells on a straight line from a to b (row, column or diagonal), or null if not straight
export function lineCells(size, a, b) {
  const r1 = Math.floor(a / size), c1 = a % size, r2 = Math.floor(b / size), c2 = b % size;
  const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
  const n = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1));
  if (r1 !== r2 && c1 !== c2 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return null;
  return [...Array(n + 1)].map((_, k) => (r1 + dr * k) * size + (c1 + dc * k));
}
