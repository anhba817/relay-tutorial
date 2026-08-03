// Chapter 2.4 figures (feature 020 — DRAFT, unpublished). Mermaid sources
// live here, never in page.mdx. Names come from the documents only.

export const figOffsetDrift = `sequenceDiagram
    participant C as Client
    participant A as API service
    Note over C,A: OFFSET pagination under live inserts
    C->>A: GET messages?offset=0&limit=50
    A-->>C: rows 1–50 (newest first)
    Note over A: three NEW messages arrive —<br/>every row shifts down by three
    C->>A: GET messages?offset=50&limit=50
    A-->>C: rows 51–100 — but rows 48–50<br/>of page 1 appear AGAIN (duplicates),<br/>and with deletes rows can VANISH (gaps)
    Note over C: page 2 lied — the feed moved<br/>under the page numbers`;

export const figCursorStability = `sequenceDiagram
    participant C as Client
    participant A as API service
    Note over C,A: CURSOR pagination under the same inserts
    C->>A: GET messages?limit=50
    A-->>C: seq 412…363 + next_cursor(seq 363)
    Note over A: three new messages arrive —<br/>seq 413, 414, 415: BELOW no cursor
    C->>A: GET messages?cursor=…&limit=50
    A-->>C: seq 362…313 — exactly the next 50,<br/>no repeats, no holes
    Note over C: the cursor names a POSITION,<br/>not a count — inserts can't move it`;

export const figIndexRide = `flowchart LR
    q["WHERE channel_id = ?<br/>AND sequence < cursor<br/>ORDER BY sequence DESC<br/>LIMIT 50"]
    idx["messages_channel_seq<br/>(channel_id, sequence DESC)"]
    scan["pure index-order scan:<br/>seek once, read 50 entries, stop"]
    q --> idx --> scan
    note["FR-MSG-09's page is the index's natural<br/>walking direction — the hot-path index<br/>2.1 created is finally on its hot path"]
    scan ~~~ note`;
