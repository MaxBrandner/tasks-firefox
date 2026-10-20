// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const fs = require("fs"); const vm = require("vm");
const P = ROOT;
const setup = require("./harness.cjs");
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const tick = () => new Promise((r) => setTimeout(r, 30));
(async () => {
  // --- real sidebar
  const R = setup(P);
  await tick(); await tick();
  const bar = R.d.getElementById("envBanner");
  ok(bar.hidden && R.pings >= 1, "echt, DEV nicht geladen: kein Balken (Abfrage lief)");
  R.devReply = async (id, msg) => (id === "tasks-dev@brandner.name" && msg.type === "tasks-ping" ? { ok: true, dev: true } : undefined);
  R.w.dispatchEvent(new R.w.Event("focus")); await tick();
  ok(!bar.hidden && /„Tasks DEV“ ist gerade auch geladen/.test(bar.textContent) && !bar.classList.contains("dev") && bar.querySelector("svg"), "DEV geladen → Warnbalken in der echten Seitenleiste");
  R.devReply = null;
  R.w.dispatchEvent(new R.w.Event("focus")); await tick();
  ok(bar.hidden, "DEV entfernt → Balken verschwindet");
  // --- test copy
  const D = setup(P, {}, { runtimeId: "tasks-dev@brandner.name" });
  await tick(); await tick();
  const dbar = D.d.getElementById("envBanner");
  ok(!dbar.hidden && dbar.classList.contains("dev") && /^DEV · Test-Kopie/.test(dbar.textContent) && !D.pings, "Test-Kopie: dauerhafter DEV-Balken, fragt nicht an");
  // --- test copy brings its test data (dev/dev-testdata.json from npm run dev)
  const seed = (fresh) => ({ format: "tasks-backup", fresh, data: {
    "L:testl": { t: "Test: Uni", o: 9 }, "T:testt": { l: "testl", t: "Blatt 1", o: 0 }, "X:evil": { t: "nein" } } });
  const reply = (fresh) => async () => ({ json: async () => seed(fresh) });
  const DEV = "tasks-dev@brandner.name";
  let S = setup(P, {}, { runtimeId: DEV, fetchReply: reply("") });
  await tick(); await tick();
  ok(S.sync.data["T:testt"] && S.sync.data["L:testl"] && !S.sync.data["X:evil"] && S.local.data["tk:devSeed"].keys.length === 2, "leer → Testdaten von selbst eingespielt (nur Listen/Aufgaben)");
  ok([...S.d.querySelectorAll("#openList .title .md-view")].some((e) => e.textContent === "Blatt 1") || S.d.getElementById("listSelect").textContent.includes("Test: Uni"), "gleich sichtbar, ohne Neuöffnen");
  S = setup(P, { "T:testt": { l: "testl", t: "geändert", o: 0 } }, { runtimeId: DEV, fetchReply: reply("") });
  await tick(); await tick();
  ok(S.sync.data["T:testt"].t === "geändert" && S.sync.data["L:testl"], "schon da → nicht überschrieben, Fehlendes ergänzt");
  S = setup(P, { "T:testt": { l: "testl", t: "geändert", o: 0 } }, { runtimeId: DEV, fetchReply: reply(""), local: { "tk:devSeed": { fresh: "", keys: ["L:testl", "T:testt"] } } });
  await tick(); await tick();
  ok(!S.sync.data["L:testl"], "einmal genommen und gelöscht → kommt nicht wieder");
  S = setup(P, { "T:testt": { l: "testl", t: "geändert", o: 0 } }, { runtimeId: DEV, fetchReply: reply("2026-10-20T10:00"), local: { "tk:devSeed": "" } }); // old format (string)
  await tick(); await tick();
  ok(S.sync.data["T:testt"].t === "Blatt 1" && S.local.data["tk:devSeed"].fresh === "2026-10-20T10:00", "--fresh → ersetzt mit frischen Daten");
  S = setup(P, { "T:testt": { l: "testl", t: "geändert", o: 0 } }, { runtimeId: DEV, fetchReply: reply("2026-10-20T10:00"), local: { "tk:devSeed": { fresh: "2026-10-20T10:00", keys: ["L:testl", "T:testt"] } } });
  await tick(); await tick();
  ok(S.sync.data["T:testt"].t === "geändert", "dieselben frischen Daten nur einmal");
  S = setup(P, {}, { fetchReply: reply("") });
  await tick(); await tick();
  ok(!S.sync.data["T:testt"], "echte Version spielt nie Testdaten ein");

  // --- background: answers only the other Tasks ID; menu label
  for (const [id, expectTitle] of [["tasks@brandner.name", "Zu Tasks hinzufügen"], ["tasks-dev@brandner.name", "Zu Tasks DEV hinzufügen"]]) {
    let ext, menu;
    const area = () => ({ data: {}, async get() { return {}; }, async set() {} });
    const ctx = { console, crypto: globalThis.crypto, structuredClone, URL, browser: {
      storage: { sync: area(), local: area(), onChanged: { addListener() {} } },
      runtime: { id, onMessageExternal: { addListener(f) { ext = f; } }, onConnect: { addListener() {} }, onMessage: { addListener() {} } },
      browserAction: { onClicked: { addListener() {} } }, sidebarAction: {},
      contextMenus: { create(o) { menu = o; }, async removeAll() {}, onClicked: { addListener() {} } } } };
    vm.createContext(ctx); vm.runInContext(fs.readFileSync(P + "/background.js", "utf8"), ctx);
    await tick();
    const other = id === "tasks@brandner.name" ? "tasks-dev@brandner.name" : "tasks@brandner.name";
    const answer = await ext({ type: "tasks-ping" }, { id: other });
    const stranger = ext({ type: "tasks-ping" }, { id: "fremd@example.org" });
    ok(menu && menu.title === expectTitle && answer && answer.ok && answer.dev === (id !== "tasks@brandner.name") && stranger === undefined,
      `${id}: Menü „${menu && menu.title}“, antwortet der anderen Tasks-Kennung, nicht fremden Erweiterungen`);
  }
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
