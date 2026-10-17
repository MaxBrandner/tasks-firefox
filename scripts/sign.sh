#!/usr/bin/env bash
# Signs the extension with Mozilla. Reads the API keys from the local .env
# (gitignored) and runs `web-ext sign`. No secrets on the command line or in
# the repo.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "FEHLER: .env fehlt. Kopiere .env.example zu .env und trage die AMO-Keys ein." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ -z "${WEB_EXT_API_KEY:-}" || -z "${WEB_EXT_API_SECRET:-}" ]]; then
  echo "FEHLER: WEB_EXT_API_KEY / WEB_EXT_API_SECRET nicht in .env gesetzt." >&2
  exit 1
fi

exec npx web-ext sign "$@"
