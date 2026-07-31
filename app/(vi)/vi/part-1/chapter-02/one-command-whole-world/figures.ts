// Hình minh họa chương 1.2 (feature 014). Mã mermaid sống ở đây, không bao
// giờ nằm trong page.mdx. Tên store, tên lệnh, tên tag giữ nguyên tiếng Anh.

export const figStoreMap = `flowchart TB
    svcs["Các service của Relay<br/>(đến ở chương 1.4 →)"]
    pg[("Postgres<br/>system of record — thứ tự tin nhắn<br/>sống ở đây (ADR-03, ADR-04)")]
    nats[("NATS JetStream<br/>xương sống sự kiện bền vững (ADR-02)<br/>được outbox bơm vào (ADR-06)")]
    redis[("Redis<br/>fan-out + presence —<br/>chấp nhận mất, có chủ đích (ADR-07, ADR-10)")]
    ch[("ClickHouse<br/>kho phân tích, đi đường riêng<br/>(ADR-08, CON-01)")]
    svcs -.-> pg
    svcs -.-> nats
    svcs -.-> redis
    svcs -.-> ch`;

export const figStartedVsReady = `flowchart LR
    subgraph started["những gì up -d trao cho bạn"]
      s1["postgres: container đã start"]
      s2["initdb vẫn đang chạy…"]
      s3["kết nối bị từ chối"]
      s1 --> s2 --> s3
    end
    subgraph ready["những gì up -d --wait trao cho bạn"]
      r1["healthcheck: pg_isready"]
      r2["thử lại đến khi có hồi đáp"]
      r3["(healthy) — sẵn sàng nhận kết nối"]
      r1 --> r2 --> r3
    end
    started -- "khoảng trống nơi các service của 1.4<br/>sẽ crash-loop" --> ready`;

export const figComposeGate = `flowchart LR
    up["docker compose<br/>up -d --wait"]
    healthy["4 × (healthy)<br/>postgres · redis · nats · clickhouse"]
    gate["pnpm lint<br/>pnpm typecheck<br/>pnpm test<br/>(không cần Docker)"]
    tag["tag của chương<br/>part1-ch2"]
    up --> healthy --> gate --> tag`;
