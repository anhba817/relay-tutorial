// Chapter 4.1 figures. Mermaid sources live here, never in page.mdx.
// Every number comes from specs/046-chapter-4-1/baseline.txt.

export const figTwoShapes = `flowchart TB
    subgraph op["The operational question, and the shape Part 2 gave it"]
      q1["give me the next 50 messages<br/>in THIS channel after cursor X"]
      i1["UNIQUE (channel_id, sequence)<br/>DR-01 — and chapter 2.4 measured a<br/>second index and dropped it"]
      q1 --> i1
    end
    subgraph an["The analytical question, and the shape it wants"]
      q2["messages and unique active users<br/>per ENVIRONMENT per DAY, over 90 days<br/>(FR-ANL-05, FR-ANL-09)"]
      i2["ORDER BY (environment_id, ts)<br/>SAD 6.2's ClickHouse table"]
      q2 --> i2
    end
    note["messages carries no environment_id and nothing indexes created_at.<br/>The analytical question has to reach its tenant through a join and<br/>its dates through a scan. Neither table is wrong; they are shaped<br/>for different questions, and one table cannot have both shapes."]
    op --- note
    an --- note`;

export const figWhereTheTimeIs = `flowchart LR
    subgraph base["baseline — 585.9 ms"]
      b1["Seq Scan on messages<br/>~140 ms"] --> b2["Hash Join<br/>277 ms"] --> b3["Sort<br/>external merge, 33 MB<br/>656 ms"] --> b4["GroupAggregate<br/>698 ms"]
    end
    subgraph cf["with environment_id and its index — 560.2 ms"]
      c3["Sort<br/>external merge, 33 MB<br/>577 ms"] --> c4["GroupAggregate<br/>619 ms"]
    end
    note["The index removes the join. It does not remove the sort, and the<br/>sort is the cost: count(DISTINCT user_id) per day has to order a<br/>million rows by (day, user_id) every time the question is asked.<br/>Across three corpora the gap between the two conditions is smaller<br/>than the gap between two runs of the same condition."]
    base --- note
    cf --- note`;

export const figWhatItCosts = `flowchart TB
    col["the column<br/>24.8 MB permanent"]
    idx["the index<br/>62.0 MB permanent"]
    bloat["the rewrite<br/>178.6 MB transient,<br/>reclaimed by VACUUM FULL"]
    tbl["the table it is added to<br/>178.6 MB"]
    col --> tot["86.8 MB permanent<br/>+49% of the table"]
    idx --> tot
    tbl -.->|"for comparison"| tot
    bloat -.->|"not permanent, and three<br/>earlier versions of this<br/>number included it"| tot`;
