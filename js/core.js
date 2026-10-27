// Shared core for every Slimspel page.
// Slimspel uses the SAME Firebase project and accounts as nl-oefenbank, so:
// - one login for both sites,
// - approval, account type and parent link are managed on the nl-oefenbank admin page,
// - finished rounds land in users/{uid}/attempts, where the admin statistics and
//   the weekly parent e-mail (nl-oefenbank mailer) already look.
// Data model and rules: see nl-oefenbank/js/core.js and nl-oefenbank/firestore.rules.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Public web config, identical to nl-oefenbank (not a secret: firestore.rules control access)
const firebaseConfig = {
  apiKey: "AIzaSyAdTzM00PphCzTBinqL_KjyAJGwJgevH4k",
  authDomain: "nt2-lezen.firebaseapp.com",
  projectId: "nt2-lezen",
  storageBucket: "nt2-lezen.firebasestorage.app",
  messagingSenderId: "574362574093",
  appId: "1:574362574093:web:615c5761f2f29fc9cba444"
};
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
const db = getFirestore(fb);
window.__slimReady = true; // seen by the watchdog in each page

// Site root, so pages at any depth can link home (this file lives in /js/)
export const ROOT = new URL("../", import.meta.url).href;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const userRef = uid => doc(db, "users", uid);
const attemptsCol = uid => collection(db, "users", uid, "attempts");
const isAdmin = p => (p?.role || "member") === "admin";
const statusOf = p => isAdmin(p) ? "approved" : (p?.status || "pending");
const updateProfile = (uid, data) => setDoc(userRef(uid), data, { merge: true });

// ---------- Saving and loading rounds ----------

// Save one finished round. Same shape as nl-oefenbank:
// { module, test, score, total, answers:[{qid, chosen, correct}], finished_at, ... }
// The rules allow at most 50 answers per round, so we cut there.
export function saveAttempt(uid, module, attempt) {
  const answers = (attempt.answers || []).slice(0, 50);
  return addDoc(attemptsCol(uid), { ...attempt, answers, module });
}

// This user's rounds for one module, newest first
export async function loadAttempts(uid, module) {
  const snap = await getDocs(query(attemptsCol(uid), where("module", "==", module)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.finished_at || "").localeCompare(a.finished_at || ""));
}

// ---------- Daily ranking ----------
// leaderboard/{day}/entries/{key-uid}: one entry per child per daily puzzle (see nl-oefenbank/firestore.rules).
// key = game + puzzle, e.g. "sudoku-4x4-makkelijk". Only children are listed.

const entriesCol = day => collection(db, "leaderboard", day, "entries");

// Write this child's result once. Adults are skipped (the list is for children only).
// If an entry already exists the rules refuse the write; that is fine, the first result counts.
export function postScore(user, profile, day, key, time_s, hints) {
  if (profile.type !== "child") return Promise.resolve();
  const name = (profile.name || user.displayName || "?").trim().split(/\s+/)[0]; // first name only
  return setDoc(doc(entriesCol(day), `${key}-${user.uid}`), {
    uid: user.uid, name: name.slice(0, 40), key,
    time_s: Math.max(1, Math.round(time_s)), hints: Math.round(hints), at: new Date().toISOString()
  });
}

// Today's ranking for one puzzle: fewest hints first, then fastest
export async function loadBoard(day, key) {
  const snap = await getDocs(query(entriesCol(day), where("key", "==", key)));
  return snap.docs.map(d => d.data()).sort((a, b) => a.hints - b.hints || a.time_s - b.time_s);
}

// HTML for the ranking list; the viewer's own line is highlighted
export function boardHtml(list, myUid) {
  if (!list.length) return `<p class="board-empty">Nog niemand heeft deze puzzel vandaag opgelost.</p>`;
  const medal = ["🥇", "🥈", "🥉"];
  const t = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return `<ol class="ranking">${list.slice(0, 10).map((e, i) => `<li class="${e.uid === myUid ? "me" : ""}">
    <span class="pos">${medal[i] || i + 1}</span><span class="nm">${esc(e.name)}</span>
    <span class="tm">${t(e.time_s)}${e.hints ? ` · ${e.hints} hint${e.hints > 1 ? "s" : ""}` : ""}</span></li>`).join("")}</ol>`;
}

// Today's date in the Netherlands (YYYY-MM-DD): daily puzzles change at midnight Dutch time
export const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

// ---------- Small helpers used by the games ----------

// Random whole number from min to max (both included)
export const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// Fisher-Yates shuffle: fair random order, returns a new array
export function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Replay a CSS animation class on an element (pop / shake)
export function flash(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // forces the browser to restart the animation
  el.classList.add(cls);
}

// Browser-only settings (e.g. last chosen tables). Not for results: those go to Firestore.
export function loadLocal(name, fallback) {
  try { const raw = localStorage.getItem("slimspel:" + name); return raw === null ? fallback : JSON.parse(raw); }
  catch { return fallback; }
}
export function saveLocal(name, value) {
  try { localStorage.setItem("slimspel:" + name, JSON.stringify(value)); } catch {}
}

// ---------- User box in the page header ----------

export function userBox(user, profile) {
  const name = profile.name || user.displayName || "";
  return `<span class="ub">${user.photoURL ? `<img src="${esc(user.photoURL)}" alt="">` : ""}
    <span>${esc(name)}</span>
    <button type="button" class="ub-out" data-core="logout">Uitloggen</button></span>`;
}
document.addEventListener("click", e => {
  if (e.target.closest("[data-core='logout']")) signOut(auth).then(() => location.href = ROOT);
});

// ---------- Login gate (full-screen overlay, Dutch, child friendly) ----------

function overlay(html) {
  let g = document.getElementById("gate");
  if (!g) { g = document.createElement("div"); g.id = "gate"; document.body.appendChild(g); }
  g.innerHTML = `<div class="gc">${html}</div>`;
  return g;
}
const closeOverlay = () => document.getElementById("gate")?.remove();

async function googleLogin() {
  const p = new GoogleAuthProvider();
  try { await signInWithPopup(auth, p); }
  catch (e) {
    // Some browsers block popups: fall back to a full-page redirect
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment"].includes(e.code)) return signInWithRedirect(auth, p);
    if (e.code !== "auth/popup-closed-by-user") throw e;
  }
}

/**
 * Wait until the visitor is signed in AND approved by the admin.
 * seen: module id to record as visited (users/{uid}.seen.{id}); the admin statistics use it.
 * Resolves with { user, profile }.
 */
export function gate({ seen = "" } = {}) {
  overlay(`<p>Laden…</p>`);
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (!user) { showLogin(); return; }
      try {
        const snap = await getDoc(userRef(user.uid));
        let profile = snap.exists() ? snap.data() : null;
        if (!profile) {
          // First visit ever (also not on nl-oefenbank): create the profile with the defaults the rules allow
          profile = { name: user.displayName || "", email: user.email || "", photo: user.photoURL || "", role: "member", status: "pending", created_at: new Date().toISOString() };
          await updateProfile(user.uid, profile);
        }
        if (!profile.type) profile = await askType(user, profile);
        // Children: some games depend on the groep (e.g. tafels), so ask it once if it is missing
        if (profile.type === "child" && !/^groep[1-8]$/.test(profile.groep || "")) profile = await askGroep(user, profile);
        const fresh = { name: profile.name || user.displayName || "", email: user.email || "", photo: user.photoURL || "", last_active: new Date().toISOString() };
        if (statusOf(profile) !== "approved") {
          updateProfile(user.uid, fresh).catch(() => {});
          showWaiting(user, profile); return;
        }
        updateProfile(user.uid, { ...fresh, ...(seen ? { seen: { [seen]: fresh.last_active } } : {}) }).catch(() => {});
        closeOverlay();
        resolve({ user, profile });
      } catch (e) {
        overlay(`<h2>Er ging iets mis</h2><p class="err">${esc(e.code || e.message || e)}</p>
          <p>Ververs de pagina. Gaat het nog steeds mis? Stuur deze code naar Zana.</p>
          <button data-core="logout">Uitloggen</button>`);
      }
    });
  });
}

function showLogin() {
  const g = overlay(`<h2><mark>Slim</mark>spel</h2>
    <p>Log in met je Google-account. Zo worden je scores bewaard.</p>
    <button class="btn primary" id="g-login">Inloggen met Google</button><div id="g-err"></div>`);
  g.querySelector("#g-login").onclick = () => googleLogin().catch(e => {
    g.querySelector("#g-err").innerHTML = `<p class="err">Inloggen lukte niet: ${esc(e.code || e.message)}</p>`;
  });
}

function showWaiting(user, profile) {
  const blocked = statusOf(profile) === "blocked";
  overlay(`<h2>${blocked ? "Dit account is uitgezet" : "Nog even wachten"}</h2>
    <p>${blocked ? "Denk je dat dit een vergissing is? Vraag het aan Zana." : "Je account moet eerst worden goedgekeurd. Vraag het aan je ouder of aan Zana, en klik daarna op opnieuw proberen."}</p>
    <p class="small">${esc(user.email || "")}</p>
    ${blocked ? "" : `<button class="btn primary" onclick="location.reload()">Opnieuw proberen</button>`}
    <button class="btn" data-core="logout">Uitloggen</button>`);
}

// The child's groep as a number (1-8), or null if unknown. Moves up every August (nl-oefenbank mailer).
export const groepNr = profile => /^groep([1-8])$/.test(profile?.groep || "") ? Number(profile.groep.slice(5)) : null;

// Asked once if a child has no groep yet. Same field as the nl-oefenbank profile page.
function askGroep(user, profile) {
  return new Promise(resolve => {
    const g = overlay(`<h2>In welke groep zit je?</h2>
      <div class="tiles groeps">${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<button class="btn" data-g="groep${n}">Groep ${n}</button>`).join("")}</div>
      <div id="g-err"></div>`);
    g.querySelectorAll("[data-g]").forEach(b => b.onclick = async () => {
      try { await updateProfile(user.uid, { groep: b.dataset.g }); resolve({ ...profile, groep: b.dataset.g }); }
      catch (e) { g.querySelector("#g-err").innerHTML = `<p class="err">Opslaan lukte niet: ${esc(e.code || e.message)}</p>`; }
    });
  });
}

// First login only: who uses this account? Same values as nl-oefenbank ("child" / "adult").
function askType(user, profile) {
  return new Promise(resolve => {
    const g = overlay(`<h2>Wie ben jij?</h2>
      <div class="tiles">
        <button class="btn" data-t="child">Leerling</button>
        <button class="btn" data-t="adult">Volwassene</button>
      </div><div id="g-err"></div>`);
    g.querySelectorAll("[data-t]").forEach(b => b.onclick = async () => {
      try { await updateProfile(user.uid, { type: b.dataset.t }); resolve({ ...profile, type: b.dataset.t }); }
      catch (e) { g.querySelector("#g-err").innerHTML = `<p class="err">Opslaan lukte niet: ${esc(e.code || e.message)}</p>`; }
    });
  });
}
