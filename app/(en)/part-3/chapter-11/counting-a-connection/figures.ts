// Chapter 3.11 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figWhatABucketIs = `flowchart LR
    subgraph clock["wall clock"]
      m0["minute 00:00"]
      m1["minute 00:01"]
      m2["minute 00:02"]
    end
    open["socket opens<br/>00:00:59"] --> m0
    close["socket closes<br/>00:01:01"] --> m1
    m0 --> c1["charged"]
    m1 --> c2["charged"]
    m2 --> c3["not charged"]
    total["2 seconds of wall clock<br/>TWO connection-minutes"]
    c1 --> total
    c2 --> total
    style c1 fill:#064e3b,color:#fff,stroke:#059669
    style c2 fill:#064e3b,color:#fff,stroke:#059669
    style total fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figTotalsNotDeltas = `flowchart TB
    subgraph delta["a delta protocol"]
      d1["report: +5"] --> d2["report: +5 LOST"]
      d2 --> d3["report: +5"]
      d3 --> d4["credited 10<br/>the lost five are gone"]
    end
    subgraph total["a total protocol"]
      t1["report: 5 total"] --> t2["report: 10 total LOST"]
      t2 --> t3["report: 15 total"]
      t3 --> t4["credited 15<br/>the loss repaired itself"]
    end
    style d4 fill:#7c2d12,color:#fff,stroke:#ea580c
    style t4 fill:#064e3b,color:#fff,stroke:#059669`;

export const figTwoHops = `flowchart LR
    client["client"] -->|"WebSocket upgrade"| gw["gateway"]
    gw -->|"POST /internal/session<br/>Bearer &lt;user token&gt;"| api["api"]
    api -->|"402 quota_exceeded<br/>no Retry-After"| gw
    gw -->|"error frame: quota_exceeded<br/>then close 4008"| client
    style api fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style gw fill:#3f2d63,color:#fff,stroke:#8b5cf6`;

export const figWhatTheApiCannotTell = `stateDiagram-v2
    [*] --> counting: first report
    counting --> counting: report with a higher total<br/>credit the difference
    counting --> counting: report with the same total<br/>credit nothing
    counting --> stopped: reports stop
    stopped --> [*]
    note right of stopped
      A clean close and a killed gateway
      arrive here identically. The api
      cannot tell them apart and does
      not need to — which is why there
      is no reaper anywhere in this design.
    end note`;
