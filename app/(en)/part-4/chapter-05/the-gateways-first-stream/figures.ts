// Chapter 4.5 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/050-chapter-4-5/baseline.txt.

export const figTwoCounters = `flowchart TB
    subgraph existing["Since 3.24 — the quota counter"]
      e1["meter.ts<br/>minute buckets touched"]
      e2["POST /internal/usage/connections<br/>every 60 s, 1..5000 entries"]
      e3["Postgres usage_connections<br/>refuses a connection SYNCHRONOUSLY"]
      e1 --> e2 --> e3
    end
    subgraph new["This chapter — the analytical record"]
      n1["connection-log<br/>an event at open, an event at close"]
      n2["ANALYTICS<br/>buffered 5 s, one message per record"]
      n3["ClickHouse connection_events<br/>cannot refuse anything"]
      n1 --> n2 --> n3
    end
    note["Same quantity, two counters, on purpose.<br/>A quota must refuse a send synchronously, so its counter<br/>cannot live downstream of a lossy stream — and a lossy<br/>stream is what keeps the analytical path independent.<br/>The reconciler between them is movement IV's."]
    existing ~~~ new
    new ~~~ note`;

export const figNeitherBalances = `flowchart TB
    start["5 connections open, held past one flush"]
    clean["SIGTERM<br/>sessions.close() runs"]
    kill["SIGKILL<br/>nothing runs"]
    cres["records: opened 5 · closed 0<br/>meter billed: 5 connection-minutes"]
    kres["records: opened 5 · closed 0<br/>meter billed: 0 connection-minutes"]
    start --> clean --> cres
    start --> kill --> kres
    why["wss.close() stops the server ACCEPTING and does not close<br/>established sockets — so no close handler fires on either path.<br/>The meters then diverge in opposite directions: reportOnce walks<br/>the registry and bills 5, a kill sends no final report and bills 0.<br/><br/>That is why the reconciliation scopes to connections with BOTH<br/>records, over a window every one of them closed inside."]
    cres ~~~ why
    kres ~~~ why`;

export const figTheBudget = `flowchart LR
    budget["ANALYTICS<br/>max_bytes 1 GiB · max_age 7 days<br/>= 1,775.4 B/s"]
    req["request record<br/>320 B synthetic<br/>403.5 B measured"]
    conn["connection PAIR<br/>750.8 B"]
    cross["7-day crossover<br/>5.55 req/s from the probe<br/>4.40 req/s from the stream"]
    budget --> req --> cross
    budget --> conn
    note["A connection pair costs what 2.35 requests cost, so the<br/>volume assumption is right by COUNT and inverts by BYTES<br/>for any session shorter than 2.35 requests — which is the<br/>shape a WebSocket client has. And the stream's own<br/>accounting is 26% heavier than the probe that sized it."]
    cross ~~~ note`;
