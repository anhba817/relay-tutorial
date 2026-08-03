// Chapter 2.5 figures (feature 020 — DRAFT, unpublished). Mermaid sources
// live here, never in page.mdx. Frame names come from @relay/protocol only.

export const figConnectWalk = `sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as API service
    C->>G: WS upgrade /v1/ws?token=…
    G->>G: verify JWT (jose) — bad token → close 4001
    G->>A: GET /internal/memberships {user}
    A-->>G: channel ids
    G->>G: register connection · start ping/30s
    G-->>C: frame connection.ack {user, cursor} (≤1s, EIR-WS-03)
    Note over C,G: the socket is open — frames may flow`;

export const figSendOverSocket = `sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as API service
    participant P as PostgreSQL
    C->>G: frame message.send {idem_key, channel, text}
    G->>G: safeParse against @relay/protocol — garbage → error + 4002
    G->>A: POST /internal/messages
    A->>P: the 2.2/2.3 write path (lock · seq · ON CONFLICT)
    A-->>G: 201 {message, seq}
    G-->>C: frame message.ack {seq}
    Note over G,A: the gateway carried, the api decided —<br/>ADR-05: sends travel the socket,<br/>writes happen in one place`;

export const figGatewayAnatomy = `flowchart TB
    subgraph gw["services/gateway — still frameworkless (ADR-15)"]
      up["HTTP server (1.4's serve)<br/>+ WS upgrade on /v1/ws"]
      auth["auth.ts — jose verify,<br/>close 4001 on failure"]
      sess["session.ts — one object per socket:<br/>user, env, subscriptions, cursors"]
      reg["registry.ts — in-memory<br/>connection map (this chapter)"]
      up --> auth --> sess --> reg
    end
    note["No store access anywhere in this box —<br/>the gateway never writes to the database (ADR-05);<br/>2.6 gives the registry its cross-instance story"]
    gw ~~~ note`;
