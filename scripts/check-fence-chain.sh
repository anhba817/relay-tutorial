#!/usr/bin/env bash
# Fail loudly if the chapters and the canonical repository have drifted: every
# titled code fence, replayed in chapter order, must land exactly on the file in
# relay-platform. Skips (with a warning) when the platform repo is absent — e.g.
# a standalone clone, matching check-docs-drift.sh.
set -uo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -d "$APP_ROOT/../relay-platform" ]; then
  echo "check-fence-chain: relay-platform not found — skipping fence check" >&2
  exit 0
fi

exec node "$APP_ROOT/scripts/check-fence-chain.mjs" "$@"
