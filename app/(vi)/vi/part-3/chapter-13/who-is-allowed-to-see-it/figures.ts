// Figures của chương 3.19. Mã mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên lấy từ tài liệu, từ schema và từ code — không từ đâu khác.

export const figTwoFabrics = `flowchart LR
    subgraph inst1["gateway instance A"]
      s1["socket — Mai"]
      s2["socket — Tuấn"]
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
    participant W as người theo dõi
    S-xG: đóng kết nối
    G->>G: registry.remove
    G->>G: connectionsFor(user).length === 0
    G->>R: SET presence:{env}:{user} PX graceMs XX
    R-->>G: OK
    Note over G,R: có await — vòng round trip nằm TRONG khoảng chờ, không đua với nó
    G->>G: setTimeout(graceMs + marginMs)
    Note over G,R: ...30 giây...
    G->>R: EXISTS presence:{env}:{user}
    R-->>G: 0
    G->>R: SET presence:offline:{env}:{user} NX
    R-->>G: OK — instance này được quyền lên tiếng
    G->>R: publish presence:{id} {state: offline}
    R->>W: presence.changed`;

export const figScope = `flowchart TD
    t["Tuấn rời mạng"] --> p["publish trên presence:{c} cho từng channel CỦA TUẤN"]
    p --> a["instance A — có SUBSCRIBE presence:general\\nvì Mai là thành viên"]
    p --> b["instance B — không subscribe channel nào của Tuấn"]
    a --> sub["subscribersOf(general)"]
    sub --> mai["Mai — thành viên: CÓ FRAME"]
    sub --> hai["Hải — nối vào A, không chung channel nào:\\nkhông nằm trong subscribersOf, không frame"]
    b --> linh["Linh — không hề nghe thấy lần publish nào"]
    style mai fill:#14532d,color:#fff,stroke:#22c55e
    style hai fill:#334155,color:#fff,stroke:#64748b
    style linh fill:#334155,color:#fff,stroke:#64748b`;
