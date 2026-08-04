// Chapter 2.7 figures. Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

export const figRaceTimeline = `sequenceDiagram
    participant T as Tuan (reconnecting)
    participant G as Gateway
    participant A as API service
    participant R as Redis
    Note over T,R: THE NAIVE ORDER: backfill, then subscribe
    T->>G: connect {cursor: seq 41}
    G->>A: backfill since 41
    A-->>G: seq 42 (the reply)
    Note over R: seq 43 published NOW —<br/>during the backfill window
    G-->>T: seq 42
    G->>R: subscribe (too late)
    Note over T: seq 43 fell in the gap — GONE.<br/>Flip the order without a buffer and the test<br/>sees [43, 42, 43]: twice, and out of order.<br/>Both orders are wrong.`;

export const figBufferMachine = `flowchart TB
    s1["1 · SUBSCRIBE first<br/>(live frames start arriving)"]
    s2["2 · BUFFER<br/>hold live frames, deliver nothing"]
    s3["3 · BACKFILL<br/>fetch seq > cursor from the api,<br/>emit in sequence order · note high-water mark H"]
    s4["4 · FLUSH<br/>emit buffered frames with seq > H,<br/>DISCARD seq ≤ H (already in backfill)"]
    s5["5 · LIVE<br/>deliver as frames arrive"]
    s1 --> s2 --> s3 --> s4 --> s5
    note["The overlap is INTENTIONAL: a frame may be in both<br/>the buffer and the backfill — and seq makes the<br/>duplicate detectable, which is much of why<br/>sequence numbers exist (SAD §5.2 → ADR-03)"]
    s4 ~~~ note`;

export const figTunnelWalk = `sequenceDiagram
    participant T as Tuan
    participant G as Gateway (either instance)
    participant A as API service
    T->>G: WS connect {token, cursor: ch1=41}
    G->>G: verify JWT · register
    G->>G: subscribe Redis subjects FIRST, buffer live frames
    G->>A: POST /internal/backfill {user, cursors}
    A-->>G: seq > 41 per channel, cap 500
    G-->>T: connection.ack {resume_ok}
    G-->>T: backfilled frames, sequence order
    G->>G: flush buffer, discard seq ≤ high-water mark
    G-->>T: live frames resume
    Note over T: the queued "B2, north ramp" retries<br/>with its ORIGINAL key (2.3's path)`;
