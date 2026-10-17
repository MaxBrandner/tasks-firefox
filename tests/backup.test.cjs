// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "L:uni1": { t: "Uni", o: 1 },
  "T:aaa": { l: "default", t: "Beispiel-Aufgabe", o: 0 },
  "T:bbb": { l: "uni1", t: "nat Info", d: "2026-10-19", o: 0 },
  "T:ccc": { l: "uni1", p: "bbb", t: "Blatt", d: "2026-10-19", h: "08:30", n: "Notiz", o: 0 },
});
const { d, ok, tick, sync, T, bodyKey } = H;
const $ = (id) => d.getElementById(id);
const menu = async (a) => { $("listMenuBtn").click(); d.querySelector(`[data-action="${a}"]`).click(); await tick(); };
const readBlob = (b) => new Promise((r) => { const fr = new H.w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(b); });
const pick = async (name, text) => {
  const input = $("importFile");
  Object.defineProperty(input, "files", { value: [{ name, text: async () => text }], configurable: true });
  input.dispatchEvent(new H.w.Event("change")); await tick(); await tick();
};
const snapshot = () => JSON.stringify(Object.fromEntries(Object.entries(sync.data).filter(([k]) => /^[LT]:/.test(k)).sort()));
(async () => {
  await tick();
  ok(d.querySelector('[data-action="export"]') && d.querySelector('[data-action="import"]'), "⋯-Menü: Sicherung exportieren / importieren");
  await menu("export");
  const file = JSON.parse(await readBlob(H.lastBlob));
  ok(/^Tasks-Sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(H.lastDownload) && file.format === "tasks-backup" && file.version === 1 && file.exportedAt, "Export: Datei " + H.lastDownload + " mit Format, Version, Datum");
  ok(Object.keys(file.data).length === 5 && file.data["T:ccc"].h === "08:30" && file.data["T:ccc"].n === "Notiz", "Export enthält alle 2 Listen + 3 Aufgaben vollständig");
  ok(/2 Listen, 3 Aufgaben/.test($("toastText").textContent) && $("toastUndo").hidden, "Hinweis ohne „Rückgängig“-Knopf");
  const backupText = JSON.stringify(file);
  const original = snapshot();
  // one task gone, a new one added
  await sync.remove("T:aaa"); await sync.set({ "T:neu": { l: "default", t: "Neu seit Export", o: -1 } }); await tick();
  await pick("sicherung.json", backupText);
  ok($("importDlg").open && /2 Listen, 3 Aufgaben/.test($("importInfo").textContent) && /vom/.test($("importInfo").textContent), "Import-Popup zeigt Inhalt und Datum");
  const paras = [...$("importDlg").querySelectorAll("p.import-opt")];
  ok(paras.map((p) => p.dataset.opt).join() === "merge,replace" && /^Zusammenführen:/.test(paras[0].textContent) && /^Alles ersetzen:/.test(paras[1].textContent), "eigene Absätze für Zusammenführen und Alles ersetzen");
  ok($("importMerge").dataset.opt === "merge" && $("importReplace").dataset.opt === "replace", "jeder Knopf gehört zu seinem Absatz (gleiches data-opt)");
  $("importMerge").click(); await tick();
  ok(!$("importDlg").open && T("Beispiel-Aufgabe") && T("Neu seit Export"), "Zusammenführen: Gelöschtes zurück, Neues bleibt");
  // replace
  await pick("sicherung.json", backupText);
  $("importReplace").click(); await tick();
  ok(snapshot() === original && !T("Neu seit Export"), "Alles ersetzen: exakt der Stand der Sicherung");
  await bodyKey("z", { ctrlKey: true });
  ok(T("Neu seit Export") && T("Beispiel-Aufgabe"), "Strg+Z macht das Ersetzen rückgängig");
  // rescue file (plain format) + foreign entries
  await sync.remove("T:bbb"); await tick();
  await pick("Tasks-Sicherung-2026-10-17.json", JSON.stringify({ ...file.data, "tk:apiKey": "x", "T:../böse": { t: "x" }, "T:zzz": "kein Objekt" }));
  ok(/2 Listen, 3 Aufgaben/.test($("importInfo").textContent), "einfaches Format angenommen, fremde/ungültige Einträge ignoriert");
  $("importMerge").click(); await tick();
  ok(T("nat Info") && !sync.data["tk:apiKey"] && !Object.keys(sync.data).some((k) => k.includes("böse")), "Rettungsdatei eingespielt, nichts Fremdes gespeichert");
  // broken files
  await pick("kaputt.json", "{ nicht json");
  ok(!$("importDlg").open && /keine gültige JSON-Datei/.test($("banner").textContent), "kein JSON → Meldung");
  await pick("leer.json", JSON.stringify({ foo: 1 }));
  ok(!$("importDlg").open && /keine Listen oder Aufgaben/.test($("banner").textContent), "ohne Aufgaben → Meldung");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
