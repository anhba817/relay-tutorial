// Chapter 4.7 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/052-chapter-4-7/baseline.txt.

export const figWhichOperationalCount = `flowchart TB
    clause["FR-ANL-06: 'counts derived from operational data'"]
    a["messages, through channels<br/>19,012"]
    b["usage_periods.messages_sent<br/>18,962"]
    clause --> a
    clause --> b
    agg["aggregated: 0.2630%<br/>a number nobody would question"]
    per["per tenant-period: 1,385 compared<br/>61 disagree · 49 OVER the 0.1% bound"]
    a --> agg
    b --> agg
    a --> per
    b --> per
    note["Both are derived from operational data and the clause chooses neither.<br/>Every disagreement is a fixture: a raw INSERT bypasses the counter,<br/>a hard DELETE removes a row the counter already counted.<br/>0 of 1,385 disagree for a non-fixture reason — sendMessage writes<br/>the message and increments the counter in one transaction."]
    per ~~~ note`;

export const figTheVerdicts = `flowchart TB
    start["one tenant, one period, one quantity"]
    q1{"does an operational<br/>counterpart EXIST?"}
    q2{"is either side<br/>absent?"}
    q3{"are BOTH sides<br/>absent?"}
    q4{"difference<br/>&le; 0.1%?"}
    nc["not-comparable<br/>stored message count: no operational<br/>source anywhere in this platform"]
    nd["no-data<br/>this tenant holds nothing on either side"]
    br["breach"]
    ps["pass"]
    start --> q1
    q1 -- no --> nc
    q1 -- yes --> q3
    q3 -- yes --> nd
    q3 -- no --> q2
    q2 -- yes --> br
    q2 -- no --> q4
    q4 -- no --> br
    q4 -- yes --> ps
    note["PRESENCE BEFORE ARITHMETIC, so only a comparison with both<br/>sides present ever reaches a division. And this is not an edge<br/>case: 4 environment ids in the rollup, none of which exist in<br/>Postgres, against 1,313 with operational usage and no rollup<br/>rows. EVERY tenant in the platform is one-sided."]
    nc ~~~ note`;

export const figWhereTheBoundCannotHold = `flowchart TB
    subgraph unreachable["The 0.1% bound cannot be met — and none of these is a defect"]
      u1["unique active users<br/>uniq is EXACT to 65,536<br/>0.5676% at 65,537"]
      u2["any quantity at the retention edge<br/>0% just after midnight<br/>1.0989% just before the next"]
      u3["connection-minutes<br/>the meter bills every calendar minute OPEN<br/>the records bill only connections that CLOSED<br/>44 of 99 hold an open and no close"]
    end
    subgraph reachable["What the lane can actually check"]
      r1["a PLANTED drift, every run"]
      r2["100,000 vs 99,000 → 1.0000% → breach → exit 1"]
      r3["100,000 vs 100,000 → 0.0000% → pass → exit 0"]
      r1 --> r2
      r1 --> r3
    end
    note["The cliff is at 2^16 and one distinct user wide. The retention<br/>gap is a curve, not a number — 047 published 0.49% and that is<br/>one point on it, a run at about 10:48. A chapter that averaged<br/>the three would publish a percentage that means nothing."]
    unreachable ~~~ note`;
