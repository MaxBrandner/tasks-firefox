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
const MARKS = vm.runInContext("MARK_STYLE", bg);

const page = new JSDOM(`<!DOCTYPE html><html><head><meta name="description" content="Jahrestage 2026"><style>a, b, span { display: inline; }</style></head><body>
  <header><h1>Termine 2026</h1></header>
  <main><h3>Termine April 2026</h3><ul>
    <li>21.04.2026 - 100. Geburtstag Elisabeth II.</li>
    <li>29.04.2026 - 75. Todestag Ludwig Wittgenstein</li></ul>
  <p id="intro">Mehr unter <a href="/mai">Termine Mai</a> und <a href="https://example.org/juni">Juni</a>.</p></main></body></html>`,
  { runScripts: "outside-only", url: "https://www.sonntagsblatt.de/termine-2026" });
const w = page.window;
w.CSS = { escape: (s) => String(s).replace(/[^\w-]/g, (c) => "\\" + c) }; // Firefox has CSS.escape, jsdom not
const run = (fn, args) => w.eval(`(${bg[fn]})(${JSON.stringify(args)}, ${bg.cssPathInPage}, ${bg.textSpotInPage}, ${bg.unitOfInPage})`);
w.Range.prototype.getClientRects = () => [{ left: 1, top: 1, right: 40, bottom: 12, width: 39, height: 11 }]; // jsdom has no layout
w.Range.prototype.getBoundingClientRect = () => ({ left: 1, top: 1, right: 40, bottom: 12, width: 39, height: 11 });
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
// part of a paragraph: kept as a spot that finds exactly this text again
const part = w.document.createRange(); part.setStart(p.firstChild, 5); part.setEnd(p.querySelector("a").firstChild, 7);
w.getSelection().addRange(part);
out = run("captureInPage", { targetId: null, srcUrl: "", limits });
const back = w.eval(`(${bg.rangeFromSpotInPage})(${JSON.stringify(out.spot)})`);
ok(out.spot && out.spot.start === 5 && back && back.toString() === "unter Termine", "Markierung als Stelle gemerkt, findet genau diesen Text wieder: »" + (back && back.toString()) + "«");
w.getSelection().removeAllRanges();

// highlight overlay
const found = run("highlightInPage", { locator: "body > main > ul > li:nth-of-type(2)", style: STYLE, ms: 50, scroll: false });
const box = w.document.getElementById("tasks-ext-highlight");
ok(found === true && box && /→ Tasks/.test(box.textContent) && /pointer-events:\s*none/.test(box.getAttribute("style")), "Overlay „→ Tasks“ liegt über der Stelle, ohne Klicks abzufangen");
ok(w.document.querySelectorAll("li")[1].getAttribute("style") === null, "die Seite selbst bleibt unverändert");
ok(run("highlightInPage", { locator: "body > nav > li", style: STYLE, ms: 50, scroll: false }) === false, "Stelle nicht (mehr) da → false, kein Fehler");

// marks of the Bezug: stay until the list changes
const marks = (items, off = false) => w.eval(`(${bg.marksInPage})(${JSON.stringify({ style: MARKS, items, off })}, ${bg.rangeFromSpotInPage})`);
const badges = () => (w.__tasksMarks ? [...w.document.documentElement.querySelectorAll(":scope > div span")].map((b) => b.textContent).join() : "");
ok(marks([{ locator: "body > main > ul > li:nth-of-type(1)", n: 2 }, { locator: "body > nav", n: 3 }, { locator: "::kaputt", n: 4 }]) === 1 && badges() === "2", "Markierung bleibt mit der Nummer aus dem Chat; fehlende oder kaputte Stelle wird übersprungen");
marks([{ locator: "body > main > ul > li:nth-of-type(2)", n: 1 }]);
ok(badges() === "1" && w.document.documentElement.querySelectorAll(":scope > div").length === 1, "neue Liste ersetzt die alten Markierungen");
w.__tasksMarks.hide();
ok(w.document.documentElement.querySelector(":scope > div").style.display === "none", "fürs Bild ausblendbar");
ok(marks([]) === 0 && w.__tasksMarks && !w.document.documentElement.querySelector(":scope > div"), "leere Liste entfernt alle Markierungen (die Tasten bleiben für Strg+Z)");
ok(marks([], true) === 0 && !w.__tasksMarks, "Seitenleiste zu → auch die Tasten sind weg");
const li3 = w.document.querySelectorAll("li")[1];
let liTop = 100;
li3.getBoundingClientRect = () => ({ left: 10, top: liTop, right: 200, bottom: liTop + 20, width: 190, height: 20 });
marks([{ locator: "body > main > ul > li:nth-of-type(2)", n: 1 }]);
const piece = () => w.document.documentElement.querySelector(":scope > div div div");
const topBefore = piece().style.top;
liTop = 40; // a scrolling box inside the page moved it
w.document.querySelector("main").dispatchEvent(new w.Event("scroll"));
ok(topBefore === "97px" && piece().style.top === "37px", "Scrollen (auch in einem Kasten der Seite) zieht die Markierung mit");
delete li3.getBoundingClientRect;
ok(marks([{ locator: "#intro", start: 5, end: 18, n: 4 }]) === 1 && badges() === "4" && new RegExp("rgba\\(47, ?111, ?94, ?0?\\.27\\)").test(w.document.documentElement.querySelector(":scope > div div div").getAttribute("style")), "markierter Text: Textmarker-Look mit Nummer");
marks([]);

// element picker: dashed blocks, click on/off, Shift+click, Alt+drag text
const sent = [];
w.browser = { runtime: { sendMessage: async (m) => { sent.push(m); } } };
const PICK = vm.runInContext("PICK_STYLE", bg);
ok(run("pickerInPage", { style: PICK }).ok === true, "Picker startet auf der Seite");
const top = () => [...w.document.documentElement.children];
ok(top().some((c) => c.tagName === "STYLE" && /crosshair/.test(c.textContent)), "Fadenkreuz als Zeiger");
const lis = w.document.querySelectorAll("li");
const mouse = (type, el, o = {}) => { const ev = new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...o }); el.dispatchEvent(ev); return ev; };
const click = (el, o) => { mouse("mousedown", el, o); mouse("mouseup", el, o); return mouse("click", el, o); };
const lastPick = () => sent.filter((m) => m.type === "picker-pick").pop();
mouse("mousemove", lis[0]);
const layer = top().find((c) => c.tagName === "DIV");
ok([...layer.children].some((b) => b.style.display === "block"), "Darüberfahren: Block leuchtet auf");
click(lis[0]);
ok(lastPick().op === "toggle" && lastPick().items.length === 1 && lastPick().items[0].text === "21.04.2026 - 100. Geburtstag Elisabeth II." && w.document.querySelector(lastPick().items[0].locator) === lis[0], "Klick: Block an/aus – Text und Pfad gehen an die Seitenleiste");
click(lis[1], { shiftKey: true });
const span = lastPick().items.map((i) => w.document.querySelector(i.locator));
ok(lastPick().op === "add" && span.length === 2 && span[0] === lis[0] && span[1] === lis[1], "Umschalt+Klick: alles vom letzten bis hier");
const link = w.document.querySelector("#intro a");
const linkClick = click(link);
ok(linkClick.defaultPrevented && w.document.querySelector(lastPick().items[0].locator) === w.document.getElementById("intro"), "Klick auf einen Link öffnet ihn nicht; gewählt wird der Absatz darum");
const intro = w.document.getElementById("intro");
const words = w.document.createRange(); words.setStart(intro.firstChild, 0); words.setEnd(intro.firstChild, 10);
const down = mouse("mousedown", intro, { altKey: true });
w.getSelection().removeAllRanges(); w.getSelection().addRange(words);
mouse("mouseup", intro, { altKey: true });
const tp = lastPick().items[0];
ok(!down.defaultPrevented && lastPick().op === "add" && tp.text === "Mehr unter" && tp.start === 0 && tp.end === 10 && w.document.querySelector(tp.locator) === intro && /Termine Mai/.test(tp.context) && !w.getSelection().rangeCount, "Alt+Ziehen: markierter Text geht als eigene Stelle mit seinem Absatz");
marks([{ locator: "#intro", start: 0, end: 10, n: 1 }]);
mouse("mousemove", intro, { clientX: 5, clientY: 5 });
click(intro, { clientX: 5, clientY: 5 });
const un = lastPick();
ok(un.op === "toggle" && un.items.length === 1 && un.items[0].locator === "#intro" && un.items[0].start === 0 && un.items[0].end === 10 && un.items[0].text === "Mehr unter", "Klick auf markierten Text nimmt genau diesen Text wieder raus (nicht den Absatz)");
const key = (k, o = {}, el = w.document.body) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o }));
const types = () => sent.slice(-1)[0].type;
key("z", { ctrlKey: true });
ok(types() === "marks-undo", "Strg+Z im Picker → ein Schritt zurück");
let n0 = sent.length;
key("Escape");
ok(sent.length === n0 + 1 && types() === "picker-end", "erstes Esc beendet nur den Picker");
key("Escape");
ok(sent.length === n0 + 2 && types() === "marks-clear", "zweites Esc nimmt alle Markierungen der Seite raus");
key("y", { ctrlKey: true });
ok(types() === "marks-redo", "Strg+Y → wieder");
const field = w.document.createElement("input");
w.document.body.append(field);
n0 = sent.length;
key("z", { ctrlKey: true }, field);
key("Escape", {}, field);
ok(sent.length === n0, "in Eingabefeldern bleiben Strg+Z und Esc bei der Seite");
field.remove();
marks([]);
n0 = sent.length;
key("Escape");
ok(sent.length === n0, "ohne Markierungen gehört Esc der Seite");
ok(run("pickerInPage", { style: PICK }).ok === true, "Picker wieder an");
const before = sent.length;
w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
ok(sent.length === before + 1 && sent[sent.length - 1].type === "picker-end" && !w.__tasksPicker && !top().some((c) => c.tagName === "STYLE" || c.tagName === "DIV"), "Enter beendet den Picker, Overlays und Zeiger weg");
click(lis[1]);
ok(sent.length === before + 1, "danach reagiert die Seite wieder normal (kein Picker mehr)");

setTimeout(() => {
  ok(!w.document.getElementById("tasks-ext-highlight"), "Overlay verschwindet nach der Zeit wieder");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
}, 700);
