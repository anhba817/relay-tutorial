#!/usr/bin/env bash
# Fail loudly if any clause identifier in the SRS is defined more than once, or if
# the document grows an identifier class this script does not know about.
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
# CONSTITUTION VI, VERBATIM: identifiers "carry stable identifiers (`FR-*`, `NFR-*`,
# `DR-*`, `EIR-*`) that are never reused". This script is that clause's enforcement,
# not a convenience.
#
# THE CLASS LIST IS EXPLICIT, AND AN UNKNOWN CLASS IS A FAILURE. The first version of
# this script matched `(FR|NFR|CON|DR)-[A-Z]+-[0-9]+` — three parts — and therefore
# silently skipped `DR-01`, `CON-06` and all 22 `EIR-*` rows: 192 of 243. It then
# printed "192 clause rows", which reads as a complete answer. A range stops where it
# stops for a reason nobody records (`check-docs-drift.sh` says the same thing about a
# glob), and `targets.ts` states the doctrine: NOTHING MAY BE EXEMPT BY OMISSION.
#
# `ASM-*` is in the list and is NOT named by principle VI — it holds assumptions
# rather than requirements. It is checked anyway, because a duplicate assumption
# identifier breaks a citation exactly as a duplicate requirement does, and leaving it
# out would be the same omission this comment exists to describe.
#
# DEFINITIONS ONLY, NOT CITATIONS. A definition is a table row that starts with the
# identifier; a citation is anything else — the personas table writes
# `FR-MSG-07/08/10` and the ADR notes write `FR-MOD-01→04`. Counting citations would
# report most clauses as duplicates, and a checker that cries wolf on a healthy tree is
# how a real problem hides (chapter 3.16's `check:figures` reported 122 false problems
# in 193 figures on its first run). Uniqueness is checked; existence is not, because a
# checker that parses `FR-MOD-01→04` is a checker with its own bugs.

if [[ ! -f "$SRS" ]]; then
  echo "check:srs: $SRS not found — skipping (standalone clone?)" >&2
  exit 0
fi

KNOWN_CLASSES="FR NFR DR EIR CON ASM"

# Every table row whose first cell is an identifier. Two-part (`DR-01`) and three-part
# (`FR-MSG-01`) both match; table headers like `| ID |` do not.
ids=$(grep -oE '^\| [A-Z]{2,4}(-[A-Z0-9]+)?-[0-9]+' "$SRS" | sed 's/^| //')
total=$(printf '%s\n' "$ids" | grep -c . || true)

fail=0

# DIRECTION ONE: a class this script does not know about.
for cls in $(printf '%s\n' "$ids" | cut -d- -f1 | sort -u); do
  case " $KNOWN_CLASSES " in
    *" $cls "*) ;;
    *)
      echo "check:srs: FAIL — unknown identifier class '$cls' in docs/04-srs.md." >&2
      echo "  Add it to KNOWN_CLASSES and say why, or fix the row. A class that is" >&2
      echo "  neither listed nor rejected is a class this check silently ignores." >&2
      fail=1
      ;;
  esac
done

# DIRECTION TWO: an identifier defined more than once.
dupes=$(printf '%s\n' "$ids" | sort | uniq -d)
if [[ -n "$dupes" ]]; then
  echo "check:srs: FAIL — clause identifiers defined more than once in docs/04-srs.md:" >&2
  while read -r id; do
    [[ -z "$id" ]] && continue
    echo "  $id" >&2
    grep -nE "^\| $id " "$SRS" | sed 's/^/    line /' >&2
  done <<< "$dupes"
  fail=1
fi

unique=$(printf '%s\n' "$ids" | sort -u | grep -c . || true)
classes=$(printf '%s\n' "$ids" | cut -d- -f1 | sort -u | tr '\n' ' ')

if [[ $fail -ne 0 ]]; then
  echo "check:srs: $total clause rows, $unique unique, classes: $classes" >&2
  exit 1
fi

echo "check:srs: $total clause rows, $unique unique identifiers, no duplicates"
echo "check:srs: classes checked: $classes"
