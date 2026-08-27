// Chapter 3.18 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoDoors = `flowchart LR
    subgraph before["BEFORE — one publisher"]
      c1["client socket"] -->|message.send| g1["gateway"]
      g1 -->|POST /internal/messages| a1["api"]
      a1 -->|"201 {seq}"| g1
      g1 -->|"message.ack"| c1
      g1 -->|"publish chan:{id}"| r1[("Redis")]
      b1["customer backend"] -->|"POST /v1/.../messages"| a1
      a1 -->|"201"| b1
    end
    style b1 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style r1 fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figOrdering = `sequenceDiagram
    participant C as client / backend
    participant G as gateway
    participant A as api
    participant P as PostgreSQL
    participant R as Redis
    Note over C,R: SOCKET — two channels, so the ordering is performable
    C->>G: message.send
    G->>A: POST /internal/messages
    A->>P: INSERT + COMMIT
    A-->>G: 201 {seq}
    G-->>C: message.ack {seq}
    G->>R: publish chan:{id}
    Note over C,R: REST — one channel, so the response IS the ack
    C->>A: POST /v1/channels/:id/messages
    A->>P: INSERT + COMMIT
    A->>R: publish chan:{id}
    A-->>C: 201 {seq, user}`;

export const figFailureShape = `flowchart TB
    p["publish() called"]
    p --> w{"down-window open?"}
    w -->|yes| skip["return immediately<br/>no client call, 0 ms"]
    w -->|no| t["PUBLISH on the subject"]
    t -->|ok| clear["clear the window"]
    t -->|throws| log["log fanout.publish_failed<br/>channel, message_id,<br/>request_id, environment_id"]
    log --> open["open the window for 5 s"]
    skip --> resolved["publish RESOLVES"]
    clear --> resolved
    open --> resolved
    resolved --> note["the send answers 201 either way<br/>— which is why the LOG LINE is the assertion"]
    style note fill:#7f1d1d,color:#fff,stroke:#dc2626
    style skip fill:#064e3b,color:#fff,stroke:#059669`;

export const figMembershipSnapshot = `flowchart LR
    conn["socket opens"] --> sess["POST /internal/session"]
    sess --> set["connection.channelIds<br/>a Set, built ONCE"]
    set --> sub["fanout.subscribe per channel<br/>session.ts:356"]
    sub --> deliver["registry.subscribersOf<br/>session.ts:175<br/>reads the same Set, every frame"]
    deliver --> close["socket closes"]
    close --> unsub["fanout.unsubscribe<br/>session.ts:398"]
    removed["membership REMOVED<br/>over the public route"] -.->|"nothing re-reads"| set
    style removed fill:#7f1d1d,color:#fff,stroke:#dc2626
    style deliver fill:#1e3a8a,color:#fff,stroke:#3b82f6`;
