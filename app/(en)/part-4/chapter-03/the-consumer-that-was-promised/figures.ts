// Chapter 4.3 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/048-chapter-4-3/baseline.txt.

export const figNobodyReading = `flowchart LR
    api["api<br/>publishAttempt()<br/>since chapter 3.20"]
    stream["ANALYTICS<br/>7-day retention · discard old<br/>31 messages"]
    nothing["—<br/>consumers 0"]
    store["relay_analytics<br/>webhook_attempts"]
    api -->|"one record per<br/>delivery attempt"| stream
    stream -.->|"nothing reads it"| nothing
    nothing -.-> store
    note["The stream's own comment said so:<br/>'no acknowledgement anywhere: nothing consumes<br/>this stream in this chapter.'<br/>That was chapter 3.20. This is the chapter it meant."]
    nothing ~~~ note`;

export const figTwoDedups = `flowchart TB
    subgraph pub["Publish-side — the broker's dedup id"]
      p1["id = {delivery_id}:{attempt}"]
      p2["stops the PUBLISHER<br/>sending the same record twice<br/>inside the dedup window"]
      p1 --> p2
    end
    subgraph con["Consume-side — at-least-once delivery"]
      c1["the broker hands the same record<br/>to the CONSUMER again"]
      c2["a different problem entirely:<br/>nothing on the publish side<br/>has anything to say about it"]
      c1 --> c2
    end
    subgraph fix["What actually covers it"]
      f1["ReplacingMergeTree<br/>ORDER BY (environment_id, ts,<br/>delivery_id, attempt)"]
      f2["the record's own key, so it<br/>collapses however it was batched"]
      f1 --> f2
    end
    pub ~~~ con
    con --> fix`;

export const figBatchesMove = `flowchart TB
    orig["original batch<br/>max_messages = 5<br/>seqs 1,2,3,4,5"]
    r3["retry at max_messages = 3<br/>seqs 1,2,3"]
    r10["retry at max_messages = 10<br/>seqs 4,5,1,2,3,6,7,8,9,10<br/>out of order, interleaved with newer"]
    orig --> r3
    orig --> r10
    verdict["A token derived from the batch differs every time,<br/>so the duplicate inserts. And the token keys on ITSELF,<br/>not the content: the same token with 500 different rows<br/>dropped all 500 and reported success.<br/><br/>A token that is not provably unique per batch<br/>is not weak deduplication — it is silent data loss."]
    r3 --> verdict
    r10 --> verdict`;
