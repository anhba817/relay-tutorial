// Hình minh họa chương 3.4. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và code.

export const figTheOtherGap = `sequenceDiagram
    participant B as Broker (EVENTS)
    participant R as Consumer runtime
    participant PG as PostgreSQL
    B->>R: deliver event · attempt 1
    R->>PG: BEGIN · insert consumed_events · run handler · COMMIT
    PG-->>R: committed
    Note over R,B: THE OTHER GAP — work đã xong,<br/>broker chưa biết, và<br/>chưa có gì báo sai
    R--xB: ack
    Note over R: process chết ở đây
    B->>R: deliver event · attempt 2 · redelivered
    R->>PG: insert consumed_events
    PG-->>R: conflict — đã handled
    Note over R,PG: handler không chạy lại.<br/>Ledger nhớ thứ<br/>acknowledgement đã quên`;

export const figOutcomes = `flowchart TB
    msg["một delivery đến<br/>(attempt N)"]
    parse{"nó parse được<br/>như một event không?"}
    term["term() — ngừng deliver nó.<br/>Cùng bytes fail cùng cách,<br/>và không gì catch thứ rơi vào đây"]
    claim{"call này có thắng<br/>row consumed_events không?"}
    dupe["ack — đã handled,<br/>chỉ không phải bởi delivery này"]
    run["chạy handler<br/>bên trong transaction của claim"]
    ok{"nó return không?"}
    ack["ack — handled một lần, in effect"]
    nak["nak — claim rollback cùng nó.<br/>Redelivered tới max_deliver = 5,<br/>rồi bị drop (đã đo, không giả định)"]
    msg --> parse
    parse -- no --> term
    parse -- yes --> claim
    claim -- "no (duplicate)" --> dupe
    claim -- yes --> run --> ok
    ok -- yes --> ack
    ok -- "threw" --> nak`;

export const figWhereItRuns = `flowchart LR
    subgraph api["api service — Postgres writer duy nhất (ADR-04)"]
      http["HTTP handlers<br/>write messages"]
      relay["outbox relay<br/>chương 3.3"]
      consumer["consumer runtime<br/>chương này"]
      ledger[("consumed_events<br/>dedup ledger")]
    end
    js[("JetStream stream EVENTS<br/>subjects events.>, retention limits,<br/>max_age 7 days, max_bytes 1 GiB")]
    http --> relay --> js
    js --> consumer --> ledger
    note["Nó sống ở đây vì handler write vào Postgres,<br/>và ADR-04 nói chỉ một process làm việc đó. Worker service<br/>riêng là của Phần 5, khi nó đã chứng minh cần có"]
    api ~~~ note`;
