#!/usr/bin/env bash
# Phase 2C — private storage authorization tests against the LOCAL Supabase stack only.
# Usage: bash supabase/tests/storage/storage-rls.test.sh
set -uo pipefail
cd "$(dirname "$0")/../../.."

STATUS=$(supabase status -o json 2>/dev/null) || { echo "local supabase not running"; exit 2; }
API=$(echo "$STATUS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["API_URL"])')
ANON=$(echo "$STATUS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["ANON_KEY"])')
SERVICE=$(echo "$STATUS" | python3 -c 'import json,sys;print(json.load(sys.stdin)["SERVICE_ROLE_KEY"])')
case "$API" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: API is not local ($API)"; exit 2;; esac

PASS=0; FAIL=0
check() { # name expected actual
  if [[ "$3" == $2 ]]; then PASS=$((PASS+1)); echo "ok   - $1 ($3)"; else FAIL=$((FAIL+1)); echo "FAIL - $1 (expected $2, got $3)"; fi
}

RUN=$(date +%s)$RANDOM
PW="T3st-Aa$(openssl rand -hex 8)"   # throwaway local test password (meets upper/lower/digit rule)
signup() { # create a pre-confirmed user via admin API (email confirmations are on), then sign in
  curl -s -o /dev/null "$API/auth/v1/admin/users" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" \
    -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$PW\",\"email_confirm\":true}"
  curl -s "$API/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PW\"}"
}
jget() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)"; }

A_JSON=$(signup "a-$RUN@test.local"); B_JSON=$(signup "b-$RUN@test.local")
A_TOK=$(echo "$A_JSON" | jget '["access_token"]'); A_ID=$(echo "$A_JSON" | jget '["user"]["id"]')
B_TOK=$(echo "$B_JSON" | jget '["access_token"]'); B_ID=$(echo "$B_JSON" | jget '["user"]["id"]')
[[ -n "$A_TOK" && -n "$B_TOK" ]] || { echo "signup failed: $A_JSON"; exit 1; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
printf '%%PDF-1.4\n%% test\n' > "$TMP/cv.pdf"
head -c 11534336 /dev/zero > "$TMP/big.pdf"   # 11 MB > 10 MB bucket limit

up() { # token bucket path file mime
  curl -s -o /dev/null -w '%{http_code}' -X POST "$API/storage/v1/object/$2/$3" \
    -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: $5" --data-binary "@$4"
}
get() { curl -s -o /dev/null -w '%{http_code}' "$API/storage/v1/object/authenticated/$2/$3" -H "apikey: $ANON" -H "Authorization: Bearer $1"; }

check "A uploads to own folder"                 "200"     "$(up "$A_TOK" resume-uploads "$A_ID/cv.pdf" "$TMP/cv.pdf" application/pdf)"
check "A cannot upload into B's folder"         "4[0-9][0-9]" "$(up "$A_TOK" resume-uploads "$B_ID/evil.pdf" "$TMP/cv.pdf" application/pdf)"
check "A cannot write to resume-exports"        "4[0-9][0-9]" "$(up "$A_TOK" resume-exports "$A_ID/x.pdf" "$TMP/cv.pdf" application/pdf)"
check "disallowed MIME type rejected"           "4[0-9][0-9]" "$(up "$A_TOK" resume-uploads "$A_ID/x.png" "$TMP/cv.pdf" image/png)"
check "file over 10 MB rejected"                "4[0-9][0-9]" "$(up "$A_TOK" resume-uploads "$A_ID/big.pdf" "$TMP/big.pdf" application/pdf)"
check "A reads own file"                        "200"     "$(get "$A_TOK" resume-uploads "$A_ID/cv.pdf")"
check "B cannot read A's file"                  "4[0-9][0-9]" "$(get "$B_TOK" resume-uploads "$A_ID/cv.pdf")"
check "anon cannot read A's file"               "4[0-9][0-9]" "$(get "$ANON" resume-uploads "$A_ID/cv.pdf")"
check "public URL disabled (private bucket)"    "4[0-9][0-9]" "$(curl -s -o /dev/null -w '%{http_code}' "$API/storage/v1/object/public/resume-uploads/$A_ID/cv.pdf")"

sign() { curl -s -X POST "$API/storage/v1/object/sign/$2/$3" -H "apikey: $ANON" -H "Authorization: Bearer $1" -H "Content-Type: application/json" -d '{"expiresIn":60}'; }
A_SIGNED=$(sign "$A_TOK" resume-uploads "$A_ID/cv.pdf" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("signedURL",""))')
check "A gets signed URL for own file"          "/object/sign/*" "$A_SIGNED"
check "signed URL downloads"                    "200" "$(curl -s -o /dev/null -w '%{http_code}' "$API/storage/v1$A_SIGNED")"
B_SIGNED=$(sign "$B_TOK" resume-uploads "$A_ID/cv.pdf" | python3 -c 'import json,sys;print(json.load(sys.stdin).get("signedURL",""))')
check "B cannot sign A's file"                  "" "$B_SIGNED"

curl -s -o /dev/null -X DELETE "$API/storage/v1/object/resume-uploads/$A_ID/cv.pdf" -H "apikey: $ANON" -H "Authorization: Bearer $B_TOK"
check "B's delete of A's file has no effect"    "200" "$(get "$A_TOK" resume-uploads "$A_ID/cv.pdf")"
check "A deletes own file"                      "200" "$(curl -s -o /dev/null -w '%{http_code}' -X DELETE "$API/storage/v1/object/resume-uploads/$A_ID/cv.pdf" -H "apikey: $ANON" -H "Authorization: Bearer $A_TOK")"
check "deleted file is gone"                    "4[0-9][0-9]" "$(get "$A_TOK" resume-uploads "$A_ID/cv.pdf")"

# REST layer: B cannot read A's profile via PostgREST
check "B cannot read A's profile via REST"      "[]" "$(curl -s "$API/rest/v1/profiles?id=eq.$A_ID&select=id" -H "apikey: $ANON" -H "Authorization: Bearer $B_TOK")"

# cleanup test users (service role, local only)
for id in "$A_ID" "$B_ID"; do
  curl -s -o /dev/null -X DELETE "$API/auth/v1/admin/users/$id" -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE"
done

echo "storage tests: $PASS passed, $FAIL failed"
[[ $FAIL -eq 0 ]]
