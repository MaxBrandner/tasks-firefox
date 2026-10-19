// Selection as in a file explorer: click selects, second click edits; keys act on all selected.
const ROOT = require("node:path").resolve(__dirname, "..");
const seed = { "L:default": { t: "Liste", o: 0 },
  "T:a": { l: "default", t: "A", o: 0 }, "T:a1": { l: "default", p: "a", t: "A1", o: 0 }, "T:a2": { l: "default", p: "a", t: "A2", o: 1 },
  "T:b": { l: "default", t: "B", o: 1 }, "T:c": { l: "default", t: "C", o: 2 }, "T:d": { l: "default", t: "D", o: 3 } };
const H = require("./harness.cjs")(ROOT, seed);
const { w, d, ok, T, li, key, bodyKey, rootTitles, kids, tick } = H;

const view = (t) => li(t).querySelector(":scope > .row .title .md-view");
const click = async (el, o = {}) => { el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, ...o })); await tick(); };
const sel = () => [...d.querySelectorAll("li.task.selected")].map((l) => l.querySelector(":scope > .row .title .md-view").textContent).join();
const k = (name, o) => key(d.activeElement, name, o);

(async () => {
  await tick();
  await click(view("B"));
  ok(sel() === "B" && !d.activeElement.matches("textarea"), "Klick auf den Titel wählt aus, ohne zu bearbeiten");
  await click(view("B"));
  ok(d.activeElement.matches("textarea") && d.activeElement.closest("li.task") === li("B") && !sel(), "zweiter Klick auf den Titel bearbeitet");
  await k("Escape");
  ok(sel() === "B" && d.activeElement.id === "main", "Esc beim Bearbeiten → zurück in die Auswahl");
  await k("Escape");
  ok(!sel(), "zweites Esc hebt die Auswahl auf");

  await click(li("C").querySelector(":scope > .row .main"));
  ok(sel() === "C", "Klick neben den Titel wählt aus");
  li("C").querySelector(":scope > .row").dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true }));
  await tick();
  ok(d.activeElement.matches("textarea") && d.activeElement.closest("li.task") === li("C"), "Doppelklick bearbeitet");
  await k("Escape");

  await k("ArrowUp"); ok(sel() === "B", "↑ wandert in der Auswahl");
  await k("ArrowUp"); ok(sel() === "A2", "↑ geht auch in Unteraufgaben");
  await k("ArrowLeft"); ok(sel() === "A", "← auf Unteraufgabe → zur Überkategorie");
  await k("ArrowLeft"); ok(li("A").classList.contains("folded") && sel() === "A", "← klappt ein");
  await k("ArrowDown"); ok(sel() === "B", "↓ überspringt Eingeklapptes");
  await k("ArrowUp"); await k("ArrowRight"); ok(!li("A").classList.contains("folded"), "→ klappt auf");
  await k("ArrowRight"); ok(sel() === "A1", "→ auf Aufgeklapptem → erste Unteraufgabe");
  await k("ArrowUp"); await k("ArrowUp"); ok(d.activeElement.id === "addBtn" && !sel(), "↑ ganz oben → „Aufgabe hinzufügen“");
  await k("ArrowDown"); ok(sel() === "A", "↓ von dort wählt die erste aus");

  await click(view("B")); await click(view("C"), { shiftKey: true });
  ok(sel() === "B,C", "Shift+Klick wählt einen Bereich");
  await k("ArrowDown", { altKey: true });
  ok(rootTitles().join() === "A,D,B,C" && sel() === "B,C", "Alt+↓ verschiebt alle ausgewählten zusammen");
  await k("ArrowUp", { altKey: true });
  ok(rootTitles().join() === "A,B,C,D", "Alt+↑ zurück");
  await k("Tab");
  ok(kids("A").join() === "A1,A2,B,C" && sel() === "B,C", "Tab rückt alle unter die Aufgabe darüber ein");
  await k("Tab", { shiftKey: true });
  ok(rootTitles().join() === "A,B,C,D", "Shift+Tab rückt alle wieder aus");

  await k(" ");
  ok(T("B").x && T("C").x && sel() === "D", "Leertaste hakt alle ab, Auswahl geht zur nächsten");
  await k("z", { ctrlKey: true });
  ok(!T("B").x && !T("C").x, "Strg+Z holt sie zurück");

  await click(view("B")); await click(view("D"), { ctrlKey: true });
  ok(sel() === "B,D", "Strg+Klick nimmt einzelne dazu");
  await k("Delete");
  ok(!T("B") && !T("D") && sel() === "C", "Entf löscht alle, Auswahl geht zur Nachbarin");
  await k("z", { ctrlKey: true });
  ok(T("B") && T("D"), "Strg+Z holt Gelöschtes zurück");

  ok(sel() === "C", "Auswahl bleibt nach Strg+Z"); await k("x");
  ok(d.activeElement.matches("textarea") && d.activeElement.value === "Cx", "Lostippen bearbeitet, Buchstabe ans Ende");
  await k("Escape");
  await k("Enter");
  ok(d.activeElement.matches("textarea") && d.activeElement.closest("li.task") === li("Cx"), "Enter bearbeitet die Auswahl");
  await k("Escape");
  await k("/");
  ok(!d.activeElement.matches("li.task textarea"), "/ bleibt der Chat (kein Lostippen)");

  await click(view("Cx")); await click(d.getElementById("main"));
  ok(!sel(), "Klick ins Leere hebt die Auswahl auf");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
