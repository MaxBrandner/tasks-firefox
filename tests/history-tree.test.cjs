// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT, {
  "L:l1": { t: "Liste", o: 0 },
  "T:a": { l: "l1", t: "A", o: 0 }, "T:b": { l: "l1", t: "B", o: 1 }, "T:c": { l: "l1", t: "C", o: 2 },
});
const { d, ok, tick, sync, li, bodyKey } = H;
const $ = (id) => d.getElementById(id);
const check = async (t) => { li(t).querySelector(":scope>.row .check").click(); await tick(); };
const openHist = async () => { $("listMenuBtn").click(); d.querySelector('[data-action="history"]').click(); await tick(); };
const rows = () => [...$("historyList").querySelectorAll(".hist-row")];
const labels = () => rows().map((r) => r.querySelector(".hist-label").textContent);
const closeHist = async () => { $("historyDlg").querySelector(".modal-close").click(); await tick(); };
(async () => {
  await tick(); await tick();
  await check("A"); await check("B");                 // start → A checked → B checked
  await bodyKey("z", { ctrlKey: true });              // back to "A checked"
  ok(sync.data["T:a"].x && !sync.data["T:b"].x, "Strg+Z: B wieder offen");
  await check("C");                                   // new branch: C checked
  ok(sync.data["T:c"].x && !sync.data["T:b"].x, "neue Aktion nach Strg+Z");
  await openHist();
  ok($("historyDlg").open && labels().join(" | ") === "Start | „A“ abgehakt | „B“ abgehakt | „C“ abgehakt", "Verlauf: lesbare Namen, beide Zweige da: " + labels().join(" | "));
  const rB = rows().find((r) => /„B“/.test(r.textContent)), rC = rows().find((r) => /„C“/.test(r.textContent));
  ok(rC.classList.contains("current") && rB.classList.contains("branch") && rB.classList.contains("off-path") && !rC.classList.contains("branch"), "aktueller Stand markiert, alter Weg als eingerückter Zweig");
  // jump into the old branch
  rB.querySelector(".hist-jump").click(); await tick();
  ok(sync.data["T:b"].x && !sync.data["T:c"].x && rows().find((r) => /„B“/.test(r.textContent)).classList.contains("current"), "Klick auf „B abgehakt“: Stand mit B, ohne C");
  await closeHist();
  await bodyKey("z", { ctrlKey: true }); await bodyKey("y", { ctrlKey: true });
  ok(sync.data["T:b"].x && !sync.data["T:c"].x, "Strg+Y folgt danach dem zuletzt besuchten Zweig (B)");
  // take back a step in the middle, later ones stay
  await openHist();
  const rA = rows().find((r) => /„A“ abgehakt/.test(r.textContent));
  rA.querySelector(".hist-revert").click(); await tick();
  ok(!sync.data["T:a"].x && sync.data["T:b"].x && $("historyMsg").hidden, "↶ bei „A abgehakt“: nur A wieder offen, B bleibt abgehakt");
  ok(labels().includes("Zurückgenommen: „A“ abgehakt") && rows().find((r) => /Zurückgenommen/.test(r.textContent)).classList.contains("current"), "Zurücknehmen ist selbst ein Schritt im Verlauf");
  await closeHist();
  await bodyKey("z", { ctrlKey: true });
  ok(sync.data["T:a"].x && sync.data["T:b"].x, "… und lässt sich mit Strg+Z rückgängig machen");
  // conflict: a later step changed the same task
  if ($("doneList").hidden) { $("doneToggle").click(); await tick(); }
  await check("A");                                     // reopen A (touches A)
  await openHist();
  rows().find((r) => /^„A“ abgehakt/.test(r.querySelector(".hist-label").textContent)).querySelector(".hist-revert").click(); await tick();
  ok(!$("historyMsg").hidden && /Spätere Schritte haben dieselben Aufgaben geändert/.test($("historyMsg").textContent) && !sync.data["T:a"].x, "Konflikt → abgelehnt mit Erklärung, nichts verändert");
  ok(!rows()[0].querySelector(".hist-revert"), "Start hat kein ↶");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
