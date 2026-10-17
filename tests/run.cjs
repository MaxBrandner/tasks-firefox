// Test runner: node tests/run.cjs [filter]
// Runs every tests/*.test.cjs (or only those whose name contains the filter)
// and prints one summary line per file. Exit code 1 if anything fails.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const filter = process.argv[2] || "";
const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.cjs") && f.includes(filter)).sort();
if (!files.length) {
  console.log(`Keine Tests passen zu „${filter}“.`);
  process.exit(1);
}
let failed = 0;
let checks = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  const passed = (out.match(/^✔ /gm) || []).length;
  checks += passed;
  if (r.status === 0 && /Alle Prüfungen bestanden/.test(out)) {
    console.log(`✔ ${f.replace(".test.cjs", "")}: ${passed} bestanden`);
  } else {
    failed++;
    console.log(`✘ ${f.replace(".test.cjs", "")}:`);
    console.log(out.split("\n").filter((l) => l && !l.startsWith("✔ ") && !/Not implemented/.test(l)).map((l) => "    " + l).join("\n"));
  }
}
console.log(failed ? `\n${failed} von ${files.length} Dateien fehlgeschlagen` : `\nAlle ${checks} Prüfungen in ${files.length} Dateien bestanden`);
process.exit(failed ? 1 : 0);
