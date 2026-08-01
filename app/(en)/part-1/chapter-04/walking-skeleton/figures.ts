// Chapter 1.4 figures (feature 017). Mermaid sources live here, never in
// page.mdx. Service and frame names come from the documents only.

export const figSkeletonMap = `flowchart TB
    api["API service ✓ STANDING<br/>/healthz · X-Request-Id · JSON logs<br/>(owns REST; the only Postgres writer — ADR-04)"]
    gw["Gateway service ✓ STANDING<br/>/healthz + protocol advertisement<br/>(terminates WebSockets; never writes — ADR-05)"]
    whk["Webhook dispatcher<br/>(Part 3 →)"]
    ing["Analytics ingester<br/>(Part 5 →)"]
    mws["Media worker<br/>(Part 4 →)"]
    dash["Dashboard<br/>(Part 5 →)"]
    api ~~~ gw
    whk ~~~ ing
    mws ~~~ dash`;

export const figRequestThread = `flowchart LR
    req["curl /healthz"]
    svc["service<br/>stamps one fresh UUID"]
    header["response header<br/>X-Request-Id: 639c…e9a"]
    logline["log line (stdout, JSON)<br/>{ …, request_id: 639c…e9a, status: 200 }"]
    grep["grep 639c…e9a *.log<br/>→ the whole story of one request<br/>(NFR-OBS-06: traceable in minutes)"]
    req --> svc
    svc --> header
    svc --> logline
    header --> grep
    logline --> grep`;

export const figPartOneComplete = `flowchart LR
    ch1["1.1 workspace<br/>part1-ch1"]
    ch2["1.2 infrastructure<br/>part1-ch2"]
    ch3["1.3 protocol<br/>part1-ch3"]
    ch4["1.4 skeleton<br/>part1-ch4"]
    done["Part 1 ✓<br/>Part 2 grows the muscles:<br/>sessions, sends, ordering"]
    ch1 --> ch2 --> ch3 --> ch4 --> done`;
