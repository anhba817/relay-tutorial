"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import { t, type Locale } from "@/lib/i18n";

// The on-this-page rail (feature 012, FR-003): built from the rendered
// article's h2[id] elements after mount — identical machinery for chapters
// and reference documents, no per-page data plumbing. An IntersectionObserver
// tracks the section in view. Renders nothing with fewer than two sections.
// The layout persists across route changes, so the scan re-runs per pathname.

type Entry = { id: string; text: string };

export function OnThisPage({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const d = t(locale);

  useEffect(() => {
    let observer: IntersectionObserver | undefined;
    // Scan in a frame callback: the article is certainly painted, and state
    // updates happen in an async callback rather than the effect body (the
    // lint config forbids synchronous setState in effects).
    const frame = requestAnimationFrame(() => {
      setActive(null);
      const container = document.getElementById("reading-article");
      const headings = container
        ? Array.from(container.querySelectorAll<HTMLHeadingElement>("h2[id]"))
        : [];
      setEntries(headings.map((h) => ({ id: h.id, text: h.textContent ?? "" })));
      if (headings.length < 2) return;

      observer = new IntersectionObserver(
        (observed) => {
          const visible = observed.filter((o) => o.isIntersecting);
          if (visible.length > 0) setActive(visible[0].target.id);
        },
        // Consider a heading "current" while it sits in the top 30% of the
        // viewport — the reading position, not the scroll edge.
        { rootMargin: "0% 0% -70% 0%" },
      );
      headings.forEach((h) => observer?.observe(h));
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pathname]);

  if (entries.length < 2) return null;

  return (
    <nav aria-label={d.shell.onThisPage} className="text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {d.shell.onThisPage}
      </p>
      <ul className="flex flex-col gap-1 border-l border-border">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              className={
                active === entry.id
                  ? "-ml-px block border-l-2 border-primary pl-3 font-medium text-primary"
                  : "block pl-3 text-muted-foreground transition-colors hover:text-primary"
              }
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
