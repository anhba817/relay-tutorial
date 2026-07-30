import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";

import { DocArticle, extractOutline } from "@/components/docs/doc-article";
import { chaptersCiting, type DocEntry } from "@/lib/docs";
import { localePath, t, type Locale } from "@/lib/i18n";
import { chapterTitle, seriesTitle } from "@/lib/tutorial";

// Shared body for /docs/[slug] and /vi/docs/[slug]: chrome in the page's
// locale, article content always English (the documents are the project's
// canonical engineering artifacts).
export async function DocReferencePage({
  doc,
  locale,
}: {
  doc: DocEntry;
  locale: Locale;
}) {
  const d = t(locale);
  const markdown = await fs.readFile(
    path.join(process.cwd(), "content/docs", doc.file),
    "utf8",
  );
  const citing = chaptersCiting(doc.slug);
  const outline = extractOutline(markdown);

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="mb-10 border-b border-border pb-8">
          <nav className="mb-6 text-sm">
            <Link
              href={localePath(locale, "/")}
              className="text-muted-foreground hover:text-primary"
            >
              {seriesTitle}
            </Link>
            <span className="mx-2 text-muted-foreground">/</span>
            <span className="text-muted-foreground">
              {locale === "vi" ? doc.titleVi : doc.title}
            </span>
          </nav>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {locale === "vi" ? doc.titleVi : doc.title}
          </h1>
          {citing.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {d.shell.referencedBy}:{" "}
              {citing.map((chapter, i) => (
                <span key={chapter.id}>
                  {i > 0 && " · "}
                  <Link
                    href={localePath(locale, chapter.path)}
                    className="text-primary hover:underline"
                  >
                    {d.shell.chapter} {chapter.id} —{" "}
                    {chapterTitle(chapter, locale)}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {locale === "vi" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Tài liệu gốc — được giữ nguyên tiếng Anh.
            </p>
          )}
        </header>
        {outline.length > 0 && (
          <nav
            aria-label={d.shell.contents}
            className="mb-10 rounded-lg border border-border bg-card p-4"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
              {d.shell.contents}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {outline.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-primary"
                  >
                    {section.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <article lang={locale === "vi" ? "en" : undefined} className="prose max-w-none">
          <DocArticle markdown={markdown} />
        </article>
        <p className="mt-12 border-t border-border pt-8 text-sm">
          <Link
            href={localePath(locale, "/")}
            className="text-primary hover:underline"
          >
            {d.shell.backToContents}
          </Link>
        </p>
      </div>
    </div>
  );
}
