// Tasks – guard against a wiped Firefox Sync store (runs in the background).
// Removing the add-on on one device makes Firefox clear its storage.sync, and
// Sync carries that to every device: all lists gone everywhere (2026-10-20).
// So each device keeps its own copy of lists and tasks in storage.local (not
// synced). If Sync ever leaves no list at all – the sidebar never does that,
// it always keeps one – the copy is written back and the sidebar shows a
// notice ("tk:syncRestored").
(() => {
  "use strict";
  const COPY_KEY = "tk:syncCopy";
  const NOTICE_KEY = "tk:syncRestored";
  const isData = (k) => k.startsWith("L:") || k.startsWith("T:");
  const hasList = (m) => [...m.keys()].some((k) => k.startsWith("L:"));
  const count = (m, prefix) => [...m.keys()].filter((k) => k.startsWith(prefix)).length;

  let copy = null; // Map key -> value, follows storage.sync
  let saveTimer = null;

  // The copy is saved shortly after the last change (typing writes often).
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      browser.storage.local.set({ [COPY_KEY]: Object.fromEntries(copy) }).catch(() => {});
    }, 1000);
  }

  async function restore(entries) {
    copy = new Map(entries);
    await browser.storage.sync.set(Object.fromEntries(copy));
    clearTimeout(saveTimer);
    await browser.storage.local.set({
      [COPY_KEY]: Object.fromEntries(copy),
      [NOTICE_KEY]: { at: Date.now(), lists: count(copy, "L:"), tasks: count(copy, "T:") },
    });
  }

  // Changes are handled one after another, each against the copy as it was
  // before – the sidebar adds an empty "Meine Aufgaben" right after a wipe,
  // which must not hide the wipe itself.
  function handle(changes) {
    const next = new Map(copy);
    let touched = false;
    for (const [key, { newValue }] of Object.entries(changes)) {
      if (!isData(key)) continue;
      touched = true;
      if (newValue === undefined) next.delete(key);
      else next.set(key, newValue);
    }
    if (!touched) return undefined;
    if (!hasList(next) && hasList(copy)) return restore(copy);
    copy = next;
    save();
    return undefined;
  }

  // At start: Sync may have been wiped while Firefox was closed.
  async function start() {
    const [all, saved] = await Promise.all([browser.storage.sync.get(null), browser.storage.local.get(COPY_KEY)]);
    const now = new Map(Object.entries(all).filter(([k]) => isData(k)));
    const old = new Map(Object.entries(saved[COPY_KEY] || {}));
    if (!hasList(now) && hasList(old)) return restore(old);
    copy = now;
    save();
    return undefined;
  }

  let queue = start().catch(() => { copy = copy || new Map(); });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    queue = queue.then(() => handle(changes)).catch(() => {});
  });
})();
