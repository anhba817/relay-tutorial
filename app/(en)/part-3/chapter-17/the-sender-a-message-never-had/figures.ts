// Chapter 3.17 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figAbsence = `flowchart TB
    q["a key send has to name SOMETHING"]
    q --> n["NULLABLE SENDER<br/>keep the absence"]
    q --> s["SYNTHETIC USER<br/>the platform mints one"]
    q --> b["BOT USER<br/>the customer declares one"]
    n --> nc["every reader handles null<br/>— three chapters already pay for this<br/>toFrame drops the row entirely"]
    s --> sc["chapter 3.10 argued against it:<br/>inflates the dimension the customer<br/>is measured on"]
    b --> bc["a users row with kind and description<br/>every reader since 3.15 already reads users<br/>the description makes it ANSWERABLE"]
    style nc fill:#7f1d1d,color:#fff,stroke:#dc2626
    style sc fill:#7f1d1d,color:#fff,stroke:#dc2626
    style bc fill:#064e3b,color:#fff,stroke:#059669`;

export const figBlastRadius = `flowchart TB
    subgraph counted["THREE COUNTS, MEASURED BEFORE THE WORK"]
      g["grep -c 'sendMessage('<br/>100"]
      r["R1's HTTP send sites<br/>46"]
      o["call sites OMITTING userId<br/>27"]
    end
    counted --> t["make userId required"]
    t --> c["the compiler names 28"]
    c --> x["the 28th is messages.service.ts<br/>the ONLY production caller<br/>— it passes string | undefined,<br/>which is refused just as firmly"]
    x --> l["a count of what omits a property<br/>cannot see the site that passes<br/>a possibly-undefined value"]
    style x fill:#7f1d1d,color:#fff,stroke:#dc2626
    style l fill:#1e3a5f,color:#fff,stroke:#3b82f6`;

export const figRefusalOrder = `flowchart TB
    r["resolve the named sender<br/>400, field: user"]
    r --> b["is the sender BANNED?<br/>403 user_banned"]
    b --> v["can the sender SEE the channel?<br/>404, as if absent"]
    v --> a["is the channel ARCHIVED?<br/>403 channel_archived"]
    a --> k["may this credential send AS IT?<br/>403 sender_not_permitted"]
    r --- why1["the contract numbered this FOURTH.<br/>the ban check reads the sender's ROW,<br/>so resolution cannot come after it"]
    k --- why2["LAST, because this refusal names a fact<br/>about a USER — it must not be provokable<br/>for a channel the caller cannot reach"]
    style r fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style k fill:#1e3a5f,color:#fff,stroke:#3b82f6`;

export const figTwoCounters = `flowchart LR
    ins["INSERT into usage_active_users<br/>repository.ts ~3874"]
    cap["count(*) vs caps.active_users.hard<br/>repository.ts ~4055"]
    row["one row per user per period"]
    ins --> row
    row --> cap
    ins --- m["THE BILL — FR-ANL-05<br/>'shall meter ... unique active users'<br/>a bot counts"]
    cap --- e["THE CEILING — FR-RTL-05<br/>narrowed to 'unique active persons'<br/>a bot does NOT count"]
    cap --> ref["refuses the FIRST send of a period.<br/>a bot taking the last slot means<br/>a PERSON is refused, and it is not<br/>whoever caused it"]
    style ref fill:#7f1d1d,color:#fff,stroke:#dc2626
    style m fill:#064e3b,color:#fff,stroke:#059669
    style e fill:#064e3b,color:#fff,stroke:#059669`;
