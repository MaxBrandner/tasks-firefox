// Generates test data to import into the test copy "Tasks DEV":
//   npm run testdata  →  testdata/tasks-testdata.json
// In Tasks DEV: ⋯ → "Sicherung importieren …" → "Zusammenführen", then close
// and reopen the sidebar once (weekly repeat + legacy note links run on start).
//
// Due dates are relative to now, so the countdown (~3 h, ~30 h) and "overdue"
// are visible. IDs start with "test" – no overlap with real data. All links
// point to public pages.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "testdata", "tasks-testdata.json");

const now = new Date();
now.setSeconds(0, 0);
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (n) => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + n));
const at = (hours) => new Date(now.getTime() + hours * 3600e3);
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const soon3 = at(3);
const soon30 = at(30);
const UNI = "testuni0001";
const PRIV = "testpriv001";

const data = {
  "L:testuni0001": { t: "Test: Uni", o: 10 },
  "L:testpriv001": { t: "Test: Privat", o: 11 },

  // Math: links on several levels, weekly (due yesterday), checked subtask
  "T:testmathe01": {
    l: UNI, t: "Mathe", d: day(3), o: 0,
    u: [
      { url: "https://de.wikipedia.org/wiki/Lineare_Algebra", t: "Skript" },
      { url: "https://example.org/mathe/uebersicht", t: "Übersicht" },
    ],
  },
  "T:testmathe02": {
    l: UNI, p: "testmathe01", t: "Blatt 3", d: day(-1), h: "10:00", r: "w", s: "testmathe02", o: 0,
    n: "Aufgaben 1–4, **Aufgabe 3 ist Bonus**",
    u: [{ url: "https://example.org/mathe/abgabe-3", t: "Abgabe Blatt 3" }],
  },
  "T:testmathe03": { l: UNI, p: "testmathe01", t: "Vorlesung 5 nacharbeiten", x: true, xa: at(-20).getTime(), o: 1 },
  "T:testmathe04": {
    l: UNI, p: "testmathe01", t: "Folien", o: 2,
    u: [{ url: "https://example.org/mathe/uebersicht", t: "Übersicht (doppelt)" }],
  },

  // DL: countdown (~30 h), several links, nesting down to level 4, Markdown
  "T:testdl00001": {
    l: UNI, t: "**DL** – Deep Learning", o: 1,
    n: "Zulassung: 8 von 11 Blättern\n- mind. 50 % der Punkte\n- Abgabe als *PDF*, Teams bis 3",
  },
  "T:testdl00002": {
    l: UNI, p: "testdl00001", t: "Blatt 2", d: iso(soon30), h: hm(soon30), o: 0,
    u: [
      { url: "https://example.org/dl/abgabe-2", t: "Abgabe Blatt 2" },
      { url: "https://developer.mozilla.org/de/docs/Web/JavaScript", t: "Aufgabenblatt" },
    ],
  },
  "T:testdl00003": { l: UNI, p: "testdl00001", t: "Präsenzaufgaben", o: 1 },
  "T:testdl00004": { l: UNI, p: "testdl00003", t: "Aufgabe 1", o: 0 },
  "T:testdl00005": {
    l: UNI, p: "testdl00004", t: "Teil a – `numpy`-Broadcasting", o: 0,
    u: [{ url: "https://de.wikipedia.org/wiki/NumPy", t: "NumPy" }],
  },
  "T:testdl00006": { l: UNI, p: "testdl00004", t: "Teil b", o: 1 },

  // Legacy "Zur Seite" note line → moved into the link field on start
  "T:testalt0001": {
    l: UNI, t: "Altlast mit Notiz-Link", o: 2,
    n: "Diese Notiz hatte früher den Link als letzte Zeile.\n[Zur Seite](https://example.org/alte-seite)",
  },

  // Completed top-level task → done section at the bottom
  "T:testerl0001": {
    l: UNI, t: "Klausuranmeldung", x: true, xa: at(-26).getTime(), o: 3,
    u: [{ url: "https://example.org/pruefungsamt", t: "Prüfungsamt" }],
  },

  // Private: countdown (~3 h), Markdown list, link in the note, far due date
  "T:testpri0001": { l: PRIV, t: "Arzttermin", d: iso(soon3), h: hm(soon3), o: 0 },
  "T:testpri0002": { l: PRIV, t: "Einkaufen", o: 1, n: "- Milch\n- Brot\n- **Kaffee**" },
  "T:testpri0003": {
    l: PRIV, t: "Steuererklärung", d: day(10), o: 2,
    n: "Formulare über [Elster](https://www.elster.de) – ~~Papier~~",
  },
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ format: "tasks-backup", version: 1, exportedAt: now.toISOString(), data }, null, 1) + "\n");
const count = (p) => Object.keys(data).filter((k) => k.startsWith(p)).length;
console.log(`Testdaten (${count("L:")} Listen, ${count("T:")} Aufgaben) → ${out}
Countdown: Arzttermin ${hm(soon3)} (~3 h), DL › Blatt 2 ${iso(soon30)} ${hm(soon30)} (~30 h)
Import nur in „Tasks DEV": ⋯ → „Sicherung importieren …" → Zusammenführen.`);
