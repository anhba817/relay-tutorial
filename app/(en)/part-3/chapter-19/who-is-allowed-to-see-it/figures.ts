// Chapter 3.19 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoFabrics = `flowchart LR
    subgraph inst1["gateway instance A"]
      s1["socket — Mai"]
      s2["socket — Tuan"]
    end
    subgraph inst2["gateway instance B"]
      s3["socket — Linh"]
    end
    r1[("Redis pub/sub")]
    s1 -->|"message.send"| inst1
    inst1 -->|"publish chan:{id}"| r1
    inst1 -->|"publish presence:{id}"| r1
    r1 -->|"SUBSCRIBE chan:{id}"| inst2
    r1 -->|"SUBSCRIBE presence:{id}"| inst2
    inst2 --> s3
    style r1 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style s2 fill:#334155,color:#fff,stroke:#64748b`;

export const figGrace = `sequenceDiagram
    participant S as socket
    participant G as gateway
    participant R as Redis
    participant W as watcher
    S-xG: close
    G->>G: registry.remove
    G->>G: connectionsFor(user).length === 0
    G->>R: SET presence:{env}:{user} PX graceMs XX
    R-->>G: OK
    Note over G,R: awaited — the round trip is inside the wait, not racing it
    G->>G: setTimeout(graceMs + marginMs)
    Note over G,R: ...30 s...
    G->>R: EXISTS presence:{env}:{user}
    R-->>G: 0
    G->>R: SET presence:offline:{env}:{user} NX
    R-->>G: OK — this instance may speak
    G->>R: publish presence:{id} {state: offline}
    R->>W: presence.changed`;

export const figScope = `flowchart TD
    t["Tuan goes offline"] --> p["publish on presence:{c} for each of TUAN's channels"]
    p --> a["instance A — subscribed to presence:general\\nbecause Mai is a member"]
    p --> b["instance B — subscribed to nothing of Tuan's"]
    a --> sub["subscribersOf(general)"]
    sub --> mai["Mai — member: FRAME"]
    sub --> hai["Hai — connected to A, shares no channel:\\nnot in subscribersOf, no frame"]
    b --> linh["Linh — never hears the publish at all"]
    style mai fill:#14532d,color:#fff,stroke:#22c55e
    style hai fill:#334155,color:#fff,stroke:#64748b
    style linh fill:#334155,color:#fff,stroke:#64748b`;
