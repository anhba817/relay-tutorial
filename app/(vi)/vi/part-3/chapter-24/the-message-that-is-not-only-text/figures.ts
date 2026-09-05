// Chapter 3.24 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figAttachmentShape = `flowchart TB
    u["attachmentSchema<br/>discriminatedUnion on type"]
    a1["{ type: 'url',<br/>kind: image|audio|video,<br/>url }<br/>ACCEPTS"]
    a2["{ type: 'media', media_id }<br/>REFUSES — media_not_available"]
    f["§4.14 replaces this arm's body.<br/>The discriminator never changes."]
    u --> a1
    u --> a2
    a2 -.-> f
    style a1 fill:#065f46,color:#fff,stroke:#10b981
    style a2 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style f fill:#334155,color:#fff,stroke:#64748b`;

export const figThreeDoors = `flowchart LR
    subgraph rules["one definition, three appliers"]
      r["refineTextAndAttachments<br/>attachments.ts"]
    end
    a["messageSendSchema<br/>the socket frame"]
    b["internalSendRequestSchema<br/>every socket send"]
    c["sendMessageBodySchema<br/>the REST body"]
    r --> a
    r --> b
    r --> c
    n["A rule written into ONE of these<br/>is a rule the other doors do not have.<br/>FR-019b reached two of three<br/>before the layer gave it away."]
    a -.-> n
    style r fill:#065f46,color:#fff,stroke:#10b981
    style n fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figSixReadPaths = `flowchart LR
    m["messages.attachments<br/>JSONB, NULL or an array"]
    s1["listMessages<br/>history AND resume"]
    s2["getMessageByIdempotencyKey<br/>the retry replay"]
    s3["editMessage's read"]
    s4["deleteMessage's read"]
    s5["listMessagesRaw"]
    s6["listChannelsForUser.last_message"]
    y1["carries them — ?? [] here, once"]
    y2["carries them"]
    y3["carries them — the edit event needs<br/>what the message already has"]
    n1["no — a tombstone's are unlinked"]
    n2["no — id, seq, text"]
    n3["no — a preview shows what was said"]
    m --> s1 --> y1
    m --> s2 --> y2
    m --> s3 --> y3
    m --> s4 --> n1
    m --> s5 --> n2
    m --> s6 --> n3
    style y1 fill:#065f46,color:#fff,stroke:#10b981
    style y2 fill:#065f46,color:#fff,stroke:#10b981
    style y3 fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style n1 fill:#334155,color:#fff,stroke:#64748b
    style n2 fill:#334155,color:#fff,stroke:#64748b
    style n3 fill:#334155,color:#fff,stroke:#64748b`;

export const figSocketDrops = `sequenceDiagram
    participant C as client
    participant G as gateway
    participant A as api
    participant P as postgres
    C->>G: message.send { text, attachments }
    Note over G: 1 — the inbound destructure<br/>const { channel, text, idem_key } = payload
    G->>A: POST /internal/messages { channel_id, text }
    Note over A: 2 — the named build<br/>{ text: body.text, ...idempotency_key }
    A->>P: INSERT … (text)
    P-->>A: row
    A-->>G: { id, seq, text }
    Note over G: 3 — the outbound payload<br/>built field by field
    G-->>C: message.ack { seq }
    Note over C: acked as though it worked.<br/>No error anywhere in this sequence.`;

export const figTombstone = `stateDiagram-v2
    [*] --> live: send with attachments
    live --> live: edit — text changes,<br/>attachments untouched, event carries them
    live --> tombstone: delete — text NULL,<br/>attachments NULL, deleted_at set
    tombstone --> tombstone: retry an old idempotency key —<br/>returns attachments: [], publishes nothing
    note right of tombstone
      message.deleted carries NO attachment
      field at all, for the reason it carries
      no text: a url is as recoverable
    end note`;
