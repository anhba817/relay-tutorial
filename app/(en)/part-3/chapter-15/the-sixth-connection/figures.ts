// Chapter 3.22 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figSlotWalk = `flowchart TB
    a["claim(env, user, id)"]
    s0{"SET conn:{env}:{user}:0 id PX 60000 NX"}
    t0{"SET … id IFEQ - PX 60000"}
    s1{"slot 1 … slot 4, the same two commands"}
    ok["claimed, slot 0"]
    ok1["claimed, slot n"]
    full["full, held 5 -> close 4004"]
    a --> s0
    s0 -->|"OK"| ok
    s0 -->|"nil, a key is there"| t0
    t0 -->|"OK, it was a tombstone"| ok
    t0 -->|"nil, somebody holds it"| s1
    s1 -->|"OK"| ok1
    s1 -->|"no free slot"| full
    style s0 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style t0 fill:#334155,color:#fff,stroke:#64748b
    style full fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figTwoInstances = `flowchart LR
    subgraph gwA["gateway A"]
      c1["socket 1"]
      c2["socket 2"]
      c3["socket 3"]
    end
    subgraph gwB["gateway B"]
      c4["socket 4"]
      c5["socket 5"]
      c6["socket 6 — refused"]
    end
    r[("Redis — five keys, one per place")]
    k0["conn:{env}:tuan:0"]
    k1["conn:{env}:tuan:1"]
    k2["conn:{env}:tuan:2"]
    k3["conn:{env}:tuan:3"]
    k4["conn:{env}:tuan:4"]
    c1 --> r
    c2 --> r
    c3 --> r
    c4 --> r
    c5 --> r
    c6 -->|"walks all five, none free"| r
    r --- k0
    r --- k1
    r --- k2
    r --- k3
    r --- k4
    style r fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style c6 fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figThreeRefusals = `flowchart TB
    subgraph rate["4008 — quota exhausted"]
      r1["cause: too many connects this window"]
      r2["remedy: wait, then retry"]
      r3["carries: a window that resets"]
    end
    subgraph auth["4001 — invalid or expired token"]
      a1["cause: the credential"]
      a2["remedy: get a new token, retry"]
      a3["carries: nothing to close"]
    end
    subgraph cap["4004 — connection limit reached"]
      p1["cause: five places are held"]
      p2["remedy: close one you hold, then connect"]
      p3["carries: no clock at all"]
    end
    style cap fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style rate fill:#334155,color:#fff,stroke:#64748b
    style auth fill:#334155,color:#fff,stroke:#64748b`;

export const figSlotLifecycle = `stateDiagram-v2
    [*] --> free
    free --> held: SET NX PX (claim)
    free --> held: SET IFEQ - PX (claim a tombstone)
    held --> held: SET IFEQ PX every 20 s (renew)
    held --> free: SET - IFEQ id PX 1 (the socket closed)
    held --> free: SET - IFEQ id PX 1 (releaseAll, a deploy)
    held --> free: TTL expires after 60 s (the instance died)
    held --> lost: renewal refused, somebody else holds it
    lost --> held: re-claim found another place
    lost --> [*]: all five held, close 4004
    note right of held
      Four ways out compare the id first.
      One does not: the TTL.
    end note`;
