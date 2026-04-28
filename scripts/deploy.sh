#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DEV_VARS="worker/.dev.vars"
WRANGLER="npx wrangler"
CONFIG=(--config worker/wrangler.toml)

if [[ ! -f "$DEV_VARS" ]]; then
  cat >&2 <<EOF
error: $DEV_VARS not found.

Copy worker/.dev.vars.example to worker/.dev.vars and fill in:
  FEED_BASE          — origin URL the Worker proxies /llms-full.txt from
  PURGE_API_TOKEN    — Cloudflare token with Zone:Cache Purge
  PURGE_ZONE_ID      — zone ID for your domain
  REFRESH_TOKEN      — anything; rotated on every deploy
EOF
  exit 1
fi

# Source .dev.vars (KEY="value" syntax). We deliberately do NOT auto-export
# every variable: the wrangler CLI treats env vars like CF_API_TOKEN /
# CLOUDFLARE_API_TOKEN as its own auth credentials, and exporting one from
# .dev.vars would override the user's `wrangler login` session. Read the
# values into local shell vars only, then pipe them to `secret put`.
# shellcheck disable=SC1090
source "$DEV_VARS"

push_secret() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo ">> skipping $name (empty in $DEV_VARS)"
    return
  fi
  echo ">> pushing $name"
  printf '%s' "$value" | $WRANGLER secret put "$name" "${CONFIG[@]}" >/dev/null
}

# --- Deploy first --------------------------------------------------------
# Wrangler reconciles `[vars]` in wrangler.toml with the deployed Worker on
# every deploy: any var that's no longer in the toml is removed. Doing this
# before `secret put` lets us cleanly migrate a binding from `[vars]` to
# secret without hitting "Binding name already in use" errors.
echo ">> deploying worker"
$WRANGLER deploy "${CONFIG[@]}"

# --- Sync stable secrets -------------------------------------------------
push_secret FEED_BASE
push_secret PURGE_API_TOKEN
push_secret PURGE_ZONE_ID

# --- Rotate the ephemeral REFRESH_TOKEN ----------------------------------
TOKEN=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
echo ">> rotating REFRESH_TOKEN"
printf '%s' "$TOKEN" | $WRANGLER secret put REFRESH_TOKEN "${CONFIG[@]}" >/dev/null

cat <<EOF

────────────────────────────────────────────────────────────
  REFRESH_TOKEN: $TOKEN

  Force-purge the edge cache:
    curl -H "X-Refresh-Token: $TOKEN" https://eagleleather.com.au/llms.txt

  Header survives the apex→www redirect. ?refresh=$TOKEN
  also works if you hit the www host directly.

  This token rotates on every deploy. Save it now or run a
  fresh deploy to get a new one.
────────────────────────────────────────────────────────────
EOF
