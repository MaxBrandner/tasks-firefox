// Run: npm test (all) or npm test <name>
// Local privacy check (shared/privacy.js: scanSensitive / redactSensitive).
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ROOT = path.resolve(__dirname, "..");
let fails = 0;
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fails++; };
const stub = new Proxy(function () {}, { get: (t, k) => (k === "then" ? undefined : stub), apply: () => stub });
const ctx = vm.createContext({ browser: stub, console, URL, setTimeout, clearTimeout, crypto: globalThis.crypto });
vm.runInContext(fs.readFileSync(path.join(ROOT, "shared", "privacy.js"), "utf8"), ctx);
const scan = (t) => ctx.scanSensitive(t).map((f) => f.kind);

// finds (test numbers with valid check digits; key-like samples are put
// together at runtime so no complete key literal sits in the repo)
ok(scan("Bitte überweise an DE89 3704 0044 0532 0130 00 bis Freitag").join() === "iban", "IBAN (mit Leerzeichen) erkannt");
ok(scan("IBAN: DE89370400440532013000").join() === "iban", "IBAN (am Stück) erkannt");
ok(scan("Karte 4111 1111 1111 1111, gültig bis 12/28").join() === "card", "Kreditkartennummer (Luhn gültig) erkannt");
ok(scan("ANTHROPIC_API_KEY=" + "sk-" + "ant-api03-" + "abcdefghijklmnopqrstuvwxyz0123").join() === "key", "Anthropic-Schlüssel erkannt");
ok(scan("token " + "ghp" + "_abcdefghijklmnopqrstuvwxyz0123456789AB").join() === "key", "GitHub-Token erkannt");
ok(scan("aws " + "AKIA" + "IOSFODNN7EXAMPLE").join() === "key", "AWS-Schlüssel erkannt");
ok(scan("-----BEGIN OPENSSH PRIVATE KEY-----\nb3Blbn...").join() === "key", "privater Schlüssel erkannt");
ok(scan("WLAN Passwort: Sonnenblume42").join() === "password" && scan("PIN = 1234").join() === "password", "Passwort / PIN im Text erkannt");

// must NOT fire
const quiet = [
  "Abgabe am 26.10.2026 um 08:30, Raum 25.12.02.31",
  "Ruf an: +49 211 81 12345 oder 0211 8112345",
  "Matrikelnummer 2876543, Übungsgruppe 4",
  "Bestellnummer 1234567890123456 (keine Kreditkarte, Luhn falsch)",
  "DE12 3456 7890 1234 5678 90 (IBAN mit falscher Prüfziffer)",
  "Der Schlüssel liegt unter der Matte; sk-ant ist ein Präfix",
  "0000 0000 0000 0000",
];
for (const t of quiet) ok(!scan(t).length, "kein Fund: " + t.slice(0, 48));

// sample and redaction
const t = "Konto DE89 3704 0044 0532 0130 00 und Karte 4111111111111111.";
const f = ctx.scanSensitive(t);
ok(f.length === 2 && f[0].label === "IBAN" && f[0].sample === "DE89 …00" && !f[0].sample.includes("0532"), "Fund mit gekürzter Probe (zeigt die Nummer nicht ganz): " + f.map((x) => x.sample).join(" | "));
ok(ctx.redactSensitive(t) === "Konto [entfernt] und Karte [entfernt].", "„ohne diese Stellen senden“ ersetzt jeden Fund");

console.log(fails ? `\n${fails} FEHLER` : "\nAlle Prüfungen bestanden");
process.exit(fails ? 1 : 0);
