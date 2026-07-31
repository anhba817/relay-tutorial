import Link from "next/link";
import { LocaleHint } from "@/components/locale-hint";
import { localePath, t, type Locale } from "@/lib/i18n";
import {
  chapterReaderProduces,
  chapterTitle,
  hasBody,
  partTitle,
  series,
} from "@/lib/tutorial";

// The series landing / table of contents, one implementation for both locales
// (feature 004, research R6). Chapter links gate on hasBody: a chapter is only
// a link in a locale whose body exists — otherwise it shows the appropriate
// badge (forthcoming / English only), never a dead link (FR-009).
export function Landing({ locale }: { locale: Locale }) {
  const d = t(locale);
  // Parts promote themselves from the road-ahead list to a full chapter
  // section the moment the manifest gives them chapters — the landing stays
  // manifest-generic like every other navigation surface (feature 013).
  const partsWithChapters = series.filter((part) => part.chapters.length > 0);
  const laterParts = series.filter((part) => part.chapters.length === 0);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <LocaleHint locale={locale} />
        <header className="mb-12">
          <span className="rounded-full border border-border bg-card px-4 py-1 text-sm text-muted-foreground">
            {d.landing.badge}
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
            Building <span className="text-primary">Relay</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {d.landing.pitch}
          </p>
        </header>

        {partsWithChapters.map((part) => (
        <section
          key={part.number}
          aria-labelledby={`part-${part.number}-heading`}
          className="mb-12"
        >
          <h2
            id={`part-${part.number}-heading`}
            className="text-xs font-semibold uppercase tracking-widest text-primary"
          >
            {d.shell.part} {part.number} — {partTitle(part, locale)}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {part.chapters.map((chapter) => {
              const linkable =
                chapter.status === "published" && hasBody(chapter, locale);
              const badge =
                chapter.status === "forthcoming"
                  ? d.badges.forthcoming
                  : linkable
                    ? null
                    : d.badges.englishOnly;

              return (
                <li key={chapter.id}>
                  {linkable ? (
                    <Link
                      href={localePath(locale, chapter.path)}
                      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
                    >
                      <p className="text-sm font-medium text-card-foreground">
                        <span className="text-primary">{chapter.id}</span> ·{" "}
                        {chapterTitle(chapter, locale)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {d.landing.youWillProduce}:{" "}
                        {chapterReaderProduces(chapter, locale)}
                      </p>
                    </Link>
                  ) : (
                    <div className="block rounded-lg border border-dashed border-border bg-muted/50 p-4">
                      <p className="text-sm font-medium text-muted-foreground">
                        {chapter.id} · {chapterTitle(chapter, locale)}
                        <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                          {badge}
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {d.landing.youWillProduce}:{" "}
                        {chapterReaderProduces(chapter, locale)}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
        ))}

        <section aria-labelledby="later-parts-heading">
          <h2
            id="later-parts-heading"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            {d.landing.roadAhead}
          </h2>
          <ol className="mt-4 flex flex-col gap-2">
            {laterParts.map((part) => (
              <li
                key={part.number}
                className="flex items-baseline gap-3 rounded-md border border-transparent px-1 py-1 text-sm text-muted-foreground"
              >
                <span className="font-mono text-xs">
                  {d.shell.part} {part.number}
                </span>
                <span>{partTitle(part, locale)}</span>
                <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                  {d.badges.forthcoming}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
