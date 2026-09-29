// Chapter 4.15 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/061-chapter-4-15/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figWhatTwoClausesDo = `flowchart TB
    m["a message"] -->|names| p["the parent object"]
    p -.->|"named by NO message"| t["the thumbnail"]
    subgraph consequences["what two shipped clauses do about that, both correctly"]
      c1["FR-MED-08<br/>authorised through referencing channels<br/>-> no message, so NOBODY may read it"]
      c2["FR-MED-10<br/>unreferenced objects reaped after 24h<br/>-> DELETED a day after it is made"]
    end
    t --> c1
    t --> c2
    fix["migration 0020<br/>parent_id + composite FK + ON DELETE CASCADE<br/>'its reachability IS its parent's'"]
    fix -.->|answers| c1
    fix -.->|answers| c2`;

export const figTheRatioIsNotTheCost = `flowchart LR
    subgraph ratio["the ratio to the parent: 775x spread"]
      r1["3,175,063 B gif -> 2,558 B<br/>0.08%"]
      r2["68,527 B png -> 4,118 B<br/>6.01%"]
      r3["11,047 B png -> 6,848 B<br/>61.99%"]
    end
    subgraph size["the thumbnail itself: 4x spread"]
      s1["2,558 B"]
      s2["4,118 B"]
      s3["6,848 B"]
      s4["10,258 B"]
    end
    bound["the 320 px bound decides the output,<br/>the parent decides only the ratio"]
    bound --> size`;

export const figThreeStateGate = `flowchart TB
    probe["the probe: sniffed type + a 64 KiB prefix"]
    probe --> q1{"an image the decoder reads?"}
    q1 -->|no| none["no rendition, no reason<br/>audio and video leave here"]
    q1 -->|yes| q2{"dimensions?"}
    q2 -->|"known, <= 320"| skip["no fetch, no rendition<br/>R2: the output would be 97.3% of the parent"]
    q2 -->|"known, > 320"| get["fetch the whole object"]
    q2 -->|"UNKNOWN"| get
    get --> made["resize, PUT, record"]
    note["UNKNOWN is an ordinary camera JPEG:<br/>one maximal APP1 segment (72,215 B) pushes<br/>SOF0 past the 64 KiB probe window"]
    note -.-> q2`;

export const figWhereTheTimeGoes = `flowchart LR
    h["signed HEAD<br/>2.793 ms"] --> g["full GET, 7,984,317 B<br/>8.2 ms"]
    g --> r["resize to 320<br/>52.0 ms"]
    r --> tot["60.2 ms total"]
    rss["peak RSS moved 0.4 MB<br/>arithmetic for the bitmap said 36 MB<br/>libvips works in strips"]
    r -.-> rss`;
