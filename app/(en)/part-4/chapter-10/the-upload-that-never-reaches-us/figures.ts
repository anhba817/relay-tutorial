// Chapter 4.10 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/056-chapter-4-10/baseline.txt.

export const figThePathTheBytesTake = `flowchart LR
    client["the client"]
    api["Relay's api<br/>signs a URL · writes a row<br/>never sees a byte"]
    store["object storage<br/>MinIO / S3"]
    client -->|"1 · POST /v1/media<br/>{filename, mime_type, bytes}"| api
    api -->|"2 · 201 { media_id, upload_url, expires_at }"| client
    client -->|"3 · PUT the file, straight to the store"| store
    store -->|"4 · 200"| client
    measured["MEASURED, in the api's own request log:<br/>5 slot requests logged · 0 rows for the upload<br/>the 44-byte PUT never touched the api"]
    api ~~~ measured
    cost["and step 1 now costs a round trip to the store<br/>that produces nothing but a refusal (FR-017)<br/>p50 6.335 ms -> 7.859 ms · +24.1%"]
    store ~~~ cost`;

export const figFourRefusalsOneOfThemTransient = `flowchart TB
    ask["POST /v1/media"]
    t["media_type_not_allowed · 415<br/>not one of the ten<br/>REMEDY: transcode"]
    s["media_too_large · 413<br/>over its kind's cap<br/>REMEDY: compress"]
    u["media_storage_unavailable · 503<br/>the store did not answer<br/>REMEDY: retry"]
    q["media_storage_exhausted · 402<br/>the tenant's bytes are spent<br/>REMEDY: delete"]
    ask --> t --> s --> u --> q --> ok["201 · a slot"]
    perm["THREE ARE PERMANENT. Retrying them is wasted advice,<br/>and telling a client to compress when the store is down<br/>is permanent advice about a transient state."]
    t ~~~ perm
    order["The order is the refusal's cost:<br/>two facts about the request, then a round trip,<br/>then the only one that writes."]
    q ~~~ order`;

export const figALevelNotAFlow = `flowchart TB
    subgraph flows["THREE FLOWS — usage_periods, keyed on a calendar month"]
      m["messages sent"]
      a["unique active persons"]
      c["connection-minutes"]
      reset["all three reset on the 1st<br/>creditFor never subtracts"]
      m --> reset
      a --> reset
      c --> reset
    end
    subgraph level["ONE LEVEL — sum(declared_bytes) over media_objects"]
      b["stored bytes"]
      falls["falls when objects are deleted<br/>the 1st changes nothing"]
      b --> falls
    end
    wrong["Put it in the monthly row and a tenant holding 100 GB<br/>starts every month at zero — and is allowed another 100."]
    reset ~~~ wrong
    falls ~~~ wrong
    clause["FR-RTL-05 named three quantities and two other clauses<br/>cited it for a fourth. SRS 1.17 says which kind each one is."]
    wrong --> clause`;
