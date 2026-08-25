#!/usr/bin/env bash
# Fail loudly if any clause identifier in the SRS is defined more than once.
# Skips (with a warning) when the parent repo is absent — e.g. a standalone clone.
set -uo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRS="$APP_ROOT/../docs/04-srs.md"

# WHY THIS IS NOT `check:docs`. That script compares each mirrored document against
# its canonical source: it catches DRIFT, and a duplicate identifier is not drift —
# both copies agree, and both are wrong. Chapter 3.17's amendment was specified as
# `FR-MSG-10` across six artifacts, none of them inconsistent with each other,
# because the clause it collided with lives in a file none of them quoted.
#
# DEFINITIONS ONLY, NOT CITATIONS. A definition is a table row that starts with the
# identifier; a citation is anything else — the personas table writes
# `FR-MSG-07/08/10` and the traceability notes write prose. Counting citations would
# report every clause mentioned twice, which is most of them: a checker that cries
# wolf on a healthy tree is how a real problem hides (chapter 3.16's `check:figures`
# reported 122 false problems in 193 figures on its first run).
#
# The compressed citation form is why this checks uniqueness and not existence.
# `FR-MOD-01→04` names four clauses in eight characters, and a checker that has to
# parse it is a checker with its own bugs.

if [[ ! -f "$SRS" ]]; then
  echo "check:srs: $SRS not found — skipping (standalone clone?)" >&2
  exit 0
fi

dupes=$(grep -oE '^\| (FR|NFR|CON|DR)-[A-Z]+-[0-9]+' "$SRS" | sed 's/^| //' | sort | uniq -d)

total=$(grep -cE '^\| (FR|NFR|CON|DR)-[A-Z]+-[0-9]+' "$SRS")
unique=$(grep -oE '^\| (FR|NFR|CON|DR)-[A-Z]+-[0-9]+' "$SRS" | sed 's/^| //' | sort -u | wc -l)

if [[ -n "$dupes" ]]; then
  echo "check:srs: FAIL — clause identifiers defined more than once in docs/04-srs.md:" >&2
  while read -r id; do
    [[ -z "$id" ]] && continue
    echo "  $id" >&2
    grep -nE "^\| $id " "$SRS" | sed 's/^/    line /' >&2
  done <<< "$dupes"
  echo "check:srs: $total clause rows, $unique unique identifiers" >&2
  exit 1
fi

echo "check:srs: $total clause rows, $unique unique identifiers, no duplicates"
