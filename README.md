# Tasks – Firefox-Erweiterung

Aufgabenlisten (ähnlich Google Tasks) in der Firefox-Seitenleiste, bedienbar wie
Notion. Gespeichert wird über **Firefox Sync** – auf allen Rechnern, auf denen du
mit deinem Firefox-Konto angemeldet bist, sind dieselben Aufgaben da. Kein
Google, kein eigener Server.

**Download:** [neueste Version](https://github.com/MaxBrandner/tasks-firefox/releases/latest)
(`tasks-X.Y.Z.xpi`) – Updates kommen danach automatisch.

## Funktionen

- **Mehrere Listen** – oben auswählen; über `⋯` anlegen, umbenennen, löschen.
- **Aufgaben** – „+ Aufgabe hinzufügen" legt oben eine neue an. Ein Klick auf
  eine Aufgabe öffnet sie wie bei Google Tasks: Titel, **Details** (Notiz),
  Fälligkeit und Papierkorb. Klick daneben oder Esc schließt.
- **Unteraufgaben** – beliebig tief verschachtelt (Tab / Shift+Tab). Hauptaufgabe
  erledigt → alle darunter auch; Unteraufgabe wieder offen → alle darüber auch.
  Abgehakte Unteraufgaben bleiben an ihrem Platz.
- **Fälligkeit** – Schnellknöpfe Heute / Morgen / +1 Woche oder Datum, dazu
  optional eine **Uhrzeit**. Anzeige „Heute", „Morgen", Wochentag; unter 48 h
  ein **Countdown** („noch 1 T 18 Std"), danach „überfällig" in Rot.
- **↻ Wöchentlich** – ist eine Abgabe fällig oder abgehakt, entsteht die nächste
  eine Woche später (Zahl am Titelende zählt mit: „Blatt 3" → „Blatt 4"). Die
  Vorwoche bleibt als eigene Aufgabe stehen und wird nicht überschrieben.
- **Links** – eigenes Feld je Aufgabe, beliebig viele (im Bearbeitungsmodus
  „+ Link einfügen"). Eingeklappt zeigt 🔗 die Anzahl – inklusive der Links aller
  Unteraufgaben; ein Klick öffnet einen Link direkt bzw. mehrere zusammen als
  **Firefox-Tab-Gruppe** mit dem Namen der Aufgabe (z. B. alles zu „DL").
- **Markdown** in Titel und Notiz: `**fett**`, `*kursiv*`, `~~durch~~`,
  `` `code` ``, `[Text](https://…)`; Links werden automatisch erkannt. In
  Notizen zusätzlich `- Liste`, `1. Liste`, `# Überschrift`, `> Zitat`.
- **Sortieren** – am Griff `⋮⋮` ziehen (weiter rechts loslassen = Unteraufgabe)
  oder im Titel **Alt+↑ / Alt+↓**.
- **Erledigt** – einklappbarer Bereich, unten verankert; „Erledigte löschen".
- **Rückgängig / Wiederholen** – **Strg+Z** / **Strg+Y** für alle Änderungen;
  beim Tippen wirkt Strg+Z zuerst auf den Text im Feld. Nach dem Löschen
  zusätzlich ein „Rückgängig"-Knopf.
- **Verlauf** (`⋯` → „Verlauf …") – alle Schritte als Baum: Wer nach Strg+Z
  etwas Neues macht, bekommt einen **Zweig**, der alte Weg bleibt erhalten. Klick
  auf einen Schritt springt zu diesem Stand; ↶ nimmt **nur diesen einen Schritt**
  zurück, spätere bleiben (abgelehnt, wenn spätere Schritte dieselben Aufgaben
  geändert haben). Der Verlauf bleibt dauerhaft gespeichert (pro Rechner,
  höchstens 200 Schritte, platzsparend als Änderungen); „Verlauf leeren" macht
  den aktuellen Stand zum neuen Start.
- **Zu Tasks hinzufügen (KI)** – markierten Text einer Webseite per Rechtsklick
  als Aufgabe einsortieren lassen, siehe unten.
- **Design** – System / Hell / Dunkel (Knopf oben rechts). Einstellungen und
  Hilfe öffnen sich als Popup.

### Tastatur

| Taste | Wirkung |
|---|---|
| `Strg+Alt+A` | Tasks öffnen/schließen (überall in Firefox) |
| `Enter` | neue Aufgabe darunter (Text rechts vom Cursor wandert mit) |
| `Tab` / `Shift+Tab` | einrücken / ausrücken |
| `Strg+Enter` | abhaken |
| `Backspace` in leerer Zeile | Zeile löschen |
| `↑` / `↓` | Aufgabe darüber/darunter; ohne Auswahl: unterste/oberste |
| `Alt+↑` / `Alt+↓` | Aufgabe verschieben |
| `Strg+Z` / `Strg+Y` | rückgängig / wiederholen |
| `Esc` | Bearbeiten bzw. Popup schließen |

`Strg+Alt+A` lässt sich ändern unter `about:addons` → Zahnrad →
„Erweiterungs-Tastenkombinationen verwalten". Alle Kürzel stehen auch in der
Seitenleiste unter `⋯` → „Tastenkürzel & Markdown".

## Zu Tasks hinzufügen (KI)

Text auf einer Webseite markieren → Rechtsklick → **Zu Tasks hinzufügen**. Die
KI sucht die passende Liste und Elternaufgabe (z. B. „nat Info"), wählt den Titel
im Stil der Geschwister („Blatt 4"), trägt die Abgabefrist mit Uhrzeit ein und
speichert die Seite als **Link** mit kurzem Namen (z. B. „Abgabe Blatt 1"). Gibt es die Aufgabe schon, wird sie ergänzt statt
doppelt angelegt. Gibt es zu einem Thema noch keine Oberkategorie, landet der erste Eintrag oben
in der Liste; beim zweiten Eintrag zum selben Thema legt die KI die
Oberkategorie an (z. B. „DL") und schiebt beide hinein. Einfügen und
Gruppieren sind getrennte Schritte: Das erste Strg+Z nimmt nur die Gruppierung
zurück, das Eingefügte bleibt.

Eingestellt wird das unter `⋯` → **KI einrichten …**:

- **Claude Code (Abo) – Standard.** Läuft über [Claude Code](https://claude.com/claude-code)
  auf diesem Rechner, also über das Claude-Abo – kein API-Schlüssel, keine
  Extrakosten. Claude Code muss installiert und angemeldet sein; dann einmal
  im Projektordner ausführen:

  ```bash
  native/install.sh
  ```

  Das meldet das kleine Hilfsprogramm `native/tasks_claude_host.py` bei Firefox
  an (Datei `~/.mozilla/native-messaging-hosts/tasks_claude.json`, nur für diese
  Erweiterung). Das Hilfsprogramm startet `claude -p` in einem leeren Ordner,
  ohne Werkzeuge, ohne eigene Einstellungen und ohne gespeicherten Verlauf.
  „Verbindung testen" im Popup prüft, ob alles bereit ist. Bisher nur unter
  Linux eingerichtet und getestet.
- **Eigenes Modell per API.** Vorlagen für Anthropic (Claude), OpenAI,
  OpenRouter und lokale Modelle über **Ollama** oder **LM Studio**; „Andere" für
  jeden OpenAI-kompatiblen Server (z. B. llama.cpp, vLLM, Mistral, Groq).
  Adresse, Modell und Schlüssel (bei lokalen Modellen meist leer) sind frei
  eintragbar. Wird auch automatisch benutzt, wenn Claude Code fehlt.
  „Verbindung testen" ruft nur die Modellliste ab und kostet nichts.

  > ⚠️ **Der Weg über ein eigenes Modell ist ungetestet** – ich habe ihn selbst
  > nie ausprobiert (weder Claude-API noch andere Anbieter noch lokale Modelle).
  > Getestet ist nur der Weg über Claude Code.
  >
  > Tipp, falls Ollama die Erweiterung abweist (Fehler 403): Ollama mit
  > `OLLAMA_ORIGINS="moz-extension://*"` starten.
- **Keine KI.** „Zu Tasks hinzufügen" verschwindet aus dem Rechtsklick-Menü.

## Sicherung

Unter `⋯` → **Sicherung exportieren** lädt Tasks eine Datei
`Tasks-Sicherung-JJJJ-MM-TT.json` mit allen Listen und Aufgaben herunter.
**Sicherung importieren …** spielt so eine Datei wieder ein – wahlweise
*zusammenführen* (Bestehendes bleibt) oder *alles ersetzen*; beides lässt sich
mit Strg+Z rückgängig machen. Empfehlung: ab und zu exportieren, vor allem vor
größeren Änderungen.

## Speicher & Grenzen

Firefox Sync erlaubt einer Erweiterung **ca. 100 KB und 512 Einträge**. Jede
Aufgabe und jede Liste ist ein Eintrag – also Platz für grob 500 Aufgaben
(erledigte mitgezählt). Wird es eng, erscheint ein Hinweis; dann erledigte
Aufgaben löschen oder lange Notizen kürzen.

Synchronisiert wird nur, wenn in Firefox unter *Einstellungen → Sync* die Option
**Add-ons** aktiv ist. Ohne Sync funktioniert alles lokal. KI-Einstellungen und
API-Schlüssel werden **nicht** synchronisiert, sie bleiben auf dem jeweiligen
Rechner.

## Installation

1. [Neueste Version](https://github.com/MaxBrandner/tasks-firefox/releases/latest)
   herunterladen und die `.xpi` in Firefox öffnen (oder auf ein Firefox-Fenster
   ziehen), bestätigen.
2. Optional für „Zu Tasks hinzufügen" mit Claude Code: Repo klonen und
   `native/install.sh` ausführen (siehe oben).

Updates installiert Firefox automatisch.

## Berechtigungen & Datenschutz

| Berechtigung | Wofür |
|---|---|
| `storage` | Aufgaben und Einstellungen speichern (Firefox Sync) |
| `contextMenus` | Eintrag „Zu Tasks hinzufügen" |
| `activeTab` | markierten Text nur nach dem Klick auf diesen Eintrag lesen |
| `nativeMessaging` | mit dem Hilfsprogramm für Claude Code sprechen |
| `tabGroups` | „Alle öffnen": Links als benannte Tab-Gruppe |
| optional: Adresse des eigenen Modells | nur wenn ein eigenes Modell gespeichert wird, nur für dessen Adresse |

Die Erweiterung liest keine Webseiten von sich aus. Nur bei „Zu Tasks
hinzufügen" werden der markierte Text, Adresse und Titel der Seite sowie die
Titel deiner Listen und Aufgaben an die gewählte KI geschickt (Claude Code bzw.
das eingetragene Modell).

## Entwicklung

```bash
npm install
npm run dev          # Test-Kopie „Tasks DEV" nach dev/ bauen
npm run testdata     # Testdaten nach testdata/ (Import in Tasks DEV)
npm run lint
```

**Testen ohne Signatur:** `npm run dev`, dann `about:debugging` → „Dieser
Firefox" → „Temporäres Add-on laden" → **`dev/manifest.json`**. Die Test-Kopie
hat eine eigene Kennung (`tasks-dev@brandner.name`) und eigene Daten; sie läuft
neben der installierten Version. Nach Änderungen erneut `npm run dev` und
„Neu laden". Solange sie geladen ist, zeigt die echte Seitenleiste einen
Warnbalken, die Test-Kopie trägt dauerhaft einen „DEV"-Balken, und ihr
Kontextmenü-Eintrag heißt „Zu Tasks DEV hinzufügen".

**Testdaten:** `npm run testdata` schreibt `testdata/tasks-testdata.json`
(Fälligkeiten relativ zu jetzt) – in Tasks DEV über `⋯` → „Sicherung
importieren …" einspielen. Eigene Sicherungen gehören nach `backups/`; beide
Ordner sind per `.gitignore` vom Repo ausgeschlossen.

> ⚠️ **Nie die echte `manifest.json` temporär laden**, wenn Tasks installiert
> ist: Sie ersetzt die installierte Version, und beim Entfernen löscht Firefox
> deren Aufgaben.

Neue Version veröffentlichen: siehe [RELEASING.md](RELEASING.md).
