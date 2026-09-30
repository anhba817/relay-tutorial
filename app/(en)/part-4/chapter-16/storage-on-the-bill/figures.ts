// Chapter 4.16 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/062-chapter-4-16/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figWhatTheTwoSidesHold = `flowchart TB
    subgraph meter["what the meter charges — 8,662 rows, ~4,440 MB"]
      m1["PENDING 6,580 rows · 4,436 MB<br/>slots reserved, never uploaded to"]
      m2["READY 2,082 rows · 3,666 kB"]
    end
    subgraph store["what the bucket holds — 1,775 objects, 30.7 MB"]
      s1["objects with a media_objects row: 1,328"]
      s2["keys with NO row at all: 447 · 24.3 MB"]
    end
    meter -->|"the comparison DR-17 asks for"| verdict
    store --> verdict
    verdict["a reservation against a delivery<br/>99.9% of the gap is outstanding slots<br/><br/>so the verdict has THREE outcomes:<br/>agree · reservations-only · a direction"]`;

export const figThreeStores = `flowchart LR
    ch["ClickHouse<br/>daily_usage_billing<br/>sum(stored_bytes_delta)"] --> f
    mo["the object store<br/>one signed listing<br/>1,775 keys and their sizes"] --> f
    pg["Postgres<br/>media_objects WHERE state = 'pending'<br/>object_key + declared_bytes"] --> f
    f["reconcileStorage"]
    f --> out["metered · inStore · reserved"]
    note["the analytical side records 'reserved'<br/>and NO 'uploaded' event —<br/>so it cannot tell an outstanding slot<br/>from a delivered object"]
    note -.->|"which is why there are three"| f
    note2["and which reservations are STILL outstanding<br/>only the inventory can answer:<br/>267 of 6,580 pending rows<br/>name a key the bucket holds"]
    note2 -.-> f`;

export const figOneLostDelta = `flowchart LR
    subgraph dist["one lost record, over 8,941 chargeable objects"]
      a["min<br/>1 B"]
      b["p50<br/>1,024 B"]
      c["mean<br/>521,671 B"]
      d["p99 and max<br/>26,214,400 B"]
    end
    b -->|"509x"| c
    subgraph share["as a share of the tenant's own level, 925 tenants"]
      e["the median tenant's<br/>median object: 14.89%"]
      f["its WORST object: 50.00%"]
      g["the worst case anywhere: 99.96%"]
    end
    dist --> perm["and it never self-corrects:<br/>a sum of deltas is re-sampled by nothing"]
    share --> perm`;

export const figDeltaVersusSample = `flowchart TB
    subgraph delta["a summed delta — what DR-17 asks for"]
      d1["fires on INSERT, needs no runner"]
      d2["one lost record is wrong FOR EVER"]
      d3["bounded by the rollup's 25-month TTL"]
    end
    subgraph sample["a sampled level — the alternative"]
      s1["self-correcting: the next sample is the truth"]
      s2["needs something to run daily"]
      s3["this platform has NO scheduler<br/>zero schedule: triggers, ADR-28"]
    end
    delta --> chosen["chosen, and the clause chose it first"]
    sample --> refused["unbuildable here, not merely unchosen"]
    chosen --> repair["so the inventory is the re-base:<br/>the store holds the level directly,<br/>not as a sum"]`;
