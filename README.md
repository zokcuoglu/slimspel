# Slimspel

Learning games and puzzles for kids, in Dutch: practice, puzzles and games.

- **Hosting:** GitHub Pages, no build step. Plain HTML, CSS and JavaScript.
- **Login:** same Firebase project and accounts as [nl-oefenbank](https://github.com/zokcuoglu/nl-oefenbank).
  Approval, account type and the parent link are managed on the nl-oefenbank admin page.
- **Results:** every finished round goes to `users/{uid}/attempts` with `module: "slimspel-<name>"`,
  so the nl-oefenbank admin statistics and the weekly (parent) e-mail include them.
  Add each new module to `nl-oefenbank/data/catalog.json` so it gets a title there.

## Files

| Path | What it is |
|---|---|
| `index.html` | Home: one card per module |
| `css/site.css` | Shared design (same worksheet style as the nl-oefenbank kids pages) |
| `js/core.js` | Shared: Firebase login gate, save/load rounds, daily ranking (`postScore`, `loadBoard`), random, shuffle, animations |
| `tafels/` | Multiplication tables 1-10: practice (10 sums) or 60 seconds against the clock |
| `kennis/` + `kennis/vragen.json` | General knowledge quiz: 6 categories, 10 questions per round, a 'Wist je dat?' fact after each answer; questions answered wrong before come back more often. Add questions in `vragen.json` (never change an existing `id`) |
| `sudoku/` (`engine.js` + `index.html`) | Daily 4x4 and 6x6 sudoku: one puzzle per size and level per day (Dutch midnight), the same for everyone (seeded from the date; do not change `engine.js` mid-day), always exactly one solution. Unfinished puzzles are kept in the browser. A row, column or box lights up green when it is complete and right. Levels makkelijk/normaal/moeilijk (child accounts see the first two). Broken rules show red at once; Hint fills a cell. Saved: score = cells he filled himself, total = empty cells, plus time and hints |
| `woordzoeker/` (`engine.js`, `woorden.json`, `index.html`) | Daily word search, same for everyone, 3 levels (8x8 → ↓; 10x10 also ↘; 12x12 all directions, also backwards). Children see the first two. Words in `woorden.json` (6 themes, no IJ). Click first + last letter or drag |

## Adding a module

1. Make a folder with an `index.html`, link `../css/site.css`, import `gate` and `saveAttempt` from `../js/core.js`.
2. Turn its "Binnenkort" card on the home page into a link.
3. Add it to `nl-oefenbank/data/catalog.json` (area `kids`).
