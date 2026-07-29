import Link from "next/link";
import {
  getChapter,
  nextChapter,
  partOf,
  prevChapter,
  seriesTitle,
  type Chapter,
} from "@/lib/tutorial";

// ChapterHeader and ChapterFooter render exclusively from the series manifest
// (lib/tutorial.ts). A chapter page passes only its id.

export function ChapterHeader({ id }: { id: string }) {
  const chapter = getChapter(id);
  const part = partOf(id);

  return (
    <header className="not-prose mb-10 border-b border-border pb-8">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-muted-foreground hover:text-primary">
          {seriesTitle}
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        <span className="text-muted-foreground">
          Part {part.number} — {part.title}
        </span>
      </nav>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
        Part {part.number} · Chapter {chapter.id}
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        {chapter.title}
      </h1>
      <p className="mt-4 text-sm text-muted-foreground">
        You will produce: {chapter.readerProduces} · about {chapter.readerMinutes}{" "}
        minutes including the exercise
      </p>
    </header>
  );
}

function FooterCard({
  chapter,
  direction,
}: {
  chapter: Chapter;
  direction: "Previous" | "Next";
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {direction} · Chapter {chapter.id}
        {chapter.status === "forthcoming" && (
          <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 normal-case tracking-normal">
            forthcoming
          </span>
        )}
      </p>
      <p className="mt-1 text-sm font-medium">{chapter.title}</p>
    </>
  );

  if (chapter.status === "published") {
    return (
      <Link
        href={chapter.path}
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

export function ChapterFooter({ id }: { id: string }) {
  const prev = prevChapter(id);
  const next = nextChapter(id);

  return (
    <footer className="not-prose mt-12 border-t border-border pt-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>{prev && <FooterCard chapter={prev} direction="Previous" />}</div>
        <div>{next && <FooterCard chapter={next} direction="Next" />}</div>
      </div>
      <p className="mt-6 text-sm">
        <Link href="/" className="text-primary hover:underline">
          ← Back to the table of contents
        </Link>
      </p>
    </footer>
  );
}
