#!/usr/bin/env node
// Fail loudly if the SRS revision history does not ascend by version.
// Skips (with a warning) when the parent repo is absent — e.g. a standalone clone,
// the same convention `check-docs-drift.sh` and `check-srs-ids.sh` follow.
//
// WHY THIS EXISTS (feature 043, FR-021). `docs/04-srs.md` Appendix D read
// 1.0, 1.1, 1.2, 1.3, 1.4, **1.7, 1.6, 1.5**: chapters 3.22, 3.23 and 3.24 each
// inserted their row ABOVE its predecessor rather than below it, three times in a
// row, and every one of those chapters ran its full gate list green. Nothing here
// reads a table's ordering, so the ledger a reader consults to learn what changed
// last told them 3.24, then 3.23, then 3.22.
//
// A LEDGER IS ORDERED OR IT IS A PILE. The document has no other way to say which
// revision is most recent — the dates do not separate 1.5 from 1.6, which share
// 2026-09-03. So the version column carries the whole claim, and this checks it.
//
// THE DATE COLUMN IS DELIBERATELY NOT CHECKED. Two revisions landing the same day is
// normal here and a date rule would fire on it. The requirement is the version
// column's ordering; a second rule nobody asked for is a second rule to exempt.
//
// AN UNRECOGNISED ROW IS A FAILURE, NOT A SKIP. `targets.ts` states the doctrine and
// `check-srs-ids.sh` learned it the expensive way: its first version matched a
// three-part identifier and silently skipped 192 of 243 rows, then printed a count
// that read as a complete answer. A row this script cannot parse is a row it cannot
// place, and it says so rather than stepping over it.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRS = join(APP_ROOT, "..", "docs", "04-srs.md");

if (!existsSync(SRS)) {
  console.error("check-revision-order: parent docs directory not found — skipping");
  process.exit(0);
}

const HEADING = "### Appendix D — Revision history";
const lines = readFileSync(SRS, "utf8").split("\n");

const start = lines.findIndex((l) => l.trim() === HEADING);
if (start === -1) {
  // Not "no table, nothing to check". The heading moving or being renamed is exactly
  // the change that would make this gate silently pass forever.
  console.error(
    `check-revision-order: FAIL — no "${HEADING}" heading in docs/04-srs.md.\n` +
      `  This gate reads that table. If the heading was renamed, rename it here too.`,
  );
  process.exit(1);
}

/** The rows, with their real line numbers so a failure is clickable. */
const rows = [];
let sawHeader = false;
let sawSeparator = false;
for (let i = start + 1; i < lines.length; i++) {
  const line = lines[i];
  const text = line.trim();
  if (text === "") continue;
  if (!text.startsWith("|")) break; // the table ended
  const cells = text.split("|").slice(1, -1).map((c) => c.trim());
  if (!sawHeader) {
    if (cells[0] !== "Version") {
      console.error(
        `check-revision-order: FAIL — docs/04-srs.md:${i + 1} is the first table row ` +
          `under the heading and its first column is "${cells[0]}", not "Version".`,
      );
      process.exit(1);
    }
    sawHeader = true;
    continue;
  }
  if (!sawSeparator) {
    sawSeparator = true; // the |---|---| rule
    continue;
  }
  rows.push({ version: cells[0], line: i + 1 });
}

if (rows.length === 0) {
  console.error("check-revision-order: FAIL — Appendix D's table has no revision rows.");
  process.exit(1);
}

// THE CLASS LIST, AND IT IS ONE SHAPE. Every version in this ledger is `major.minor`.
// A row that is not is not silently ordered by string comparison, which is how "1.10"
// sorts below "1.9" and nobody finds out.
const SHAPE = /^(\d+)\.(\d+)$/;
const problems = [];
const parsed = [];
for (const row of rows) {
  const m = SHAPE.exec(row.version);
  if (!m) {
    problems.push(
      `docs/04-srs.md:${row.line}: version "${row.version}" is not major.minor — ` +
        `this gate cannot order it`,
    );
    continue;
  }
  parsed.push({ ...row, major: Number(m[1]), minor: Number(m[2]) });
}

// EVERY DESCENT, NOT THE FIRST. `check-fence-chain`'s "3 problems" turned out to be
// three files rather than three lines, and a checker that stops at the first fault
// makes somebody run it once per fix.
for (let i = 1; i < parsed.length; i++) {
  const prev = parsed[i - 1];
  const cur = parsed[i];
  const ascends =
    cur.major > prev.major || (cur.major === prev.major && cur.minor > prev.minor);
  if (!ascends) {
    problems.push(
      `docs/04-srs.md:${cur.line}: version ${cur.version} follows ${prev.version} — ` +
        `the revision history must ascend, newest last`,
    );
  }
}

if (problems.length > 0) {
  console.error(`check-revision-order: FAIL — ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

console.error(
  `check-revision-order: ${parsed.length} revisions ascend, ` +
    `${parsed[0].version} to ${parsed[parsed.length - 1].version}`,
);
