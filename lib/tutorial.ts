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
        readerProducesVi:
          "Một bộ chân dung người dùng, bao gồm cả người dùng cuối vô hình",
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
        readerProduces:
          "An SRS slice with IDs, priorities, verification methods",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Những yêu cầu bạn có thể kiểm chứng",
        readerProducesVi:
          "Một lát cắt SRS với đầy đủ ID, độ ưu tiên và phương pháp kiểm chứng",
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
        titleVi:
          "Quyết định trên giấy trắng mực đen — bản SAD và thói quen viết ADR",
        readerProducesVi:
          "Bảng động lực thiết kế (drivers); hai bản ADR viết từ con số không",
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
        readerProduces:
          "A running pnpm workspace — TypeScript, lint, and a passing test suite",
        sourceDoc: "docs/05-sad.md, docs/06-adr-deep-dives.md",
        readerMinutes: 90,
        titleVi: "Monorepo và bộ công cụ",
        readerProducesVi:
          "Một pnpm workspace chạy được — TypeScript, lint, và bộ test xanh",
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
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "The shared wire contract — frame types, error codes, and schemas that reject bad input",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 75,
        titleVi: "Package protocol",
        readerProducesVi:
          "Bản giao kèo đường truyền dùng chung — kiểu frame, mã lỗi, và schema biết từ chối dữ liệu hỏng",
      },
      {
        id: "1.4",
        path: "/part-1/chapter-04/walking-skeleton",
        title: "Walking skeleton",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "Two running skeleton services — health-checked, request-ID'd, logging structured JSON",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Bộ khung biết đi",
        readerProducesVi:
          "Hai service bộ khung chạy được — có health check, request ID, log JSON có cấu trúc",
      },
    ],
  },
  {
    number: 2,
    title: "The core loop",
    titleVi: "Vòng lặp cốt lõi",
    chapters: [
      {
        id: "2.1",
        path: "/part-2/chapter-01/schema-with-a-spine",
        title: "Schema with a spine",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "A migrated schema and a tenant-scoped repository layer — cross-tenant leaks made inexpressible",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Schema có xương sống",
        readerProducesVi:
          "Schema đã migrate và tầng repository khóa theo tenant — rò rỉ giữa các tenant thành điều không thể viết ra",
      },
      {
        id: "2.2",
        path: "/part-2/chapter-02/the-write-path",
        title: "The write path",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "POST message: channel row lock, sequence assignment (ADR-03)",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Quá trình gửi tin nhắn",
        readerProducesVi:
          "Gửi tin nhắn: channel row lock và sequence assignment (ADR-03)",
      },
      {
        id: "2.3",
        path: "/part-2/chapter-03/send-it-twice",
        title: "Send it twice",
        status: "published",
        translatedIn: ["vi"],
        readerProduces: "Idempotency keys, partial unique index (DR-03)",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 75,
        titleVi: "Gửi hai lần",
        readerProducesVi: "Idempotency keys, unique index một phần (DR-03)",
      },
      {
        id: "2.4",
        path: "/part-2/chapter-04/history-that-pages",
        title: "History that pages",
        status: "published",
        translatedIn: ["vi"],
        readerProduces: "Cursor pagination on (channel_id, seq)",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 75,
        titleVi: "Lịch sử biết phân trang",
        readerProducesVi: "Cursor pagination trên (channel_id, seq)",
      },
      {
        id: "2.5",
        path: "/part-2/chapter-05/the-socket",
        title: "The socket",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "Gateway: WS termination, JWT verify, connection registry",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Socket",
        readerProducesVi:
          "Gateway: WS termination, JWT verify, connection registry",
      },
      {
        id: "2.6",
        path: "/part-2/chapter-06/two-servers-one-conversation",
        title: "Two servers, one conversation",
        status: "published",
        translatedIn: ["vi"],
        readerProduces: "Redis fan-out (ADR-07); the lossy-fabric argument",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Hai server, một cuộc trò chuyện",
        readerProducesVi: "Redis fan-out (ADR-07); lập luận về fabric có thể mất frame",
      },
      {
        id: "2.7",
        path: "/part-2/chapter-07/the-tunnel",
        title: "The tunnel",
        status: "published",
        translatedIn: [],
        readerProduces:
          "Resume protocol: cursors, backfill, subscribe-before-backfill buffer",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 100,
        titleVi: "Đường hầm",
        readerProducesVi:
          "Resume protocol: cursor, backfill, buffer subscribe-trước-backfill",
      },
      {
        id: "2.8",
        path: "/part-2/chapter-08/milestone-the-tuan-test",
        title: "Milestone: the Tuan test",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "An integration suite scripting journey 4 end-to-end — the SRS Phase 1 exit criterion",
        sourceDoc: "docs/03-journey-map.md, docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Cột mốc: bài kiểm tra Tuan",
        readerProducesVi:
          "Suite e2e cho journey 4 — tiêu chí thoát Phase 1",
      },
    ],
  },
  {
    number: 3,
    title: "Becoming a platform",
    titleVi: "Vươn mình thành nền tảng",
    chapters: [
      {
        id: "3.1",
        path: "/part-3/chapter-01/tenants-all-the-way-down",
        title: "Tenants all the way down",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "Orgs, apps, environments; OAuth signup; the auto-created dev environment",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 95,
        titleVi: "Tenant từ trên xuống dưới",
        readerProducesVi:
          "Org, app, environment; signup bằng OAuth; environment dev tạo tự động",
      },
      {
        id: "3.2",
        path: "/part-3/chapter-02/keys-and-tokens",
        title: "Keys and tokens — two credentials, one mistake",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "API keys (prefix, hash, rotation); user JWTs; the dev-token endpoint",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Key và token — hai loại credential, một lỗi thường gặp",
        readerProducesVi:
          "API keys (prefix, hash, rotation); user JWTs; endpoint dev-token",
      },
      {
        id: "3.3",
        path: "/part-3/chapter-03/the-outbox",
        title: "The outbox",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "Transactional outbox + relay (ADR-06); the crash-in-the-gap test",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Outbox",
        readerProducesVi:
          "Transactional outbox + relay (ADR-06); crash-in-the-gap test",
      },
      {
        id: "3.4",
        path: "/part-3/chapter-04/jetstream-and-the-first-consumer",
        title: "JetStream and the first consumer",
        status: "published",
        translatedIn: ["vi"],
        readerProduces:
          "Stream config; shared subject grammar; a durable pull consumer that dedupes",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "JetStream và consumer đầu tiên",
        readerProducesVi:
          "Cấu hình stream; subject grammar dùng chung; durable pull consumer tự dedupe",
      },
      {
        id: "3.5",
        path: "/part-3/chapter-05/webhooks-that-survive-the-customer",
        title: "Webhooks that survive the customer",
        status: "published",
        translatedIn: ["vi"],
        // NOT auto-disable. FR-WHK-07 and FR-WHK-06's attempt log are deferred
        // to a later chapter, and a summary that promised them would be
        // advertising something the chapter does not build.
        readerProduces:
          "A dispatcher service: HMAC signing, a due-time retry schedule, dead letters",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Webhook sống sót qua phía khách hàng",
        readerProducesVi:
          "Một dispatcher service: ký HMAC, lịch retry theo thời điểm tới hạn, dead letter",
      },
      {
        id: "3.6",
        path: "/part-3/chapter-06/when-to-stop-trying",
        title: "When to stop trying",
        status: "published",
        translatedIn: ["vi"],
        // Split out of 3.5 while 3.5 was being written. Auto-disable needs the
        // attempt log to be defensible — switching off a paying customer's
        // endpoint is a decision somebody has to explain afterwards.
        readerProduces:
          "Attempt records on an analytics stream, and auto-disable from two triggers",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 80,
        titleVi: "Khi nào thì thôi cố",
        readerProducesVi:
          "Bản ghi lần thử trên stream analytics, và auto-disable từ hai trigger",
      },
      {
        id: "3.7",
        path: "/part-3/chapter-07/limits-and-quotas",
        title: "Limits and quotas",
        status: "forthcoming",
        readerProduces:
          "Redis token buckets; standard headers; spending caps",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 90,
        titleVi: "Giới hạn và quota",
      },
      {
        id: "3.8",
        path: "/part-3/chapter-08/milestone-the-isolation-gauntlet",
        title: "Milestone: the isolation gauntlet",
        status: "forthcoming",
        readerProduces:
          "The cross-tenant attack suite run against every endpoint",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 100,
        titleVi: "Cột mốc: cửa ải cô lập tenant",
      },
    ],
  },
  {
    number: 4,
    title: "The second data path",
    titleVi: "Con đường dữ liệu thứ hai",
    chapters: [],
  },
  {
    number: 5,
    title: "Developer experience",
    titleVi: "Trải nghiệm lập trình viên",
    chapters: [],
  },
  { number: 6, title: "Shipping it", titleVi: "Ship sản phẩm", chapters: [] },
  { number: 7, title: "Running it", titleVi: "Vận hành", chapters: [] },
  {
    number: 8,
    title: "The retrospective",
    titleVi: "Nhìn lại chặng đường",
    chapters: [],
  },
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

export function chapterReaderProduces(
  chapter: Chapter,
  locale: Locale,
): string {
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
