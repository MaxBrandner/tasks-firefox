# Neue Version veröffentlichen

Kurzanleitung, um eine neue Version der Erweiterung an die Nutzer auszuliefern.

## Wie das Ganze zusammenhängt

Es gibt **zwei unabhängige** Dinge, die beide „Update" heißen:

1. **Signieren bei Mozilla** – holt Mozillas Signatur für die neue Version (per
   API-Keys, siehe unten). Ohne Signatur installiert Firefox die `.xpi` nicht
   dauerhaft.
2. **`update_url` / `updates.json`** – der Auslieferungskanal zu den Nutzern.
   Firefox liest bei jedem Nutzer regelmäßig die `updates.json` auf GitHub und
   installiert eine neuere Version **automatisch**. Hat mit Mozilla nichts zu tun.

```
manifest.json (in der .xpi)  --update_url-->  updates.json (GitHub)
                                                     |
                                                     +--update_link--> tasks-X.Y.Z.xpi (GitHub Release)
```

Die verteilte Erweiterung ist **unlisted** (nicht im öffentlichen AMO-Katalog),
wird aber über das öffentliche GitHub-Repo verteilt.

## Schritt für Schritt

### 1. Versionsnummer erhöhen (an allen drei Stellen gleich!)

- `manifest.json`  → `"version": "X.Y.Z"`
- `package.json`   → `"version": "X.Y.Z"`
- `updates.json`   → `"version": "X.Y.Z"` **und** den `update_link` auf
  `.../releases/download/vX.Y.Z/tasks-X.Y.Z.xpi` anpassen

> Jede Versionsnummer darf bei AMO nur **einmal** existieren – immer hochzählen,
> nie eine bereits hochgeladene Nummer wiederverwenden.

### 2. Bauen & signieren (per API)

```bash
npm run build          # erzeugt web-ext-artifacts/tasks-X.Y.Z.zip
npm run sign           # liest die AMO-Keys aus .env, signiert per API
```

`npm run sign` (→ `scripts/sign.sh`) lädt die AMO-Credentials aus der lokalen
**`.env`** und lässt `web-ext sign` die fertig **signierte** `.xpi` direkt nach
`web-ext-artifacts/` laden (Kanal `unlisted` ist in `web-ext-config.cjs` gesetzt).

**Einmalige Einrichtung:** `.env.example` nach `.env` kopieren und deine Keys
eintragen (`WEB_EXT_API_KEY`, `WEB_EXT_API_SECRET`). Die `.env` ist in
`.gitignore` ausgeschlossen und wird nie committet.
Keys erzeugen: https://addons.mozilla.org/developers/addon/api/key/

Die signierte Datei muss exakt `tasks-X.Y.Z.xpi` heißen (passend zum
`update_link`). Legt web-ext sie unter einem anderen Namen ab, einmal umbenennen:

```bash
mv web-ext-artifacts/<signierte-datei>.xpi web-ext-artifacts/tasks-X.Y.Z.xpi
```

### 3. Committen & GitHub-Release anlegen

```bash
git add manifest.json package.json updates.json
git commit -m "Version X.Y.Z"
git push origin main

gh release create vX.Y.Z \
  web-ext-artifacts/tasks-X.Y.Z.xpi \
  --title "Tasks X.Y.Z" \
  --notes "Beschreibung der Änderungen."
```

### 4. Prüfen, dass alles öffentlich erreichbar ist

```bash
curl -s -o /dev/null -w "updates.json: %{http_code}\n" \
  https://raw.githubusercontent.com/MaxBrandner/tasks-firefox/main/updates.json
curl -s -L -o /dev/null -w "xpi:          %{http_code}\n" \
  https://github.com/MaxBrandner/tasks-firefox/releases/download/vX.Y.Z/tasks-X.Y.Z.xpi
```

Beide müssen `200` liefern. Danach aktualisiert Firefox alle Nutzer automatisch.

## Wichtige Fakten

- **Add-on-ID:** `tasks@brandner.name` – muss im Manifest und als Schlüssel
  in `updates.json` identisch bleiben. Ändern = für Firefox eine *andere*
  Erweiterung (bestehende Installationen updaten dann nicht mehr).
- **update_url:** `https://raw.githubusercontent.com/MaxBrandner/tasks-firefox/main/updates.json`
  Steht im Manifest und ist Teil der signierten Datei – bei einem Umzug müsste
  neu signiert werden.
- **Verteil-Link für Nutzer:**
  `https://github.com/MaxBrandner/tasks-firefox/releases/latest`
