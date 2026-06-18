#!/usr/bin/env bash
# Resolve the recurring i18n.ts conflict for a stale pack branch being merged
# into release/v0.9. v0.9 split the monolithic i18n.ts into a thin re-export
# (i18n.ts) + feeder (i18n.en.ts). We keep v0.9's i18n.ts (--ours) and replay
# the branch's gameStrings/shellStrings additions onto i18n.en.ts.
#   usage: resolve_i18n.sh origin/<branch>
set -euo pipefail
BRANCH="$1"
MB=$(git merge-base "$BRANCH" upstream/release/v0.9)

git checkout --ours src/ui/i18n.ts

# Replay the branch's i18n.ts edits onto i18n.en.ts (same gameStrings content).
git diff "$MB" "$BRANCH" -- src/ui/i18n.ts \
  | sed -E 's#(a|b)/src/ui/i18n\.ts#\1/src/ui/i18n.en.ts#g' \
  | git apply --3way --whitespace=nowarn || true

# The only conflicts are uniform "export const (v0.9) vs const+newkey (branch)"
# locale-decl blocks of shape: ours-decl / ours-line ==== theirs-decl / theirs-line.
# Keep ours' decl line (the `export const`) and theirs' content line (has new key).
perl -0777 -i -pe 's/<<<<<<< ours\n(.*?\n).*?\n=======\n.*?\n(.*?\n)>>>>>>> theirs\n/$1$2/gs' src/ui/i18n.en.ts

if grep -q '<<<<<<<\|>>>>>>>' src/ui/i18n.en.ts; then
  echo "REMAINING i18n.en.ts conflicts — resolve manually:"
  grep -n '<<<<<<<\|=======\|>>>>>>>' src/ui/i18n.en.ts
  exit 1
fi
git add src/ui/i18n.ts src/ui/i18n.en.ts
echo "i18n resolved for $BRANCH"
