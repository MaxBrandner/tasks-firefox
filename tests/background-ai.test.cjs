// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const fs = require("fs"); const vm = require("vm");
const P = ROOT;
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
function area() { const data = {}; return { data,
  async get(k) { if (k == null) return structuredClone(data); const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = structuredClone(data[x]); return o; },
  async set(o) { Object.assign(data, structuredClone(o)); }, async remove(k) { for (const x of [].concat(k)) delete data[x]; } }; }
const sync = area(), local = area();
const storageListeners = [];
let capReply = () => ({ selection: SEL }), lastScript, scripts = [];
const msgListeners = [];
let clickHandler, opened = 0, lastMsg, reply, nativeCalls = 0, permGranted = true, lastReq, apiReply;
const SEL = "Übung 1\nArbeitsanweisung\n\nIn der ersten Übungseinheit geht es darum, sich mit der im Modul verwendeten Programmiersprache Python und Jupyter Notebooks vertraut zu machen.\n\nTerminplan\nStartzeit: 12. Okt 2026, 10:00\nAbgabetermin: 19. Okt 2026, 08:30\nVerbleibende Bearbeitungsdauer: 1 Tag, 18 Stunden";
const URL = "https://ilias.hhu.de/ilias.php?baseClass=ilexercisehandlergui&cmdNode=dk:os:5b&cmdClass=ilAssignmentPresentationGUI&ref_id=2209395&from_overview=1&ass_id=74843";
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL: globalThis.URL,
  fetch: async (url, init) => { lastReq = { url, init, body: JSON.parse(init.body) }; return apiReply(); },
  browser: { storage: { sync, local, onChanged: { addListener(f) { storageListeners.push(f); } } },
    runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onMessage: { addListener(f) { msgListeners.push(f); } }, sendNativeMessage: async (name, msg) => { lastMsg = { name, msg }; nativeCalls++; return reply(); } },
    permissions: { async contains() { return permGranted; } },
    browserAction: { onClicked: { addListener() {} } },
    sidebarAction: { open() { opened++; }, toggle() {} },
    contextMenus: { create(o) { ctx.menu = o; }, async removeAll() { ctx.menu = null; }, onClicked: { addListener(f) { clickHandler = f; } } },
    tabs: { async query() { return [{ id: 5, url: "https://www.sonntagsblatt.de/termine", title: "Termine 2026" }]; }, async executeScript(id, o) { scripts.push(o); if (/pickerInPage/.test(o.code)) return [{ ok: true, title: "Termine 2026", url: "https://www.sonntagsblatt.de/termine" }]; if (/highlightInPage/.test(o.code)) return [true]; lastScript = o; return [capReply()]; } } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(P + "/background.js", "utf8"), ctx);
const tick = () => new Promise((r) => setTimeout(r, 20));
const okReply = (obj) => () => ({ ok: true, data: obj });
const click = async () => { clickHandler({ menuItemId: "tasks-add-selection", frameId: 0, selectionText: "flach" }, { id: 1, url: URL, title: "Übung 1" }); await tick(); };
(async () => {
  await tick();
  ok(ctx.menu && ctx.menu.contexts.includes("selection") && ctx.menu.title === "Zu Tasks hinzufügen", "Kontextmenü-Eintrag bei Markierung");
  const modeChange = async (v) => { local.data["tk:aiMode"] = v; storageListeners.forEach((f) => f({ "tk:aiMode": { newValue: v } }, "local")); await tick(); };
  await modeChange("none");
  ok(ctx.menu === null, "„Keine KI“ → Eintrag verschwindet aus dem Kontextmenü");
  await modeChange("claude-code");
  ok(ctx.menu && ctx.menu.id === "tasks-add-selection", "zurück auf Claude Code → Eintrag wieder da");
  sync.data["L:default"] = { t: "Meine Aufgaben", o: 0 };
  sync.data["L:uni"] = { t: "Uni", o: 1 };
  sync.data["T:ni"] = { l: "uni", t: "nat Info", o: 0 };
  sync.data["T:b0"] = { l: "uni", p: "ni", t: "Blatt 0", x: true, o: 0 };
  reply = () => { throw new Error("No such native application tasks_claude"); };
  await click();
  ok(opened === 1 && local.data["tk:aiStatus"].state === "error" && /install\.sh/.test(local.data["tk:aiStatus"].text), "Hilfsprogramm fehlt: Seitenleiste geht auf + Einrichtungs-Hinweis");
  reply = okReply({ list_id: "uni", parent_id: "ni", update_task_id: "", title: "Blatt 1", notes: "Python & Jupyter Notebooks", due_date: "2026-10-19", due_time: "08:30", link_title: "Abgabe Blatt 1", summary: "„Blatt 1“ unter nat Info angelegt" });
  await click();
  ok(lastMsg.name === "tasks_claude" && lastMsg.msg.system.includes("Aufgabenliste") && lastMsg.msg.schema.required.includes("due_time"), "Anfrage geht ans Hilfsprogramm (Systemprompt + Antwortformat)");
  const msg = lastMsg.msg.prompt;
  ok(msg.includes("Abgabetermin: 19. Okt 2026, 08:30\nVerbleibende") && msg.includes("nat Info (id: ni)") && msg.includes("[x] Blatt 0") && msg.includes(URL), "gesendet: Markierung mit Zeilenumbrüchen, Baum mit IDs, Adresse");
  const st = local.data["tk:aiStatus"], t = sync.data["T:" + st.taskId];
  ok(st.state === "done" && t && t.l === "uni" && t.p === "ni" && t.t === "Blatt 1" && t.d === "2026-10-19" && t.h === "08:30", "„Blatt 1“ unter nat Info, fällig 19.10. 08:30");
  ok(t.n === "Python & Jupyter Notebooks" && JSON.stringify(t.u) === JSON.stringify([{ url: URL, t: "Abgabe Blatt 1" }]), "Link im eigenen Feld (Name von der KI), Notiz ohne Link");
  ok(t.o > 0 && st.before["T:" + st.taskId] === null, "hinter Blatt 0 einsortiert; Strg+Z-Info dabei");
  reply = okReply({ list_id: "gibtsnicht", parent_id: "xyz", update_task_id: "", title: "Irgendwas", notes: "", due_date: "19.10.2026", due_time: "8 Uhr", summary: "ok" });
  await click();
  const t3 = sync.data["T:" + local.data["tk:aiStatus"].taskId];
  ok(t3.l === "default" && !t3.p && !t3.d && !t3.h, "erfundene IDs / falsches Datumsformat werden verworfen");
  reply = okReply({ list_id: "uni", parent_id: "ni", update_task_id: st.taskId, title: "Blatt 1", notes: "", due_date: "2026-10-20", due_time: "10:00", summary: "ergänzt" });
  const count = Object.keys(sync.data).length;
  await click();
  ok(Object.keys(sync.data).length === count && sync.data["T:" + st.taskId].d === "2026-10-20", "gleiche Aufgabe wird ergänzt statt doppelt angelegt");
  ok(sync.data["T:" + st.taskId].u.length === 1, "derselbe Link kommt beim Ergänzen nicht doppelt dazu");
  reply = okReply({ list_id: "uni", parent_id: "ni", update_task_id: "", title: "Notiz", notes: "", due_date: "", due_time: "", link_title: "x", summary: "ok" });
  clickHandler({ menuItemId: "tasks-add-selection", frameId: 0 }, { id: 1, url: "about:blank", title: "leer" }); await tick();
  ok(!sync.data["T:" + local.data["tk:aiStatus"].taskId].u, "Nicht-Web-Seite (about:) → kein Link");
  reply = () => ({ ok: false, error: "Not logged in · Please run /login" });
  await click();
  ok(local.data["tk:aiStatus"].state === "error" && /login/.test(local.data["tk:aiStatus"].text), "Fehler aus Claude Code wird angezeigt");
  // --- custom model via API
  let reqs = [];
  ctx.fetch = async (url, init) => { const r = { url, init, body: JSON.parse(init.body) }; reqs.push(r); lastReq = r; return apiReply(r); };
  const anthrOk = (obj) => () => ({ ok: true, status: 200, json: async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(obj) }] }) });
  const oaText = (text) => ({ ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: text } }] }) });
  const missing = () => { throw new Error("No such native application tasks_claude"); };
  const res1 = { list_id: "uni", parent_id: "ni", update_task_id: "", title: "Blatt 2", notes: "", due_date: "2026-10-26", due_time: "08:30", summary: "ok" };
  delete local.data["tk:aiMode"]; reply = missing;
  local.data["tk:api"] = { preset: "anthropic", label: "Anthropic (Claude)", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", key: "sk-ant-test9999" };
  apiReply = anthrOk(res1); reqs = []; await click();
  const t2 = sync.data["T:" + local.data["tk:aiStatus"].taskId];
  ok(reqs.length === 1 && t2 && t2.t === "Blatt 2", "Claude Code fehlt → eigenes Modell (Anthropic) als Ersatz");
  const hq = reqs[0].init.headers, bq = reqs[0].body;
  ok(reqs[0].url === "https://api.anthropic.com/v1/messages" && hq["x-api-key"] === "sk-ant-test9999" && hq["anthropic-dangerous-direct-browser-access"] === "true" && bq.model === "claude-opus-5-5" && bq.output_config.format.type === "json_schema" && bq.output_config.effort === "low" && bq.fallbacks === "default" && !bq.tool_choice, "Anthropic: Opus 5.5, JSON-Schema, effort low, Fallback");
  local.data["tk:aiMode"] = "api"; nativeCalls = 0;
  local.data["tk:api"] = { preset: "ollama", label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen-test", key: "" };
  // server lacks json_schema (400) → plain JSON; answer with thinking text and ``` block
  apiReply = (r) => r.body.response_format && r.body.response_format.type === "json_schema"
    ? { ok: false, status: 400, json: async () => ({ error: "response_format json_schema not supported" }) }
    : oaText("<think>hmm, Liste Uni …</think>\n```json\n" + JSON.stringify({ ...res1, title: "Blatt 3", due_time: null }) + "\n```");
  reqs = []; await click();
  const tOl = sync.data["T:" + local.data["tk:aiStatus"].taskId];
  ok(nativeCalls === 0 && reqs.length === 2 && reqs[0].url === "http://localhost:11434/v1/chat/completions", "„Eigenes Modell“ bevorzugt → direkt lokal (Ollama), Claude Code nicht gefragt");
  ok(reqs[1].body.response_format.type === "json_object" && reqs[1].body.model === "qwen-test" && !reqs[0].init.headers.authorization, "Schema abgelehnt → einfaches JSON; lokal ohne Schlüssel keine Anmeldung");
  ok(tOl && tOl.t === "Blatt 3" && tOl.d === "2026-10-26" && !tOl.h, "Antwort mit Denk-Text, ```-Block und null-Feld wird sauber gelesen");
  local.data["tk:api"] = { preset: "openai", label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", model: "irgendein-modell", key: "sk-oa-xyz" };
  apiReply = () => oaText(JSON.stringify({ ...res1, title: "Blatt 4" })); reqs = []; await click();
  ok(reqs.length === 1 && reqs[0].init.headers.authorization === "Bearer sk-oa-xyz" && reqs[0].body.response_format.json_schema.schema.required.includes("due_time"), "OpenAI-kompatibel: Bearer-Schlüssel + JSON-Schema");
  apiReply = () => ({ ok: false, status: 404, json: async () => ({ error: { message: "model not found" } }) }); await click();
  ok(local.data["tk:aiStatus"].state === "error" && /OpenAI: .*„irgendein-modell“ nicht gefunden/.test(local.data["tk:aiStatus"].text), "Fehler nennt Anbieter und Modell");
  delete local.data["tk:api"]; await click();
  ok(local.data["tk:aiStatus"].state === "error" && /nicht vollständig eingetragen/.test(local.data["tk:aiStatus"].text), "eigenes Modell bevorzugt, aber nicht eingetragen → klare Meldung");
  local.data["tk:api"] = { preset: "ollama", label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "m", key: "" };
  permGranted = false; reqs = []; await click();
  ok(reqs.length === 0 && /nicht erlaubt/.test(local.data["tk:aiStatus"].text), "Zugriff fehlt → kein Aufruf, klare Meldung");
  // --- more than the selection: links in it, clicked link/image, section
  local.data["tk:aiMode"] = "claude-code";
  ok(["link", "image", "page"].every((c) => ctx.menu.contexts.includes(c)), "Kontextmenü auch bei Link, Bild und irgendwo auf der Seite");
  const PDF = "https://ilias.hhu.de/blatt2.pdf";
  const add = async (info, cap, answer) => {
    capReply = () => cap;
    reply = okReply({ list_id: "uni", parent_id: "ni", update_task_id: "", notes: "", due_date: "", due_time: "", new_parent_title: "", move_task_ids: "", summary: "ok", link_url: "", ...answer });
    clickHandler({ menuItemId: "tasks-add-selection", frameId: 0, ...info }, { id: 1, url: URL, title: "Übung 2" }); await tick(); await tick();
    return Object.values(sync.data).find((t) => t.t === answer.title);
  };
  let ct = await add({ selectionText: "Blatt 2 ist online" }, { selection: "Blatt 2 ist online", links: [{ text: "Blatt 2", href: PDF }] }, { title: "Cap Blatt 2", link_title: "Blatt 2", link_url: PDF });
  ok(/Links in der Markierung:\n- Blatt 2 → https:\/\/ilias\.hhu\.de\/blatt2\.pdf/.test(lastMsg.msg.prompt), "an die KI: Link-Ziele aus der Markierung");
  ok(ct && ct.u && ct.u[0].url === PDF, "KI wählt den Link aus der Markierung → als Link gespeichert");
  ct = await add({ selectionText: "x" }, { selection: "x" }, { title: "Cap Fremd", link_title: "x", link_url: "https://evil.example/x" });
  ok(ct && ct.u && ct.u[0].url === URL, "nicht angebotene Adresse → stattdessen die Seitenadresse");
  ct = await add({ linkUrl: PDF, linkText: "Blatt 3", targetElementId: 42 }, { selection: "", section: "Übungen\nBlatt 3 – Abgabe 26. Okt", heading: "Übungen" }, { title: "Cap Blatt 3", link_title: "Blatt 3", link_url: PDF });
  ok(/Angeklickt: Link „Blatt 3" → https:\/\/ilias\.hhu\.de\/blatt2\.pdf/.test(lastMsg.msg.prompt) && /Abschnitt um die angeklickte Stelle \(Überschrift: „Übungen"\)/.test(lastMsg.msg.prompt) && !/Markierter Text/.test(lastMsg.msg.prompt), "Rechtsklick auf Link: Linktext, Ziel und Abschnitt (ohne leere Markierung)");
  ok(/"targetId":42/.test(lastScript.code) && lastScript.frameId === 0, "angeklicktes Element geht an das Seiten-Skript");
  ct = await add({ srcUrl: "https://x.de/flyer.jpg", mediaType: "image", targetElementId: 7 }, { image: { alt: "Flyer Sommerfest", caption: "Sommerfest 12.7." } }, { title: "Cap Sommerfest", link_title: "Flyer" });
  ok(/Angeklickt: Bild https:\/\/x\.de\/flyer\.jpg – Alternativtext: „Flyer Sommerfest" – Bildunterschrift: „Sommerfest 12\.7\."/.test(lastMsg.msg.prompt), "Rechtsklick auf Bild: Adresse, Alternativtext, Bildunterschrift");
  ct = await add({}, {}, { title: "Cap Später lesen", link_title: "Artikel" });
  ok(/gemeint ist die Seite selbst/.test(lastMsg.msg.prompt) && ct && ct.u && ct.u[0].url === URL, "Rechtsklick irgendwo: die Seite ist gemeint, Seitenadresse als Link");
  const ELI = "21.04.2026 - 100. Geburtstag Elisabeth II.";
  ct = await add({ targetElementId: 9 }, { section: "Termine April 2026\n" + ELI + "\n29.04.2026 - 75. Todestag Ludwig Wittgenstein", heading: "Termine April 2026", clicked: ELI }, { title: "Cap Elisabeth", link_title: "Termine" });
  ok(/Angeklickte Stelle: »21\.04\.2026 - 100\. Geburtstag Elisabeth II\.«\n\nAbschnitt um die angeklickte Stelle/.test(lastMsg.msg.prompt), "Rechtsklick auf eine Zeile: die Zeile selbst geht getrennt vor dem Abschnitt mit");
  // highlight on the page: right after the right-click, and again on request
  scripts = [];
  ct = await add({ targetElementId: 9 }, { clicked: ELI, section: "Termine", locator: "body > ul > li:nth-of-type(1)" }, { title: "Cap Highlight", link_title: "Termine" });
  const hl = scripts.find((o) => /highlightInPage/.test(o.code));
  ok(hl && /"locator":"body > ul > li:nth-of-type\(1\)"/.test(hl.code) && /"scroll":false/.test(hl.code), "nach dem Rechtsklick leuchtet die übernommene Stelle auf der Seite kurz auf");
  ok(local.data["tk:aiStatus"].page && local.data["tk:aiStatus"].page.locator === "body > ul > li:nth-of-type(1)" && local.data["tk:aiStatus"].page.tabId === 1, "Abschluss-Meldung enthält Tab und Pfad (für „Auf der Seite zeigen“)");
  scripts = [];
  const shown = await msgListeners.map((f) => f({ type: "show-on-page", tabId: 1, frameId: 0, locator: "body > ul > li:nth-of-type(1)" })).find(Boolean);
  ok(shown && shown.ok && /"scroll":true/.test(scripts[0].code), "„Auf der Seite zeigen“: scrollt hin und hebt hervor");
  // element picker on the active tab
  scripts = [];
  const pk = await msgListeners.map((f) => f({ type: "picker-start" })).find(Boolean);
  ok(pk && pk.ok && pk.title === "Termine 2026" && /pickerInPage/.test(scripts[0].code) && /cssPathInPage/.test(scripts[0].code), "Picker startet im aktiven Tab (mit CSS-Pfad-Helfer)");
  // chat with attachments
  local.data["tk:aiMode"] = "claude-code";
  reply = okReply({ reply: "ok", actions: [], highlight: [] });
  const att = [{ media_type: "application/pdf", data: "JVBERi0=", name: "Blatt4.pdf" }];
  await msgListeners.map((f) => f({ type: "chat", prompt: "Was steht drin?", attachments: att })).find(Boolean);
  ok(lastMsg.msg.attachments && lastMsg.msg.attachments[0].name === "Blatt4.pdf" && lastMsg.msg.prompt === "Was steht drin?", "Chat-Anhänge gehen an das Hilfsprogramm");
  local.data["tk:aiMode"] = "api"; permGranted = true;
  local.data["tk:api"] = { preset: "anthropic", label: "Anthropic (Claude)", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", key: "x" };
  apiReply = anthrOk({ reply: "ok", actions: [], highlight: [] });
  await msgListeners.map((f) => f({ type: "chat", prompt: "Was steht drin?", attachments: att })).find(Boolean);
  const content = lastReq.body.messages[0].content;
  ok(Array.isArray(content) && content[0].type === "document" && content[0].source.media_type === "application/pdf" && content[1].text === "Was steht drin?", "eigenes Claude-Modell: PDF als document-Block");
  local.data["tk:api"] = { preset: "ollama", label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen-test", key: "" };
  const pdfErr = await msgListeners.map((f) => f({ type: "chat", prompt: "x", attachments: att })).find(Boolean);
  ok(pdfErr && !pdfErr.ok && /PDFs gehen mit diesem Modell nicht/.test(pdfErr.error), "OpenAI-kompatibles Modell: PDF → klare Meldung");
  local.data["tk:aiMode"] = "claude-code";
  capReply = () => ({ selection: SEL });
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
