// Checked subtasks: hidden once the block is left, "2/5" on the parent,
// click on it shows them for a moment, ⋯ switch keeps them in place.
const ROOT = require("node:path").resolve(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };
const ago = (n) => Date.now() - n * 864e5;
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "T:a": { l: "default", t: "Umzug", o: 0 },
  "T:a1": { l: "default", p: "a", t: "Kartons", o: 0 },
  "T:a2": { l: "default", p: "a", t: "Strom", o: 1 },
  "T:a3": { l: "default", p: "a", t: "Helfer", o: 2 },
  "T:a31": { l: "default", p: "a3", t: "Anna", o: 0, x: true, xa: 1 },
  "T:b": { l: "default", t: "Zahnarzt", o: 1 },
  "T:c": { l: "default", t: "Erledigt oben", o: 2, x: true, xa: 2 },
  "T:c1": { l: "default", p: "c", t: "Teil", o: 0, x: true, xa: 2 },
  // Checked on another device: rolls over on load while hidden.
  "T:u": { l: "default", t: "Übungen", o: 3 },
  "T:u1": { l: "default", p: "u", t: "Lesen", o: 0 },
  "T:u2": { l: "default", p: "u", t: "Blatt 3", o: 1, r: "w", d: "2026-01-05", x: true, xa: 3 },
  "T:u3": { l: "default", p: "u", t: "Klausur", o: 2 },
  // Weekly series: Zettel 1 checked late, 2 and 3 on time, Zettel 4 is current.
  "T:k": { l: "default", t: "Kurs", o: 4 },
  "T:k0": { l: "default", p: "k", t: "Anmelden", o: 0, x: true, xa: ago(30) },
  "T:k1": { l: "default", p: "k", t: "Zettel 1", o: 1, s: "k1", d: day(-18), x: true, xa: ago(1) },
  "T:k2": { l: "default", p: "k", t: "Zettel 2", o: 2, s: "k1", d: day(-11), x: true, xa: ago(12) },
  "T:k3": { l: "default", p: "k", t: "Zettel 3", o: 3, s: "k1", d: day(-4), x: true, xa: ago(5) },
  "T:k4": { l: "default", p: "k", t: "Zettel 4", o: 4, s: "k1", r: "w", d: day(3) },
  "T:k5": { l: "default", p: "k", t: "Skript", o: 5 },
  "T:f": { l: "default", t: "Nichts erledigt", o: 5 },
  "T:f1": { l: "default", p: "f", t: "Eins", o: 0 },
  "T:f2": { l: "default", p: "f", t: "Zwei", o: 1 },
});
const { w, d, ok, T, li, edit, key, kids, tick, local } = H;
const streak = (t) => { const e = li(t).querySelector(":scope > .row .streak"); return e && e.textContent; };
const folded = (t) => li(t).querySelector(":scope > .row .fold-count:not(.progress)");
const check = async (t) => { li(t).querySelector(":scope > .row .check").click(); await tick(); };
const over = async (t) => { li(t).querySelector(":scope > .row").dispatchEvent(new w.MouseEvent("mouseover", { bubbles: true })); await tick(); };
const pill = (t) => li(t).querySelector(":scope > .row .fold-count.progress");
const menu = async () => { d.querySelector('#listMenu [data-action="doneSubtasks"]').click(); await tick(); };

(async () => {
  await tick(); await tick();
  ok(kids("Helfer").length === 0 && !li("Anna"), "erledigte Unteraufgabe ist ausgeblendet");
  ok(pill("Helfer") && pill("Helfer").textContent === "1/1", "Oberaufgabe zeigt 1/1");
  ok(pill("Umzug") && pill("Umzug").textContent === "1/4", "Fortschritt zählt alle Ebenen: " + (pill("Umzug") || {}).textContent);
  ok(!pill("Zahnarzt"), "ohne erledigte Unteraufgaben kein Fortschritt");
  ok(kids("Übungen")[1] === "Blatt 4" && kids("Übungen")[0] === "Lesen", "nächste Woche landet hinter der ausgeblendeten, nicht oben: " + kids("Übungen").join());

  ok(pill("Kurs").textContent === "1/3", "Serie zählt einmal (nur die aktuelle Woche): " + pill("Kurs").textContent);
  ok(streak("Zettel 4") === "2", "Flamme: 2 Wochen in Folge pünktlich (Zettel 1 war zu spät): " + streak("Zettel 4"));
  ok(!streak("Skript") && !streak("Kurs"), "Flamme nur an wöchentlichen Aufgaben");
  await over("Zettel 4");
  await check("Zettel 4");
  ok(streak("Zettel 5") === "3" && pill("Kurs").textContent === "1/3", "abgehakt: Zettel 5 mit 3, Fortschritt bleibt 1/3");
  await over("Zahnarzt");

  li("Nichts erledigt").querySelector(":scope > .fold-bar").click(); await tick();
  ok(folded("Nichts erledigt") && folded("Nichts erledigt").textContent === "0/2", "eingeklappt: Fortschritt auch ohne erledigte");
  ok(!pill("Nichts erledigt"), "kein Fortschritts-Kästchen daneben");
  folded("Nichts erledigt").click(); await tick();
  ok(!pill("Nichts erledigt") && !folded("Nichts erledigt"), "ausgeklappt ohne erledigte: nichts");

  await over("Kartons");
  await check("Kartons");
  ok(T("Kartons").x && kids("Umzug").join() === "Kartons,Strom,Helfer", "frisch abgehakt bleibt stehen, solange man im Block ist");
  ok(pill("Umzug").textContent === "2/4", "Fortschritt zählt mit: " + pill("Umzug").textContent);
  await check("Strom");
  ok(kids("Umzug").join() === "Kartons,Strom,Helfer", "mehrere nacheinander abhaken");
  await over("Zahnarzt");
  ok(kids("Umzug").join() === "Helfer" && pill("Umzug").textContent === "3/4", "Maus verlässt den Block → ausgeblendet");

  pill("Umzug").click(); await tick();
  ok(kids("Umzug").join() === "Kartons,Strom,Helfer" && kids("Helfer").join() === "Anna", "Klick auf 2/5 zeigt die erledigten");
  ok(pill("Umzug").classList.contains("active"), "Fortschritt ist dabei hervorgehoben");
  await check("Strom");
  ok(!T("Strom").x && pill("Umzug").textContent === "2/4", "eine wieder öffnen");
  await over("Zahnarzt");
  ok(kids("Umzug").join() === "Strom,Helfer", "danach wieder ausgeblendet, die geöffnete bleibt");

  let ta = edit("Helfer");
  await key(ta, "Enter", { ctrlKey: true });
  ok(T("Helfer").x && T("Umzug").x !== true && kids("Umzug").join() === "Strom,Helfer", "Strg+Enter: bleibt stehen, Cursor im Block");
  edit("Zahnarzt"); await tick();
  d.activeElement.blur(); await tick();
  ok(kids("Umzug").join() === "Strom", "Fokus in einem anderen Block → ausgeblendet");

  ta = edit("Strom");
  await key(ta, "Tab");
  ok(T("Strom").p === "a", "Tab rückt nicht unter eine ausgeblendete Aufgabe ein");
  d.activeElement.blur(); await tick();

  d.getElementById("doneToggle").click(); await tick();
  ok(kids("Erledigt oben").join() === "Teil", "unter einer erledigten Oberaufgabe bleibt alles sichtbar");

  ok(d.getElementById("doneSubtasksItem").textContent === "Erledigte Unteraufgaben: ausblenden", "Menüeintrag zeigt ausblenden");
  await menu();
  ok(local.data["tk:doneSubtasks"] === true, "Umschalten speichert pro Gerät");
  ok(kids("Umzug").join() === "Kartons,Strom,Helfer" && !pill("Umzug"), "angezeigt: an ihrem Platz, kein Fortschritt");
  ok(d.getElementById("doneSubtasksItem").textContent === "Erledigte Unteraufgaben: anzeigen", "Menüeintrag zeigt anzeigen");
  await menu();
  ok(local.data["tk:doneSubtasks"] === false && kids("Umzug").join() === "Strom", "zurück auf ausblenden");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
