// Chapter 4.14 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/060-chapter-4-14/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart`. 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built and served 125 pages
// green. `pnpm check:figures` is the only thing that asks.

export const figOneSchemaTwoRules = `flowchart TB
    subgraph before["BEFORE: one schema, two opposite rules"]
      a["attachmentSchema"] --> d1["messages.schema.ts:40<br/>REST send body"]
      a --> d2["messageSendSchema<br/>socket send"]
      a --> d3["internal.ts:35<br/>internal send"]
      a --> d4["messageSchema (frames.ts:46)<br/>WHAT THE API BUILDS"]
      r1["a sender must NOT declare a state"] -.-> d1
      r2["a delivered attachment must ALWAYS carry one"] -.-> d4
    end
    subgraph after["AFTER: three roles, three shapes"]
      b1["attachmentSchema<br/>a sender declares"] --> e1["the three request doors"]
      b2["deliveredAttachmentSchema<br/>state REQUIRED"] --> e2["messageSchema — every door"]
      b3["forwardedAttachmentSchema<br/>delivered | declared | loose"] --> e3["a relay that forwards"]
    end`;

export const figTheStateIsReadNotStored = `sequenceDiagram
    participant C as client
    participant A as api
    participant P as postgres
    C->>A: send, attaching a pending object
    A->>P: INSERT message, attachments = what was declared
    A-->>C: 201, attachment state "pending"
    Note over P: the worker verifies, later
    P->>P: UPDATE media_objects SET state = 'ready'<br/>WHERE state = 'pending'
    C->>A: read history
    A->>P: the page, then ONE query for its media ids
    A-->>C: the same message, attachment state "ready"
    Note over A,P: the message row never changed.<br/>Storing the state would make every verdict a write<br/>across every referencing message, and give one<br/>fact two homes — constitution IV.`;

export const figWhyThisSubject = `flowchart TB
    q["media.updated needs a subject.<br/>ADR-19: a kind that cannot share a payload type<br/>cannot share a subject."]
    q --> A["A. a sixth grammar, media:{channel}"]
    q --> B["B. widen chan:{channel}"]
    q --> C["C. a third arm on revision:{channel}"]
    q --> D["D. re-send the message as message.updated"]
    A --> A1["per-channel SUBSCRIBEs 5 → 6.<br/>ADR-25 consolidates ABOVE six, so this is<br/>permitted — and spends the last of the headroom"]
    B --> B1["refused by ADR-24 in writing:<br/>everything on chan: IS a creation"]
    C --> C1["per-channel SUBSCRIBEs stay at 5.<br/>fanout.ts already subscribes chan: and revision:<br/>together, 'co-extensive by construction'"]
    D --> D1["messageSchema has no edited_at.<br/>A client could not tell an attachment resolving<br/>from an author editing — ADR-24's own objection,<br/>one level up"]
    C1 --> chosen["CHOSEN — ADR-33"]`;

export const figTheTwoHalves = `flowchart LR
    subgraph floor["THE FLOOR — every door, always"]
      f1["attachment carries the state,<br/>read when the message is served"]
    end
    subgraph opt["THE OPTIMISATION — when there is a transition"]
      o1["one frame per referencing channel"]
    end
    case1["attached while pending,<br/>then verified"] --> floor
    case1 --> opt
    case2["attached when ALREADY ready<br/>538 of the lane's 1,589 referenced objects"] --> floor
    case2 -.->|"no transition left<br/>to announce"| none["no frame, ever"]
    case3["client disconnected,<br/>or an old gateway during a deploy"] --> floor
    case3 -.->|"frame dropped"| none
    note["The frame removes polling. It is not how the answer is known."]`;
