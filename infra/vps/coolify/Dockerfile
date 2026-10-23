# Echo homeserver — Synapse image with config rendering built in.
# The official Synapse image plus a template + entrypoint that renders
# /data/homeserver.yaml from environment variables on every boot.
# Secrets are injected by Coolify as app environment variables — they never
# live in the git repository.
FROM matrixdotorg/synapse:v1.163.0

COPY homeserver.template /opt/echo/homeserver.template
COPY render-config.sh /opt/echo/render-config.sh
RUN chmod +x /opt/echo/render-config.sh

ENTRYPOINT ["/opt/echo/render-config.sh"]
CMD ["run"]
