// Chapter 4.19 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/065-chapter-4-19/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figTwoOfThree = `flowchart TB
    s["send — 'will be edited'"] --> e1["edit — 'edited once'"]
    e1 --> e2["edit — 'edited twice'"]
    e2 --> d["DELETE, by the tenant key — 204"]
    s -. "an edit records the text it REPLACED" .-> h1["message_edits<br/>'will be edited'"]
    e1 -. "" .-> h2["message_edits<br/>'edited once'"]
    e2 -. "a deletion records NOTHING" .-> h3["&nbsp;"]
    h1 --> out["GET …/edits returns 2"]
    h2 --> out
    h3 --> gone["'edited twice' is in no table.<br/>three texts existed. two come back."]`;

export const figTwoWriters = `flowchart LR
    subgraph before["before 4.19 — one writer"]
      direction TB
      a1["editMessage"] --> a2["INSERT message_edits<br/>prior_text = the replaced text"]
      a3["deleteMessage"] -.-> a4["nothing"]
    end
    subgraph after["after 4.19 — two writers, one table"]
      direction TB
      b1["editMessage"] --> b2["ended_by = 'edit'"]
      b3["deleteMessage"] --> b4["ended_by = 'deletion'<br/>prior_text = the text at removal"]
      b2 --> b5["and the table refuses UPDATE and DELETE"]
      b4 --> b5
    end
    before --> after`;

export const figThreeSurfaces = `flowchart TB
    del["a moderator deletes a message"] --> tx["one transaction"]
    tx --> f["message.deleted frame<br/>carries deleted_at"]
    tx --> w["message.deleted webhook<br/>carries deleted_at"]
    tx --> h["GET …/messages — the history row"]
    del --> r["the DELETE response<br/>204, empty body, carries nothing"]
    h --> q{"before 4.19:<br/>deleted_at absent"}
    q --> late["a client that was offline learns<br/>the message is gone, and not when"]`;

export const figTheBoundary = `flowchart TB
    t["5,343 tombstones on the lane"] --> rec["283 deleted SINCE the chapter<br/>final text recoverable"]
    t --> gone["5,060 predate it<br/>final text gone for ever"]
    gone --> none["3,762 with no version row<br/>nothing recoverable at all"]
    gone --> some["1,298 keep their earlier texts<br/>and look served"]
    some --> trap["ask for the history and texts come back.<br/>the one the dispute turns on is not among them."]`;
