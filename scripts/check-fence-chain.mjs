// Verify the fence chain: every titled code fence in every published chapter,
// replayed in order, must land exactly on the canonical repository.
//
// A path's fences form a chain. A plain fence states the whole file at that
// chapter's state; a diff fence amends it. Diffs are HUNKED (@@ headers, a few
// lines of context), so the chain is replayed by APPLYING hunks — never by
// reading a diff's strip-'-' as a whole file. That distinction is not
// pedantic: getting it wrong is what once put a bogus `-@ -351,6 +351,60 @@`
// line into a published chapter, and a checker that compares a fence against
// the same bad reconstruction it was built from proves nothing.
//
// Three properties, each failing loudly:
//
//   1. APPLY    — every hunk's pre-image appears in the predecessor state
//                 exactly once. Zero means the diff was written against
//                 something else; more than one means the context is too thin
//                 to be a proof.
//   2. HEAD     — the state after the last fence equals the file on disk.
//   3. MIRROR   — each Vietnamese fence is byte-identical to the English fence
//                 with the same title in the same chapter (docs/07 §2).
//                 Chapters not yet translated are simply skipped.
//
// A fourth kind of fence exists outside the chapters entirely. Some changes to
// fenced files are made by work that publishes no chapter — tooling, CI, a
// dependency the series does not teach. Putting those into the last chapter that
// happened to fence the file would make that chapter show a reader code it never
// discusses. They live in `fences/post-series.md` instead, are applied AFTER the
// last chapter, and are checked exactly as strictly. The chain stays byte-exact;
// no chapter is made to lie.
//
// Usage: node scripts/check-fence-chain.mjs [--verbose]

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLATFORM = join(APP_ROOT, "..", "relay-platform");
const VERBOSE = process.argv.includes("--verbose");

/** Titles that name no real file — prose illustrations, not fences. */
const NOT_A_FILE = (title) =>
  title.includes("(excerpt)") || title.includes(".naive.");

/** A chapter that DELETES a file says so with a `(deleted)` title, and the
 * fence body is the reason. The chain then ends for that path, and the check
 * inverts: the file must NOT exist on disk. Added in chapter 3.2, which is the
 * first chapter to retire a file rather than amend one — before it, a deleted
 * path could only ever be reported as "does not exist", which is the same
 * message a genuine mistake produces. */
const DELETION = /^(.+) \(deleted\)$/;

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Published chapter pages for a locale, in chapter order. */
function pages(locale) {
  const root = join(APP_ROOT, locale === "en" ? "app/(en)" : "app/(vi)/vi");
  return walk(root)
    .filter((p) => p.endsWith("page.mdx") && /part-\d+\/chapter-\d+\//.test(p))
    .map((p) => {
      const [, part, chapter] = p.match(/part-(\d+)\/chapter-(\d+)\//);
      return { path: p, key: `${part}.${chapter}`, order: +part * 1000 + +chapter };
    })
    .sort((a, b) => a.order - b.order);
}

function fencesIn(page) {
  const lines = readFileSync(page, "utf8").split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^```(\w+) title="([^"]+)"\s*$/.exec(lines[i]);
    if (!m) continue;
    const [, lang, title] = m;
    const start = i + 2;
    const body = [];
    i++;
    while (i < lines.length && lines[i] !== "```") body.push(lines[i++]);
    out.push({ lang, title, body, line: start, closed: i < lines.length });
  }
  return out;
}

function fileLines(path) {
  const full = join(PLATFORM, path);
  if (!existsSync(full)) return null;
  const lines = readFileSync(full, "utf8").split("\n");
  return lines.at(-1) === "" ? lines.slice(0, -1) : lines;
}

/** Split a diff body into hunks. Content before the first @@ counts as one:
 * the series has fences authored that way (2.4's repository.ts). */
function hunks(body) {
  const groups = [];
  let cur = [];
  for (const line of body) {
    if (line.startsWith("@@")) {
      if (cur.length) groups.push(cur);
      cur = [];
    } else cur.push(line);
  }
  if (cur.length) groups.push(cur);
  const strip = (l) => (" +-".includes(l[0] ?? " ") ? l.slice(1) : l);
  return groups
    .map((g) => ({
      pre: g.filter((l) => !l.startsWith("+")).map(strip),
      post: g.filter((l) => !l.startsWith("-")).map(strip),
    }))
    .filter((h) => h.pre.join("\n") !== h.post.join("\n"));
}

function applyHunks(state, body, where, problems) {
  let text = state.join("\n");
  for (const { pre, post } of hunks(body)) {
    const p = pre.join("\n");
    const found = text.split(p).length - 1;
    if (found !== 1) {
      const head = pre.find((l) => l.trim()) ?? "";
      problems.push({
        kind: "APPLY",
        where,
        detail:
          `hunk pre-image matched ${found} times (need exactly 1) — ` +
          `starts ${JSON.stringify(head.slice(0, 70))}`,
      });
      return null;
    }
    text = text.replace(p, post.join("\n"));
  }
  return text.split("\n");
}

function replay(locale, problems) {
  const state = new Map();
  const source = new Map();
  const deleted = new Map();
  const perChapter = new Map();
  for (const page of pages(locale)) {
    const rel = relative(APP_ROOT, page.path);
    const list = [];
    for (const f of fencesIn(page.path)) {
      const where = `${rel}:${f.line}`;
      if (!f.closed) {
        problems.push({ kind: "SYNTAX", where, detail: `fence for ${f.title} is never closed` });
        continue;
      }
      if (f.body.at(-1)?.endsWith("```")) {
        problems.push({
          kind: "SYNTAX",
          where,
          detail: `closing \`\`\` is glued to the last line of ${f.title}`,
        });
      }
      list.push(f);
      if (NOT_A_FILE(f.title)) continue;
      const gone = DELETION.exec(f.title);
      if (gone) {
        const path = gone[1];
        if (!state.has(path)) {
          problems.push({
            kind: "APPLY",
            where,
            detail: `${path} is retired here but no earlier chapter ever showed it`,
          });
          continue;
        }
        state.delete(path);
        source.delete(path);
        deleted.set(path, where);
        continue;
      }
      if (f.lang === "diff") {
        if (!state.has(f.title)) {
          problems.push({
            kind: "APPLY",
            where,
            detail: `diff for ${f.title} with no earlier fence to amend`,
          });
          continue;
        }
        const next = applyHunks(state.get(f.title), f.body, where, problems);
        if (next) state.set(f.title, next);
      } else {
        state.set(f.title, [...f.body]);
      }
      source.set(f.title, where);
    }
    perChapter.set(page.key, { rel, fences: list });
  }
  return { state, source, deleted, perChapter };
}

const problems = [];
if (!existsSync(PLATFORM)) {
  console.error("check-fence-chain: relay-platform not found — skipping");
  process.exit(0);
}

const en = replay("en", problems);

// POST-SERIES: amendments no chapter teaches, applied after the last chapter.
const POST_SERIES = join(APP_ROOT, "fences", "post-series.md");
if (existsSync(POST_SERIES)) {
  for (const f of fencesIn(POST_SERIES)) {
    const where = `fences/post-series.md:${f.line}`;
    if (NOT_A_FILE(f.title)) continue;
    if (f.lang !== "diff") {
      problems.push({
        kind: "APPLY",
        where,
        detail: `${f.title} must be a diff — a post-series fence amends, it never restates`,
      });
      continue;
    }
    if (!en.state.has(f.title)) {
      problems.push({
        kind: "APPLY",
        where,
        detail: `${f.title} is amended here but no chapter ever showed it`,
      });
      continue;
    }
    const next = applyHunks(en.state.get(f.title), f.body, where, problems);
    if (next) {
      en.state.set(f.title, next);
      en.source.set(f.title, where);
    }
  }
}

// HEAD: the chain's end state must be the repository, byte for byte.
for (const [title, final] of en.state) {
  const disk = fileLines(title);
  const where = en.source.get(title);
  if (disk === null) {
    problems.push({ kind: "HEAD", where, detail: `${title} does not exist in relay-platform` });
    continue;
  }
  if (final.join("\n") !== disk.join("\n")) {
    const n = final.findIndex((l, i) => l !== disk[i]);
    problems.push({
      kind: "HEAD",
      where,
      detail:
        `${title} differs at line ${n + 1}\n        chapters: ` +
        `${JSON.stringify((final[n] ?? "<eof>").slice(0, 64))}\n        repo:     ` +
        `${JSON.stringify((disk[n] ?? "<eof>").slice(0, 64))}`,
    });
  }
}

// The inverse of HEAD: a path a chapter retired must be gone from the
// repository. A deletion that did not happen is exactly as much drift as an
// amendment that did not.
for (const [title, where] of en.deleted) {
  if (fileLines(title) !== null) {
    problems.push({
      kind: "HEAD",
      where,
      detail: `${title} is shown as deleted but still exists in relay-platform`,
    });
  }
}

// MIRROR: translated chapters carry identical code fences (docs/07 §2).
const vi = replay("vi", problems);
for (const [key, chapter] of vi.perChapter) {
  const source = en.perChapter.get(key);
  if (!source) {
    problems.push({ kind: "MIRROR", where: chapter.rel, detail: `no English chapter ${key}` });
    continue;
  }
  const titles = (c) => c.fences.map((f) => `${f.lang} ${f.title}`).join("\n");
  if (titles(chapter) !== titles(source)) {
    problems.push({
      kind: "MIRROR",
      where: chapter.rel,
      detail: `fence list differs from ${source.rel}`,
    });
    continue;
  }
  chapter.fences.forEach((f, i) => {
    const other = source.fences[i];
    if (f.body.join("\n") !== other.body.join("\n")) {
      problems.push({
        kind: "MIRROR",
        where: `${chapter.rel}:${f.line}`,
        detail: `${f.title} is not byte-identical to ${source.rel}:${other.line}`,
      });
    }
  });
}

const counts = problems.reduce((a, p) => ({ ...a, [p.kind]: (a[p.kind] ?? 0) + 1 }), {});
if (problems.length) {
  for (const p of problems) {
    console.error(`[${p.kind}] ${p.where}\n        ${p.detail}`);
  }
  console.error(
    `\ncheck-fence-chain: ${problems.length} problem(s) — ` +
      Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "),
  );
  process.exit(1);
}

const translated = [...vi.perChapter.keys()].length;
console.log(
  `check-fence-chain: ${en.state.size} fenced files replay onto relay-platform ` +
    `across ${en.perChapter.size} chapters (${translated} translated, fences mirrored` +
    `${en.deleted.size ? `, ${en.deleted.size} retired` : ""}` +
    `${existsSync(POST_SERIES) ? ", plus post-series amendments" : ""})`,
);
if (VERBOSE) {
  for (const [title, where] of [...en.source].sort()) {
    console.log(`  ${title}\n      last fenced at ${where}`);
  }
}
