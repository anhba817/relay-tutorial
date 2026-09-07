// Chapter 3.8 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoDirections = `flowchart TB
    out(["Redis is unreachable"])
    subgraph tenant["the TENANT limiter · rl:{env}:{op}:{window}"]
      t1["count unknown"]
      t2["SERVE the request"]
      t3["X-RateLimit-Limit only<br/>Remaining and Reset absent"]
      t1 --> t2 --> t3
    end
    subgraph auth["the AUTH limiter · rlauth:{address}:{window}"]
      a1["count unknown"]
      a2["in-process fallback<br/>same threshold"]
      a3["REFUSE past 10/min<br/>per instance, not per fleet"]
      a1 --> a2 --> a3
    end
    out --> t1
    out --> a1
    why1["a cache outage must not<br/>refuse paid traffic<br/>SAD §6.3"]
    why2["an unlimited window on<br/>failed logins is not a<br/>degradation, it is a hole"]
    t3 -.-> why1
    a3 -.-> why2
    style t2 fill:#064e3b,color:#fff,stroke:#059669
    style a3 fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figTwoPositions = `flowchart LR
    req(["request"])
    rc["RequestContextMiddleware<br/>chapter 2.2"]
    am["AuthenticateMiddleware<br/>chapter 3.2"]
    rl["RateLimitMiddleware<br/>chapter 3.8"]
    cg{"CredentialGuard"}
    h["handler"]
    req --> rc --> am --> rl --> cg --> h
    inside[["the AUTH counter lives<br/>INSIDE this middleware:<br/>it must work when there<br/>is no principal"]]
    after[["the TENANT limiter comes<br/>AFTER it: the limit belongs<br/>to an environment and only<br/>this step knows which"]]
    am -.-> inside
    rl -.-> after
    style am fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style rl fill:#064e3b,color:#fff,stroke:#059669`;

export const figBoundaryBurst = `flowchart TB
    subgraph w1["window N · 12:00:00 – 12:00:59"]
      b1["600 requests<br/>at 12:00:59"]
    end
    subgraph w2["window N+1 · 12:01:00 – 12:01:59"]
      b2["600 requests<br/>at 12:01:00"]
    end
    cost["1,200 requests in two seconds<br/>against a limit of 600 per minute"]
    b1 --> cost
    b2 --> cost
    gain["Reset names ONE moment.<br/>A refilling bucket's honest<br/>answer is a curve, and the<br/>header has room for a number."]
    cost -.->|"the price"| gain
    style cost fill:#78350f,color:#fff,stroke:#d97706
    style gain fill:#064e3b,color:#fff,stroke:#059669`;
