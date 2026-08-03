// Hình minh họa chương 2.5 (feature 020 — DRAFT, chưa công bố). Mã Mermaid
// sống ở đây, không bao giờ nằm trong page.mdx. Tên frame đến từ
// @relay/protocol và được giữ nguyên.

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
    Note over C,G: socket đã open — frames được phép chảy`;

export const figSendOverSocket = `sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as API service
    participant P as PostgreSQL
    C->>G: frame message.send {idem_key, channel, text}
    G->>G: safeParse against @relay/protocol — garbage → error + 4002
    G->>A: POST /internal/messages
    A->>P: write path của 2.2/2.3 (lock · seq · ON CONFLICT)
    A-->>G: 201 {message, seq}
    G-->>C: frame message.ack {seq}
    Note over G,A: gateway carried, api decided —<br/>ADR-05: sends đi qua socket,<br/>writes xảy ra ở một nơi`;

export const figGatewayAnatomy = `flowchart TB
    subgraph gw["services/gateway — vẫn frameworkless (ADR-15)"]
      up["HTTP server (1.4's serve)<br/>+ WS upgrade on /v1/ws"]
      auth["auth.ts — jose verify,<br/>close 4001 on failure"]
      sess["session.ts — một object mỗi socket:<br/>user, env, subscriptions, cursors"]
      reg["registry.ts — in-memory<br/>connection map (chương này)"]
      up --> auth --> sess --> reg
    end
    note["Không có store access ở bất kỳ đâu trong hộp này —<br/>gateway never writes to the database (ADR-05);<br/>2.6 cho registry câu chuyện cross-instance"]
    gw ~~~ note`;
