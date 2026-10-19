// Run: npm test (all) or npm test <name>
// background.js in a sandbox: context menu, right-click into the chat mailbox,
// page scripts plumbing, chat requests to Claude Code and to custom models.
const ROOT = require("node:path").resolve(__dirname, "..");
const fs = require("fs"); const vm = require("vm");
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
function area() { const data = {}; return { data,
  async get(k) { if (k == null) return structuredClone(data); const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = structuredClone(data[x]); return o; },
  async set(o) { Object.assign(data, structuredClone(o)); }, async remove(k) { for (const x of [].concat(k)) delete data[x]; } }; }
const sync = area(), local = area();
const storageListeners = [], msgListeners = [];
let clickHandler, opened = 0, lastMsg, reply, nativeCalls = 0, permGranted = true, lastReq, apiReply, reqs = [], scripts = [], capReply = () => ({}), activated = [], connectHandler, tabUpdated = new Set();
const URL0 = "https://ilias.hhu.de/ilias.php?baseClass=ilexercisehandlergui&ref_id=2209395&ass_id=74843";
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL: globalThis.URL, TextDecoder, atob, btoa,
  fetch: async (url, init) => { const r = { url, init, body: JSON.parse(init.body) }; reqs.push(r); lastReq = r; return apiReply(r); },
  browser: { storage: { sync, local, onChanged: { addListener(f) { storageListeners.push(f); } } },
    runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onConnect: { addListener(f) { connectHandler = f; } }, onMessage: { addListener(f) { msgListeners.push(f); } },
      sendNativeMessage: async (name, msg) => { lastMsg = { name, msg }; nativeCalls++; return reply(); } },
    permissions: { async contains() { return permGranted; } },
    browserAction: { onClicked: { addListener() {} } },
    sidebarAction: { open() { opened++; }, toggle() {} },
    contextMenus: { create(o) { ctx.menu = o; }, async removeAll() { ctx.menu = null; }, onClicked: { addListener(f) { clickHandler = f; } } },
    tabs: { onUpdated: { addListener(f) { tabUpdated.add(f); }, removeListener(f) { tabUpdated.delete(f); } }, async update(id, o) { activated.push([id, o.active]); },
      async query() { return [{ id: 5, url: "https://www.sonntagsblatt.de/termine", title: "Termine 2026" }]; },
      async executeScript(id, o) { scripts.push(o);
        if (/\.flash\(/.test(o.code)) return [true];
        if (/pickerInPage/.test(o.code)) return [{ ok: true, title: "Termine 2026", url: "https://www.sonntagsblatt.de/termine" }];
        return [capReply()]; } } } };
vm.createContext(ctx);
for (const f of ["shared/privacy.js", "background.js"]) vm.runInContext(fs.readFileSync(ROOT + "/" + f, "utf8"), ctx);
const tick = () => new Promise((r) => setTimeout(r, 20));
const okReply = (obj) => () => ({ ok: true, data: obj });
const ask = (prompt, attachments) => msgListeners.map((f) => f({ type: "chat", prompt, attachments })).find(Boolean);
const capture = async (info, cap, tab = { id: 1, url: URL0, title: "Übung 2" }) => {
  capReply = () => cap; scripts = [];
  clickHandler({ menuItemId: "tasks-add-selection", frameId: 0, ...info }, tab); await tick(); await tick();
  const q = local.data["tk:captures"] || []; return q[q.length - 1];
};
(async () => {
  await tick();
  ok(ctx.menu && ["selection", "link", "image", "page"].every((c) => ctx.menu.contexts.includes(c)) && ctx.menu.title === "Zu Tasks hinzufügen", "Kontextmenü bei Markierung, Link, Bild und irgendwo auf der Seite");
  const modeChange = async (v) => { local.data["tk:aiMode"] = v; storageListeners.forEach((f) => f({ "tk:aiMode": { newValue: v } }, "local")); await tick(); };
  await modeChange("none");
  ok(ctx.menu === null, "„Keine KI“ → Eintrag verschwindet aus dem Kontextmenü");
  await modeChange("claude-code");
  ok(ctx.menu && ctx.menu.id === "tasks-add-selection", "zurück auf Claude Code → Eintrag wieder da");

  // --- right-click → card in the chat mailbox, nothing goes to the AI yet
  const PDF = "https://ilias.hhu.de/blatt2.pdf";
  let c = await capture({ selectionText: "Blatt 2 ist online" }, { selection: "Blatt 2 ist online\nAbgabe 26.10.", links: [{ text: "Blatt 2", href: PDF }], locator: "body > p" });
  ok(opened === 1 && c && c.label === "Blatt 2 ist online" && nativeCalls === 0, "Rechtsklick: Seitenleiste geht auf, Stelle landet als Karte im Chat – noch ohne KI-Anfrage");
  ok(c.picking === true && scripts.some((s) => /pickerInPage/.test(s.code) && /unitOfInPage/.test(s.code) && /"anchor":"body > p"/.test(s.code)), "Rechtsklick startet gleich den Picker in diesem Tab – Umschalt+Klick geht ab der angeklickten Stelle");
  ok(/^Seite: Übung 2\nAdresse: https:\/\/ilias/.test(c.text) && /Markierter Text:\n<<<\nBlatt 2 ist online\nAbgabe 26\.10\.\n>>>/.test(c.text) && /Links in der Markierung:\n- Blatt 2 → https:\/\/ilias\.hhu\.de\/blatt2\.pdf/.test(c.text), "Karte enthält Seite, Adresse, Markierung mit Zeilenumbrüchen und Link-Zielen");
  ok(c.page && c.page.locator === "body > p" && c.page.tabId === 1 && scripts.some((o) => /marksInPage/.test(o.code) && /\.flash\(\{"locator":"body > p"\}/.test(o.code)), "Stelle leuchtet auf der Seite auf; Pfad für „Auf der Seite zeigen“ steht in der Karte");
  c = await capture({ linkUrl: PDF, linkText: "Blatt 3", targetElementId: 42 }, { selection: "", section: "Übungen\nBlatt 3 – Abgabe 26. Okt", heading: "Übungen" });
  ok(/Angeklickt: Link „Blatt 3" → https:\/\/ilias\.hhu\.de\/blatt2\.pdf/.test(c.text) && /Abschnitt um die angeklickte Stelle \(Überschrift: „Übungen"\)/.test(c.text) && !/Markierter Text/.test(c.text) && c.label === "Blatt 3" && /Blatt 3/.test(c.excerpt), "Rechtsklick auf Link: Linktext, Ziel und Abschnitt");
  ok(scripts.some((o) => /"targetId":42/.test(o.code) && /cssPathInPage/.test(o.code)), "angeklicktes Element geht an das Seiten-Skript");
  c = await capture({ srcUrl: "https://x.de/flyer.jpg", mediaType: "image", targetElementId: 7 }, { image: { alt: "Flyer Sommerfest", caption: "Sommerfest 12.7." }, locator: "img" });
  ok(/Angeklickt: Bild https:\/\/x\.de\/flyer\.jpg – Alternativtext: „Flyer Sommerfest" – Bildunterschrift: „Sommerfest 12\.7\."/.test(c.text) && c.label === "Flyer Sommerfest" && !c.image, "Rechtsklick auf Bild: Angaben im Text (Bild-Ausschnitt nur im echten Firefox)");
  c = await capture({}, {});
  ok(/gemeint ist die Seite selbst/.test(c.text) && c.label === "Übung 2", "Rechtsklick irgendwo: die Seite ist gemeint, Karte heißt wie die Seite");
  const ELI = "21.04.2026 - 100. Geburtstag Elisabeth II.";
  c = await capture({ targetElementId: 9 }, { section: "Termine April 2026\n" + ELI + "\n29.04.2026 - 75. Todestag Ludwig Wittgenstein", heading: "Termine April 2026", clicked: ELI });
  ok(/Angeklickte Stelle: »21\.04\.2026 - 100\. Geburtstag Elisabeth II\.«\n\nAbschnitt um die angeklickte Stelle/.test(c.text) && c.label === ELI && c.excerpt === ELI, "Rechtsklick auf eine Zeile: die Zeile selbst getrennt vor dem Abschnitt (und als Text für die Liste im Chat)");
  ok(local.data["tk:captures"].length === 5 && nativeCalls === 0, "mehrere Rechtsklicks sammeln sich im Briefkasten");
  for (let i = 0; i < 8; i++) await capture({}, {});
  ok(local.data["tk:captures"].length === 10, "höchstens 10 Einträge im Briefkasten");

  // --- page scripts plumbing
  scripts = [];
  const shown = await msgListeners.map((f) => f({ type: "show-on-page", tabId: 1, frameId: 0, locator: "body > p" })).find(Boolean);
  ok(shown && shown.ok && /"scroll":true/.test(scripts[0].code) && activated.join() === "1,true", "„Auf der Seite zeigen“: holt den Tab nach vorn, scrollt hin und hebt hervor");
  // marks of the Bezug: drawn per tab, gone when the sidebar closes
  scripts = [];
  const port = { name: "marks", onMessage: { addListener(f) { port.send = f; } }, onDisconnect: { addListener(f) { port.close = f; } } };
  connectHandler(port);
  port.send({ type: "marks-set", tabId: 4, frameId: 0, items: [{ locator: "li", n: 2 }] }); await tick();
  ok(scripts.length === 1 && /marksInPage/.test(scripts[0].code) && /"items":\[\{"locator":"li","n":2\}\]/.test(scripts[0].code), "Bezug: Stellen bleiben auf der Seite markiert (mit Nummer aus der Liste)");
  tabUpdated.forEach((f) => f(5, { status: "complete" }));
  tabUpdated.forEach((f) => f(4, { status: "loading" }));
  ok(scripts.length === 1, "andere Tabs und halb geladene Seiten: nichts neu zeichnen");
  tabUpdated.forEach((f) => f(4, { status: "complete" })); await tick();
  ok(scripts.length === 2 && /"items":\[\{"locator":"li","n":2\}\]/.test(scripts[1].code), "Seite neu geladen → Markierungen kommen wieder");
  port.close(); await tick();
  ok(scripts.length === 3 && /"items":\[\],"off":true/.test(scripts[2].code) && !tabUpdated.size, "Seitenleiste zu → Markierungen und Tasten verschwinden");
  scripts = [];
  const pk = await msgListeners.map((f) => f({ type: "picker-start" })).find(Boolean);
  ok(pk && pk.ok && pk.title === "Termine 2026" && /__tasksPicker\.stop\(false\)/.test(scripts[0].code) && /pickerInPage/.test(scripts[1].code) && /cssPathInPage/.test(scripts[1].code), "Picker startet im aktiven Tab (ein laufender anderer endet vorher)");
  scripts = [];
  const pst = await msgListeners.map((f) => f({ type: "picker-stop" })).find(Boolean);
  ok(pst && pst.ok && scripts.length === 1 && /__tasksPicker\.stop\(false\)/.test(scripts[0].code), "Picker beenden: in dem Tab, in dem er läuft");
  scripts = [];
  await msgListeners.map((f) => f({ type: "picker-stop" })).find(Boolean);
  ok(scripts.length === 0, "läuft keiner, passiert nichts");

  // --- chat requests through Claude Code
  const ans = { reply: "ok", actions: [], highlight: [] };
  reply = () => { throw new Error("No such native application tasks_claude"); };
  let r = await ask("Hallo");
  ok(!r.ok && /install\.sh/.test(r.error), "Hilfsprogramm fehlt → Einrichtungs-Hinweis");
  reply = okReply(ans);
  r = await ask("Hallo");
  ok(r.ok && lastMsg.name === "tasks_claude" && lastMsg.msg.prompt === "Hallo" && lastMsg.msg.system.includes("Assistent der Aufgaben-Erweiterung") && lastMsg.msg.schema.properties.actions, "Chat-Anfrage geht ans Hilfsprogramm (Anweisungen + Antwortformat)");
  ok(/Einträge von Webseiten/.test(lastMsg.msg.system) && /Elternaufgabe an \(create_task mit ref/.test(lastMsg.msg.system) && /Start- und Veröffentlichungsdaten sind keine Fälligkeit/.test(lastMsg.msg.system), "Anweisungen enthalten die Regeln für Einträge von Webseiten (Ort, Gruppe, Fälligkeit)");
  reply = () => ({ ok: false, error: "Not logged in · Please run /login" });
  r = await ask("x");
  ok(!r.ok && /login/.test(r.error), "Fehler aus Claude Code kommt durch");
  reply = okReply(ans);
  const att = [{ media_type: "application/pdf", data: "JVBERi0=", name: "Blatt4.pdf" }];
  await ask("Was steht drin?", att);
  ok(lastMsg.msg.attachments && lastMsg.msg.attachments[0].name === "Blatt4.pdf" && lastMsg.msg.prompt === "Was steht drin?", "Chat-Anhänge gehen an das Hilfsprogramm");

  // --- custom model via API
  const anthrOk = (obj) => () => ({ ok: true, status: 200, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }] }) });
  const oaText = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: text } }] }) });
  delete local.data["tk:aiMode"]; reply = () => { throw new Error("No such native application tasks_claude"); };
  local.data["tk:api"] = { preset: "anthropic", label: "Anthropic (Claude)", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", key: "sk-ant-test9999" };
  apiReply = anthrOk({ ...ans, reply: "von Anthropic" }); reqs = [];
  r = await ask("Hallo");
  ok(reqs.length === 1 && r.ok && r.data.reply === "von Anthropic", "Claude Code fehlt → eigenes Modell (Anthropic) als Ersatz");
  const hq = reqs[0].init.headers, bq = reqs[0].body;
  ok(reqs[0].url === "https://api.anthropic.com/v1/messages" && hq["x-api-key"] === "sk-ant-test9999" && hq["anthropic-dangerous-direct-browser-access"] === "true" && bq.model === "claude-opus-5-5" && bq.output_config.format.type === "json_schema", "Anthropic: Schlüssel, Browser-Freigabe, Modell, JSON-Schema");
  reqs = []; await ask("Was steht drin?", att);
  ok(reqs[0].body.messages[0].content[0].type === "document" && reqs[0].body.messages[0].content[1].text === "Was steht drin?", "eigenes Claude-Modell: PDF als document-Block");
  local.data["tk:aiMode"] = "api"; nativeCalls = 0;
  local.data["tk:api"] = { preset: "ollama", label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen-test", key: "" };
  apiReply = (q) => q.body.response_format && q.body.response_format.type === "json_schema"
    ? { ok: false, status: 400, json: async () => ({ error: "response_format json_schema not supported" }) }
    : oaText("<think>hmm …</think>\n```json\n" + JSON.stringify({ ...ans, reply: "lokal", highlight: null }) + "\n```");
  reqs = []; r = await ask("Hallo");
  ok(nativeCalls === 0 && reqs.length === 2 && reqs[0].url === "http://localhost:11434/v1/chat/completions", "„Eigenes Modell“ bevorzugt → direkt lokal (Ollama), Claude Code nicht gefragt");
  ok(reqs[1].body.response_format.type === "json_object" && reqs[1].body.model === "qwen-test" && !reqs[0].init.headers.authorization, "Schema abgelehnt → einfaches JSON; lokal ohne Schlüssel keine Anmeldung");
  ok(r.ok && r.data.reply === "lokal", "Antwort mit Denk-Text und ```-Block wird sauber gelesen");
  const pdfErr = await ask("x", att);
  ok(pdfErr && !pdfErr.ok && /PDFs gehen mit diesem Modell nicht/.test(pdfErr.error), "OpenAI-kompatibles Modell: PDF → klare Meldung");
  local.data["tk:api"] = { preset: "openai", label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", model: "irgendein-modell", key: "sk-oa-xyz" };
  apiReply = () => oaText(JSON.stringify(ans)); reqs = []; await ask("Hallo");
  ok(reqs.length === 1 && reqs[0].init.headers.authorization === "Bearer sk-oa-xyz" && reqs[0].body.response_format.json_schema.schema.required.includes("actions"), "OpenAI-kompatibel: Bearer-Schlüssel + JSON-Schema");
  apiReply = () => ({ ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) });
  r = await ask("Hallo");
  ok(!r.ok && /OpenAI: .*„irgendein-modell“ nicht gefunden/.test(r.error), "Fehler nennt Anbieter und Modell");
  delete local.data["tk:api"]; r = await ask("Hallo");
  ok(!r.ok && /nicht vollständig eingetragen/.test(r.error), "eigenes Modell bevorzugt, aber nicht eingetragen → klare Meldung");
  local.data["tk:api"] = { preset: "ollama", label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "m", key: "" };
  permGranted = false; reqs = []; r = await ask("Hallo");
  ok(reqs.length === 0 && !r.ok && /nicht erlaubt/.test(r.error), "Zugriff fehlt → kein Aufruf, klare Meldung");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
