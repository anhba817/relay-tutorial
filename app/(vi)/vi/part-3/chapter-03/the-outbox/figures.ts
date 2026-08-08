// Hình minh họa chương 3.3. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và code.

export const figTheGap = `sequenceDiagram
    participant C as Caller
    participant A as API service
    participant PG as PostgreSQL
    participant B as Broker
    C->>A: POST /v1/channels/:id/messages
    A->>PG: BEGIN · insert message · COMMIT
    PG-->>A: committed
    Note over A,B: THE GAP — message đã tồn tại,<br/>event thì chưa, và chưa có gì<br/>báo là sai
    A--xB: publish event.msg.created
    Note over A,PG: process chết ở đây.<br/>Không error. Không retry. Không record rằng<br/>đã từng nợ một event`;

export const figOutbox = `sequenceDiagram
    participant A as API service
    participant PG as PostgreSQL
    participant R as Relay (trong api)
    participant B as Broker
    A->>PG: BEGIN
    A->>PG: insert message
    A->>PG: insert outbox row (same transaction)
    A->>PG: COMMIT
    Note over PG: message và event chung số phận —<br/>cả hai, hoặc không cái nào
    R->>PG: SELECT … WHERE published_at IS NULL<br/>FOR UPDATE SKIP LOCKED
    R->>B: publish
    B-->>R: ack
    R->>PG: UPDATE outbox SET published_at = now()
    Note over R,B: publish RỒI mark. Crash ở giữa<br/>sẽ republish — at-least-once,<br/>là chi phí được chấp nhận (ADR-06)`;

export const figTwoGuarantees = `flowchart TB
    write["Một message commit<br/>(một write path, ADR-04)"]
    subgraph live["LIVE delivery — chương 2.6"]
      redis["Redis pub/sub<br/>at-most-once, ADR-07"]
      socket["connected sockets<br/>(không ai nghe? không sao)"]
    end
    subgraph durable["DURABLE events — chương này"]
      ob["outbox row<br/>commit cùng message"]
      relay["relay drain nó"]
      js["JetStream<br/>at-least-once, ADR-06/02"]
    end
    write --> redis --> socket
    write --> ob --> relay --> js
    note["Hai paths vì chúng trả lời hai câu hỏi khác nhau.<br/>Một live frame bị drop có thể recover bằng resume (2.7).<br/>Một EVENT bị drop là webhook không bao giờ fire và<br/>meter âm thầm drift (FR-ANL-06)"]
    durable ~~~ note`;
