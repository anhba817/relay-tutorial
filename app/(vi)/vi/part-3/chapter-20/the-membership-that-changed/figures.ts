// Chapter 3.20 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figGrammars = `flowchart LR
    subgraph api["api service"]
      rt["POST …/members/remove"]
      at["POST …/members"]
    end
    r1[("Redis pub/sub")]
    subgraph instA["gateway A — holds Tuan"]
      sa["socket — Tuan"]
    end
    subgraph instB["gateway B — holds Linh"]
      sb["socket — Linh"]
    end
    rt -->|"publish member:{channel_id}"| r1
    at -->|"publish member:{channel_id}"| r1
    at -->|"publish member:{env}:{user}"| r1
    r1 -->|"SUBSCRIBE member:{channel_id}"| instB
    r1 -->|"SUBSCRIBE member:{env}:{user}"| instA
    instA --> sa
    instB --> sb
    style r1 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style at fill:#334155,color:#fff,stroke:#64748b`;

export const figRemoval = `sequenceDiagram
    participant P as Priya
    participant A as api
    participant DB as PostgreSQL
    participant R as Redis
    participant G as gateway
    participant T as Tuan's socket
    participant L as Linh's socket

    P->>A: POST /v1/channels/:id/members/remove
    A->>DB: BEGIN
    A->>DB: DELETE members RETURNING external_id
    A->>DB: INSERT outbox channel.member_removed
    A->>DB: COMMIT
    A->>R: PUBLISH member:{channel_id}
    A-->>P: 200 {results:[{result:"removed"}]}
    R->>G: one frame, both audiences
    G->>L: membership.changed {change:"removed"}
    G->>T: membership.changed {change:"removed"}
    Note over G,T: send, THEN cut — the audience is<br/>derived before the mutation
    G->>G: channelIds.delete + buffer filter + 3 unsubscribes`;

export const figBackstop = `flowchart TB
    pub["publish on member:{channel_id}"]
    ok{"did it arrive?"}
    fast["applied in 34-88 ms"]
    lost["dropped — no sequence,<br/>no cursor, nothing to refetch"]
    timer["re-read every 60 s<br/>GET /internal/memberships"]
    diff["diff against connection.channelIds"]
    same["deliverMembership — the same<br/>function a publish calls"]
    pub --> ok
    ok -->|yes| fast
    ok -->|no| lost
    lost --> timer
    timer --> diff
    diff --> same
    fast --> same
    style lost fill:#7f1d1d,color:#fff,stroke:#dc2626
    style same fill:#1e3a8a,color:#fff,stroke:#3b82f6`;
