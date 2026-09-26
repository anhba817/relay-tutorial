// Chapter 4.13 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/059-chapter-4-13/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart`. 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built and served 125 pages
// green. `pnpm check:figures` is the only thing that asks.

export const figTheEventWithNoProducer = `flowchart LR
    subgraph sad["WHAT THE ARCHITECTURE DOCUMENT DESCRIBES"]
      c1["client"] -->|"PUT, presigned"| s1["object store"]
      c1 -->|"media.uploaded"| b1["broker"]
      b1 --> w1["media worker"]
    end
    subgraph real["WHAT THE PLATFORM CAN BUILD"]
      c2["client"] -->|"PUT, presigned"| s2["object store"]
      c2 -.->|"nothing"| x["the api never learns<br/>the upload finished"]
      w2["media worker"] -->|"every 5 s: what is pending?"| a2["api"]
      w2 -->|"signed HEAD · 1.412 ms"| s2
    end
    note["ADR-13: the bytes never transit Relay compute.<br/>So the only two parties that know the PUT finished<br/>are the client and the store — and zero occurrences<br/>of 'media.uploaded' exist anywhere."]
    real ~~~ note`;

export const figTheSweepIsFree = `flowchart TB
    spec["THE SPECIFICATION'S OBJECTION<br/>'91.6% of the work is spent on<br/>objects that hold nothing'"]
    meas["WHAT IT COSTS, MEASURED<br/>one signed HEAD: 1.412 ms p50<br/>the whole 3,292-row backlog: 4.2 s serial<br/>166 of 200 probes are 404s"]
    clause["FR-MED-04: 'every uploaded object<br/>shall be virus-scanned'"]
    concl["THE WASTE IS FREE, AND THE CLAUSE IS NOT OPTIONAL.<br/>A notice can make the sweep faster.<br/>It must not be able to make it WRONG."]
    cost["WHAT THE SWEEP COSTS INSTEAD<br/>p50 upload → ready = 5,080 ms at a 5 s interval<br/>of which the work is 7 ms"]
    spec --> meas
    clause --> concl
    meas --> concl
    concl --> cost`;

export const figScanSizeType = `flowchart TB
    head["signed HEAD — 1.4 ms<br/>content-length · last-modified"]
    none{"any bytes?"}
    wait["no verdict at all.<br/>The row stays pending and<br/>the next sweep finds it."]
    scan["THE SCAN — streamed, chunked<br/>ClamAV INSTREAM<br/>~2 ms a megabyte"]
    down{"did the scanner answer?"}
    infected{"FOUND?"}
    size{"content-length =<br/>declared_bytes, exactly?"}
    range["signed GET, Range: bytes=0-65535<br/>206 · the type and the dimensions"]
    type{"do the BYTES agree<br/>with the declaration?"}
    ready["ready<br/>+ verified_bytes, verified_type, width, height"]
    rej1["rejected · scan_failed"]
    rej2["rejected · declaration_mismatch"]
    head --> none
    none -->|no| wait
    none -->|yes| scan
    scan --> down
    down -->|no| wait
    down -->|yes| infected
    infected -->|yes| rej1
    infected -->|no| size
    size -->|no| rej2
    size -->|yes| range
    range --> type
    type -->|no| rej2
    type -->|yes| ready`;

export const figTheGateCannotShipAlone = `flowchart LR
    subgraph before["CHAPTER 4.12's WORLD"]
      b1["media_objects_state_check<br/>CHECK (state = 'pending')"]
      b2["the delivery route signs<br/>for a pending object"]
      b3["adding WHERE state = 'ready'<br/>→ 10 of 76 RED,<br/>including the gauntlet's own control"]
      b1 --> b3
      b2 --> b3
    end
    subgraph after["WHAT SHIPS TOGETHER"]
      a1["0018: CHECK (state IN<br/>('pending','ready','rejected'))"]
      a2["the worker's verdict<br/>UPDATE … WHERE state = 'pending'"]
      a3["the gate:<br/>WHERE state = 'ready'"]
      a1 --> a2 --> a3
    end
    before -->|"the transition and the gate<br/>ship together, or the gate ships broken"| after`;
