// Chapter 2.6 figures. Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

export const figSplitBrain = `flowchart TB
    subgraph g1["Gateway instance 1"]
      d["dispatcher's socket"]
    end
    subgraph g2["Gateway instance 2"]
      t["Tuan's socket"]
    end
    api["API service<br/>(the write committed fine)"]
    d -->|message.send| g1
    g1 --> api
    api -.->|201| g1
    g1 -->|message.ack| d
    t -.-|"…silence…"| g2
    note["The registry knows ITS sockets only:<br/>instance 1 delivered to everyone it can see,<br/>and Tuan is not in that set —<br/>two servers, two half-conversations"]
    g2 ~~~ note`;

export const figHandshake = `sequenceDiagram
    participant T as Tuan's client
    participant G2 as Gateway 2
    participant A as API service
    participant R as Redis pub/sub
    T->>G2: HTTP upgrade /v1/ws?token=…
    G2->>G2: verify the JWT locally — no api call, 4001 if it fails
    G2->>A: GET /internal/memberships
    A-->>G2: channel_ids — the only source of membership (ADR-05)
    G2->>G2: registry.add(connection)
    G2->>R: SUBSCRIBE chan:{channel_id}, one per channel
    G2-->>T: frame connection.ack
    Note over G2,R: the ack does NOT wait on the subscribe (EIR-WS-03):<br/>a stopped broker leaves the session open but deaf,<br/>and ioredis replays the subscriptions on reconnect`;

export const figFanout = `sequenceDiagram
    participant D as Dispatcher (on G1)
    participant G1 as Gateway 1
    participant A as API service
    participant R as Redis pub/sub
    participant G2 as Gateway 2
    participant T as Tuan (on G2)
    D->>G1: frame message.send
    G1->>A: POST /internal/messages
    A-->>G1: 201 {message, seq}
    G1-->>D: frame message.ack {seq}
    G1->>R: PUBLISH chan:{channel_id} {message}
    R-->>G1: (subscribed) → local members
    R-->>G2: (subscribed) → local members
    G2-->>T: frame message.created
    Note over R: at-most-once, by design (ADR-07) —<br/>durability already happened at the 201`;

export const figLossyIsFine = `flowchart LR
    pg[("PostgreSQL<br/>sequences · the truth")]
    redis["Redis pub/sub<br/>lossy, at-most-once<br/>(ADR-07)"]
    resume["the resume path (2.7)<br/>cursors · backfill"]
    redis -->|"delivered? great —<br/>milliseconds of latency"| ok["live frame"]
    redis -->|"dropped? also fine —"| resume
    resume --> pg
    note["The fabric is ALLOWED to lose frames because<br/>recovery lives in Postgres sequences and cursors:<br/>every 'surprisingly relaxed' choice is purchased<br/>by one strict one (constitution IV)"]
    pg ~~~ note`;
