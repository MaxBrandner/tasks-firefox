// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const fs = require("fs"); const vm = require("vm");
const P = ROOT;
let fails = 0; const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const tick = () => new Promise((r) => setTimeout(r, 30));
const START = {
  "L:uni": { t: "Uni", o: 0 }, "L:priv": { t: "Privat", o: 1 },
  "T:ni": { l: "uni", t: "nat Info", o: 0 },
  "T:niblatt": { l: "uni", p: "ni", t: "Blatt", o: 0 },
  "T:b1": { l: "uni", t: "DL Blatt 1", o: 3, n: "Einführung in Deep Learning – PDF-Abgabe", u: [{ url: "https://ilias.hhu.de/x?ref_id=2209395&ass_id=1", t: "Abgabe Blatt 1" }] },
  "T:pr": { l: "priv", t: "Einkaufen", o: 0 },
};
function bg() {
  const area = (d = {}) => ({ data: d, async get(k) { if (k == null) return structuredClone(this.data); const o = {}; for (const x of [].concat(k)) if (x in this.data) o[x] = structuredClone(this.data[x]); return o; }, async set(o) { Object.assign(this.data, structuredClone(o)); } });
  const B = { sync: area(structuredClone(START)), local: area(), reply: null, msg: null };
  const ctx = { console, crypto: globalThis.crypto, structuredClone, URL, browser: {
    storage: { sync: B.sync, local: B.local, onChanged: { addListener() {} } },
    runtime: { id: "tasks@brandner.name", onMessageExternal: { addListener() {} }, onMessage: { addListener() {} }, sendNativeMessage: async (n, m) => { B.msg = m; return { ok: true, data: B.reply }; } },
    browserAction: { onClicked: { addListener() {} } }, sidebarAction: { open() {} },
    contextMenus: { create() {}, async removeAll() {}, onClicked: { addListener(f) { B.click = f; } } },
    tabs: { async executeScript() { return ["Einführung in Deep Learning\nVorlesungsfolien Woche 2"]; } } } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(P + "/background.js", "utf8"), ctx);
  B.run = async (reply) => { B.reply = reply; B.click({ menuItemId: "tasks-add-selection", frameId: 0 }, { id: 1, url: "https://ilias.hhu.de/folien?ref_id=2209395", title: "Folien" }); await tick(); return B.local.data["tk:aiStatus"]; };
  return B;
}
const base = { list_id: "uni", parent_id: "", update_task_id: "", title: "Folien", notes: "", due_date: "", due_time: "", link_title: "Folien Woche 2", summary: "ok" };
(async () => {
  // 1) create a group, move only the matching task from the same level
  let B = bg(); await tick();
  let st = await B.run({ ...base, new_parent_title: "DL", move_task_ids: "b1, niblatt, pr, gibtsnicht" });
  const T = (id) => B.sync.data["T:" + id];
  const group = Object.entries(B.sync.data).find(([k, v]) => k.startsWith("T:") && v.t === "DL");
  ok(st.state === "done" && group && !group[1].p && group[1].l === "uni" && group[1].o === 3, "neue Gruppe „DL“ auf oberster Ebene, an der Stelle von „Blatt 1“");
  const gid = group[0].slice(2);
  ok(T("b1").p === gid && T("b1").o === 0 && T("b1").t === "Blatt 1", "„DL Blatt 1“ wandert in die Gruppe und heißt dort „Blatt 1“");
  ok(T("niblatt").p === "ni" && T("pr").l === "priv" && !T("pr").p, "andere Ebene / andere Liste / erfundene ID werden ignoriert");
  ok(T(st.taskId).p === gid && T(st.taskId).o === 1 && T(st.taskId).t === "Folien", "neue Aufgabe „Folien“ kommt dahinter in die Gruppe");
  ok(st.before["T:" + gid] === null && st.before["T:" + st.taskId] === null && !st.before["T:b1"].p, "Strg+Z-Info enthält Gruppe, neue Aufgabe und alten Platz von „Blatt 1“");
  ok(/Notiz: „Einführung in Deep Learning – PDF-Abgabe“/.test(B.msg.prompt) && /Links: Abgabe Blatt 1: https:\/\/ilias\.hhu\.de\/x\?ref_id=2209395/.test(B.msg.prompt) && B.msg.schema.required.includes("move_task_ids"), "Aufgabenbaum für die KI mit Notiz und Links; Schema mit neuen Feldern");
  // 2) single task: group named, but nothing suitable to move → no group
  B = bg(); await tick();
  st = await B.run({ ...base, new_parent_title: "Mathe", move_task_ids: "niblatt" });
  ok(!Object.values(B.sync.data).some((v) => v.t === "Mathe") && !B.sync.data["T:" + st.taskId].p, "ohne passende vorhandene Aufgabe: keine neue Gruppe");
  // 3) sidebar: undo takes back grouping first, then the insert
  const B2 = bg(); await tick();
  const st2 = await B2.run({ ...base, new_parent_title: "DL", move_task_ids: "b1" });
  const H = require("./harness.cjs")(P, START);
  await tick();
  await H.sync.set(st2.after);
  await H.local.set({ "tk:aiStatus": st2 }); await tick();
  ok(H.li("DL") && H.kids("DL").join() === "Blatt 1,Folien", "Seitenleiste zeigt „DL“ mit „Blatt 1“ und „Folien“");
  await H.bodyKey("z", { ctrlKey: true });
  ok(!H.T("DL") && H.T("Folien") && !H.T("Folien").p && H.sync.data["T:b1"] && !H.sync.data["T:b1"].p && H.sync.data["T:b1"].o === 3 && H.sync.data["T:b1"].t === "DL Blatt 1", "1. Strg+Z: nur die Gruppe weg – „Folien“ bleibt oben, „DL Blatt 1“ zurück mit altem Titel");
  await H.bodyKey("z", { ctrlKey: true });
  ok(!H.T("Folien") && H.sync.data["T:b1"] && !H.sync.data["T:b1"].p, "2. Strg+Z: auch das Einfügen von „Folien“ zurück");
  await H.bodyKey("y", { ctrlKey: true }); await H.bodyKey("y", { ctrlKey: true });
  ok(H.T("DL") && H.kids("DL").join() === "Blatt 1,Folien", "2× Strg+Y: beides wieder da");
  console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
