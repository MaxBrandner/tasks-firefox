// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const setup = require("./harness.cjs");
const P = ROOT;
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const START = { "L:l1": { t: "Liste", o: 0 }, "T:a": { l: "l1", t: "A", o: 0 }, "T:b": { l: "l1", t: "B", o: 1 }, "T:c": { l: "l1", t: "C", o: 2 } };
const tools = (H) => {
  const $ = (id) => H.d.getElementById(id);
  return {
    $, check: async (t) => { H.li(t).querySelector(":scope>.row .check").click(); await H.tick(); },
    open: async () => { $("listMenuBtn").click(); H.d.querySelector('[data-action="history"]').click(); await H.tick(); },
    close: async () => { $("historyDlg").querySelector(".modal-close").click(); await H.tick(); },
    labels: () => [...$("historyList").querySelectorAll(".hist-label")].map((e) => e.textContent).join(" | "),
    current: () => { const c = $("historyList").querySelector(".current .hist-label"); return c && c.textContent; },
  };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const boot = async (sync, local) => { const H = setup(P, sync, { local }); await H.tick(); await H.tick(); return H; };
(async () => {
  // 1) steps incl. a branch – saved?
  let H = await boot(START, {}); let X = tools(H);
  await X.check("A"); await X.check("B"); await H.bodyKey("z", { ctrlKey: true }); await X.check("C");
  await wait(800); // the last step is recorded on its own shortly after
  const saved = H.local.data["tk:history"];
  ok(saved && saved.v === 1 && Object.keys(saved.nodes).length === 4 && typeof saved.rootState === "string", "Verlauf in storage.local gespeichert (Start + 3 Schritte)");
  const diffSize = JSON.stringify(Object.values(saved.nodes).map((n) => n.d)).length;
  ok(diffSize < 600, `nur Änderungen gespeichert (${diffSize} Zeichen für alle Schritte)`);
  // 2) reopen: same tree, no phantom step, undo/redo across restart
  H = await boot(H.sync.data, H.local.data); X = tools(H);
  await X.open();
  ok(X.labels() === "Start | „A“ abgehakt | „B“ abgehakt | „C“ abgehakt" && X.current() === "„C“ abgehakt", "nach Neustart: gleicher Baum, gleicher aktueller Stand, kein Schein-Schritt");
  ok(H.d.querySelector("#historyList .hist-row.branch"), "Zweig ist erhalten");
  await X.close();
  await H.bodyKey("z", { ctrlKey: true });
  ok(H.sync.data["T:a"].x && !H.sync.data["T:c"].x, "Strg+Z nach Neustart");
  await H.bodyKey("y", { ctrlKey: true });
  ok(H.sync.data["T:c"].x, "Strg+Y nach Neustart");
  // 3) change while the sidebar was closed
  const sync3 = structuredClone(H.sync.data); sync3["T:b"].t = "B (anderer Rechner)";
  H = await boot(sync3, H.local.data); X = tools(H);
  await X.open();
  ok(X.current() === "Änderungen außerhalb der Seitenleiste", "Änderung von außerhalb wird eigener Schritt: " + X.labels());
  await X.close();
  await H.bodyKey("z", { ctrlKey: true });
  ok(H.sync.data["T:b"].t === "B", "… und lässt sich zurücknehmen");
  // 3b) changes from outside while the sidebar is open: own steps, undoable
  await H.sync.set({ "T:b": { ...H.sync.data["T:b"], t: "B (Handy)" } }); await H.tick();
  await H.sync.remove(["T:a", "T:c"]); await H.tick();
  await X.open();
  ok(/\| Von außen: „B \(Handy\)“ geändert \| Von außen: 2 Aufgaben gelöscht$/.test(X.labels()), "Änderungen von außen bei offener Seitenleiste je ein Schritt: " + X.labels());
  await X.close();
  await H.bodyKey("z", { ctrlKey: true });
  ok(H.sync.data["T:a"] && H.sync.data["T:c"] && H.sync.data["T:b"].t === "B (Handy)", "Strg+Z holt die von außen gelöschten Aufgaben zurück");
  await H.bodyKey("y", { ctrlKey: true });
  await X.check("B (Handy)"); await wait(800);
  await X.open();
  ok(/\| Von außen: 2 Aufgaben gelöscht \| „B \(Handy\)“ abgehakt$/.test(X.labels()), "eigene Schritte danach ohne Schein-Schritt von außen: " + X.labels());
  await X.close();
  await H.bodyKey("z", { ctrlKey: true }); await H.bodyKey("z", { ctrlKey: true }); // A and C back for the steps below
  // 4) another window saves a history → taken over
  await wait(800);
  const other = { ...structuredClone(H.local.data["tk:history"]), by: "anderes-fenster" };
  other.nodes[other.root].l = "Start (anderes Fenster)";
  await H.local.set({ "tk:history": other }); await H.tick();
  await X.open();
  ok(/^Start \(anderes Fenster\) \| /.test(X.labels()) && !/\| Änderung$/.test(X.labels()), "Verlauf aus anderem Fenster übernommen: " + X.labels());
  // 5) clear history
  X.$("historyClear").click(); await H.tick();
  ok(X.labels() === "Start" && Object.keys(H.local.data["tk:history"].nodes).length === 1, "„Verlauf leeren“: nur noch Start, auch gespeichert");
  await X.close();
  // 6) limit: 250 steps → at most 200 stored, small
  if (X.$("doneList").hidden) { X.$("doneToggle").click(); await H.tick(); }
  for (let i = 0; i < 250; i++) await X.check("A");
  await wait(800);
  const big = H.local.data["tk:history"];
  const size = JSON.stringify(big).length;
  ok(Object.keys(big.nodes).length === 200 && size < 120000, `250 Schritte → ${Object.keys(big.nodes).length} gespeichert, ${Math.round(size / 1024)} KB`);
  H = await boot(H.sync.data, H.local.data); X = tools(H);
  await X.open();
  ok(H.d.querySelectorAll("#historyList .hist-row").length === 200 && X.current() && !/außerhalb/.test(X.current()), "nach Neustart wieder 200 Schritte, aktueller Stand passt");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
