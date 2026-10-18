const fs = require("fs");
const { JSDOM } = require("jsdom");
module.exports = function setup(P, pre = {}, opts = {}) {
  const html = fs.readFileSync(P + "/sidebar/sidebar.html", "utf8").replace(/<script.*<\/script>/, "");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window, d = w.document, listeners = [];
  const area = (name) => { const data = {}; return { data,
    async get(k) { if (k == null) return structuredClone(data); const o = {}; for (const x of [].concat(k)) if (x in data) o[x] = structuredClone(data[x]); return o; },
    async set(o) { const ch = {}; for (const [k, v] of Object.entries(o)) { ch[k] = { newValue: structuredClone(v) }; data[k] = structuredClone(v); } listeners.forEach((l) => l(structuredClone(ch), name)); },
    async remove(k) { const ch = {}; for (const x of [].concat(k)) { ch[x] = {}; delete data[x]; } listeners.forEach((l) => l(ch, name)); } }; };
  const H0 = { tabsOpened: [] };
  const sync = area("sync"), local = area("local");
  Object.assign(sync.data, structuredClone(pre));
  Object.assign(local.data, structuredClone(opts.local || {}));
  H0.perm = { granted: false, answer: true, requests: 0 };
  w.browser = { storage: { sync, local, onChanged: { addListener: (l) => listeners.push(l) } },
    permissions: { async request() { H0.perm.requests++; H0.perm.granted = H0.perm.answer; return H0.perm.answer; }, async contains() { return H0.perm.granted; } },
    tabs: { async create(o) { H0.tabsOpened.push(o); return { id: H0.tabsOpened.length }; }, async group(o) { H0.grouped = o.tabIds; return 77; }, async update() {} },
    tabGroups: { async update(id, o) { H0.groupTitle = o.title; } },
    runtime: { id: opts.runtimeId || "tasks@brandner.name",
      async sendMessage(id, msg) { if (id && id.type === "chat") { H0.chatPrompts = (H0.chatPrompts || []).concat(id.prompt); return H0.chatReply ? H0.chatReply(id) : { ok: false, error: "kein Mock" }; } H0.pings = (H0.pings || 0) + 1; if (H0.devReply) return H0.devReply(id, msg); throw new Error("Could not establish connection. Receiving end does not exist."); },
      async sendNativeMessage(app, msg) { (H0.nativeSent = H0.nativeSent || []).push(msg); return H0.nativeReply ? H0.nativeReply(msg) : { ok: true, version: "2.1.302 (Claude Code)" }; } } };
  if (!w.crypto.randomUUID) w.crypto.randomUUID = () => require("crypto").randomUUID();
  w.Element.prototype.scrollIntoView = () => {};
  if (!w.Range.prototype.getBoundingClientRect) w.Range.prototype.getBoundingClientRect = () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 });
  w.URL.createObjectURL = (blob) => { H0.lastBlob = blob; return "blob:test"; };
  w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { H0.lastDownload = this.download; };
  w.fetch = async (url, init) => { H0.lastFetch = { url, init }; return H0.fetchReply(); };
  if (!w.HTMLDialogElement.prototype.showModal) {
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event("close")); };
  }
  w.eval(fs.readFileSync(P + "/sidebar/sidebar.js", "utf8"));
  let fails = 0;
  const H = Object.assign(H0, { w, d, sync, local });
  H.tick = () => new Promise((r) => setTimeout(r, 30));
  H.ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
  H.finish = () => { console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden"); process.exit(fails ? 1 : 0); };
  H.nTasks = () => Object.keys(sync.data).filter((k) => k.startsWith("T:")).length;
  H.idOf = (t) => { const e = Object.entries(sync.data).find(([k, v]) => k.startsWith("T:") && v.t === t); return e && e[0].slice(2); };
  H.T = (t) => sync.data["T:" + H.idOf(t)];
  H.li = (t) => d.querySelector(`li.task[data-id="${H.idOf(t)}"]`);
  H.edit = (t) => { H.li(t).querySelector(":scope>.row .title .md-view").click(); return d.activeElement; };
  H.key = async (el, k, o = {}) => { el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...o })); await H.tick(); return d.activeElement; };
  H.bodyKey = (k, o) => H.key(d.body, k, o);
  H.type = async (ta, v) => { ta.value = v; ta.dispatchEvent(new w.Event("input")); await new Promise((r) => setTimeout(r, 450)); };
  H.add = async (t) => { d.getElementById("addBtn").click(); await H.tick(); await H.type(d.activeElement, t); };
  H.unfocus = async () => { d.activeElement && d.activeElement.blur && d.activeElement.blur(); d.getElementById("main").click(); await H.tick(); };
  H.rootTitles = () => [...d.querySelectorAll("#openList > li > .row .title .md-view")].map((e) => e.textContent);
  H.kids = (t) => [...H.li(t).querySelectorAll(":scope > .subtasks > li > .row .title .md-view")].map((e) => e.textContent);
  return H;
};
