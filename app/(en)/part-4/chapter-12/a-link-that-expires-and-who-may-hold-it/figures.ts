// Chapter 4.12 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/058-chapter-4-12/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart`. 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built and served 125 pages
// green. `pnpm check:figures` is the only thing that asks.

export const figWhoMayHoldIt = `flowchart TB
    req["GET /v1/media/:mediaId<br/>application credential or user token"]
    uuid{"is it a UUID?"}
    bad400["400 invalid_request · field: mediaId<br/>the first route in this api that asks"]
    obj["1. the object row, by primary key<br/>id = :mediaId AND environment_id = this tenant<br/>3 buffers"]
    chans["2. every channel of this tenant holding<br/>a message that references it<br/>attachments @> a BOUND value · DISTINCT<br/>17 buffers, Bitmap Index Scan"]
    vis{"channelVisibleTo(channel, user?)<br/>for ANY of them"}
    ok["200 · { url, expires_at }<br/>signed GET, X-Amz-Expires=3600"]
    r1["another tenant's object"]
    r2["referenced only where you cannot read"]
    r3["no object has that id"]
    r4["no message references it at all"]
    one["404 not_found<br/>ONE code, ONE message, ONE body"]
    req --> uuid
    uuid -->|no| bad400
    uuid -->|yes| obj
    obj -->|"found"| chans
    obj -->|"not found"| r3
    obj -->|"not found"| r1
    chans -->|"none"| r4
    chans -->|"some"| vis
    vis -->|yes| ok
    vis -->|no| r2
    r1 --> one
    r2 --> one
    r3 --> one
    r4 --> one`;

export const figTheIndexThatIsNotUsed = `flowchart LR
    subgraph one["ONE JOINED QUERY — what the analysis passes produced"]
      a1["media_objects o"] --> a2["JOIN messages m ON<br/>m.attachments @> jsonb_build_array(… o.id …)"]
      a2 --> a3["JOIN channels c"]
      a4["the containment operand is built from o.id,<br/>a column on the OTHER SIDE of the join.<br/>A GIN index cannot be looked up with a value<br/>the planner does not have yet."]
      a3 ~~~ a4
      a5["Nested Loop · Rows Removed by Join Filter: 1017<br/>86 buffers · 1.109 ms · THE INDEX IS IDLE"]
      a4 ~~~ a5
    end
    subgraph two["TWO QUERIES — what shipped"]
      b1["SELECT object_key FROM media_objects<br/>WHERE id = $1 AND environment_id = $2"] --> b2["Index Scan · 3 buffers"]
      b3["SELECT DISTINCT c.id … WHERE m.attachments @> $3::jsonb<br/>AND c.environment_id = $2"] --> b4["Bitmap Index Scan on messages_attachments_gin<br/>17 buffers · 0.077 ms"]
      b2 ~~~ b3
    end
    one ~~~ two`;

export const figThreeScopesNothingSees = `flowchart TB
    m1["remove the scope from the REFERENCE LOOKUP"] --> g1["delivery 16/16 GREEN<br/>gauntlet 60/60 GREEN"]
    m2["remove the scope from the OBJECT READ"] --> g2["delivery 16/16 GREEN<br/>gauntlet 60/60 GREEN"]
    m3["remove the scope from channelVisibleTo"] --> g3["delivery 16/16 GREEN<br/>gauntlet 5 red — and NONE of them<br/>the media read attack"]
    m4["remove ALL THREE"] --> g4["delivery 2 of 16 RED"]
    note["Each predicate is redundant because of the other two.<br/>A single-mutation probe measures the DEFENCE, not the arm —<br/>and a coverage number reports less than that, because an<br/>SQL clause carries no JavaScript branch at all."]
    g4 ~~~ note`;
