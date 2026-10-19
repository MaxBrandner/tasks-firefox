// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const iso = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "T:a1": { l: "default", t: "Abgabe", d: iso(day(10)), h: "14:30", o: 0 },
});
const { d, ok, T, li, edit, tick, local } = H;
const chipText = () => li("Abgabe").querySelector(":scope>.row .due .due-label")?.textContent;
const timeIn = () => li("Abgabe").querySelector(".details .time-input");
const enter = async (v) => {
  const el = timeIn();
  el.value = v;
  el.dispatchEvent(new H.w.Event("input"));
  el.dispatchEvent(new H.w.Event("change"));
  await tick();
};
(async () => {
  await tick(); await tick();
  ok(chipText().endsWith(", 14:30"), "Standard 24 Std.: " + chipText());
  ok(d.getElementById("timeFormatItem").textContent === "Uhrzeit: 24 Std.", "Menüeintrag zeigt 24 Std.");

  edit("Abgabe"); await tick();
  ok(timeIn() && timeIn().type === "text" && timeIn().value === "14:30", "Feld ist Text, zeigt 14:30");
  for (const [typed, want] of [["9", "09:00"], ["1745", "17:45"], ["8.15", "08:15"], ["930", "09:30"], ["2pm", "14:00"],
    ["2:30 PM", "14:30"], ["12 am", "00:00"], ["12pm", "12:00"], ["7 Uhr", "07:00"]]) {
    await enter(typed);
    ok(T("Abgabe").h === want, `„${typed}“ → ${T("Abgabe").h} (erwartet ${want})`);
  }
  for (const bad of ["25:00", "13pm", "abc", "12:60"]) {
    await enter(bad);
    ok(T("Abgabe").h === "07:00" && timeIn().classList.contains("invalid"), `„${bad}“ abgelehnt, rot markiert, Uhrzeit bleibt`);
  }
  await enter("");
  ok(!T("Abgabe").h && T("Abgabe").d === iso(day(10)), "leeres Feld entfernt nur die Uhrzeit");
  await enter("14:30");

  d.querySelector('#listMenu [data-action="timeFormat"]').click(); await tick();
  ok(local.data["tk:timeFormat"] === "12h", "Umschalten speichert 12h (pro Gerät)");
  ok(d.getElementById("timeFormatItem").textContent === "Uhrzeit: 12 Std. (AM/PM)", "Menüeintrag zeigt 12 Std.");
  ok(chipText().endsWith(", 2:30 PM"), "Bubble: " + chipText());
  ok(li("Abgabe").querySelector(".due").title.endsWith(", 2:30 PM"), "Tooltip ohne „Uhr“: " + li("Abgabe").querySelector(".due").title);
  ok(T("Abgabe").h === "14:30", "gespeichert bleibt 14:30");
  edit("Abgabe"); await tick();
  ok(timeIn() && timeIn().value === "2:30 PM" && timeIn().classList.contains("h12"), "Feld zeigt 2:30 PM");
  await enter("9");
  ok(T("Abgabe").h === "09:00" && timeIn().value === "9:00 AM", "„9“ im 12-Std.-Modus → 9:00 AM");

  d.querySelector('#listMenu [data-action="timeFormat"]').click(); await tick();
  ok(local.data["tk:timeFormat"] === "24h" && chipText().endsWith(", 09:00"), "zurück auf 24 Std.: " + chipText());
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
