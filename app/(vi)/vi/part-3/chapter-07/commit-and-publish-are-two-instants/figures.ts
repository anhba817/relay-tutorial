// Hình minh họa chương 3.7. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và code.

export const figTwoInstants = `sequenceDiagram
    participant D as gateway của người gửi
    participant A as api service
    participant PG as PostgreSQL
    participant R as Redis fabric
    participant T as gateway của Tuấn (đang resume)
    D->>A: gửi "still coming down"
    A->>PG: commit · cấp seq 4
    A-->>D: 201 · seq 4
    Note over A,PG: BỀN VỮNG TỪ ĐÂY — mọi truy vấn backfill đều thấy seq 4
    T->>A: backfill, cursor = 1
    A->>PG: SELECT seq > 1
    A-->>T: 2, 3, 4
    Note over T: mark = 4 · flush · phase = live
    D->>R: publish seq 4
    Note over D,R: LOAN BÁO TỪ ĐÂY — và resume thì đã xong rồi
    R->>T: seq 4
    Note over T: chương 2.7: không còn gì để đối chiếu → GIAO HAI LẦN`;

export const figFourQuadrants = `flowchart TB
    subgraph during["publish TRONG LÚC đang buffer"]
      d1["seq <= mark<br/>test 1 · bị flushable chặn"]
      d2["seq > mark<br/>test 2 · flush giao đi"]
    end
    subgraph after["publish SAU KHI đã live"]
      a1["seq <= mark<br/>KHÔNG CÓ TEST — chỗ lỗi nằm"]
      a2["seq > mark<br/>test 3 · giao live"]
    end
    note["ba test, bốn ô·<br/>ô trống chỉ cách test ngay trên nó<br/>đúng một con số"]
    a1 -.-> note
    style a1 fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figWhereTheMarkLives = `flowchart LR
    subgraph resume["resume, chương 2.7"]
      s1["1 subscribe"]
      s2["2 buffer"]
      s3["3 backfill<br/>ghi lại mark H"]
      s4["4 flush<br/>phát seq > H"]
    end
    s5["5 live"]
    keep[["chương 3.7:<br/>GIỮ H trên Connection"]]
    del{"deliver()"}
    drop["seq <= H<br/>client đã có rồi"]
    send["seq > H<br/>gửi"]
    s1 --> s2 --> s3 --> s4 --> s5
    s3 -.->|"H, thu hẹp theo<br/>các cursor client đưa"| keep
    s5 --> del
    keep --> del
    del -- "suppressed" --> drop
    del -- "còn lại" --> send
    style keep fill:#064e3b,color:#fff,stroke:#059669`;
