// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const pad = (n) => String(n).padStart(2, "0");
const iso = (dt) => dt.getFullYear() + "-" + pad(dt.getMonth() + 1) + "-" + pad(dt.getDate());
const day = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x; };
const H = require("./harness.cjs")(ROOT, {
  "L:default": { t: "Meine Aufgaben", o: 0 },
  "T:a1": { l: "default", t: "Abgabe", d: iso(day(10)), h: "14:30", o: 0 },
  "T:b1": { l: "default", t: "Andere", o: 1 },
});
const { d, ok, T, li, edit, tick, bodyKey } = H;
const field = () => li("Abgabe").querySelector(".details .date-field");
const input = () => field().querySelector("input");
const cal = () => li("Abgabe").querySelector(".details .cal");
const enter = async (v) => {
  input().value = v;
  input().dispatchEvent(new H.w.Event("input"));
  input().dispatchEvent(new H.w.Event("change"));
  await tick();
};
const y = new Date().getFullYear();
(async () => {
  await tick(); await tick();
  edit("Abgabe"); await tick();
  const f10 = day(10);
  ok(input().type === "text" && input().value === `${pad(f10.getDate())}.${pad(f10.getMonth() + 1)}.${f10.getFullYear()}`, "Feld zeigt TT.MM.JJJJ: " + input().value);

  // Day/month a fortnight ahead; the year only matters where given.
  const f = day(14), dd = pad(f.getDate()), mm = pad(f.getMonth() + 1), want = iso(f);
  for (const typed of [`${dd}.${mm}.${f.getFullYear()}`, `${dd}.${mm}.${String(f.getFullYear()).slice(2)}`, `${+dd}.${+mm}.`, `${dd}${mm}`, want]) {
    await enter("");
    await enter(typed);
    ok(T("Abgabe").d === want, `„${typed}“ → ${T("Abgabe").d} (erwartet ${want})`);
  }
  const past = day(-20);
  await enter(`${past.getDate()}.${past.getMonth() + 1}.`);
  ok(T("Abgabe").d === iso(new Date(past.getFullYear() + 1, past.getMonth(), past.getDate())), "ohne Jahr, schon vorbei → nächstes Jahr: " + T("Abgabe").d);
  await enter(want);
  for (const bad of ["31.02.2027", "32.1.", "13.13.", "morgen", "1.2.3"]) {
    await enter(bad);
    ok(T("Abgabe").d === want && field().classList.contains("invalid"), `„${bad}“ abgelehnt, rot markiert`);
  }
  await enter(want);
  ok(!field().classList.contains("invalid"), "gültige Eingabe nimmt die rote Markierung weg");
  ok(!T("Abgabe").h, "leeres Datumsfeld (oben) nahm auch die Uhrzeit weg");
  const timeIn = li("Abgabe").querySelector(".details .time-input");
  timeIn.value = "14:30"; timeIn.dispatchEvent(new H.w.Event("change")); await tick();

  // Calendar (Air Datepicker)
  const dp = () => d.querySelector(".air-datepicker");
  const open = () => !!dp() && dp().classList.contains("-active-");
  const calBtn = () => field().querySelector(".cal-btn");
  const clickBtn = async () => {
    calBtn().dispatchEvent(new H.w.MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    calBtn().click(); await tick();
  };
  const cell = (isoDate) => dp().querySelector(`.air-datepicker-cell.-day-[data-iso-date="${isoDate}"]`);
  const button = (text) => [...dp().querySelectorAll(".air-datepicker-button")].find((b) => b.textContent === text);
  await clickBtn();
  ok(open() && calBtn().classList.contains("on"), "Kalender-Knopf öffnet den Kalender");
  ok([...dp().querySelectorAll(".air-datepicker-body--day-name")].map((e) => e.textContent).join() === "Mo,Di,Mi,Do,Fr,Sa,So", "Woche ab Montag, deutsche Namen");
  ok(cell(want).classList.contains("-selected-"), "gewählter Tag ist markiert");
  const title = () => dp().querySelector(".air-datepicker-nav--title").textContent;
  ok(/^[A-ZÄÖÜ][a-zä]+ \d{4}$/.test(title()), "Monatstitel ohne Komma: " + title());
  const before = title();
  dp().querySelector('.air-datepicker-nav--action[data-action="next"]').click(); await tick();
  ok(open() && title() !== before, "Blättern hält den Kalender offen: " + before + " → " + title());
  dp().querySelector('.air-datepicker-nav--action[data-action="prev"]').click(); await tick();
  const picked = iso(day(20));
  if (!cell(picked)) { dp().querySelector('.air-datepicker-nav--action[data-action="next"]').click(); await tick(); }
  cell(picked).click(); await tick(); await tick();
  ok(T("Abgabe").d === picked && T("Abgabe").h === "14:30" && !open(), "Tag anklicken setzt das Datum, Uhrzeit bleibt, Kalender zu");
  ok(li("Abgabe").classList.contains("expanded") && input().value === picked.split("-").reverse().join("."), "Aufgabe bleibt aufgeklappt, Feld zeigt " + input().value);

  await clickBtn();
  await bodyKey("Escape");
  ok(!open() && li("Abgabe").classList.contains("expanded") && d.activeElement === input(), "Esc schließt nur den Kalender, zurück ins Feld");
  await clickBtn(); await clickBtn();
  ok(!open(), "Kalender-Knopf schließt ihn wieder");
  await clickBtn();
  input().blur(); await tick();
  ok(!open() && li("Abgabe").classList.contains("expanded"), "Feld verlassen (Klick daneben) schließt den Kalender");

  await clickBtn();
  button("Heute").click(); await tick(); await tick();
  ok(T("Abgabe").d === iso(day(0)) && li("Abgabe").classList.contains("expanded"), "„Heute“ wählt heute, Aufgabe bleibt offen");
  await clickBtn();
  button("Entfernen").click(); await tick(); await tick();
  ok(!T("Abgabe").d && !T("Abgabe").h, "„Entfernen“ nimmt Datum und Uhrzeit weg");
  await clickBtn();
  ok(open() && !dp().querySelector(".-selected-") && !!dp().querySelector(".air-datepicker-cell.-current-") && title().includes(String(y)),
    "ohne Datum: aktueller Monat, nichts markiert");
  // Regression: a picker replaced right away (two renders in a row) used to
  // write an empty date into its old field a moment later – and that cleared the date.
  d.body.click(); await tick();
  edit("Abgabe"); await tick();
  await enter(want);
  const tIn = li("Abgabe").querySelector(".details .time-input");
  tIn.value = "09:15"; tIn.dispatchEvent(new H.w.Event("change"));
  d.querySelector('#listMenu [data-action="timeFormat"]').click();
  await tick(); await tick();
  ok(T("Abgabe").d === want && T("Abgabe").h === "09:15", "zweimal kurz hintereinander neu gezeichnet: Datum bleibt " + JSON.stringify(T("Abgabe")));
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
