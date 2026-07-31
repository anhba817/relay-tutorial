// The single source of truth for the Building Relay series structure.
// The landing table of contents, ChapterHeader, and ChapterFooter all render
// exclusively from this manifest — series data lives nowhere else.
// Part and chapter titles follow docs/07-tutorial-plan.md §3 in the relay repo.
// Vietnamese fields (feature 004): titleVi/readerProducesVi are display strings with
// English fallback; translatedIn is the ONLY signal that a chapter BODY exists in a
// locale beyond en — fallback text never implies fallback content (FR-009).

import type { Locale } from "@/lib/i18n";

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
  /** Vietnamese display title (falls back to English when absent). */
  titleVi?: string;
  /** Vietnamese reader-artifact description (falls back to English). */
  readerProducesVi?: string;
  /** Locales beyond "en" the chapter BODY exists in. Gates all vi links. */
  translatedIn?: Locale[];
}

export interface Part {
  number: number;
  title: string;
  titleVi?: string;
  chapters: Chapter[];
}

export const seriesTitle = "Building Relay";

export const seriesPitch =
  "Build a real-time chat platform company from an empty directory — specs, code, deployment, and monitoring included.";

export const series: Part[] = [
  {
    number: 0,
    title: "The idea and the paper",
    titleVi: "Ý tưởng và trang giấy",
    chapters: [
      {
        id: "0.1",
        path: "/part-0/chapter-01/from-app-to-infrastructure",
        title: "From app to infrastructure — finding the real product",
        status: "published",
        readerProduces: "A positioning statement; a non-goals list",
        sourceDoc: "docs/01-product-vision.md",
        readerMinutes: 90,
        titleVi: "Từ ứng dụng đến hạ tầng — đi tìm sản phẩm đích thực",
        readerProducesVi: "Một bản tuyên ngôn định vị; một danh sách non-goals",
        translatedIn: ["vi"],
      },
      {
        id: "0.2",
        path: "/part-0/chapter-02/four-people-who-will-judge-us",
        title: "Four people who will judge us",
        status: "published",
        readerProduces: "A persona set including the invisible end user",
        sourceDoc: "docs/02-personas.md",
        readerMinutes: 75,
        titleVi: "Bốn người sẽ phán xét chúng ta",
        readerProducesVi: "Một bộ chân dung người dùng, bao gồm cả người dùng cuối vô hình",
        translatedIn: ["vi"],
      },
      {
        id: "0.3",
        path: "/part-0/chapter-03/journeys-where-products-die",
        title: "Journeys — where products die",
        status: "published",
        readerProduces: "Journey maps; the ★ moments",
        sourceDoc: "docs/03-journey-map.md",
        readerMinutes: 90,
        titleVi: "Hành trình — nơi những sản phẩm gục ngã",
        readerProducesVi: "Bản đồ hành trình; những khoảnh khắc ★",
        translatedIn: ["vi"],
      },
      {
        id: "0.4",
        path: "/part-0/chapter-04/requirements-you-can-test",
        title: "Requirements you can test",
        status: "published",
        readerProduces: "An SRS slice with IDs, priorities, verification methods",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Những yêu cầu bạn có thể kiểm chứng",
        readerProducesVi: "Một lát cắt SRS với đầy đủ ID, độ ưu tiên và phương pháp kiểm chứng",
        translatedIn: ["vi"],
      },
      {
        id: "0.5",
        path: "/part-0/chapter-05/deciding-out-loud",
        title: "Deciding out loud — the SAD and the ADR habit",
        status: "published",
        translatedIn: ["vi"],
        readerProduces: "A drivers table; two ADRs written from scratch",
        sourceDoc: "docs/05-sad.md, docs/06-adr-deep-dives.md",
        readerMinutes: 110,
        titleVi: "Quyết định trên giấy trắng mực đen — bản SAD và thói quen viết ADR",
        readerProducesVi: "Bảng động lực thiết kế (drivers); hai bản ADR viết từ con số không",
      },
    ],
  },
  {
    number: 1,
    title: "Foundations",
    titleVi: "Đặt nền móng",
    chapters: [
      {
        id: "1.1",
        path: "/part-1/chapter-01/the-monorepo-and-the-toolchain",
        title: "The monorepo and the toolchain",
        status: "published",
        translatedIn: ["vi"],
        readerProduces: "A running pnpm workspace — TypeScript, lint, and a passing test suite",
        sourceDoc: "docs/05-sad.md, docs/06-adr-deep-dives.md",
        readerMinutes: 90,
        titleVi: "Monorepo và bộ công cụ",
        readerProducesVi: "Một pnpm workspace chạy được — TypeScript, lint, và bộ test xanh",
      },
      {
        id: "1.2",
        path: "/part-1/chapter-02/one-command-whole-world",
        title: "One command, whole world",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "A one-command local infrastructure — four stores, healthchecked and verified",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 60,
        titleVi: "Một câu lệnh, cả thế giới",
        readerProducesVi:
          "Hạ tầng local một câu lệnh — bốn store, có healthcheck và đã kiểm chứng",
      },
      {
        id: "1.3",
        path: "/part-1/chapter-03/the-protocol-package",
        title: "The protocol package",
        status: "forthcoming",
        readerProduces: "The @relay/protocol package — frame types, error codes, schemas",
        sourceDoc: "docs/05-sad.md, docs/06-adr-deep-dives.md",
        readerMinutes: 90,
        titleVi: "Package protocol",
      },
      {
        id: "1.4",
        path: "/part-1/chapter-04/walking-skeleton",
        title: "Walking skeleton",
        status: "forthcoming",
        readerProduces: "API + gateway skeletons with health checks, request IDs, structured logs",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 100,
        titleVi: "Bộ khung biết đi",
      },
    ],
  },
  { number: 2, title: "The core loop", titleVi: "Vòng lặp cốt lõi", chapters: [] },
  { number: 3, title: "Becoming a platform", titleVi: "Vươn mình thành nền tảng", chapters: [] },
  { number: 4, title: "The second data path", titleVi: "Con đường dữ liệu thứ hai", chapters: [] },
  { number: 5, title: "Developer experience", titleVi: "Trải nghiệm lập trình viên", chapters: [] },
  { number: 6, title: "Shipping it", titleVi: "Ship sản phẩm", chapters: [] },
  { number: 7, title: "Running it", titleVi: "Vận hành", chapters: [] },
  { number: 8, title: "The retrospective", titleVi: "Nhìn lại chặng đường", chapters: [] },
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

export function chapterTitle(chapter: Chapter, locale: Locale): string {
  return locale === "vi" && chapter.titleVi ? chapter.titleVi : chapter.title;
}

export function chapterReaderProduces(chapter: Chapter, locale: Locale): string {
  return locale === "vi" && chapter.readerProducesVi
    ? chapter.readerProducesVi
    : chapter.readerProduces;
}

export function partTitle(part: Part, locale: Locale): string {
  return locale === "vi" && part.titleVi ? part.titleVi : part.title;
}

/** Whether the chapter BODY exists in the locale (en always does). */
export function hasBody(chapter: Chapter, locale: Locale): boolean {
  return locale === "en" || (chapter.translatedIn ?? []).includes(locale);
}
