// Moving tasks: drag & drop (incl. below the whole list) and Alt+↑/↓.
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT);
const { w, d, ok, T, li, edit, key, type, add, unfocus, idOf, rootTitles, kids, tick } = H;

// jsdom has no DragEvent: a plain event with the fields the sidebar reads.
const fire = (el, name, o = {}) => {
  const e = new w.Event(name, { bubbles: true, cancelable: true });
  Object.assign(e, { clientX: 0, clientY: 0, dataTransfer: { setData() {}, types: [] }, ...o });
  el.dispatchEvent(e);
  return e;
};
const drag = async (t, over, o) => {
  const src = li(t);
  fire(src.querySelector(":scope > .row .grip"), "pointerdown");
  fire(src, "dragstart");
  const ev = fire(over, "dragover", o);
  const markEl = d.querySelector(".drop-before, .drop-after, .drop-inside, .drop-end");
  const mark = markEl && markEl.className;
  fire(over, "drop", o);
  fire(src, "dragend");
  await tick();
  return { allowed: ev.defaultPrevented, mark };
};

(async () => {
  await tick();
  await add("A"); await add("B"); await add("C"); await unfocus();
  let ta = await key(edit("A"), "Enter"); await type(ta, "A1"); await key(ta, "Tab"); await unfocus();
  ok(rootTitles().join() === "C,B,A" && kids("A").join() === "A1", "Ausgangslage: C, B, A mit A1");

  // In jsdom every rect is 0, so the empty space of the scroll area counts as "below the last task".
  let r = await drag("C", d.getElementById("main"), { clientY: 50 });
  ok(r.allowed && /drop-end/.test(r.mark), "unter allem: Markierung am Listenende");
  ok(rootTitles().join() === "B,A,C" && !T("C").p, "unter allem loslassen → ganz unten, oberste Ebene");

  r = await drag("A1", d.getElementById("main"), { clientY: 50 });
  ok(rootTitles().join() === "B,A,C,A1" && !T("A1").p, "Unteraufgabe unter allem → wird oberste Ebene, ganz unten");

  r = await drag("A1", d.getElementById("addBtn"), { clientY: 50 });
  ok(!r.allowed && !r.mark && rootTitles().join() === "B,A,C,A1", "außerhalb der Liste: keine Markierung, nichts passiert");

  await key(edit("B"), "ArrowDown", { altKey: true });
  ok(rootTitles().join() === "A,B,C,A1", "Alt+↓ verschiebt oberste Ebene");
  await key(d.activeElement, "ArrowUp", { altKey: true });
  ok(rootTitles().join() === "B,A,C,A1" && d.activeElement.closest("li.task") === li("B"), "Alt+↑ zurück, Fokus bleibt");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
