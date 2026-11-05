// Daily play time for child accounts, shared by Slimspel (every page) and the "Günün oyunları" tab of NL Oefenbank.
//
// Rules (change them here):
//   - 15 minutes of playing per day (plus extra minutes the admin gives on the admin page),
//   - open on weekdays 13:00-19:30 and on Saturday/Sunday 09:00-19:30 (Dutch time).
// Time only runs while he is really playing: the page is on screen, the games are shown (isOn),
// and there was a click, key, touch or mouse move in the last minute. Otherwise the clock pauses.
//
// Used time is kept in Firestore, users/{uid}/speeltijd/{YYYY-MM-DD} = { used_s, extra_s, updated_at },
// so a reload or another computer does not reset it (see nl-oefenbank/firestore.rules).
// The page only adds seconds (increment); only the admin can set extra_s.
// Note: this runs in the browser, so someone who knows computers well could get around it.
import { doc, setDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

export const LIMIT_S = 15 * 60;
const IDLE_MS = 60 * 1000;            // no input for 1 minute = away from the computer, clock pauses
const FLUSH_MS = 15 * 1000;           // send the counted seconds every 15 seconds
const HOURS = { weekday: [13 * 60, 19 * 60 + 30], weekend: [9 * 60, 19 * 60 + 30] }; // minutes after midnight

const TEXT = {
  nl: { left: "over", paused: "pauze", doneT: "Je speeltijd voor vandaag is op", doneP: "Morgen mag je weer spelen. Tot morgen!",
        closedT: "Slimspel is nu dicht", closedP: (from, to) => `Je kunt spelen van ${from} tot ${to}.`,
        tomorrow: "Morgen", today: "Vandaag", leave: "" },
  tr: { left: "kaldı", paused: "duraklatıldı", doneT: "Bugünkü oyun süren bitti", doneP: "Yarın yine oynayabilirsin. Yarın görüşürüz!",
        closedT: "Oyunlar şu an kapalı", closedP: (from, to) => `Oyun saatleri: ${from} – ${to}.`,
        tomorrow: "Yarın", today: "Bugün", leave: "Çalışma'ya dön" }
};

// Now in the Netherlands: date, weekday and minutes after midnight
function nowNL() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date()).map(p => [p.type, p.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekend: ["Sat", "Sun"].includes(parts.weekday),
           min: Number(parts.hour) * 60 + Number(parts.minute) };
}
const hhmm = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const CSS = `
.pt-pill{position:fixed;right:14px;bottom:14px;z-index:900;background:#1d2a4d;color:#fff;font:600 15px/1 system-ui,sans-serif;
  padding:9px 14px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.2);font-variant-numeric:tabular-nums}
.pt-pill.low{background:#c0392b}.pt-pill.pause{background:#6b7280}
.pt-block{position:fixed;inset:0;z-index:950;background:rgba(243,244,248,.97);display:flex;align-items:center;justify-content:center;padding:20px}
.pt-block .pt-card{max-width:420px;text-align:center;background:#fff;border-radius:16px;padding:28px 24px;box-shadow:0 8px 30px rgba(0,0,0,.12);font-family:system-ui,sans-serif}
.pt-block .pt-ico{font-size:52px}.pt-block h2{margin:8px 0;font-size:24px;color:#1d2a4d}.pt-block p{color:#4b5563;margin:6px 0}
.pt-block button{margin-top:14px;font:600 15px system-ui,sans-serif;padding:10px 18px;border-radius:10px;border:0;background:#1d2a4d;color:#fff;cursor:pointer}
[hidden].pt-pill,[hidden].pt-block{display:none!important}`;

/**
 * Start counting play time. Does nothing for adults.
 * db: the site's Firestore; lang: "nl" | "tr"; isOn(): are the games on screen right now (default: always);
 * onLeave(): optional button on the block screen (NL Oefenbank: back to the study tab).
 */
export function startPlaytime({ db, user, profile, lang = "nl", isOn = () => true, onLeave = null }) {
  if (profile?.type !== "child" || window.__playtime) return;
  const T = TEXT[lang] || TEXT.nl;
  if (!document.getElementById("pt-css")) {
    const st = document.createElement("style"); st.id = "pt-css"; st.textContent = CSS; document.head.appendChild(st);
  }
  const pill = Object.assign(document.createElement("div"), { className: "pt-pill", hidden: true });
  const block = Object.assign(document.createElement("div"), { className: "pt-block", hidden: true });
  document.body.append(pill, block);

  let day = nowNL().day, server = { used_s: 0, extra_s: 0 }, pending = 0, lastInput = Date.now(), unsub = null;
  // Backup in this browser, in case Firestore cannot be read (e.g. rules not published yet)
  const localKey = d => `slimspel:speeltijd:${user.uid}:${d}`;
  const localUsed = d => { try { return Number(localStorage.getItem(localKey(d))) || 0; } catch { return 0; } };

  function listen() {
    unsub?.();
    unsub = onSnapshot(doc(db, "users", user.uid, "speeltijd", day),
      snap => { server = { used_s: 0, extra_s: 0, ...(snap.data() || {}) }; draw(); },
      () => { /* no access: keep counting with the browser backup */ });
  }
  const used = () => Math.max(server.used_s + pending, localUsed(day));
  const limit = () => LIMIT_S + (server.extra_s || 0);

  async function flush() {
    if (!pending) return;
    const n = pending; pending = 0;
    try { await setDoc(doc(db, "users", user.uid, "speeltijd", day), { used_s: increment(n), updated_at: new Date().toISOString() }, { merge: true }); }
    catch { pending += n; }   // try again later
  }

  for (const ev of ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"])
    addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  // While the block screen is up, keys must not reach the game underneath (snake, 2048, woordle use the keyboard)
  addEventListener("keydown", e => { if (!block.hidden) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });
  addEventListener("pagehide", () => flush());

  function draw() {
    const now = nowNL(), on = isOn();
    const [from, to] = now.weekend ? HOURS.weekend : HOURS.weekday;
    const open = now.min >= from && now.min < to;
    const left = Math.max(0, limit() - used());
    if (!on) { pill.hidden = true; block.hidden = true; return; }
    if (!open || left <= 0) {
      // Next opening time: later today, or tomorrow (Saturday/Sunday from 09:00, other days from 13:00)
      const tomorrowWeekend = ["Fri", "Sat"].includes(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", weekday: "short" }).format(new Date()));
      const next = !open && now.min < from ? `${T.today} ${hhmm(from)}` : `${T.tomorrow} ${hhmm(tomorrowWeekend ? HOURS.weekend[0] : HOURS.weekday[0])}`;
      const html = left <= 0
        ? `<div class="pt-ico">⏰</div><h2>${T.doneT}</h2><p>${T.doneP}</p>`
        : `<div class="pt-ico">🌙</div><h2>${T.closedT}</h2><p>${T.closedP(hhmm(from), hhmm(to))}</p><p><b>${next}</b></p>`;
      if (block.dataset.html !== html) {
        block.dataset.html = html;
        block.innerHTML = `<div class="pt-card">${html}${onLeave && T.leave ? `<button>${T.leave}</button>` : ""}</div>`;
        block.querySelector("button")?.addEventListener("click", () => onLeave());
      }
      block.hidden = false; pill.hidden = true;
      return;
    }
    block.hidden = true;
    const running = !document.hidden && Date.now() - lastInput < IDLE_MS;
    pill.hidden = false;
    pill.className = "pt-pill" + (!running ? " pause" : left <= 120 ? " low" : "");
    pill.textContent = running ? `⏱ ${mmss(left)} ${T.left}` : `⏸ ${mmss(left)} · ${T.paused}`;
  }

  function tick() {
    const d = nowNL().day;
    if (d !== day) { flush(); day = d; server = { used_s: 0, extra_s: 0 }; pending = 0; listen(); }  // midnight: new day
    const now = nowNL(), [from, to] = now.weekend ? HOURS.weekend : HOURS.weekday;
    const counting = isOn() && !document.hidden && Date.now() - lastInput < IDLE_MS
      && now.min >= from && now.min < to && used() < limit();
    if (counting) {
      pending++;
      try { localStorage.setItem(localKey(day), String(used())); } catch {}
    }
    draw();
  }

  listen();
  setInterval(tick, 1000);
  setInterval(flush, FLUSH_MS);
  draw();
  window.__playtime = { used, limit, draw };   // also lets the NL Oefenbank tab redraw at once when the tab changes
}
