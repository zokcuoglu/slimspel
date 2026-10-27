# Slimspel

Learning games and puzzles for kids, in Dutch: practice, puzzles and games.

- **Hosting:** GitHub Pages, no build step. Plain HTML, CSS and JavaScript.
- **No login (yet):** records are stored in the browser (`localStorage`).

## Files

| Path | What it is |
|---|---|
| `index.html` | Home: one card per module |
| `css/site.css` | Shared design (same worksheet style as the nl-oefenbank kids pages) |
| `js/core.js` | Shared helpers: save/load records, random, shuffle, animations |
| `tafels/` | Multiplication tables 1-10: practice (10 sums) or 60 seconds against the clock |

## Adding a module

1. Make a folder with an `index.html`, link `../css/site.css` and `../js/core.js`.
2. Turn its "Binnenkort" card on the home page into a link.
