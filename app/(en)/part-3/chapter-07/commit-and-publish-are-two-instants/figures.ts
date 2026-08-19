// Chapter 3.7 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTwoInstants = `sequenceDiagram
    participant D as dispatcher's gateway
    participant A as api service
    participant PG as PostgreSQL
    participant R as Redis fabric
    participant T as Tuan's gateway (resuming)
    D->>A: send "still coming down"
    A->>PG: commit · seq 4 assigned
    A-->>D: 201 · seq 4
    Note over A,PG: DURABLE HERE — any backfill query can see seq 4
    T->>A: backfill, cursor = 1
    A->>PG: SELECT seq > 1
    A-->>T: 2, 3, 4
    Note over T: mark = 4 · flush · phase = live
    D->>R: publish seq 4
    Note over D,R: ANNOUNCED HERE — and the resume is already over
    R->>T: seq 4
    Note over T: chapter 2.7: nothing left to compare against → DELIVERED TWICE`;

export const figFourQuadrants = `flowchart TB
    subgraph during["published WHILE buffering"]
      d1["seq <= mark<br/>test 1 · suppressed by flushable"]
      d2["seq > mark<br/>test 2 · delivered by the flush"]
    end
    subgraph after["published AFTER going live"]
      a1["seq <= mark<br/>NO TEST — the defect"]
      a2["seq > mark<br/>test 3 · delivered live"]
    end
    note["three tests, four cells·<br/>the empty one is one number<br/>from the test above it"]
    a1 -.-> note
    style a1 fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figWhereTheMarkLives = `flowchart LR
    subgraph resume["the resume, chapter 2.7"]
      s1["1 subscribe"]
      s2["2 buffer"]
      s3["3 backfill<br/>note mark H"]
      s4["4 flush<br/>emit seq > H"]
    end
    s5["5 live"]
    keep[["chapter 3.7:<br/>KEEP H on the Connection"]]
    del{"deliver()"}
    drop["seq <= H<br/>the client has it"]
    send["seq > H<br/>send"]
    s1 --> s2 --> s3 --> s4 --> s5
    s3 -.->|"H, scoped to the<br/>presented cursors"| keep
    s5 --> del
    keep --> del
    del -- "suppressed" --> drop
    del -- "otherwise" --> send
    style keep fill:#064e3b,color:#fff,stroke:#059669`;
