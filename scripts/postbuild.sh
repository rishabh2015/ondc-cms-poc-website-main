#!/usr/bin/env bash
# Post-build checks. npm runs this after `npm run build` (the "postbuild"
# script), on any host — it replaces the CloudCannon-only
# .cloudcannon/postbuild, minus the Bookshop step TinaCMS does not need.
# =====================================================================
# It only READS _site and writes new files alongside. build-info.json is
# the freshness signal the availability workflow reads from the live
# site: a failed build never gets here, so the previously published
# build-info.json stays in place and goes stale.
#
# Environment variables, all optional (set them in the host's build
# settings):
#
#   ONDC_SLACK_WEBHOOK          post build summary to Slack
#   ONDC_FAIL_ON_BROKEN_LINKS   1 = broken internal links fail the build
#   ONDC_FAIL_ON_BUDGET         1 = page-weight breach fails the build
#   ONDC_MAX_HTML_KB            per-page HTML budget (default 900)
#   ONDC_MAX_TOTAL_MB           total output budget (default 40)
#   ONDC_MIN_PAGES              expected page floor  (default 30)
#
# With none set it still writes build-info.json, build-report.txt and
# link-report.json, and never fails the build.
# =====================================================================

SITE_DIR="_site"
SCRIPTS="scripts/monitoring"

METRICS_EXIT=0
node "$SCRIPTS/build-metrics.js" "$SITE_DIR" || METRICS_EXIT=$?

LINKS_EXIT=0
node "$SCRIPTS/check-links.js" "$SITE_DIR" || LINKS_EXIT=$?

if [ -n "${ONDC_SLACK_WEBHOOK:-}" ] && [ -f "$SITE_DIR/build-info.json" ]; then
  PAGES=$(node -e "process.stdout.write(String(require('./$SITE_DIR/build-info.json').pages))" 2>/dev/null || echo '?')
  SIZE=$(node -e "process.stdout.write(String(require('./$SITE_DIR/build-info.json').total_mb))" 2>/dev/null || echo '?')
  BROKEN=$(node -e "process.stdout.write(String(require('./$SITE_DIR/link-report.json').broken.length))" 2>/dev/null || echo '?')
  TEXT="ONDC site built — ${PAGES} pages, ${SIZE} MB, ${BROKEN} broken internal links"
  curl -sS -m 15 -X POST -H 'Content-Type: application/json' \
    -d "{\"text\":$(printf '%s' "$TEXT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.stringify(s)))')}" \
    "$ONDC_SLACK_WEBHOOK" >/dev/null || echo "[postbuild] Slack notify failed (non-fatal)"
fi

if [ "${ONDC_FAIL_ON_BUDGET:-0}" = "1" ] && [ "$METRICS_EXIT" -ne 0 ]; then
  echo "[postbuild] FAILING BUILD: page-weight budget breached"
  exit 1
fi
if [ "${ONDC_FAIL_ON_BROKEN_LINKS:-0}" = "1" ] && [ "$LINKS_EXIT" -ne 0 ]; then
  echo "[postbuild] FAILING BUILD: broken internal links"
  exit 1
fi

echo "[postbuild] complete"
