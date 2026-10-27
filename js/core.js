// Shared helpers for all Slimspel pages.
// No login yet: records are kept in this browser only (localStorage).
const Slim = (() => {
  const PREFIX = "slimspel:"; // keeps our keys apart from other sites' data

  // Read a saved value. Storage can be blocked (private window), so never crash.
  function load(name, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  }

  // Save a value; silently skip if storage is not available.
  function save(name, value) {
    try { localStorage.setItem(PREFIX + name, JSON.stringify(value)); } catch {}
  }

  // Store a score only if it beats the old record.
  // Returns the previous record so the page can say "nieuw record!".
  function submitBest(name, score) {
    const prev = load("best:" + name, null);
    if (prev === null || score > prev) save("best:" + name, score);
    return prev;
  }

  // Random whole number from min to max (both included)
  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  // Fisher-Yates shuffle: fair random order, returns a new array
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Replay a CSS animation class on an element (pop / shake)
  function flash(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // forces the browser to restart the animation
    el.classList.add(cls);
  }

  return { load, save, submitBest, randInt, shuffle, flash };
})();
