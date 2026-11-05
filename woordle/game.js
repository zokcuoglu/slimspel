// Woordle game, shared by two sites:
//   - Slimspel   (slimspel/woordle/index.html)
//   - NL Oefenbank, tab "Günün oyunları" (nl-oefenbank/index.html)
// Both sites have their own login (core.js), so the site passes in its own save/load functions (`api`).
// Everything else lives here: words, today's word, the game, own statistics, day/week/month rankings.
// The data files sit next to this file, so they are found from either site.
//
// mountWoordle(root, { lang: "nl" | "tr", user, profile, api, backLink? })
//   api = { saveAttempt(uid, module, attempt), loadAttempts(uid, module), saveWoordlePlay(user, profile, play), loadWoordlePlays(fromDay) }

const HERE = new URL(".", import.meta.url);                  // .../slimspel/woordle/
const POOL = new URL("../../nl-oefenbank/data/", import.meta.url); // nl-oefenbank word pool and news (same website)
const TRIES = 6;
const LEN = { makkelijk: 4, normaal: 5, moeilijk: 6 };

// ---------- Small helpers (no site-specific code) ----------
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
// Today in the Netherlands (YYYY-MM-DD): the new words start at midnight Dutch time
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
const dayNr = d => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000); // day number since 1970
const isoOf = n => new Date(n * 86400000).toISOString().slice(0, 10);
// Browser storage, shared by both sites (same website address), with the same prefix as Slimspel
const loadLocal = (k, fb) => { try { const v = localStorage.getItem("slimspel:" + k); return v === null ? fb : JSON.parse(v); } catch { return fb; } };
const saveLocal = (k, v) => { try { v === null ? localStorage.removeItem("slimspel:" + k) : localStorage.setItem("slimspel:" + k, JSON.stringify(v)); } catch {} };
function hash(text) { let h = 2166136261; for (const ch of text) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- Texts ----------
const TEXT = {
  nl: { levels: { makkelijk: "Makkelijk · 4 letters", normaal: "Normaal · 5 letters", moeilijk: "Moeilijk · 6 letters" },
    title: "Woordle", intro: "Raad het geheime woord in 6 beurten. Typ een echt woord en druk op Enter. De kleuren helpen je:",
    legend: ["goede letter, goede plek", "letter zit erin, andere plek", "letter zit er niet in"],
    daily: "Elke dag is er één nieuw woord van 5 letters, voor iedereen hetzelfde.", level: "Niveau",
    share: "Delen", copied: "Gekopieerd ✓", shareName: "Woordle", start: "Start", cont: "Verder spelen", back: "← Terug", other: "Ander niveau van vandaag",
    typeN: n => `Typ ${n} letters.`, unknown: "Dit woord ken ik niet. Probeer een ander woord.",
    todayWon: g => `Vandaag geraden in ${g} ${g > 1 ? "pogingen" : "poging"}. Morgen is er een nieuw woord!`,
    todayLost: "Vandaag niet geraden. Morgen is er een nieuw woord!",
    win: g => g === 1 ? "In één keer!" : g <= 3 ? "Super goed!" : "Geraden!", lost: "Helaas…",
    resWon: (lv, g, t) => `${lv} · ${g} ${g > 1 ? "pogingen" : "poging"} · tijd ${t}`, resLost: lv => `${lv} · morgen een nieuwe kans!`,
    rec: p => p === null ? "Eerste keer geraden!" : `Nieuw record! (was ${p} pogingen)`, was: "Het woord was:",
    stats: "Jouw statistieken", played: "gespeeld", winPct: "% geraden", streak: "reeks", maxStreak: "langste reeks",
    dist: "In hoeveel pogingen geraden", noStats: "Nog niet gespeeld op dit niveau.",
    rank: "Ranglijst", tabs: { dag: "Vandaag", week: "Deze week", maand: "Deze maand" }, allLv: "Alle niveaus",
    cols: ["", "Naam", "Punten", "Dagen", "Gem."], colDay: ["", "Naam", "Pogingen", "Tijd"], notGuessed: "niet geraden",
    nobody: "Nog niemand in deze periode.", pts: "Punten: 1e poging 6, 2e poging 5 … 6e poging 1, niet geraden 0.",
    rankErr: "De ranglijst is nu niet beschikbaar.", saveErr: c => `Score niet opgeslagen (${c}).`, loadErr: "De woorden konden niet worden geladen. Ververs de pagina.",
    credit: "Woordenlijst voor het controleren van woorden: OpenTaal (opentaal.org), CC BY 3.0.",
    tr: "Türkçe", example: "Voorbeeld", alsoIn: "Ook in Slimspel", news: "In Nieuws in niveaus", origin: "Herkomst en meer betekenissen (WikiWoordenboek) →" },
  tr: { levels: { makkelijk: "Kolay · 4 harf", normaal: "Orta · 5 harf", moeilijk: "Zor · 6 harf" },
    title: "Woordle · Türkçe", intro: "Gizli kelimeyi 6 denemede bul. Gerçek bir kelime yaz ve Enter'a bas. Renkler sana yol gösterir:",
    legend: ["harf doğru, yeri doğru", "harf kelimede var, yeri farklı", "harf kelimede yok"],
    daily: "Her gün 5 harfli bir yeni kelime var, herkes için aynı.", level: "Seviye",
    share: "Paylaş", copied: "Kopyalandı ✓", shareName: "Woordle TR", start: "Başla", cont: "Devam et", back: "← Geri", other: "Bugünün başka bir seviyesi",
    typeN: n => `${n} harf yaz.`, unknown: "Bu kelime sözlükte yok. Başka bir kelime dene.",
    todayWon: g => `Bugün ${g}. denemede bildin. Yarın yeni kelime var!`, todayLost: "Bugün bilemedin. Yarın yeni kelime var!",
    win: g => g === 1 ? "İlk denemede!" : g <= 3 ? "Harika!" : "Bildin!", lost: "Olmadı…",
    resWon: (lv, g, t) => `${lv} · ${g}. deneme · süre ${t}`, resLost: lv => `${lv} · yarın yeni bir şans!`,
    rec: p => p === null ? "İlk kez bildin!" : `Yeni rekor! (önceki: ${p} deneme)`, was: "Kelime:",
    stats: "İstatistiklerin", played: "oynanan", winPct: "% bilinen", streak: "seri", maxStreak: "en uzun seri",
    dist: "Kaçıncı denemede bildin", noStats: "Bu seviyede henüz oynamadın.",
    rank: "Sıralama", tabs: { dag: "Bugün", week: "Bu hafta", maand: "Bu ay" }, allLv: "Tüm seviyeler",
    cols: ["", "İsim", "Puan", "Gün", "Ort."], colDay: ["", "İsim", "Deneme", "Süre"], notGuessed: "bilemedi",
    nobody: "Bu dönemde henüz kimse yok.", pts: "Puan: 1. deneme 6, 2. deneme 5 … 6. deneme 1, bilemeyen 0.",
    rankErr: "Sıralama şu an yüklenemiyor.", saveErr: c => `Sonuç kaydedilemedi (${c}).`, loadErr: "Kelimeler yüklenemedi. Sayfayı yenile.",
    credit: "Kelime listesi: TDK Güncel Türkçe Sözlük başlıkları (github.com/bilalozdemir/tr-word-list, CC BY-SA 4.0); sıklık: FrequencyWords (MIT).",
    meaning: "Anlamı (TDK)", origin: "Vikisözlük'te kökeni ve diğer anlamları →" }
};

// ---------- Styles (scoped under .wdl; colours come from the site, with fallbacks for both sites) ----------
const CSS = `
.wdl{--w-card:var(--card,var(--surface,#fff));--w-paper:var(--paper,var(--sunk,#eef3fb));--w-ink:var(--ink,#1d2a4d);--w-muted:var(--muted,#5b6788);
  --w-line:var(--line,#c9d4ea);--w-accent:var(--accent,#ffd84d);--w-bad:var(--bad,#c4372e);--w-font:var(--f-display,var(--display,system-ui,sans-serif));
  --good-c:#3fa564;--near-c:#e0b030;--miss-c:#8a94a8}
.wdl h2.wt{font-family:var(--w-font);font-size:clamp(28px,6vw,38px);margin:0}
.wdl .sub{color:var(--w-muted);margin:.3rem 0 0}
.wdl .lbl{font-family:var(--w-font);font-weight:600;margin:20px 0 8px}
.wdl .choice,.wdl .tabs2{display:flex;flex-wrap:wrap;gap:6px}
.wdl .tabs2{margin-bottom:8px}
.wdl .ch{font:inherit;font-family:var(--w-font);font-weight:600;font-size:15px;background:var(--w-card);color:var(--w-ink);border:2px solid var(--w-line);border-radius:999px;padding:6px 14px;cursor:pointer}
.wdl .ch.on{background:var(--w-accent);border-color:var(--w-accent);color:var(--accent-ink,#1d2a4d)}
.wdl .tabs2 .ch{font-size:13px;padding:3px 11px}
.wdl .bt{font:inherit;font-family:var(--w-font);font-weight:600;font-size:16px;background:var(--w-card);color:var(--w-ink);border:2px solid var(--w-line);border-radius:12px;padding:9px 18px;cursor:pointer}
.wdl .bt.pri{background:var(--w-ink);border-color:var(--w-ink);color:var(--w-card)}
.wdl .bt:disabled{opacity:.4;cursor:not-allowed}
.wdl .today{margin-top:14px;font-family:var(--w-font);font-weight:600}
.wdl .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:14px;color:var(--w-muted);margin-top:10px}
.wdl .legend b{display:inline-block;width:16px;height:16px;border-radius:4px;vertical-align:-3px;margin-right:4px}
.wdl .bar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}
.wdl .pill{font-family:var(--w-font);font-weight:600;background:var(--w-card);border:2px solid var(--w-line);border-radius:999px;padding:4px 12px;font-variant-numeric:tabular-nums}
.wdl .rows{display:grid;gap:6px;justify-content:center;margin:0 auto}
.wdl .rw{display:grid;grid-template-columns:repeat(var(--n),min(14vw,56px));gap:6px}
.wdl .lt{aspect-ratio:1;display:grid;place-items:center;border:2px solid var(--w-line);border-radius:8px;background:var(--w-card);color:var(--w-ink);
  font-family:var(--w-font);font-weight:700;font-size:clamp(22px,7vw,32px);text-transform:uppercase}
.wdl .lt.filled{border-color:var(--w-muted)}
.wdl .lt.good,.wdl .key.good{background:var(--good-c);border-color:var(--good-c);color:#fff}
.wdl .lt.near,.wdl .key.near{background:var(--near-c);border-color:var(--near-c);color:#fff}
.wdl .lt.miss,.wdl .key.miss{background:var(--miss-c);border-color:var(--miss-c);color:#fff}
@keyframes wdl-flip{0%{transform:rotateX(0)}50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
@keyframes wdl-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.wdl .flip{animation:wdl-flip .35s ease}.wdl .shake{animation:wdl-shake .25s ease 2}
@media (prefers-reduced-motion: reduce){.wdl .flip,.wdl .shake{animation:none}}
.wdl .msg{text-align:center;min-height:1.6em;margin:10px 0;font-family:var(--w-font);font-weight:600;color:var(--w-bad)}
.wdl .kb{display:grid;gap:6px;max-width:560px;margin:6px auto 0}
.wdl .kb .r{display:flex;gap:4px;justify-content:center}
.wdl .key{flex:1;max-width:42px;height:52px;border-radius:8px;border:2px solid var(--w-line);background:var(--w-card);color:var(--w-ink);font-family:var(--w-font);font-weight:600;font-size:18px;text-transform:uppercase;padding:0;cursor:pointer}
.wdl .key.wide{max-width:74px;font-size:13px}
.wdl .pan{background:var(--w-card);border:2px solid var(--w-line);border-radius:16px;padding:18px}
.wdl .pan h3{font-family:var(--w-font);font-size:18px;margin:0 0 8px}
.wdl .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center}
.wdl .stats b{display:block;font-family:var(--w-font);font-size:26px}
.wdl .stats span{font-size:12px;color:var(--w-muted)}
.wdl .dist{display:grid;gap:4px;margin-top:10px}
.wdl .dist .d{display:grid;grid-template-columns:16px 1fr;gap:8px;align-items:center;font-variant-numeric:tabular-nums}
.wdl .dist i{display:block;background:var(--miss-c);color:#fff;font-style:normal;font-weight:700;text-align:right;padding:2px 8px;border-radius:4px;min-width:26px}
.wdl .dist i.now{background:var(--good-c)}
.wdl .rank{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.wdl .rank td,.wdl .rank th{padding:6px;border-bottom:1px solid var(--w-line);text-align:left}
.wdl .rank th{font-size:12px;color:var(--w-muted);text-transform:uppercase;letter-spacing:.05em}
.wdl .rank .n{text-align:right}
.wdl .rank tr.me td{background:color-mix(in srgb,var(--w-accent) 18%,var(--w-card));font-weight:700}
.wdl .small{color:var(--w-muted);font-size:13px;margin:6px 0 0}
.wdl .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:18px}
@media (max-width:720px){.wdl .grid2{grid-template-columns:1fr}}
.wdl .big{font-family:var(--w-font);font-weight:700;font-size:clamp(32px,8vw,48px);line-height:1.1}
.wdl .record{display:inline-block;background:var(--w-accent);color:var(--accent-ink,#1d2a4d);font-family:var(--w-font);font-weight:600;border-radius:99px;padding:3px 12px;margin-top:8px}
.wdl .info{margin-top:14px;background:var(--w-paper);border-radius:12px;padding:12px 14px;display:grid;gap:8px}
.wdl .info .w{font-family:var(--w-font);font-weight:700;font-size:28px;letter-spacing:.06em;text-transform:uppercase}
.wdl .info .tagrow{display:flex;gap:6px;flex-wrap:wrap}
.wdl .info .tg{border:1.5px solid var(--w-line);border-radius:99px;padding:1px 10px;font-size:13px;background:var(--w-card)}
.wdl .info h4{margin:4px 0 0;font-family:var(--w-font);font-size:15px}
.wdl .info p{margin:0}.wdl .info .ex{font-style:italic}
.wdl .credit{color:var(--w-muted);font-size:12px;margin-top:24px}
.wdl .saveerr{color:var(--w-bad);font-size:14px;margin:8px 0 0}
.wdl [hidden]{display:none!important}`;

/** Put a Woordle game in `root`. Returns nothing; the game runs by itself. */
export async function mountWoordle(root, { lang = "nl", user, profile, api, shareUrl = "" }) {
  if (!document.getElementById("wdl-css")) {
    const st = document.createElement("style"); st.id = "wdl-css"; st.textContent = CSS; document.head.appendChild(st);
  }
  const LANG = lang === "tr" ? "tr" : "nl";
  const T = TEXT[LANG];
  const MODULE = LANG === "tr" ? "slimspel-woordle-tr" : "slimspel-woordle";
  const KEYS = LANG === "tr" ? ["ertyuıopğü", "asdfghjklşi", "zcvbnmöç"] : ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  const LETTER = LANG === "tr" ? /^[abcçdefgğhıijklmnoöprsştuüvyz]$/ : /^[a-z]$/; // Turkish has no q, w and x
  const lower = s => LANG === "tr" ? s.toLocaleLowerCase("tr") : s.toLowerCase();
  // For now only 5 letters ("normaal"). To switch the other levels on again, add them here
  // (old rule: children makkelijk + normaal, adults all three).
  const levels = ["normaal"];

  // ---------- Markup ----------
  root.classList.add("wdl");
  root.lang = LANG; // so the capitals are right in Turkish (i -> İ, ı -> I)
  root.innerHTML = `
    <section data-r="setup">
      <h2 class="wt">${esc(T.title)}</h2>
      <p class="sub">${esc(T.intro)}</p>
      <div class="legend">${["--good-c", "--near-c", "--miss-c"].map((c, i) => `<span><b style="background:var(${c})"></b>${esc(T.legend[i])}</span>`).join("")}</div>
      <p class="sub" style="margin-top:8px">${esc(T.daily)}</p>
      <div class="lbl"${levels.length > 1 ? "" : " hidden"}>${esc(T.level)}</div>
      <div class="choice" data-r="levels"${levels.length > 1 ? "" : " hidden"}></div>
      <p class="today" data-r="today" hidden></p>
      <button class="bt" data-r="share1" hidden>📤 ${esc(T.share)}</button>
      <div style="margin-top:16px"><button class="bt pri" data-r="go"></button></div>
      <div class="grid2"><div class="pan" data-r="stats1"></div><div class="pan" data-r="rank1"></div></div>
    </section>
    <section data-r="play" hidden>
      <div class="bar"><span class="pill" data-r="what"></span><span class="pill" data-r="clock">0:00</span><button class="bt" data-r="stop">${esc(T.back)}</button></div>
      <div class="rows" data-r="rows"></div>
      <p class="msg" data-r="msg"></p>
      <div class="kb" data-r="kb"></div>
    </section>
    <section data-r="done" hidden>
      <div class="pan">
        <div class="big" data-r="result"></div>
        <p class="sub" data-r="resultText"></p>
        <span class="record" data-r="record" hidden></span>
        <div style="margin-top:10px"><button class="bt" data-r="share2">📤 ${esc(T.share)}</button></div>
        <div class="info" data-r="info"></div>
      </div>
      <div style="margin-top:14px"><button class="bt pri" data-r="change">${esc(levels.length > 1 ? T.other : T.back)}</button></div>
      <div class="grid2"><div class="pan" data-r="stats2"></div><div class="pan" data-r="rank2"></div></div>
    </section>
    <p class="credit">${esc(T.credit)}</p>`;
  const $ = r => root.querySelector(`[data-r="${r}"]`);
  const flash = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  // ---------- Words ----------
  const valid = {}, answers = {};
  let info = {}, kwClue = {}, wzTheme = {}, turen = {}, themas = {};
  const txt = f => fetch(new URL(f, HERE)).then(r => { if (!r.ok) throw new Error(f); return r.text(); }).then(t => t.split("\n").map(x => x.trim()).filter(Boolean));
  try {
    if (LANG === "tr") {
      // Answers: hand-picked everyday Turkish words; guesses: all TDK headwords of that length
      for (const n of [4, 5, 6]) { answers[n] = (await txt(`tr-cevap-${n}.txt`)).sort(); valid[n] = new Set(await txt(`tr-geldig-${n}.txt`)); }
      info = await fetch(new URL("tr-anlam.json", HERE)).then(r => r.json());
    } else {
      // Dutch answers only from our own lists: the nl-oefenbank pool (groep 1-6, read live) plus the
      // kruiswoord and woordzoeker lists. Guesses: the OpenTaal list, so "aaaaa" is refused.
      const [pool, kw, wz] = await Promise.all([
        fetch(new URL("woorden.json", POOL), { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error("pool"); return r.json(); }),
        fetch(new URL("../kruiswoord/woorden.json", HERE)).then(r => r.json()),
        fetch(new URL("../woordzoeker/woorden.json", HERE)).then(r => r.json())
      ]);
      const clean = t => t.trim().toLowerCase().replace(/^(de|het|een)\s+/, "");
      const cand = new Set();
      turen = pool.turen || {}; themas = pool.themas || {};
      for (const w of pool.woorden) {
        if (!["1-2", "3", "4", "5", "6"].includes(String(w.groep)) || (w.soort && w.soort !== "woord")) continue;
        const t = clean(w.nl);
        cand.add(t);
        if (!info[t]) info[t] = w;
      }
      kw.words.forEach(x => { const t = x.w.toLowerCase(); cand.add(t); kwClue[t] = x.c; });
      wz.themes.forEach(th => th.words.forEach(x => { const t = x.toLowerCase(); cand.add(t); wzTheme[t] = th.title; }));
      for (const n of [4, 5, 6]) {
        valid[n] = new Set(await txt(`geldig-${n}.txt`));
        answers[n] = [...cand].filter(t => t.length === n && /^[a-z]+$/.test(t) && !t.includes("ij") && valid[n].has(t)).sort();
      }
    }
  } catch { root.innerHTML = `<p>${esc(T.loadErr)}</p>`; return; }

  // Today's word: every candidate gets a number from (day, level, word); the smallest wins.
  // Same word for everybody; a word added later rarely changes today's word. (Dutch seed name stays "woordle".)
  const seedName = LANG === "tr" ? "woordle-tr" : "woordle";
  const wordOf = (day, lv) => {
    let best = null, bestH = Infinity;
    for (const w of answers[LEN[lv]]) { const h = hash(`${day}|${seedName}|${lv}|${w}`); if (h < bestH) { bestH = h; best = w; } }
    return best;
  };

  let history = [];
  try { history = await api.loadAttempts(user.uid, MODULE); } catch {}
  let level = loadLocal(`woordle:${LANG}:level`, levels[0]);
  if (!levels.includes(level)) level = levels[0];
  let S = null;
  const playedToday = lv => history.find(h => h.test === lv && h.day === today());
  const progressKey = (day, lv) => `woordle:${LANG}:progress:${day}:${lv}`;
  try {
    Object.keys(localStorage).filter(k => k.startsWith("slimspel:woordle:") && k.includes(":progress:") && !k.includes(today()))
      .forEach(k => localStorage.removeItem(k));
  } catch {}

  // ---------- Screen 1 ----------
  function drawSetup() {
    $("levels").innerHTML = levels.map(l => `<button class="ch${l === level ? " on" : ""}" data-v="${l}">${esc(T.levels[l])}${playedToday(l) ? " ✓" : ""}</button>`).join("");
    $("levels").querySelectorAll("button").forEach(b => b.onclick = () => { level = b.dataset.v; saveLocal(`woordle:${LANG}:level`, level); drawSetup(); });
    const done = playedToday(level);
    $("today").hidden = !done;
    if (done) $("today").textContent = done.score ? T.todayWon(done.guesses) : T.todayLost;
    $("share1").hidden = !(done && done.word && done.answers?.[0]?.chosen);
    $("share1").onclick = () => share($("share1"), done);
    $("go").disabled = !!done;
    $("go").textContent = loadLocal(progressKey(today(), level), null) ? T.cont : T.start;
    drawStats("stats1");
    drawRanking("rank1");
  }
  $("go").onclick = () => start();

  // ---------- Own statistics ----------
  function statsFor(lv) {
    const byDay = new Map(history.filter(h => h.test === lv && h.day).map(h => [h.day, h]));
    const days = [...byDay.keys()].sort();
    const wins = days.filter(d => byDay.get(d).score);
    // current streak: days in a row with a guessed word, back from today (or yesterday if today is not played yet)
    let d = byDay.has(today()) ? dayNr(today()) : dayNr(today()) - 1, cur = 0;
    while (byDay.get(isoOf(d))?.score) { cur++; d--; }
    let max = 0, run = 0, prev = null;
    for (const day of days) {
      const won = !!byDay.get(day).score;
      run = won ? (prev !== null && dayNr(day) === prev + 1 && run > 0 ? run + 1 : 1) : 0;
      max = Math.max(max, run); prev = dayNr(day);
    }
    const dist = [1, 2, 3, 4, 5, 6].map(g => wins.filter(x => byDay.get(x).guesses === g).length);
    return { played: days.length, wins: wins.length, cur, max, dist };
  }
  function drawStats(box, lastGuesses = 0) {
    const s = statsFor(level), top = Math.max(1, ...s.dist);
    $(box).innerHTML = `<h3>${esc(T.stats)} · ${esc(T.levels[level])}</h3>` + (s.played ? `
      <div class="stats">
        <div><b>${s.played}</b><span>${esc(T.played)}</span></div>
        <div><b>${Math.round(100 * s.wins / s.played)}</b><span>${esc(T.winPct)}</span></div>
        <div><b>${s.cur}</b><span>${esc(T.streak)}</span></div>
        <div><b>${s.max}</b><span>${esc(T.maxStreak)}</span></div>
      </div>
      <div class="small" style="margin-top:10px">${esc(T.dist)}</div>
      <div class="dist">${s.dist.map((c, i) => `<div class="d"><span>${i + 1}</span><i class="${lastGuesses === i + 1 ? "now" : ""}" style="width:${Math.max(8, 100 * c / top)}%">${c}</i></div>`).join("")}</div>`
      : `<p class="small">${esc(T.noStats)}</p>`);
  }

  // ---------- Rankings ----------
  let rankTab = "dag", rankLevel = levels.length > 1 ? "alle" : levels[0], plays = null;
  const weekStart = day => { const n = dayNr(day), dow = (new Date(n * 86400000).getUTCDay() + 6) % 7; return isoOf(n - dow); };
  async function loadPlays() {
    if (plays) return plays;
    const day = today(), from = [weekStart(day), day.slice(0, 8) + "01"].sort()[0];
    plays = (await api.loadWoordlePlays(from)).filter(p => p.lang === LANG);
    return plays;
  }
  const points = p => p.won ? 7 - p.guesses : 0;
  async function drawRanking(box) {
    const el = $(box);
    const tabs = Object.entries(T.tabs).map(([k, t]) => `<button class="ch${k === rankTab ? " on" : ""}" data-tab="${k}">${esc(t)}</button>`).join("");
    // Level chips only when there is more than one level to play
    const lvs = levels.length < 2 ? "" : [["alle", T.allLv], ...levels.map(l => [l, T.levels[l].split(" · ")[1]])]
      .map(([k, t]) => `<button class="ch${k === rankLevel ? " on" : ""}" data-lv="${k}">${esc(t)}</button>`).join("");
    el.innerHTML = `<h3>${esc(T.rank)}</h3><div class="tabs2">${tabs}</div>${lvs ? `<div class="tabs2">${lvs}</div>` : ""}<div data-t><p class="small">…</p></div>`;
    el.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { rankTab = b.dataset.tab; drawRanking(box); });
    el.querySelectorAll("[data-lv]").forEach(b => b.onclick = () => { rankLevel = b.dataset.lv; drawRanking(box); });
    const out = el.querySelector("[data-t]");
    let list;
    try { list = await loadPlays(); } catch { out.innerHTML = `<p class="small">${esc(T.rankErr)}</p>`; return; }
    const day = today(), from = rankTab === "dag" ? day : rankTab === "week" ? weekStart(day) : day.slice(0, 8) + "01";
    const sel = list.filter(p => p.day >= from && p.day <= day && (rankLevel === "alle" || p.level === rankLevel));
    const medal = ["🥇", "🥈", "🥉"];
    if (!sel.length) { out.innerHTML = `<p class="small">${esc(T.nobody)}</p><p class="small">${esc(T.pts)}</p>`; return; }
    let html;
    if (rankTab === "dag" && rankLevel !== "alle") {
      // One word: guessed first, then fewer guesses, then faster
      sel.sort((a, b) => b.won - a.won || a.guesses - b.guesses || a.time_s - b.time_s);
      html = `<table class="rank"><tr>${T.colDay.map((c, i) => `<th class="${i > 1 ? "n" : ""}">${esc(c)}</th>`).join("")}</tr>` +
        sel.map((p, i) => `<tr class="${p.uid === user.uid ? "me" : ""}"><td>${medal[i] || i + 1}</td><td>${esc(p.name)}</td>
          <td class="n">${p.won ? p.guesses : esc(T.notGuessed)}</td><td class="n">${fmt(p.time_s)}</td></tr>`).join("") + `</table>`;
    } else {
      // Several words: sum of points; also days played and average guesses (guessed words only)
      const per = new Map();
      for (const p of sel) {
        const r = per.get(p.uid) || { name: p.name, uid: p.uid, pts: 0, days: new Set(), g: 0, w: 0 };
        r.pts += points(p); r.days.add(p.day); if (p.won) { r.g += p.guesses; r.w++; }
        per.set(p.uid, r);
      }
      const rows = [...per.values()].sort((a, b) => b.pts - a.pts || (a.w ? a.g / a.w : 9) - (b.w ? b.g / b.w : 9));
      html = `<table class="rank"><tr>${T.cols.map((c, i) => `<th class="${i > 1 ? "n" : ""}">${esc(c)}</th>`).join("")}</tr>` +
        rows.map((r, i) => `<tr class="${r.uid === user.uid ? "me" : ""}"><td>${medal[i] || i + 1}</td><td>${esc(r.name)}</td>
          <td class="n">${r.pts}</td><td class="n">${r.days.size}</td><td class="n">${r.w ? (r.g / r.w).toFixed(1) : "-"}</td></tr>`).join("") + `</table>`;
    }
    out.innerHTML = html + `<p class="small">${esc(T.pts)}</p>`;
  }

  // ---------- Screen 2: the game ----------
  const show = s => ["setup", "play", "done"].forEach(x => $(x).hidden = x !== s);
  function start() {
    const day = today();
    if (playedToday(level)) return drawSetup();
    const n = LEN[level], saved = loadLocal(progressKey(day, level), null);
    S = { day, level, n, answer: wordOf(day, level), guesses: saved?.guesses || [], typed: "", done: false, elapsed: saved?.elapsed || 0, resumedAt: Date.now() };
    clearInterval(S.timer);
    S.timer = setInterval(tick, 500); tick();
    $("what").textContent = T.levels[level];
    $("rows").innerHTML = [...Array(TRIES)].map(() => `<div class="rw" style="--n:${n}">${'<div class="lt"></div>'.repeat(n)}</div>`).join("");
    $("kb").innerHTML = KEYS.map((r, i) => `<div class="r">${i === 2 ? `<button class="key wide" data-k="enter">Enter</button>` : ""}${[...r].map(ch => `<button class="key" data-k="${ch}">${ch}</button>`).join("")}${i === 2 ? `<button class="key wide" data-k="back" aria-label="wissen">⌫</button>` : ""}</div>`).join("");
    $("kb").querySelectorAll("[data-k]").forEach(k => k.onclick = () => press(k.dataset.k));
    $("msg").textContent = "";
    show("play");
    draw();
  }
  const played = () => S.elapsed + Math.floor((Date.now() - S.resumedAt) / 1000);
  function tick() { $("clock").textContent = fmt(played()); }
  function saveProgress() { if (S && !S.done) saveLocal(progressKey(S.day, S.level), { guesses: S.guesses, elapsed: played() }); }
  addEventListener("pagehide", saveProgress);
  document.addEventListener("visibilitychange", () => { if (document.hidden) saveProgress(); });

  // Colours for one guess: first the green letters, then yellow only as often as the letter is still left over
  function score(guess, answer) {
    const g = [...guess], a = [...answer], res = Array(g.length).fill("miss"), left = {};
    for (let i = 0; i < g.length; i++) { if (g[i] === a[i]) res[i] = "good"; else left[a[i]] = (left[a[i]] || 0) + 1; }
    for (let i = 0; i < g.length; i++) if (res[i] !== "good" && left[g[i]] > 0) { res[i] = "near"; left[g[i]]--; }
    return res;
  }
  function draw(flipRow = -1) {
    const rows = $("rows").children;
    S.guesses.forEach((g, r) => {
      const sc = score(g, S.answer), ch = [...g];
      [...rows[r].children].forEach((el, i) => {
        el.textContent = ch[i];
        el.className = "lt " + sc[i] + (r === flipRow ? " flip" : "");
        if (r === flipRow) el.style.animationDelay = `${i * 90}ms`;
      });
    });
    const r = S.guesses.length, typed = [...S.typed];
    if (r < TRIES) [...rows[r].children].forEach((el, i) => { el.textContent = typed[i] || ""; el.className = "lt" + (typed[i] ? " filled" : ""); });
    const rank = { good: 3, near: 2, miss: 1 }, best = {};
    S.guesses.forEach(g => { const ch = [...g]; score(g, S.answer).forEach((c, i) => { if ((rank[c] || 0) > (rank[best[ch[i]]] || 0)) best[ch[i]] = c; }); });
    $("kb").querySelectorAll("[data-k]").forEach(k => { const c = best[k.dataset.k]; k.className = "key" + (k.dataset.k.length > 1 ? " wide" : "") + (c ? " " + c : ""); });
  }
  function press(k) {
    if (!S || S.done) return;
    $("msg").textContent = "";
    if (k === "back") S.typed = [...S.typed].slice(0, -1).join("");
    else if (k === "enter") return submit();
    else if (LETTER.test(k) && [...S.typed].length < S.n) S.typed += k;
    draw();
  }
  // Keyboard: only when this game is on screen (the other language may sit in a hidden tab)
  document.addEventListener("keydown", e => {
    if (!S || $("play").hidden || !root.offsetParent || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest?.("input, textarea, select")) return;
    if (e.key === "Enter") { e.preventDefault(); press("enter"); }
    else if (e.key === "Backspace") { e.preventDefault(); press("back"); }
    else if (e.key.length === 1 && LETTER.test(lower(e.key))) press(lower(e.key));
  });
  function submit() {
    const row = $("rows").children[S.guesses.length];
    if ([...S.typed].length < S.n) { $("msg").textContent = T.typeN(S.n); flash(row, "shake"); return; }
    // Not a real word: refused, and it does not cost a turn
    if (!valid[S.n].has(S.typed) && !answers[S.n].includes(S.typed)) { $("msg").textContent = T.unknown; flash(row, "shake"); return; }
    S.guesses.push(S.typed);
    S.typed = "";
    draw(S.guesses.length - 1);
    saveProgress();
    const won = S.guesses.at(-1) === S.answer;
    if (won || S.guesses.length === TRIES) setTimeout(() => finish(won), S.n * 90 + 450);
  }
  $("stop").onclick = () => { saveProgress(); clearInterval(S.timer); show("setup"); drawSetup(); };
  $("change").onclick = () => { show("setup"); drawSetup(); };

  // ---------- Share the result as coloured squares (no letters, so the word stays secret) + a link ----------
  // Phone: the share menu (WhatsApp etc.); computer: copied to the clipboard.
  const link = shareUrl || (location.origin + location.pathname + (LANG === "tr" ? "?taal=tr" : ""));
  function shareText(att) {
    const guesses = att.answers[0].chosen.split(","), date = new Date(att.day + "T12:00:00Z")
      .toLocaleDateString(LANG === "tr" ? "tr-TR" : "nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });
    const rows = guesses.map(g => score(g, att.word).map(c => ({ good: "🟩", near: "🟨" }[c] || "⬜")).join(""));
    return `${T.shareName} · ${date} · ${att.score ? guesses.length : "X"}/${TRIES}\n${rows.join("\n")}\n${link}`;
  }
  async function share(btn, att) {
    const text = shareText(att);
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); }
    catch {   // older browsers: copy through a hidden text box
      const ta = Object.assign(document.createElement("textarea"), { value: text }); document.body.append(ta); ta.select();
      try { document.execCommand("copy"); } catch {} ta.remove();
    }
    const old = btn.textContent; btn.textContent = T.copied; setTimeout(() => btn.textContent = old, 2000);
  }

  // ---------- Screen 3 ----------
  function finish(won) {
    S.done = true;
    clearInterval(S.timer);
    const time_s = played(), g = S.guesses.length;
    const wonBefore = history.filter(h => h.test === S.level && h.score).map(h => h.guesses);
    const prev = wonBefore.length ? Math.min(...wonBefore) : null;
    saveLocal(progressKey(S.day, S.level), null);
    // His own round (score 1/1 = guessed); the word goes into `answers`, so the admin sees which words were hard
    const attempt = { test: S.level, day: S.day, lang: LANG, score: won ? 1 : 0, total: 1, guesses: g, time_s, word: S.answer,
                      answers: [{ qid: S.answer, chosen: S.guesses.join(","), correct: won }], finished_at: new Date().toISOString() };
    history.unshift({ ...attempt, module: MODULE });
    root.querySelector(".saveerr")?.remove();
    api.saveAttempt(user.uid, MODULE, attempt).catch(e => {
      if (!root.querySelector(".saveerr")) $("resultText").insertAdjacentHTML("afterend", `<p class="saveerr">${esc(T.saveErr(e.code || "fout"))}</p>`);
    });
    // Everyone's results for the rankings (guessed or not)
    const posted = api.saveWoordlePlay(user, profile, { lang: LANG, level: S.level, day: S.day, won, guesses: g, time_s }).catch(() => {});
    show("done");
    $("result").textContent = won ? T.win(g) : T.lost;
    $("resultText").textContent = won ? T.resWon(T.levels[S.level], g, fmt(time_s)) : T.resLost(T.levels[S.level]);
    $("record").hidden = !won || (prev !== null && g >= prev);
    $("record").textContent = T.rec(prev);
    $("share2").onclick = () => share($("share2"), attempt);
    wordInfo(S.answer);
    drawStats("stats2", won ? g : 0);
    posted.then(() => { plays = null; drawRanking("rank2"); });
  }

  // What the word means and where it is used: only facts from our own data, plus a link for the origin
  async function wordInfo(w) {
    const box = $("info");
    let html = `<div>${esc(T.was)}</div><div class="w">${esc(w)}</div>`;
    if (LANG === "tr") {
      const m = info[w] || [];
      if (m.length) html += `<h4>${esc(T.meaning)}</h4>` + m.map((x, i) => `<p>${m.length > 1 ? `${i + 1}. ` : ""}${esc(x)}</p>`).join("");
      html += `<p class="small"><a href="https://tr.wiktionary.org/wiki/${encodeURIComponent(w)}" target="_blank" rel="noopener">${esc(T.origin)}</a></p>`;
      box.innerHTML = html;
      return;
    }
    const e = info[w];
    if (e) {
      const tags = [e.nl.match(/^(de|het)\s/)?.[1], (turen[e.tur] || "").split(" · ")[0], e.niveau, e.groep ? "groep " + e.groep : "", (themas[e.thema] || "").split(" · ")[0]].filter(Boolean);
      html += `<div class="tagrow">${tags.map(t => `<span class="tg">${esc(t)}</span>`).join("")}</div>`;
      if (e.tr) html += `<p>${esc(T.tr)}: <b>${esc(e.tr)}</b></p>`;
      if (e.uitleg) html += `<p>${esc(e.uitleg)}</p>`;
      if (e.voorbeeld) html += `<h4>${esc(T.example)}</h4><p class="ex">${esc(e.voorbeeld)}</p>${e.voorbeeld_tr ? `<p class="small">${esc(e.voorbeeld_tr)}</p>` : ""}`;
    }
    const where = [];
    if (kwClue[w]) where.push(`Kruiswoord: “${esc(kwClue[w])}”`);
    if (wzTheme[w]) where.push(`Woordzoeker: thema ${esc(wzTheme[w])}`);
    if (where.length) html += `<h4>${esc(T.alsoIn)}</h4>` + where.map(x => `<p>${x}</p>`).join("");
    html += `<div data-r="news"></div><p class="small"><a href="https://nl.wiktionary.org/wiki/${encodeURIComponent(w)}" target="_blank" rel="noopener">${esc(T.origin)}</a></p>`;
    box.innerHTML = html;
    // Sentences with this word in the "Nieuws in niveaus" texts (easiest level first)
    try {
      const nieuws = await fetch(new URL("nieuws.json", POOL)).then(r => r.json());
      const re = new RegExp(`(^|[^a-zà-ÿ])${w}([^a-zà-ÿ]|$)`, "i"), hits = [];
      for (const item of nieuws.items || []) for (const lv of ["a0", "a1", "a2", "b1", "b2", "c1"]) {
        if (hits.length >= 3 || hits.some(h => h.id === item.id)) break;
        const text = String(item[lv] || "").replace(/<[^>]+>/g, "");
        const sent = text.split(/(?<=[.!?])\s+|\n+/).find(s => re.test(s));
        if (sent) hits.push({ id: item.id, title: item.titel, lv: lv.toUpperCase(), s: sent.trim() });
      }
      if (hits.length) $("news").innerHTML = `<h4>${esc(T.news)}</h4>` + hits.map(h => `<p class="ex">${esc(h.s)}</p><p class="small">${esc(h.title)} · ${h.lv}</p>`).join("");
    } catch {}
  }

  // Local tests only (never on the real site)
  if (location.hostname === "localhost") (window.__woordleGames ||= {})[LANG] = () => S && { answer: S.answer, n: S.n };

  drawSetup();
}
