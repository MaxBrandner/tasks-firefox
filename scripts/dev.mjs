// Baut eine Test-Kopie der Erweiterung nach dev/ – unter eigener Kennung.
//
// Warum: Eine in about:debugging temporär geladene Erweiterung mit der
// echten Kennung ersetzt die installierte Version, und beim Entfernen löscht
// Firefox deren gespeicherte Daten (so am 17.10.2026 passiert). Die Kopie
// „Tasks DEV" hat eigene Daten und läuft neben der echten Version.
//
// Nach Code-Änderungen erneut `npm run dev` und in about:debugging „Neu laden".
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "dev");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const gecko = manifest.browser_specific_settings.gecko;
gecko.id = "tasks-dev@brandner.name";
delete gecko.update_url; // Test-Kopie bekommt keine Updates
manifest.name = "Tasks DEV";
manifest.browser_action.default_title = "Tasks DEV – Seitenleiste ein-/ausblenden";
manifest.sidebar_action.default_title = "Tasks DEV";
delete manifest.commands; // Strg+Alt+A bleibt der echten Version
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

for (const item of ["background.js", "icons", "sidebar"]) {
  fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}

console.log(`Test-Kopie „Tasks DEV" (${gecko.id}, Version ${manifest.version}) gebaut: ${out}
In Firefox: about:debugging#/runtime/this-firefox → „Temporäres Add-on laden" → dev/manifest.json
(nach Änderungen: npm run dev, dann dort „Neu laden"). Die echte Version bleibt unberührt.`);
