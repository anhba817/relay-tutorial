// Chapter 4.17 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/063-chapter-4-17/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figWhatEachSuiteStandsInFor = `flowchart TB
    subgraph path["the path seven chapters built"]
      direction LR
      p1["slot<br/>4.10"] --> p2["PUT<br/>4.10"] --> p3["send<br/>4.11"]
      p3 --> p4["sweep + scan + verdict<br/>4.13"] --> p5["state<br/>4.14"]
      p5 --> p6["thumbnail<br/>4.15"] --> p7["signed delivery<br/>4.12"]
    end
    path --> w["media-worker/verify.itest.ts<br/>runs the sweep IN PROCESS<br/>no send, no delivery"]
    path --> a["api/attachment-state.itest.ts<br/>the verdict is called BY THE TEST"]
    path --> d["api/delivery.itest.ts<br/>states are set with SQL"]
    path --> t["media-worker/thumbnail.test.ts<br/>a unit test over a buffer"]
    w --> gap["every suite stands in for<br/>at least one step beside it"]
    a --> gap
    d --> gap
    t --> gap`;

export const figWhereTheTimeGoes = `flowchart LR
    subgraph client["what a client controls — about 40 ms at p50"]
      direction TB
      c1["slot 11 ms"]
      c2["PUT 7 ms"]
      c3["history 5 ms"]
      c4["link 5 ms"]
      c5["GET the bytes 2 ms"]
      c6["GET the thumbnail 7 ms"]
    end
    subgraph wait["what it waits on — n = 25, independent phase"]
      direction TB
      w1["min 1,097 ms"]
      w2["p50 3,398 ms"]
      w3["max 36,164 ms"]
    end
    client --> why
    wait --> why
    why["the sweep runs every 5,000 ms<br/>and nothing tells the platform an upload finished<br/><br/>so the wait is UNIFORM on [0, interval] plus work,<br/>and the work is bounded above by 433 ms"]`;

export const figThreeCasesTwoFields = `flowchart TB
    q["a recipient reads one message"]
    q --> r1["text: the sender's<br/>attachments: [{ state: rejected }]"]
    q --> r2["text: the sender's<br/>attachments: []"]
    q --> r3["text: NULL<br/>attachments: []"]
    r1 --> o1["an upload the platform refused"]
    r2 --> o2["a message with nothing attached"]
    r3 --> o3["a message somebody deleted"]
    o1 --> note
    o2 --> note
    o3 --> note
    note["TWO FIELDS, NOT ONE.<br/>read only attachments and a deletion<br/>looks like a plain message;<br/>read only text and a refusal<br/>looks like a delivery"]`;

export const figWhatSilenceMeans = `flowchart TB
    s["the media worker's log, read at 23:17"]
    s --> l["last line: 23:14:10 sweep seen=441 ready=1"]
    l --> i1["INFERENCE: the worker has hung"]
    i1 --> x["WRONG"]
    s --> api["the API's access log, same window"]
    api --> l2["nine GET /internal/media/pending<br/>every 5.4 s, without a gap"]
    l2 --> i2["the worker is sweeping and deciding nothing"]
    i2 --> y["main.ts logs a sweep ONLY when<br/>ready > 0 or rejected > 0<br/><br/>so its gaps measure ARRIVALS, not LIVENESS"]`;
