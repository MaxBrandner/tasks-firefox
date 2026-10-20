// Run: npm test (all) or npm test sync-guard
// Wiped Firefox Sync store (add-on removed on another device): shared/sync-guard.js
// writes the lists back; the sidebar offers to undo mass deletions from outside.
const ROOT = require("node:path").resolve(__dirname, "..");
const fs = require("fs"); const vm = require("vm");
const setup = require("./harness.cjs");
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const START = { "L:l1": { t: "Uni", o: 0 }, "L:l2": { t: "Privat", o: 1 },
  ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((i) => ["T:u" + i, { l: "l1", t: "U" + i, o: i }])),
  "T:p1": { l: "l2", t: "P1", o: 0 } };

// shared/sync-guard.js in a sandbox with storage that fires onChanged like Firefox.
function guard(syncData, localData) {
  const listeners = [];
  const area = (name, init) => { const data = structuredClone(init || {}); return { data,
    async get(k) { if (k == null) return structuredClone(data); const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = structuredClone(data[x]); return o; },
    async set(o) { const ch = {}; for (const [k, v] of Object.entries(o)) { ch[k] = { newValue: structuredClone(v) }; data[k] = structuredClone(v); } listeners.forEach((l) => l(structuredClone(ch), name)); },
    async remove(k) { const ch = {}; for (const x of [].concat(k)) { ch[x] = {}; delete data[x]; } listeners.forEach((l) => l(ch, name)); } }; };
  const sync = area("sync", syncData), local = area("local", localData);
  const ctx = { setTimeout, clearTimeout, structuredClone,
    browser: { storage: { sync, local, onChanged: { addListener: (l) => listeners.push(l) } } } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(ROOT + "/shared/sync-guard.js", "utf8"), ctx);
  return { sync, local };
}
const lists = (data) => Object.keys(data).filter((k) => k.startsWith("L:")).length;
const tasks = (data) => Object.keys(data).filter((k) => k.startsWith("T:")).length;

(async () => {
  // 1) copy follows Sync
  let G = guard(START, {}); await wait(1100);
  ok(tasks(G.local.data["tk:syncCopy"] || {}) === 7, "Kopie in storage.local angelegt (7 Aufgaben)");
  await G.sync.set({ "T:p2": { l: "l2", t: "P2", o: 1 } }); await wait(1100);
  ok(G.local.data["tk:syncCopy"]["T:p2"], "neue Aufgabe kommt in die Kopie");

  // 2) wipe (add-on removed elsewhere), sidebar adds "Meine Aufgaben" right after
  await G.sync.remove(Object.keys(G.sync.data));
  await G.sync.set({ "L:default": { t: "Meine Aufgaben", o: 0 } });
  await wait(50);
  ok(lists(G.sync.data) >= 2 && tasks(G.sync.data) === 8 && G.sync.data["L:l1"].t === "Uni", "nach dem Löschen über Sync: Listen und Aufgaben wieder da");
  ok(G.local.data["tk:syncRestored"] && G.local.data["tk:syncRestored"].tasks === 8, "Hinweis für die Seitenleiste gesetzt");

  // 3) normal deletions are kept
  await G.sync.remove(["L:l2", "T:p1", "T:p2"]); await wait(1100);
  ok(!G.sync.data["L:l2"] && !G.local.data["tk:syncCopy"]["L:l2"], "Liste löschen (andere bleibt) wird nicht zurückgeholt");

  // 4) wiped while Firefox was closed
  G = guard({}, { "tk:syncCopy": START }); await wait(50);
  ok(tasks(G.sync.data) === 7 && G.local.data["tk:syncRestored"], "beim Start leer, Kopie vorhanden → zurückgeschrieben");

  // 5) new device: nothing there yet, nothing to do
  G = guard({}, {}); await wait(50);
  ok(!Object.keys(G.sync.data).length && !G.local.data["tk:syncRestored"], "neues Gerät ohne Kopie: nichts passiert");

  // 6) sidebar: many tasks deleted from outside → toast with Rückgängig
  let H = setup(ROOT, START); await H.tick(); await H.tick();
  const $ = (id) => H.d.getElementById(id);
  await H.sync.remove(["L:l1", "T:u1", "T:u2", "T:u3", "T:u4", "T:u5", "T:u6"]); await H.tick();
  ok(!$("toast").hidden && $("toastText").textContent === "6 Aufgaben wurden auf einem anderen Gerät gelöscht (Liste „Uni“)." && $("toastUndo").textContent === "Rückgängig",
    "Meldung: " + $("toastText").textContent);
  $("toastUndo").click(); await H.tick();
  ok(H.sync.data["L:l1"] && tasks(H.sync.data) === 7, "„Rückgängig“ holt Liste und Aufgaben zurück");

  // 7) few deletions: no toast
  H = setup(ROOT, START); await H.tick(); await H.tick();
  await H.sync.remove(["T:u1", "T:u2"]); await H.tick();
  ok(H.d.getElementById("toast").hidden, "2 Aufgaben von außen gelöscht: keine Meldung");

  // 8) the guard restored the lists: notice once
  H = setup(ROOT, START); await H.tick(); await H.tick();
  await H.local.set({ "tk:syncRestored": { at: Date.now(), lists: 2, tasks: 7 } }); await H.tick();
  ok(!H.d.getElementById("toast").hidden && /anderen Gerät entfernt/.test(H.d.getElementById("toastText").textContent) && !H.local.data["tk:syncRestored"],
    "Hinweis „auf anderem Gerät entfernt“ erscheint und wird gelöscht");

  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
