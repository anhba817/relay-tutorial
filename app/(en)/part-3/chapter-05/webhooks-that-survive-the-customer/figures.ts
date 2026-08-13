// Chapter 3.5 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figThePatternStops = `sequenceDiagram
    participant B as Broker (DELIVERIES)
    participant D as Dispatcher
    participant C as Customer's server
    participant A as api service
    Note over D,A: 3.4 claimed the work and ran the effect in ONE<br/>transaction. Neither half is available here:<br/>the effect is on a machine we do not own, and<br/>the claim is a call to another service.
    D->>C: POST /hook · signed
    C-->>D: 200
    Note over D,A: THE GAP — the customer has the webhook,<br/>the platform has not recorded it,<br/>and nothing has gone wrong yet
    D->>A: report outcome
    A-->>D: delivered
    D--xB: ack
    Note over D: if the process dies in the gap,<br/>the delivery is redelivered and POSTED AGAIN.<br/>The customer absorbs it on the event id`;

export const figTheSchedule = `flowchart TB
    ev["an event on events.><br/>(chapter 3.3's envelope)"]
    claim{"claim the event<br/>consumed_events"}
    dupe["ack — already expanded<br/>by an earlier delivery"]
    rows[("N delivery rows,<br/>one per matching endpoint,<br/>written INSIDE the claim")]
    due{"next_attempt_at &lt;= now()<br/>AND dispatched_at IS NULL?"}
    wait["not yet due — a ROW, not a<br/>message the broker is holding.<br/>Holds no acknowledgement slot"]
    post["dispatcher posts, signed"]
    out{"what did the customer say?"}
    ok["state = delivered"]
    again["attempt + 1 · next_attempt_at<br/>= now + tier[attempt]"]
    dead["attempt 7 exhausted:<br/>state = dead, dead letter written"]
    ev --> claim
    claim -- "no (duplicate)" --> dupe
    claim -- yes --> rows --> due
    due -- no --> wait --> due
    due -- yes --> post --> out
    out -- "2xx" --> ok
    out -- "anything else, or nothing" --> again
    again --> due
    again -- "no tiers left" --> dead`;

export const figWhereItRuns = `flowchart LR
    subgraph api["api service — the ONLY Postgres writer (constitution IV)"]
      http["HTTP handlers<br/>webhook endpoints CRUD"]
      relay["delivery relay<br/>drains what is DUE"]
      internal["/internal/dispatch<br/>expand · material · outcome"]
      pg[("webhook_endpoints<br/>webhook_deliveries<br/>webhook_dead_letters")]
    end
    subgraph disp["dispatcher service — writes NOTHING"]
      expand["expand consumer<br/>events.>"]
      deliver["deliver consumer<br/>deliveries.>"]
    end
    js[("JetStream<br/>EVENTS · DELIVERIES")]
    cust["the customer's server"]
    http --> pg
    relay --> pg
    internal --> pg
    relay --> js
    js --> expand
    js --> deliver
    expand -->|HTTP| internal
    deliver -->|HTTP| internal
    deliver -->|"POST, signed"| cust`;
