// Chapter 3.13 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoEndpoints = `flowchart TB
    create["POST /v1/channels<br/>external_id, type, name?, metadata?"]
    create --> conflict["INSERT … ON CONFLICT<br/>(environment_id, external_id) DO NOTHING"]
    conflict --> made["a row came back"]
    conflict --> lost["nothing came back"]
    made --> c201["201 — created"]
    lost --> read["getChannelByExternalId<br/>the loser reads the winner's row"]
    read --> c200["200 — the existing channel"]
    members["POST /v1/channels/:channelId/members<br/>user_ids, at most 100"]
    members --> scoped["channelExists(id) — SCOPED, and FIRST"]
    scoped --> absent["404, identical for a foreign id<br/>and an id that exists nowhere"]
    scoped --> count["countMembers — from storage"]
    count --> ceiling["+ requested > 1000?"]
    ceiling --> refuse["422 channel_member_limit_exceeded<br/>nobody created, nothing written"]
    ceiling --> add["createUser then addMember,<br/>per user"]
    style c201 fill:#064e3b,color:#fff,stroke:#059669
    style c200 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style absent fill:#78350f,color:#fff,stroke:#d97706
    style refuse fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figThreeOutcomes = `flowchart LR
    call["addMember(channelId, userId)"]
    call --> before["BEFORE: boolean"]
    call --> after["AFTER: AddMemberOutcome"]
    before --> b1["true — added"]
    before --> b2["false — the channel is not yours"]
    before --> b3["false — the user is not yours"]
    before --> b4["RAISES — you asked twice"]
    after --> a1["added"]
    after --> a2["not_found — the channel is not yours"]
    after --> a3["not_found — the user is not yours"]
    after --> a4["already_a_member"]
    b4 --> wire["unique violation → internal_error<br/>a 500 for a reasonable request"]
    a2 --> right["conflated ON PURPOSE:<br/>FR-TEN-05 needs these identical"]
    a3 --> right
    style b4 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style wire fill:#7f1d1d,color:#fff,stroke:#dc2626
    style right fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figOneRuleName = `flowchart TB
    subgraph before["BEFORE — two blocks, one rule name"]
      b1["files: **/*.ts<br/>no-restricted-imports: pg, drizzle-orm, ioredis"]
      b2["files: **/*.itest.ts<br/>no-restricted-imports: the global drains"]
      b1 -. "later block REPLACES" .-> b2
      b2 --> off["every integration test could import<br/>the driver and the query engine"]
    end
    subgraph after["AFTER — three blocks, composed"]
      a1["**/*.itest.ts minus BOTH lists<br/>the UNION of both sets"]
      a2["DRIVER_EXEMPT_TESTS (8)<br/>the drain set only"]
      a3["DRAIN_EXEMPT_TESTS (6)<br/>the driver set only"]
    end
    off --> measured["npx eslint quotas/period.itest.ts → exit 0<br/>while it imports drizzle-orm"]
    style off fill:#7f1d1d,color:#fff,stroke:#dc2626
    style measured fill:#78350f,color:#fff,stroke:#d97706`;

export const figBaitMustNotBeClaimable = `flowchart TB
    add["add quota_notifications to the trigger array"]
    add --> bait["plant() must leave a sentinel row,<br/>or the WHEN clause never matches"]
    bait --> claimable["delivered_at NULL<br/>= CLAIMABLE"]
    bait --> settled["delivered_at set<br/>= not claimable"]
    claimable --> drain["createQuotaRelay claims undelivered<br/>rows ACROSS EVERY environment"]
    drain --> boom["13 tests fail in quotas.itest.ts<br/>and connections.itest.ts"]
    settled --> ok["the guard watches the table;<br/>no drain reaches the bait"]
    boom --> law["bait may be claimable only where<br/>draining it is DATABASE work"]
    style boom fill:#7f1d1d,color:#fff,stroke:#dc2626
    style law fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style ok fill:#064e3b,color:#fff,stroke:#059669`;
