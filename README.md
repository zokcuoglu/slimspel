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
| `index.html` | Home in three groups: *Puzzel van de dag* (the daily puzzles, each with a "Vandaag x/y" label), *Oefenen* and *Denkspellen* |
| `css/site.css` | Shared design (same worksheet style as the nl-oefenbank kids pages) |
| `js/core.js` | Shared: Firebase login gate, groep (`groepNr`, `tablesFor`), save/load rounds, daily ranking (`postScore`, `loadBoard`), random, shuffle, animations |
| `tafels/` | Multiplication tables: practice (10 sums) or 60 seconds against the clock. From groep 5 on, children only get the tables 3-9 (1, 2 and 10 are too easy); groep 1-4, unknown groep and adults get 1-10. Everyone also gets a harder level with the tables 11-15 (own row). A child without a groep is asked once (saved in the profile) |
| `kennis/` + `kennis/vragen.json` | General knowledge quiz: 6 categories, 10 questions per round, a 'Wist je dat?' fact after each answer; questions answered wrong before come back more often. Add questions in `vragen.json` (never change an existing `id`) |
| `sudoku/` (`engine.js` + `index.html`) | Daily 4x4 and 6x6 sudoku: one puzzle per size and level per day (Dutch midnight), the same for everyone (seeded from the date; do not change `engine.js` mid-day), always exactly one solution. Unfinished puzzles are kept in the browser. A row, column or box lights up green when it is complete and right. Levels makkelijk/normaal/moeilijk (child accounts see the first two). Broken rules show red at once; Hint fills a cell. Saved: score = cells he filled himself, total = empty cells, plus time and hints |
| `woordzoeker/` (`engine.js`, `woorden.json`, `index.html`) | Daily word search, same for everyone, 3 levels (8x8 → ↓; 10x10 also ↘; 12x12 all directions, also backwards). Children see the first two. Words in `woorden.json` (6 themes, no IJ). Click first + last letter or drag |
| `kruiswoord/` (`engine.js`, `woorden.json`, `index.html`) | Daily crossword, same for everyone, 3 levels (5/7/9 words; children see the first two). On 'makkelijk' every word has an emoji clue. Word bank in `woorden.json` (`w`, `c` = Dutch clue, `e` = emoji; no IJ). The cursor jumps to the next word only after its last letter |
| `memory/` | Memory: land–hoofdstad, dier–jong, Engels–Nederlands, tafels (made fresh, by groep). 6/8/10 pairs. Saved: score = pairs, total = turns |
| `snake/` | Snake that eats the right answer (tafels by groep, or plus/min to 100). Wrong = one heart less (3), wall or own tail = game over. Saved answers per sum |
| `2048/` | Classic 2048 with sliding tiles, a short "how to play" (open on the first visit) and arrow buttons. The game in progress is kept in the browser per account. Saved: points, highest tile (score/total stay 0) |
| `blokjes/` (`engine.js` + `index.html`) | Daily shape puzzle, same for everyone: drag pieces (3-5 squares) into a 4x4 / 5x5 / 6x6 frame. Pieces are cut from the frame, so there is always a solution. From normaal on they start turned (click = turn). Hint puts one piece in place |
| `kriskras/` | Daily fill-in puzzle: put the listed words in the grid (same generator and word bank as the kruiswoord). Any way that fits counts as right. 2 / 1 / 1 letters given |
| `paspuzzel/` (`engine.js`, `woorden.json`, `index.html`) | Daily paspuzzel like in a puzzle book: about 12 / 18 / 26 words placed densely (the densest of 40 builds), words listed by length, given letters, and a solution word hidden in red-numbered squares. `woorden.json` is a fixed snapshot of our lists (kruiswoord, woordzoeker, nl-oefenbank groep 1-6), so the daily puzzle does not change during the day |
| `schuifpuzzel/` | Sliding puzzle 3x3 / 4x4 / 5x5, shuffled with legal moves (always solvable). Tiles on their right square turn green. Record = fewest moves |
| `woordle/` | Daily Wordle, same for everyone. For now only 5 letters (`levels` in `game.js`; the 4 and 6 letter levels are switched off). Answers only from our own lists (nl-oefenbank `data/woorden.json` groep 1-6, read live, plus the kruiswoord and woordzoeker lists); the day's word is picked by hashing (day, level, word), so a new word rarely changes today's word. Guesses must be in the OpenTaal list (`geldig-N.txt`, CC BY 3.0, see `OPENTAAL-LICENSE.txt`). Afterwards the Turkish meaning and an example are shown |
|  | The game is in `game.js` (`mountWoordle`), shared with the "Günün oyunları" tab of nl-oefenbank; each site passes its own save/load functions. `?taal=tr` = Turkish Woordle with a Turkish screen: answers = hand-picked everyday words (`tr-cevap-N.txt`), guesses = TDK headwords (`tr-geldig-N.txt`, from github.com/bilalozdemir/tr-word-list, CC BY-SA 4.0), meanings in `tr-anlam.json`. Own statistics (played, % guessed, streak, guess distribution) and day/week/month rankings for everyone from `woordle_plays` (points 6..1, 0 when not guessed). The Dutch end screen shows meaning, de/het, word type, groep, theme, example, where the word is used in Slimspel and in Nieuws in niveaus, and a WikiWoordenboek link for the origin |

## Adding a module

1. Make a folder with an `index.html`, link `../css/site.css`, import `gate` and `saveAttempt` from `../js/core.js`.
2. Turn its "Binnenkort" card on the home page into a link.
3. Add it to `nl-oefenbank/data/catalog.json` (area `slimspel`).
