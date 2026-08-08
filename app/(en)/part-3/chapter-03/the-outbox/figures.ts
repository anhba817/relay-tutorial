// Chapter 3.3 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figTheGap = `sequenceDiagram
    participant C as Caller
    participant A as API service
    participant PG as PostgreSQL
    participant B as Broker
    C->>A: POST /v1/channels/:id/messages
    A->>PG: BEGIN · insert message · COMMIT
    PG-->>A: committed
    Note over A,B: THE GAP — the message exists,<br/>the event does not, and nothing<br/>has gone wrong yet
    A--xB: publish event.msg.created
    Note over A,PG: the process dies here.<br/>No error. No retry. No record that<br/>an event was ever owed`;

export const figOutbox = `sequenceDiagram
    participant A as API service
    participant PG as PostgreSQL
    participant R as Relay (in the api)
    participant B as Broker
    A->>PG: BEGIN
    A->>PG: insert message
    A->>PG: insert outbox row (same transaction)
    A->>PG: COMMIT
    Note over PG: message and event share a fate —<br/>both, or neither
    R->>PG: SELECT … WHERE published_at IS NULL<br/>FOR UPDATE SKIP LOCKED
    R->>B: publish
    B-->>R: ack
    R->>PG: UPDATE outbox SET published_at = now()
    Note over R,B: publish THEN mark. A crash between<br/>them republishes — at-least-once,<br/>which is the accepted cost (ADR-06)`;

export const figTwoGuarantees = `flowchart TB
    write["A message commits<br/>(one write path, ADR-04)"]
    subgraph live["LIVE delivery — chapter 2.6"]
      redis["Redis pub/sub<br/>at-most-once, ADR-07"]
      socket["connected sockets<br/>(nobody listening? nobody cares)"]
    end
    subgraph durable["DURABLE events — this chapter"]
      ob["outbox row<br/>commits with the message"]
      relay["relay drains it"]
      js["JetStream<br/>at-least-once, ADR-06/02"]
    end
    write --> redis --> socket
    write --> ob --> relay --> js
    note["Two paths because they answer different questions.<br/>A dropped live frame is a resume away (2.7).<br/>A dropped EVENT is a webhook that never fired and<br/>a meter that silently drifted (FR-ANL-06)"]
    durable ~~~ note`;
