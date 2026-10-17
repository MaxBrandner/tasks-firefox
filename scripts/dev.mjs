// Builds a test copy of the extension into dev/ – under its own ID.
//
// Why: an extension loaded temporarily in about:debugging with the real ID
// replaces the installed version, and removing it makes Firefox delete its
// stored data (happened on 2026-10-17). The copy "Tasks DEV" has its own data
// and runs next to the real version.
//
// After code changes run `npm run dev` again and click "Neu laden" in about:debugging.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dev");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const gecko = manifest.browser_specific_settings.gecko;
gecko.id = "tasks-dev@brandner.name";
delete gecko.update_url; // the test copy gets no updates
manifest.name = "Tasks DEV";
manifest.browser_action.default_title = "Tasks DEV – Seitenleiste ein-/ausblenden";
manifest.sidebar_action.default_title = "Tasks DEV";
delete manifest.commands; // Ctrl+Alt+A stays with the real version
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

for (const item of ["background.js", "icons", "sidebar"]) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}

console.log(`Test-Kopie „Tasks DEV" (${gecko.id}, Version ${manifest.version}) gebaut: ${out}
In Firefox: about:debugging#/runtime/this-firefox → „Temporäres Add-on laden" → dev/manifest.json
(nach Änderungen: npm run dev, dann dort „Neu laden"). Die echte Version bleibt unberührt.`);
