// Chapter 3.9 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figOutboxThrice = `flowchart TB
    subgraph c33["chapter 3.3 · events"]
      o1["outbox<br/>published_at"] --> o1x["NATS"]
    end
    subgraph c35["chapter 3.5 · deliveries"]
      o2["webhook_deliveries<br/>state · next_attempt_at"] --> o2x["the customer's endpoint"]
    end
    subgraph c38["chapter 3.8 · notifications"]
      o3["webhook_disable_notifications<br/>delivered_at"] --> o3x["SMTP"]
    end
    note["the third needed NO migration:<br/>chapter 3.6 wrote delivered_at<br/>and left it null throughout"]
    o3 -.-> note
    style o3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figHeadOfLine = `flowchart TB
    subgraph before["one transaction per batch"]
      b1["claim oldest-first<br/>row A · bad address<br/>row B · row C"]
      b2["send A → THROWS"]
      b3["transaction rolls back"]
      b4["A, B and C all unmarked"]
      b5["next pass claims A first again"]
      b1 --> b2 --> b3 --> b4 --> b5
      b5 -.->|"for ever"| b1
    end
    subgraph after["per-row isolation"]
      a1["claim oldest-first"]
      a2["A throws → onError, not marked"]
      a3["B and C send → marked"]
      a4["A retried next pass<br/>B and C are gone"]
      a1 --> a2 --> a3 --> a4
    end
    style b5 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style a3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figWhatMailpitProves = `flowchart LR
    facts["DisableFacts<br/>url · environment · attempts<br/>NO field for a secret"]
    mail["disableNotification()"]
    smtp["Mailpit · SMTP"]
    api["Mailpit HTTP API"]
    test["the assertion"]
    facts --> mail --> smtp --> api --> test
    stub["a STUB would let the test read<br/>the same object the sender passed —<br/>so a secret in a header the stub<br/>does not model would pass"]
    test -.-> stub
    style smtp fill:#064e3b,color:#fff,stroke:#059669
    style stub fill:#7f1d1d,color:#fff,stroke:#dc2626`;
