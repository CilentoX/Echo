#!/usr/bin/env python3
"""Echo homeserver entrypoint: render /data/homeserver.yaml from the template
using the container's environment (set by Coolify), then hand off to the
official Synapse start script. Runs as UID 991 — owner of /data — so the
rendered file is readable by Synapse without any host-side chown.

Pure stdlib on purpose: the official Synapse image has no envsubst/gettext,
so we substitute ${VAR} placeholders with a targeted regex. Jinja2 {{ ... }}
braces in the template are left untouched (the regex only matches ${...}).
"""

import os
import re
import sys

TEMPLATE = "/opt/echo/homeserver.template"
OUTPUT = "/data/homeserver.yaml"

with open(TEMPLATE, encoding="utf-8") as f:
    tpl = f.read()

pattern = re.compile(r"\$\{([A-Z_][A-Z0-9_]*)\}")


def substitute(match: "re.Match[str]") -> str:
    return os.environ.get(match.group(1), match.group(0))


rendered = pattern.sub(substitute, tpl)

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(rendered)
# The official Synapse image has no USER: the renderer runs as root while the
# server process drops to UID 991 (matrix) via /start.py — the rendered file
# must be owned by 991 or Synapse cannot read it (PermissionError on boot).
try:
    os.chown(OUTPUT, 991, 991)
except OSError:
    pass  # not root (or already 991): nothing to fix
os.chmod(OUTPUT, 0o600)

os.execv("/start.py", ["start.py", *sys.argv[1:]])
