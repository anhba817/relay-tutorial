// Chapter 4.11 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/057-chapter-4-11/baseline.txt.

export const figThreeConditionsOneAnswer = `flowchart TB
    send["POST /v1/channels/:id/messages<br/>attachments: [{ type: media, media_id }]"]
    uuid{"is it a UUID?"}
    q["one IN over media_objects, inside the send's transaction<br/>environment_id = this tenant<br/>AND (the caller is an application credential<br/>OR user_id IS NULL OR user_id = the sender)<br/>AND state IN ('pending', 'ready')"]
    ok["201 · the array comes back exactly as sent"]
    bad400["400 invalid_request<br/>field: attachments.0.media_id"]
    r1["another tenant's object"]
    r2["another user's object"]
    r3["no object has that id"]
    one["422 media_not_attachable<br/>ONE code, ONE message, ONE field"]
    send --> uuid
    uuid -->|no| bad400
    uuid -->|yes| q
    q -->|"the id came back"| ok
    r1 --> one
    r2 --> one
    r3 --> one
    q -->|"it did not"| r1
    q -->|"it did not"| r2
    q -->|"it did not"| r3
    why["WHY ONE ANSWER: three messages would tell a caller<br/>WHICH condition it hit, and therefore whether<br/>somebody else's object exists. Measured: three bodies,<br/>byte-identical apart from request_id"]
    one ~~~ why`;

export const figFiveReadersThatForward = `flowchart LR
    api["the api<br/>builds the message"]
    outbox["outbox envelope<br/>event.ts:373, :412"]
    resp["send response<br/>internal.ts:70"]
    fan["fanout delivery<br/>fanout.ts:109"]
    rev["fanout revision<br/>fanout.ts:98"]
    back["backfill page<br/>internal.ts:115"]
    api --> outbox
    api --> resp
    api --> fan
    api --> rev
    api --> back
    c1["message.term()<br/>DESTROYED after the send was acked"]
    c2["socket closes 1011<br/>the ack is lost, the message is not"]
    c3["log line, return<br/>THE FRAME IS DROPPED · sender holds a 201"]
    c4["log line, return<br/>the edit never arrives"]
    c5["degrade backfill_failed<br/>the resume is lost, the data is not"]
    outbox --> c1
    resp --> c2
    fan --> c3
    rev --> c4
    back --> c5
    found["FOUND ONE PER ANALYSIS PASS: the outbox at 3,<br/>the response at 4, and the last three at 6 —<br/>after a table written to prevent exactly that<br/>recorded messageSchema as 'parsed by nothing'"]
    c3 ~~~ found`;

export const figTheStateTheDatabaseRefuses = `flowchart LR
    clause["FR-MED-06<br/>'a message may attach a media_id<br/>in state pending or ready'"]
    pending["pending<br/>the only state a row can hold"]
    ready["ready"]
    rejected["rejected"]
    check["CHECK (state = 'pending')<br/>written by chapter 4.10, on purpose"]
    clause --> pending
    clause --> ready
    check -->|"refuses"| ready
    check -->|"refuses"| rejected
    evidence["THE REFUSAL IS THE EVIDENCE, quoted rather than described:<br/>violates check constraint 'media_objects_state_check'<br/><br/>The predicate admits both states because the clause names both.<br/>Widening the CHECK so a fixture could plant 'ready' would buy a<br/>green assertion about a transition no code performs."]
    check ~~~ evidence`;
