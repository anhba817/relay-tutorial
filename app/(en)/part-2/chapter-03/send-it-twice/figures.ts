// Chapter 2.3 figures (feature 020 — DRAFT, unpublished). Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

export const figDuplicateTimeline = `sequenceDiagram
    participant T as Tuan's client
    participant A as API service
    participant P as PostgreSQL
    Note over T,A: WITHOUT an idempotency key
    T->>A: POST message "B2, north ramp"
    A->>P: INSERT · COMMIT (seq 42)
    A--xT: 201 — lost with the signal
    Note over T: no ack ever arrived —<br/>was it sent? the client cannot know
    T->>A: retry: POST "B2, north ramp"
    A->>P: INSERT · COMMIT (seq 43)
    A-->>T: 201
    Note over P: the dispatcher now reads it twice —<br/>journey 4's exact failure`;

export const figIdempotentRetry = `sequenceDiagram
    participant T as Tuan's client
    participant A as API service
    participant P as PostgreSQL
    Note over T,A: WITH key k1, minted at send time
    T->>A: POST {text, idempotency_key: k1}
    A->>P: INSERT ON CONFLICT (channel, key) DO NOTHING → row (seq 42)
    A--xT: 201 — lost with the signal
    T->>A: retry: POST {text, idempotency_key: k1}
    A->>P: INSERT ON CONFLICT DO NOTHING → zero rows
    A->>P: SELECT the original by (channel, k1)
    A-->>T: 201-equivalent {seq 42, duplicate recognised}
    Note over P: one row, ever (DR-03)`;

export const figWhereItLives = `flowchart TB
    mem["application memory<br/>(a Set of seen keys)"]
    memx["✗ dies on restart<br/>✗ invisible to the other instance"]
    db["the storage layer<br/>partial unique index (DR-03)"]
    dbok["✓ survives restarts<br/>✓ one truth for every instance<br/>✓ enforced even for code that forgets to check"]
    mem --- memx
    db --- dbok
    note["constitution II: enforced at the storage layer<br/>(unique index), not in application memory"]
    db ~~~ note`;
