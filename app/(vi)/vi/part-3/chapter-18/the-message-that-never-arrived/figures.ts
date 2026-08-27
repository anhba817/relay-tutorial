// Figures của chương 3.18. Mã mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên lấy từ tài liệu, từ schema và từ code — không từ đâu khác.

export const figTwoDoors = `flowchart LR
    subgraph before["TRƯỚC ĐÂY — một publisher duy nhất"]
      c1["client socket"] -->|message.send| g1["gateway"]
      g1 -->|POST /internal/messages| a1["api"]
      a1 -->|"201 {seq}"| g1
      g1 -->|"message.ack"| c1
      g1 -->|"publish chan:{id}"| r1[("Redis")]
      b1["backend của khách hàng"] -->|"POST /v1/.../messages"| a1
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
    Note over C,R: SOCKET — hai kênh, nên thứ tự này thực hiện được
    C->>G: message.send
    G->>A: POST /internal/messages
    A->>P: INSERT + COMMIT
    A-->>G: 201 {seq}
    G-->>C: message.ack {seq}
    G->>R: publish chan:{id}
    Note over C,R: REST — một kênh, nên response CHÍNH LÀ ack
    C->>A: POST /v1/channels/:id/messages
    A->>P: INSERT + COMMIT
    A->>R: publish chan:{id}
    A-->>C: 201 {seq, user}`;

export const figFailureShape = `flowchart TB
    p["publish() được gọi"]
    p --> w{"down-window đang mở?"}
    w -->|có| skip["trả về ngay<br/>không gọi client, 0 ms"]
    w -->|không| t["PUBLISH lên subject"]
    t -->|thành công| clear["đóng window"]
    t -->|throw| log["ghi log fanout.publish_failed<br/>channel, message_id,<br/>request_id, environment_id"]
    log --> open["mở window trong 5 s"]
    skip --> resolved["publish RESOLVE"]
    clear --> resolved
    open --> resolved
    resolved --> note["đường gửi vẫn trả 201 trong mọi trường hợp<br/>— nên DÒNG LOG mới là assertion"]
    style note fill:#7f1d1d,color:#fff,stroke:#dc2626
    style skip fill:#064e3b,color:#fff,stroke:#059669`;

export const figMembershipSnapshot = `flowchart LR
    conn["socket mở"] --> sess["POST /internal/session"]
    sess --> set["connection.channelIds<br/>một Set, dựng MỘT LẦN"]
    set --> sub["fanout.subscribe mỗi channel<br/>session.ts:356"]
    sub --> deliver["registry.subscribersOf<br/>session.ts:175<br/>đọc lại cùng Set đó, mỗi frame"]
    deliver --> close["socket đóng"]
    close --> unsub["fanout.unsubscribe<br/>session.ts:398"]
    removed["membership BỊ XOÁ<br/>qua public route"] -.->|"không gì đọc lại"| set
    style removed fill:#7f1d1d,color:#fff,stroke:#dc2626
    style deliver fill:#1e3a8a,color:#fff,stroke:#3b82f6`;
