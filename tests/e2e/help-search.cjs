// Real run against Claude Code (uses your subscription quota):
//   npm run test:e2e:help -- <backup.json>
// Real AI search in ⋯ → „Tastenkürzel & Markdown“: sidebar (jsdom) → background.js (vm) → native helper → claude -p
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
const listeners = [];
const area = () => ({ async get() { return {}; }, async set() {} });
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL, browser: {
  storage: { sync: area(), local: area(), onChanged: { addListener() {} } },
  runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onConnect: { addListener() {} }, onMessage: { addListener(f) { listeners.push(f); } }, sendNativeMessage: native },
  browserAction: { onClicked: { addListener() {} } }, sidebarAction: {},
  contextMenus: { create() {}, async removeAll() {}, onClicked: { addListener() {} } } } };
vm.createContext(ctx);
for (const f of ["shared/privacy.js", "background.js"]) vm.runInContext(fs.readFileSync(P + "/" + f, "utf8"), ctx);
const H = require("../harness.cjs")(P, JSON.parse(fs.readFileSync(BACKUP, "utf8")));
H.helpReply = (msg) => listeners.map((f) => f(msg)).find(Boolean);
(async () => {
  await H.tick(); await H.tick();
  const d = H.d;
  d.getElementById("listMenuBtn").click(); d.querySelector('[data-action="help"]').click(); await H.tick();
  const search = d.getElementById("helpSearch"), ai = d.getElementById("helpAi");
  for (const text of ["aufgabe nach oben bringen", "wie mache ich text fett", "aufgabe rot färben"]) {
    const t0 = Date.now();
    search.value = text; search.dispatchEvent(new H.w.Event("input"));
    search.dispatchEvent(new H.w.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    while (ai.classList.contains("busy")) await new Promise((r) => setTimeout(r, 300));
    await H.tick();
    console.log(`\n» ${text}   (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    console.log("  Antwort: " + ai.innerHTML.replace(/\s+/g, " ").trim());
    const rows = [...d.querySelectorAll("#help .help-row")].filter((r) => !r.hidden && !r.closest(".help-sec").hidden);
    for (const r of rows) console.log("  Zeile: " + [...r.children].map((c) => c.textContent).join(" – "));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
