#!/usr/bin/env bash
# Meldet das Hilfsprogramm bei Firefox an (Native Messaging), damit die
# Tasks-Erweiterung Claude Code über dein Claude-Abo nutzen kann.
# Einmal ausführen; nach dem Verschieben des Projektordners erneut.
set -euo pipefail
cd "$(dirname "$0")"
HOST="$PWD/tasks_claude_host.py"
DIR="$HOME/.mozilla/native-messaging-hosts"

chmod +x "$HOST"
mkdir -p "$DIR"
cat > "$DIR/tasks_claude.json" <<EOF
{
  "name": "tasks_claude",
  "description": "Tasks: Claude Code für „Zu Tasks hinzufügen“",
  "path": "$HOST",
  "type": "stdio",
  "allowed_extensions": ["tasks@brandner.name"]
}
EOF
echo "Eingerichtet: $DIR/tasks_claude.json → $HOST"

if ! command -v claude >/dev/null && [ ! -x "$HOME/.local/bin/claude" ]; then
  echo "Hinweis: claude nicht gefunden – Claude Code installieren und einmal anmelden."
fi
