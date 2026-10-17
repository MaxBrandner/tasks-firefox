# Tasks – Firefox-Erweiterung

Aufgabenlisten (ähnlich Google Tasks) in der Firefox-Seitenleiste.
Gespeichert wird über **Firefox Sync** – auf allen Rechnern, auf denen du mit
deinem Firefox-Konto angemeldet bist, sind dieselben Aufgaben da. Kein Google,
kein Server, keine Berechtigungen auf Webseiten.

## Funktionen

- **Mehrere Listen** – oben auswählen; über `⋯` anlegen, umbenennen, löschen.
- **Aufgaben** – oben eintippen, Enter. Neue Aufgaben landen oben.
  Titel direkt anklicken zum Bearbeiten.
- **Details** (Pfeil `▾` rechts): Notiz, Fälligkeitsdatum, Unteraufgaben, Löschen.
- **Unteraufgaben** – eine Ebene. Hauptaufgabe erledigt → Unteraufgaben auch.
- **Fälligkeit** – „Heute" / „Morgen" / Wochentag; überfällig in Rot.
- **Sortieren** – am Griff `⋮⋮` ziehen, oder im Titel **Alt+↑ / Alt+↓**.
  Unteraufgaben lassen sich innerhalb ihrer Hauptaufgabe sortieren.
- **Erledigt** – einklappbarer Bereich unten, „Erledigte löschen".
- **Rückgängig / Wiederholen** – **Strg+Z** / **Strg+Y** (oder Strg+Shift+Z) für
  alle Änderungen; beim Tippen wirkt Strg+Z zuerst auf den Text im Feld.
  Nach jedem Löschen zusätzlich ca. 7 s lang ein „Rückgängig"-Knopf.
- **Abgehakte Unteraufgaben** bleiben an ihrem Platz; Enter darauf legt
  darunter eine neue an.
- **↑ / ↓ ohne Auswahl** – springt in die unterste bzw. oberste Aufgabe.
- **Uhrzeit & Countdown** – Fälligkeit mit Uhrzeit; unter 48 h zeigt der Chip
  „noch 1 T 18 Std", danach „überfällig".
- **↻ Wöchentlich** – ist eine Abgabe fällig oder abgehakt, entsteht die nächste
  eine Woche später (Zahl am Titelende zählt mit: „Blatt 3" → „Blatt 4"). Die
  Vorwoche bleibt als eigene Aufgabe stehen und wird nicht überschrieben.
- **Design** – System / Hell / Dunkel (Knopf oben rechts).

Toolbar-Symbol oder **Strg+Alt+A**: blendet die Seitenleiste ein und aus.
Die Tastenkombination lässt sich ändern unter `about:addons` → Zahnrad →
„Erweiterungs-Tastenkombinationen verwalten".

## Speicher & Grenzen

Firefox Sync erlaubt einer Erweiterung **ca. 100 KB und 512 Einträge**.
Jede Aufgabe und jede Liste ist ein Eintrag – also Platz für grob 500 Aufgaben
(erledigte mitgezählt). Wird es eng, erscheint ein Hinweis; dann erledigte
Aufgaben löschen oder lange Notizen kürzen.

Synchronisiert wird nur, wenn in Firefox unter *Einstellungen → Sync* die
Option **Add-ons** aktiv ist. Ohne Sync funktioniert alles lokal.

## Installation

Die signierte Datei `web-ext-artifacts/tasks-X.Y.Z.xpi` in Firefox öffnen
(oder per Drag & Drop auf ein Firefox-Fenster ziehen) und bestätigen.

## Entwicklung

```bash
npm install
npx web-ext run      # Firefox mit der Erweiterung starten (temporär)
npm run lint
```

Neue Version veröffentlichen: siehe [RELEASING.md](RELEASING.md).
