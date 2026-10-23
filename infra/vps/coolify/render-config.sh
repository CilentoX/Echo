#!/bin/sh
# Echo homeserver entrypoint: render homeserver.yaml from the template using
# the container's environment (set by Coolify), then hand off to the official
# Synapse start script. Runs as UID 991 — owner of /data — so the rendered
# file is readable by Synapse without any host-side chown.
set -eu

envsubst < /opt/echo/homeserver.template > /data/homeserver.yaml
chmod 600 /data/homeserver.yaml

exec /start.py "$@"
