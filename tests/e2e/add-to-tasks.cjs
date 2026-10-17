// Real run against Claude Code (uses your subscription quota):
//   npm run test:e2e -- <backup.json>
// Two real "Zu Tasks hinzufügen" runs via Claude Code, starting without a DL parent.
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
const area = () => { const data = {}; return { data, async get(k) { if (k == null) return structuredClone(data); const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = structuredClone(data[x]); return o; }, async set(o) { Object.assign(data, structuredClone(o)); } }; };
const sync = area(), local = area(); let click, sel = "";
const ctx = { console, crypto: globalThis.crypto, structuredClone, URL,
  browser: { storage: { sync, local, onChanged: { addListener() {} } }, runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, sendNativeMessage: native }, permissions: { async contains() { return false; } },
    browserAction: { onClicked: { addListener() {} } }, sidebarAction: { open() {} },
    contextMenus: { create() {}, async removeAll() {}, onClicked: { addListener(f) { click = f; } } },
    tabs: { async executeScript() { return [sel]; } } } };
vm.createContext(ctx); vm.runInContext(fs.readFileSync(P + "/background.js", "utf8"), ctx);
const data = JSON.parse(fs.readFileSync(BACKUP, "utf8"));
const dl = Object.entries(data).find(([k, v]) => v.t === "DL")[0].slice(2);
for (const [k, v] of Object.entries(data)) if (k === "T:" + dl || v.p === dl) delete data[k]; // no DL yet
Object.assign(sync.data, data);
const uni = Object.entries(sync.data).find(([k, v]) => k.startsWith("L:") && v.t === "Uni")[0].slice(2);
function show() {
  const walk = (pid, depth) => Object.entries(sync.data).filter(([k, v]) => k.startsWith("T:") && v.l === uni && (v.p || "") === pid && !v.x)
    .sort((a, b) => (a[1].o || 0) - (b[1].o || 0)).forEach(([k, v]) => {
      console.log("  " + "  ".repeat(depth) + v.t + (v.d ? ` ⏰ ${v.d}${v.h ? " " + v.h : ""}` : "") + (v.u ? ` 🔗 ${v.u.map((l) => l.t).join(", ")}` : "") + (v.n && depth === 0 && !v.p ? `  · Notiz: ${v.n.split("\n")[0].slice(0, 60)}` : ""));
      walk(k.slice(2), depth + 1);
    });
  walk("", 0);
}
async function run(selection, url, title) {
  sel = selection; delete local.data["tk:aiStatus"]; const t0 = Date.now();
  click({ menuItemId: "tasks-add-selection", frameId: 0 }, { id: 1, url, title });
  while (!local.data["tk:aiStatus"] || local.data["tk:aiStatus"].state === "working") await new Promise((r) => setTimeout(r, 300));
  const st = local.data["tk:aiStatus"];
  console.log(`→ ${((Date.now() - t0) / 1000).toFixed(1)} s · ${st.state}: ${st.text}`);
}
(async () => {
  await new Promise((r) => setTimeout(r, 50));
  console.log("1) Blatt 1 (DL) hinzufügen");
  await run(fs.readFileSync(SEL1, "utf8"), "https://ilias.hhu.de/ilias.php?baseClass=ilexercisehandlergui&cmdClass=ilAssignmentPresentationGUI&ref_id=2209395&ass_id=74843", "Blatt 1 - ILIAS");
  console.log("\n2) Folien Woche 2 (DL) hinzufügen");
  await run(fs.readFileSync(SEL2, "utf8"), "https://ilias.hhu.de/ilias.php?baseClass=ilrepositorygui&cmd=view&ref_id=2209411", "Vorlesungsfolien - ILIAS");
  console.log("\nListe „Uni“ danach:"); show();
})();
