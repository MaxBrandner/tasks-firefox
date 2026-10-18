// Shared by background.js and the sidebar (loaded before both).
// --- Privacy check before sending -------------------------------------------
// Runs locally, before anything goes to the AI: once sent it is with the
// provider. Finds bank and card numbers (with check digits), API keys and
// passwords written into text. Returns [{ kind, label, sample, start, end }];
// sample is shortened so a question can name the find without repeating it.

const SENSITIVE_PATTERNS = [
  { kind: "key", label: "API-Schlüssel", re: /\b(?:sk-ant-[\w-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{36,}|github_pat_\w{40,}|AKIA[0-9A-Z]{16}|xox[abprs]-[\w-]{10,}|AIza[\w-]{35})/g },
  { kind: "key", label: "privater Schlüssel", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "key", label: "Login-Token", re: /\beyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/g },
  { kind: "password", label: "Passwort", re: /\b(?:passwor[dt]|kennwort|pin|passcode)\s*[:=]\s*\S{3,}/gi },
  { kind: "iban", label: "IBAN", re: /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b/g, valid: ibanValid },
  { kind: "card", label: "Kreditkartennummer", re: /\b\d(?:[ -]?\d){12,18}\b/g, valid: luhnValid },
];

function ibanValid(raw) {
  const s = raw.replace(/ /g, "");
  if (s.length < 15 || s.length > 34) return false;
  const moved = (s.slice(4) + s.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const ch of moved) rest = (rest * 10 + Number(ch)) % 97;
  return rest === 1;
}

function luhnValid(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    sum += d;
  }
  return sum % 10 === 0;
}

function scanSensitive(text) {
  const found = [];
  for (const p of SENSITIVE_PATTERNS) {
    for (const m of String(text || "").matchAll(p.re)) {
      if (p.valid && !p.valid(m[0])) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue; // one find per place
      const v = m[0].replace(/\s+/g, " ");
      found.push({ kind: p.kind, label: p.label, sample: v.length > 8 ? v.slice(0, 4) + " …" + v.slice(-2) : "…", start, end });
    }
  }
  return found.sort((a, b) => a.start - b.start);
}

// "Ohne diese Stellen senden": every find replaced by [entfernt].
function redactSensitive(text, found = scanSensitive(text)) {
  let out = String(text || "");
  for (const f of [...found].sort((a, b) => b.start - a.start)) out = out.slice(0, f.start) + "[entfernt]" + out.slice(f.end);
  return out;
}
