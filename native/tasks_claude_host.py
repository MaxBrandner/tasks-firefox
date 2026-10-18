#!/usr/bin/env python3
"""Tasks – native messaging helper for Firefox.

Receives a request from the Tasks extension and has Claude Code (`claude -p`)
answer it. Claude Code uses its own login, i.e. the Claude subscription – no
API key, no extra cost. Also opens links Firefox won't open for an extension
(file:, obsidian: …) with the system's default program.

Protocol (Firefox native messaging): 4-byte length (little endian) + JSON.
  Request:  {"ping": true}
            {"system": str, "prompt": str, "schema": {...}, "effort": "low"|"medium"|"high",
             "attachments": [{"media_type": str, "data": base64, "name": str}, ...]}  (optional)
            {"open": url}
  Reply:    {"ok": true, "version": str}  /  {"ok": true, "data": {...}}  /  {"ok": true}
            {"ok": false, "error": str}

Registered with install.sh in the same folder.
"""
import base64
import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
import urllib.parse

TIMEOUT = 180  # seconds


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
    # Firefox starts the script with a minimal PATH – add the usual locations.
    home = os.path.expanduser("~")
    extra = [os.path.join(home, ".local", "bin"), os.path.join(home, ".claude", "local"),
             "/usr/local/bin", "/usr/bin"]
    return shutil.which("claude", path=os.pathsep.join([os.environ.get("PATH", "")] + extra))


def clean_env():
    env = dict(os.environ)
    # No API key: Claude Code must use the subscription login.
    for key in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"):
        env.pop(key, None)
    return env


# Attachments go to Claude Code as Messages-API content blocks (stream-json).
IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
MAX_ATTACHMENTS = 10


def content_blocks(req):
    """Attachments (images, PDFs, text files) plus the prompt as content blocks."""
    blocks = []
    for a in (req.get("attachments") or [])[:MAX_ATTACHMENTS]:
        media_type, data = a.get("media_type", ""), a.get("data", "")
        if media_type in IMAGE_TYPES:
            blocks.append({"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}})
        elif media_type == "application/pdf":
            blocks.append({"type": "document", "source": {"type": "base64", "media_type": media_type, "data": data}})
        elif media_type.startswith("text/"):
            text = base64.b64decode(data).decode("utf-8", "replace")
            blocks.append({"type": "text", "text": f"Datei „{a.get('name', '')}“:\n<<<\n{text}\n>>>"})
        else:
            raise ValueError("Dateityp wird nicht unterstützt: " + (media_type or "unbekannt"))
    blocks.append({"type": "text", "text": req["prompt"]})
    return blocks


def ask(claude, req):
    # With attachments the request goes in as stream-json (content blocks);
    # otherwise plain text as before.
    stream = bool(req.get("attachments"))
    io_format = (["--input-format", "stream-json", "--output-format", "stream-json", "--verbose"] if stream
                 else ["--output-format", "json"])
    stdin = (json.dumps({"type": "user", "message": {"role": "user", "content": content_blocks(req)}}) + "\n"
             if stream else req["prompt"])
    cmd = [
        claude, "-p",
        *io_format,
        "--json-schema", json.dumps(req["schema"]),
        "--system-prompt", req["system"],
        "--tools", "",               # answer only, no tools
        "--setting-sources", "",     # no user settings/hooks/CLAUDE.md
        "--strict-mcp-config",       # no MCP servers
        "--no-session-persistence",  # no saved session
        "--effort", req.get("effort") if req.get("effort") in ("low", "medium", "high") else "low",
    ]
    # Empty working dir: no project CLAUDE.md from the current folder.
    with tempfile.TemporaryDirectory(prefix="tasks-claude-") as cwd:
        proc = subprocess.run(cmd, input=stdin, capture_output=True, text=True,
                              timeout=TIMEOUT, cwd=cwd, env=clean_env())
    out = None
    if stream:
        for line in proc.stdout.splitlines():
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if isinstance(event, dict) and event.get("type") == "result":
                out = event
    else:
        try:
            out = json.loads(proc.stdout)
        except ValueError:
            pass
    if not isinstance(out, dict):
        lines = (proc.stderr or proc.stdout).strip().splitlines()
        raise RuntimeError(lines[-1] if lines else f"claude beendet mit Code {proc.returncode}")
    if out.get("is_error"):
        raise RuntimeError(out.get("result") or out.get("subtype") or "Fehler in Claude Code")
    data = out.get("structured_output")
    if data is None:
        data = json.loads(out.get("result") or "null")
    return data


# Never hand these to the system: they run code or point into the browser.
BLOCKED_SCHEMES = {"javascript", "data", "vbscript", "blob", "about", "chrome", "resource",
                   "moz-extension", "view-source", "jar"}


def open_link(url):
    """Opens a link with the system's default program (xdg-open / open)."""
    scheme = url.split(":", 1)[0].lower() if ":" in url else ""
    if not scheme or not scheme[0].isalpha() or scheme in BLOCKED_SCHEMES:
        raise ValueError("Diese Art Link wird nicht geöffnet.")
    if scheme == "file":
        path = urllib.parse.unquote(urllib.parse.urlparse(url).path)
        if not os.path.exists(path):
            raise ValueError("Datei nicht gefunden: " + path)
        # A link must never start a program.
        if path.endswith(".desktop") or (os.path.isfile(path) and os.access(path, os.X_OK)):
            raise ValueError("Ausführbare Dateien werden aus Sicherheitsgründen nicht geöffnet.")
    opener = shutil.which("xdg-open") or shutil.which("open")
    if not opener:
        raise ValueError("Kein Programm zum Öffnen gefunden (xdg-open).")
    subprocess.Popen([opener, url], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL, start_new_session=True)


def main():
    req = read_message()
    if req.get("open"):
        try:
            open_link(str(req["open"]))
            send({"ok": True})
        except Exception as err:  # noqa: BLE001 – report any cause to the extension
            send({"ok": False, "error": str(err)})
        return
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
    except Exception as err:  # noqa: BLE001 – report any cause to the extension
        send({"ok": False, "error": str(err)})


if __name__ == "__main__":
    main()
