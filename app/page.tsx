import type { Metadata } from "next";
import Link from "next/link";
import { series, seriesPitch, seriesTitle } from "@/lib/tutorial";

export const metadata: Metadata = {
  title: "Building Relay — the tutorial series",
  description: seriesPitch,
};

export default function Home() {
  const partZero = series[0];
  const laterParts = series.slice(1);

  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16 font-sans">
      <main className="w-full max-w-3xl">
        <header className="mb-12">
          <span className="rounded-full border border-border bg-card px-4 py-1 text-sm text-muted-foreground">
            a written tutorial series
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">
            Building <span className="text-primary">Relay</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {seriesPitch}
          </p>
        </header>

        <section aria-labelledby="part-0-heading" className="mb-12">
          <h2
            id="part-0-heading"
            className="text-xs font-semibold uppercase tracking-widest text-primary"
          >
            Part {partZero.number} — {partZero.title}
          </h2>
          <ul className="mt-4 flex flex-col gap-3">
            {partZero.chapters.map((chapter) =>
              chapter.status === "published" ? (
                <li key={chapter.id}>
                  <Link
                    href={chapter.path}
                    className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
                  >
                    <p className="text-sm font-medium text-card-foreground">
                      <span className="text-primary">{chapter.id}</span> ·{" "}
                      {chapter.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You will produce: {chapter.readerProduces}
                    </p>
                  </Link>
                </li>
              ) : (
                <li key={chapter.id}>
                  <div className="block rounded-lg border border-dashed border-border bg-muted/50 p-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {chapter.id} · {chapter.title}
                      <span className="ml-2 rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                        forthcoming
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      You will produce: {chapter.readerProduces}
                    </p>
                  </div>
                </li>
              ),
            )}
          </ul>
        </section>

        <section aria-labelledby="later-parts-heading">
          <h2
            id="later-parts-heading"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            The road ahead
          </h2>
          <ol className="mt-4 flex flex-col gap-2">
            {laterParts.map((part) => (
              <li
                key={part.number}
                className="flex items-baseline gap-3 rounded-md border border-transparent px-1 py-1 text-sm text-muted-foreground"
              >
                <span className="font-mono text-xs">Part {part.number}</span>
                <span>{part.title}</span>
                <span className="ml-auto rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                  forthcoming
                </span>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
