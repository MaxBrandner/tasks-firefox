// Folding blocks: bar, count, Ctrl+↑/↓, menu, unfolding when something goes in.
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT);
const { w, d, ok, T, li, edit, key, type, add, unfocus, idOf, rootTitles, kids, tick, local } = H;

const bar = (t) => li(t).querySelector(":scope > .fold-bar");
const count = (t) => { const c = li(t).querySelector(":scope > .row .fold-count:not(.progress)"); return c && c.textContent; };
const menu = async (action) => { d.querySelector(`#listMenu [data-action="${action}"]`).click(); await tick(); };
const fire = (el, name, o = {}) => {
  const e = new w.Event(name, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: 0, clientY: 0, dataTransfer: { setData() {}, types: [] }, ...o });
  el.dispatchEvent(e);
};

(async () => {
  await tick();
  await add("A"); await add("B"); await unfocus();
  let ta = await key(edit("A"), "Enter"); await type(ta, "A1"); await key(ta, "Tab");
  ta = await key(ta, "Enter"); await type(ta, "A2"); await unfocus();
  li("A2").querySelector(":scope > .row .check").click(); await tick();
  ok(kids("A").join() === "A1,A2" && bar("A") && !bar("B"), "Leiste nur an Aufgaben mit Unteraufgaben");

  bar("A").click(); await tick();
  ok(!li("A").querySelector(".subtasks") && li("A").classList.contains("folded"), "Klick auf die Leiste klappt ein");
  ok(count("A") === "1/2", "eingeklappt: Fortschritt wie ausgeklappt");
  ok((local.data["tk:collapsed"] || []).includes(idOf("A")), "Zustand liegt in storage.local (pro Gerät)");
  li("A").querySelector(":scope > .row .fold-count").click(); await tick();
  ok(kids("A").join() === "A1,A2" && !count("A"), "Klick auf die Zahl klappt auf");

  ta = edit("A1"); await key(ta, "ArrowUp", { ctrlKey: true });
  ok(li("A").classList.contains("folded") && d.activeElement.closest("li.task") === li("A"), "Strg+↑ in Unteraufgabe klappt den Block ein, Cursor im Block");
  ok(count("A") === "1/2", "Zahl erscheint auch beim Einklappen per Tastatur (während der Titel bearbeitet wird)");
  ta = await key(d.activeElement, "ArrowDown", { ctrlKey: true });
  ok(!li("A").classList.contains("folded") && d.activeElement.closest("li.task") === li("A"), "Strg+↓ klappt auf, Cursor bleibt");
  await key(d.activeElement, "ArrowUp", { ctrlKey: true });

  ta = await key(d.activeElement, "Enter"); await type(ta, "N");
  ok(!T("N").p && T("N").o > T("A").o && T("B").o < T("A").o, "Enter auf eingeklapptem Block: neue Zeile darunter, nicht hinein");
  ok(d.activeElement.closest("li.task") === li("N"), "Cursor in der neuen Zeile");
  ok(await key(d.activeElement, "ArrowUp") && d.activeElement.closest("li.task") === li("A") && await key(d.activeElement, "ArrowDown") && d.activeElement.closest("li.task") === li("N"), "↑/↓ überspringen eingeklappte Unteraufgaben");
  await key(d.activeElement, "Tab");
  // A2 is checked and hidden by now (the caret left block A).
  ok(T("N").p === idOf("A") && kids("A").join() === "A1,N", "Tab in eingeklappten Block klappt ihn auf");
  await unfocus();

  await menu("foldAll");
  ok(li("A").classList.contains("folded"), "⋯ → Alle einklappen");
  await menu("unfoldAll");
  ok(!li("A").classList.contains("folded"), "⋯ → Alle ausklappen");

  bar("A").click(); await tick();
  fire(li("B").querySelector(":scope > .row .grip"), "pointerdown"); fire(li("B"), "dragstart");
  fire(li("A").querySelector(":scope > .row .title .md-view"), "dragover", { clientY: 5, clientX: 0 });
  const after = !!li("A").querySelector(":scope > .row.drop-after");
  fire(li("A"), "drop"); fire(li("B"), "dragend"); await tick();
  ok(after && !T("B").p && rootTitles().join() === "A,B", "eingeklappt: untere Hälfte links = hinter den Block");
  fire(li("B").querySelector(":scope > .row .grip"), "pointerdown"); fire(li("B"), "dragstart");
  fire(li("A").querySelector(":scope > .row .title .md-view"), "dragover", { clientY: 5, clientX: 500 });
  fire(li("A"), "drop"); fire(li("B"), "dragend"); await tick();
  ok(T("B").p === idOf("A") && !li("A").classList.contains("folded"), "hinein ablegen klappt auf");

  // Spring-loading: hovering a folded block while dragging opens it; it folds
  // again unless the task ended up inside.
  const seed = { "L:default": { t: "Liste", o: 0 },
    "T:x": { l: "default", t: "X", o: 0 }, "T:x1": { l: "default", p: "x", t: "X1", o: 0 },
    "T:y": { l: "default", t: "Y", o: 1 }, "T:y1": { l: "default", p: "y", t: "Y1", o: 0 },
    "T:z": { l: "default", t: "Z", o: 2 } };
  const S = require("./harness.cjs")(ROOT, seed, { local: { "tk:collapsed": ["x", "y"] } });
  await S.tick();
  const sfire = (el, name, o = {}) => {
    const e = new S.w.Event(name, { bubbles: true, cancelable: true });
    Object.assign(e, { clientX: 0, clientY: 5, dataTransfer: { setData() {}, types: [] }, ...o });
    el.dispatchEvent(e);
  };
  const row = (t) => S.li(t).querySelector(":scope > .row .title .md-view");
  const start = () => { sfire(S.li("Z").querySelector(":scope > .row .grip"), "pointerdown"); sfire(S.li("Z"), "dragstart"); };
  const hover = async (t, ms) => { sfire(row(t), "dragover"); await new Promise((r) => setTimeout(r, ms)); };
  const folded = (t) => S.li(t).classList.contains("folded");
  start(); await hover("X", 300); sfire(row("Y"), "dragover");
  ok(folded("X"), "kurz drüber: bleibt zu");
  await hover("X", 800);
  ok(!folded("X") && S.kids("X").join() === "X1" && !!S.li("Z"), "länger drüber: klappt auf, gezogene Zeile bleibt");
  sfire(row("Y"), "dragover"); sfire(row("Y"), "drop"); sfire(S.li("Z"), "dragend"); await S.tick();
  ok(folded("X") && S.T("Z").p !== "x" && S.rootTitles().join() === "X,Y,Z", "woanders abgelegt: geht wieder zu");
  start(); await hover("X", 800); sfire(S.li("Z"), "dragend"); await S.tick();
  ok(folded("X"), "Ziehen abgebrochen: geht wieder zu");
  start(); await hover("X", 800); sfire(row("X1"), "dragover"); sfire(row("X1"), "drop"); sfire(S.li("Z"), "dragend"); await S.tick();
  ok(S.T("Z").p === "x" && !folded("X") && S.kids("X").join() === "X1,Z", "hinein abgelegt: bleibt offen");

  const H2 = require("./harness.cjs")(ROOT, H.sync.data, { local: { "tk:collapsed": [idOf("A")] } });
  await H2.tick();
  ok(H2.li("A").classList.contains("folded") && !H2.li("A").querySelector(".subtasks"), "eingeklappt bleibt nach Neustart");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
