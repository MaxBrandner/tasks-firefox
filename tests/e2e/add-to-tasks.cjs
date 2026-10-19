// Real run against Claude Code (uses your subscription quota):
//   npm run test:e2e -- <backup.json>
// Right-click "Zu Tasks hinzufügen" twice, the chat way: background.js (vm)
// drops the capture into the mailbox, the sidebar (jsdom) lists it in the Bezug,
// an empty send ("Zu Tasks hinzufügen") goes through the native helper to
// claude -p. Starts without a DL parent – the second entry should create it.
const fs = require("fs"); const vm = require("vm"); const { spawn } = require("child_process");
const P = require("node:path").resolve(__dirname, "../..");
const BACKUP = process.argv[2];
const SEL1 = __dirname + "/fixtures/dl-blatt1.txt", SEL2 = __dirname + "/fixtures/dl-folien.txt";
const host = JSON.parse(fs.readFileSync(process.env.HOME + "/.mozilla/native-messaging-hosts/tasks_claude.json", "utf8"));
function native(name, msg) {
  return new Promise((resolve) => {
    const env = { ...process.env }; delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT;
    const p = spawn(host.path, [], { env }); const chunks = []; p.stdout.on("data", (c) => chunks.push(c));
    p.on("close", () => { const b = Buffer.concat(chunks); resolve(JSON.parse(b.slice(4, 4 + b.readUInt32LE(0)).toString("utf8"))); });
    const body = Buffer.from(JSON.stringify(msg)); const len = Buffer.alloc(4); len.writeUInt32LE(body.length); p.stdin.end(Buffer.concat([len, body]));
  });
}

// Your tasks without DL (in memory only – nothing is written back).
const data = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
const dl = (Object.entries(data).find(([k, v]) => k.startsWith("T:") && v.t === "DL") || [""])[0].slice(2);
for (const [k, v] of Object.entries(data)) if (dl && (k === "T:" + dl || v.p === dl)) delete data[k];
const H = require("../harness.cjs")(P, data);

// background.js on the same storage as the sidebar.
let click, sel = "";
const listeners = [];
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL, TextDecoder, atob, btoa, browser: {
  storage: { sync: H.sync, local: H.local, onChanged: { addListener() {} } },
  runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onMessage: { addListener(f) { listeners.push(f); } }, sendNativeMessage: native },
  permissions: { async contains() { return true; } },
  browserAction: { onClicked: { addListener() {} } }, sidebarAction: { open() {} },
  contextMenus: { create() {}, async removeAll() {}, onClicked: { addListener(f) { click = f; } } },
  tabs: { async executeScript(id, o) { return /highlightInPage/.test(o.code) ? [true] : [{ selection: sel }]; } } } };
vm.createContext(ctx);
for (const f of ["shared/privacy.js", "background.js"]) vm.runInContext(fs.readFileSync(P + "/" + f, "utf8"), ctx);
H.chatReply = (msg) => listeners.map((f) => f(msg)).find(Boolean);

const d = H.d;
const uni = (Object.entries(H.sync.data).find(([k, v]) => k.startsWith("L:") && v.t === "Uni") || [""])[0].slice(2);
function show() {
  const walk = (pid, depth) => Object.entries(H.sync.data).filter(([k, v]) => k.startsWith("T:") && v.l === uni && (v.p || "") === pid && !v.x)
    .sort((a, b) => (a[1].o || 0) - (b[1].o || 0)).forEach(([k, v]) => {
      console.log("  " + "  ".repeat(depth) + v.t + (v.d ? ` ⏰ ${v.d}${v.h ? " " + v.h : ""}` : "") + (v.u ? ` 🔗 ${v.u.map((l) => l.t).join(", ")}` : ""));
      walk(k.slice(2), depth + 1);
    });
  walk("", 0);
}
async function run(selection, url, title) {
  sel = selection; const t0 = Date.now();
  click({ menuItemId: "tasks-add-selection", frameId: 0, selectionText: selection.slice(0, 40) }, { id: 1, url, title });
  while (!d.querySelector("#chatCtx .ctx-web")) await new Promise((r) => setTimeout(r, 100));
  console.log("  Bezug: " + d.querySelector("#chatCtx .ctx-text").textContent);
  d.getElementById("chatInput").value = "";
  d.getElementById("chatForm").dispatchEvent(new H.w.Event("submit", { cancelable: true }));
  await H.tick();
  while (d.querySelector("#chatLog .busy")) await new Promise((r) => setTimeout(r, 300));
  await H.tick();
  const m = [...d.querySelectorAll("#chatLog .chat-msg")].pop();
  console.log(`  → ${((Date.now() - t0) / 1000).toFixed(1)} s · ${m.querySelector(".chat-text").textContent.replace(/\s+/g, " ").trim()}`);
  const notes = [...m.querySelectorAll(".chat-note, .chat-pending")].map((e) => e.textContent.trim()).filter(Boolean);
  if (notes.length) console.log("  Hinweise: " + notes.join(" | "));
}
(async () => {
  await H.tick(); await H.tick();
  d.getElementById("tabChat").click(); await H.tick();
  console.log("1) Blatt 1 (DL) per Rechtsklick");
  await run(fs.readFileSync(SEL1, "utf8"), "https://ilias.hhu.de/ilias.php?baseClass=ilexercisehandlergui&cmdClass=ilAssignmentPresentationGUI&ref_id=2209395&ass_id=74843", "Blatt 1 - ILIAS");
  console.log("\n2) Folien Woche 2 (DL) per Rechtsklick");
  await run(fs.readFileSync(SEL2, "utf8"), "https://ilias.hhu.de/ilias.php?baseClass=ilrepositorygui&cmd=view&ref_id=2209411", "Vorlesungsfolien - ILIAS");
  console.log("\nListe „Uni“ danach:"); show();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
