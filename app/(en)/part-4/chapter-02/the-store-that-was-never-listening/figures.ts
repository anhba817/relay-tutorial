// Chapter 4.2 figures. Mermaid sources live here, never in page.mdx.
// Every number in these diagrams is from specs/047-chapter-4-2/baseline.txt.

export const figTwoOrderings = `flowchart TB
    subgraph pg["Postgres — ordered by nothing this question asks for"]
      pgt["messages<br/>PRIMARY KEY (id)<br/>no environment_id on the row"]
      pgq["the join finds the tenant,<br/>then 1,052,655 rows are SORTED<br/>to be grouped by day"]
      pgn["585.9 ms<br/>join 140 ms · sort 656 ms"]
      pgt --> pgq --> pgn
    end
    subgraph ch["ClickHouse — ordered by exactly this question"]
      cht["message_events<br/>ORDER BY (environment_id, ts)<br/>environment_id IS the row"]
      chq["the range is contiguous,<br/>so there is no join and<br/>nothing to sort"]
      chn["13.22 ms<br/>granules 131/154"]
      cht --> chq --> chn
    end
    note["Same question, same ninety days, same 91 rows of answer.<br/>The row store is not slow at being a row store —<br/>it is being asked a question its ordering says nothing about."]
    ch ~~~ note`;

export const figWhereTheRowsGo = `flowchart LR
    raw["message_events<br/>1,241,029 rows"]
    mv["daily_usage<br/>363 rows"]
    q1["the raw query reads<br/>1,052,655 rows"]
    q2["the rollup reads<br/>315 rows"]
    raw -->|"materialised view,<br/>on the way in"| mv
    raw --> q1
    mv --> q2
    note["3,342x fewer rows read, and 19% less time.<br/>At a million rows the scan is not what costs.<br/>What changes is the SHAPE of the cost: 1,052,655 grows<br/>with the tenant, 315 grows with the calendar."]
    q2 ~~~ note`;

export const figTheBoundaryDay = `flowchart TB
    ins["INSERT — the view counts the day WHOLE<br/>2026-06-15: 11,161 messages"]
    ttl["TTL cuts at a TIMESTAMP<br/>ts + 90 days &lt; now()"]
    raw["message_events keeps 6,220<br/>— the part of the day still inside ninety days"]
    roll["daily_usage keeps 11,161<br/>— it has no TTL, and a day is its finest grain"]
    gap["difference 4,941 — 0.49% of the ninety-day total,<br/>against FR-ANL-06's 0.1%"]
    ins --> ttl
    ttl --> raw
    ins --> roll
    raw --> gap
    roll --> gap
    note["90 of 91 days agree EXACTLY. The 91st cannot,<br/>and it is the oldest one, and the gap moves<br/>continuously as now() advances through it."]
    gap ~~~ note`;
