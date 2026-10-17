/* Tasks – sidebar
 * Task lists with arbitrarily nested subtasks, notes, due dates, Markdown and
 * drag & drop. Interaction modeled on Notion: every task is a line, structure
 * via Tab / Shift+Tab / Enter. Stored in storage.sync, i.e. available through
 * Firefox Sync on every signed-in Firefox installation.
 */
(() => {
  "use strict";

  // --- Storage layout -------------------------------------------------------
  // storage.sync (one task = one entry, so changes on two devices don't
  // overwrite each other):
  //   "L:<id>" = list { t: title, o: order }
  //   "T:<id>" = task { l: list id, p: parent id, t: title, n: note,
  //                     d: "YYYY-MM-DD", h: "HH:MM", x: done, xa: done at (ms),
  //                     r: "w" weekly, s: series id, u: [{ url, t }] links,
  //                     o: order among siblings }
  // Empty fields are omitted – the sync quota is tight (~100 KB).
  // storage.local (per device): theme, selected list, done section open, AI settings.
  const LIST = "L:";
  const TASK = "T:";
  // Fixed ID: if two devices start for the first time, both create the same list.
  const DEFAULT_LIST_ID = "default";
  const THEME_KEY = "tk:themeMode";
  const CURRENT_KEY = "tk:currentList";
  const DONE_OPEN_KEY = "tk:doneOpen";
  // AI integration (context menu "Zu Tasks hinzufügen", see background.js).
  const AI_STATUS = "tk:aiStatus";
  // Real version vs. test copy (npm run dev).
  const DEV_ID = "tasks-dev@brandner.name";
  const IS_DEV = browser.runtime.id === DEV_ID;
  const AI_MODE = "tk:aiMode"; // "claude-code" (default), "api" or "none"
  // Custom model: { preset, label, protocol, baseUrl, model, key } – storage.local only.
  const API_CONFIG = "tk:api";
  // Presets: prefill address/protocol; model names only where they are fixed.
  const PRESETS = {
    anthropic: { label: "Anthropic (Claude)", protocol: "anthropic", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", local: false },
    openai: { label: "OpenAI", protocol: "openai", baseUrl: "https://api.openai.com/v1", model: "", local: false },
    openrouter: { label: "OpenRouter", protocol: "openai", baseUrl: "https://openrouter.ai/api/v1", model: "", local: false },
    ollama: { label: "Ollama (lokal)", protocol: "openai", baseUrl: "http://localhost:11434/v1", model: "", local: true },
    lmstudio: { label: "LM Studio (lokal)", protocol: "openai", baseUrl: "http://localhost:1234/v1", model: "", local: true },
    custom: { label: "Andere (OpenAI-kompatibel)", protocol: "openai", baseUrl: "", model: "", local: false },
  };

  const lists = new Map(); // id -> { t, o }
  const tasks = new Map(); // id -> { l, p, t, n, d, x, xa, o }
  let currentList = null;
  let doneOpen = false;
  // The task being edited – it is expanded (details, date). As in Google
  // Tasks: editing and expanding are the same thing.
  let expandedId = null;
  let focusAfterRender = null; // { id, caret }
  let renderPending = false;
  let rendering = false;
  let dragging = null; // { id }
  let dropInfo = null; // { id, mode: "before" | "after" | "inside" }

  const $ = (id) => document.getElementById(id);
  const listSelectEl = $("listSelect");
  const listNameInputEl = $("listNameInput");
  const countEl = $("count");
  const listMenuBtnEl = $("listMenuBtn");
  const listMenuEl = $("listMenu");
  const themeToggleEl = $("themeToggle");
  const bannerEl = $("banner");
  const helpEl = $("help");
  const addBtnEl = $("addBtn");
  const openListEl = $("openList");
  const emptyEl = $("empty");
  const doneSectionEl = $("doneSection");
  const doneToggleEl = $("doneToggle");
  const doneLabelEl = $("doneLabel");
  const doneListEl = $("doneList");
  const toastEl = $("toast");
  const toastTextEl = $("toastText");
  const toastUndoEl = $("toastUndo");

  // --- Helpers --------------------------------------------------------------

  const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

  // Builds an element. Properties the element knows (value, hidden, …) are set
  // directly, everything else as an attribute; "on…" are event listeners.
  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    el.append(...children.flat().filter((c) => c != null && c !== false));
    return el;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  const ICONS = {
    chevron: "M6 9l6 6 6-6",
    chat: "M4 5h16v11H9l-5 4z",
    send: "M4 12l16-8-6 16-2-7z",
    check: "M5 12.5l4.5 4.5L19 7.5",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6L6 18",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    notes: "M4 6h16M4 12h16M4 18h10",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    alert: "M12 3.5l9 16H3zM12 10v4M12 17h.01",
    undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
    repeat: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
    monitor: "M3 4.5h18v12H3zM8.5 20.5h7M12 16.5v4",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4",
    moon: "M20.5 13.5A8.5 8.5 0 1 1 10.5 3.5a6.5 6.5 0 0 0 10 10z",
  };

  function icon(name, extraClass) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("class", "ico" + (extraClass ? " " + extraClass : ""));
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", ICONS[name]);
    svg.append(path);
    return svg;
  }

  // Drops empty fields (0 is kept – it's a valid order value).
  function compact(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== "" && v != null && v !== false && !(Array.isArray(v) && !v.length)) out[k] = v;
    }
    return out;
  }

  function autosize(el) {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  function isoDate(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }

  const timers = new Map(); // key -> { timer, fn }
  function debounce(key, fn, ms = 400) {
    cancelDebounce(key);
    timers.set(key, {
      fn,
      timer: setTimeout(() => {
        timers.delete(key);
        fn();
      }, ms),
    });
  }
  function cancelDebounce(key) {
    const pending = timers.get(key);
    if (pending) clearTimeout(pending.timer);
    timers.delete(key);
  }
  // Run pending saves immediately (before re-rendering, so text just typed
  // isn't replaced by the old state).
  function flushPending() {
    for (const [key, { fn }] of [...timers]) {
      cancelDebounce(key);
      fn();
    }
  }

  // --- Markdown (deliberately small) -----------------------------------------
  // Only creates DOM nodes, never HTML from text. Links only http(s), mailto
  // and www.; anything else stays visible text.

  const INLINE_RE = new RegExp([
    "`([^`\\n]+)`", // 1 code
    "\\[([^\\]\\n]+)\\]\\(([^)\\s]+)\\)", // 2,3 [Text](url)
    "\\*\\*(.+?)\\*\\*", // 4 bold
    "~~(.+?)~~", // 5 strikethrough
    "\\*(?![\\s*])(.+?)(?<![\\s*])\\*", // 6 italic
    "((?:https?:\\/\\/|mailto:|www\\.)[^\\s<>]*[^\\s<>.,;:!?'\")\\]])", // 7 bare URL
    "\\[\\[([TL]):([A-Za-z0-9_-]{1,64})\\]\\]", // 8,9 reference to a task/list (chat)
  ].join("|"), "g");

  function safeHref(url) {
    const u = /^www\./i.test(url) ? "https://" + url : url;
    return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
  }

  function link(href) {
    return h("a", { href, target: "_blank", rel: "noopener noreferrer", title: href });
  }

  function renderInline(text, parent) {
    let last = 0;
    // matchAll works on a copy of the regex – recursion is therefore safe.
    for (const m of text.matchAll(INLINE_RE)) {
      if (m.index > last) parent.append(text.slice(last, m.index));
      last = m.index + m[0].length;
      if (m[1] != null) {
        parent.append(h("code", null, m[1]));
      } else if (m[2] != null) {
        const href = safeHref(m[3]);
        if (!href) {
          parent.append(m[0]);
          continue;
        }
        const a = link(href);
        renderInline(m[2], a);
        parent.append(a);
      } else if (m[4] != null || m[5] != null || m[6] != null) {
        const el = h(m[4] != null ? "strong" : m[5] != null ? "s" : "em");
        renderInline(m[4] ?? m[5] ?? m[6], el);
        parent.append(el);
      } else if (m[8] != null) {
        parent.append(refChip(m[8], m[9]));
      } else if (m[7] != null) {
        const a = link(safeHref(m[7]));
        a.textContent = m[7].replace(/^(https?:\/\/|mailto:)/i, "");
        parent.append(a);
      }
    }
    if (last < text.length) parent.append(text.slice(last));
  }

  function renderBlock(text, parent) {
    let listEl = null;
    let listType = null;
    const addItem = (type, content) => {
      if (!listEl || listType !== type) {
        listEl = h(type, { class: "md-list" });
        listType = type;
        parent.append(listEl);
      }
      const li = h("li");
      renderInline(content, li);
      listEl.append(li);
    };
    for (const line of text.split("\n")) {
      let m;
      if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) {
        addItem("ul", m[1]);
        continue;
      }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
        addItem("ol", m[1]);
        continue;
      }
      listEl = null;
      let el;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) el = h("div", { class: "md-h md-h" + m[1].length });
      else if ((m = line.match(/^>\s?(.*)$/))) el = h("div", { class: "md-quote" });
      else if (!line.trim()) el = h("div", { class: "md-gap" });
      else el = h("div", { class: "md-p" });
      if (line.trim()) renderInline(m ? m[m.length - 1] : line, el);
      parent.append(el);
    }
  }

  // Note preview in collapsed state: non-empty lines without block markup;
  // CSS truncates after two lines with "…".
  function renderNotePreview(text, parent) {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, i) => {
      if (i) parent.append("\n");
      const clean = line
        .replace(/^#{1,3}\s+/, "")
        .replace(/^>\s?/, "")
        .replace(/^[-*+]\s+/, "• ");
      renderInline(clean, parent);
    });
  }

  // Derives the caret position from a click into the rendered view – only if
  // the view matches the raw text 1:1 (no Markdown in it).
  function caretFromClick(view, raw, e) {
    try {
      if (!document.caretPositionFromPoint || view.textContent !== raw) return "end";
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (!pos || !view.contains(pos.offsetNode)) return "end";
      const walker = document.createTreeWalker(view, NodeFilter.SHOW_TEXT);
      let offset = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n === pos.offsetNode) return offset + pos.offset;
        offset += n.length;
      }
    } catch (_) {
      // fallback below
    }
    return "end";
  }

  // Markdown field: shows the rendered view; on click (not on a link) the raw
  // text for editing. Back to the view on blur.
  function mdField({ value, multiline, cls, placeholder, label, onInput, onCommit, onKeyDown }) {
    const view = h("div", { class: "md-view" });
    const ta = h("textarea", {
      class: "md-edit",
      rows: 1,
      value,
      placeholder,
      hidden: true,
      maxLength: multiline ? 2000 : 500,
      "aria-label": label,
    });
    const wrap = h("div", { class: "field " + cls }, view, ta);

    const paint = () => {
      view.replaceChildren();
      const v = ta.value;
      view.classList.toggle("placeholder", !v.trim());
      if (!v.trim()) view.textContent = placeholder;
      else if (multiline) renderBlock(v, view);
      else renderInline(v, view);
    };
    paint();

    wrap.startEdit = (caret = "end") => {
      ta._startValue = ta.value; // for Ctrl+Z: text undo in the field first
      ta._checkpointed = false;
      view.hidden = true;
      ta.hidden = false;
      autosize(ta);
      ta.focus();
      const len = ta.value.length;
      const pos = caret === "end" ? len : caret === "start" ? 0 : Math.min(caret, len);
      ta.setSelectionRange(pos, pos);
    };

    view.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // open the link instead of editing
      wrap.startEdit(caretFromClick(view, ta.value, e));
    });
    ta.addEventListener("input", () => {
      // First keystroke in this field: remember the previous state for Ctrl+Z.
      // Further typing extends the step until a 0.7 s pause records it.
      const label = multiline ? "Notiz bearbeitet" : "Titel bearbeitet";
      if (!ta._checkpointed) {
        ta._checkpointed = true;
        checkpoint(label);
      } else {
        if (!pendingLabel) pendingLabel = label;
        scheduleCommit();
      }
      if (!multiline && ta.value.includes("\n")) ta.value = ta.value.replace(/\s*\n\s*/g, " ");
      autosize(ta);
      if (onInput) onInput(ta.value);
    });
    if (onKeyDown) ta.addEventListener("keydown", (e) => onKeyDown(e, ta));
    ta.addEventListener("blur", () => {
      if (rendering) return;
      ta.hidden = true;
      view.hidden = false;
      paint();
      if (onCommit) onCommit(ta.value);
    });
    return wrap;
  }

  // --- Storage --------------------------------------------------------------

  function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.hidden = !text;
  }

  function explainError(err) {
    const msg = String((err && err.message) || err);
    if (/quota|too large|MAX_ITEMS/i.test(msg)) {
      return "Speicher voll: Firefox Sync erlaubt ca. 100 KB bzw. 512 Einträge. " +
        "Lösche erledigte Aufgaben oder kürze lange Notizen. Die letzte Änderung wurde nicht gespeichert.";
    }
    return "Speichern fehlgeschlagen: " + msg;
  }

  async function reloadAll() {
    const all = await browser.storage.sync.get(null);
    lists.clear();
    tasks.clear();
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith(LIST)) lists.set(key.slice(LIST.length), value);
      else if (key.startsWith(TASK)) tasks.set(key.slice(TASK.length), value);
    }
  }

  // Writes entries. On error (usually: quota exceeded) the local state is
  // discarded and reloaded from storage.
  async function write(entries) {
    try {
      await browser.storage.sync.set(entries);
      if (!bannerEl.hidden) showBanner("");
    } catch (err) {
      showBanner(explainError(err));
      await reloadAll();
      ensureCurrentList();
      render();
    }
  }

  async function remove(keys) {
    try {
      await browser.storage.sync.remove(keys);
    } catch (err) {
      showBanner("Löschen fehlgeschlagen: " + ((err && err.message) || err));
    }
  }

  // Changes fields of a task and saves it (without re-rendering).
  function patchTask(id, fields) {
    const cur = tasks.get(id);
    if (!cur) return;
    const next = compact({ ...cur, ...fields });
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    tasks.set(id, next);
    write({ [TASK + id]: next });
  }

  // Changes from other devices (Firefox Sync) or other windows.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    let dirty = false;
    for (const [key, { newValue }] of Object.entries(changes)) {
      const map = key.startsWith(TASK) ? tasks : key.startsWith(LIST) ? lists : null;
      if (!map) continue;
      const id = key.slice(2);
      if (newValue === undefined) {
        if (map.delete(id)) dirty = true;
      } else if (JSON.stringify(map.get(id)) !== JSON.stringify(newValue)) {
        map.set(id, newValue);
        dirty = true;
      }
    }
    if (dirty) {
      ensureCurrentList();
      scheduleRender();
    }
  });

  // --- Tree structure -------------------------------------------------------

  const byOrder = (a, b) => (a.o || 0) - (b.o || 0);

  // Parent ID; if the parent is missing (e.g. not synced yet), the task counts
  // as top level.
  function parentOf(id) {
    const t = tasks.get(id);
    if (!t || !t.p) return "";
    const p = tasks.get(t.p);
    return p && p.l === t.l ? t.p : "";
  }

  // Siblings in display order. Top level: open ones only (done ones live in
  // the done section). Below that: all – checked subtasks keep their place
  // (as in Notion).
  function visibleChildren(listId, parentId) {
    const out = [];
    for (const [id, t] of tasks) {
      if (t.l === listId && parentOf(id) === parentId && (parentId || !t.x)) out.push({ id, ...t });
    }
    return out.sort(byOrder);
  }

  function hasChildren(id) {
    for (const t of tasks.values()) if (t.p === id) return true;
    return false;
  }

  function descendants(id) {
    const out = [];
    const seen = new Set([id]);
    const walk = (pid) => {
      for (const [cid, c] of tasks) {
        if (c.p === pid && !seen.has(cid)) {
          seen.add(cid);
          out.push(cid);
          walk(cid);
        }
      }
    };
    walk(id);
    return out;
  }

  function ancestors(id) {
    const out = [];
    const seen = new Set([id]);
    for (let p = parentOf(id); p && !seen.has(p); p = parentOf(p)) {
      seen.add(p);
      out.push(p);
    }
    return out;
  }

  // Places task `id` as a child of `parentId` at position `index` among the
  // visible siblings. Usually only its order value changes; siblings are
  // renumbered only when the gap becomes too small.
  function placeTask(id, parentId, index) {
    const t = tasks.get(id);
    if (!t) return;
    const sibs = visibleChildren(t.l, parentId).filter((s) => s.id !== id);
    const i = Math.max(0, Math.min(index, sibs.length));
    const prev = sibs[i - 1];
    const next = sibs[i];
    const po = prev ? prev.o || 0 : 0;
    const no = next ? next.o || 0 : 0;
    const o = prev && next ? (po + no) / 2 : prev ? po + 1 : next ? no - 1 : 0;

    const updates = {};
    const set = (tid, fields) => {
      const v = compact({ ...tasks.get(tid), ...fields });
      tasks.set(tid, v);
      updates[TASK + tid] = v;
    };
    if (prev && next && (o - po < 1e-6 || no - o < 1e-6)) {
      [...sibs.slice(0, i), { id }, ...sibs.slice(i)].forEach((s, n) => set(s.id, { o: n }));
      set(id, { p: parentId });
    } else {
      set(id, { p: parentId, o });
    }
    // An open task never sits below a done one: reopen the ones above.
    if (!tasks.get(id).x) {
      for (const a of ancestors(id)) if (tasks.get(a).x) set(a, { x: false, xa: "" });
    }
    write(updates);
  }

  // --- History: undo tree (Ctrl+Z / Ctrl+Y, ⋯ → "Verlauf …") -----------------
  // Every action becomes a node holding the full state after it (JSON, ~100 KB
  // at most). Undo moves to the parent, redo to the child visited last. Acting
  // after an undo starts a new branch – the old one is kept, nothing gets
  // overwritten. The history popup shows the tree: jump to any state, or take
  // back a single step while later ones stay (only if no later step touched the
  // same entries).
  //
  // Persistent per device (storage.local, not synced – far too big for the
  // sync quota): the root state once, then only each step's diff to its
  // parent. States are serialized canonically (sorted keys), so a state
  // rebuilt from diffs compares equal to the live one.

  const HISTORY_MAX = 200;
  const HISTORY_KEY = "tk:history";
  const instanceId = newId(); // this sidebar (every window has its own)
  const hist = new Map(); // id -> { id, parent, kids: [], lastKid, label, at, state, diff }
  let histSeq = 0;
  let histRoot = null;
  let histCurrent = null;
  let pendingLabel = null; // label of the action whose result isn't recorded yet

  const canon = (v) => (Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
  const byId = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);
  const stateOf = (l, t) => JSON.stringify({
    l: [...l].sort(byId).map(([id, v]) => [id, canon(v)]),
    t: [...t].sort(byId).map(([id, v]) => [id, canon(v)]),
  });
  const serialize = () => stateOf(lists, tasks);
  const q = (id) => "„" + ((plainTitle((tasks.get(id) || {}).t) || "Aufgabe").slice(0, 40)) + "“";

  function addNode(label, state) {
    const parent = histCurrent ? hist.get(histCurrent) : null;
    const node = {
      id: ++histSeq, parent: histCurrent, kids: [], lastKid: null, label, at: Date.now(), state,
      diff: parent ? diffStates(parent.state, state) : null,
    };
    hist.set(node.id, node);
    if (parent) {
      parent.kids.push(node.id);
      parent.lastKid = node.id;
    } else {
      histRoot = node.id;
    }
    histCurrent = node.id;
    pruneHistory();
    saveHistory();
    return node;
  }

  // --- Persistence ---
  const toEntries = (state) => {
    const s = JSON.parse(state);
    return new Map([...s.l.map(([i, v]) => [LIST + i, v]), ...s.t.map(([i, v]) => [TASK + i, v])]);
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function diffStates(fromState, toState) {
    const a = toEntries(fromState);
    const b = toEntries(toState);
    const set = {};
    for (const [k, v] of b) if (!same(a.get(k), v)) set[k] = v;
    return { set, del: [...a.keys()].filter((k) => !b.has(k)) };
  }

  function applyDiff(state, diff) {
    const m = toEntries(state);
    for (const [k, v] of Object.entries(diff.set)) m.set(k, v);
    for (const k of diff.del) m.delete(k);
    const l = new Map();
    const t = new Map();
    for (const [k, v] of m) (k.startsWith(TASK) ? t : l).set(k.slice(2), v);
    return stateOf(l, t);
  }

  function saveHistory() {
    if (!histRoot) return;
    const nodes = {};
    for (const [id, n] of hist) nodes[id] = { p: n.parent, k: n.kids, lk: n.lastKid, l: n.label, a: n.at, d: n.diff };
    browser.storage.local.set({
      [HISTORY_KEY]: { v: 1, by: instanceId, seq: histSeq, root: histRoot, cur: histCurrent, rootState: hist.get(histRoot).state, nodes },
    }).catch(() => {});
  }

  // Rebuilds the tree from storage (root state + diffs). Returns false if none.
  async function loadHistory() {
    const { [HISTORY_KEY]: saved } = await browser.storage.local.get(HISTORY_KEY);
    if (!saved || saved.v !== 1 || !saved.nodes || !saved.nodes[saved.root]) return false;
    hist.clear();
    const build = (id, state) => {
      const raw = saved.nodes[id];
      hist.set(id, { id, parent: raw.p, kids: raw.k.filter((k) => saved.nodes[k]), lastKid: raw.lk, label: raw.l, at: raw.a, state, diff: raw.d });
      for (const k of raw.k) if (saved.nodes[k]) build(k, applyDiff(state, saved.nodes[k].d));
    };
    build(saved.root, saved.rootState);
    histSeq = saved.seq;
    histRoot = saved.root;
    histCurrent = hist.has(saved.cur) ? saved.cur : saved.root;
    return true;
  }

  // On opening: load the saved tree; if the data changed while the sidebar was
  // closed (other device, AI, migration), record that as its own step.
  async function initHistory() {
    if (await loadHistory()) {
      pendingLabel = "Änderungen außerhalb der Seitenleiste";
      commitPending();
    } else {
      ensureHistoryRoot();
    }
  }

  // "Verlauf leeren": the current state becomes the new start.
  function clearHistory() {
    commitPending();
    hist.clear();
    histRoot = null;
    histCurrent = null;
    ensureHistoryRoot();
  }

  // Another sidebar (other window) saved the tree: take it over.
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[HISTORY_KEY]) return;
    const saved = changes[HISTORY_KEY].newValue;
    if (!saved || saved.by === instanceId) return;
    loadHistory().then(() => {
      if (historyDlgEl.open) renderHistory();
    });
  });

  function ensureHistoryRoot() {
    if (!histRoot) addNode("Start", serialize());
  }

  // Records the changes since the current node as a node for the pending action.
  function commitPending() {
    ensureHistoryRoot();
    flushPending();
    const s = serialize();
    if (s !== hist.get(histCurrent).state) addNode(pendingLabel || "Änderung", s);
    pendingLabel = null;
  }

  // Called right before an action: record the previous one, name the next.
  // The action's own result is recorded shortly after (scheduleCommit), so the
  // saved history is complete even if the sidebar is closed right away.
  function checkpoint(label) {
    commitPending();
    pendingLabel = label || "Änderung";
    scheduleCommit();
  }

  let commitTimer = null;
  function scheduleCommit() {
    clearTimeout(commitTimer);
    commitTimer = setTimeout(commitPending, 700);
  }
  window.addEventListener("pagehide", () => commitPending());

  // Drops the oldest steps beyond HISTORY_MAX; side branches of the old root
  // go with it (never the branch leading to the current state).
  function pruneHistory() {
    while (hist.size > HISTORY_MAX) {
      const root = hist.get(histRoot);
      if (root.id === histCurrent || !root.kids.length) return;
      const path = new Set();
      for (let c = hist.get(histCurrent); c; c = c.parent ? hist.get(c.parent) : null) path.add(c.id);
      const keep = root.kids.find((k) => path.has(k)) || root.lastKid || root.kids[root.kids.length - 1];
      const drop = (id) => {
        hist.get(id).kids.forEach(drop);
        hist.delete(id);
      };
      for (const k of root.kids) if (k !== keep) drop(k);
      hist.delete(root.id);
      hist.get(keep).parent = null;
      hist.get(keep).diff = null;
      histRoot = keep;
    }
  }

  function applyState(serial) {
    const s = JSON.parse(serial);
    const target = new Map([
      ...s.l.map(([id, v]) => [LIST + id, v]),
      ...s.t.map(([id, v]) => [TASK + id, v]),
    ]);
    const current = new Map([
      ...[...lists].map(([id, v]) => [LIST + id, v]),
      ...[...tasks].map(([id, v]) => [TASK + id, v]),
    ]);
    const sets = {};
    for (const [k, v] of target) {
      if (JSON.stringify(current.get(k)) !== JSON.stringify(v)) sets[k] = v;
    }
    const removes = [...current.keys()].filter((k) => !target.has(k));
    lists.clear();
    tasks.clear();
    for (const [id, v] of s.l) lists.set(id, v);
    for (const [id, v] of s.t) tasks.set(id, v);
    if (Object.keys(sets).length) write(sets);
    if (removes.length) remove(removes);
    ensureCurrentList();
    render();
  }

  // Jump to any recorded state – also into another branch.
  function jumpTo(id) {
    commitPending();
    const node = hist.get(id);
    if (!node || id === histCurrent) return;
    for (let c = node; c.parent; c = hist.get(c.parent)) hist.get(c.parent).lastKid = c.id;
    histCurrent = id;
    saveHistory();
    hideToast();
    applyState(node.state);
  }

  function undo() {
    commitPending();
    const node = hist.get(histCurrent);
    if (node && node.parent) jumpTo(node.parent);
  }

  function redo() {
    commitPending();
    const node = hist.get(histCurrent);
    if (node && node.lastKid) jumpTo(node.lastKid);
  }

  // Takes back one step while later steps stay – only if none of its entries
  // changed since. Becomes a step itself (so it can be undone). Returns an
  // error text, or "" on success.
  function revertStep(id) {
    commitPending();
    const node = hist.get(id);
    const parent = node && node.parent ? hist.get(node.parent) : null;
    if (!parent) return "Der Startpunkt lässt sich nicht zurücknehmen.";
    const before = toEntries(parent.state);
    const after = toEntries(node.state);
    const now = toEntries(serialize());
    const keys = [...new Set([...before.keys(), ...after.keys()])].filter((k) => !same(before.get(k), after.get(k)));
    if (!keys.length) return "Dieser Schritt hat nichts geändert.";
    if (keys.some((k) => !same(now.get(k), after.get(k)))) {
      return "Geht nicht: Spätere Schritte haben dieselben Aufgaben geändert. Springe stattdessen zu einem Stand davor.";
    }
    checkpoint("Zurückgenommen: " + node.label);
    const sets = {};
    const gone = [];
    for (const k of keys) {
      const map = k.startsWith(TASK) ? tasks : lists;
      const v = before.get(k);
      if (v === undefined) {
        map.delete(k.slice(2));
        gone.push(k);
      } else {
        map.set(k.slice(2), v);
        sets[k] = v;
      }
    }
    if (Object.keys(sets).length) write(sets);
    if (gone.length) remove(gone);
    ensureCurrentList();
    render();
    commitPending();
    return "";
  }

  // In the field being edited the browser's normal text undo comes first; only
  // once the text is back to its initial state does Ctrl+Z act on the tasks
  // (as in Notion).
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    const isUndo = k === "z" && !e.shiftKey;
    const isRedo = k === "y" || (k === "z" && e.shiftKey);
    if (!isUndo && !isRedo) return;
    if (modalOpen()) return;
    const a = document.activeElement;
    if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT")) {
      if (a._startValue === undefined || a.value !== a._startValue) return;
    }
    e.preventDefault();
    if (isUndo) undo();
    else redo();
  });

  // --- Lists ----------------------------------------------------------------

  function sortedLists() {
    return [...lists.entries()].sort(
      ([, a], [, b]) => (a.o || 0) - (b.o || 0) || (a.t || "").localeCompare(b.t || "", "de")
    );
  }

  function ensureCurrentList() {
    if (lists.size === 0) {
      const list = { t: "Meine Aufgaben", o: 0 };
      lists.set(DEFAULT_LIST_ID, list);
      write({ [LIST + DEFAULT_LIST_ID]: list });
    }
    if (!lists.has(currentList)) currentList = sortedLists()[0][0];
  }

  function setCurrentList(id) {
    currentList = id;
    expandedId = null;
    browser.storage.local.set({ [CURRENT_KEY]: id });
    render();
  }

  function renderListSelect() {
    listSelectEl.replaceChildren(
      ...sortedLists().map(([id, list]) =>
        h("option", { value: id, selected: id === currentList }, list.t || "Ohne Namen")
      )
    );
    listSelectEl.value = currentList;
  }

  listSelectEl.addEventListener("change", () => setCurrentList(listSelectEl.value));

  // Inline input for "Neue Liste" / "Umbenennen" in place of the select.
  let listEditCommit = null;

  function editListName(initial, onCommit) {
    listEditCommit = onCommit;
    listNameInputEl.value = initial;
    listSelectEl.hidden = true;
    listNameInputEl.hidden = false;
    listNameInputEl.focus();
    listNameInputEl.select();
  }

  function finishListEdit(save) {
    if (!listEditCommit) return;
    const commit = listEditCommit;
    listEditCommit = null;
    const name = listNameInputEl.value.trim();
    listNameInputEl.hidden = true;
    listSelectEl.hidden = false;
    if (save && name) commit(name);
  }

  listNameInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finishListEdit(true);
    else if (e.key === "Escape") finishListEdit(false);
  });
  listNameInputEl.addEventListener("blur", () => finishListEdit(true));

  function closeMenu() {
    listMenuEl.hidden = true;
    listMenuBtnEl.setAttribute("aria-expanded", "false");
  }

  listMenuBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = listMenuEl.hidden;
    listMenuEl.hidden = !open;
    listMenuBtnEl.setAttribute("aria-expanded", String(open));
    listMenuEl.querySelector('[data-action="delete"]').disabled = lists.size <= 1;
  });

  listMenuEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || btn.disabled) return;
    closeMenu();
    const action = btn.dataset.action;
    if (action === "new") {
      editListName("", (name) => {
        checkpoint("Liste „" + name + "“ angelegt");
        const id = newId();
        const maxO = Math.max(0, ...[...lists.values()].map((l) => l.o || 0));
        const list = { t: name, o: maxO + 1 };
        lists.set(id, list);
        write({ [LIST + id]: list });
        setCurrentList(id);
      });
    } else if (action === "rename") {
      const id = currentList;
      editListName(lists.get(id).t || "", (name) => {
        checkpoint("Liste umbenannt in „" + name + "“");
        const list = { ...lists.get(id), t: name };
        lists.set(id, list);
        write({ [LIST + id]: list });
        render();
      });
    } else if (action === "delete") {
      deleteList(currentList);
    } else if (action === "history") {
      openHistory();
    } else if (action === "export") {
      exportBackup();
    } else if (action === "import") {
      $("importFile").click();
    } else if (action === "ai") {
      openAiPanel();
    } else if (action === "help") {
      openModal(helpEl);
    }
  });

  // --- Popups (shortcuts, AI settings, …) ------------------------------------
  // Real modals (<dialog>): backdrop dimmed and blurred, nothing behind it is
  // usable. Close via ×, click on the backdrop or Esc.
  function openModal(dlg) {
    closeMenu();
    setExpanded(null);
    if (!dlg.open) dlg.showModal();
  }

  const modalOpen = () => !!document.querySelector("dialog.modal[open]");

  // A popup can refuse to close: dlg.beforeClose() returns false (and shows
  // what's missing itself).
  const mayClose = (dlg) => !dlg.beforeClose || dlg.beforeClose();

  for (const dlg of document.querySelectorAll("dialog.modal")) {
    dlg.addEventListener("click", (e) => {
      // A click on the backdrop hits the <dialog> itself (content is inside .modal-body).
      if ((e.target === dlg || e.target.closest("[data-close]")) && mayClose(dlg)) dlg.close();
    });
    dlg.addEventListener("cancel", (e) => {
      if (!mayClose(dlg)) e.preventDefault(); // Esc
    });
  }

  function deleteList(id) {
    if (lists.size <= 1) return;
    checkpoint("Liste „" + (lists.get(id).t || "") + "“ gelöscht");
    const removed = { [LIST + id]: lists.get(id) };
    for (const [tid, t] of tasks) {
      if (t.l === id) removed[TASK + tid] = t;
    }
    const name = lists.get(id).t || "Liste";
    applyRemoval(removed);
    ensureCurrentList();
    setCurrentList(currentList);
    toast(`„${name}" gelöscht`, removed);
  }

  // --- Task actions ---------------------------------------------------------

  function createTask(fields) {
    const id = newId();
    tasks.set(id, compact({ l: currentList, ...fields }));
    return id;
  }

  // "Aufgabe hinzufügen": empty task at the top, directly in edit mode – the
  // same code as editing an existing task.
  function addTask() {
    checkpoint("Aufgabe hinzugefügt");
    const id = createTask({});
    placeTask(id, "", 0);
    focusAfterRender = { id, caret: "end" };
    render();
  }

  // "+ Unteraufgabe" button: new empty line as last child.
  function addChild(parentId) {
    checkpoint("Unteraufgabe zu " + q(parentId) + " hinzugefügt");
    const id = createTask({});
    placeTask(id, parentId, visibleChildren(currentList, parentId).length);
    focusAfterRender = { id, caret: "end" };
    render();
  }

  // Enter: new line directly below. If an open task has subtasks, the new
  // line becomes their first child (it is directly below, after all).
  // Below a checked subtask a new open sibling is created.
  function insertBelow(id, text) {
    const t = tasks.get(id);
    const nid = createTask({ l: t.l, t: text });
    if (!t.x && visibleChildren(t.l, id).length) {
      placeTask(nid, id, 0);
    } else {
      const par = parentOf(id);
      const idx = visibleChildren(t.l, par).findIndex((s) => s.id === id);
      placeTask(nid, par, idx + 1);
    }
    focusAfterRender = { id: nid, caret: "start" };
    render();
  }

  // Tab: becomes the last child of the task directly above (same level).
  function indent(id, caret) {
    const t = tasks.get(id);
    if (!t) return;
    const sibs = visibleChildren(t.l, parentOf(id));
    const i = sibs.findIndex((s) => s.id === id);
    if (i <= 0) return;
    checkpoint(q(id) + " eingerückt");
    const newParent = sibs[i - 1].id;
    placeTask(id, newParent, visibleChildren(t.l, newParent).length);
    focusAfterRender = { id, caret };
    render();
  }

  // Shift+Tab: becomes a sibling directly after the former parent.
  function outdent(id, caret) {
    const t = tasks.get(id);
    const par = parentOf(id);
    if (!t || !par) return;
    checkpoint(q(id) + " ausgerückt");
    const gp = parentOf(par);
    const sibs = visibleChildren(t.l, gp);
    const i = sibs.findIndex((s) => s.id === par);
    placeTask(id, gp, i < 0 ? sibs.length : i + 1);
    focusAfterRender = { id, caret };
    render();
  }

  // Alt+↑ / Alt+↓: one position up/down within the level.
  function moveBy(id, delta, caret) {
    const t = tasks.get(id);
    if (!t) return;
    const par = parentOf(id);
    const sibs = visibleChildren(t.l, par);
    const i = sibs.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= sibs.length) return;
    checkpoint(q(id) + " verschoben");
    placeTask(id, par, j);
    focusAfterRender = { id, caret };
    render();
  }

  function toggleDone(id) {
    const t = tasks.get(id);
    if (!t) return;
    checkpoint(q(id) + (t.x ? " wieder geöffnet" : " abgehakt"));
    setDoneState(id, !t.x);
    rollRecurring();
    render();
  }

  // Done → all open subtasks (any depth) as well; reopened → all done tasks above it too.
  function setDoneState(id, done) {
    const t = tasks.get(id);
    if (!t || !!t.x === done) return;
    const now = Date.now();
    const updates = {};
    const set = (tid, fields) => {
      const next = compact({ ...tasks.get(tid), ...fields });
      tasks.set(tid, next);
      updates[TASK + tid] = next;
    };
    if (done) {
      set(id, { x: true, xa: now });
      for (const d of descendants(id)) if (!tasks.get(d).x) set(d, { x: true, xa: now });
    } else {
      set(id, { x: false, xa: "" });
      for (const a of ancestors(id)) if (tasks.get(a).x) set(a, { x: false, xa: "" });
    }
    write(updates);
  }

  // Removes entries from storage and view ({ "T:id": value, … }).
  function applyRemoval(entries) {
    for (const key of Object.keys(entries)) {
      const id = key.slice(2);
      if (key.startsWith(TASK)) {
        tasks.delete(id);
        if (expandedId === id) expandedId = null;
      } else {
        lists.delete(id);
      }
    }
    remove(Object.keys(entries));
  }

  function withDescendants(id) {
    const out = { [TASK + id]: tasks.get(id) };
    for (const d of descendants(id)) out[TASK + d] = tasks.get(d);
    return out;
  }

  // deferRender: re-render only once typing stops (e.g. when an empty line
  // disappears on switching to another line).
  function deleteTask(id, { silent = false, deferRender = false } = {}) {
    if (!tasks.has(id)) return;
    if (!silent) checkpoint(q(id) + " gelöscht");
    const removed = withDescendants(id);
    applyRemoval(removed);
    if (deferRender) scheduleRender();
    else render();
    if (!silent) {
      const n = Object.keys(removed).length;
      toast(n === 1 ? "Aufgabe gelöscht" : `Aufgabe mit ${n - 1} Unteraufgabe(n) gelöscht`, removed);
    }
  }

  function clearDone() {
    const removed = {};
    for (const [id, t] of tasks) {
      if (t.l === currentList && t.x) Object.assign(removed, withDescendants(id));
    }
    const n = Object.keys(removed).length;
    if (!n) return;
    checkpoint("Erledigte gelöscht");
    applyRemoval(removed);
    render();
    toast(n === 1 ? "1 Aufgabe gelöscht" : `${n} Aufgaben gelöscht`, removed);
  }

  // Removing the date also removes time and repeat (both need a date).
  function setDue(id, d) {
    checkpoint(q(id) + (d ? " fällig " + d : ": Datum entfernt"));
    patchTask(id, d ? { d } : { d: "", h: "", r: "" });
    rollRecurring();
    render();
  }

  // Time without a date → today.
  function setTime(id, h) {
    checkpoint(q(id) + ": Uhrzeit " + (h || "entfernt"));
    const t = tasks.get(id);
    patchTask(id, { h, d: t.d || (h ? isoDate(0) : "") });
    rollRecurring();
    render();
  }

  // Weekly repeat (without a date → starting today).
  function setWeekly(id, on) {
    checkpoint(q(id) + (on ? " wöchentlich" : ": Wiederholung aus"));
    const t = tasks.get(id);
    patchTask(id, on ? { r: "w", s: t.s || id, d: t.d || isoDate(0) } : { r: "" });
    rollRecurring();
    render();
  }

  // --- Weekly repeat ----------------------------------------------------------
  // When the current instance is due or checked, the next one is created: one
  // week later, a number at the end of the title counts up ("Blatt 3" →
  // "Blatt 4"). The old one stays as its own task – even when overdue – and is
  // never overwritten. The new instance's ID is derived from series + date so
  // two devices syncing via Firefox Sync don't create duplicates.

  // Due date as a timestamp: exact with a time, end of day without one.
  function dueAt(t) {
    const [y, m, day] = t.d.split("-").map(Number);
    const [hh, mm] = t.h ? t.h.split(":").map(Number) : [23, 59];
    return new Date(y, m - 1, day, hh, mm, t.h ? 0 : 59).getTime();
  }

  function addDays(d, n) {
    const [y, m, day] = d.split("-").map(Number);
    const x = new Date(y, m - 1, day + n);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" +
      String(x.getDate()).padStart(2, "0");
  }

  const bumpNumber = (title) => title.replace(/(\d+)(\s*)$/, (_, n, sp) => String(Number(n) + 1) + sp);

  function rollRecurring() {
    const now = Date.now();
    let changed = false;
    for (const [startId, start] of [...tasks]) {
      if (start.r !== "w" || !start.d) continue;
      let id = startId;
      for (let guard = 0; guard < 12; guard++) {
        const cur = tasks.get(id);
        if (!cur || (!cur.x && dueAt(cur) > now)) break;
        const series = cur.s || id;
        const nextD = addDays(cur.d, 7);
        const nid = series + "-" + nextD.replace(/-/g, "");
        patchTask(id, { r: "", s: series });
        if (!tasks.has(nid)) {
          tasks.set(nid, compact({ l: cur.l, t: bumpNumber(cur.t || ""), n: cur.n, d: nextD, h: cur.h, r: "w", s: series }));
          const par = parentOf(id);
          const idx = visibleChildren(cur.l, par).findIndex((x) => x.id === id);
          placeTask(nid, par, idx < 0 ? 0 : idx + 1);
        }
        changed = true;
        id = nid;
      }
    }
    if (changed) scheduleRender();
  }

  // Leaving the title: save. Whether an empty task disappears is decided by
  // dropIfEmpty only once the whole task is left – so you can move from the
  // title to "Details" without it being deleted.
  function commitTitle(id, value) {
    cancelDebounce("t:" + id);
    if (tasks.has(id)) patchTask(id, { t: value.trim() });
  }

  // Remove completely empty tasks (no title, note, date or subtasks) – without
  // asking, nothing is lost.
  function dropIfEmpty(id) {
    flushPending();
    const t = tasks.get(id);
    if (!t || (t.t && t.t.trim()) || t.n || t.d || hasChildren(id)) return;
    deleteTask(id, { silent: true, deferRender: true });
  }

  // Backspace in an empty line: delete it and jump to the line above.
  function removeEmpty(id) {
    if (hasChildren(id)) return;
    checkpoint("Leere Zeile gelöscht");
    const cur = tasks.get(id);
    const prev = neighbor(id, -1);
    const silent = !cur.n && !cur.d;
    focusAfterRender = prev ? { id: prev, caret: "end" } : null;
    deleteTask(id, { silent });
  }

  // --- Focus & keyboard -----------------------------------------------------

  const findLi = (id) => document.querySelector(`li.task[data-id="${id}"]`);

  // Next visible task in screen order (across levels).
  function neighbor(id, dir) {
    const lis = [...document.querySelectorAll("#openList li.task, #doneList li.task")];
    const i = lis.findIndex((li) => li.dataset.id === id);
    const other = i < 0 ? null : lis[i + dir];
    return other ? other.dataset.id : null;
  }

  function focusTitle(id, caret) {
    const li = findLi(id);
    const field = li && li.querySelector(":scope > .row .field.title");
    if (field) field.startEdit(caret);
  }

  function onTitleKey(e, id, ta) {
    const t = tasks.get(id);
    if (!t) return;
    const pos = ta.selectionStart;
    const end = ta.selectionEnd;
    const saveNow = () => {
      cancelDebounce("t:" + id);
      patchTask(id, { t: ta.value });
    };
    const plain = !e.altKey && !e.ctrlKey && !e.metaKey;

    if (e.key === "Tab" && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      saveNow();
      if (e.shiftKey) outdent(id, pos);
      else indent(id, pos);
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      saveNow();
      toggleDone(id);
    } else if (e.key === "Enter" && plain && !e.shiftKey) {
      e.preventDefault();
      if (t.x && !parentOf(id)) {
        // Done top-level task (in the done section): leave the field.
        ta.blur();
        setExpanded(null);
      } else if (!ta.value.trim()) {
        // Empty line: indented → outdent, top level → leave
        // (the empty line then disappears by itself).
        if (parentOf(id)) {
          outdent(id, 0);
        } else {
          ta.blur();
          setExpanded(null);
        }
      } else {
        // Text right of the caret moves into the new line (as in Notion).
        checkpoint("Neue Zeile unter " + q(id));
        cancelDebounce("t:" + id);
        patchTask(id, { t: ta.value.slice(0, pos).trimEnd() });
        insertBelow(id, ta.value.slice(end).trim());
      }
    } else if (e.key === "Backspace" && plain && pos === 0 && end === 0) {
      if (!ta.value) {
        e.preventDefault();
        removeEmpty(id);
      } else if (parentOf(id) && !t.x) {
        e.preventDefault();
        saveNow();
        outdent(id, 0);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      ta.blur();
      setExpanded(null);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      saveNow();
      moveBy(id, e.key === "ArrowUp" ? -1 : 1, pos);
    } else if (plain && !e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      // Single line: jump right away; multi-line: only at the start/end.
      const up = e.key === "ArrowUp";
      const singleLine = ta.scrollHeight <= 30;
      if (singleLine || (up ? pos === 0 : pos === ta.value.length)) {
        const other = neighbor(id, up ? -1 : 1);
        if (other) {
          e.preventDefault();
          focusTitle(other, pos);
        } else if (up) {
          e.preventDefault();
          addBtnEl.focus();
        }
      }
    }
  }

  addBtnEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      const first = openListEl.querySelector("li.task");
      if (first) {
        e.preventDefault();
        focusTitle(first.dataset.id, "end");
      }
    }
  });

  // Nothing selected (just clicked into the sidebar): ↑ jumps to the bottom,
  // ↓ to the top visible task.
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (modalOpen()) return;
    const a = document.activeElement;
    if (a && a.matches("textarea, input, select")) return;
    const lis = document.querySelectorAll("#openList li.task, #doneList li.task");
    if (!lis.length) return;
    e.preventDefault();
    const li = e.key === "ArrowUp" ? lis[lis.length - 1] : lis[0];
    focusTitle(li.dataset.id, "end");
  });

  // --- Editing = expanding (only one task at a time) ------------------------

  function setExpanded(id) {
    if (expandedId === id) return;
    const prev = expandedId;
    expandedId = id;
    if (prev) {
      refreshRow(prev);
      dropIfEmpty(prev);
    }
    if (id) refreshRow(id);
  }

  // Focus in a task's title or details → expand that task.
  // (Not when checking it off: the check button expands nothing.)
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!(el instanceof Element)) return;
    const li = el.closest("li.task");
    if (!li) return;
    if (el.classList.contains("md-edit") || el.closest(".details")) setExpanded(li.dataset.id);
  });

  // Updates only details/preview of one row – without a full re-render, so a
  // field just clicked elsewhere keeps its focus.
  function refreshRow(id) {
    const li = findLi(id);
    const t = tasks.get(id);
    if (!li || !t) return;
    const isExp = expandedId === id;
    const old = li.querySelector(":scope > .details");
    if (old) {
      const ta = old.querySelector(".notes .md-edit");
      if (ta && !ta.hidden) {
        cancelDebounce("n:" + id);
        patchTask(id, { n: ta.value.trimEnd() });
      }
      old.remove();
    }
    const row = li.querySelector(":scope > .row");
    li.classList.toggle("expanded", isExp);
    row.querySelector(".meta").replaceWith(buildMeta({ id, ...tasks.get(id) }, isExp));
    if (isExp) row.after(buildDetails(id));
  }

  // A click outside the expanded task collapses it.
  document.addEventListener("click", (e) => {
    if (!listMenuEl.hidden && !listMenuEl.contains(e.target)) closeMenu();
    if (!expandedId || !document.contains(e.target)) return;
    const li = findLi(expandedId);
    if (!li) return;
    const row = li.querySelector(":scope > .row");
    const details = li.querySelector(":scope > .details");
    if (row.contains(e.target) || (details && details.contains(e.target))) return;
    setExpanded(null);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.defaultPrevented) return;
    closeMenu();
    // Innermost first: an expanded task collapses, the next Esc steps the chat back.
    if (expandedId) setExpanded(null);
    else if (chatMode) chatStepBack();
  });

  // --- Backup export / import -------------------------------------------------
  // File: { format: "tasks-backup", version: 1, exportedAt, data: { "L:…", "T:…" } }.
  // Import also accepts a plain collection of "L:…"/"T:…" entries.

  const BACKUP_KEY = /^[LT]:[A-Za-z0-9_-]{1,64}$/;
  const countOf = (data, prefix) => Object.keys(data).filter((k) => k.startsWith(prefix)).length;

  function exportBackup() {
    flushPending();
    const data = {};
    for (const [id, l] of lists) data[LIST + id] = l;
    for (const [id, t] of tasks) data[TASK + id] = t;
    const backup = { format: "tasks-backup", version: 1, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(backup, null, 1)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: "Tasks-Sicherung-" + isoDate(0) + ".json" });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast(`Sicherung gespeichert: ${lists.size} Listen, ${tasks.size} Aufgaben`);
  }

  let pendingImport = null;

  $("importFile").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    let parsed;
    try {
      parsed = JSON.parse(await file.text());
    } catch (_) {
      showBanner("Sicherung nicht lesbar: „" + file.name + "“ ist keine gültige JSON-Datei.");
      return;
    }
    const raw = parsed && parsed.format === "tasks-backup" ? parsed.data : parsed;
    const clean = {};
    if (raw && typeof raw === "object") {
      for (const [k, v] of Object.entries(raw)) {
        if (BACKUP_KEY.test(k) && v && typeof v === "object" && !Array.isArray(v)) clean[k] = v;
      }
    }
    const nL = countOf(clean, LIST);
    const nT = countOf(clean, TASK);
    if (!nL && !nT) {
      showBanner("In „" + file.name + "“ sind keine Listen oder Aufgaben.");
      return;
    }
    pendingImport = clean;
    const when = parsed.exportedAt ? " vom " + new Date(parsed.exportedAt).toLocaleString("de-DE") : "";
    $("importInfo").textContent = `„${file.name}“${when}: ${nL} Listen, ${nT} Aufgaben.`;
    openModal($("importDlg"));
  });

  function applyImport(replace) {
    if (!pendingImport) return;
    const data = pendingImport;
    pendingImport = null;
    checkpoint(replace ? "Sicherung eingespielt (ersetzt)" : "Sicherung zusammengeführt");
    const gone = [];
    if (replace) {
      for (const id of lists.keys()) if (!(LIST + id in data)) gone.push(LIST + id);
      for (const id of tasks.keys()) if (!(TASK + id in data)) gone.push(TASK + id);
    }
    for (const k of gone) (k.startsWith(TASK) ? tasks : lists).delete(k.slice(2));
    for (const [k, v] of Object.entries(data)) (k.startsWith(TASK) ? tasks : lists).set(k.slice(2), v);
    if (gone.length) remove(gone);
    write(data);
    $("importDlg").close();
    expandedId = null;
    ensureCurrentList();
    render();
    toast(`Sicherung ${replace ? "eingespielt (ersetzt)" : "zusammengeführt"}: ${countOf(data, LIST)} Listen, ${countOf(data, TASK)} Aufgaben`, () => undo());
  }

  $("importMerge").addEventListener("click", () => applyImport(false));
  $("importReplace").addEventListener("click", () => applyImport(true));

  // --- Undo toast -------------------------------------------------------------

  let toastTimer = null;
  let toastUndo = null;

  function toast(text, restore) {
    toastTextEl.textContent = text;
    toastUndo = restore;
    toastUndoEl.hidden = !restore; // plain notices without an undo button
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 7000);
  }

  function hideToast() {
    toastEl.hidden = true;
    toastUndo = null;
  }

  toastUndoEl.addEventListener("click", () => {
    const restore = toastUndo;
    hideToast();
    if (!restore) return;
    if (typeof restore === "function") {
      restore();
      return;
    }
    checkpoint("Gelöschtes wiederhergestellt");
    for (const [key, value] of Object.entries(restore)) {
      (key.startsWith(TASK) ? tasks : lists).set(key.slice(2), value);
    }
    const listKey = Object.keys(restore).find((k) => k.startsWith(LIST));
    write(restore);
    if (listKey) setCurrentList(listKey.slice(2));
    else render();
  });

  // --- Rendering ------------------------------------------------------------

  function formatLeft(ms) {
    const min = Math.floor(ms / 60000);
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    const m = min % 60;
    if (d) return `${d} T ${h} Std`;
    if (h) return `${h} Std ${m} Min`;
    return `${Math.max(m, 1)} Min`;
  }

  // Label of the due-date chip. With a time and less than 48 h left: countdown
  // ("noch 1 T 18 Std"); afterwards "überfällig".
  function dueInfo(t) {
    const d = t.d;
    const [y, m, day] = d.split("-").map(Number);
    const due = new Date(y, m - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((due - today) / 86400000);
    let label;
    if (diff === 0) label = "Heute";
    else if (diff === 1) label = "Morgen";
    else if (diff === -1) label = "Gestern";
    else if (diff > 1 && diff < 7) label = due.toLocaleDateString("de-DE", { weekday: "long" });
    else {
      label = due.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "short",
        year: due.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
    if (t.h) label += ", " + t.h;
    let cls = diff < 0 ? "overdue" : diff === 0 ? "today" : "";
    if (!t.x) {
      const left = dueAt(t) - Date.now();
      if (left <= 0) {
        cls = "overdue";
        if (t.h) label = "überfällig · " + label;
      } else if (t.h && left < 48 * 3600 * 1000) {
        cls = "soon";
        label = "noch " + formatLeft(left);
      }
    }
    return { label, cls };
  }

  function dueTitle(t) {
    const [y, m, day] = t.d.split("-").map(Number);
    const full = new Date(y, m - 1, day).toLocaleDateString("de-DE", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
    return "Fällig: " + full + (t.h ? ", " + t.h + " Uhr" : "") + (t.r === "w" ? " · wöchentlich" : "");
  }

  // Keep the countdown live and create weekly instances that became due.
  setInterval(() => {
    rollRecurring();
    for (const el of document.querySelectorAll(".due[data-id]")) {
      const t = tasks.get(el.dataset.id);
      if (!t || !t.d) continue;
      const info = dueInfo(t);
      el.className = "due " + info.cls;
      el.querySelector(".due-label").textContent = info.label;
    }
  }, 30000);

  // --- Links ----------------------------------------------------------------
  // Field u: [{ url, t: name }]. "Alle öffnen" takes the links of the task and
  // all its subtasks (without duplicates) and opens them as a tab group.

  const isWebUrl = (url) => /^https?:\/\//i.test(url || "");
  const linksOf = (t) => ((t && t.u) || []).filter((l) => l && isWebUrl(l.url));
  const plainTitle = (s) => (s || "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_~`]/g, "").trim();

  function collectLinks(id) {
    const out = [];
    const seen = new Set();
    const walk = (tid) => {
      for (const l of linksOf(tasks.get(tid))) {
        if (!seen.has(l.url)) {
          seen.add(l.url);
          out.push(l);
        }
      }
      const t = tasks.get(tid);
      if (!t) return;
      const kids = [];
      for (const [cid, c] of tasks) if (c.p === tid && c.l === t.l) kids.push({ id: cid, ...c });
      kids.sort(byOrder).forEach((k) => walk(k.id));
    };
    walk(id);
    return out;
  }

  // One link → one tab; several → a tab group named after the task.
  function openLinks(id) {
    const links = collectLinks(id);
    if (links.length) openUrls(links.map((l) => l.url), plainTitle((tasks.get(id) || {}).t) || "Tasks");
  }

  async function openUrls(urls, title) {
    try {
      if (urls.length === 1) {
        await browser.tabs.create({ url: urls[0], active: true });
        return;
      }
      const tabs = [];
      for (const url of urls) tabs.push(await browser.tabs.create({ url, active: false }));
      if (browser.tabs.group) {
        const groupId = await browser.tabs.group({ tabIds: tabs.map((t) => t.id) });
        if (browser.tabGroups) await browser.tabGroups.update(groupId, { title, color: "blue" });
      }
      await browser.tabs.update(tabs[0].id, { active: true });
    } catch (err) {
      showBanner("Links konnten nicht geöffnet werden: " + ((err && err.message) || err));
    }
  }

  function addLink(id, value) {
    let raw = (value || "").trim();
    if (!raw) return false;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(raw)) raw = "https://" + raw; // "ilias.hhu.de/…" without https://
    let url;
    try {
      url = new URL(raw);
    } catch (_) {
      return false;
    }
    if (!isWebUrl(url.href)) return false;
    const t = tasks.get(id);
    if (linksOf(t).some((l) => l.url === url.href)) return true;
    checkpoint("Link zu " + q(id) + " hinzugefügt");
    patchTask(id, { u: [...linksOf(t), { url: url.href, t: url.hostname }] });
    render();
    return true;
  }

  function removeLink(id, url) {
    checkpoint("Link von " + q(id) + " entfernt");
    patchTask(id, { u: linksOf(tasks.get(id)).filter((l) => l.url !== url) });
    render();
  }

  // One-off: "[Zur Seite](…)" used to be appended to the note – move it to field u.
  function migrateNoteLinks() {
    const re = /^\[Zur Seite\]\((https?:[^)\s]+)\)\s*$/;
    const updates = {};
    for (const [id, t] of tasks) {
      if (!t.n || !t.n.includes("[Zur Seite](")) continue;
      const keep = [];
      const u = [...linksOf(t)];
      for (const line of t.n.split("\n")) {
        const m = line.match(re);
        if (!m) {
          keep.push(line);
          continue;
        }
        const url = m[1].replace(/%28/g, "(").replace(/%29/g, ")");
        if (!u.some((l) => l.url === url)) u.push({ url, t: new URL(url).hostname });
      }
      const next = compact({ ...t, n: keep.join("\n").trim(), u });
      tasks.set(id, next);
      updates[TASK + id] = next;
    }
    if (Object.keys(updates).length) write(updates);
  }

  function buildMeta(t, isExpanded) {
    const meta = h("div", { class: "meta" });
    if (isExpanded) return meta;
    if (t.d) {
      const due = dueInfo(t);
      meta.append(h("span", { class: "due " + due.cls, title: dueTitle(t), dataset: { id: t.id } },
        t.r === "w" && icon("repeat"),
        h("span", { class: "due-label" }, due.label)));
    }
    const links = collectLinks(t.id);
    if (links.length) {
      const own = linksOf(t).length;
      meta.append(h("button", {
        class: "links-chip",
        type: "button",
        title: links.length === 1 ? "Öffnen: " + links[0].t + " – " + links[0].url
          : `${links.length} Links${own < links.length ? " (inkl. Unteraufgaben)" : ""} als Tab-Gruppe „${plainTitle(t.t)}" öffnen`,
        onclick: (e) => {
          e.stopPropagation();
          openLinks(t.id);
        },
      }, icon("link"), links.length > 1 && String(links.length)));
    }
    if (t.n && t.n.trim()) {
      const preview = h("div", { class: "note-preview md-view" });
      renderNotePreview(t.n, preview);
      meta.append(preview);
    }
    return meta;
  }

  function buildDetails(id) {
    const t = tasks.get(id);
    const notes = mdField({
      value: t.n || "",
      multiline: true,
      cls: "notes",
      placeholder: "Details",
      label: "Details",
      onInput: (v) => debounce("n:" + id, () => patchTask(id, { n: v })),
      onCommit: (v) => {
        cancelDebounce("n:" + id);
        patchTask(id, { n: v.trimEnd() });
      },
      onKeyDown: (e, ta) => {
        if (e.key === "Escape") {
          e.preventDefault();
          ta.blur();
          setExpanded(null);
        }
      },
    });

    const chip = (label, offset) => {
      const iso = isoDate(offset);
      return h("button", {
        class: "chip" + (t.d === iso ? " active" : ""),
        type: "button",
        onclick: () => setDue(id, t.d === iso ? "" : iso),
      }, label);
    };

    return h("div", { class: "details" },
      h("div", { class: "notes-row" }, h("span", { class: "notes-icon" }, icon("notes")), notes),
      h("div", { class: "notes-row links-row" },
        h("span", { class: "notes-icon" }, icon("link")),
        h("div", { class: "links-list" },
          linksOf(t).map((l) => h("span", { class: "link-chip" },
            h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer", title: l.url }, l.t || l.url),
            h("button", {
              class: "link-x",
              type: "button",
              title: "Link entfernen",
              "aria-label": "Link entfernen",
              onclick: () => removeLink(id, l.url),
            }, icon("close")))),
          h("input", {
            class: "link-add",
            type: "url",
            placeholder: "+ Link einfügen (Enter)",
            "aria-label": "Link hinzufügen",
            onkeydown: (e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const ok = addLink(id, e.target.value);
              if (!ok) {
                e.target.classList.add("invalid");
                return;
              }
              const li = findLi(id);
              const next = li && li.querySelector(":scope > .details .link-add");
              if (next) next.focus();
            },
            oninput: (e) => e.target.classList.remove("invalid"),
          })
        ),
        collectLinks(id).length > 1 && h("button", {
          class: "link-btn",
          type: "button",
          title: "Alle Links (inkl. Unteraufgaben) als Tab-Gruppe öffnen",
          onclick: () => openLinks(id),
        }, "Alle öffnen")
      ),
      h("div", { class: "detail-row" },
        chip("Heute", 0),
        chip("Morgen", 1),
        chip("+1 Woche", 7),
        h("input", {
          class: "date-input",
          type: "date",
          value: t.d || "",
          "aria-label": "Fälligkeitsdatum",
          onchange: (e) => setDue(id, e.target.value),
        }),
        h("input", {
          class: "date-input",
          type: "time",
          value: t.h || "",
          "aria-label": "Uhrzeit",
          onchange: (e) => setTime(id, e.target.value),
        }),
        t.d && h("button", {
          class: "icon-btn small",
          type: "button",
          title: "Datum entfernen",
          "aria-label": "Datum entfernen",
          onclick: () => setDue(id, ""),
        }, icon("close"))
      ),
      h("div", { class: "detail-row" },
        h("button", {
          class: "chip icon-only" + (t.r === "w" ? " active" : ""),
          type: "button",
          title: "Wöchentlich wiederholen – die Vorwoche bleibt stehen",
          "aria-label": "Wöchentlich wiederholen",
          "aria-pressed": String(t.r === "w"),
          onclick: () => setWeekly(id, t.r !== "w"),
        }, icon("repeat")),
        !t.x && h("button", {
          class: "link-btn",
          type: "button",
          title: "Tipp: Tab in einer Zeile rückt sie unter die Aufgabe darüber ein",
          onclick: () => addChild(id),
        }, icon("plus"), "Unteraufgabe")
      )
    );
  }

  function taskEl(t, tree, depth, sortable) {
    const kids = tree.get(t.id) || [];
    const isExp = expandedId === t.id;
    const canDrag = sortable && !t.x;

    const title = mdField({
      value: t.t || "",
      multiline: false,
      cls: "title",
      placeholder: depth ? "Unteraufgabe" : "Aufgabe",
      label: "Titel",
      onInput: (v) => debounce("t:" + t.id, () => patchTask(t.id, { t: v })),
      onCommit: (v) => commitTitle(t.id, v),
      onKeyDown: (e, ta) => onTitleKey(e, t.id, ta),
    });

    const row = h("div", { class: "row" },
      canDrag
        ? h("span", { class: "grip", title: "Ziehen zum Verschieben – weiter rechts loslassen = Unteraufgabe" }, icon("grip", "ico-dots"))
        : h("span", { class: "grip-spacer" }),
      h("button", {
        class: "check",
        type: "button",
        role: "checkbox",
        "aria-checked": String(!!t.x),
        title: t.x ? "Als offen markieren" : "Als erledigt markieren (Strg+Enter)",
        onclick: () => toggleDone(t.id),
      }, icon("check")),
      h("div", { class: "main" }, title, buildMeta(t, isExp)),
      // Only visible in edit mode (CSS).
      h("button", {
        class: "del icon-btn small",
        type: "button",
        title: "Aufgabe löschen",
        "aria-label": "Aufgabe löschen",
        onclick: () => deleteTask(t.id),
      }, icon("trash"))
    );

    return h("li", {
      class: "task" + (t.x ? " done" : "") + (isExp ? " expanded" : "") +
        (chatMarks.has(t.id) ? " chat-mark" : "") + (chatChanged.has(t.id) ? " chat-changed" : ""),
      dataset: { id: t.id },
    },
      row,
      isExp && buildDetails(t.id),
      kids.length > 0 && h("ul", { class: "subtasks" },
        kids.map((k) => taskEl(k, tree, depth + 1, sortable && !t.x))
      )
    );
  }

  function isBusy() {
    if (dragging) return true;
    const a = document.activeElement;
    const typing = a && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && a.type !== "date" && a.type !== "time"));
    return !!typing && !!a.closest(".task");
  }

  // Re-renders, but not while typing or dragging – otherwise the input under
  // the caret would be replaced. In that case it is done later.
  function scheduleRender() {
    renderPending = true;
    setTimeout(() => {
      if (renderPending && !isBusy()) render();
    }, 0);
  }

  document.addEventListener("focusout", () => {
    if (renderPending) scheduleRender();
  });

  function render() {
    flushPending();
    renderPending = false;
    rendering = true;
    try {
      renderListSelect();

      const all = [];
      for (const [id, t] of tasks) if (t.l === currentList) all.push({ id, ...t });
      const tree = new Map(); // parent id -> children
      for (const t of all) {
        const p = parentOf(t.id);
        if (!tree.has(p)) tree.set(p, []);
        tree.get(p).push(t);
      }
      // By order – checked subtasks keep their place.
      for (const kids of tree.values()) kids.sort(byOrder);

      // Guard against cycles (e.g. conflicting changes from two devices):
      // unreachable tasks are shown at the top level.
      const roots = tree.get("") || [];
      const seen = new Set();
      const mark = (id) => {
        if (seen.has(id)) return;
        seen.add(id);
        for (const k of tree.get(id) || []) mark(k.id);
      };
      roots.forEach((r) => mark(r.id));
      for (const t of all) {
        if (!seen.has(t.id)) {
          roots.push(t);
          mark(t.id);
          for (const kids of tree.values()) {
            const i = kids.indexOf(t);
            if (i >= 0 && kids !== roots) kids.splice(i, 1);
          }
        }
      }

      if (expandedId && !tasks.has(expandedId)) expandedId = null;

      const open = roots.filter((t) => !t.x).sort(byOrder);
      const done = roots.filter((t) => t.x).sort((a, b) => (b.xa || 0) - (a.xa || 0));

      openListEl.replaceChildren(...open.map((t) => taskEl(t, tree, 0, true)));
      countEl.textContent = String(all.filter((t) => !t.x).length);
      emptyEl.hidden = open.length > 0;

      doneSectionEl.hidden = done.length === 0;
      doneLabelEl.textContent = `Erledigt (${done.length})`;
      doneToggleEl.setAttribute("aria-expanded", String(doneOpen));
      doneListEl.hidden = !doneOpen;
      doneListEl.replaceChildren(...(doneOpen ? done.map((t) => taskEl(t, tree, 0, false)) : []));
    } finally {
      rendering = false;
    }

    if (focusAfterRender) {
      const { id, caret } = focusAfterRender;
      focusAfterRender = null;
      focusTitle(id, caret);
    }
  }

  window.addEventListener("resize", () => {
    for (const el of document.querySelectorAll(".md-edit:not([hidden])")) autosize(el);
  });

  addBtnEl.addEventListener("click", (e) => {
    // Don't let this reach the "click outside" handler – it would immediately
    // collapse (and, being empty, remove) the task just created.
    e.stopPropagation();
    closeMenu();
    addTask();
  });

  doneToggleEl.addEventListener("click", () => {
    doneOpen = !doneOpen;
    browser.storage.local.set({ [DONE_OPEN_KEY]: doneOpen });
    render();
  });

  $("clearDone").addEventListener("click", clearDone);

  // --- Drag & drop -----------------------------------------------------------
  // Dragging only via the grip (otherwise text in the title couldn't be
  // selected). Upper half of a row = before, lower half = after; further right
  // (over the title) or on a task with subtasks = as first child.

  function clearDropMarks() {
    for (const el of openListEl.querySelectorAll(".drop-before, .drop-after, .drop-inside")) {
      el.classList.remove("drop-before", "drop-after", "drop-inside");
    }
  }

  openListEl.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".grip");
    if (grip) grip.closest("li.task").draggable = true;
  });

  openListEl.addEventListener("pointerup", (e) => {
    const grip = e.target.closest(".grip");
    if (grip) grip.closest("li.task").draggable = false;
  });

  openListEl.addEventListener("dragstart", (e) => {
    const li = e.target;
    if (!(li instanceof HTMLLIElement) || !li.draggable) return;
    dragging = { id: li.dataset.id };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", (tasks.get(li.dataset.id) || {}).t || "");
    li.classList.add("dragging");
  });

  openListEl.addEventListener("dragover", (e) => {
    if (!dragging) return;
    clearDropMarks();
    dropInfo = null;
    const li = e.target instanceof Element ? e.target.closest("li.task") : null;
    const src = findLi(dragging.id);
    if (!li || !src || src.contains(li)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const row = li.querySelector(":scope > .row");
    const rect = row.getBoundingClientRect();
    const titleLeft = row.querySelector(".main").getBoundingClientRect().left;
    const lower = e.clientY > rect.top + rect.height / 2;
    const hasKids = visibleChildren(currentList, li.dataset.id).some((k) => k.id !== dragging.id);
    const mode = !lower ? "before" : hasKids || e.clientX > titleLeft + 24 ? "inside" : "after";
    row.classList.add("drop-" + mode);
    dropInfo = { id: li.dataset.id, mode };
  });

  openListEl.addEventListener("drop", (e) => {
    if (!dragging || !dropInfo) return;
    e.preventDefault();
    const { id: target, mode } = dropInfo;
    checkpoint(q(dragging.id) + " verschoben");
    if (mode === "inside") {
      placeTask(dragging.id, target, 0);
    } else {
      const par = parentOf(target);
      const sibs = visibleChildren(currentList, par).filter((s) => s.id !== dragging.id);
      const i = sibs.findIndex((s) => s.id === target);
      placeTask(dragging.id, par, mode === "before" ? i : i + 1);
    }
  });

  openListEl.addEventListener("dragend", (e) => {
    if (e.target instanceof HTMLLIElement) {
      e.target.draggable = false;
      e.target.classList.remove("dragging");
    }
    clearDropMarks();
    dragging = null;
    dropInfo = null;
    render();
  });

  // --- Theme toggle (system → light → dark → …) ------------------------------
  const THEME_ORDER = ["system", "light", "dark"];
  const THEME_META = {
    system: { icon: "monitor", label: "Design: System (klicken für hell)" },
    light: { icon: "sun", label: "Design: hell (klicken für dunkel)" },
    dark: { icon: "moon", label: "Design: dunkel (klicken für System)" },
  };

  function applyTheme(mode) {
    const m = THEME_ORDER.includes(mode) ? mode : "system";
    document.documentElement.dataset.theme = m;
    themeToggleEl.replaceChildren(icon(THEME_META[m].icon));
    themeToggleEl.title = THEME_META[m].label;
    themeToggleEl.setAttribute("aria-label", THEME_META[m].label);
  }

  themeToggleEl.addEventListener("click", async () => {
    const current = document.documentElement.dataset.theme || "system";
    const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
    applyTheme(next);
    await browser.storage.local.set({ [THEME_KEY]: next });
  });

  // --- History popup ----------------------------------------------------------
  // Rows in chronological order; the branch followed by Ctrl+Y continues at the
  // same indentation, other branches are indented below their fork.
  const historyDlgEl = $("historyDlg");
  const historyMsgEl = $("historyMsg");

  function timeAgo(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return "gerade eben";
    if (s < 3600) return "vor " + Math.round(s / 60) + " Min";
    const d = new Date(ms);
    const time = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    return d.toDateString() === new Date().toDateString() ? time
      : d.toLocaleDateString("de-DE", { day: "numeric", month: "numeric" }) + " " + time;
  }

  function historyRows() {
    const rows = [];
    const walk = (id, depth) => {
      for (let nid = id; nid;) {
        const n = hist.get(nid);
        rows.push({ n, depth });
        const main = n.kids.includes(n.lastKid) ? n.lastKid : n.kids[n.kids.length - 1];
        for (const k of n.kids) if (k !== main) walk(k, depth + 1);
        nid = main;
      }
    };
    if (histRoot) walk(histRoot, 0);
    return rows;
  }

  function renderHistory() {
    const onPath = new Set();
    for (let c = hist.get(histCurrent); c; c = c.parent ? hist.get(c.parent) : null) onPath.add(c.id);
    $("historyList").replaceChildren(...historyRows().map(({ n, depth }) => {
      const row = h("li", {
        class: "hist-row" + (n.id === histCurrent ? " current" : "") + (onPath.has(n.id) ? " on-path" : " off-path") + (depth ? " branch" : ""),
        dataset: { id: String(n.id) },
      },
        h("button", {
          class: "hist-jump",
          type: "button",
          title: n.id === histCurrent ? "Aktueller Stand" : "Zu diesem Stand springen",
          onclick: () => {
            jumpTo(n.id);
            historyMsgEl.hidden = true;
            renderHistory();
          },
        }, h("span", { class: "hist-label" }, n.label), h("span", { class: "hist-time" }, timeAgo(n.at))),
        n.parent && h("button", {
          class: "hist-revert icon-btn small",
          type: "button",
          title: "Nur diesen Schritt zurücknehmen (spätere bleiben)",
          "aria-label": "Nur diesen Schritt zurücknehmen",
          onclick: () => {
            const err = revertStep(n.id);
            historyMsgEl.textContent = err;
            historyMsgEl.hidden = !err;
            renderHistory();
          },
        }, icon("undo")));
      row.style.marginLeft = depth * 16 + "px";
      return row;
    }));
    const cur = $("historyList").querySelector(".current");
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: "nearest" });
  }

  $("historyClear").addEventListener("click", () => {
    clearHistory();
    historyMsgEl.hidden = true;
    renderHistory();
  });

  function openHistory() {
    commitPending();
    historyMsgEl.hidden = true;
    openModal(historyDlgEl);
    renderHistory();
  }

  // --- Real version vs. test copy ------------------------------------------
  // The real sidebar pings "Tasks DEV" (every 5 s and on window focus) and
  // shows a warning while it is loaded, so nobody tests in the real list by
  // mistake. The test copy always shows a DEV strip. No permission needed.
  const envBannerEl = $("envBanner");

  async function checkDevCopy() {
    let active = false;
    try {
      const r = await browser.runtime.sendMessage(DEV_ID, { type: "tasks-ping" });
      active = !!(r && r.ok);
    } catch (_) {
      // not installed / not loaded
    }
    envBannerEl.hidden = !active;
  }

  function setupEnvBanner() {
    if (IS_DEV) {
      envBannerEl.classList.add("dev");
      envBannerEl.replaceChildren(icon("alert"), h("span", null, "DEV · Test-Kopie mit eigenen Daten – deine echten Aufgaben sind in „Tasks“."));
      envBannerEl.hidden = false;
      return;
    }
    envBannerEl.replaceChildren(icon("alert"), h("span", null, "„Tasks DEV“ ist gerade auch geladen. Das hier ist deine echte Liste – zum Testen die Seitenleiste „Tasks DEV“ benutzen."));
    checkDevCopy();
    setInterval(checkDevCopy, 5000);
    window.addEventListener("focus", checkDevCopy);
  }

  // --- AI chat ----------------------------------------------------------------
  // The model answers with text plus actions from a fixed catalog (see
  // CHAT_JOB in background.js); this code validates and executes them. Each
  // answer with changes is one history step ("KI-Chat: …"), undoable on its
  // own; deletions wait for the user's confirmation. [[T:id]]/[[L:id]] in the
  // text become chips; highlight marks tasks in the list. Kept per device
  // (storage.local), at most CHAT_MAX messages.

  const CHAT_KEY = "tk:chat";
  const CHAT_MAX = 40;
  const CHAT_OPS = new Set(["create_task", "update_task", "move_task", "delete_task", "add_link", "remove_link",
    "create_list", "rename_list", "open_links"]);
  const ACTION_FIELDS = ["op", "target", "list", "parent", "ref", "title", "notes", "due_date", "due_time",
    "done", "weekly", "url", "link_title", "position"];
  const CHAT_SUGGESTIONS = [
    "Was ist diese Woche fällig?",
    "Sortiere die geöffnete Liste nach Fälligkeit",
    "Fasse meine offenen Aufgaben kurz zusammen",
    "Was kannst du alles?",
  ];
  const chatMarks = new Set(); // tasks the model talks about
  const chatChanged = new Set(); // tasks the model changed
  const chatPanelEl = $("chatPanel");
  const chatLogEl = $("chatLog");
  const chatInputEl = $("chatInput");
  let chat = [];
  let chatLoaded = false;
  let chatBusy = false;
  // null = closed; "full" / "tasks" / "quick" = which view a narrow sidebar
  // shows (tab "Chat", tab "Aufgaben", quick card). Wide shows both side by side.
  let chatMode = null;
  const wideQuery = window.matchMedia ? window.matchMedia("(min-width: 600px)") : null; // same as the CSS
  const isWide = () => !!(wideQuery && wideQuery.matches);

  function refChip(kind, id) {
    const item = kind === "T" ? tasks.get(id) : lists.get(id);
    return h("button", {
      class: "ref-chip" + (item ? "" : " gone"),
      type: "button",
      title: !item ? "nicht mehr vorhanden" : kind === "T" ? "Zur Aufgabe springen" : "Liste öffnen",
      onclick: (e) => {
        e.stopPropagation();
        if (!item) return;
        if (chatMode === "full" && !isWide()) setChatMode("tasks"); // the list sits behind the tab "Aufgaben"
        if (kind === "T") revealTask(id);
        else setCurrentList(id);
      },
    }, item ? plainTitle(item.t) || "(ohne Titel)" : "(gelöscht)");
  }

  function revealTask(id) {
    const t = tasks.get(id);
    if (!t) return;
    if (t.l !== currentList) setCurrentList(t.l);
    let li = findLi(id);
    if (!li && t.x && !doneOpen) {
      doneOpen = true;
      render();
      li = findLi(id);
    }
    if (li) {
      li.scrollIntoView({ block: "center" });
      li.classList.add("flash");
      setTimeout(() => li.classList.remove("flash"), 2500);
    }
  }

  // --- Context sent with every message ---
  function chatContext() {
    const lines = [
      "Heute: " + new Date().toLocaleString("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }),
      `Geöffnete Liste: „${(lists.get(currentList) || {}).t || ""}“ (list_id: ${currentList})`,
    ];
    const ex = expandedId && tasks.get(expandedId);
    lines.push(ex ? `Gerade aufgeklappt: „${plainTitle(ex.t)}“ (id: ${expandedId})` : "Gerade aufgeklappt: nichts");
    lines.push("", "Listen und Aufgaben:");
    for (const [lid, list] of sortedLists()) {
      lines.push(`Liste „${list.t || "Ohne Namen"}“ (list_id: ${lid})`);
      const walk = (pid, depth) => {
        const kids = [];
        for (const [id, t] of tasks) if (t.l === lid && parentOf(id) === pid) kids.push({ id, ...t });
        for (const t of kids.sort(byOrder)) {
          const bits = ["id: " + t.id];
          if (t.d) bits.push(`fällig ${t.d}${t.h ? " " + t.h : ""}`);
          if (t.r === "w") bits.push("wöchentlich");
          const note = (t.n || "").replace(/\s+/g, " ").trim();
          if (note) bits.push(`Notiz: „${note.slice(0, 120)}“`);
          const links = linksOf(t);
          if (links.length) bits.push("Links: " + links.map((l) => `${l.t} <${l.url.slice(0, 140)}>`).join("; "));
          lines.push(`${"  ".repeat(depth + 1)}- [${t.x ? "x" : " "}] ${t.t || "(ohne Titel)"} (${bits.join(", ")})`);
          walk(t.id, depth + 1);
        }
      };
      walk("", 0);
    }
    return lines.join("\n");
  }

  function buildChatPrompt(text) {
    const past = chat.slice(-16).filter((m) => !m.error).map((m) => {
      if (m.role === "user") return "Nutzer: " + m.text;
      const done = m.pending ? " (Änderungen warten auf Bestätigung)" : m.discarded ? " (Änderungen verworfen)"
        : m.undone ? " (Änderungen zurückgenommen)" : m.changed && m.changed.length ? ` (${m.changed.length} Aufgaben geändert)` : "";
      return "Assistent: " + m.text + done;
    });
    return [chatContext(), "", "Bisheriger Chat:", past.length ? past.join("\n") : "(neu)", "", "Neue Nachricht des Nutzers:", "<<<", text, ">>>"].join("\n");
  }

  function normalizeChat(raw) {
    const out = { reply: "", actions: [], highlight: [] };
    if (!raw || typeof raw !== "object") return out;
    out.reply = typeof raw.reply === "string" ? raw.reply : "";
    for (const a of Array.isArray(raw.actions) ? raw.actions : []) {
      if (!a || typeof a !== "object" || !CHAT_OPS.has(a.op)) continue;
      out.actions.push(Object.fromEntries(ACTION_FIELDS.map((f) => [f, a[f] == null ? "" : String(a[f]).trim()])));
    }
    out.highlight = (Array.isArray(raw.highlight) ? raw.highlight : []).map(String);
    return out;
  }

  // --- Executing actions ---
  // Validates every action against the data; what doesn't work is skipped and
  // reported. Returns { changed: Set, opened: number, problems: [] }.
  function applyChatActions(actions) {
    const refs = new Map();
    const changed = new Set();
    const problems = [];
    const urls = [];
    let groupTitle = "";
    const res = (x) => (x.startsWith("ref:") ? refs.get(x.slice(4)) || "" : x);
    const dateOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
    const timeOk = (t) => /^\d{2}:\d{2}$/.test(t);
    const known = new Set();
    for (const t of tasks.values()) for (const l of linksOf(t)) known.add(l.url);
    const linkOf = (a) => ({ url: a.url, t: (a.link_title || new URL(a.url).hostname).slice(0, 60) });
    const need = (cond, text) => {
      if (!cond) throw new Error(text);
    };

    for (const a of actions) {
      const target = res(a.target);
      try {
        switch (a.op) {
          case "create_list": {
            const id = newId();
            const maxO = Math.max(0, ...[...lists.values()].map((l) => l.o || 0));
            const list = { t: (a.title || "Neue Liste").slice(0, 100), o: maxO + 1 };
            lists.set(id, list);
            write({ [LIST + id]: list });
            if (a.ref) refs.set(a.ref, id);
            break;
          }
          case "rename_list": {
            need(lists.has(target) && a.title, "Liste nicht gefunden");
            const list = { ...lists.get(target), t: a.title.slice(0, 100) };
            lists.set(target, list);
            write({ [LIST + target]: list });
            break;
          }
          case "create_task": {
            let parent = res(a.parent);
            if (parent && !tasks.has(parent)) parent = "";
            const listId = parent ? tasks.get(parent).l : lists.has(res(a.list)) ? res(a.list) : currentList;
            const fields = { l: listId, t: (a.title || "Neue Aufgabe").slice(0, 500) };
            if (a.notes && a.notes !== "none") fields.n = a.notes.slice(0, 2000);
            if (dateOk(a.due_date)) fields.d = a.due_date;
            if (fields.d && timeOk(a.due_time)) fields.h = a.due_time;
            if (isWebUrl(a.url)) fields.u = [linkOf(a)];
            const id = createTask(fields);
            if (a.weekly === "true" && fields.d) tasks.set(id, compact({ ...tasks.get(id), r: "w", s: id }));
            const first = a.position === "first" || (!parent && a.position !== "last");
            placeTask(id, parent, first ? 0 : visibleChildren(listId, parent).length);
            if (a.ref) refs.set(a.ref, id);
            changed.add(id);
            break;
          }
          case "update_task": {
            const t = tasks.get(target);
            need(t, "Aufgabe nicht gefunden");
            const f = {};
            if (a.title) f.t = a.title.slice(0, 500);
            if (a.notes) f.n = a.notes === "none" ? "" : a.notes.slice(0, 2000);
            if (a.due_date === "none") Object.assign(f, { d: "", h: "", r: "" });
            else if (dateOk(a.due_date)) f.d = a.due_date;
            if (a.due_time === "none") f.h = "";
            else if (timeOk(a.due_time) && (f.d || t.d)) f.h = a.due_time;
            if (a.weekly === "true" && (f.d || t.d)) Object.assign(f, { r: "w", s: t.s || target });
            else if (a.weekly === "false") f.r = "";
            if (Object.keys(f).length) patchTask(target, f);
            if (a.done === "true" || a.done === "false") setDoneState(target, a.done === "true");
            changed.add(target);
            break;
          }
          case "move_task": {
            const t = tasks.get(target);
            need(t, "Aufgabe nicht gefunden");
            const parent = res(a.parent);
            need(!parent || tasks.has(parent), "Ziel nicht gefunden");
            need(parent !== target && !descendants(target).includes(parent), "Aufgabe kann nicht in sich selbst");
            const listId = parent ? tasks.get(parent).l : lists.has(res(a.list)) ? res(a.list) : t.l;
            if (listId !== t.l) {
              for (const id of [target, ...descendants(target)]) {
                const v = compact({ ...tasks.get(id), l: listId });
                tasks.set(id, v);
                write({ [TASK + id]: v });
              }
            }
            const n = visibleChildren(listId, parent).filter((s) => s.id !== target).length;
            placeTask(target, parent, a.position === "first" ? 0 : n);
            changed.add(target);
            break;
          }
          case "delete_task":
            need(tasks.has(target), "Aufgabe nicht gefunden");
            applyRemoval(withDescendants(target));
            break;
          case "add_link": {
            const t = tasks.get(target);
            need(t && isWebUrl(a.url), "Aufgabe oder Link ungültig");
            if (!linksOf(t).some((l) => l.url === a.url)) patchTask(target, { u: [...linksOf(t), linkOf(a)] });
            changed.add(target);
            break;
          }
          case "remove_link": {
            const t = tasks.get(target);
            need(t, "Aufgabe nicht gefunden");
            patchTask(target, { u: linksOf(t).filter((l) => l.url !== a.url) });
            changed.add(target);
            break;
          }
          case "open_links":
            if (target && tasks.has(target)) {
              for (const l of collectLinks(target)) urls.push(l.url);
              groupTitle = groupTitle || plainTitle(tasks.get(target).t);
            } else {
              need(isWebUrl(a.url) && known.has(a.url), "nur Links aus den Aufgaben können geöffnet werden");
              urls.push(a.url);
            }
            if (a.title) groupTitle = a.title;
            break;
          default:
            throw new Error("unbekannte Aktion");
        }
      } catch (err) {
        problems.push(`${a.op}: ${err.message}`);
      }
    }
    const unique = [...new Set(urls)];
    if (unique.length) openUrls(unique, groupTitle || "Tasks");
    for (const id of changed) if (!tasks.has(id)) changed.delete(id);
    return { changed, opened: unique.length, problems };
  }

  // Runs a message's actions as one history step.
  function runChatActions(msg) {
    checkpoint("KI-Chat: " + msg.request.slice(0, 50));
    const r = applyChatActions(msg.actions);
    if (expandedId && !tasks.has(expandedId)) expandedId = null;
    ensureCurrentList();
    clearTimeout(commitTimer);
    commitPending();
    const node = hist.get(histCurrent);
    msg.nodeId = node && node.label.startsWith("KI-Chat") && node.at >= msg.at ? node.id : null;
    msg.changed = [...r.changed];
    msg.opened = r.opened;
    msg.problems = r.problems;
    for (const id of r.changed) chatChanged.add(id);
  }

  function describeActions(actions) {
    const del = actions.filter((a) => a.op === "delete_task").map((a) => tasks.get(a.target) ? `„${plainTitle(tasks.get(a.target).t)}“` : null).filter(Boolean);
    const rest = actions.length - del.length;
    return (del.length ? "Löscht " + del.join(", ") + " (mit Unteraufgaben)" : "") + (rest ? (del.length ? " und ändert " : "Ändert ") + rest + " weitere" : "") + ".";
  }

  // --- Chat UI ---
  async function loadChat() {
    if (chatLoaded) return;
    const { [CHAT_KEY]: saved } = await browser.storage.local.get(CHAT_KEY);
    chat = saved && Array.isArray(saved.messages) ? saved.messages : [];
    chatLoaded = true;
  }

  function saveChat() {
    chat = chat.slice(-CHAT_MAX);
    browser.storage.local.set({ [CHAT_KEY]: { messages: chat } }).catch(() => {});
  }

  function chatBubble(m) {
    const body = h("div", { class: "md-view chat-text" });
    renderBlock(m.text || "", body);
    const el = h("div", { class: "chat-msg " + m.role + (m.error ? " error" : "") }, body);
    if (m.role !== "assistant" || m.error) return el;
    if (m.pending) {
      el.append(h("div", { class: "chat-pending" },
        h("span", null, describeActions(m.actions)),
        h("div", { class: "detail-row" },
          h("button", {
            class: "chip", type: "button",
            onclick: () => {
              m.pending = false;
              runChatActions(m);
              saveChat();
              render();
              showChatFocus([...chatChanged]);
              renderChat();
            },
          }, "Ausführen"),
          h("button", {
            class: "link-btn", type: "button",
            onclick: () => {
              m.pending = false;
              m.discarded = true;
              saveChat();
              renderChat();
            },
          }, "Verwerfen"))));
    }
    if (m.discarded) el.append(h("div", { class: "chat-note" }, "Verworfen – nichts geändert."));
    if (m.changed && m.changed.length) {
      el.append(h("div", { class: "chat-changes" },
        h("span", { class: "chat-note" }, m.undone ? "Zurückgenommen:" : "Geändert:"),
        m.changed.slice(0, 8).map((id) => refChip("T", id)),
        m.changed.length > 8 && h("span", { class: "chat-note" }, "+" + (m.changed.length - 8)),
        m.nodeId && !m.undone && h("button", {
          class: "link-btn", type: "button", title: "Nur diese Chat-Änderungen zurücknehmen (siehe auch ⋯ → Verlauf)",
          onclick: () => {
            const err = revertStep(m.nodeId);
            if (err) m.undoError = err;
            else m.undone = true;
            chatChanged.clear();
            saveChat();
            render();
            renderChat();
          },
        }, icon("undo"), "Rückgängig")));
    }
    if (m.undoError) el.append(h("div", { class: "chat-note warn" }, m.undoError));
    if (m.opened) el.append(h("div", { class: "chat-note" }, m.opened === 1 ? "1 Link geöffnet." : m.opened + " Links als Tab-Gruppe geöffnet."));
    if (m.problems && m.problems.length) el.append(h("div", { class: "chat-note warn" }, "Nicht ausgeführt: " + m.problems.join("; ")));
    return el;
  }

  function renderChat() {
    const items = chat.length ? chat.map(chatBubble) : [h("div", { class: "chat-empty" },
      h("p", null, "Frag etwas zu deinen Aufgaben oder sag, was passieren soll. Änderungen kannst du einzeln zurücknehmen."),
      CHAT_SUGGESTIONS.map((s) => h("button", { class: "chip", type: "button", onclick: () => sendChat(s) }, s)))];
    if (chatBusy) items.push(h("div", { class: "chat-msg assistant busy" }, "denkt nach", h("span", { class: "dots" })));
    chatLogEl.replaceChildren(...items);
    chatLogEl.scrollTop = chatLogEl.scrollHeight;
    $("chatSend").disabled = chatBusy;
    updateChatTabs();
  }

  function updateChatTabs() {
    $("tabTasks").setAttribute("aria-pressed", String(chatMode !== "full"));
    $("tabChat").setAttribute("aria-pressed", String(chatMode === "full"));
    const n = new Set([...chatMarks, ...chatChanged].filter((id) => tasks.has(id))).size;
    $("tabMarks").hidden = !n;
    $("tabMarks").textContent = n + " markiert";
  }

  // Make what the AI marked or changed visible: if none of it is in the open
  // list, switch to the list of the first one; scroll it into view.
  function showChatFocus(ids) {
    const present = ids.filter((id) => tasks.has(id));
    if (!present.length) return;
    if (!present.some((id) => tasks.get(id).l === currentList)) setCurrentList(tasks.get(present[0]).l);
    else render();
    const li = present.map(findLi).find(Boolean);
    if (li) li.scrollIntoView({ block: "nearest" });
  }

  async function sendChat(text) {
    text = text.trim();
    if (!text || chatBusy) return;
    chatMarks.clear();
    chatChanged.clear();
    const prompt = buildChatPrompt(text);
    chat.push({ role: "user", text, at: Date.now() });
    chatBusy = true;
    chatInputEl.value = "";
    autosize(chatInputEl);
    saveChat();
    render();
    renderChat();
    let reply;
    try {
      reply = await browser.runtime.sendMessage({ type: "chat", prompt });
    } catch (err) {
      reply = { ok: false, error: (err && err.message) || String(err) };
    }
    chatBusy = false;
    if (!reply || !reply.ok) {
      chat.push({ role: "assistant", error: true, text: (reply && reply.error) || "Keine Antwort.", at: Date.now() });
    } else {
      const data = normalizeChat(reply.data);
      const msg = { role: "assistant", text: data.reply || "(keine Antwort)", actions: data.actions, request: text, at: Date.now() };
      for (const id of data.highlight) if (tasks.has(id)) chatMarks.add(id);
      if (data.actions.length) {
        if (data.actions.some((a) => a.op === "delete_task")) msg.pending = true;
        else runChatActions(msg);
      }
      chat.push(msg);
    }
    saveChat();
    render();
    showChatFocus([...chatMarks, ...chatChanged]);
    renderChat();
  }

  // Open/close the chat or switch its view (see "Tasks / chat layout" in the CSS).
  async function setChatMode(mode) {
    const wasOpen = !!chatMode;
    chatMode = mode;
    chatPanelEl.hidden = !mode;
    if (mode) document.body.dataset.chat = mode;
    else delete document.body.dataset.chat;
    $("chatBtn").setAttribute("aria-expanded", String(!!mode));
    if (!mode) {
      chatInputEl.blur(); // a hidden field must not keep the focus
      chatMarks.clear();
      chatChanged.clear();
      render();
      updateChatTabs();
      return;
    }
    if (!wasOpen) await loadChat();
    renderChat();
    if (mode === "tasks" && !isWide()) chatInputEl.blur();
    else chatInputEl.focus();
  }

  function toggleChat(open = chatPanelEl.hidden) {
    return setChatMode(open ? "full" : null);
  }

  // Esc: quick card → tab "Aufgaben" (if something is marked there) → closed.
  function chatStepBack() {
    if (chatMode === "quick" && !isWide() && (chatMarks.size || chatChanged.size)) setChatMode("tasks");
    else setChatMode(null);
  }

  $("chatBtn").addEventListener("click", () => setChatMode(chatMode === "full" || (chatMode && isWide()) ? null : "full"));
  $("tabTasks").addEventListener("click", () => setChatMode("tasks"));
  $("tabChat").addEventListener("click", () => setChatMode("full"));
  $("chatExpand").addEventListener("click", () => setChatMode("full"));
  $("chatClose").addEventListener("click", () => toggleChat(false));
  $("chatNew").addEventListener("click", () => {
    chat = [];
    chatMarks.clear();
    chatChanged.clear();
    saveChat();
    render();
    renderChat();
    chatInputEl.focus();
  });
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    sendChat(chatInputEl.value);
  });
  chatInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChat(chatInputEl.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      chatStepBack();
    }
  });
  chatInputEl.addEventListener("input", () => autosize(chatInputEl));
  // "/" opens the chat (when not typing somewhere): narrow as a quick card over
  // the list, unless the full chat view is already showing.
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || modalOpen()) return;
    const a = document.activeElement;
    if (a && a.matches("textarea, input, select")) return;
    e.preventDefault();
    setChatMode(chatMode === "full" || isWide() ? "full" : "quick");
  });

  // --- Start -----------------------------------------------------------------

  async function init() {
    listMenuBtnEl.append(icon("more", "ico-dots"));
    $("addIcon").append(icon("plus"));
    $("doneChevron").append(icon("chevron"));
    $("chatBtn").append(icon("chat"));
    $("chatClose").append(icon("close"));
    $("chatSend").append(icon("send"));
    for (const b of document.querySelectorAll(".modal-close")) b.append(icon("close"));
    setupEnvBanner();
    const local = await browser.storage.local.get([THEME_KEY, CURRENT_KEY, DONE_OPEN_KEY]);
    applyTheme(local[THEME_KEY]);
    doneOpen = !!local[DONE_OPEN_KEY];
    currentList = local[CURRENT_KEY] || null;
    await reloadAll();
    ensureCurrentList();
    migrateNoteLinks();
    rollRecurring();
    render();
    await initHistory();
    // Catch up on the AI status in case the sidebar was just opened.
    const { [AI_STATUS]: st } = await browser.storage.local.get(AI_STATUS);
    if (st && Date.now() - st.at < 60000) showAiStatus(st);
  }

  // --- AI: "Zu Tasks hinzufügen" -------------------------------------------------
  // The background script (background.js) calls the model and writes the task;
  // here we only show progress, jump to the new task and prepare Ctrl+Z.

  const aiPanelEl = $("aiPanel");
  const aiStatusEl = $("aiStatus");
  const aiTestStateEl = $("aiTestState");

  const presetEl = $("apiPreset");
  const baseUrlEl = $("apiBaseUrl");
  const modelEl = $("apiModel");
  const apiKeyInputEl = $("apiKeyInput");
  const apiStateEl = $("apiState");
  const modeInputs = [...document.querySelectorAll('input[name="aiMode"]')];

  presetEl.append(...Object.entries(PRESETS).map(([id, p]) => h("option", { value: id }, p.label)));

  const apiReady = (cfg) => !!(cfg && cfg.baseUrl && cfg.model);
  const originPattern = (u) => `${u.protocol}//${u.hostname}/*`;

  function keyPlaceholder(cfg) {
    const p = PRESETS[presetEl.value];
    if (cfg && cfg.key && cfg.preset === presetEl.value) return "gespeichert (…" + cfg.key.slice(-4) + ") – leer lassen zum Behalten";
    return p.local ? "meist leer bei lokalen Modellen" : "API-Schlüssel des Anbieters";
  }

  let savedCfg = null;

  async function openAiPanel() {
    aiTestStateEl.textContent = "";
    apiStateEl.textContent = "";
    apiKeyInputEl.value = "";
    const st = await browser.storage.local.get([AI_MODE, API_CONFIG]);
    savedCfg = st[API_CONFIG] || null;
    const mode = st[AI_MODE] === "api" || st[AI_MODE] === "none" ? st[AI_MODE] : "claude-code";
    for (const r of modeInputs) r.checked = r.value === mode;
    showModeSection(mode); // selected option expanded right away
    warnedUnsaved = false;
    presetEl.value = savedCfg && PRESETS[savedCfg.preset] ? savedCfg.preset : "anthropic";
    baseUrlEl.value = savedCfg ? savedCfg.baseUrl : PRESETS[presetEl.value].baseUrl;
    modelEl.value = savedCfg ? savedCfg.model : PRESETS[presetEl.value].model;
    apiKeyInputEl.placeholder = keyPlaceholder(savedCfg);
    if (savedCfg) apiStateEl.textContent = "✓ " + savedCfg.label + " · " + savedCfg.model;
    openModal(aiPanelEl);
  }

  // The selected option shows its section; the others are collapsed.
  function showModeSection(mode) {
    $("ccSection").hidden = mode !== "claude-code";
    $("apiSection").hidden = mode !== "api";
    $("noneSection").hidden = mode !== "none";
    $("aiTestRow").hidden = mode === "none"; // nothing to test without an AI
    aiWarnEl.hidden = true;
  }

  for (const r of modeInputs) {
    r.addEventListener("change", () => {
      browser.storage.local.set({ [AI_MODE]: r.value });
      showModeSection(r.value);
    });
  }

  // Closing only once the selected option is complete. If the custom model is
  // missing something, the popup stays open; unsaved changes to an already
  // saved model are flagged once (closing again discards them).
  const aiWarnEl = $("aiWarn");
  let warnedUnsaved = false;

  function aiProblem() {
    const mode = (modeInputs.find((r) => r.checked) || {}).value;
    if (mode !== "api") return null;
    const filled = baseUrlEl.value.trim() && modelEl.value.trim();
    if (!apiReady(savedCfg)) {
      return { hard: true, text: filled
        ? "Eigenes Modell ist noch nicht gespeichert – bitte „Speichern“ klicken oder eine andere Option wählen."
        : "Für das eigene Modell fehlen Adresse und/oder Modell – bitte eintragen und speichern oder eine andere Option wählen." };
    }
    const changed = presetEl.value !== savedCfg.preset || baseUrlEl.value.trim().replace(/\/+$/, "") !== savedCfg.baseUrl ||
      modelEl.value.trim() !== savedCfg.model || apiKeyInputEl.value.trim() !== "";
    if (changed && !warnedUnsaved) {
      return { hard: false, text: "Änderungen am eigenen Modell sind nicht gespeichert – „Speichern“ klicken oder erneut schließen, um sie zu verwerfen." };
    }
    return null;
  }

  aiPanelEl.beforeClose = () => {
    const p = aiProblem();
    if (!p) return true;
    if (!p.hard) warnedUnsaved = true;
    aiWarnEl.textContent = p.text;
    aiWarnEl.hidden = false;
    return false;
  };

  // Preset chosen: prefill the address (and the model, if known).
  presetEl.addEventListener("change", () => {
    const p = PRESETS[presetEl.value];
    baseUrlEl.value = p.baseUrl;
    modelEl.value = p.model;
    apiKeyInputEl.placeholder = keyPlaceholder(savedCfg);
    (p.baseUrl ? modelEl : baseUrlEl).focus();
  });

  // Save: only now request access to exactly this address
  // (optional permission – Claude Code users are never asked).
  $("apiSave").addEventListener("click", async () => {
    let url;
    try {
      url = new URL(baseUrlEl.value.trim());
    } catch (_) {
      apiStateEl.textContent = "✗ Adresse ungültig";
      return;
    }
    const model = modelEl.value.trim();
    if (!model) {
      apiStateEl.textContent = "✗ Modell fehlt";
      return;
    }
    const granted = await browser.permissions.request({ origins: [originPattern(url)] });
    if (!granted) {
      apiStateEl.textContent = "✗ Zugriff auf " + url.host + " abgelehnt";
      return;
    }
    const p = PRESETS[presetEl.value];
    const keepKey = savedCfg && savedCfg.preset === presetEl.value ? savedCfg.key : "";
    const cfg = {
      preset: presetEl.value,
      label: p.label,
      protocol: p.protocol,
      baseUrl: url.href.replace(/\/+$/, ""),
      model,
      key: apiKeyInputEl.value.trim() || keepKey || "",
    };
    await browser.storage.local.set({ [API_CONFIG]: cfg });
    savedCfg = cfg;
    apiKeyInputEl.value = "";
    apiKeyInputEl.placeholder = keyPlaceholder(cfg);
    apiStateEl.textContent = "✓ gespeichert: " + cfg.label + " · " + cfg.model;
    aiWarnEl.hidden = true;
  });
  apiKeyInputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("apiSave").click();
  });
  $("apiRemove").addEventListener("click", async () => {
    await browser.storage.local.remove(API_CONFIG);
    savedCfg = null;
    apiKeyInputEl.placeholder = keyPlaceholder(null);
    apiStateEl.textContent = "eigenes Modell entfernt";
  });

  // Free test of a custom model: fetch the model list (no model call).
  async function testApi(cfg) {
    const url = new URL(cfg.baseUrl);
    if (!(await browser.permissions.contains({ origins: [originPattern(url)] }))) {
      return "✗ Zugriff auf " + url.host + " fehlt – erneut speichern";
    }
    const headers = cfg.protocol === "anthropic"
      ? { "x-api-key": cfg.key || "", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }
      : cfg.key ? { authorization: "Bearer " + cfg.key } : {};
    let res;
    try {
      res = await fetch(cfg.baseUrl.replace(/\/+$/, "") + "/models", { headers });
    } catch (_) {
      return "✗ " + cfg.label + " nicht erreichbar" + (PRESETS[cfg.preset] && PRESETS[cfg.preset].local ? " – läuft der lokale Server?" : "");
    }
    if (res.status === 401 || res.status === 403) return "✗ Schlüssel ungültig oder ohne Zugriff";
    if (!res.ok) return "✗ " + cfg.label + " antwortet mit Fehler " + res.status;
    const data = await res.json().catch(() => ({}));
    const ids = (data.data || data.models || []).map((m) => m.id || m.name);
    return ids.includes(cfg.model)
      ? "✓ " + cfg.label + " erreichbar, Modell „" + cfg.model + "“ vorhanden"
      : "✓ " + cfg.label + " erreichbar – Modell „" + cfg.model + "“ aber nicht in dessen Liste";
  }

  // Connection test for the selected route. Claude Code: ask for the version.
  // Custom model: fetch the model list – costs nothing.
  $("aiTest").addEventListener("click", async () => {
    aiTestStateEl.textContent = "Prüfe …";
    const st = await browser.storage.local.get([AI_MODE, API_CONFIG]);
    if (st[AI_MODE] === "api") {
      aiTestStateEl.textContent = apiReady(st[API_CONFIG]) ? await testApi(st[API_CONFIG]) : "✗ eigenes Modell nicht vollständig eingetragen";
      return;
    }
    try {
      const r = await browser.runtime.sendNativeMessage("tasks_claude", { ping: true });
      aiTestStateEl.textContent = r && r.ok ? "✓ Verbunden: " + r.version : "✗ " + ((r && r.error) || "Fehler");
    } catch (_) {
      aiTestStateEl.textContent = "✗ Claude Code nicht gefunden – native/install.sh ausführen" +
        (apiReady(st[API_CONFIG]) ? " (bis dahin wird das eigene Modell benutzt)" : "");
    }
  });
  $("aiStatusClose").addEventListener("click", () => {
    aiStatusEl.hidden = true;
  });

  function showAiStatus(st) {
    if (st.state === "done") {
      aiStatusEl.hidden = true;
      return;
    }
    aiStatusEl.hidden = false;
    aiStatusEl.classList.toggle("error", st.state === "error");
    $("aiStatusText").textContent = st.text;
  }

  // Done: take over the result, record the previous state for Ctrl+Z, jump there.
  function onAiDone(st) {
    const before = st.before || {};
    const after = st.after || {};
    for (const [k, v] of Object.entries(after)) (k.startsWith(TASK) ? tasks : lists).set(k.slice(2), v);
    const finalState = serialize();
    // State = current state with some entries overridden (null = absent).
    const stateWith = (overrides) => {
      const l = new Map(lists);
      const t = new Map(tasks);
      for (const [k, v] of Object.entries(overrides)) {
        const m = k.startsWith(TASK) ? t : l;
        if (v == null) m.delete(k.slice(2));
        else m.set(k.slice(2), v);
      }
      return stateOf(l, t);
    };
    // Local edits still pending belong before the AI result. Then: the
    // deliberate action (adding) and – separately – the model's grouping, so
    // Ctrl+Z first takes back only the grouping.
    ensureHistoryRoot();
    flushPending();
    const s0 = stateWith(before);
    if (s0 !== hist.get(histCurrent).state) addNode(pendingLabel || "Änderung", s0);
    pendingLabel = null;
    const name = st.taskTitle ? "„" + plainTitle(st.taskTitle) + "“" : "Aufgabe";
    if (st.insertOnly) {
      addNode("KI: " + name + " hinzugefügt", stateWith({ ...before, ...st.insertOnly }));
      addNode("KI: Gruppe „" + st.groupTitle + "“ angelegt", finalState);
    } else {
      addNode("KI: " + name + (st.updated ? " ergänzt" : " hinzugefügt"), finalState);
    }

    const task = tasks.get(st.taskId);
    if (task && task.l !== currentList) setCurrentList(task.l);
    else render();
    toast(st.text, () => undo());
    const li = st.taskId && findLi(st.taskId);
    if (li) {
      li.scrollIntoView({ block: "center" });
      li.classList.add("flash");
      setTimeout(() => li.classList.remove("flash"), 2500);
    }
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !changes[AI_STATUS]) return;
    const st = changes[AI_STATUS].newValue;
    if (!st) return;
    showAiStatus(st);
    if (st.state === "done") onAiDone(st);
  });

  init();
})();
