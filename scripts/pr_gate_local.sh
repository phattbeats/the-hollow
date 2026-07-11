#!/usr/bin/env bash
# Local PR gate. GitHub Actions is disabled on this repo (board decision,
# 2026-07-11: we do not pay for hosted CI). This script is the merge gate:
# it mirrors the pr-gate job in .github/workflows/ci.yml exactly. Run it on
# the merged tree (your branch merged into latest main) and merge only on a
# clean exit.
#
# Usage: bash scripts/pr_gate_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== install =="
npm ci

echo "== i18n artifacts =="
npm run i18n:gen
git diff --exit-code -- src/ui/i18n.resolved.generated src/admin/i18n.resolved.generated src/ui/i18n.status.summary.json

echo "== malicious-code gate =="
npm run security:gate

echo "== tests (PR tier) =="
npm test

echo "== typecheck =="
npx tsc --noEmit

echo "== builds =="
npm run build:env
npm run build:server
npm run build

echo "PR GATE: GREEN"
