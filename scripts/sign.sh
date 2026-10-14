#!/usr/bin/env bash
# Signiert die Erweiterung bei Mozilla. Liest die API-Keys aus der lokalen
# .env (git-ignoriert) und ruft `web-ext sign` auf. Keine Secrets in der
# Kommandozeile oder im Repo.
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
