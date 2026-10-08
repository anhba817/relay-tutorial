// Chapter 4.23 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/070-chapter-4-23/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figTwoSurfaces = `flowchart TB
    cust["order-88412 — what the customer named it"]
    subgraph rest["REST, since chapter 4.22"]
      r1["GET /v1/channels/order-88412"] --> rok["200"]
    end
    subgraph sock["THE SOCKET, before this chapter"]
      s1["message.created"] --> sid["channel: 419320ca-…"]
    end
    cust --> r1
    cust -.->|"the name never arrives"| s1
    sid --> table["the lookup table Stage 1 promised away"]`;

export const figWhatCountsAsNaming = `flowchart LR
    subgraph field["A \`channel\` FIELD — what a grep finds"]
      f1["messageSchema"]
      f2["typingSchema"]
      f3["membershipChangedSchema"]
      f4["…7 in all"]
    end
    subgraph other["NAMED WITHOUT THE WORD — what it misses"]
      o1["ack.revisions — keyed by channel"]
      o2["ack.cursor — keyed by channel"]
      o3["ack.truncated — a list of them"]
    end
    field --> seven["7"]
    other --> three["3"]
    seven --> total["10 things to rename"]
    three --> total`;

export const figTwentyOneSites = `flowchart TB
    g["21 places the gateway writes \`channel:\`"]
    g --> frames["3 client frames"]
    g --> logs["11 LOG LINES — an operator reads these against the subjects"]
    g --> pub["6 internal publishes — a subject is derived from the key"]
    g --> cmt["1 comment"]
    fwd["message.created — forwarded from the api,<br/>written by NO gateway expression"] --> miss["a per-site edit misses it entirely"]
    frames --> one["so the rename goes at the one \`send\`"]
    fwd --> one`;

export const figTheBuffer = `flowchart TB
    subgraph buf["connection.buffer — a frame waiting for the backfill"]
      m["Message { channel, seq }"]
    end
    m -->|"client reads it"| client["the frame a client receives"]
    m -->|"flushable indexes it"| marks["marks[frame.channel]"]
    m -->|"revocation filters it"| rev["m.channel !== change.channel"]
    marks -->|"an identity here loses every mark"| dup["the whole backlog re-sent"]
    rev -->|"an identity here matches nothing"| leak["a revoked channel's backlog flushed"]`;
