#!/usr/bin/env python3
"""Tasks – Hilfsprogramm für Firefox (Native Messaging).

Nimmt von der Tasks-Erweiterung eine Anfrage entgegen und lässt sie von
Claude Code (`claude -p`) beantworten. Claude Code nutzt seine eigene
Anmeldung, also das Claude-Abo – kein API-Schlüssel, keine Extrakosten.

Protokoll (Firefox Native Messaging): 4 Byte Länge (little endian) + JSON.
  Anfrage:  {"ping": true}
            {"system": str, "prompt": str, "schema": {...}}
  Antwort:  {"ok": true, "version": str}  /  {"ok": true, "data": {...}}
            {"ok": false, "error": str}

Eingerichtet wird es mit install.sh im selben Ordner.
"""
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile

TIMEOUT = 180  # Sekunden


def read_message():
    raw = sys.stdin.buffer.read(4)
    if len(raw) < 4:
        sys.exit(0)
    (length,) = struct.unpack("<I", raw)
    return json.loads(sys.stdin.buffer.read(length).decode("utf-8"))


def send(obj):
    data = json.dumps(obj).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("<I", len(data)))
    sys.stdout.buffer.write(data)
    sys.stdout.buffer.flush()


def find_claude():
    # Firefox startet das Skript mit knappem PATH – übliche Orte ergänzen.
    home = os.path.expanduser("~")
    extra = [os.path.join(home, ".local", "bin"), os.path.join(home, ".claude", "local"),
             "/usr/local/bin", "/usr/bin"]
    return shutil.which("claude", path=os.pathsep.join([os.environ.get("PATH", "")] + extra))


def clean_env():
    env = dict(os.environ)
    # Kein API-Schlüssel: Claude Code soll die Abo-Anmeldung benutzen.
    for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
        env.pop(key, None)
    return env


def ask(claude, req):
    cmd = [
        claude, "-p",
        "--output-format", "json",
        "--json-schema", json.dumps(req["schema"]),
        "--system-prompt", req["system"],
        "--tools", "",               # nur antworten, keine Werkzeuge
        "--setting-sources", "",     # keine eigenen Einstellungen/Hooks/CLAUDE.md
        "--strict-mcp-config",       # keine MCP-Server
        "--no-session-persistence",  # kein gespeicherter Verlauf
        "--effort", "low",
    ]
    # Leerer Arbeitsordner: keine Projekt-CLAUDE.md aus dem aktuellen Ordner.
    with tempfile.TemporaryDirectory(prefix="tasks-claude-") as cwd:
        proc = subprocess.run(cmd, input=req["prompt"], capture_output=True, text=True,
                              timeout=TIMEOUT, cwd=cwd, env=clean_env())
    try:
        out = json.loads(proc.stdout)
    except ValueError:
        lines = (proc.stderr or proc.stdout).strip().splitlines()
        raise RuntimeError(lines[-1] if lines else f"claude beendet mit Code {proc.returncode}")
    if out.get("is_error"):
        raise RuntimeError(out.get("result") or out.get("subtype") or "Fehler in Claude Code")
    data = out.get("structured_output")
    if data is None:
        data = json.loads(out.get("result") or "null")
    return data


def main():
    req = read_message()
    claude = find_claude()
    if not claude:
        send({"ok": False, "error": "Claude Code (claude) nicht gefunden – installieren und anmelden."})
        return
    try:
        if req.get("ping"):
            proc = subprocess.run([claude, "--version"], capture_output=True, text=True,
                                  timeout=30, env=clean_env())
            send({"ok": True, "version": proc.stdout.strip()})
        else:
            send({"ok": True, "data": ask(claude, req)})
    except subprocess.TimeoutExpired:
        send({"ok": False, "error": "Claude Code hat nicht rechtzeitig geantwortet."})
    except Exception as err:  # noqa: BLE001 – jede Ursache an die Erweiterung melden
        send({"ok": False, "error": str(err)})


if __name__ == "__main__":
    main()
