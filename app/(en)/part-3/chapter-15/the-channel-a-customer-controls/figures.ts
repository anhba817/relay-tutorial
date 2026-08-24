// Chapter 3.15 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figRefusalOrder = `flowchart TB
    req["a request naming a channel id"]
    req --> ban["1 — BANNED?<br/>checked before the channel is resolved"]
    ban -->|yes| one["one answer for every channel id,<br/>real or invented"]
    ban -->|no| vis["2 — VISIBLE?<br/>private and not a member → the not-found envelope"]
    vis -->|no| gone["byte-identical to a channel<br/>that does not exist"]
    vis -->|yes| arch["3 — ARCHIVED?<br/>channel_archived"]
    arch --> ok["the operation"]
    leak["ARCHIVE SECOND, MEMBERSHIP THIRD:<br/>a non-member of a private ARCHIVED channel<br/>gets channel_archived and learns it exists"]
    style leak fill:#7f1d1d,color:#fff,stroke:#dc2626
    style gone fill:#064e3b,color:#fff,stroke:#059669
    style one fill:#064e3b,color:#fff,stroke:#059669`;

export const figThreePlaces = `flowchart LR
    subgraph places["A CHECK ON THE CALLER NEEDS THREE PLACES"]
      h["the handler<br/>resolves the principal"]
      s["the service<br/>threads it"]
      r["the repository function<br/>accepts a userId"]
      h --> s --> r
    end
    r --> fires["the check can fire"]
    gap1["send: the handler passed no user<br/>send(channelId, body)"]
    gap2["history: listMessages(channelId, opts)<br/>had nowhere to put one"]
    gap1 --> dead["a parameter nobody fills in<br/>encodes nothing"]
    gap2 --> dead
    style dead fill:#7f1d1d,color:#fff,stroke:#dc2626
    style fires fill:#064e3b,color:#fff,stroke:#059669`;

export const figSameTenant = `flowchart TB
    old["THE FOUR SHAPES CHAPTER 3.12 BUILT<br/>all take ANOTHER tenant's identifiers"]
    old --> s1["a foreign id on a tenant credential"]
    old --> s2["a foreign id on a user token"]
    old --> s3["a credential from another environment"]
    old --> s4["a socket frame naming a foreign channel"]
    new["THE SHAPE IT HAD NO FIXTURE FOR<br/>your OWN tenant's private channel,<br/>and you are not a member"]
    new --> pair["the pair: that id, and an id that exists nowhere"]
    pair --> oracle["withoutRequestId — byte-identical or the test fails"]
    ctrl["AND THE CONTROL: a member's token,<br/>the same channel, 200"]
    ctrl --> why["without it, two refusals for<br/>an unrelated reason also match"]
    style new fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style why fill:#7f1d1d,color:#fff,stroke:#dc2626
    style oracle fill:#064e3b,color:#fff,stroke:#059669`;
