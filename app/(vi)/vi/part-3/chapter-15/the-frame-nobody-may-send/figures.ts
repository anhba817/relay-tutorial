// Chapter 3.21 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figInboundSeam = `flowchart TB
    c["client"]
    subgraph gw["gateway — session.ts handle()"]
      p["frameSchema.safeParse"]
      d{"INBOUND_FRAME_TYPES.has(type)?"}
      s["message.send -> the api"]
      t["typing.send -> the fabric"]
      x["unknown_frame_type + close 4002"]
      i["invalid_frame, socket stays open"]
    end
    c --> p
    p -->|"not in the union"| i
    p -->|"parsed"| d
    d -->|"no"| x
    d -->|"message.send"| s
    d -->|"typing.send"| t
    style d fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style t fill:#334155,color:#fff,stroke:#64748b
    style i fill:#334155,color:#fff,stroke:#64748b`;

export const figFourGrammars = `flowchart LR
    subgraph api["api service"]
      m["POST …/messages"]
      mem["POST …/members"]
    end
    subgraph gwA["gateway A — holds Tuan"]
      ta["socket — Tuan"]
    end
    r[("Redis pub/sub")]
    subgraph gwB["gateway B — holds Mai"]
      mb["socket — Mai"]
    end
    m -->|"publish chan:{channel_id}"| r
    mem -->|"publish member:{channel_id}"| r
    gwA -->|"publish presence:{channel_id}"| r
    ta -->|"typing.send"| gwA
    gwA -->|"publish typing:{channel_id}"| r
    r -->|"SUBSCRIBE all four"| gwB
    gwB --> mb
    style r fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style gwA fill:#334155,color:#fff,stroke:#64748b`;

export const figExpiry = `sequenceDiagram
    participant T as Tuan's client
    participant G as gateway
    participant R as Redis
    participant M as Mai's client
    T->>G: typing.send {channel}
    G->>R: publish typing:{channel_id}
    R->>G: typing:{channel_id}
    G->>M: typing {channel, user: tuan}
    Note over M: starts a 5 s timer
    T->>G: typing.send {channel}
    Note over G: inside the 2 s interval — dropped, silently
    Note over T: Tuan stops typing
    Note over G: no timer, no key, nothing to expire
    Note over M: 5 s pass; the indicator clears
    Note over G,M: the server never said stop, because it cannot`;
