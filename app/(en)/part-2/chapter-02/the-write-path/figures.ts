// Chapter 2.2 figures (feature 020 — DRAFT, unpublished). Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

export const figRaceTimeline = `sequenceDiagram
    participant W1 as Writer 1
    participant W2 as Writer 2
    participant P as PostgreSQL
    Note over W1,W2: the NAIVE endpoint — read seq, then write
    W1->>P: read last_sequence → 41
    W2->>P: read last_sequence → 41
    W1->>P: INSERT message seq=42
    W2->>P: INSERT message seq=42 ✗
    Note over P: two messages claim seq 42 —<br/>or UNIQUE(channel_id, seq) rejects one<br/>and the "ordering" was never ordered`;

export const figSendWalk = `sequenceDiagram
    participant C as Client
    participant A as API service
    participant P as PostgreSQL
    C->>A: POST /v1/channels/:id/messages {text}
    A->>P: BEGIN
    A->>P: SELECT channel FOR UPDATE (tenant-scoped)
    Note over A,P: seq = last_sequence + 1
    A->>P: UPDATE channel · INSERT message
    A->>P: COMMIT
    A-->>C: 201 {message, seq}
    Note over A: ack AFTER commit, never before (FR-MSG-05)`;

export const figLockScope = `flowchart LR
    ch1["channel A<br/>row lock: sends serialise"]
    ch2["channel B<br/>independent lock"]
    ch3["channel C<br/>independent lock"]
    note["Contention scope is ONE channel (ADR-03):<br/>a busy channel serialises its own sends —<br/>which IS the ordering guarantee FR-MSG-03 asks for"]
    ch1 ~~~ ch2 ~~~ ch3
    ch2 ~~~ note`;
