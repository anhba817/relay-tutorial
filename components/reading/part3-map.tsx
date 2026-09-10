import Link from "next/link";

import map from "@/lib/part3-chapter-map.json";

// PART 3'S OLD NUMBERS, AND WHAT THEY MEAN NOW. Feature 045 regrouped Part 3 into
// eight contiguous movements and renumbered it from 24 chapters to 26. Every old
// address redirects (42 of them, both locales), so nothing 404s — but a redirect
// cannot tell a returning reader that "chapter 13" is no longer the chapter they
// remember, and that is the thing this page exists to say.
//
// THE COUNT THAT MATTERS IS 21, NOT 4. The task that specified this page said four
// numbers exist before and after while naming different chapters — 3.13 through
// 3.16. Derived from the map it is TWENTY-ONE of the twenty-six: only 1, 2 and 7
// still mean what they meant, and 25 and 26 are numbers Part 3 never had.
//
// The table is a projection of `lib/part3-chapter-map.json`, which is machine-written
// from `specs/045-part-3-rework/chapter-map.json` and compared to it by
// `check-movements.py`. Nothing here is maintained by hand.

type Chapter = (typeof map.chapters)[number];

function andList(ns: number[]): string {
  if (ns.length <= 1) return ns.join("");
  return `${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`;
}

const unchanged = map.chapters.filter((c) => c.new === c.old).map((c) => c.new);
const oldNumbers = new Set(map.chapters.map((c) => c.old));
const reused = map.chapters
  .filter((c) => c.new !== c.old && oldNumbers.has(c.new))
  .map((c) => c.new)
  .sort((a, b) => a - b);
const fresh = map.chapters.filter((c) => !oldNumbers.has(c.new)).map((c) => c.new);

function byMovement(): { id: string; title: string; chapters: Chapter[] }[] {
  return map.movements.map((m) => ({
    ...m,
    chapters: map.chapters.filter((c) => c.movement === m.id),
  }));
}

export function Part3Map({ locale }: { locale: "en" | "vi" }) {
  const prefix = locale === "vi" ? "/vi" : "";
  const splitOf = new Map<number, number[]>();
  for (const c of map.chapters) {
    splitOf.set(c.old, [...(splitOf.get(c.old) ?? []), c.new]);
  }

  return (
    <div className="prose prose-neutral max-w-none dark:prose-invert">
      <h1>Part 3 — what moved, and what the old numbers mean now</h1>

      <p>
        Part 3 was written as twenty-four chapters in the order the work happened. It now
        reads as <strong>twenty-six chapters in eight movements</strong>, each movement one
        subject, and the chapters inside a movement sit next to each other. Two chapters
        were split in half rather than compressed, which is where the two extra numbers
        come from.
      </p>

      <p>
        Every old address still works — the old URLs redirect permanently to the new ones,
        in both languages. <strong>The numbers are the part that changed meaning.</strong>{" "}
        {reused.length} of the {map.chapters.length} chapter numbers name a different
        chapter than they did before. Only {andList(unchanged)} still mean what they
        meant, and {andList(fresh)} are numbers Part 3 never had.
      </p>

      <h2>If you followed the previous Part 3</h2>

      <p>
        <strong>Recreate your development database before continuing.</strong> A migration
        belongs to the chapter that introduces it, and seven chapters moved — so seven
        migrations were renumbered and two were divided differently. The SQL is unchanged
        and no table differs; the <em>filenames</em> do, and a migration ledger records
        which filenames it has applied. A database migrated in the old order will be asked
        to apply nine migrations under new names and will refuse each one, saying the tables
        already exist. Nothing is wrong with that database — it simply cannot be upgraded
        into this ordering, so the reworked series starts its schema from scratch.
      </p>

      <h2>By movement</h2>
      {byMovement().map((m) => (
        <section key={m.id}>
          <h3>
            {m.id} — {m.title}
          </h3>
          <table>
            <thead>
              <tr>
                <th>Now</th>
                <th>Was</th>
                <th>Chapter</th>
              </tr>
            </thead>
            <tbody>
              {m.chapters.map((c) => {
                const halves = splitOf.get(c.old) ?? [];
                return (
                  <tr key={c.new}>
                    <td>{c.new}</td>
                    <td>
                      3.{c.old}
                      {halves.length > 1 ? " (half)" : ""}
                    </td>
                    <td>
                      <Link href={`${prefix}/part-3/chapter-${String(c.new).padStart(2, "0")}/${c.slug}`}>
                        {c.title}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <h2>Old number → new number</h2>
      <p>
        The reverse direction, for a link or a note that names a chapter by its old
        ordinal. Two old chapters appear twice, because each became two chapters.
      </p>
      <table>
        <thead>
          <tr>
            <th>Was</th>
            <th>Now</th>
            <th>Chapter</th>
          </tr>
        </thead>
        <tbody>
          {[...map.chapters]
            .sort((a, b) => a.old - b.old || a.new - b.new)
            .map((c) => (
              <tr key={`${c.old}-${c.new}`}>
                <td>3.{c.old}</td>
                <td>{c.new}</td>
                <td>
                  <Link href={`${prefix}/part-3/chapter-${String(c.new).padStart(2, "0")}/${c.slug}`}>
                    {c.title}
                  </Link>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
