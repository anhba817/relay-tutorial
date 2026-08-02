import { type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The docs/07 §6 rule 3 REVISED note (feature 019): when a later decision
// forces a change to a published chapter, the chapter says so — in public,
// under the header, naming the ADR that drove it.
//
// USAGE MUST BE A SINGLE LINE, all props inline:
//   <RevisionNote locale="vi" date="2026-08" adr="ADR-15" summary="..." />
// The chapter word-count battery skips only lines that START with `<`; a
// prettier-wrapped call would leak prop text into the canonical count.
// Keep `summary` short enough that one line stays readable.

const LEAD: Record<Locale, (date: string, adr: string) => string> = {
  en: (date, adr) => `Revised ${date} under ${adr}`,
  vi: (date, adr) => `Đã sửa đổi ${date} theo ${adr}`,
};

export function RevisionNote({
  locale = "en",
  date,
  adr,
  summary,
  className,
}: {
  locale?: Locale;
  /** Revision date, e.g. "2026-08". */
  date: string;
  /** The driving decision record, e.g. "ADR-15". */
  adr: string;
  /** One short sentence: what changed. Rendered after the lead-in. */
  summary: string;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "not-prose my-6 rounded-lg border border-primary/40 bg-primary/5 px-5 py-3 text-sm leading-6 text-foreground",
        className,
      )}
    >
      <p>
        <span className="font-semibold uppercase tracking-widest text-primary">
          {LEAD[locale](date, adr)}
        </span>
        {" — "}
        {summary}
      </p>
    </aside>
  );
}
