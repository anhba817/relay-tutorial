// Chapter 3.6 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTheTimeline = `gantt
    title One failing delivery, measured against the one-hour rule
    dateFormat X
    axisFormat %H:%M
    section Attempts
    1 · +0s          :milestone, 0, 0
    2 · +1s          :milestone, 1, 0
    3 · +6s          :milestone, 6, 0
    4 · +36s         :milestone, 36, 0
    5 · +5m36s       :milestone, 336, 0
    6 · +35m36s      :milestone, 2136, 0
    7 · +2h35m36s    :milestone, 9336, 0
    section The rule
    one hour elapses here :crit, milestone, 3600, 0
    section The gap
    nothing happens at the hour :active, 2136, 9336`;

export const figTwoTriggers = `flowchart TB
    out["an outcome is recorded<br/>recordAttemptOutcome"]
    run{"failed?"}
    clear["run cleared<br/>both columns null"]
    open["run opened or extended<br/>started_at · attempts + 1"]
    check{"over 1h AND >= 5 attempts?"}
    sweep["the relay's loop<br/>one query per drain"]
    find{"any endpoint whose run<br/>has outrun the hour?"}
    disable["disable, ONCE<br/>UPDATE ... WHERE enabled = true"]
    note["zero rows updated:<br/>somebody got there first"]
    notify[("webhook_disable_notifications<br/>delivered_at NULL")]
    out --> run
    run -- "2xx" --> clear
    run -- "anything else" --> open --> check
    check -- no --> wait["nothing to do"]
    check -- yes --> disable
    sweep --> find
    find -- no --> wait
    find -- yes --> disable
    disable -- "1 row" --> notify
    disable -- "0 rows" --> note`;

export const figWhereTheRecordGoes = `flowchart LR
    disp["dispatcher<br/>posts, measures, reports"]
    subgraph api["api service — the ONLY Postgres writer"]
      outcome["/internal/dispatch/outcome"]
      tx[["ONE transaction:<br/>delivery state · failure run<br/>· disable · notification"]]
      pub["publishAttempt<br/>AFTER the commit"]
    end
    pg[("PostgreSQL<br/>operational")]
    js[("JetStream ANALYTICS<br/>analytics.webhook.attempt.env")]
    p4["Part 4's ingester<br/>NOT BUILT YET"]
    ch[("ClickHouse<br/>NOT BUILT YET")]
    disp -->|"status · latency · error"| outcome
    outcome --> tx --> pg
    tx -.->|"commits first"| pub
    pub -->|"at-most-once<br/>failure logged and dropped"| js
    js -.-> p4 -.-> ch
    pub -.->|"NEVER blocks"| outcome`;
