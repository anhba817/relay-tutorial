// Chapter 3.23 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figMessageLife = `stateDiagram-v2
    [*] --> live: send
    live --> live: edit — seq unchanged,<br/>edited_at set, one message_edits row
    live --> tombstone: delete — text NULL, attachments NULL,<br/>deleted_at set, seq kept
    tombstone --> tombstone: delete again — no change, no event
    tombstone --> refused: edit
    refused --> tombstone: 403 message_deleted
    note right of tombstone
      prior_text is NOT NULL, so a deletion
      writes no history row at all
    end note`;

export const figFiveGrammars = `flowchart TB
    subgraph before["four grammars, twenty-two chapters"]
      a["chan:{channel_id}<br/>a Message"]
      b["member:{channel_id}<br/>member:{env}:{user}"]
      c["presence:{channel_id}"]
      d["typing:{channel_id}"]
    end
    subgraph fifth["the fifth"]
      e["revision:{channel_id}<br/>{ kind, message }"]
    end
    u["an edit IS a Message —<br/>indistinguishable from a creation on chan:"]
    t["a tombstone is NOT a Message —<br/>it has no text, so it cannot ride chan: at all"]
    u --> e
    t --> e
    style a fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style e fill:#065f46,color:#fff,stroke:#10b981
    style t fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figReadPaths = `flowchart LR
    m["a message that was deleted"]
    h["REST history"]
    r["resume backfill"]
    l["channel listing"]
    t["the truncated flag"]
    hr["returned, in position,<br/>text: null"]
    rr["DROPPED — the client sees a gap<br/>and repairs it through history"]
    lr["previewed with a null text,<br/>still counted as one unread"]
    tr["computed from ROWS READ,<br/>not frames delivered"]
    m --> h --> hr
    m --> r --> rr
    m --> l --> lr
    m --> t --> tr
    style rr fill:#7f1d1d,color:#fff,stroke:#dc2626
    style tr fill:#334155,color:#fff,stroke:#64748b`;

export const figCursorBlindSide = `sequenceDiagram
    participant C as client
    participant A as api
    Note over C: holds cursor 41
    C--xA: disconnects
    A->>A: message 12 edited (below the cursor)
    A->>A: message 43 deleted (above the cursor)
    C->>A: reconnect, cursor=41
    A-->>C: backfill: 42 only
    Note over C: 43 is missing — a GAP the SDK detects
    Note over C: 12 is stale — NO gap, nothing detects it
    C->>A: GET history (the repair)
    A-->>C: 12 corrected, 43 with text: null, 42 unchanged`;
