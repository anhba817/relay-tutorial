"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { docs } from "@/lib/docs";
import { localePath, t, type Locale } from "@/lib/i18n";
import { chapterTitle, partTitle, series } from "@/lib/tutorial";

// The series outline: a pure projection of the manifest + doc registry
// (feature 012, FR-001). Published chapters link; unpublished chapters and
// empty parts render as visible-but-unlinked structure — never a dead link.
// usePathname marks the current page. Client components server-render, so
// the outline is present in the served HTML.

const itemClass =
  "block rounded px-2 py-1 text-muted-foreground transition-colors hover:text-primary";
const currentClass =
  "block rounded px-2 py-1 bg-primary/10 font-medium text-primary";

export function SeriesSidebar({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const d = t(locale);

  return (
    <nav data-series-sidebar aria-label={d.shell.openNav} className="text-sm">
      {series.map((part) => (
        <div key={part.number} className="mb-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {d.shell.part} {part.number} — {partTitle(part, locale)}
          </p>
          {part.chapters.length > 0 ? (
            <ul className="flex flex-col gap-0.5">
              {part.chapters.map((chapter) => {
                if (chapter.status !== "published") {
                  return (
                    <li key={chapter.id}>
                      <span className="block px-2 py-1 text-muted-foreground/60">
                        {chapter.id} · {chapterTitle(chapter, locale)}{" "}
                        <span className="rounded-full border border-border bg-muted px-1.5 text-xs">
                          {d.badges.forthcoming}
                        </span>
                      </span>
                    </li>
                  );
                }
                const href = localePath(locale, chapter.path);
                const current = pathname === href;
                return (
                  <li key={chapter.id}>
                    <Link
                      href={href}
                      aria-current={current ? "page" : undefined}
                      className={current ? currentClass : itemClass}
                    >
                      {chapter.id} · {chapterTitle(chapter, locale)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-2 text-xs text-muted-foreground/60">
              {d.badges.forthcoming}
            </p>
          )}
        </div>
      ))}
      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {d.shell.referenceDocs}
        </p>
        <ul className="flex flex-col gap-0.5">
          {docs.map((doc) => {
            const href = localePath(locale, `/docs/${doc.slug}`);
            const current = pathname === href;
            return (
              <li key={doc.slug}>
                <Link
                  href={href}
                  aria-current={current ? "page" : undefined}
                  className={current ? currentClass : itemClass}
                >
                  {locale === "vi" ? doc.titleVi : doc.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
