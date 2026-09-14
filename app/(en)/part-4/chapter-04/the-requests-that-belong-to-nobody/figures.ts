// Chapter 4.4 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/049-chapter-4-4/baseline.txt.

export const figTwoPopulations = `flowchart TB
    subgraph every["FR-ANL-01 — an event for EVERY API request"]
      e1["/healthz, signup, every 404, every 401"]
      e2["every call the dispatcher and gateway<br/>make on the internal seam"]
      e3["a tenant's own /v1 requests"]
    end
    subgraph per["FR-ANL-07 — a queryable request log PER TENANT"]
      p1["needs an environment_id"]
    end
    e3 --> p1
    e1 -.->|"no principal at all"| none["no tenant"]
    e2 -.->|"PlatformPrincipal carries<br/>environmentId?: undefined<br/><b>by design</b>"| none
    note["Measured over a stated workload: 54 requests, 34 with no tenant.<br/>application 20 of 20 attributed · platform 18 of 18 tenantless<br/>· none 16 of 16 tenantless.<br/><br/>The gap is widest exactly where the traffic is: the seam the<br/>platform calls on every message and every connection."]
    none ~~~ note`;

export const figWhereTheRecordIsMade = `flowchart LR
    r["request"]
    m1["1 RequestContext<br/>mints the id"]
    m2["2 <b>RequestLog</b><br/>attaches finish listener"]
    m3["3 Authenticate<br/>sets req.principal"]
    m4["4 RateLimit<br/>429: res.end(); return;<br/><b>never calls next()</b>"]
    h["handler"]
    r --> m1 --> m2 --> m3 --> m4 --> h
    m4 -.->|"refused"| fin["response finishes"]
    h --> fin
    fin -->|"listener fires, reads req.principal NOW"| rec["one record"]
    note["Registered fourth, the producer is never reached for a 429 —<br/>and a rate-limited request is the one an operator opens a<br/>request log to find. Second, it attaches before anything can<br/>short-circuit and reads the principal when the listener fires.<br/><b>Attach early, read late.</b>"]
    rec ~~~ note`;

export const figTheConsumerThatTerminates = `flowchart TB
    pub["the producer publishes<br/>analytics.api.request.{env|_none}"]
    con["analytics-ingester<br/>filter_subject: analytics.&gt;<br/>the widest the grammar admits"]
    sh["shape() wants delivery_id, endpoint_id,<br/>event_id, attempt, outcome"]
    nul["null"]
    term["m.term()<br/>never redelivered"]
    pub --> con --> sh --> nul --> term
    inst["stream:   2 of 2 messages present<br/>consumer: num_pending 0 · ack_pending 0"]
    term --> inst
    note["Both instruments report nothing wrong. retention: Limits keeps a<br/>terminated message, so depth says the record is there; the consumer<br/>says there is nothing to do. The only trace is one error line<br/>carrying a stream sequence and no type."]
    inst ~~~ note`;
