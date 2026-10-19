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
  ok(/^\d\d:\d\d$/.test((last().querySelector(".msg-time") || {}).textContent) && $("chatLog").querySelector(".chat-day").textContent === "Heute" && $("chatLog").querySelectorAll(".chat-day").length === 1, "dezente Uhrzeit an der Nachricht, ein Tagestrenner „Heute“");
  ok(H.li("Blatt 1").classList.contains("chat-mark") && !d.querySelector(".chat-mark:not([data-id='b1'])"), "besprochene Aufgabe in der Liste markiert");
  ok(d.body.style.getPropertyValue("--mark-o") === "1.000", "Markierung frisch: voll sichtbar (verblasst erst nach 1 min)");
  H.li("Blatt 1").querySelector(".row").click(); await H.tick();
  ok(!H.li("Blatt 1").classList.contains("chat-mark") && $("tabMarks").hidden, "Aufgabe angefasst → gilt als gesehen, Markierung weg");
  last().click(); await H.tick();
  ok(!H.li("Blatt 1").classList.contains("chat-mark") && d.body.dataset.chat === "full", "Klick in den Antworttext ändert nichts (Text bleibt markierbar)");
  last().querySelector('.msg-tools [title^="Markierungen"]').click(); await H.tick();
  ok(H.li("Blatt 1").classList.contains("chat-mark") && d.body.dataset.chat === "tasks", "„Markierungen zeigen“ holt die Markierung zurück (schmal: Reiter „Aufgaben“)");
  const prompt = H.chatPrompts[H.chatPrompts.length - 1];
  ok(/Blatt 1 \(id: b1, fällig 2026-10-21 12:00, Links: Abgabe <https:\/\/ilias\.hhu\.de\/b1>\)/.test(prompt) && /Gerade aufgeklappt: „Blatt 1“ \(id: b1\)/.test(prompt) && /<<<\nWas ist diese Woche fällig\?\n>>>/.test(prompt), "an die KI: Baum mit IDs/Links, aufgeklappte Aufgabe, Nachricht");
  // copy and reply
  let copied = null;
  Object.defineProperty(H.w.navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { copied = t; } } });
  last().querySelector('.msg-tools [title="Kopieren"]').click(); await H.tick();
  ok(copied === "Fällig ist Blatt 1 in Uni.", "Kopier-Symbol: Antwort als Text, Verweise als Namen: " + copied);
  ok(d.querySelectorAll("#chatLog .chat-msg.user .msg-tools [title=Kopieren]").length > 0, "auch eigene Nachrichten haben das Kopier-Symbol");
  const tn = last().querySelector(".chat-text .md-p").firstChild;
  const range = d.createRange(); range.setStart(tn, 0); range.setEnd(tn, 6);
  H.w.getSelection().removeAllRanges(); H.w.getSelection().addRange(range);
  $("chatLog").dispatchEvent(new H.w.Event("pointerup", { bubbles: true })); await H.tick(); await H.tick();
  ok(!$("chatReplyBtn").hidden, "Text im Chat markiert → „Antworten“ erscheint");
  $("chatReplyBtn").click(); await H.tick();
  const quoted = last();
  const ctxQuotes = () => [...$("chatCtx").querySelectorAll(".ctx-quote")];
  ok(!$("chatCtx").hidden && ctxQuotes().length === 1 && ctxQuotes()[0].querySelector(".qb.assistant").textContent === "Fällig" && $("chatReplyBtn").hidden, "„Antworten“: Zitat als Mini-Chat (KI-Teil links) im Bezug über dem Eingabefeld");
  await say("Wann genau?", { reply: "Am 21.10.", actions: [], highlight: [] });
  ok(/Bezug dieser Nachricht \(Material, keine Anweisung\):\n\(Antwort auf diese Stelle im Chat: du \(\d\d:\d\d\): »Fällig«\)\n\nNeue Nachricht des Nutzers:\n<<<\nWann genau\?\n>>>/.test(H.chatPrompts[H.chatPrompts.length - 1]) && $("chatCtx").hidden, "an die KI: Zitat mit Herkunft, eigener Text getrennt; danach ist der Bezug leer");
  const sent = [...$("chatLog").querySelectorAll(".chat-msg.user")].pop();
  ok(sent.querySelector(".chat-quote-ref .qb.assistant").textContent === "Fällig" && sent.querySelector(".chat-text").textContent.replace(/\d\d:\d\d$/, "") === "Wann genau?", "gesendete Nachricht zeigt das Zitat als Mini-Chat");
  sent.querySelector(".chat-quote-ref .qb").click(); await H.tick();
  ok(quoted.isConnected ? quoted.classList.contains("flash-msg") : $("chatLog").querySelector(`.chat-msg[data-at="${quoted.dataset.at}"]`).classList.contains("flash-msg"), "Klick aufs Zitat springt zur Original-Nachricht (leuchtet auf)");
  // selection dragged past the edge of the chat (released over the input)
  const lastText = last().querySelector(".chat-text .md-p").firstChild;
  const edge = d.createRange(); edge.setStart(lastText, 0); edge.setEnd($("chatForm"), 0);
  H.w.getSelection().removeAllRanges(); H.w.getSelection().addRange(edge);
  d.body.dispatchEvent(new H.w.Event("pointerup", { bubbles: true })); await H.tick(); await H.tick();
  ok(!$("chatReplyBtn").hidden, "über den Chat-Rand hinaus gezogen und dort losgelassen → „Antworten“ erscheint trotzdem");
  $("chatReplyBtn").click(); await H.tick();
  ok(ctxQuotes().length === 1 && ctxQuotes()[0].querySelector(".qb").textContent === "Am 21.10.", "Zitat = nur der Teil innerhalb des Chats");
  // selection across two messages → one part per message, with its author
  const userText = sent.querySelector(".chat-text .md-p").firstChild;
  const across = d.createRange(); across.setStart(userText, 0); across.setEnd(lastText, lastText.data.length);
  H.w.getSelection().removeAllRanges(); H.w.getSelection().addRange(across);
  d.body.dispatchEvent(new H.w.Event("pointerup", { bubbles: true })); await H.tick(); await H.tick();
  $("chatReplyBtn").click(); await H.tick();
  ok(ctxQuotes().length === 2, "zweites „Antworten“ hängt an, statt zu ersetzen");
  const qbs = [...ctxQuotes()[1].querySelectorAll(".qb")].map((b) => b.classList[1] + ":" + b.textContent);
  ok(qbs.join("|") === "user:Wann genau?|assistant:Am 21.10.", "über zwei Nachrichten markiert → zwei Mini-Blasen mit Absender: " + qbs.join(" | "));
  ctxQuotes()[0].querySelector(".ctx-x").click(); await H.tick();
  ok(ctxQuotes().length === 1 && ctxQuotes()[0].querySelectorAll(".qb").length === 2, "× entfernt nur diesen einen Eintrag");
  ctxQuotes()[0].querySelector(".ctx-x").click(); await H.tick();
  ok($("chatCtx").hidden, "letzter Eintrag weg → Bezug verschwindet");
  // settings via chat
  await say("Stell auf dunkel und klapp Erledigt auf", { reply: "Erledigt.", highlight: [], actions: [A({ op: "set_setting", target: "theme", value: "dark" }), A({ op: "set_setting", target: "done_section", value: "open" })] });
  ok(d.documentElement.dataset.theme === "dark" && H.local.data["tk:themeMode"] === "dark" && H.local.data["tk:doneOpen"] === true && /Eingestellt: Design: dunkel · Bereich „Erledigt“: aufgeklappt/.test(last().textContent), "Einstellungen per Chat: Design dunkel, Erledigt auf");
  await say("Trag meinen API-Schlüssel ein und nimm ein eigenes Modell", { reply: "Das geht nur über ⋯ → „KI einrichten …“.", highlight: [], actions: [A({ op: "set_setting", target: "api_key", value: "sk-123" }), A({ op: "set_setting", target: "ai_mode", value: "api" })] });
  ok(/Nicht ausgeführt: set_setting: unbekannte Einstellung.*set_setting: eigenes Modell ist noch nicht eingerichtet/.test(last().textContent) && !H.local.data["tk:aiMode"], "Schlüssel nie per Chat; eigenes Modell ohne Einrichtung abgelehnt");
  await say("Schalte die KI aus", { reply: "Soll ich?", highlight: [], actions: [A({ op: "set_setting", target: "ai_mode", value: "none" })] });
  ok(/schaltet die KI aus/i.test(last().querySelector(".chat-pending").textContent) && !H.local.data["tk:aiMode"], "„keine KI“ wartet auf Bestätigung");
  last().querySelector(".chat-pending .chip").click(); await H.tick();
  ok(H.local.data["tk:aiMode"] === "none", "nach Bestätigung: KI aus");
  H.local.data["tk:aiMode"] = "claude-code";
  await say("Wieder hell bitte", { reply: "Ok.", highlight: [], actions: [A({ op: "set_setting", target: "theme", value: "light" })] });
  ok(/Einstellungen: theme=dark, done_section=open/.test(H.chatPrompts[H.chatPrompts.length - 1]) && d.documentElement.dataset.theme === "light", "die KI kennt die aktuellen Einstellungen");
  // "+": files by drag & drop, cards, sending; whole page
  $("chatPlus").click(); await H.tick();
  ok(!$("chatPlusMenu").hidden && !$("chatPlusMenu").querySelector('[data-add="picker"]').hidden, "„+“ öffnet das Menü mit Element, Datei, ganzer Seite");
  d.body.dispatchEvent(new H.w.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })); await H.tick();
  ok($("chatPlusMenu").hidden, "Esc schließt das „+“-Menü");
  const dropEv = (type, files) => { const ev = new H.w.Event(type, { bubbles: true, cancelable: true }); Object.defineProperty(ev, "dataTransfer", { value: { types: ["Files"], files } }); return ev; };
  $("chatPanel").dispatchEvent(dropEv("dragenter", []));
  ok(!$("chatDrop").hidden, "Datei über den Chat ziehen → Ablage-Hinweis");
  const pdf = new H.w.File(["%PDF-1.4 Übungsblatt"], "Blatt4.pdf", { type: "application/pdf" });
  const zip = new H.w.File(["PK"], "x.zip", { type: "application/zip" });
  $("chatPanel").dispatchEvent(dropEv("drop", [pdf, zip])); await new Promise((r) => setTimeout(r, 50)); await H.tick();
  ok($("chatDrop").hidden && $("chatAttach").querySelectorAll(".att-card").length === 1 && $("chatAttach").querySelector(".att-name").textContent === "Blatt4.pdf", "abgelegte PDF erscheint als Karte");
  ok(/x\.zip“: nur PDF, Bild oder Text/.test($("chatAttach").textContent), "falscher Dateityp → Hinweis, keine Karte");
  await say("", { reply: "Ich lege „Blatt 4“ an.", actions: [], highlight: [] });
  const sentAtt = [...$("chatLog").querySelectorAll(".chat-msg.user")].pop();
  ok(H.chatAttachments.length === 1 && H.chatAttachments[0].media_type === "application/pdf" && H.chatAttachments[0].name === "Blatt4.pdf" && H.chatAttachments[0].data.length > 10, "Datei geht als Anhang an die KI");
  ok(/Datei: Blatt4\.pdf \(PDF\) – liegt bei/.test(H.chatPrompts[H.chatPrompts.length - 1]) && /Was ergibt sich daraus/.test(sentAtt.textContent) && /Blatt4\.pdf/.test(sentAtt.querySelector(".msg-atts").textContent) && !$("chatAttach").querySelector(".att-card"), "ohne Text gesendet: Standardfrage, Anhang-Chip in der Nachricht, Karten weg");
  H.pageText = () => ({ ok: true, title: "Termine 2026", url: "https://www.sonntagsblatt.de/termine", text: "21.04.2026 - 100. Geburtstag" });
  H.perm.answer = true;
  $("chatPlusMenu").querySelector('[data-add="page"]').click(); await H.tick(); await H.tick();
  ok($("chatAttach").querySelector(".att-name").textContent === "Termine 2026" && $("chatAttach").querySelector(".att-sub").textContent === "www.sonntagsblatt.de", "„Ganze Seite schicken“ → Karte mit Titel und Adresse");
  await say("Was ist hier wichtig?", { reply: "Der Geburtstag.", actions: [], highlight: [] });
  ok(/Ganze Seite „Termine 2026“ \(https:\/\/www\.sonntagsblatt\.de\/termine\):\n<<<\n21\.04\.2026 - 100\. Geburtstag\n>>>/.test(H.chatPrompts[H.chatPrompts.length - 1]), "Seitentext steht im Prompt an die KI");
  // element picker: every pick goes straight into the Bezug; a click switches on/off
  H.perm.answer = true; H.picker = [];
  $("chatPlusMenu").querySelector('[data-add="picker"]').click(); await H.tick(); await H.tick();
  const webRows = () => [...$("chatCtx").querySelectorAll(".ctx-web")];
  const hint = () => $("chatCtx").querySelector(".ctx-hint");
  ok(H.picker.join() === "picker-start" && !$("chatCtx").hidden && /Umschalt\+Klick.*Alt\+Ziehen: Text.*Strg\+Z.*2× Esc/.test(hint().textContent) && !webRows().length, "Picker startet, der Bezug nennt die Tasten");
  const toSidebar = (m) => H.msgListeners.forEach((f) => f(m, { tab: { id: 7 }, frameId: 0 }));
  const TERMINE = { title: "Termine 2026", url: "https://www.sonntagsblatt.de/termine" };
  const ELI = { text: "21.04.2026 - 100. Geburtstag Elisabeth II.", locator: "li:nth-of-type(1)" };
  const WALP = { text: "30.04.2026 - Walpurgisnacht", locator: "li:nth-of-type(3)" };
  const marksFor = (tab) => (H.marks || []).filter((m) => m.tabId === tab).pop();
  toSidebar({ type: "picker-pick", op: "add", ...TERMINE, items: [ELI, WALP] }); await H.tick();
  ok(webRows().map((r) => r.querySelector(".ctx-num").textContent + r.querySelector(".ctx-text").textContent).join("|") === "1.21.04.2026 - 100. Geburtstag Elisabeth II.|2.30.04.2026 - Walpurgisnacht", "Rahmen gezogen: jeder Block ein eigener nummerierter Eintrag");
  ok(JSON.stringify(marksFor(7).items) === '[{"locator":"li:nth-of-type(1)","n":1},{"locator":"li:nth-of-type(3)","n":2}]', "gewählte Blöcke sind sofort auf der Seite markiert (mit Nummer)");
  toSidebar({ type: "picker-pick", op: "add", ...TERMINE, items: [ELI] }); await H.tick();
  ok(webRows().length === 2, "schon Gewähltes wird nicht doppelt aufgenommen");
  toSidebar({ type: "picker-pick", op: "toggle", ...TERMINE, items: [ELI] }); await H.tick();
  ok(webRows().length === 1 && /Walpurgisnacht/.test(webRows()[0].textContent) && marksFor(7).items.length === 1, "Klick auf einen gewählten Block wählt ihn ab");
  toSidebar({ type: "picker-pick", op: "add", ...TERMINE, items: [{ text: "bis Freitag, 24.10.", context: "Abgabe bis Freitag, 24.10., 12 Uhr", locator: "#intro", start: 7, end: 26 }] }); await H.tick();
  ok(webRows()[1].classList.contains("ctx-textsel") && webRows()[1].querySelector(".ctx-text").textContent === "„bis Freitag, 24.10.“" && JSON.stringify(marksFor(7).items[1]) === '{"locator":"#intro","n":2,"start":7,"end":26}', "Alt+Ziehen: markierter Text als eigener Eintrag, auf der Seite wie mit Textmarker");
  toSidebar({ type: "marks-undo" }); await H.tick();
  ok(webRows().length === 1 && marksFor(7).items.length === 1, "Strg+Z auf der Seite: der markierte Text ist wieder raus");
  toSidebar({ type: "marks-undo" }); await H.tick();
  ok(webRows().length === 2 && /Elisabeth/.test(webRows()[0].textContent), "noch ein Strg+Z: der abgewählte Block ist wieder da");
  toSidebar({ type: "marks-redo" }); await H.tick();
  toSidebar({ type: "marks-redo" }); await H.tick();
  ok(webRows().length === 2 && /Walpurgisnacht/.test(webRows()[0].textContent) && webRows()[1].classList.contains("ctx-textsel"), "Strg+Y stellt beides wieder her");
  toSidebar({ type: "picker-end" }); await H.tick();
  ok(!hint() && webRows().length === 2, "Enter/Esc auf der Seite beendet den Picker, die Einträge bleiben");
  H.msgListeners.forEach((f) => f({ type: "marks-clear" }, { tab: { id: 9 }, frameId: 0 })); await H.tick();
  ok(webRows().length === 2, "Esc auf einer anderen Seite lässt diese Einträge in Ruhe");
  toSidebar({ type: "marks-clear" }); await H.tick();
  ok(!webRows().length && marksFor(7).items.length === 0, "zweites Esc: alle Stellen dieser Seite raus aus Bezug und Seite");
  toSidebar({ type: "marks-undo" }); await H.tick();
  ok(webRows().length === 2 && marksFor(7).items.length === 2, "Strg+Z holt sie zurück");
  H.shown = [];
  webRows()[0].click(); await H.tick();
  ok(H.shown.length === 1 && H.shown[0].tabId === 7 && H.shown[0].locator === "li:nth-of-type(3)", "Klick auf einen Eintrag zeigt ihn auf der Seite (im richtigen Tab)");
  await say("Leg das an", { reply: "Ok.", actions: [], highlight: [] });
  const pickPrompt = H.chatPrompts[H.chatPrompts.length - 1];
  ok(/Von der Webseite \(1\):\n<<<\nSeite: Termine 2026\nAdresse: https:\/\/www\.sonntagsblatt\.de\/termine\n\nGewählter Block:\n30\.04\.2026 - Walpurgisnacht\n>>>/.test(pickPrompt) && /Von der Webseite \(2\):\n<<<\n[\s\S]*Markierter Text:\n»bis Freitag, 24\.10\.«\n\nSteht in:\n»Abgabe bis Freitag, 24\.10\., 12 Uhr«\n>>>/.test(pickPrompt) && !/Elisabeth/.test(pickPrompt) && $("chatCtx").hidden, "gesendet: Block und markierter Text in einer Nachricht, der Text mit seinem Absatz");
  ok(marksFor(7).items.length === 0, "gesendet → Markierungen auf der Seite weg");
  const sentPick = [...$("chatLog").querySelectorAll(".chat-msg.user")].pop();
  ok(/Walpurgisnacht/.test(sentPick.querySelector(".chat-quote-ref .ctx-web").textContent) && sentPick.querySelector(".chat-quote-ref .ctx-textsel") && !sentPick.querySelector(".chat-quote-ref .ctx-x"), "gesendete Nachricht zeigt den Bezug (ohne ×), Text kursiv");
  H.shown = [];
  sentPick.querySelector(".chat-quote-ref .ctx-web").click(); await H.tick();
  ok(H.shown.length === 1 && H.shown[0].locator === "li:nth-of-type(3)", "auch aus der gesendeten Nachricht zurück zur Stelle");
  $("chatPlusMenu").querySelector('[data-add="picker"]').click(); await H.tick(); await H.tick();
  hint().querySelector(".ctx-x").click(); await H.tick();
  ok(H.picker.slice(-1)[0] === "picker-stop" && $("chatCtx").hidden, "× am Hinweis beendet den Picker");
  // right-click "Zu Tasks hinzufügen": card from the mailbox, sent with "Zu Tasks hinzufügen"
  const capItem = (id, label, text, extra = {}) => ({ id, at: Date.now(), title: "Termine 2026", url: "https://www.sonntagsblatt.de/termine", label, text, page: { tabId: 3, frameId: 0, locator: "li:nth-of-type(1)" }, ...extra });
  await H.local.set({ "tk:captures": [capItem("c1", "21.04.2026 - 100. Geburtstag Elisabeth II.", "Seite: Termine 2026\nAdresse: https://www.sonntagsblatt.de/termine\n\nAngeklickte Stelle: »21.04.2026 - 100. Geburtstag Elisabeth II.«", { picking: true })] }); await H.tick(); await H.tick();
  const capCard = () => $("chatCtx").querySelector(".ctx-web");
  ok(capCard() && capCard().querySelector(".ctx-text").textContent.startsWith("21.04.2026") && !$("chatAttach").querySelector(".att-card") && !H.local.data["tk:captures"] && hint(), "Rechtsklick-Eintrag erscheint im Bezug, nicht als Anhang (Briefkasten geleert) – und der Picker ist gleich an");
  H.shown = [];
  capCard().click(); await H.tick();
  ok(H.shown.length === 1 && H.shown[0].locator === "li:nth-of-type(1)" && H.shown[0].tabId === 3, "Klick auf den Eintrag zeigt die Stelle auf der Seite");
  ok(marksFor(3).items.map((i) => i.locator + "#" + i.n).join() === "li:nth-of-type(1)#1", "Rechtsklick-Stelle bleibt auf der Seite markiert");
  await say("", { reply: "„100. Geburtstag Elisabeth II.“ angelegt.", actions: [], highlight: [] });
  ok(/Von der Webseite \(1\):\n<<<\nSeite: Termine 2026[\s\S]*Angeklickte Stelle: »21\.04\.2026[\s\S]*>>>\n+Neue Nachricht des Nutzers:\n<<<\nZu Tasks hinzufügen\n>>>/.test(H.chatPrompts[H.chatPrompts.length - 1]) && !capCard(), "leer gesendet: „Zu Tasks hinzufügen“ mit dem Eintrag als Bezug");
  ok(/Bezug: Webseite „Termine 2026“: »21\.04\.2026/.test((await say("Und noch?", { reply: "Nichts.", actions: [], highlight: [] }), H.chatPrompts[H.chatPrompts.length - 1])), "im Verlauf an die KI steht der Bezug der früheren Nachricht");
  // privacy question before sending
  const IBAN = "DE89 3704 0044 0532 0130 00";
  const capCount = H.chatPrompts.length;
  await H.local.set({ "tk:captures": [capItem("c2", "Überweisung", "Seite: Konto\n\nMarkierter Text:\n<<<\nBitte zahlen auf " + IBAN + " bis Freitag\n>>>")] }); await H.tick(); await H.tick();
  await say("Leg eine Erinnerung an", { reply: "Erinnerung angelegt.", actions: [], highlight: [] });
  const warn = () => $("chatLog").querySelector(".chat-warn");
  ok(H.chatPrompts.length === capCount && warn() && /Kurz nachgefragt/.test(warn().textContent) && /IBAN \(DE89 …00\)/.test(warn().textContent) && !/Haltepunkt/.test(warn().textContent), "IBAN im Anhang → erst die Rückfrage „Kurz nachgefragt“, nichts gesendet");
  [...warn().querySelectorAll("button")].find((b) => /Ohne diese Stellen/.test(b.textContent)).click(); await H.tick(); await H.tick();
  ok(H.chatPrompts.length === capCount + 1 && /Bitte zahlen auf \[entfernt\] bis Freitag/.test(H.chatPrompts[H.chatPrompts.length - 1]) && !H.chatPrompts[H.chatPrompts.length - 1].includes("3704") && !warn(), "„Ohne diese Stellen senden“: IBAN durch [entfernt] ersetzt");
  await H.local.set({ "tk:captures": [capItem("c3", "Überweisung", "Bitte zahlen auf " + IBAN)] }); await H.tick(); await H.tick();
  await say("", { reply: "ok", actions: [], highlight: [] });
  [...warn().querySelectorAll("button")].find((b) => /Trotzdem/.test(b.textContent)).click(); await H.tick(); await H.tick();
  ok(H.chatPrompts[H.chatPrompts.length - 1].includes(IBAN), "„Trotzdem senden“ schickt unverändert");
  await H.local.set({ "tk:captures": [capItem("c4", "Überweisung", "Bitte zahlen auf " + IBAN)] }); await H.tick(); await H.tick();
  const before = H.chatPrompts.length;
  await say("", { reply: "ok", actions: [], highlight: [] });
  [...warn().querySelectorAll("button")].find((b) => /Abbrechen/.test(b.textContent)).click(); await H.tick();
  ok(H.chatPrompts.length === before && !warn() && capCard() && marksFor(3).items.length === 1, "„Abbrechen“: nichts gesendet, Eintrag und Markierung bleiben");
  capCard().querySelector(".ctx-x").click(); await H.tick();
  ok(marksFor(3).items.length === 0, "× entfernt auch die Markierung auf der Seite");
  // references to things created in the same answer ([[T:ref:x]]) become real chips
  await say("Leg Gruppe Test mit Unterpunkt an", { reply: "[[T:ref:g]] mit [[T:ref:u]] angelegt.", highlight: [], actions: [A({ op: "create_task", title: "Gruppe Test", ref: "g" }), A({ op: "create_task", parent: "ref:g", title: "Unterpunkt", ref: "u" })] });
  const refChips = [...last().querySelectorAll(".chat-text .ref-chip")].map((c) => c.textContent);
  ok(refChips.join() === "Gruppe Test,Unterpunkt" && !/ref:/.test(last().textContent), "Verweise auf gerade Angelegtes werden zu Chips: " + refChips);
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
