# Echo API — Configuração do Coolify
# Variáveis de ambiente necessárias (definir no Coolify):
#
#   ECHO_API_DB_PASSWORD      — Senha do PostgreSQL (mesma do Synapse)
#   ECHO_API_API_KEY          — Chave de API para autenticar requisições
#
# Volumes externos (criar no Coolify antes do deploy):
#   echo_api_uploads          — Armazena imagens enviadas (avatars, banners)
#
# Rede:
#   coolify                   — Rede compartilhada com Synapse e Traefik
#   internal                  — Rede interna entre containers
#
# Domains:
#   api.echo.litteris.online  — Aponta para o container echo-api via Traefik
