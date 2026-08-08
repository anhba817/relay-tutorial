// Hình minh họa chương 2.8. Mermaid sources sống ở đây, không bao giờ nằm
// trong page.mdx. Tên đến từ documents và technical terms được giữ nguyên.

export const figJourneySwimlane = `sequenceDiagram
    participant D as Dispatcher (G1)
    participant G1 as Gateway 1
    participant A as API + Postgres
    participant G2 as Gateway 2
    participant T as Tuan (G2)
    D->>G1: "which entrance?"
    G1->>A: write path → seq 1
    A-->>G2: fan-out via Redis
    G2-->>T: message.created 1
    T->>G2: "B2, north ramp" {key k1} → seq 2
    Note over T,G2: SOCKET BỊ KILL giữa lúc send —<br/>không ack nào quay về ★
    D->>G1: "ok, coming down" → seq 3
    Note over T: tunnel — frames được publish<br/>vào fabric không ai nghe hộ anh
    T->>G1: reconnect (INSTANCE KHÁC) {cursor 1}
    D->>G1: "still coming down" → seq 4,<br/>published DURING the resume
    G1-->>T: backfill 2·3 · flush 4 · live
    T->>G1: retry {key k1} → trả về original
    Note over T: [1, 2, 3, 4] — mỗi frame exactly once,<br/>strictly ascending, trên cả hai màn hình`;

export const figCapabilityMap = `flowchart TB
    t28["2.8 — Tuan test<br/>(journey 4, được scripted)"]
    c22["2.2 order dưới lock<br/>(strict per-channel seq)"]
    c23["2.3 exactly-once qua key<br/>(mid-send retry)"]
    c24["2.4 bounded catch-up reads<br/>(query của backfill)"]
    c25["2.5 sessions · auth · liveness<br/>(kill được DETECTED)"]
    c26["2.6 cross-instance delivery<br/>(D trên G1, T trên G2)"]
    c27["2.7 resume không gap, không double<br/>(lối ra khỏi tunnel)"]
    c22 --> t28
    c23 --> t28
    c24 --> t28
    c25 --> t28
    c26 --> t28
    c27 --> t28
    note["Remove bất kỳ chương nào và một named<br/>assertion trong suite fail — milestone<br/>chính là phần này, executable (docs/07 Rule 2)"]
    t28 ~~~ note`;

export const figPhaseOneExit = `flowchart LR
    srs["SRS §7.3, Phase 1 exit criterion:<br/>'Hai clients trao đổi messages qua public API,<br/>sống sót qua forced disconnect với<br/>ordering đúng và không duplicates'"]
    suite["packages/e2e — tuan.itest.ts<br/>two instances · forced kill ·<br/>resume · exactly-once · order"]
    done["Phần 2 ✓ — core loop đứng vững<br/>Phần 3 biến nó thành platform"]
    srs --> suite --> done`;
