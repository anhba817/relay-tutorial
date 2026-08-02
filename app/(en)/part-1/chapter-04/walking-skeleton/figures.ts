// Chapter 1.4 figures (feature 017; revised in 019 for ADR-15). Mermaid
// sources live here, never in page.mdx. Service and frame names come from
// the documents only.

export const figFrameworkBoundary = `flowchart LR
    subgraph apiSide["services/api — NestJS (ADR-15)"]
      mod["AppModule<br/>module graph · DI"]
      ctl["HealthController"]
      mw["request-id middleware"]
      flt["protocol error filter"]
      mod --> ctl
      mod --> mw
      mod --> flt
    end
    subgraph gwSide["services/gateway — no framework, by decision"]
      serve["service-kit serve()<br/>raw node:http"]
    end
    kit["@relay/service-kit<br/>logger · request ids<br/>(one home, both sides)"]
    kit --> apiSide
    kit --> gwSide
    note["The framework serves the wide CRUD surface<br/>and stops at the gateway's door:<br/>socket mechanics get no layers between<br/>the code and the wire (ADR-15)"]
    gwSide ~~~ note`;

export const figSkeletonMap = `flowchart TB
    api["API service ✓ STANDING — a NestJS application (ADR-15)<br/>/healthz · X-Request-Id · JSON logs<br/>(owns REST; the only Postgres writer — ADR-04)"]
    gw["Gateway service ✓ STANDING — frameworkless, by decision (ADR-15)<br/>/healthz + protocol advertisement<br/>(terminates WebSockets; never writes — ADR-05)"]
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
