# Echo homeserver — Synapse image with config rendering built in.
# The official Synapse image plus a template + entrypoint that renders
# /data/homeserver.yaml from environment variables on every boot.
# Secrets are injected by Coolify as app environment variables — they never
# live in the git repository.
# The renderer is pure Python stdlib: the official Synapse image has no
# envsubst/gettext.
FROM matrixdotorg/synapse:v1.163.0

COPY homeserver.template /opt/echo/homeserver.template
COPY render-config.py /opt/echo/render-config.py

ENTRYPOINT ["python3", "/opt/echo/render-config.py"]
CMD ["run"]
