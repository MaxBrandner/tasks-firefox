// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const setup = require("./harness.cjs");
const P = ROOT;
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const START = {
  "L:uni": { t: "Uni", o: 0 }, "L:priv": { t: "Privat", o: 1 },
  "T:dl": { l: "uni", t: "DL", o: 0 },
  "T:b1": { l: "uni", p: "dl", t: "Blatt 1", d: "2026-10-21", h: "12:00", o: 0, u: [{ url: "https://ilias.hhu.de/b1", t: "Abgabe" }] },
  "T:fo": { l: "uni", p: "dl", t: "Folien", o: 1, u: [{ url: "https://ilias.hhu.de/fo", t: "Folien" }] },
  "T:ek": { l: "priv", t: "Einkaufen", o: 0 },
};
const A = (o) => Object.assign({ op: "", target: "", list: "", parent: "", ref: "", title: "", notes: "", due_date: "", due_time: "", done: "", weekly: "", url: "", link_title: "", position: "" }, o);
(async () => {
  let H = setup(P, START); await H.tick(); await H.tick();
  const { d } = H; const $ = (id) => d.getElementById(id);
  const say = async (text, data) => { H.chatReply = async () => ({ ok: true, data }); $("chatInput").value = text; $("chatForm").dispatchEvent(new H.w.Event("submit", { cancelable: true })); await H.tick(); await H.tick(); };
  const last = () => [...$("chatLog").querySelectorAll(".chat-msg")].pop();
  // the chat is always there (no button); jsdom has no matchMedia → narrow
  const key = (k, el = d.body) => el.dispatchEvent(new H.w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  ok(!$("chatBtn") && d.body.dataset.chat === "tasks" && !$("chatPanel").hidden && $("chatLog").querySelectorAll(".chat-empty .chip").length === 4, "Chat immer da, Start im Reiter „Aufgaben“, Beispiel-Fragen geladen");
  $("tabChat").click(); await H.tick();
  ok(d.body.dataset.chat === "full" && $("tabChat").getAttribute("aria-pressed") === "true" && d.activeElement === $("chatInput"), "Reiter „Chat“: Chat mit Fokus im Eingabefeld");
  key("Escape", $("chatInput")); await H.tick();
  ok(d.body.dataset.chat === "tasks" && d.activeElement !== $("chatInput"), "Esc im Reiter „Chat“ → zurück zu den Aufgaben");
  key("/"); await H.tick();
  ok(d.body.dataset.chat === "quick" && d.activeElement === $("chatInput"), "/ über den Aufgaben öffnet die Schnell-Karte");
  $("chatExpand").click(); await H.tick();
  ok(d.body.dataset.chat === "full", "„Ganzer Chat“ wechselt in den Reiter");
  $("tabTasks").click(); await H.tick();
  ok(d.body.dataset.chat === "quick", "Schnell-Karte bleibt nach Reiter „Chat“ → „Aufgaben“ offen");
  $("chatClose").click(); await H.tick();
  ok(d.body.dataset.chat === "tasks", "× schließt die Schnell-Karte");
  key("/"); await H.tick(); $("tabChat").click(); await H.tick();
  key("Escape", $("chatInput")); await H.tick();
  ok(d.body.dataset.chat === "quick", "Esc im Reiter „Chat“ → Aufgaben, Karte noch offen …");
  key("Escape"); await H.tick();
  ok(d.body.dataset.chat === "tasks", "… nächstes Esc schließt die Karte");
  key("/"); await H.tick();
  await say("Was ist bei DL dran?", { reply: "[[T:b1]].", actions: [], highlight: ["b1"] });
  ok(!$("tabMarks").hidden && $("tabMarks").textContent === "1 markiert", "Reiter „Aufgaben“ zählt Markierungen");
  key("Escape", $("chatInput")); await H.tick();
  ok(d.body.dataset.chat === "tasks" && H.li("Blatt 1").classList.contains("chat-mark"), "Esc: Karte zu, Markierung bleibt");
  $("tabChat").click(); await H.tick();
  last().querySelector(".ref-chip").click(); await H.tick();
  ok(d.body.dataset.chat === "tasks", "Chip-Klick im Reiter „Chat“ wechselt zu den Aufgaben");
  H.edit("Folien"); await H.tick(); d.activeElement.blur();
  key("Escape"); await H.tick();
  ok(!H.li("Folien").classList.contains("expanded") && H.li("Blatt 1").classList.contains("chat-mark"), "Esc: erst die aufgeklappte Aufgabe zu …");
  key("Escape"); await H.tick();
  ok($("tabMarks").hidden && !d.querySelector(".chat-mark"), "… dann sind die Markierungen weg");
  $("tabChat").click(); await H.tick();
  // question with references + highlight
  H.edit("Blatt 1"); await H.tick();
  await say("Was ist diese Woche fällig?", { reply: "Fällig ist [[T:b1]] in [[L:uni]].", actions: [], highlight: ["b1", "gibtsnicht"] });
  const chips = [...last().querySelectorAll(".ref-chip")].map((c) => c.textContent);
  ok(chips.join() === "Blatt 1,Uni", "Antwort zeigt Verweise als Chips: " + chips);
  ok(H.li("Blatt 1").classList.contains("chat-mark") && !d.querySelector(".chat-mark:not([data-id='b1'])"), "besprochene Aufgabe in der Liste markiert");
  ok(d.body.style.getPropertyValue("--mark-o") === "1.000", "Markierung frisch: voll sichtbar (verblasst erst nach 1 min)");
  H.li("Blatt 1").querySelector(".row").click(); await H.tick();
  ok(!H.li("Blatt 1").classList.contains("chat-mark") && $("tabMarks").hidden, "Aufgabe angefasst → gilt als gesehen, Markierung weg");
  last().click(); await H.tick();
  ok(H.li("Blatt 1").classList.contains("chat-mark") && d.body.dataset.chat === "tasks", "Klick auf die KI-Antwort zeigt ihre Markierung wieder (schmal: Reiter „Aufgaben“)");
  const prompt = H.chatPrompts[H.chatPrompts.length - 1];
  ok(/Blatt 1 \(id: b1, fällig 2026-10-21 12:00, Links: Abgabe <https:\/\/ilias\.hhu\.de\/b1>\)/.test(prompt) && /Gerade aufgeklappt: „Blatt 1“ \(id: b1\)/.test(prompt) && /<<<\nWas ist diese Woche fällig\?\n>>>/.test(prompt), "an die KI: Baum mit IDs/Links, aufgeklappte Aufgabe, Nachricht");
  // highlight in another list → sidebar switches there
  d.getElementById("listSelect").value = "priv"; d.getElementById("listSelect").dispatchEvent(new H.w.Event("change")); await H.tick();
  await say("Was ist bei DL offen?", { reply: "[[T:b1]] und [[T:fo]].", actions: [], highlight: ["b1", "fo"] });
  ok(d.getElementById("listSelect").value === "uni" && H.li("Folien").classList.contains("chat-mark"), "Markiertes liegt in anderer Liste → Seitenleiste wechselt dorthin");
  // several actions in one answer
  const nodesBefore = Object.keys(H.local.data["tk:history"].nodes).length;
  await say("Mach eine Liste Klausuren mit DL-Klausur, hake Folien ab, verschiebe Einkaufen nach Uni, Link dazu, öffne DL", {
    reply: "Erledigt.", highlight: [], actions: [
      A({ op: "create_list", title: "Klausuren", ref: "k" }),
      A({ op: "create_task", list: "ref:k", title: "DL-Klausur", due_date: "2026-12-10", due_time: "10:00", ref: "kl" }),
      A({ op: "create_task", parent: "ref:kl", title: "Altklausuren rechnen" }),
      A({ op: "update_task", target: "fo", done: "true" }),
      A({ op: "move_task", target: "ek", list: "uni", position: "last" }),
      A({ op: "add_link", target: "ref:kl", url: "https://ilias.hhu.de/klausur", link_title: "Klausur-Infos" }),
      A({ op: "add_link", target: "b1", url: "javascript:alert(1)" }),
      A({ op: "update_task", target: "gibtsnicht", title: "x" }),
      A({ op: "move_task", target: "dl", parent: "b1" }),
      A({ op: "open_links", target: "dl", title: "DL" }),
      A({ op: "open_links", url: "https://evil.example/" }),
    ] });
  const T = (t) => Object.entries(H.sync.data).find(([k, v]) => k.startsWith("T:") && v.t === t);
  const kl = T("DL-Klausur"), alt = T("Altklausuren rechnen");
  const klList = Object.entries(H.sync.data).find(([k, v]) => k.startsWith("L:") && v.t === "Klausuren");
  ok(klList && kl && kl[1].l === klList[0].slice(2) && kl[1].d === "2026-12-10" && kl[1].h === "10:00" && alt && alt[1].p === kl[0].slice(2), "neue Liste + Aufgabe + Unteraufgabe über ref:");
  ok(H.sync.data["T:fo"].x && H.sync.data["T:ek"].l === "uni" && kl[1].u && kl[1].u[0].t === "Klausur-Infos", "abhaken, Liste wechseln, Link hinzufügen");
  ok(!H.sync.data["T:dl"].p && !(H.sync.data["T:b1"].u || []).some((l) => /javascript/.test(l.url)), "ungültige Aktionen (in sich selbst, javascript:) nicht ausgeführt");
  ok(H.tabsOpened.length === 2 && H.groupTitle === "DL" && !H.tabsOpened.some((o) => /evil/.test(o.url)), "Links von DL als Tab-Gruppe „DL“, fremde Adresse nicht geöffnet");
  const note = last().querySelector(".chat-note.warn");
  ok(note && /Nicht ausgeführt:.*gibtsnicht|Nicht ausgeführt:.*nicht gefunden/.test(note.textContent) && /in sich selbst/.test(note.textContent) && /nur Links aus den Aufgaben/.test(note.textContent), "Übersprungenes wird genannt");
  const hist = H.local.data["tk:history"];
  ok(Object.keys(hist.nodes).length === nodesBefore + 1 && hist.nodes[hist.cur].l.startsWith("KI-Chat: Mach eine Liste"), "alles ist EIN Verlaufsschritt „KI-Chat: …“");
  ok(d.querySelectorAll(".task.chat-changed").length >= 2 && last().querySelectorAll(".chat-changes .ref-chip").length >= 3, "geänderte Aufgaben markiert und als Chips unter der Antwort");
  // undo only this chat step
  [...last().querySelectorAll(".chat-changes .link-btn")].find((b) => /Rückgängig/.test(b.textContent)).click(); await H.tick();
  ok(!T("DL-Klausur") && !H.sync.data["T:fo"].x && H.sync.data["T:ek"].l === "priv" && /Zurückgenommen/.test(last().textContent), "„Rückgängig“ nimmt genau diesen Chat-Schritt zurück");
  // delete only after confirmation
  await say("Lösch Einkaufen", { reply: "Soll ich [[T:ek]] löschen?", highlight: ["ek"], actions: [A({ op: "delete_task", target: "ek" })] });
  ok(H.sync.data["T:ek"] && /Löscht „Einkaufen“/.test(last().textContent), "Löschen wartet auf Bestätigung");
  [...last().querySelectorAll("button")].find((b) => b.textContent === "Verwerfen").click(); await H.tick();
  ok(H.sync.data["T:ek"] && /Verworfen/.test(last().textContent), "„Verwerfen“ ändert nichts");
  await say("Doch löschen", { reply: "Ok.", highlight: [], actions: [A({ op: "delete_task", target: "ek" })] });
  [...last().querySelectorAll("button")].find((b) => b.textContent === "Ausführen").click(); await H.tick();
  ok(!H.sync.data["T:ek"], "„Ausführen“ löscht");
  // error
  H.chatReply = async () => ({ ok: false, error: "Claude: Not logged in" });
  $("chatInput").value = "hallo"; $("chatForm").dispatchEvent(new H.w.Event("submit", { cancelable: true })); await H.tick(); await H.tick();
  ok(last().classList.contains("error") && /Not logged in/.test(last().textContent), "Fehler als roter Hinweis");
  // restart: chat persisted; chip click switches list
  const H2 = setup(P, H.sync.data, { local: H.local.data }); await H2.tick(); await H2.tick();
  await H2.tick(); await H2.tick();
  const msgs = H2.d.querySelectorAll("#chatLog .chat-msg");
  ok(msgs.length === H.d.querySelectorAll("#chatLog .chat-msg").length && msgs.length >= 10, "Chat nach Neustart noch da (" + msgs.length + " Nachrichten)");
  H2.d.getElementById("listSelect").value = "priv"; H2.d.getElementById("listSelect").dispatchEvent(new H2.w.Event("change")); await H2.tick();
  [...H2.d.querySelectorAll("#chatLog .ref-chip")].find((c) => c.textContent === "Blatt 1").click(); await H2.tick();
  ok(H2.d.getElementById("listSelect").value === "uni" && H2.li("Blatt 1").classList.contains("flash"), "Chip-Klick wechselt zur Liste und lässt die Aufgabe aufleuchten");
  H2.d.getElementById("chatNew").click(); await H2.tick();
  ok(H2.d.querySelector("#chatLog .chat-empty") && H2.local.data["tk:chat"].messages.length === 0, "„Neuer Chat“ leert");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
