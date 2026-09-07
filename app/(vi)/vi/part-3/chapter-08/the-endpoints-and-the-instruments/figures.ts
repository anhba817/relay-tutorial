// Figures của chương 3.13. Mermaid source nằm ở đây, không bao giờ trong page.mdx.
// Nhãn tường thuật thì dịch; identifier, tên bảng và cột giữ nguyên tiếng Anh.

export const figTwoEndpoints = `flowchart TB
    create["POST /v1/channels<br/>external_id, type, name?, metadata?"]
    create --> conflict["INSERT … ON CONFLICT<br/>(environment_id, external_id) DO NOTHING"]
    conflict --> made["có một row trả về"]
    conflict --> lost["không có gì trả về"]
    made --> c201["201 — đã tạo"]
    lost --> read["getChannelByExternalId<br/>kẻ thua đọc row của kẻ thắng"]
    read --> c200["200 — channel đã có"]
    members["POST /v1/channels/:channelId/members<br/>user_ids, at most 100"]
    members --> scoped["channelExists(id) — ĐÃ SCOPE, và TRƯỚC TIÊN"]
    scoped --> absent["404, y hệt nhau cho id của người khác<br/>và id không tồn tại ở đâu cả"]
    scoped --> count["countMembers — đọc từ storage"]
    count --> ceiling["+ requested > 1000?"]
    ceiling --> refuse["422 channel_member_limit_exceeded<br/>không tạo ai, không ghi gì"]
    ceiling --> add["createUser rồi addMember,<br/>từng user một"]
    style c201 fill:#064e3b,color:#fff,stroke:#059669
    style c200 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style absent fill:#78350f,color:#fff,stroke:#d97706
    style refuse fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figThreeOutcomes = `flowchart LR
    call["addMember(channelId, userId)"]
    call --> before["TRƯỚC: boolean"]
    call --> after["SAU: AddMemberOutcome"]
    before --> b1["true — đã thêm"]
    before --> b2["false — channel không phải của bạn"]
    before --> b3["false — user không phải của bạn"]
    before --> b4["NÉM LỖI — bạn hỏi hai lần"]
    after --> a1["added"]
    after --> a2["not_found — channel không phải của bạn"]
    after --> a3["not_found — user không phải của bạn"]
    after --> a4["already_a_member"]
    b4 --> wire["unique violation → internal_error<br/>một cái 500 cho một request hợp lý"]
    a2 --> right["GỘP CÓ CHỦ Ý:<br/>FR-TEN-05 cần hai cái này y hệt nhau"]
    a3 --> right
    style b4 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style wire fill:#7f1d1d,color:#fff,stroke:#dc2626
    style right fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figOneRuleName = `flowchart TB
    subgraph before["TRƯỚC — hai block, một tên rule"]
      b1["files: **/*.ts<br/>no-restricted-imports: pg, drizzle-orm, ioredis"]
      b2["files: **/*.itest.ts<br/>no-restricted-imports: the global drains"]
      b1 -. "block sau THAY THẾ" .-> b2
      b2 --> off["mọi integration test đều import được<br/>driver và query engine"]
    end
    subgraph after["SAU — ba block, ghép lại"]
      a1["**/*.itest.ts minus BOTH lists<br/>the UNION of both sets"]
      a2["DRIVER_EXEMPT_TESTS (8)<br/>the drain set only"]
      a3["DRAIN_EXEMPT_TESTS (6)<br/>the driver set only"]
    end
    off --> measured["npx eslint quotas/period.itest.ts → exit 0<br/>while it imports drizzle-orm"]
    style off fill:#7f1d1d,color:#fff,stroke:#dc2626
    style measured fill:#78350f,color:#fff,stroke:#d97706`;

export const figBaitMustNotBeClaimable = `flowchart TB
    add["thêm quota_notifications vào mảng trigger"]
    add --> bait["plant() phải để lại một sentinel row,<br/>không thì mệnh đề WHEN không bao giờ khớp"]
    bait --> claimable["delivered_at NULL<br/>= CÓ THỂ BỊ CLAIM"]
    bait --> settled["delivered_at đã có<br/>= không claim được"]
    claimable --> drain["createQuotaRelay claim các row chưa gửi<br/>TRÊN MỌI environment"]
    drain --> boom["13 test fail trong quotas.itest.ts<br/>và connections.itest.ts"]
    settled --> ok["guard canh bảng đó;<br/>không lượt drain nào với tới bait"]
    boom --> law["bait chỉ được claim được ở nơi<br/>việc drain nó là việc CỦA DATABASE"]
    style boom fill:#7f1d1d,color:#fff,stroke:#dc2626
    style law fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style ok fill:#064e3b,color:#fff,stroke:#059669`;
