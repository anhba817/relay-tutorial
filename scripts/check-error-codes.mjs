// The TUTORIAL half of the error-vocabulary closure check (chapter 3.12, FR-025,
// SC-011, SC-012).
//
// `ERROR_CODES` in @relay/protocol is the registry; `docs/08-error-reference.md` is
// the published reference every error response's `docs_url` points at. This checks
// them SET-EQUAL, IN BOTH DIRECTIONS:
//
//   - a code with no section fails, because `docs_url` would 404 for it;
//   - a section for a code that cannot be emitted also fails, because a reference
//     documenting a retired code is how a documentation set starts lying.
//
// WHY HERE AND NOT IN THE PLATFORM'S UNIT LANE, measured rather than preferred:
// `docs/` sits above `$TURBO_ROOT$`, so it cannot be a turbo input, and a gate whose
// input turbo cannot see passes from CACHE after the reference changes. And
// `relay-platform` is independently clonable with a README promising its checks pass
// from a clean checkout, where `../docs` does not exist.
//
// Skips with a warning when the platform or the docs are absent, exactly as
// `check-docs-drift.sh` does, and for the same reason: a check that cannot run is
// not a check that failed.

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(HERE, "..");
const REFERENCE = join(APP_ROOT, "..", "docs", "08-error-reference.md");
const REGISTRY = join(APP_ROOT, "..", "relay-platform", "packages", "protocol", "dist", "codes.js");

if (!existsSync(REFERENCE) || !existsSync(REGISTRY)) {
  // The registry is read from BUILD OUTPUT, so `pnpm build` in the platform is a
  // precondition. Saying which of the two is missing is the difference between a
  // skip somebody investigates and a skip somebody ignores.
  console.warn(
    `check-error-codes: skipping — ${!existsSync(REFERENCE) ? "docs/08-error-reference.md" : "relay-platform's built protocol package"} not found`,
  );
  process.exit(0);
}

const require_ = createRequire(import.meta.url);
const { ERROR_CODES } = require_(REGISTRY);
const codes = Object.keys(ERROR_CODES);

const markdown = readFileSync(REFERENCE, "utf8");
const headings = [...markdown.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());

let status = 0;

const undocumented = codes.filter((c) => !headings.includes(c));
if (undocumented.length > 0) {
  console.error(
    `check-error-codes: these codes have no section in the reference, so their docs_url 404s:\n  ${undocumented.join("\n  ")}`,
  );
  status = 1;
}

const orphaned = headings.filter((h) => !codes.includes(h));
if (orphaned.length > 0) {
  console.error(
    `check-error-codes: these sections name no code in ERROR_CODES — remove them or the reference is lying:\n  ${orphaned.join("\n  ")}`,
  );
  status = 1;
}

// Every entry names a CAUSE and a CLIENT ACTION (FR-028, SC-026). An entry that
// only restates the code's own name counts as missing: "unauthorized: the request
// was unauthorized" tells a developer nothing they did not already have.
const sections = markdown.split(/^## /m).slice(1);
for (const section of sections) {
  const [heading] = section.split("\n");
  const name = heading.trim();
  if (!codes.includes(name)) continue; // already reported above
  if (!/\*\*Retryable:\*\*/.test(section)) {
    console.error(`check-error-codes: ${name} does not say whether it is retryable`);
    status = 1;
  }
  if (!/\*\*What to do:\*\*/.test(section)) {
    console.error(`check-error-codes: ${name} does not say what a client should do`);
    status = 1;
  }
  // The body has to say something beyond the heading. 200 characters is not a
  // quality bar; it is a floor that a restatement cannot clear.
  const body = section.slice(heading.length).replace(/\s+/g, " ").trim();
  if (body.length < 200) {
    console.error(`check-error-codes: ${name}'s section is too thin to be an explanation`);
    status = 1;
  }
}

if (status === 0) {
  console.log(
    `check-error-codes: ${codes.length} codes, ${codes.length} sections, each with a cause and a client action`,
  );
}
process.exit(status);
