// Hình minh họa chương 2.3 (feature 020 — DRAFT, chưa công bố). Mã Mermaid
// sống ở đây, không bao giờ nằm trong page.mdx. Tên định danh giữ nguyên
// tiếng Anh khi chúng đến từ code hoặc tài liệu.

export const figDuplicateTimeline = `sequenceDiagram
    participant T as client của Tuan
    participant A as API service
    participant P as PostgreSQL
    Note over T,A: KHÔNG có idempotency key
    T->>A: POST message "B2, north ramp"
    A->>P: INSERT · COMMIT (seq 42)
    A--xT: 201 — mất cùng tín hiệu
    Note over T: không ack nào quay về —<br/>đã send chưa? client không thể biết
    T->>A: retry: POST "B2, north ramp"
    A->>P: INSERT · COMMIT (seq 43)
    A-->>T: 201
    Note over P: dispatcher giờ đọc nó hai lần —<br/>đúng failure của journey 4`;

export const figIdempotentRetry = `sequenceDiagram
    participant T as client của Tuan
    participant A as API service
    participant P as PostgreSQL
    Note over T,A: CÓ key k1, mint ở send time
    T->>A: POST {text, idempotency_key: k1}
    A->>P: INSERT ON CONFLICT (channel, key) DO NOTHING → row (seq 42)
    A--xT: 201 — mất cùng tín hiệu
    T->>A: retry: POST {text, idempotency_key: k1}
    A->>P: INSERT ON CONFLICT DO NOTHING → zero rows
    A->>P: SELECT original theo (channel, k1)
    A-->>T: 201-equivalent {seq 42, duplicate recognised}
    Note over P: mãi mãi một row (DR-03)`;

export const figWhereItLives = `flowchart TB
    mem["application memory<br/>(một Set các key đã thấy)"]
    memx["✗ chết khi restart<br/>✗ instance khác không thấy"]
    db["storage layer<br/>partial unique index (DR-03)"]
    dbok["✓ sống sót qua restart<br/>✓ một sự thật cho mọi instance<br/>✓ enforce cả với code quên check"]
    mem --- memx
    db --- dbok
    note["constitution II: enforced at the storage layer<br/>(unique index), not in application memory"]
    db ~~~ note`;
