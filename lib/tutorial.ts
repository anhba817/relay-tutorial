// The single source of truth for the Building Relay series structure.
// The landing table of contents, ChapterHeader, and ChapterFooter all render
// exclusively from this manifest — series data lives nowhere else.
// Part and chapter titles follow docs/07-tutorial-plan.md §3 in the relay repo.

export type ChapterStatus = "published" | "forthcoming";

export interface Chapter {
  /** docs/07 chapter number, e.g. "0.1" */
  id: string;
  /** Full route. Its final segment is the slug: kebab-case of the title's main clause. */
  path: string;
  title: string;
  status: ChapterStatus;
  /** What the reader produces by finishing the chapter. */
  readerProduces: string;
  /** The source document in the relay repo the chapter derives from. */
  sourceDoc: string;
  /** Estimated reading + exercise time in minutes (60–120 per docs/07 §2). */
  readerMinutes: number;
}

export interface Part {
  number: number;
  title: string;
  chapters: Chapter[];
}

export const seriesTitle = "Building Relay";

export const seriesPitch =
  "Build a real-time chat platform company from an empty directory — specs, code, deployment, and monitoring included.";

export const series: Part[] = [
  {
    number: 0,
    title: "The idea and the paper",
    chapters: [
      {
        id: "0.1",
        path: "/part-0/chapter-01/from-app-to-infrastructure",
        title: "From app to infrastructure — finding the real product",
        status: "published",
        readerProduces: "A positioning statement; a non-goals list",
        sourceDoc: "docs/01-product-vision.md",
        readerMinutes: 90,
      },
      {
        id: "0.2",
        path: "/part-0/chapter-02/four-people-who-will-judge-us",
        title: "Four people who will judge us",
        status: "forthcoming",
        readerProduces: "A persona set including the invisible end user",
        sourceDoc: "docs/02-personas.md",
        readerMinutes: 75,
      },
      {
        id: "0.3",
        path: "/part-0/chapter-03/journeys-where-products-die",
        title: "Journeys — where products die",
        status: "forthcoming",
        readerProduces: "Journey maps; the ★ moments",
        sourceDoc: "docs/03-journey-map.md",
        readerMinutes: 90,
      },
      {
        id: "0.4",
        path: "/part-0/chapter-04/requirements-you-can-test",
        title: "Requirements you can test",
        status: "forthcoming",
        readerProduces: "An SRS slice with IDs, priorities, verification methods",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
      },
      {
        id: "0.5",
        path: "/part-0/chapter-05/deciding-out-loud",
        title: "Deciding out loud — the SAD and the ADR habit",
        status: "forthcoming",
        readerProduces: "A drivers table; two ADRs written from scratch",
        sourceDoc: "docs/05-sad.md, docs/06-adr-deep-dives.md",
        readerMinutes: 110,
      },
    ],
  },
  { number: 1, title: "Foundations", chapters: [] },
  { number: 2, title: "The core loop", chapters: [] },
  { number: 3, title: "Becoming a platform", chapters: [] },
  { number: 4, title: "The second data path", chapters: [] },
  { number: 5, title: "Developer experience", chapters: [] },
  { number: 6, title: "Shipping it", chapters: [] },
  { number: 7, title: "Running it", chapters: [] },
  { number: 8, title: "The retrospective", chapters: [] },
];

const allChapters: Chapter[] = series.flatMap((part) => part.chapters);

export function getChapter(id: string): Chapter {
  const chapter = allChapters.find((c) => c.id === id);
  if (!chapter) {
    throw new Error(`Unknown chapter id: ${id}`);
  }
  return chapter;
}

export function partOf(id: string): Part {
  const part = series.find((p) => p.chapters.some((c) => c.id === id));
  if (!part) {
    throw new Error(`No part contains chapter id: ${id}`);
  }
  return part;
}

export function nextChapter(id: string): Chapter | null {
  const index = allChapters.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Unknown chapter id: ${id}`);
  }
  return allChapters[index + 1] ?? null;
}

export function prevChapter(id: string): Chapter | null {
  const index = allChapters.findIndex((c) => c.id === id);
  if (index === -1) {
    throw new Error(`Unknown chapter id: ${id}`);
  }
  return allChapters[index - 1] ?? null;
}
