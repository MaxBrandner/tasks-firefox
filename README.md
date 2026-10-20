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
  Abgehakte Unteraufgaben verschwinden, sobald man den Block mit der Maus
  verlässt; die Oberaufgabe zeigt stattdessen den Fortschritt „2/5“. Ein Klick
  darauf zeigt die erledigten kurz wieder (z. B. um eine wieder zu öffnen).
  ⋯ → „Erledigte Unteraufgaben: anzeigen“ lässt sie wie früher an ihrem Platz.
- **Fälligkeit** – Schnellknöpfe Heute / Morgen / +1 Woche oder Datum (tippen
  wie „20.10.“ oder „2010“, oder im Kalender wählen, Woche ab Montag), dazu
  optional eine **Uhrzeit** (tippen wie „14:30“, „1430“ oder „2pm“). Anzeige
  „Heute", „Morgen", Wochentag; unter 48 h ein **Countdown** („noch 1 T 18 Std"),
  danach „überfällig" in Rot.
- **↻ Wöchentlich** – zum Fälligkeitstermin entsteht die nächste, eine Woche
  später (Zahl am Titelende zählt mit: „Blatt 3" → „Blatt 4"). Früh abgehakt
  ist man bis dahin für die Woche fertig. Die Vorwoche bleibt als eigene
  Aufgabe stehen und wird nicht überschrieben.
  Eine Flamme mit Zahl zeigt, wie viele Wochen in Folge erledigt wurden
  (nachgeholte zählen mit). Im Fortschritt der Oberaufgabe zählt die Serie nur einmal.
- **Links** – eigenes Feld je Aufgabe, beliebig viele (im Bearbeitungsmodus
  „+ Link einfügen"). Eingeklappt zeigt 🔗 die Anzahl – inklusive der Links aller
  Unteraufgaben; ein Klick öffnet einen Link direkt bzw. mehrere zusammen als
  **Firefox-Tab-Gruppe** mit dem Namen der Aufgabe (z. B. alles zu „DL").
  Auch andere Links gehen, z. B. `obsidian://…` oder Dateien (`file:///…` oder
  einfach den Pfad `/home/…` einfügen). Die öffnet Tasks über das Hilfsprogramm
  aus `native/` mit dem passenden Programm – Firefox selbst lässt Erweiterungen
  keine Dateien öffnen. Ausführbare Dateien werden nie gestartet.
- **Markdown** in Titel und Notiz: `**fett**`, `*kursiv*`, `~~durch~~`,
  `` `code` ``, `[Text](https://…)`; Links werden automatisch erkannt. In
  Notizen zusätzlich `- Liste`, `1. Liste`, `# Überschrift`, `> Zitat`.
- **Auswählen** – wie im Explorer: Klick wählt aus, nochmal auf den Titel
  (oder Doppelklick, Enter) bearbeitet. Mehrere mit Shift/Strg; dann wirken
  Verschieben, Einrücken, Abhaken und Löschen auf alle (Tasten siehe unten).
- **Sortieren** – am Griff `⋮⋮` ziehen (weiter rechts loslassen = Unteraufgabe,
  unter allem = ganz unten, kurz über einem eingeklappten Block warten = aufklappen)
  oder im Titel **Alt+↑ / Alt+↓**.
- **Einklappen** – wie in Jupyter: Leiste links an einem Block mit
  Unteraufgaben anklicken (oder **Strg+↑ / Strg+↓** im Titel); eingeklappt zeigt
  den Fortschritt („2/5“, wie ausgeklappt). ⋯ → „Alle einklappen“ / „Alle ausklappen“.
  Gilt pro Gerät.
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
- **Zu Tasks hinzufügen (KI)** – per Rechtsklick auf markierten Text, einen Link,
  ein Bild oder irgendwo auf der Seite als Aufgabe einsortieren lassen, siehe unten.
- **Design** – System / Hell / Dunkel (Knopf oben rechts). Einstellungen und
  Hilfe öffnen sich als Popup.
- **Uhrzeit-Format** – 24 Std. (Standard) oder 12 Std. mit AM/PM, umstellbar
  unter ⋯ → „Uhrzeit: …“ (pro Gerät).

### Tastatur

| Taste | Wirkung |
|---|---|
| `Strg+Alt+A` | Tasks öffnen/schließen (überall in Firefox) |
| `/` | in den KI-Chat schreiben (schmal: Schnell-Chat über den Aufgaben) |
| `Enter` / `Shift+Enter` im Chat | senden / neue Zeile |

**Ausgewählte Aufgaben** – ein Klick wählt eine Aufgabe aus (wie im Explorer);
nochmal auf den Titel, Doppelklick oder `Enter` bearbeitet sie.

| Taste | Wirkung |
|---|---|
| `Shift`/`Strg`+Klick, `Shift+↑`/`↓` | Bereich / einzelne dazu |
| `↑` / `↓` | Auswahl wandern; ohne Auswahl: unterste/oberste |
| `←` / `→` | einklappen / aufklappen; sonst zur Überkategorie / ersten Unteraufgabe |
| `Alt+↑` / `Alt+↓` | verschieben (alle ausgewählten zusammen) |
| `Tab` / `Shift+Tab` | einrücken / ausrücken |
| `Leertaste` / `Strg+Enter` | abhaken |
| `Entf` | löschen (`Strg+Z` holt zurück) |
| Buchstabe | losschreiben: bearbeitet den Titel, Text ans Ende |
| `Esc` | Auswahl aufheben |

**Beim Bearbeiten** (Cursor im Titel):

| Taste | Wirkung |
|---|---|
| `Enter` | neue Aufgabe darunter (Text rechts vom Cursor wandert mit; bei eingeklapptem Block unter den Block) |
| `Tab` / `Shift+Tab` | einrücken / ausrücken |
| `Strg+Enter` | abhaken |
| `Backspace` | am Zeilenanfang ausrücken, in leerer Zeile löschen |
| `↑` / `↓` | zum Titel darüber/darunter |
| `Alt+↑` / `Alt+↓` | Aufgabe verschieben |
| `Strg+↑` / `Strg+↓` | Unteraufgaben einklappen / aufklappen |
| `Strg+Z` / `Strg+Y` | rückgängig / wiederholen |
| `Esc` | zurück zur Auswahl; im Chat-Feld: Markierungen auf der Webseite weg, sonst eine Stufe zurück |

Mit der Maus: am Griff `⋮⋮` ziehen (weiter rechts loslassen = Unteraufgabe,
unter allem = ganz unten; kurz über einem eingeklappten Block warten klappt ihn
auf – legt man woanders ab, geht er wieder zu). Die Leiste links an einem Block
klappt ihn ein und aus. Die Tasten beim Auswählen auf der Webseite stehen unten
bei „+ im Chat“.

`Strg+Alt+A` lässt sich ändern unter `about:addons` → Zahnrad →
„Erweiterungs-Tastenkombinationen verwalten". Alle Kürzel stehen auch in der
Seitenleiste unter `⋯` → „Tastenkürzel & Markdown": oben ein Suchfeld (z. B.
„strg z“ oder „verschieben“) und Knöpfe, die zu den Abschnitten springen. Findet
die Suche nichts Passendes, fragt `Enter` die KI („wie schiebe ich eine Aufgabe
nach oben?“) – sie bekommt nur die Zeilen dieses Fensters, keine Aufgaben.

## Zu Tasks hinzufügen (KI)

Rechtsklick → **Zu Tasks hinzufügen** – auf markierten Text, einen Link, ein
Bild oder einfach irgendwo auf der Seite. Die Stelle landet im Chat in der Liste
**„Bezug“** über dem Eingabefeld – mit ihrem Text, bei Bildern mit Vorschau – und
bleibt auf der Seite markiert (mit derselben Nummer), bis du sie entfernst oder
sendest. Gleich danach ist die Auswahl an (siehe „+“), um weitere Stellen
dazuzunehmen. Ein Klick auf einen Eintrag holt den Tab nach vorn, scrollt hin
und lässt die Markierung kurz heller aufleuchten; mit × fliegt ein einzelner Eintrag raus.
Mehrere Rechtsklicks sammeln sich; erst wenn du sendest, arbeitet die KI – mit
einer Anweisung („unter DS 2“, „nur den ersten Termin“) oder einfach mit Enter
im leeren Feld („Zu Tasks hinzufügen“).

Mit dabei: die Markierung samt den Link-Zielen darin, der angeklickte Link, die
angeklickte Stelle und der Abschnitt drumherum, bei Bildern ein Ausschnitt des
Bildes selbst; nie der ganze Seitentext (dafür „+ → Ganze Seite schicken“).
Steht darin etwas wie eine IBAN, eine Kreditkartennummer, ein Schlüssel oder
ein Passwort, fragt Tasks vorher nach („Ohne diese Stellen senden“ /
„Trotzdem senden“ / „Abbrechen“) – geprüft wird auf deinem Rechner, bevor
etwas verschickt wird.

Die KI sucht die passende Liste und Elternaufgabe (z. B. „LinA“), wählt den
Titel im Stil der Geschwister („Blatt 4“), trägt die Abgabefrist mit Uhrzeit ein
und speichert den passendsten **Link** (die Seite, den angeklickten Link oder
einen Link aus der Markierung). Gibt es die Aufgabe schon, wird sie ergänzt
statt doppelt angelegt. Kommt zu einem Thema ein zweiter Eintrag, legt sie die
Oberkategorie an (z. B. „DL“) und schiebt beide hinein. Alles, was eine Antwort
ändert, nimmt ihr „Rückgängig“ (bzw. Strg+Z) in einem Schritt zurück.

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

## KI-Chat

Der Chat mit der KI ist immer da – über dieselbe Verbindung wie „Zu Tasks hinzufügen" (Standard:
Claude Code über das Abo). Beispiele: „Was ist diese Woche fällig?", „Lege
unter DS 2 „Klausur anmelden" an, fällig nächsten Freitag", „Sortiere Uni nach
Fälligkeit", „Öffne alle Links zu DL".

- **Platz:** Ist die Seitenleiste breit (ab 690 px), stehen Liste und Chat
  nebeneinander; `/` springt ins Eingabefeld. Schmal wechselt man über die
  Reiter „Aufgaben | Chat"; am
  Reiter „Aufgaben" steht, wie viel die KI markiert hat. `/` öffnet schmal
  stattdessen eine **Schnell-Karte** über den Aufgaben (Eingabe + letzte
  Antwort) – praktisch für kurze Befehle; „Ganzer Chat" wechselt in den Reiter.
  **Esc** geht eine Stufe zurück: Karte bzw. Reiter „Chat" → Aufgaben (die
  Markierungen bleiben) → Markierungen weg.
- **Markierungen:** Nach einer Antwort sind die besprochenen (Bernstein) und
  geänderten (grün) Aufgaben eine Minute lang markiert – auch wenn der Chat
  nicht zu sehen ist –, dann verblassen sie. Eine Aufgabe, die du anfasst
  (anklicken, bearbeiten, abhaken, verschieben), verliert ihre Markierung
  sofort. Eine neue Antwort ersetzt alle Markierungen; „Markierungen zeigen"
  unter einer früheren Antwort holt deren Markierungen zurück. Der Text der
  Antworten lässt sich normal markieren und kopieren.
- **Kopieren und Antworten:** Unter jeder Antwort steht „Kopieren“ (Verweise
  werden zu Namen). Markierst du Text im Chat, erscheint „↩ Antworten“: Der Text
  kommt als Zitat in den „Bezug“ über dem Eingabefeld (als kleiner Chat mit
  Absender und Uhrzeit) und geht mit deiner nächsten Nachricht mit – die KI
  erfährt, worauf du antwortest. Weitere Zitate werden angehängt, jedes lässt
  sich mit × einzeln entfernen. Ein Klick auf ein Zitat springt zur Stelle.
- **„+“ im Chat:** Element auf der Seite auswählen – wie im Datei-Explorer: alle
  Blöcke sind gestrichelt umrandet, Klick wählt einen an oder ab,
  Umschalt+Klick alles dazwischen, Ziehen spannt einen Rahmen auf (jeder
  berührte Block zählt, mit Strg wird umgeschaltet), Strg+A nimmt alle
  sichtbaren, Alt+Ziehen markiert Text (ein Klick auf markierten Text nimmt
  ihn wieder raus). Jedes Stück wird ein eigener nummerierter Eintrag im
  „Bezug“ (Text kursiv; die KI bekommt den Absatz drum herum mit). Strg+Z /
  Strg+Y auf der Seite machen Auswahl-Schritte rückgängig bzw. wieder. Enter
  oder Esc beendet das Auswählen; danach geht, was du auf der Seite tippst,
  direkt ins Chat-Feld (Firefox lässt Add-ons den Fokus nicht in die
  Seitenleiste legen) – ein Klick auf die Seite beendet das. Esc im Chat-Feld
  nimmt alle Markierungen raus, Strg+Z holt sie zurück. Zeigst du auf der
  Seite auf eine Markierung, leuchtet ihr Eintrag im Bezug auf. Nach einem
  Neuladen erscheinen die Markierungen wieder; baut eine Seite ihren Inhalt
  um, finden sie ihren Block über den Text wieder. Die Tasten erklärt der
  Bezug beim ersten Mal; danach weiß der Chat sie. Außerdem: Datei hinzufügen (PDF, Bild, Text – auch per Drag & Drop
  irgendwohin auf Tasks oder per Strg+V, der Chat geht dann auf) oder die ganze aktuelle Seite
  schicken (Firefox fragt einmal nach der Erlaubnis). Firefox-eigene Seiten und
  lokale Dateien (file://) sperrt Firefox für Add-ons – eine lokale Datei
  ziehst du einfach in Tasks. Dateien und ganze Seiten erscheinen als Karten über dem
  Eingabefeld und gehen mit
  der nächsten Nachricht an die KI, die daraus Aufgaben zieht.
- **Einstellungen per Chat:** „Stell auf dunkel“, „klapp Erledigt zu“ oder
  „schalte die KI aus“ (fragt vorher nach) gehen auch im Chat. API-Schlüssel,
  Modelle und Adressen nie – die gehören nicht in den Chat (⋯ → „KI einrichten …“).
- **Fragen zu Tasks selbst** beantwortet der Chat auch – z. B. was bei
  „Zu Tasks hinzufügen" bei der KI ankommt (siehe oben).

- **Wie sie arbeitet:** Die KI antwortet mit Text und mit **Aktionen aus einem
  festen Katalog** (Aufgabe anlegen/ändern/abhaken/verschieben/löschen, Links
  hinzufügen/entfernen/öffnen, Liste anlegen/umbenennen). Die Erweiterung
  prüft und führt sie aus; was nicht geht, wird unter der Antwort genannt.
- **Kommunikation:** Aufgaben und Listen in der Antwort sind **anklickbare
  Chips** (Klick springt hin). Worüber sie spricht, wird in der Liste
  **markiert** (bernstein), was sie geändert hat, bekommt einen grünen Rand –
  nötigenfalls wechselt die Seitenleiste dafür zur passenden Liste.
- **Kontrolle:** Jede Antwort mit Änderungen ist **ein Schritt im Verlauf**
  („KI-Chat: …") und lässt sich mit „Rückgängig" unter der Antwort einzeln
  zurücknehmen. **Löschen** passiert erst nach „Ausführen".
- **Was sie sieht:** Datum, alle Listen und Aufgaben (Struktur, Fälligkeit,
  Notiz-Anfang, Links), geöffnete Liste, aufgeklappte Aufgabe („das hier") und
  die letzten Nachrichten. Kein Internet, keine Webseiten.
- **Grenzen:** Sie kann nur, was im Katalog steht – es gibt z. B. **keine
  echten Tags**, Prioritäten, Erinnerungen oder Suche. Fragt man danach, sagt
  sie das und bietet Bordmittel an (z. B. „#mathe" im Titel, danach „markiere
  alles mit #mathe"). Listen löschen und KI-Einstellungen ändern kann sie nicht;
  sie kann sich irren (dafür: Rückgängig). Jede Nachricht ist eine Anfrage
  (über das Abo, einige Sekunden). Der Chat bleibt pro Rechner gespeichert,
  „Neuer Chat" leert ihn.

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

Entfernst du die Erweiterung auf einem Rechner, löscht Firefox ihre Sync-Daten –
ohne Schutz wären die Listen dann überall weg. Deshalb hält jeder Rechner eine
eigene, nicht synchronisierte Kopie und schreibt die Listen sofort zurück; unten
erscheint ein kurzer Hinweis. Werden auf einem anderen Gerät viele Aufgaben auf
einmal gelöscht (ab 5), bietet die Meldung unten **Rückgängig** an; jede
Änderung von außen steht außerdem als eigener Schritt unter ⋯ → Verlauf.

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
npm run dev          # Test-Kopie „Tasks DEV" nach dev/ bauen (bringt Testdaten mit)
npm run dev -- --fresh  # dasselbe, Testdaten mit frischen Fälligkeiten ersetzen
npm run testdata     # nur die Testdaten nach testdata/
npm test             # alle automatischen Tests (tests/*.test.cjs)
npm test chat        # nur Tests, deren Name „chat" enthält
npm run lint
```

**Testen ohne Signatur:** `npm run dev`, dann `about:debugging` → „Dieser
Firefox" → „Temporäres Add-on laden" → **`dev/manifest.json`**. Die Test-Kopie
hat eine eigene Kennung (`tasks-dev@brandner.name`) und eigene Daten; sie läuft
neben der installierten Version. Nach Änderungen erneut `npm run dev` und
„Neu laden". Solange sie geladen ist, zeigt die echte Seitenleiste einen
Warnbalken, die Test-Kopie trägt dauerhaft einen „DEV"-Balken, und ihr
Kontextmenü-Eintrag heißt „Zu Tasks DEV hinzufügen".

**Echte KI-Durchläufe** (kosten etwas Abo-Kontingent, laufen nie automatisch):
`npm run test:e2e -- backups/<sicherung>.json` („Zu Tasks hinzufügen" zweimal,
inkl. automatischer Gruppe) und `npm run test:e2e:chat -- backups/<sicherung>.json`.

**Testdaten:** `npm run dev` erzeugt sie mit (Fälligkeiten relativ zu jetzt)
und legt sie der Test-Kopie bei – die neuesten Funktionen direkt in „Meine
Aufgaben“, dazu die Listen „Test: Uni“ und „Test: Privat“. Tasks DEV spielt
beim Öffnen von selbst ein, was es noch nicht hatte (z. B. nach einem
Firefox-Neustart, der das temporäre Add-on samt Daten entfernt); Vorhandenes
wird nie überschrieben, Gelöschtes kommt nicht wieder.
`npm run dev -- --fresh` ersetzt alles mit frischen Fälligkeiten. Von Hand: `npm run testdata` schreibt
`testdata/tasks-testdata.json`, einspielen über `⋯` → „Sicherung
importieren …". Eigene Sicherungen gehören nach `backups/`; beide
Ordner sind per `.gitignore` vom Repo ausgeschlossen.

> ⚠️ **Nie die echte `manifest.json` temporär laden**, wenn Tasks installiert
> ist: Sie ersetzt die installierte Version, und beim Entfernen löscht Firefox
> deren Aufgaben.

**Mitgelieferte Bibliothek:** Der Kalender am Datumsfeld ist
[Air Datepicker](https://air-datepicker.com) (MIT), unverändert kopiert nach
`sidebar/vendor/air-datepicker/` (mit `LICENSE`). Aktualisieren: Version in
`package.json` anheben, `npm install`, die Dateien `air-datepicker.js` und
`air-datepicker.css` aus `node_modules/air-datepicker/` erneut dorthin kopieren.

Neue Version veröffentlichen: siehe [RELEASING.md](RELEASING.md).
