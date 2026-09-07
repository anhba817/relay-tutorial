// Chapter 3.10 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoPromises = `flowchart LR
    subgraph limit["chapter 3.8 · a rate limit"]
      l1["Redis counter<br/>rl:{environment_id}:{window}"]
      l2["window: 60 seconds"]
      l3["a flush costs<br/>ONE WINDOW of over-service"]
      l1 --> l2 --> l3
    end
    subgraph quota["chapter 3.10 · a quota"]
      q1["usage_periods<br/>(environment_id, period)"]
      q2["period: one calendar month"]
      q3["a flush costs<br/>NOTHING"]
      q1 --> q2 --> q3
    end
    style l3 fill:#7c2d12,color:#fff,stroke:#ea580c
    style q3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figWhereItIsEnforced = `flowchart TB
    rest["POST /v1/channels/:id/messages"] --> mw["RateLimitMiddleware"]
    ws["POST /internal/messages<br/>(the gateway, for a WebSocket send)"] -.->|"operationsFor returns []"| mw
    mw --> svc["MessagesService.send"]
    ws --> svc
    svc --> repo["Repository.sendMessage<br/>ONE transaction"]
    repo --> check["read caps + usage"]
    check --> msg["INSERT messages"]
    msg --> out["INSERT outbox"]
    out --> usage["INSERT usage_periods<br/>ON CONFLICT DO UPDATE"]
    usage --> cross["INSERT quota_notifications<br/>for each threshold crossed"]
    style mw fill:#7c2d12,color:#fff,stroke:#ea580c
    style repo fill:#064e3b,color:#fff,stroke:#059669`;

export const figNoSweep = `flowchart TB
    subgraph obvious["the obvious design"]
      s1["every 5 minutes"] --> s2["walk EVERY environment"]
      s2 --> s3["compare usage to cap"]
      s3 --> s4["a global operation:<br/>the guard, an exemption entry,<br/>a lint ignore, a careful test"]
    end
    subgraph actual["what a send already knows"]
      a1["usage rises ONLY on a send"] --> a2["the transaction holds<br/>before AND after"]
      a2 --> a3["so it knows what it crossed"]
      a3 --> a4["no sweep, no exemption,<br/>no file joins any list"]
    end
    style s4 fill:#7c2d12,color:#fff,stroke:#ea580c
    style a4 fill:#064e3b,color:#fff,stroke:#059669`;

export const figOutboxFourth = `flowchart LR
    o1["chapter 3.3<br/>outbox<br/>published_at"]
    o2["chapter 3.5<br/>webhook_deliveries<br/>state · next_attempt_at"]
    o3["chapter 3.9<br/>webhook_disable_notifications<br/>delivered_at"]
    o4["chapter 3.10<br/>quota_notifications<br/>delivered_at"]
    o1 --> o2 --> o3 --> o4
    note["four concrete tables that look alike is a PATTERN.<br/>one abstract table serving four purposes is a FRAMEWORK."]
    o4 -.-> note
    style o4 fill:#064e3b,color:#fff,stroke:#059669`;
