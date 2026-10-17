// Real run against Claude Code (uses your subscription quota):
//   npm run test:e2e -- <backup.json>
// Real chat run: sidebar (jsdom) → background.js (vm) → native helper → claude -p
const fs = require("fs"); const vm = require("vm"); const { spawn } = require("child_process");
const P = require("node:path").resolve(__dirname, "../..");
const BACKUP = process.argv[2];
const host = JSON.parse(fs.readFileSync(process.env.HOME + "/.mozilla/native-messaging-hosts/tasks_claude.json", "utf8"));
function native(name, msg) {
  return new Promise((resolve) => {
    const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
    const p = spawn(host.path, [], { env }); const chunks = []; p.stdout.on("data", (c) => chunks.push(c));
    p.on("close", () => { const b = Buffer.concat(chunks); resolve(JSON.parse(b.slice(4, 4 + b.readUInt32LE(0)).toString("utf8"))); });
    const body = Buffer.from(JSON.stringify(msg)); const len = Buffer.alloc(4); len.writeUInt32LE(body.length); p.stdin.end(Buffer.concat([len, body]));
  });
}
let chatHandler;
const area = () => ({ async get() { return {}; }, async set() {} });
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL, browser: {
  storage: { sync: area(), local: area(), onChanged: { addListener() {} } },
  runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onMessage: { addListener(f) { chatHandler = f; } }, sendNativeMessage: native },
  browserAction: { onClicked: { addListener() {} } }, sidebarAction: {},
  contextMenus: { create() {}, async removeAll() {}, onClicked: { addListener() {} } } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(P + "/background.js", "utf8"), ctx);
const H = require("../harness.cjs")(P, JSON.parse(fs.readFileSync(BACKUP, "utf8")));
H.chatReply = (msg) => chatHandler(msg);
const title = (id) => (H.sync.data["T:" + id] || H.sync.data["L:" + id] || {}).t;
(async () => {
  await H.tick(); await H.tick();
  const d = H.d; d.getElementById("chatBtn").click(); await H.tick();
  for (const text of [
    "Was ist diese Woche fällig?",
    "Lege unter DS 2 eine Unteraufgabe „Klausur anmelden“ an, fällig nächsten Freitag",
    "Gib allen nat-Info-Aufgaben den Tag #mathe",
  ]) {
    const before = JSON.stringify(H.sync.data); const t0 = Date.now();
    d.getElementById("chatInput").value = text;
    d.getElementById("chatForm").dispatchEvent(new H.w.Event("submit", { cancelable: true }));
    while (d.querySelector("#chatLog .busy")) await new Promise((r) => setTimeout(r, 300));
    await H.tick();
    const m = [...d.querySelectorAll("#chatLog .chat-msg")].pop();
    console.log(`\n» ${text}   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    console.log("  Antwort: " + m.querySelector(".chat-text").textContent.replace(/\s+/g, " ").trim());
    const marks = [...d.querySelectorAll(".task.chat-mark")].map((li) => title(li.dataset.id));
    if (marks.length) console.log("  markiert: " + marks.join(", "));
    const changed = Object.entries(H.sync.data).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(JSON.parse(before)[k]));
    for (const [k, v] of changed) console.log(`  geändert: ${k} → ${JSON.stringify(v)}` + (v.p ? `  (unter „${title(v.p)}“)` : ""));
    const extra = [...m.querySelectorAll(".chat-note, .chat-pending")].map((e) => e.textContent.trim()).filter(Boolean);
    if (extra.length) console.log("  Hinweise: " + extra.join(" | "));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
