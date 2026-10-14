// Konfiguration für das web-ext-Werkzeug (Bauen/Signieren).
module.exports = {
  // Diese Dateien gehören NICHT ins Erweiterungs-Paket.
  ignoreFiles: [
    "node_modules",
    "package.json",
    "package-lock.json",
    "README.md",
    "RELEASING.md",
    "web-ext-config.cjs",
    "web-ext-artifacts",
    "updates.json",
    "scripts",
    // Secrets/Config gehören niemals ins Paket (Dotfiles werden von web-ext
    // ohnehin ignoriert, hier zur Sicherheit explizit).
    ".env",
    ".env.example",
    ".gitignore",
  ],
  sign: {
    // Selbstverteilung: signiert, aber nicht öffentlich im AMO-Katalog gelistet.
    channel: "unlisted",
  },
};
