#!/usr/bin/env bash
# Smoke test against a running API: health, create, publish, list. Used by the CI `docker` job.
# Usage: scripts/smoke.sh [base-url]   (token: CMS_API_TOKEN, default brianfox-cms-token)
set -euo pipefail

BASE="${1:-http://localhost:3000}"
TOKEN="${CMS_API_TOKEN:-brianfox-cms-token}"
AUTH="Authorization: Bearer ${TOKEN}"

curl -fsS "$BASE/health"
echo

created=$(curl -fsS -X POST "$BASE/api/v1/cms/posts" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"title":"Smoke test","body":"Created by smoke.sh","hashtags":["smoke"]}')
id=$(printf '%s' "$created" | sed -n 's/.*"id":"\([0-9a-f]\{24\}\)".*/\1/p')
[ -n "$id" ] || { echo "could not read the post id from: $created" >&2; exit 1; }
echo "created $id"

curl -fsS -X POST "$BASE/api/v1/cms/posts/$id/publish" -H "$AUTH" >/dev/null
echo "published $id"

list=$(curl -fsS "$BASE/api/v1/posts?hashtags=smoke")
grep -q "\"id\":\"$id\"" <<<"$list"   || { echo "published post $id missing from the public list" >&2; exit 1; }
echo "smoke test passed"
