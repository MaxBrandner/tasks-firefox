// Configuration for the web-ext tool (build/sign).
module.exports = {
  // These files do NOT belong in the extension package.
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
    // The Claude Code helper runs outside Firefox.
    "native",
    // Test copy (npm run dev).
    "dev",
    "**/*.bak",
    "**/*.bak2",
    // Secrets/config never go into the package (web-ext ignores dotfiles
    // anyway; listed explicitly to be safe).
    ".env",
    ".env.example",
    ".gitignore",
  ],
  sign: {
    // Self-distribution: signed, but not publicly listed on AMO.
    channel: "unlisted",
  },
};
