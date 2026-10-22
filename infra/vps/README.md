# Eco homeserver — VPS deploy runbook (Synapse + Postgres)

Production homeserver for Eco (Matrix client). Deploys to the Oracle Ampere A1
VPS (aarch64/ARM64, Ubuntu 24.04, Docker Engine + Compose v2), reached via
Cloudflare Tunnel → coolify-proxy (Traefik v3) on `https://eco.litteris.online`.

All four steps below are run on the VPS. No host ports are published; Traefik
routes by Host header over the external `coolify` docker network. TLS
terminates at Cloudflare; Traefik entrypoint is plain `http`.

Images are multi-arch (`linux/arm64` verified): `matrixdotorg/synapse:v1.163.0`
(pinned stable, released 2026-10-14) and `postgres:16-alpine`.

## 1. Copy the kit to the VPS

From the repo root (local):

```bash
scp -r infra/vps user@<vps>:~/eco/infra/vps
```

## 2. Fill secrets

On the VPS:

```bash
cd ~/eco/infra/vps
cp .env.example .env
# Generate one strong secret per variable:
openssl rand -hex 32
# Edit .env and set:
#   POSTGRES_PASSWORD=<hex>
#   SYNAPSE_POSTGRES_PASSWORD=<same hex as POSTGRES_PASSWORD>
#   SYNAPSE_REGISTRATION_SHARED_SECRET=<another hex>
# Leave SYNAPSE_GOOGLE_* empty until OIDC is enabled (step 7).
chmod 600 .env
```

## 3. Render the config (envsubst)

Requires `gettext-base` (installed by default on Ubuntu 24.04; if missing:
`sudo apt-get install -y gettext-base`):

```bash
set -a; source .env; set +a
mkdir -p synapse
envsubst < homeserver.yaml.template > synapse/homeserver.yaml
chmod 600 synapse/homeserver.yaml
# Synapse runs as UID 991; the file is mode 600 and unreadable to it otherwise.
sudo chown 991:991 synapse/homeserver.yaml
```

Note: envsubst replaces **every** `${...}` occurrence. The template contains no
`${}` that must survive (Jinja2 templates inside use `{{ }}`, untouched), so a
plain render is safe.

## 4. Start the stack

First run only — the synapse_data volume starts root-owned; give it to Synapse
(UID 991). Do NOT use `-R` (the read-only config mount breaks a recursive
chown) and do not insert `--` as separator (compose v2 does not accept it):

```bash
docker compose run --rm --user root --entrypoint chown synapse 991:991 /data
```

Then:

```bash
docker compose config   # sanity check: prints resolved config, no errors
docker compose up -d
```

First start: Synapse runs schema migrations (a few minutes on first boot) and
**auto-generates the signing key** at `/data/litteris.online.signing.key`
(Synapse ≥ 1.67 creates it when missing; it lives inside the `synapse_data`
volume). Do not delete that file — it is the server's identity.

## 5. Verify

```bash
docker compose ps        # both services Up; postgres shows (healthy)
curl https://eco.litteris.online/_matrix/client/versions
```

Expected: JSON with a `versions` array. (There is no host port publication, so
verify through the public URL via Cloudflare → Traefik → container.)

## 6. Create the break-glass admin

```bash
docker compose exec synapse register_new_matrix_user \
  -c /data/homeserver.yaml -u ecoadmin -p '<strong password>' -a \
  http://localhost:8008
```

Expected output: `Success`. Store the password in the password manager.
Registration is closed (`enable_registration: false`); this CLI path is the
only way in until invite-token registration ships (later phase).

## 7. Later: enable Google OIDC

1. Create an OAuth client (type **Web application**) in Google Cloud Console.
2. Authorized redirect URI: `https://eco.litteris.online/_synapse/client/oidc/callback`
3. Fill `SYNAPSE_GOOGLE_CLIENT_ID` / `SYNAPSE_GOOGLE_CLIENT_SECRET` in `.env`.
4. Uncomment the `oidc_providers` block in `homeserver.yaml.template`
   (no `localpart_template`: users pick their own username on first login,
   with a confirmation screen via `confirm_localpart: true`).
5. Re-render and restart (render to `/tmp` first — the live file is owned by
   991 with mode 600 and cannot be overwritten in place, then move + re-secure):

```bash
set -a; source .env; set +a
envsubst < homeserver.yaml.template > /tmp/homeserver.yaml
sudo mv /tmp/homeserver.yaml synapse/homeserver.yaml
sudo chmod 600 synapse/homeserver.yaml
sudo chown 991:991 synapse/homeserver.yaml
docker compose restart synapse
```

## 8. Ops

- **Logs**: `docker compose logs -f synapse` (json-file, rotated: 10 MiB × 3).
- **Stop/rollback**: `docker compose down` — keeps data in named volumes.
  Full reset (DESTROYS ALL DATA): `docker compose down -v`.
- **Volumes** (named volumes under `/var/lib/docker/volumes/`):
  - `eco_synapse_data` → `/data` in the Synapse container (config dir, media
    store, signing key).
  - `eco_pgdata` → Postgres data.
- **Config changes**: edit `homeserver.yaml.template`, re-render (use the
  `/tmp` + `sudo mv` procedure from step 7 — the rendered file is owned by
  991:991 with mode 600 and envsubst cannot overwrite it in place),
  `docker compose restart synapse`.
- **Label changes**: compose label changes (e.g. the Traefik
  `X-Forwarded-Proto=https` middleware on the `eco` router) require
  `docker compose up -d` to recreate the container — `docker compose restart`
  does NOT apply label changes. The middleware exists because the
  Traefik→Synapse hop is plain HTTP while `public_baseurl` is `https://...`:
  without the injected header Synapse rebuilds SSO redirect URIs as `http://`
  and login gets stuck in an infinite 302 loop.
- **Gotchas learned on this host**:
  - When scripting `docker compose exec -T` inside a piped SSH script, ALWAYS
    append `< /dev/null` to the command — otherwise `exec -T` consumes the rest
    of the script as stdin and silently runs garbage.
  - Manual user cleanup in Synapse SQL: the `profiles` table keys on
    `localpart`, while `user_directory`, `devices` and `access_tokens` key on
    the full MXID (`@user:litteris.online`) — don't mix the two when deleting rows.
- **Image upgrades**: bump the pinned tag in `docker-compose.yml`, check the
  Synapse upgrade notes, then `docker compose pull && docker compose up -d`.
- **Backup** (design doc §8.1): rclone the `synapse_data` volume
  (`/var/lib/docker/volumes/eco_synapse_data/_data`) — includes the signing
  key and media store — and dump the DB with
  `docker compose exec postgres pg_dump -U synapse synapse > synapse.sql`.
  The signing key and DB must be backed up together: losing the key breaks
  all device/message trust.
- **Isolation**: this project (`eco`) only creates its own `eco_net` network,
  joins the external `coolify` network, publishes no host ports, and mounts
  nothing outside its own directory — safe alongside the other stacks on the
  host (Chatwoot, Pay Hub, Mailu, LiveKit).
