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
    check: "M5 12.5l4.5 4.5L19 7.5",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
    plus: "M12 5v14M5 12h14",
    close: "M6 6l12 12M18 6L6 18",
    trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
    notes: "M4 6h16M4 12h16M4 18h10",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
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
      if (!ta._checkpointed) {
        ta._checkpointed = true;
        checkpoint();
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

  // --- Undo / redo (Ctrl+Z / Ctrl+Y) ------------------------------------------
  // Before every action the state of all lists and tasks is recorded (as JSON
  // text, ~100 KB at most). Undo restores it and writes only the entries that
  // actually differ.

  const HISTORY_MAX = 100;
  const undoStack = [];
  const redoStack = [];

  const serialize = () => JSON.stringify({ l: [...lists], t: [...tasks] });

  function checkpoint() {
    flushPending();
    const s = serialize();
    if (undoStack[undoStack.length - 1] !== s) {
      undoStack.push(s);
      if (undoStack.length > HISTORY_MAX) undoStack.shift();
    }
    redoStack.length = 0;
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

  function stepHistory(from, to) {
    flushPending();
    const cur = serialize();
    // Skip entries equal to the current state.
    while (from.length && from[from.length - 1] === cur) from.pop();
    if (!from.length) return;
    to.push(cur);
    hideToast();
    applyState(from.pop());
  }

  const undo = () => stepHistory(undoStack, redoStack);
  const redo = () => stepHistory(redoStack, undoStack);

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
        checkpoint();
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
        checkpoint();
        const list = { ...lists.get(id), t: name };
        lists.set(id, list);
        write({ [LIST + id]: list });
        render();
      });
    } else if (action === "delete") {
      deleteList(currentList);
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
    checkpoint();
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
    checkpoint();
    const id = createTask({});
    placeTask(id, "", 0);
    focusAfterRender = { id, caret: "end" };
    render();
  }

  // "+ Unteraufgabe" button: new empty line as last child.
  function addChild(parentId) {
    checkpoint();
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
    checkpoint();
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
    checkpoint();
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
    checkpoint();
    placeTask(id, par, j);
    focusAfterRender = { id, caret };
    render();
  }

  function toggleDone(id) {
    const t = tasks.get(id);
    if (!t) return;
    checkpoint();
    const now = Date.now();
    const updates = {};
    const set = (tid, fields) => {
      const next = compact({ ...tasks.get(tid), ...fields });
      tasks.set(tid, next);
      updates[TASK + tid] = next;
    };
    if (!t.x) {
      // Done → all open subtasks (any depth) as well.
      set(id, { x: true, xa: now });
      for (const d of descendants(id)) if (!tasks.get(d).x) set(d, { x: true, xa: now });
    } else {
      // Reopened → all done tasks above it too.
      set(id, { x: false, xa: "" });
      for (const a of ancestors(id)) if (tasks.get(a).x) set(a, { x: false, xa: "" });
    }
    write(updates);
    rollRecurring();
    render();
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
    if (!silent) checkpoint();
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
    checkpoint();
    applyRemoval(removed);
    render();
    toast(n === 1 ? "1 Aufgabe gelöscht" : `${n} Aufgaben gelöscht`, removed);
  }

  // Removing the date also removes time and repeat (both need a date).
  function setDue(id, d) {
    checkpoint();
    patchTask(id, d ? { d } : { d: "", h: "", r: "" });
    rollRecurring();
    render();
  }

  // Time without a date → today.
  function setTime(id, h) {
    checkpoint();
    const t = tasks.get(id);
    patchTask(id, { h, d: t.d || (h ? isoDate(0) : "") });
    rollRecurring();
    render();
  }

  // Weekly repeat (without a date → starting today).
  function setWeekly(id, on) {
    checkpoint();
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
    checkpoint();
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
        checkpoint();
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
    setExpanded(null);
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
    checkpoint();
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
    checkpoint();
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
  async function openLinks(id) {
    const links = collectLinks(id);
    if (!links.length) return;
    try {
      if (links.length === 1) {
        await browser.tabs.create({ url: links[0].url, active: true });
        return;
      }
      const tabs = [];
      for (const l of links) tabs.push(await browser.tabs.create({ url: l.url, active: false }));
      if (browser.tabs.group) {
        const groupId = await browser.tabs.group({ tabIds: tabs.map((t) => t.id) });
        if (browser.tabGroups) {
          await browser.tabGroups.update(groupId, { title: plainTitle((tasks.get(id) || {}).t) || "Tasks", color: "blue" });
        }
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
    checkpoint();
    patchTask(id, { u: [...linksOf(t), { url: url.href, t: url.hostname }] });
    render();
    return true;
  }

  function removeLink(id, url) {
    checkpoint();
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
      class: "task" + (t.x ? " done" : "") + (isExp ? " expanded" : ""),
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
    checkpoint();
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

  // --- Start -----------------------------------------------------------------

  async function init() {
    listMenuBtnEl.append(icon("more", "ico-dots"));
    $("addIcon").append(icon("plus"));
    $("doneChevron").append(icon("chevron"));
    for (const b of document.querySelectorAll(".modal-close")) b.append(icon("close"));
    const local = await browser.storage.local.get([THEME_KEY, CURRENT_KEY, DONE_OPEN_KEY]);
    applyTheme(local[THEME_KEY]);
    doneOpen = !!local[DONE_OPEN_KEY];
    currentList = local[CURRENT_KEY] || null;
    await reloadAll();
    ensureCurrentList();
    migrateNoteLinks();
    rollRecurring();
    render();
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
    // State before the change = current state with the old values.
    const l = new Map(lists);
    const t = new Map(tasks);
    for (const [k, v] of Object.entries(after)) (k.startsWith(TASK) ? tasks : lists).set(k.slice(2), v);
    for (const [k, v] of Object.entries(before)) {
      const m = k.startsWith(TASK) ? t : l;
      if (v == null) m.delete(k.slice(2));
      else m.set(k.slice(2), v);
    }
    undoStack.push(JSON.stringify({ l: [...l], t: [...t] }));
    redoStack.length = 0;

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
