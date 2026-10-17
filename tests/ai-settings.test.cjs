// Run: npm test (all) or npm test <name>
const ROOT = require("node:path").resolve(__dirname, "..");
const H = require("./harness.cjs")(ROOT);
const { d, ok, tick, local } = H;
const $ = (id) => d.getElementById(id);
const openAi = async () => { $("listMenuBtn").click(); d.querySelector('[data-action="ai"]').click(); await tick(); await tick(); };
const ev = (el, type) => el.dispatchEvent(new H.w.Event(type));
const radio = (v) => d.querySelector(`input[name="aiMode"][value="${v}"]`);
const shown = () => ["ccSection", "apiSection", "noneSection"].filter((id) => !$(id).hidden).join(",");
const closeX = async () => { $("aiPanel").querySelector(".modal-close").click(); await tick(); };
const closeBackdrop = async () => { $("aiPanel").dispatchEvent(new H.w.MouseEvent("click", { bubbles: true })); await tick(); };
const closeEsc = async () => { const e = new H.w.Event("cancel", { cancelable: true }); $("aiPanel").dispatchEvent(e); if (!e.defaultPrevented) $("aiPanel").close(); await tick(); };
(async () => {
  await tick();
  ok(d.querySelector('[data-action="ai"]').textContent === "KI einrichten …", "Menüpunkt „KI einrichten …“");
  await openAi();
  ok(radio("claude-code").checked && shown() === "ccSection" && /native\/install\.sh/.test($("ccSection").textContent), "Öffnen: gewählte Option (Claude Code) ist schon aufgeklappt");
  ok(!$("aiTestRow").hidden, "Testknopf sichtbar");
  $("aiTest").click(); await tick();
  ok(/Verbunden: 2\.1\.302/.test($("aiTestState").textContent), "Verbindungstest Claude Code");
  // no AI
  radio("none").click(); await tick();
  ok(local.data["tk:aiMode"] === "none" && shown() === "noneSection" && $("aiTestRow").hidden, "„Keine KI“: gespeichert, Hinweis offen, kein Testknopf");
  await closeX();
  ok(!$("aiPanel").open, "„Keine KI“ → Schließen ohne Rückfrage");
  await openAi();
  ok(radio("none").checked && shown() === "noneSection", "erneut geöffnet: „Keine KI“ markiert und aufgeklappt");
  // custom model incomplete → closing blocked
  radio("api").click(); await tick();
  ok(local.data["tk:aiMode"] === "api" && shown() === "apiSection", "Wechsel auf Eigenes Modell klappt um");
  $("apiPreset").value = "ollama"; ev($("apiPreset"), "change");
  await closeX();
  ok($("aiPanel").open && !$("aiWarn").hidden && /fehlen Adresse und\/oder Modell/.test($("aiWarn").textContent), "× bei fehlendem Modell: bleibt offen, Meldung");
  await closeBackdrop();
  ok($("aiPanel").open, "Klick daneben ebenfalls gesperrt");
  $("apiModel").value = "qwen-test";
  await closeEsc();
  ok($("aiPanel").open && /noch nicht gespeichert/.test($("aiWarn").textContent), "Esc bei eingetragen, aber ungespeichert: gesperrt, Meldung „nicht gespeichert“");
  $("apiSave").click(); await tick();
  ok(local.data["tk:api"] && local.data["tk:api"].model === "qwen-test" && $("aiWarn").hidden, "Speichern → Meldung weg");
  H.fetchReply = () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "qwen-test" }] }) });
  $("aiTest").click(); await tick();
  ok(H.lastFetch.url === "http://localhost:11434/v1/models" && /vorhanden/.test($("aiTestState").textContent), "Test: nur kostenlose Modellliste");
  await closeX();
  ok(!$("aiPanel").open, "vollständig gespeichert → Schließen geht");
  await openAi();
  ok(radio("api").checked && shown() === "apiSection" && $("apiModel").value === "qwen-test", "erneut geöffnet: Eigenes Modell aufgeklappt mit gespeicherten Werten");
  // unsaved change: warn once, second close discards
  $("apiModel").value = "anderes";
  await closeX();
  ok($("aiPanel").open && /nicht gespeichert – „Speichern“ klicken oder erneut schließen/.test($("aiWarn").textContent), "ungespeicherte Änderung: einmal warnen");
  await closeX();
  ok(!$("aiPanel").open && local.data["tk:api"].model === "qwen-test", "zweites Schließen verwirft die Änderung");
  // back to Claude Code: no obstacle
  await openAi(); radio("claude-code").click(); await tick(); await closeX();
  ok(!$("aiPanel").open && local.data["tk:aiMode"] === "claude-code", "Claude Code gewählt → Schließen ohne Rückfrage");
  H.finish();
})().catch((e) => { console.error(e); process.exit(1); });
