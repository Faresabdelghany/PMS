#!/usr/bin/env bash
# PMS Performance Audit Script
# Usage: bash scripts/perf-audit.sh [lighthouse|bundle|full]
#
# Runs Lighthouse CI and/or bundle analysis against production.
# Results saved to .lighthouseci/

set -euo pipefail

TARGET="${1:-full}"
PROD_URL="https://pms-nine-gold.vercel.app"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

header() { echo -e "\n${CYAN}=== $1 ===${NC}\n"; }
pass() { echo -e "  ${GREEN}PASS${NC} $1"; }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }
fail() { echo -e "  ${RED}FAIL${NC} $1"; }

check_metric() {
  local name="$1" value="$2" threshold="$3" direction="${4:-lt}"
  if [ "$direction" = "lt" ]; then
    if (( $(echo "$value < $threshold" | bc -l) )); then
      pass "$name: $value (threshold: < $threshold)"
    else
      fail "$name: $value (threshold: < $threshold)"
    fi
  else
    if (( $(echo "$value >= $threshold" | bc -l) )); then
      pass "$name: ${value}% (threshold: >= ${threshold}%)"
    else
      fail "$name: ${value}% (threshold: >= ${threshold}%)"
    fi
  fi
}

run_lighthouse() {
  header "Lighthouse CI Audit"

  mkdir -p .lighthouseci

  for page in login signup; do
    echo "Auditing ${PROD_URL}/${page} (3 runs)..."

    npx lhci collect \
      --url="${PROD_URL}/${page}" \
      --numberOfRuns=3 \
      --settings.preset=desktop 2>&1 | tail -5

    echo ""
  done

  echo "Running assertions..."
  npx lhci assert 2>&1 || true

  echo ""
  echo "Uploading results..."
  npx lhci upload --target=temporary-public-storage 2>&1 | grep -E "(storage|URL)" || true

  header "Lighthouse Results"

  # Parse the latest result
  LATEST=$(ls -t .lighthouseci/lhr-*.json 2>/dev/null | head -1)
  if [ -n "$LATEST" ]; then
    echo "Latest report: $LATEST"
    echo ""

    PERF=$(node -e "const r=require('./${LATEST}'); console.log(Math.round(r.categories.performance.score*100))")
    A11Y=$(node -e "const r=require('./${LATEST}'); console.log(Math.round(r.categories.accessibility.score*100))")
    BP=$(node -e "const r=require('./${LATEST}'); console.log(Math.round(r.categories['best-practices'].score*100))")
    FCP=$(node -e "const r=require('./${LATEST}'); console.log(r.audits['first-contentful-paint'].numericValue)")
    LCP=$(node -e "const r=require('./${LATEST}'); console.log(r.audits['largest-contentful-paint'].numericValue)")
    TBT=$(node -e "const r=require('./${LATEST}'); console.log(r.audits['total-blocking-time'].numericValue)")
    CLS=$(node -e "const r=require('./${LATEST}'); console.log(r.audits['cumulative-layout-shift'].numericValue)")
    SI=$(node -e "const r=require('./${LATEST}'); console.log(r.audits['speed-index'].numericValue)")

    FCP_S=$(echo "scale=2; $FCP / 1000" | bc)
    LCP_S=$(echo "scale=2; $LCP / 1000" | bc)
    TBT_MS=$(echo "scale=0; $TBT / 1" | bc)
    SI_S=$(echo "scale=2; $SI / 1000" | bc)

    check_metric "Performance" "$PERF" "85" "gte"
    check_metric "Accessibility" "$A11Y" "90" "gte"
    check_metric "Best Practices" "$BP" "95" "gte"
    check_metric "FCP" "$FCP_S" "1.8"
    check_metric "LCP" "$LCP_S" "2.5"
    check_metric "TBT" "$TBT_MS" "500"
    check_metric "CLS" "$CLS" "0.1"
    echo -e "  ${CYAN}INFO${NC} Speed Index: ${SI_S}s"
  else
    echo "No Lighthouse results found in .lighthouseci/"
  fi
}

run_bundle() {
  header "Bundle Size Analysis"
  echo "Running production build..."

  npm run build 2>&1 | grep -E "(Route|First Load|Size|─|┬|└|├)" || true
}

# Main
echo -e "${CYAN}PMS Performance Audit${NC}"
echo "Target: $TARGET"
echo "Production URL: $PROD_URL"

case "$TARGET" in
  lighthouse)
    run_lighthouse
    ;;
  bundle)
    run_bundle
    ;;
  full)
    run_lighthouse
    run_bundle
    ;;
  *)
    echo "Usage: bash scripts/perf-audit.sh [lighthouse|bundle|full]"
    exit 1
    ;;
esac

header "Done"
echo "Vercel Speed Insights (real user metrics):"
echo "  https://vercel.com/faresabdelghany/pms-nine-gold/speed-insights"
