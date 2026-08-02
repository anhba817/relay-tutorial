// Hình minh họa chương 2.2 (feature 020 — DRAFT, chưa công bố). Mã Mermaid
// sống ở đây, không bao giờ nằm trong page.mdx. Tên định danh giữ nguyên
// tiếng Anh khi chúng đến từ code hoặc tài liệu.

export const figRaceTimeline = `sequenceDiagram
    participant W1 as Writer 1
    participant W2 as Writer 2
    participant P as PostgreSQL
    Note over W1,W2: NAIVE endpoint — read seq, rồi write
    W1->>P: read last_sequence → 41
    W2->>P: read last_sequence → 41
    W1->>P: INSERT message seq=42
    W2->>P: INSERT message seq=42 ✗
    Note over P: hai messages cùng claim seq 42 —<br/>hoặc UNIQUE(channel_id, seq) reject một message<br/>và "ordering" chưa từng order được gì`;

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
    ch1["channel A<br/>row lock: sends serialize"]
    ch2["channel B<br/>independent lock"]
    ch3["channel C<br/>independent lock"]
    note["Contention scope là MỘT channel (ADR-03):<br/>busy channel serialize send của nó —<br/>đó CHÍNH LÀ ordering guarantee FR-MSG-03 đòi"]
    ch1 ~~~ ch2 ~~~ ch3
    ch2 ~~~ note`;
