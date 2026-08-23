#!/usr/bin/env bash
# Sync the published documents from the parent repo's canonical docs/ into
# content/docs/. content/docs/ is machine-written only — never hand-edit.
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PARENT_DOCS="$APP_ROOT/../docs"
MIRROR="$APP_ROOT/content/docs"

# THE PUBLISHED DOCUMENTS, AS AN EXPLICIT LIST (chapter 3.12, FR-029).
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
  echo "sync-docs: parent docs directory not found at $PARENT_DOCS — cannot sync" >&2
  exit 1
fi

mkdir -p "$MIRROR"
for name in "${DOCS[@]}"; do
  if [ ! -f "$PARENT_DOCS/$name" ]; then
    echo "sync-docs: $name is in the list and not in $PARENT_DOCS" >&2
    exit 1
  fi
  cp "$PARENT_DOCS/$name" "$MIRROR/$name"
  echo "synced $name"
done
