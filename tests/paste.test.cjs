// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "T:a1": { l: "default", t: "Einkaufen", o: 0 },
});
const { d, ok, edit, tick } = H;
const $ = (id) => d.getElementById(id);
const cards = () => [...$("chatAttach").querySelectorAll(".att-name")].map((e) => e.textContent);
// Paste event as Firefox fires it: files plus whatever text the clipboard has.
const paste = async (target, files, text = "") => {
  const ev = new H.w.Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", { value: { files, getData: (t) => (t === "text/plain" ? text : "") } });
  target.dispatchEvent(ev);
  await new Promise((r) => setTimeout(r, 50)); await tick();
  return ev.defaultPrevented;
};
const png = () => new H.w.File(["\x89PNG"], "image.png", { type: "image/png" });
(async () => {
  await tick(); await tick();
  $("tabChat").click(); await tick();
  $("chatInput").focus();
  ok(await paste($("chatInput"), [png()]), "Bild im Chat-Feld eingefügt → Standard-Einfügen abgefangen");
  ok(cards().join() === "Bild aus der Zwischenablage.png", "Karte mit sprechendem Namen: " + cards().join());
  ok(!!$("chatAttach").querySelector(".att-thumb img"), "Bild bekommt eine Vorschau");
  ok(!(await paste($("chatInput"), [], "nur Text")) && cards().length === 1, "reiner Text bleibt normales Einfügen");
  $("chatAttach").querySelector(".att-x").click(); await tick();

  $("tabTasks").click(); await tick();
  const ta = edit("Einkaufen");
  ok(!(await paste(ta, [png()], "Milch")) && !cards().length, "im Aufgabenfeld mit Text in der Zwischenablage: Text geht ins Feld");
  ok(await paste(ta, [png()]) && cards().length === 1 && d.body.dataset.chat === "quick" && d.activeElement === $("chatInput"),
    "nur ein Bild im Aufgabenfeld → Chat geht auf, Bild hängt dran");
  const pdf = new H.w.File(["%PDF-1.4"], "Blatt4.pdf", { type: "application/pdf" });
  ok(await paste($("chatInput"), [pdf]) && cards().join() === "Bild aus der Zwischenablage.png,Blatt4.pdf", "kopierte Datei behält ihren Namen: " + cards().join());
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
