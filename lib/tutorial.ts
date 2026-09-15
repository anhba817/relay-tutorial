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
        translatedIn: ["vi"],
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
        path: "/part-3/chapter-03/errors-that-resolve",
        title: "Errors that resolve",
        status: "published",
        // Split out of the milestone on the boundary its own prose already had:
        // every fence above `## The outsider` is the error vocabulary and every
        // fence below it is the sealed package. 14 titled fences here, 7 there.
        readerProduces:
          "An error registry that declares every code the platform can send, one place that builds the docs_url, and a typed thrower so a mistyped code stops compiling",
        sourceDoc: "docs/04-srs.md, docs/08-error-reference.md",
        readerMinutes: 30,
        titleVi: "Lỗi có trang để xem",
        readerProducesVi:
          "Một registry khai báo mọi error code nền tảng có thể gửi, một chỗ duy nhất dựng docs_url, và một hàm ném lỗi có kiểu để code gõ sai không compile được",
        translatedIn: ["vi"],
      },
      {
        id: "3.4",
        path: "/part-3/chapter-04/the-isolation-harness",
        title: "The isolation harness",
        status: "published",
        // Divided out of the milestone because eight files it creates are edited by
        // 25 later chapter-edits, and the reorder put every one of them before the
        // file existed. The harness has to precede its editors; the verdict does not.
        readerProduces:
          "A cross-tenant suite whose target list derives itself from the running router, three attack shapes that compare a pair of responses rather than a status code, a structural check that every table has a path back to one tenant, and the socket attacked from the protocol's own frame union",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
        titleVi: "Cửa ải cô lập tenant",
        readerProducesVi:
          "Một bộ kiểm thử cross-tenant tự suy ra danh sách mục tiêu từ router đang chạy, ba dạng tấn công so sánh một CẶP phản hồi thay vì một mã trạng thái, một kiểm tra cấu trúc rằng mọi bảng đều có đường về tenant, và tầng socket bị tấn công từ chính frame union của protocol",
        translatedIn: ["vi"],
      },
      {
        id: "3.5",
        path: "/part-3/chapter-05/the-outbox",
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
        id: "3.6",
        path: "/part-3/chapter-06/jetstream-and-the-first-consumer",
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
        id: "3.7",
        path: "/part-3/chapter-07/commit-and-publish-are-two-instants",
        title: "Commit and publish are two instants",
        status: "published",
        translatedIn: ["vi"],
        // Inserted after 3.6 shipped. Chapter 2.7 is the chapter this series
        // calls its flagship bug and it did not close the race it is named for:
        // a message committed before a resuming client's backfill and announced
        // to the fabric after that resume completes is delivered twice. The
        // seam is 3.3's, 3.5's and 3.6's, in the one path built before the
        // reader had the concept.
        readerProduces:
          "The resume duplicate closed: a high-water mark that outlives the buffer",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 60,
        titleVi: "Commit và publish là hai khoảnh khắc",
        readerProducesVi:
          "Khép lại lỗi trùng lặp khi resume: một high-water mark sống lâu hơn buffer",
      },
      {
        id: "3.8",
        path: "/part-3/chapter-08/the-endpoints-and-the-instruments",
        title: "The endpoints and the instruments",
        status: "published",
        // Split out of 3.12 on a measurement, not a feeling: the two chapters'
        // surface came to 61 files against an estimate of 37, and the
        // 2,000-4,000 prose-word bound cannot hold that. This half is the two
        // public endpoints the gauntlet found missing, and the instruments that
        // verify the verifiers.
        readerProduces:
          "The two public endpoints Part 3 needed, idempotency enforced by a unique index rather than in memory, every validation error naming its field for the first time, the global-operation guard watching nine tables instead of five, and repository branch coverage answered with a number",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 80,
        titleVi: "Các endpoint và các thiết bị đo",
        readerProducesVi:
          "Hai endpoint công khai mà Part 3 cần, tính đẳng xâm do unique index bảo đảm chứ không phải do bộ nhớ, mọi lỗi validation lần đầu gọi tên field của nó, guard thao tác toàn cục canh chín bảng thay vì năm, và độ phủ nhánh của tầng repository được trả lời bằng một con số",
        translatedIn: ["vi"],
      },
      {
        id: "3.9",
        path: "/part-3/chapter-09/the-channel-a-customer-controls",
        title: "The channel a customer controls",
        status: "published",
        // Was going to be 3.13 until the split took that number, and the deferred
        // surface then split again on a file count taken before any prose existed:
        // 40 files across two chapters, 20 taught here. What mattered about the
        // promise was that the surface had a number, not which number.
        readerProduces:
          "A private channel type that decides something on all four of its doors, member removal and roles, archiving that refuses a send without announcing the channel exists, and a gauntlet that attacks your own tenant",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 85,
        titleVi: "Kênh mà khách hàng kiểm soát",
        readerProducesVi:
          "Một loại kênh private thực sự quyết định điều gì đó ở cả bốn cửa vào, xoá thành viên và phân quyền, lưu trữ kênh để từ chối gửi tin mà không tiết lộ kênh có tồn tại, và một gauntlet tấn công chính tenant của bạn",
        translatedIn: ["vi"],
      },
      {
        id: "3.10",
        path: "/part-3/chapter-10/what-a-user-sees",
        title: "What a user sees",
        status: "published",
        // The other half of the deferred surface. Its centre is a measurement that
        // pointed the wrong way: ordering a user's channels by their last message
        // costs 0.87 ms on the test lane and 159 ms at a million messages.
        readerProduces:
          "Channel listing with cursor pagination and activity ordering, unread counts from the sequence the write path already maintains, user profiles created implicitly on first authentication, a deleted user whose messages survive, and a ban enforced at the door and on the send path",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 95,
        titleVi: "Những gì một người dùng thấy",
        readerProducesVi:
          "Danh sách channel phân trang bằng cursor và xếp theo hoạt động, số tin chưa đọc suy ra từ chính sequence mà đường ghi vẫn duy trì, profile người dùng được tạo ngầm ở lần xác thực đầu tiên, một người dùng đã xoá mà tin nhắn vẫn còn, và một lệnh ban có hiệu lực cả ở cửa vào lẫn trên đường gửi",
        translatedIn: ["vi"],
      },
      {
        id: "3.11",
        path: "/part-3/chapter-11/the-sender-a-message-never-had",
        title: "The sender a message never had",
        status: "published",
        // The requirement was already in the SRS — FR-MSG-13, P2, since v1 — and
        // chapter 3.3 satisfied it by naming nobody, which was right when nothing
        // read the sender. Three chapters later a senderless row is one the platform
        // cannot describe, and 121,250 of them exist in the test lane.
        readerProduces:
          "Bot users carrying a description the database requires, a sender on every message enforced by the compiler rather than a test, a credential that speaks as software and never as a person, refusals that reveal nothing about who exists, and a bot billed as active yet exempt from the send ceiling",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 80,
        titleVi: "Người gửi mà một tin nhắn chưa từng có",
        readerProducesVi:
          "Bot user mang theo description mà cơ sở dữ liệu bắt buộc, một người gửi trên mọi tin nhắn do compiler bảo đảm chứ không phải test, một credential nói với danh nghĩa phần mềm, không phải con người, từ chối mà không hé lộ ai tồn tại, và một bot vẫn tính tiền như active user nhưng miễn trần gửi",
        translatedIn: ["vi"],
      },
      {
        id: "3.12",
        path: "/part-3/chapter-12/the-message-that-never-arrived",
        title: "The message that never arrived",
        status: "published",
        // The architecture drew this edge before the api existed — `05-sad.md`'s
        // component diagram has `api -- "publish fan-out" --> redis` — and its own
        // sequence diagram ten lines lower gives the publish to the gateway. Three
        // planning documents cited the first line as proof the design intended it and
        // none read as far as the second. `sourceDoc` is the SAD rather than the SRS
        // because no SRS clause changed: FR-RTM-01 already required this.
        readerProduces:
          "A message sent over REST that reaches a live socket, an ordering that splits by transport because a request handler's response IS its acknowledgement, a publisher that survives a dead broker in 2 ms, and a P1 clause measured as unmet and recorded rather than narrowed",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 70,
        titleVi: "Tin nhắn chưa từng tới",
        readerProducesVi:
          "Một tin nhắn gửi qua REST tới được socket đang mở, một thứ tự tách theo transport vì response của request handler CHÍNH LÀ acknowledgement của nó, một publisher sống sót qua broker đã chết trong 2 ms, và một điều khoản P1 được đo là chưa thoả rồi ghi lại thay vì bị thu hẹp",
        translatedIn: ["vi"],
      },
      {
        id: "3.13",
        path: "/part-3/chapter-13/who-is-allowed-to-see-it",
        title: "Presence, and who is allowed to see it",
        status: "published",
        // `sourceDoc` is the SAD rather than the SRS for chapter 3.18's reason: no
        // clause changed. FR-RTM-05, FR-RTM-06, FR-RTM-07 and FR-CHN-05's third verb
        // already required all of this. What changed is ADR-19, which supersedes
        // ADR-10's subject clause — the first supersession in the series — and
        // Appendix C's open question 3, closed as not opt-in.
        readerProduces:
          "A frame in the protocol union since chapter 1.3 that finally has a producer, a second subject grammar leaving the message hot path byte-identical, a key whose existence is the state and whose SET … NX is the election, a grace period whose first fix stranded users online, and no filtering code",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 70,
        titleVi: "Presence, và ai được phép nhìn thấy",
        readerProducesVi:
          "Một frame nằm trong protocol union từ chương 1.3 nay mới có bên phát, một subject grammar thứ hai giữ nguyên từng byte đường đi message, một key mà sự tồn tại chính là trạng thái, SET … NX chính là bầu chọn, một grace period mà bản vá đầu khiến người dùng kẹt online, và không dòng code lọc nào",
        // The ONLY signal that gates the Vietnamese URL in the sitemap. Chapters 3.10
        // to 3.18 each shipped a translated body without it, so nine Vietnamese pages
        // route and are absent from the sitemap — carried into `gaps.md` rather than
        // fixed here, because nine manifest entries are not this chapter's to change.
        translatedIn: ["vi"],
      },
      {
        id: "3.14",
        path: "/part-3/chapter-14/the-membership-that-changed",
        title: "The membership that changed under a live socket",
        status: "published",
        // `sourceDoc` is the SAD, and for a stronger reason than 3.18's and 3.19's:
        // no SRS clause changed — `git diff docs/04-srs.md` is empty — while ADR-20
        // is new. It extends ADR-07 rather than superseding it: that record permits
        // a lossy fabric because a dropped message is recovered by its cursor, and a
        // revocation has none.
        readerProduces:
          "A clause unmet since chapter 2.6, closed by inverting the test that caught it; a third subject grammar addressing a principal rather than a channel, because an addition cannot ride a subject its instance never subscribed to; and a ban that arrives as one change and leaves as one frame per channel",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 75,
        titleVi: "Membership đổi ngay dưới một socket đang sống",
        readerProducesVi:
          "Một điều khoản chưa thoả từ chương 2.6, nay đóng bằng cách đảo ngược bài test đã bắt nó; một ngữ pháp subject thứ ba gửi tới principal thay vì channel, bởi một lần thêm thành viên không thể đi nhờ subject mà instance chưa subscribe; và một lệnh ban tới như một thay đổi, ra một frame mỗi channel",
        translatedIn: ["vi"],
      },
      {
        id: "3.15",
        path: "/part-3/chapter-15/the-frame-nobody-may-send",
        title: "The frame nobody may send",
        status: "published",
        // `sourceDoc` is the SAD, and this chapter adds TWO records rather than
        // one: ADR-21 takes the fourth subject grammar, and ADR-22 says the
        // typing expiry belongs to the receiving client. The second exists
        // because FR-RTM-08 reads as a server obligation the platform cannot
        // keep, and the clause is the customer's contract — so the boundary is
        // recorded rather than the requirement rewritten.
        readerProduces:
          "The first second inbound frame in twenty chapters, behind a named set a test pins; a fourth subject grammar taken rather than avoided, after re-deriving ADR-19's count and finding seven typed points where the record says three; and an honest verdict on a clause this platform cannot perform",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 70,
        titleVi: "Cái frame không ai được gửi",
        readerProducesVi:
          "Frame đầu vào thứ hai đầu tiên sau hai mươi chương, đứng sau một tập hợp có tên được test ghim; một ngữ pháp subject thứ tư được nhận chứ không né, sau khi đếm lại con số ADR-19 và thấy bảy điểm định kiểu chứ không phải ba; và một phán quyết thành thật về điều khoản nền tảng không làm được",
        translatedIn: ["vi"],
      },
      {
        id: "3.16",
        path: "/part-3/chapter-16/the-sixth-connection",
        title: "The sixth connection, and where the count lives",
        status: "published",
        // `sourceDoc` is the SAD, and this chapter CONTRADICTS a row of it.
        // §6.3 has prescribed a sorted set pruned with `ZREMRANGEBYSCORE` since
        // the first draft; ADR-23 argues it down, because making the claim
        // atomic needs Lua and Constitution VII admits a second language only on
        // profiling evidence a five-channel fixture cannot produce.
        readerProduces:
          "FR-RTM-09 closed in both halves: a five-connection cap no gateway instance can compute alone, held as five slot keys claimed with `SET NX PX`; a sixth close code, the only refusal in the set whose correct handling is not a retry; and a cap that fails open loudly, the log line its only evidence",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 70,
        titleVi: "Kết nối thứ sáu, và con số ấy sống ở đâu",
        readerProducesVi:
          "FR-RTM-09 đóng lại ở cả hai nửa: một trần năm kết nối mà không instance gateway nào tự tính được, giữ thành năm khoá slot giành bằng `SET NX PX`; một mã đóng thứ sáu, lời từ chối duy nhất trong bộ mà xử lý đúng không phải thử lại; và một trần hỏng mở ồn ào, dòng log là bằng chứng duy nhất",
        translatedIn: ["vi"],
      },
      {
        id: "3.17",
        path: "/part-3/chapter-17/the-words-somebody-wants-back",
        title: "The words somebody wants back",
        status: "published",
        // `sourceDoc` is the SAD, and this chapter builds a table that document
        // has published since its first draft — three columns and a composite
        // key, reproduced rather than redesigned. It also amends two things in
        // that document that had stopped being true: §342's deletion diagram
        // named a route that does not exist and an INSERT into a table that
        // does not exist, and ADR-07's loss argument rests on gap detection,
        // which cannot see an edit below a client's cursor.
        readerProduces:
          "FR-MSG-07, FR-MSG-08 and FR-MSG-10 built, and FR-RTM-05's last two event kinds given their first producers: a fifth subject grammar carrying both mutations with the kind in the payload, because a tombstone is not a `Message` and an edit is; and two error codes rather than the generic 403",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 75,
        titleVi: "Những lời ai đó muốn lấy lại",
        readerProducesVi:
          "FR-MSG-07, FR-MSG-08 và FR-MSG-10 được dựng, và hai kind cuối của FR-RTM-05 lần đầu có bên phát: một ngữ pháp subject thứ năm mang cả hai loại thay đổi với kind nằm trong payload, bởi một bia mộ không phải `Message` còn một lần sửa thì là; và hai mã lỗi thay cho 403 chung chung",
        translatedIn: ["vi"],
      },
      {
        id: "3.18",
        path: "/part-3/chapter-18/the-message-that-is-not-only-text",
        title: "The message that is not only text",
        status: "published",
        // `sourceDoc` is the SAD, whose §6.1 declares `attachments JSONB` and
        // said nothing about it — the same omission chapter 3.23 filled for
        // `messages.metadata`, one column across in the same table. This chapter
        // fills it, and adds what each of the six read paths does with the
        // column, which is the form SC-006 asks for.
        readerProduces:
          "FR-MSG-11's external-URL half built: a message carries attachments, bounded at ten and 2,048 characters, refused unless the scheme is http or https. The media_id half is deferred to §4.14 and refused by name, with a code of its own.",
        sourceDoc: "docs/05-sad.md",
        readerMinutes: 70,
        titleVi: "Tin nhắn không chỉ có chữ",
        readerProducesVi:
          "Nửa external-URL của FR-MSG-11 được dựng: một tin nhắn mang attachment, giới hạn mười phần tử và 2.048 ký tự, bị từ chối trừ khi scheme là http hoặc https. Nửa media_id được hoãn tới §4.14 và bị từ chối đích danh, bằng một mã lỗi riêng.",
        translatedIn: ["vi"],
      },
      {
        id: "3.19",
        path: "/part-3/chapter-19/webhooks-that-survive-the-customer",
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
        id: "3.20",
        path: "/part-3/chapter-20/when-to-stop-trying",
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
        id: "3.21",
        path: "/part-3/chapter-21/the-email-nobody-was-sending",
        title: "The email nobody was sending",
        status: "published",
        translatedIn: ["vi"],
        // Split out of 3.8 at its size gate, with the number in hand: the
        // limiter half alone measured 4,700 prose words against a 2,000-4,000
        // bound, and the transport's prose would have taken the chapter past
        // anything the series has published. The CODE ships under `part3-ch8`
        // either way — this chapter explains it and fences it.
        readerProduces:
          "The outbox pattern a third time, over a column the \"When to stop trying\" chapter already wrote — and Mailpit, because only a received message can prove an email carries no secret",
        sourceDoc: "docs/04-srs.md, docs/03-journey-map.md",
        readerMinutes: 60,
        titleVi: "Email chẳng ai gửi",
        readerProducesVi:
          "Mẫu outbox lần thứ ba, trên một cột mà chương \"Khi nào thì thôi cố\" đã viết sẵn — và Mailpit, vì chỉ thư đã nhận mới chứng minh được email không mang bí mật nào",
      },
      {
        id: "3.22",
        path: "/part-3/chapter-22/limits-you-can-see-coming",
        title: "Limits you can see coming",
        status: "published",
        translatedIn: ["vi"],
        // Split from the original "Limits and quotas" entry. A rate limit is
        // ephemeral and may be lost, so Redis is the right store and failing open
        // is the right default; a quota is money and must be durable. One chapter
        // teaching both would teach one storage decision as though it covered
        // both. Quotas also need metering that arrives with Part 4.
        readerProduces:
          "Per-environment request counters, the headers on every response, and two limiters that fail in opposite directions",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 90,
        titleVi: "Những giới hạn bạn thấy trước",
        readerProducesVi:
          "Bộ đếm request theo từng environment, các header trên mọi response, và hai bộ giới hạn hỏng theo hai hướng ngược nhau",
      },
      {
        id: "3.23",
        path: "/part-3/chapter-23/quotas-and-what-they-cost",
        title: "Quotas and what they cost",
        status: "published",
        translatedIn: ["vi"],
        // The half of FR-RTL that is money rather than traffic: monthly usage
        // quotas, the hard cap that suspends and the soft threshold that only
        // alerts, and the 50/80/100% email. FR-RTL-06 is a purchasing
        // requirement, not a technical one — unbounded cost exposure is David's
        // principal objection at the diligence phase.
        readerProduces:
          "Monthly quotas, spending caps, and degradation that rejects sends without touching history",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 90,
        titleVi: "Quota và cái giá của nó",
        readerProducesVi:
          "Quota theo tháng, hạn mức chi tiêu, và cách suy giảm chỉ chặn gửi mà không ảnh hưởng history",
      },
      {
        id: "3.24",
        path: "/part-3/chapter-24/counting-a-connection",
        title: "Counting a connection",
        status: "published",
        translatedIn: ["vi"],
        // The third dimension FR-RTL-05 names, and the only one the api cannot
        // compute from its own tables. Messages and active users are already
        // rows; a connection-minute is a duration nothing records, so the
        // gateway has to account for it periodically — and the gateway owns no
        // tables. Split out of 3.10 rather than deferred vaguely: 3.10 covers
        // the two dimensions that need no new writer, this one covers the
        // dimension that needs one.
        readerProduces:
          "Connection-minutes metered from a service that owns no tables, a crash that under-bills by a bounded amount rather than over-billing for ever, and close code 4008 emitted for the first time since chapter 1.3 declared it",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 90,
        titleVi: "Đếm một kết nối",
        readerProducesVi:
          "Connection-minutes được đo từ một service không sở hữu bảng nào, một cú crash tính thiếu trong một giới hạn đã biết thay vì tính thừa mãi mãi, và close code 4008 lần đầu được gửi kể từ khi chương 1.3 khai báo nó",
      },
      {
        id: "3.25",
        path: "/part-3/chapter-25/milestone-the-isolation-gauntlet",
        title: "Milestone: the isolation gauntlet",
        status: "published",
        // The suite constitution I has required since it was written. What the
        // repository had instead was eleven assertions in eight files and nothing
        // that knew which endpoints had been attacked and which had merely never
        // been thought about.
        //
        // `readerMinutes` came down from 100. That figure was set when this
        // chapter was planned to carry two public endpoints, thirteen error codes
        // and a sealed integration as well; the surface measured 61 files against
        // an estimate of 37 and split three ways. 80 for 3,381 prose words and 19
        // fenced files, measured against 3.11's 100 for 3,316 words and 21.
        readerProduces:
          "Three deliberate reintroductions — one of which stayed green and taught the suite's range — and tests for the instruments that had never produced output",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 13,
        titleVi: "Cột mốc: cửa ải cô lập tenant",
        readerProducesVi:
          "Ba lần cố ý tái tạo lỗi — một lần vẫn xanh và dạy ta giới hạn của bộ kiểm thử",
        translatedIn: ["vi"],
      },
      {
        id: "3.26",
        path: "/part-3/chapter-26/errors-that-resolve-and-an-outsider",
        title: "Milestone: an outsider integrates",
        status: "published",
        // The milestone name lives here rather than on the gauntlet, because the
        // Phase 2 exit criterion is what this chapter gives a verdict on. The slug
        // keeps both halves' names because it is a published URL.
        readerProduces:
          "A sealed integration package mechanically unable to import workspace code, and a verdict on the SRS Phase 2 exit criterion with what was measured and what was assumed",
        sourceDoc: "docs/04-srs.md",
        readerMinutes: 31,
        titleVi: "Cột mốc: một người ngoài tích hợp",
        readerProducesVi:
          "Một package tích hợp bị niêm phong về mặt cơ chế nên không thể import code trong workspace, và một phán quyết cho tiêu chí ra khỏi Phase 2 của SRS kèm những gì đã đo và những gì chỉ được giả định",
        translatedIn: ["vi"],
      },
    ],
  },
  {
    number: 4,
    // RENAMED. "The second data path" covered the analytics movements and stopped:
    // this part also carries hosted media and the compliance lifecycle, and what
    // holds the three together is that each moves data off the path everything else
    // takes — ending with the chapter that has to find every path it went down.
    // docs/12-part-4-structure.md is the structure record.
    title: "Everywhere the data went",
    titleVi: "Mọi ngả đường dữ liệu đã đi",
    chapters: [
      {
        id: "4.1",
        path: "/part-4/chapter-01/the-question-the-counters-cant-answer",
        title: "The question the counters can't answer",
        status: "published",
        readerProduces:
          "A million-message corpus, the analytical query written against Postgres for the first time, and four numbers showing the index that should fix it costs 49% more storage and buys noise",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
        titleVi: "Câu hỏi mà những bộ đếm không trả lời được",
        readerProducesVi:
          "Một corpus một triệu tin nhắn, câu truy vấn phân tích lần đầu được viết cho Postgres, và bốn con số cho thấy index lẽ ra phải sửa được nó lại tốn thêm 49% dung lượng mà đổi lại chỉ là nhiễu",
        translatedIn: ["vi"],
      },
      {
        id: "4.2",
        path: "/part-4/chapter-02/the-store-that-was-never-listening",
        title: "The store that was never listening",
        status: "published",
        readerProduces:
          "A ClickHouse a query can reach, an analytical schema with a ledger of its own, and the same question answered in 13.22 ms against Postgres's 585.9 — with one day out of ninety-one that can never reconcile",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 60,
        titleVi: "Kho dữ liệu chưa từng lắng nghe",
        readerProducesVi:
          "Một ClickHouse mà truy vấn chạm tới được, một schema phân tích với sổ ghi của riêng nó, và cùng một câu hỏi được trả lời trong 13,22 ms so với 585,9 ms của Postgres — cùng một ngày trong chín mươi mốt ngày không bao giờ đối soát được",
        translatedIn: ["vi"],
      },
      {
        id: "4.3",
        path: "/part-4/chapter-03/the-consumer-that-was-promised",
        title: "The consumer that was promised",
        status: "published",
        readerProduces:
          "The ingester for a stream that has been filling since chapter 3.20 with nothing reading it — deduplicating on the record's own key, because the template built to prevent exactly this problem writes to the database this path may not touch",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
        titleVi: "Consumer đã được hứa hẹn",
        readerProducesVi:
          "Bộ nạp cho một stream đã đầy dần từ chương 3.20 mà chưa ai đọc — khử trùng lặp bằng chính khóa của bản ghi, bởi vì khuôn mẫu được xây để ngăn đúng vấn đề này lại ghi vào cơ sở dữ liệu mà đường dẫn này không được phép chạm tới",
        translatedIn: ["vi"],
      },
      {
        // REGISTERED LATE. This chapter shipped and was tagged `part4-ch4` with eight gates
        // green, and `pnpm build` failed from that moment: `<ChapterHeader id="4.4" />` calls
        // `getChapter`, which throws on an id this manifest does not hold. None of the eight
        // gates renders a page, so nothing said so. Analysis pass 9 of feature 050 found it by
        // running the build.
        id: "4.4",
        path: "/part-4/chapter-04/the-requests-that-belong-to-nobody",
        title: "The requests that belong to nobody",
        status: "published",
        readerProduces:
          "An analytical record for every API request, and the measurement that FR-ANL-01's \"every request\" and FR-ANL-07's \"per tenant\" are not the same population — 34 of 54 requests resolve to no tenant, and the gap is widest exactly where the traffic is",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
      },
      {
        id: "4.5",
        path: "/part-4/chapter-05/the-gateways-first-stream",
        title: "The gateway's first stream",
        status: "published",
        readerProduces:
          "FR-ANL-01's last arm without a producer, built in the one service that had never held a broker client — and the measurement that neither a clean stop nor a kill balances the opens against the closes, with the two connection counters wrong in opposite directions",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
      },
      {
        id: "4.6",
        path: "/part-4/chapter-06/the-rollup-nobody-read",
        title: "The rollup nobody read",
        status: "published",
        readerProduces:
          "The rollup DR-10 asks for, after finding that the one already shipped is read by nothing and sits over a table nothing writes — and the measurement that put FR-ANL-09's channel dimension and DR-10's cheap read into separate tables, at 525x the rows and a billing query that touched more of them than the raw events it replaced",
        sourceDoc: "docs/04-srs.md, docs/05-sad.md",
        readerMinutes: 55,
      },
    ],
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
