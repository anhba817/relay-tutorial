// Chapter 1.2 figures (feature 014). Mermaid sources live here, never in
// page.mdx.

export const figStoreMap = `flowchart TB
    svcs["Relay's services<br/>(arriving in 1.4 →)"]
    pg[("Postgres<br/>the system of record —<br/>ordering lives here (ADR-03, ADR-04)")]
    nats[("NATS JetStream<br/>the durable event spine (ADR-02)<br/>fed by the outbox (ADR-06)")]
    redis[("Redis<br/>fan-out + presence —<br/>lossy by design (ADR-07, ADR-10)")]
    ch[("ClickHouse<br/>the analytical store, own path<br/>(ADR-08, CON-01)")]
    svcs -.-> pg
    svcs -.-> nats
    svcs -.-> redis
    svcs -.-> ch`;

export const figStartedVsReady = `flowchart LR
    subgraph started["what up -d gives you"]
      s1["postgres: container started"]
      s2["initdb still running…"]
      s3["connections refused"]
      s1 --> s2 --> s3
    end
    subgraph ready["what up -d --wait gives you"]
      r1["healthcheck: pg_isready"]
      r2["retries until it answers"]
      r3["(healthy) — connections accepted"]
      r1 --> r2 --> r3
    end
    started -- "the gap where 1.4's services<br/>would crash-loop" --> ready`;

export const figComposeGate = `flowchart LR
    up["docker compose<br/>up -d --wait"]
    healthy["4 × (healthy)<br/>postgres · redis · nats · clickhouse"]
    gate["pnpm lint<br/>pnpm typecheck<br/>pnpm test<br/>(no Docker needed)"]
    tag["the chapter tag<br/>part1-ch2"]
    up --> healthy --> gate --> tag`;
