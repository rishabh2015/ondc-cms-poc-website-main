#!/usr/bin/env bash
# Availability, certificate and DNS checks for ondc.org on CloudCannon.
# =====================================================================
# Covers the things a hostname-only uptime service cannot:
#
#   1. Each apex IP individually. Under External DNS the apex is two
#      static A records with NO load balancing, so if one dies roughly
#      half of visitors fail while a plain https://ondc.org check keeps
#      passing at random. This is the check that catches that.
#   2. TLS certificate expiry, per IP. CloudCannon renews automatically
#      via ZeroSSL, but renewal depends on TXT records in YOUR zone, so
#      "managed" is not "guaranteed".
#   3. The two _acme-challenge TXT records still existing. If they are
#      ever deleted, renewal fails silently and the certificate expires
#      up to 90 days later with no warning in between.
#   4. The A records still matching what CloudCannon issued. Under
#      External DNS you hold those values; if CloudCannon renumbers,
#      nothing updates them for you.
#   5. HTTP still redirecting to HTTPS.
#   6. build-info.json freshness, which catches a silently failed build
#      serving stale content.
#
# Uses only curl and openssl. DNS goes over DNS-over-HTTPS so no dig or
# dnsutils package is needed on the runner.
#
# Exit 0 = all good. Exit 1 = at least one check failed.
# =====================================================================
set -uo pipefail

DOMAIN="${ONDC_DOMAIN:-ondc.org}"
# Space-separated. Set these to the A records CloudCannon issued for YOUR site.
EXPECTED_IPS="${ONDC_EXPECTED_IPS:-}"
KEYWORD="${ONDC_KEYWORD:-Network Participants}"
CERT_WARN_DAYS="${ONDC_CERT_WARN_DAYS:-21}"
MAX_BUILD_AGE_HOURS="${ONDC_MAX_BUILD_AGE_HOURS:-168}"   # 7 days
TIMEOUT=20

FAILURES=0
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$1"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; FAILURES=$((FAILURES+1)); }
warn() { printf '  \033[33mWARN\033[0m  %s\n' "$1"; }
head2() { printf '\n\033[1m%s\033[0m\n' "$1"; }

doh() { # doh <name> <type> -> one value per line
  curl -fsS -m "$TIMEOUT" -H 'accept: application/dns-json' \
    "https://dns.google/resolve?name=$1&type=$2" 2>/dev/null \
  | jq -r --arg t "$2" '
      (.Answer // [])
      | map(select(.type == (if $t=="A" then 1 elif $t=="TXT" then 16 else 0 end)))
      | .[].data' 2>/dev/null
}

echo "════════ availability check: $DOMAIN ════════"
echo "run at $(date -u '+%Y-%m-%d %H:%M:%SZ')"

# ── 1. A records ─────────────────────────────────────────────────────
head2 "1. DNS A records"
LIVE_IPS="$(doh "$DOMAIN" A | sort | tr '\n' ' ' | sed 's/ $//')"
if [ -z "$LIVE_IPS" ]; then
  fail "$DOMAIN returned no A records — resolution is broken"
else
  pass "$DOMAIN resolves to: $LIVE_IPS"
  if [ -n "$EXPECTED_IPS" ]; then
    WANT="$(printf '%s\n' $EXPECTED_IPS | sort | tr '\n' ' ' | sed 's/ $//')"
    if [ "$LIVE_IPS" = "$WANT" ]; then
      pass "A records match the expected set"
    else
      fail "A records DRIFTED — expected [$WANT], got [$LIVE_IPS]"
    fi
  else
    warn "ONDC_EXPECTED_IPS not set — skipping drift check (set it once DNS is cut over)"
  fi
fi

# What we actually probe: the expected set if given, else whatever is live.
PROBE_IPS="${EXPECTED_IPS:-$LIVE_IPS}"

# ── 2. Per-IP reachability and content ───────────────────────────────
head2 "2. Per-IP reachability (the check a hostname monitor cannot do)"
if [ -z "$PROBE_IPS" ]; then
  fail "no IPs to probe"
else
  for ip in $PROBE_IPS; do
    # Body goes to a FILE, not a shell variable. Command substitution
    # strips NUL bytes and mangles any non-text response, and piping a
    # large body into `grep -q` raises "write error: Broken pipe" the
    # moment grep short-circuits. A temp file avoids both.
    # --compressed matters too: CDNs may return gzip/brotli, which as
    # raw bytes would never match a plaintext keyword.
    TMP_BODY=$(mktemp)
    CODE=$(curl -s -o "$TMP_BODY" -w '%{http_code}' -m "$TIMEOUT" --compressed \
             --resolve "$DOMAIN:443:$ip" "https://$DOMAIN/" 2>/dev/null)
    if [ "$CODE" = "200" ]; then
      if grep -qF "$KEYWORD" "$TMP_BODY" 2>/dev/null; then
        pass "$ip -> HTTP 200, keyword \"$KEYWORD\" present"
      else
        # Say what WAS served, so the next run diagnoses itself instead
        # of just repeating "missing".
        BYTES=$(wc -c < "$TMP_BODY" | tr -d ' ')
        TITLE=$(tr '\n' ' ' < "$TMP_BODY" \
                | sed -n 's/.*<title[^>]*>\([^<]*\)<\/title>.*/\1/ip' \
                | cut -c1-80)
        fail "$ip -> HTTP 200 but keyword \"$KEYWORD\" MISSING (${BYTES} bytes, title: ${TITLE:-none})"
      fi
    else
      fail "$ip -> HTTP $CODE (expected 200)"
    fi
    rm -f "$TMP_BODY"
  done
fi

# ── 3. TLS certificate, per IP ───────────────────────────────────────
head2 "3. TLS certificate"
for ip in $PROBE_IPS; do
  CERT=$(echo | timeout "$TIMEOUT" openssl s_client -connect "$ip:443" \
           -servername "$DOMAIN" 2>/dev/null | openssl x509 -noout -subject -issuer -enddate 2>/dev/null)
  if [ -z "$CERT" ]; then
    fail "$ip -> could not retrieve certificate"
    continue
  fi
  END=$(printf '%s' "$CERT" | sed -n 's/^notAfter=//p')
  ISSUER=$(printf '%s' "$CERT" | sed -n 's/^issuer=//p' | sed 's/.*CN *= *//' | cut -c1-40)
  END_EPOCH=$(date -d "$END" +%s 2>/dev/null || echo 0)
  NOW=$(date +%s)
  if [ "$END_EPOCH" -eq 0 ]; then
    fail "$ip -> could not parse expiry \"$END\""
  else
    DAYS=$(( (END_EPOCH - NOW) / 86400 ))
    if [ "$DAYS" -lt 0 ]; then
      fail "$ip -> certificate EXPIRED $(( -DAYS )) days ago (issuer: $ISSUER)"
    elif [ "$DAYS" -lt "$CERT_WARN_DAYS" ]; then
      fail "$ip -> certificate expires in $DAYS days — renewal has NOT happened (issuer: $ISSUER)"
    else
      pass "$ip -> certificate valid $DAYS more days (issuer: $ISSUER)"
    fi
  fi
done

# ── 4. ACME validation records ───────────────────────────────────────
head2 "4. Certificate renewal prerequisites"
# On a CloudCannon-owned preview host (*.cloudvent.net) the certificate
# is issued against CloudCannon's own zone, so there is no
# _acme-challenge record in any zone we control and nothing to assert.
# Auto-skip rather than fail: a check that is permanently red trains
# people to ignore the alert, which costs more than it catches. This
# starts asserting for real the moment ONDC_DOMAIN becomes ondc.org.
case "$DOMAIN" in
  *.cloudvent.net)
    warn "skipped on CloudCannon preview host — ACME records live in CloudCannon's zone, not yours"
    warn "this check starts enforcing once ONDC_DOMAIN is your own domain"
    ;;
  *)
    TXT_COUNT=$(doh "_acme-challenge.$DOMAIN" TXT | grep -c . || true)
    if [ "${TXT_COUNT:-0}" -ge 1 ]; then
      pass "_acme-challenge.$DOMAIN has $TXT_COUNT TXT record(s) — renewal can validate"
    else
      fail "_acme-challenge.$DOMAIN has NO TXT records — certificate renewal WILL fail silently"
    fi
    ;;
esac

# ── 5. HTTP to HTTPS redirect ────────────────────────────────────────
head2 "5. HTTP -> HTTPS redirect"
RCODE=$(curl -s -o /dev/null -w '%{http_code}' -m "$TIMEOUT" "http://$DOMAIN/" 2>/dev/null)
RLOC=$(curl -s -o /dev/null -w '%{redirect_url}' -m "$TIMEOUT" "http://$DOMAIN/" 2>/dev/null)
case "$RCODE" in
  301|308) case "$RLOC" in https://*) pass "http:// -> $RCODE -> $RLOC" ;;
                          *) fail "http:// -> $RCODE but redirects to non-HTTPS: $RLOC" ;; esac ;;
  302|307) warn "http:// -> $RCODE (temporary). A 301 is preferred for search engines." ;;
  200)     fail "http:// returns 200 — PLAINTEXT IS BEING SERVED, no redirect" ;;
  *)       fail "http:// returned $RCODE" ;;
esac

# ── 6. Content freshness ─────────────────────────────────────────────
head2 "6. Build freshness"
BI=$(curl -fsS -m "$TIMEOUT" "https://$DOMAIN/build-info.json" 2>/dev/null)
if [ -z "$BI" ]; then
  warn "build-info.json not reachable — deploy the postbuild hook to enable this check"
else
  BUILT=$(printf '%s' "$BI" | jq -r '.built_at // empty' 2>/dev/null)
  PAGES=$(printf '%s' "$BI" | jq -r '.pages // empty' 2>/dev/null)
  BROKEN=$(printf '%s' "$BI" | jq -r '(.budget_breaches // []) | length' 2>/dev/null)
  BE=$(date -d "$BUILT" +%s 2>/dev/null || echo 0)
  if [ "$BE" -eq 0 ]; then
    fail "could not parse built_at from build-info.json"
  else
    AGE=$(( ($(date +%s) - BE) / 3600 ))
    if [ "$AGE" -gt "$MAX_BUILD_AGE_HOURS" ]; then
      fail "last build was ${AGE}h ago (limit ${MAX_BUILD_AGE_HOURS}h) — build may be failing silently"
    else
      pass "last build ${AGE}h ago, $PAGES pages, $BROKEN budget breach(es)"
    fi
  fi
fi

# ── summary ──────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════"
if [ "$FAILURES" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
  exit 0
fi
echo "$FAILURES CHECK(S) FAILED"
exit 1
