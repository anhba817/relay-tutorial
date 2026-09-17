// Chapter 4.8 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/053-chapter-4-8/baseline.txt.

export const figTheWindowReachesTheStatement = `flowchart TB
    caller["a caller asks for a window<br/>?from=2026-09-16T00:00:00Z' OR 1=1 --"]
    validated["validated as a string, then interpolated<br/>WHERE environment_id = toUUID('...')<br/>AND ts &gt;= '&lt;the caller's text&gt;'"]
    caller --> validated
    scoped["the honest query, one hour, one tenant<br/>0 rows"]
    broken["the same query under the payload<br/>11,683 rows — the whole table"]
    tenants["environments returned: 152<br/>the query names ONE"]
    validated --> broken
    validated --> tenants
    scoped ~~~ broken
    union["' UNION ALL SELECT name FROM system.users --<br/>first row: relay<br/>the ClickHouse account name, out through a customer's log page"]
    broken --> union
    wall["'; DROP TABLE ...; --<br/>Code: 62. Multi-statements are not allowed"]
    union --> wall
    note["The DDL half cannot execute over this transport and the READ half can.<br/>A surface defended by that alone is defended against the loud attack only."]
    wall ~~~ note`;

export const figOneGranule = `flowchart TB
    decl["api_requests: SETTINGS index_granularity = 8192"]
    part["the part on this lane: Compact, 11,695 rows, marks 2"]
    decl --> part
    explain["EXPLAIN indexes=1<br/>PrimaryKey · Granules: 1/1"]
    part --> explain
    page["a 50-row page reads 11,695 rows<br/>the whole table, every window, every filter"]
    explain --> page
    probe["built two ways, same rows, same declared granularity"]
    wide["min_bytes_for_wide_part = 0<br/>Wide · marks 3 · 2 granules"]
    compact["min_bytes_for_wide_part = 10 MiB<br/>Compact · marks 2 · 1 granule"]
    probe --> wide
    probe --> compact
    verdict["The part type decides, not index_granularity.<br/>The key is right and there is nothing to skip<br/>until the table crosses 10 MiB."]
    wide --> verdict
    compact --> verdict`;

export const figThreeReadings = `flowchart TB
    clause["FR-ANL-10: 'end-to-end delivery latency' percentiles, per tenant per hour"]
    a["socket fan-out<br/>commit → frame written to a subscriber's socket"]
    b["webhook<br/>commit → endpoint answered"]
    c["REST read<br/>commit → returned by a history page"]
    clause --> a
    clause --> b
    clause --> c
    ax["message_events.delivery_latency_ms<br/>0 rows · 0 producers · the loader writes NULL on purpose"]
    bx["webhook_attempts.latency_ms<br/>the fetch alone: no commit, no outbox,<br/>no JetStream, no claim, no retry gap"]
    cx["a read nobody made has no latency<br/>and it is pull, not delivery"]
    a --> ax
    b --> bx
    c --> cx
    chosen["CHOSEN. The real-time path constitution II is about,<br/>and the reading the column was created for."]
    ax --> chosen
    note["Neither instant for the chosen reading is recorded.<br/>The commit is the api's and the socket write is the gateway's."]
    chosen --> note`;
