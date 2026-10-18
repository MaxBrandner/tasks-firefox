// Run: npm test (all) or npm test <name>
// The page scripts of "Zu Tasks hinzufügen" (background.js: captureInPage,
// highlightInPage) inside a real test page (jsdom).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const ROOT = path.resolve(__dirname, "..");
let fails = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const stub = new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : stub), apply: () => stub });
const bg = vm.createContext({ browser: stub, console, URL, setTimeout, clearTimeout, crypto: globalThis.crypto });
vm.runInContext(fs.readFileSync(path.join(ROOT, "background.js"), "utf8"), bg);
const STYLE = vm.runInContext("HIGHLIGHT_STYLE", bg); // const: not a property of the context

const page = new JSDOM(`<!DOCTYPE html><html><head><meta name="description" content="Jahrestage 2026"></head><body>
  <header><h1>Termine 2026</h1></header>
  <main><h3>Termine April 2026</h3><ul>
    <li>21.04.2026 - 100. Geburtstag Elisabeth II.</li>
    <li>29.04.2026 - 75. Todestag Ludwig Wittgenstein</li></ul>
  <p id="intro">Mehr unter <a href="/mai">Termine Mai</a> und <a href="https://example.org/juni">Juni</a>.</p></main></body></html>`,
  { runScripts: "outside-only", url: "https://www.sonntagsblatt.de/termine-2026" });
const w = page.window;
w.CSS = { escape: (s) => String(s).replace(/[^\w-]/g, (c) => "\\" + c) }; // Firefox has CSS.escape, jsdom not
const run = (fn, args) => w.eval(`(${bg[fn]})(${JSON.stringify(args)})`);
const limits = { selection: 20000, section: 4000, clicked: 600, links: 50 };
const li = w.document.querySelectorAll("li")[0];

// right-click on one line, no selection
w.browser = { menus: { getTargetElement: (id) => (id === 7 ? li : null) } };
let out = run("captureInPage", { targetId: 7, srcUrl: "", limits });
ok(out.clicked === "21.04.2026 - 100. Geburtstag Elisabeth II.", "angeklickte Stelle = genau die Zeile");
ok(out.heading === "Termine April 2026" && out.description === "Jahrestage 2026", "Überschrift davor und Seitenbeschreibung");
ok(out.locator && w.document.querySelector(out.locator) === li, "Pfad findet genau diese Zeile wieder: " + out.locator);

// selection with links in it
const p = w.document.getElementById("intro");
const range = w.document.createRange(); range.selectNodeContents(p);
w.getSelection().removeAllRanges(); w.getSelection().addRange(range);
out = run("captureInPage", { targetId: null, srcUrl: "", limits });
ok(out.links.map((l) => l.href).join() === "https://www.sonntagsblatt.de/mai,https://example.org/juni", "Links in der Markierung mit vollständiger Adresse");
ok(w.document.querySelector(out.locator) === p, "bei Markierung: Pfad zum umschließenden Block (#intro)");
w.getSelection().removeAllRanges();

// highlight overlay
const found = run("highlightInPage", { locator: "body > main > ul > li:nth-of-type(2)", style: STYLE, ms: 50, scroll: false });
const box = w.document.getElementById("tasks-ext-highlight");
ok(found === true && box && /→ Tasks/.test(box.textContent) && /pointer-events:\s*none/.test(box.getAttribute("style")), "Overlay „→ Tasks“ liegt über der Stelle, ohne Klicks abzufangen");
ok(w.document.querySelectorAll("li")[1].getAttribute("style") === null, "die Seite selbst bleibt unverändert");
ok(run("highlightInPage", { locator: "body > nav > li", style: STYLE, ms: 50, scroll: false }) === false, "Stelle nicht (mehr) da → false, kein Fehler");

setTimeout(() => {
  ok(!w.document.getElementById("tasks-ext-highlight"), "Overlay verschwindet nach der Zeit wieder");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
}, 700);
