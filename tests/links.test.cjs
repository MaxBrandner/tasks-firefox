// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const iso = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
const ILIAS = "https://ilias.hhu.de/ilias.php?baseClass=ilexercisehandlergui&ass_id=74843";
const H = require("./harness.cjs")(ROOT, {
  "L:uni": { t: "Uni", o: 0 },
  "T:dl": { l: "uni", t: "**DL**", o: 0 },
  "T:b1": { l: "uni", p: "dl", t: "Blatt", n: "Notiz oben\n[Zur Seite](" + ILIAS + ")", o: 0 },
  "T:fo": { l: "uni", p: "dl", t: "Folien", u: [{ url: "https://ilias.hhu.de/folien", t: "Folien" }], o: 1 },
  "T:pr": { l: "uni", p: "dl", t: "Präsenz", u: [{ url: "https://ilias.hhu.de/folien", t: "doppelt" }], o: 2 },
  "T:wk": { l: "uni", t: "Blatt 1", d: iso(day(-1)), h: "08:30", r: "w", s: "wk", u: [{ url: "https://x.de/blatt1", t: "Abgabe" }], o: 1 },
});
const { d, ok, tick, sync, li, edit, bodyKey } = H;
const chip = (t) => li(t).querySelector(":scope > .row .links-chip");
(async () => {
  await tick(); await tick();
  const b1 = sync.data["T:b1"];
  ok(b1.n === "Notiz oben" && b1.u && b1.u[0].url === ILIAS && b1.u[0].t === "ilias.hhu.de", "alte „Zur Seite“-Zeile ist ins Link-Feld gewandert");
  ok(chip("Blatt") && !chip("Blatt").textContent.trim(), "Blatt: 🔗 ohne Zahl (ein Link)");
  ok(chip("**DL**") && chip("**DL**").textContent === "2", "DL zeigt 🔗 2 (Links der Unteraufgaben, ohne Doppelte)");
  chip("**DL**").click(); await tick(); await tick();
  ok(H.tabsOpened.length === 2 && H.tabsOpened.every((o) => o.active === false) && H.grouped.length === 2 && H.groupTitle === "DL", "DL: 2 Tabs als Tab-Gruppe „DL“ (Titel ohne Markdown)");
  H.tabsOpened = [];
  chip("Blatt").click(); await tick();
  ok(H.tabsOpened.length === 1 && H.tabsOpened[0].url === ILIAS && H.tabsOpened[0].active, "ein Link → ein Tab, keine Gruppe");
  // edit mode: add / remove a link
  edit("Blatt"); await tick();
  let input = li("Blatt").querySelector(".details .link-add");
  ok(li("Blatt").querySelectorAll(".details .link-chip").length === 1 && input, "Details: Link-Chip + Feld „+ Link einfügen“");
  input.value = "ilias.hhu.de/blatt02.pdf";
  input.dispatchEvent(new H.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await tick();
  ok(sync.data["T:b1"].u.length === 2 && sync.data["T:b1"].u[1].url === "https://ilias.hhu.de/blatt02.pdf" && d.activeElement.classList.contains("link-add"), "Link ohne https:// ergänzt, Feld bleibt bereit");
  input = li("Blatt").querySelector(".details .link-add");
  input.value = "javascript:alert(1)";
  input.dispatchEvent(new H.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); await tick();
  ok(sync.data["T:b1"].u.length === 2 && input.classList.contains("invalid"), "javascript: wird abgelehnt");
  ok(li("Blatt").querySelector(".details .link-btn") && li("Blatt").querySelector(".details .link-btn").textContent === "Alle öffnen", "„Alle öffnen“ bei mehreren Links");
  li("Blatt").querySelectorAll(".details .link-x")[1].click(); await tick();
  ok(sync.data["T:b1"].u.length === 1, "Link entfernen");
  d.getElementById("main").click(); await tick();
  await bodyKey("z", { ctrlKey: true });
  ok(sync.data["T:b1"].u.length === 2, "Strg+Z holt den entfernten Link zurück");
  // weekly: new instance without links
  const next = Object.entries(sync.data).find(([k, v]) => k.startsWith("T:wk-"));
  ok(next && next[1].t === "Blatt 2" && !next[1].u && sync.data["T:wk"].u.length === 1, "nächste Woche ohne die Links der Vorwoche");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
