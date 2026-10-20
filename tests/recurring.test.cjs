// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const iso = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
const soon = new Date(Date.now() + 26 * 3600e3);
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "T:a1": { l: "default", t: "LinA", o: 0 },
  "T:b1": { l: "default", p: "a1", t: "Blatt 1", d: iso(day(-1)), h: "08:30", r: "w", s: "b1", o: 0 },
  "T:c1": { l: "default", t: "Bald", d: iso(soon), h: pad(soon.getHours()) + ":" + pad(soon.getMinutes()), o: -1 },
});
const { d, ok, T, li, edit, bodyKey, unfocus, idOf, sync, tick } = H;
const chipText = (t) => li(t).querySelector(":scope>.row .due .due-label")?.textContent;
(async () => {
  await tick(); await tick();
  const nextId = "b1-" + iso(day(6)).replace(/-/g, "");
  ok(sync.data["T:b1"] && !sync.data["T:b1"].r && !sync.data["T:b1"].x, "Vorwoche „Blatt 1“ bleibt stehen (offen, ohne Wiederholung)");
  const n = sync.data["T:" + nextId];
  ok(n && n.t === "Blatt 2" && n.r === "w" && n.p === "a1" && n.d === iso(day(6)) && n.h === "08:30", "„Blatt 2“ eine Woche später: " + JSON.stringify(n));
  ok(chipText("Blatt 1") === "überfällig · Gestern, 08:30" && li("Blatt 1").querySelector(".due").classList.contains("overdue"), "Vorwoche: " + chipText("Blatt 1"));
  ok(/^noch 1 T [12] Std$/.test(chipText("Bald")) && li("Bald").querySelector(".due").classList.contains("soon"), "Countdown < 48 h: " + chipText("Bald"));
  ok(!chipText("Blatt 2").startsWith("noch") && chipText("Blatt 2").endsWith(", 08:30") && !!li("Blatt 2").querySelector(".due .ico"), "Blatt 2 (6 Tage): " + chipText("Blatt 2") + " mit ↻");
  edit("Bald"); await tick();
  const timeIn = li("Bald").querySelector('.details .time-input');
  timeIn.value = "23:45"; timeIn.dispatchEvent(new H.w.Event("change")); await tick();
  ok(T("Bald").h === "23:45", "Uhrzeit-Feld speichert");
  li("Bald").querySelector('.details .chip[aria-label="Wöchentlich wiederholen"]').click(); await tick();
  ok(T("Bald").r === "w" && T("Bald").s === idOf("Bald"), "Knopf „Wöchentlich“ schaltet ein");
  await unfocus();
  const before = Object.keys(sync.data).length;
  li("Bald").querySelector(":scope>.row .check").click(); await tick();
  ok(Object.keys(sync.data).length === before && T("Bald").x && T("Bald").r === "w", "früh abgehakt → nächste Woche erst zum Fälligkeitstermin");
  await bodyKey("z", { ctrlKey: true });
  ok(Object.keys(sync.data).length === before && T("Bald").r === "w" && !T("Bald").x, "Strg+Z nimmt Abhaken zurück");
  edit("Bald"); await tick();
  li("Bald").querySelector('.details .icon-btn.small[title="Datum entfernen"]').click(); await tick();
  ok(!T("Bald").d && !T("Bald").h && !T("Bald").r, "Datum entfernen → Uhrzeit + Wiederholung weg");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
