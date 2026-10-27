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
| `js/core.js` | Shared: Firebase login gate, save/load rounds, random, shuffle, animations |
| `tafels/` | Multiplication tables 1-10: practice (10 sums) or 60 seconds against the clock |

## Adding a module

1. Make a folder with an `index.html`, link `../css/site.css`, import `gate` and `saveAttempt` from `../js/core.js`.
2. Turn its "Binnenkort" card on the home page into a link.
3. Add it to `nl-oefenbank/data/catalog.json` (area `kids`).
