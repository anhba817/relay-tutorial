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
const { ERROR_CODES, CLOSE_CODES } = require_(REGISTRY);
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

// THE CLOSE CODES, HELD TO THE SAME STANDARD AND IN THE SAME TWO DIRECTIONS (feature 043,
// FR-019). EIR-WS-06 requires the close codes to distinguish authentication failure, quota
// exhaustion, shutdown and protocol violation — and until now nothing compared `CLOSE_CODES`
// with this document at all. The review found 4003 undocumented and 4001, 4008 and 4009
// "scattered or absent", which is what an unchecked half of a registry looks like.
//
// THEY ARE NOT `h2` HEADINGS, and that is deliberate rather than a workaround. This
// document's `##` level means "an error code in ERROR_CODES" — the orphan check above is
// exactly that claim — so a `## 4001` would have to be exempted from it, and an exemption
// is how a class list stops meaning anything. The close codes live in a table instead, and
// this rule reads the table.
//
// A BARE NUMBER DOES NOT COUNT. `4001` appears in prose that happens to mention it; what
// this requires is a row or a status line that says `close 4001` or `closes 4001`, because
// the thing being checked is whether a reader can look the code up, not whether the
// character sequence is present.
const closeCodes = Object.keys(CLOSE_CODES);
// TWO SHAPES COUNT, because the document has two honest ways to say it: a row in the
// close-code table, and a `**Status:**` line on the error code that carries it. 4009 is
// why both are needed — it is declared and never emitted, so no status line can name it
// and only the table can.
const mentions = (code) =>
  new RegExp(`clos(?:e|es|ing)\\s+${code}\\b`).test(markdown) ||
  new RegExp(`^\\|\\s*${code}\\s*\\|`, "m").test(markdown);

const undocumentedCloses = closeCodes.filter((c) => !mentions(c));
if (undocumentedCloses.length > 0) {
  console.error(
    `check-error-codes: these close codes are in CLOSE_CODES and documented nowhere:\n  ${undocumentedCloses.join("\n  ")}`,
  );
  status = 1;
}

// The other direction. A close code this document describes and the platform cannot send
// is the same lie as a section for a retired error code — and it is the likelier of the
// two here, because a renumber leaves the prose behind.
const described = [
  ...[...markdown.matchAll(/clos(?:e|es|ing)\s+(4\d{3})\b/g)].map((m) => m[1]),
  ...[...markdown.matchAll(/^\|\s*(4\d{3})\s*\|/gm)].map((m) => m[1]),
];
const invented = [...new Set(described)].filter((c) => !closeCodes.includes(c));
if (invented.length > 0) {
  console.error(
    `check-error-codes: the reference describes close codes the platform cannot send:\n  ${invented.join("\n  ")}`,
  );
  status = 1;
}

if (status === 0) {
  console.log(
    `check-error-codes: ${codes.length} codes, ${codes.length} sections, each with a cause and a client action; ${closeCodes.length} close codes documented`,
  );
}
process.exit(status);
