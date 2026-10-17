#!/usr/bin/env bash
# Registers the helper with Firefox (native messaging) so the Tasks extension
# can use Claude Code through your Claude subscription.
# Run once; run again after moving the project folder.
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
  "allowed_extensions": ["tasks@brandner.name", "tasks-dev@brandner.name"]
}
EOF
echo "Eingerichtet: $DIR/tasks_claude.json → $HOST"

if ! command -v claude >/dev/null && [ ! -x "$HOME/.local/bin/claude" ]; then
  echo "Hinweis: claude nicht gefunden – Claude Code installieren und einmal anmelden."
fi
