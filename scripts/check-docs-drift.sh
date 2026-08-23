#!/usr/bin/env bash
# Fail loudly if any mirrored document in content/docs/ diverges from its
# canonical source in the parent repo's docs/. Skips (with a warning) when the
# parent repo is absent — e.g. a standalone clone or CI.
set -uo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DOCS="$APP_ROOT/../docs"
MIRROR="$APP_ROOT/content/docs"

# THE PUBLISHED DOCUMENTS, AS AN EXPLICIT LIST (chapter 3.12, FR-029) — the same list as sync-docs.sh.
#
# This was `0[1-6]-*.md`. A range stops where it stops for a reason nobody records:
# `docs/07-tutorial-plan.md` is the SERIES' OWN PLAN and is not a published
# reference, so `0[1-8]` would have published it. Nobody would have noticed until a
# reader found the chapter list with its unpublished chapters in it.
#
# An explicit list is feature 030's doctrine in a shell script: whatever silently
# absorbs the next file added is the thing to remove. Adding a document here is an
# edit somebody has to justify — and it has to agree with `lib/docs.ts`'s registry,
# because a document in the registry and not in this list renders whatever
# `content/docs/` last held, and the drift check below cannot see it: the check only
# walks the files its own list selects.
DOCS=(
  01-product-vision.md
  02-personas.md
  03-journey-map.md
  04-srs.md
  05-sad.md
  06-adr-deep-dives.md
  # 07-tutorial-plan.md is deliberately NOT here — see above.
  08-error-reference.md
)

if [ ! -d "$PARENT_DOCS" ]; then
  echo "check-docs-drift: parent docs directory not found — skipping drift check" >&2
  exit 0
fi

status=0
for name in "${DOCS[@]}"; do
  f="$MIRROR/$name"
  if [ ! -f "$f" ]; then
    echo "DRIFT: $name is in the list and not mirrored — run pnpm sync:docs" >&2
    status=1
    continue
  fi
  if [ ! -f "$PARENT_DOCS/$name" ]; then
    echo "DRIFT: $name has no canonical source in $PARENT_DOCS" >&2
    status=1
  elif ! diff -q "$PARENT_DOCS/$name" "$f" > /dev/null; then
    echo "DRIFT: content/docs/$name differs from docs/$name — run pnpm sync:docs" >&2
    status=1
  fi
done

[ "$status" -eq 0 ] && echo "check-docs-drift: all mirrored docs match their sources"
exit "$status"
