// Chapter 4.6 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/051-chapter-4-6/baseline.txt.

export const figWhatHasAProducer = `flowchart LR
    subgraph producers["Tables with a producer"]
      p1["webhook_attempts<br/>64 rows — since 4.3"]
      p2["api_requests<br/>11,683 rows — since 4.4"]
      p3["connection_events<br/>154 rows — since 4.5"]
    end
    subgraph orphan["The table the rollup reads"]
      o1["message_events<br/>0 rows"]
      o2["daily_usage<br/>0 rows"]
      o1 --> o2
    end
    loader["scripts/scale/load-analytics.mjs<br/>a batch loader, run by hand"]
    loader -.-> o1
    note["message_events occurs in ZERO files under services/.<br/>Three of FR-ANL-05's four quantities come from it, so<br/>DR-10's 'billing never scans raw events' was satisfied<br/>by a rollup over a table that receives no events."]
    orphan ~~~ note`;

export const figTheKeyCost = `flowchart TB
    corpus["248,155 rows · 91 days · 2,400 channels · 3 environments"]
    v2["daily_usage_v2<br/>(environment_id, channel_id, day)<br/>147,534 rows"]
    bill["daily_usage_billing<br/>(environment_id, day)<br/>281 rows"]
    raw["message_events<br/>248,155 rows"]
    corpus --> v2
    corpus --> bill
    corpus --> raw
    r1["a tenant's 91-day bill<br/>reads 32,778 rows · 4 ms"]
    r2["the same question of the raw table<br/>reads 32,768 rows · 3 ms"]
    v2 --> r1
    raw --> r2
    note["525x the rows, and the table is FULLY MERGED — every row is a<br/>distinct key and OPTIMIZE FINAL changes nothing. A billing read<br/>against it touches more rows than the raw events it replaces.<br/><br/>FR-ANL-09's channel dimension and DR-10's cheap read cannot<br/>share a key. Two rollups, and neither compromises the other."]
    r1 ~~~ note`;

export const figViewVersusBackfill = `flowchart TB
    load["load-analytics.mjs inserts 248,155 rows"]
    view["the materialised view fires<br/>ON THE INSERT"]
    ttl["the TTL deletes rows older than 90 days<br/>ON THE SAME INSERT"]
    back["a backfill reads the table<br/>MINUTES LATER"]
    load --> view
    load --> ttl
    ttl --> back
    vres["242,667 messages · 92 days<br/>oldest 2026-06-16"]
    bres["239,997 messages · 91 days<br/>oldest 2026-06-17"]
    view --> vres
    back --> bres
    note["The difference is exactly one day: the one the TTL removed<br/>while the insert was still running. The view goes first.<br/><br/>So a backfill recovers only what still exists — and a rollup<br/>created late is permanently short by whatever has expired.<br/>The rollups carry no raw TTL precisely so they outlive it."]
    vres ~~~ note`;
