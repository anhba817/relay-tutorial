// Chapter 3.4 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTheOtherGap = `sequenceDiagram
    participant B as Broker (EVENTS)
    participant R as Consumer runtime
    participant PG as PostgreSQL
    B->>R: deliver event · attempt 1
    R->>PG: BEGIN · insert consumed_events · run handler · COMMIT
    PG-->>R: committed
    Note over R,B: THE OTHER GAP — the work is done,<br/>the broker does not know it, and<br/>nothing has gone wrong yet
    R--xB: ack
    Note over R: the process dies here
    B->>R: deliver event · attempt 2 · redelivered
    R->>PG: insert consumed_events
    PG-->>R: conflict — already handled
    Note over R,PG: the handler does not run again.<br/>The ledger remembers what the<br/>acknowledgement forgot`;

export const figOutcomes = `flowchart TB
    msg["a delivery arrives<br/>(attempt N)"]
    parse{"does it parse<br/>as an event?"}
    term["term() — stop delivering it.<br/>The same bytes fail the same way,<br/>and nothing catches what lands here"]
    claim{"did this call win<br/>the consumed_events row?"}
    dupe["ack — already handled,<br/>just not by this delivery"]
    run["run the handler<br/>inside the claim's transaction"]
    ok{"did it return?"}
    ack["ack — handled once, in effect"]
    nak["nak — the claim rolled back with it.<br/>Redelivered until max_deliver = 5,<br/>then dropped (measured, not assumed)"]
    msg --> parse
    parse -- no --> term
    parse -- yes --> claim
    claim -- "no (duplicate)" --> dupe
    claim -- yes --> run --> ok
    ok -- yes --> ack
    ok -- "threw" --> nak`;

export const figWhereItRuns = `flowchart LR
    subgraph api["api service — the only Postgres writer (ADR-04)"]
      http["HTTP handlers<br/>write messages"]
      relay["outbox relay<br/>chapter 3.3"]
      consumer["consumer runtime<br/>this chapter"]
      ledger[("consumed_events<br/>the dedup ledger")]
    end
    js[("JetStream stream EVENTS<br/>subjects events.>, retention limits,<br/>max_age 7 days, max_bytes 1 GiB")]
    http --> relay --> js
    js --> consumer --> ledger
    note["It lives here because the handler writes to Postgres,<br/>and ADR-04 says one process does that. A separate<br/>worker service is Part 5's, when it has earned one"]
    api ~~~ note`;
