// Run: npm test (all) or npm test <name>
// The Claude Code helper (native/tasks_claude_host.py) against a fake `claude`
// that records its arguments and input – no subscription quota used.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
let fails = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tasks-host-test-"));
const rec = path.join(dir, "rec.json");
fs.writeFileSync(path.join(dir, "claude"), `#!/usr/bin/env python3
import json, sys
args = sys.argv[1:]
if args == ["--version"]:
    print("9.9.9 (Claude Code)"); sys.exit(0)
stdin = sys.stdin.read()
json.dump({"args": args, "stdin": stdin}, open(${JSON.stringify(rec)}, "w"))
result = {"type": "result", "subtype": "success", "is_error": False, "structured_output": {"ok": "ja"}}
if "--input-format" in args:
    print(json.dumps({"type": "system", "subtype": "init"}))
    print(json.dumps(result))
else:
    print(json.dumps(result))
`, { mode: 0o755 });

function host(msg) {
  const body = Buffer.from(JSON.stringify(msg));
  const len = Buffer.alloc(4); len.writeUInt32LE(body.length);
  const r = spawnSync("python3", [path.join(ROOT, "native", "tasks_claude_host.py")], {
    input: Buffer.concat([len, body]), env: { ...process.env, PATH: dir + path.delimiter + process.env.PATH, PYTHONDONTWRITEBYTECODE: "1" },
  });
  return JSON.parse(r.stdout.slice(4, 4 + r.stdout.readUInt32LE(0)).toString());
}
const base = { system: "S", prompt: "Was steht drin?", schema: { type: "object" }, effort: "low" };
const b64 = (s) => Buffer.from(s).toString("base64");

ok(host({ ping: true }).version === "9.9.9 (Claude Code)", "Ping liefert die Claude-Code-Version");

let r = host(base);
let seen = JSON.parse(fs.readFileSync(rec, "utf8"));
ok(r.ok && r.data.ok === "ja" && seen.args.includes("--output-format") && seen.args[seen.args.indexOf("--output-format") + 1] === "json" && !seen.args.includes("--input-format") && seen.stdin === "Was steht drin?",
  "ohne Anhänge: wie bisher Text rein, JSON raus");
ok(seen.args.includes("--tools") && seen.args[seen.args.indexOf("--tools") + 1] === "" && seen.args.includes("--no-session-persistence") && seen.args.includes("--strict-mcp-config"), "Sicherheitsoptionen gesetzt");

r = host({ ...base, attachments: [
  { media_type: "image/png", data: b64("PNG"), name: "flyer.png" },
  { media_type: "application/pdf", data: b64("%PDF"), name: "blatt.pdf" },
  { media_type: "text/plain", data: b64("Abgabe Montag"), name: "notiz.txt" },
] });
seen = JSON.parse(fs.readFileSync(rec, "utf8"));
const msg = JSON.parse(seen.stdin.trim());
const types = msg.message.content.map((b) => b.type).join(",");
ok(r.ok && r.data.ok === "ja" && seen.args.includes("--input-format") && seen.args.includes("--verbose") && seen.args[seen.args.indexOf("--output-format") + 1] === "stream-json", "mit Anhängen: stream-json rein und raus, Ergebnis aus dem result-Ereignis");
ok(types === "image,document,text,text" && msg.message.content[0].source.media_type === "image/png" && /notiz\.txt[\s\S]*Abgabe Montag/.test(msg.message.content[2].text) && msg.message.content[3].text === "Was steht drin?",
  "Bild, PDF und Textdatei als Inhaltsblöcke, Prompt zuletzt: " + types);
ok(seen.args.includes("--tools") && seen.args[seen.args.indexOf("--tools") + 1] === "", "auch mit Anhängen keine Werkzeuge");

r = host({ ...base, attachments: [{ media_type: "application/zip", data: b64("PK"), name: "x.zip" }] });
ok(!r.ok && /Dateityp wird nicht unterstützt: application\/zip/.test(r.error), "nicht unterstützter Dateityp → verständlicher Fehler");

fs.rmSync(dir, { recursive: true, force: true });
console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
process.exit(fails ? 1 : 0);
