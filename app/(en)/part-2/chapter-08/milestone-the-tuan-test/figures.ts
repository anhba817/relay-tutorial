// Chapter 2.8 figures. Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

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
    Note over T,G2: SOCKET KILLED mid-send —<br/>no ack ever arrives ★
    D->>G1: "ok, coming down" → seq 3
    Note over T: the tunnel — frames published<br/>to a fabric nobody hears for him
    T->>G1: reconnect (OTHER instance) {cursor 1}
    D->>G1: "still coming down" → seq 4,<br/>published DURING the resume
    G1-->>T: backfill 2·3 · flush 4 · live
    T->>G1: retry {key k1} → original returned
    Note over T: [1, 2, 3, 4] — exactly once each,<br/>strictly ascending, on both screens`;

export const figCapabilityMap = `flowchart TB
    t28["2.8 — the Tuan test<br/>(journey 4, scripted)"]
    c22["2.2 order under the lock<br/>(strict per-channel seq)"]
    c23["2.3 exactly-once via key<br/>(the mid-send retry)"]
    c24["2.4 bounded catch-up reads<br/>(backfill's query)"]
    c25["2.5 sessions · auth · liveness<br/>(the kill is DETECTED)"]
    c26["2.6 cross-instance delivery<br/>(D on G1, T on G2)"]
    c27["2.7 resume without gap or double<br/>(the tunnel exit)"]
    c22 --> t28
    c23 --> t28
    c24 --> t28
    c25 --> t28
    c26 --> t28
    c27 --> t28
    note["Remove any one chapter and a named<br/>assertion in the suite fails — the milestone<br/>is the part, executable (docs/07 Rule 2)"]
    t28 ~~~ note`;

export const figPhaseOneExit = `flowchart LR
    srs["SRS §7.3, Phase 1 exit criterion:<br/>'Two clients exchange messages through the<br/>public API, surviving a forced disconnect with<br/>correct ordering and no duplicates'"]
    suite["packages/e2e — tuan.itest.ts<br/>two instances · forced kill ·<br/>resume · exactly-once · order"]
    done["Part 2 ✓ — the core loop stands<br/>Part 3 makes it a platform"]
    srs --> suite --> done`;
