// Hình minh họa chương 2.6. Mã Mermaid sống ở đây, không bao giờ nằm trong
// page.mdx. Tên đến từ tài liệu và code được giữ nguyên khi là technical term.

export const figSplitBrain = `flowchart TB
    subgraph g1["Gateway instance 1"]
      d["socket của dispatcher"]
    end
    subgraph g2["Gateway instance 2"]
      t["socket của Tuan"]
    end
    api["API service<br/>(write đã commit ổn)"]
    d -->|message.send| g1
    g1 --> api
    api -.->|201| g1
    g1 -->|message.ack| d
    t -.-|"…im lặng…"| g2
    note["Registry chỉ biết socket CỦA NÓ:<br/>instance 1 deliver tới mọi người nó thấy được,<br/>và Tuan không nằm trong tập đó —<br/>hai server, hai nửa cuộc trò chuyện"]
    g2 ~~~ note`;

export const figHandshake = `sequenceDiagram
    participant T as Client của Tuan
    participant G2 as Gateway 2
    participant A as API service
    participant R as Redis pub/sub
    T->>G2: HTTP upgrade /v1/ws?token=…
    G2->>G2: verify JWT ngay tại chỗ — không gọi api, sai thì đóng 4001
    G2->>A: GET /internal/memberships
    A-->>G2: channel_ids — nguồn duy nhất về membership (ADR-05)
    G2->>G2: registry.add(connection)
    G2->>R: SUBSCRIBE chan:{channel_id}, mỗi channel một lần
    G2-->>T: frame connection.ack
    Note over G2,R: ack KHÔNG chờ subscribe (EIR-WS-03):<br/>broker nằm im chỉ làm session mở mà không nghe được,<br/>và ioredis subscribe lại khi kết nối trở lại`;

export const figFanout = `sequenceDiagram
    participant D as Dispatcher (trên G1)
    participant G1 as Gateway 1
    participant A as API service
    participant R as Redis pub/sub
    participant G2 as Gateway 2
    participant T as Tuan (trên G2)
    D->>G1: frame message.send
    G1->>A: POST /internal/messages
    A-->>G1: 201 {message, seq}
    G1-->>D: frame message.ack {seq}
    G1->>R: PUBLISH chan:{channel_id} {message}
    R-->>G1: (subscribed) → local members
    R-->>G2: (subscribed) → local members
    G2-->>T: frame message.created
    Note over R: at-most-once, by design (ADR-07) —<br/>durability đã xảy ra ở 201`;

export const figLossyIsFine = `flowchart LR
    pg[("PostgreSQL<br/>sequences · sự thật")]
    redis["Redis pub/sub<br/>lossy, at-most-once<br/>(ADR-07)"]
    resume["resume path (2.7)<br/>cursors · backfill"]
    redis -->|"delivered? tốt —<br/>vài mili-giây latency"| ok["live frame"]
    redis -->|"dropped? cũng ổn —"| resume
    resume --> pg
    note["Fabric ĐƯỢC PHÉP mất frames vì<br/>recovery sống trong Postgres sequences và cursors:<br/>mọi lựa chọn 'thoải mái đến ngạc nhiên'<br/>đều được mua bằng một lựa chọn nghiêm ngặt (constitution IV)"]
    pg ~~~ note`;
