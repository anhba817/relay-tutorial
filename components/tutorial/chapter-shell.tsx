import Link from "next/link";
import { docsForSourceDoc } from "@/lib/docs";
import { localePath, t, type Locale } from "@/lib/i18n";
import { chapterArticleJsonLd, chapterUrl, ogLocale } from "@/lib/seo";
import {
  chapterReaderProduces,
  chapterTitle,
  getChapter,
  hasBody,
  nextChapter,
  partOf,
  partTitle,
  prevChapter,
  seriesTitle,
  type Chapter,
} from "@/lib/tutorial";

// ChapterHeader and ChapterFooter render exclusively from the series manifest
// (lib/tutorial.ts) and the locale dictionary (lib/i18n.ts). A chapter page
// passes only its id and, for translations, its locale.

export function ChapterHeader({
  id,
  locale = "en",
}: {
  id: string;
  locale?: Locale;
}) {
  const chapter = getChapter(id);
  const part = partOf(id);
  const d = t(locale);
  // Social-preview tags for the battery-frozen chapter files, hoisted into
  // <head> by React (feature 010, research R3). Titles and descriptions are NOT
  // emitted here — the metadata API fills og:/twitter: title and description
  // from each page's own metadata (verified fallback once a layout-level
  // openGraph exists). The shell adds only what the API cannot know for these
  // files: url, type, locale. og:image is owned by the opengraph-image files.
  return (
    <>
      <meta property="og:url" content={chapterUrl(chapter, locale)} />
      <meta property="og:type" content="article" />
      <meta property="og:locale" content={ogLocale(locale)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(chapterArticleJsonLd(chapter, locale)),
        }}
      />
      <header className="not-prose mb-10 border-b border-border pb-8">
      <nav className="mb-6 text-sm">
        <Link
          href={localePath(locale, "/")}
          className="text-muted-foreground hover:text-primary"
        >
          {seriesTitle}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-muted-foreground">
          {d.shell.part} {part.number} — {partTitle(part, locale)}
        </span>
      </nav>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        {d.shell.part} {part.number} · {d.shell.chapter} {chapter.id}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {chapterTitle(chapter, locale)}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        {d.shell.youWillProduce}: {chapterReaderProduces(chapter, locale)} ·{" "}
        {d.shell.minutesNote(chapter.readerMinutes)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {d.shell.sourceDocs}:{" "}
        {docsForSourceDoc(chapter.sourceDoc).map(({ doc, label }, i) => (
          <span key={label}>
            {i > 0 && " · "}
            {doc ? (
              <Link
                href={localePath(locale, `/docs/${doc.slug}`)}
                className="text-primary hover:underline"
              >
                {locale === "vi" ? doc.titleVi : doc.title}
              </Link>
            ) : (
              // Unresolvable sourceDoc: plain text, never a dead link.
              <span>{label}</span>
            )}
          </span>
        ))}
        {locale === "vi" && <span> ({d.badges.englishDoc})</span>}
      </p>
    </header>
    </>
  );
}

function FooterCard({
  chapter,
  direction,
  locale,
}: {
  chapter: Chapter;
  direction: "previous" | "next";
  locale: Locale;
}) {
  const d = t(locale);
  const linkable = chapter.status === "published" && hasBody(chapter, locale);
  // A published chapter without a body in this locale is "English only";
  // an unpublished one is "forthcoming" (FR-009 — never a dead link).
  const badge =
    chapter.status === "forthcoming"
      ? d.badges.forthcoming
      : linkable
        ? null
        : d.badges.englishOnly;

  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {direction === "previous" ? d.shell.previous : d.shell.next} ·{" "}
        {d.shell.chapter} {chapter.id}
        {badge && (
          <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 normal-case tracking-normal">
            {badge}
          </span>
        )}
      </p>
      <p className="mt-1 text-sm font-medium">{chapterTitle(chapter, locale)}</p>
    </>
  );

  if (linkable) {
    return (
      <Link
        href={localePath(locale, chapter.path)}
        className="block rounded-lg border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="block rounded-lg border border-dashed border-border bg-muted/50 p-4 text-muted-foreground">
      {inner}
    </div>
  );
}

export function ChapterFooter({
  id,
  locale = "en",
}: {
  id: string;
  locale?: Locale;
}) {
  const prev = prevChapter(id);
  const next = nextChapter(id);
  const d = t(locale);

  return (
    <footer className="not-prose mt-12 border-t border-border pt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          {prev && <FooterCard chapter={prev} direction="previous" locale={locale} />}
        </div>
        <div>
          {next && <FooterCard chapter={next} direction="next" locale={locale} />}
        </div>
      </div>
      <p className="mt-6 text-sm">
        <Link
          href={localePath(locale, "/")}
          className="text-primary hover:underline"
        >
          {d.shell.backToContents}
        </Link>
      </p>
    </footer>
  );
}
