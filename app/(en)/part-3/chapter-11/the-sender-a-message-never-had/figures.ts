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
    g["grep -c 'sendMessage('<br/>71 occurrences, 16 files"]
    g --> t["make userId required,<br/>run the compiler"]
    t --> c["27 errors, 8 files,<br/>all inside @relay/api"]
    c --> a["26 x TS2345<br/>a test passing { text }<br/>and no sender"]
    c --> b["1 x TS2379 — messages.service.ts<br/>the ONLY production caller.<br/>it does not OMIT userId,<br/>it passes string | undefined"]
    b --> l["a count of what omits a property<br/>cannot see the site that passes<br/>a possibly-undefined value —<br/>and that site was the only DECISION"]
    style b fill:#7f1d1d,color:#fff,stroke:#dc2626
    style l fill:#1e3a5f,color:#fff,stroke:#3b82f6`;

export const figRefusalOrder = `flowchart TB
    r["resolve the named sender<br/>400, field: user"]
    r --> b["is the sender BANNED?<br/>403 user_banned"]
    b --> v["can the sender SEE the channel?<br/>404, as if absent"]
    v --> k["may this credential send AS IT?<br/>403 sender_not_permitted"]
    k --> a["is the channel ARCHIVED?<br/>403 channel_archived"]
    r --- why1["the contract numbered this FOURTH.<br/>the ban check reads the sender's ROW,<br/>so resolution cannot come after it"]
    v --- why2["AFTER VISIBILITY, both of them.<br/>each names a fact the caller must not be<br/>able to provoke for a channel it cannot reach"]
    k --- why3["and the k/a pair is the one adjacency<br/>here that does NOT matter: both address<br/>a caller already shown the channel exists"]
    style r fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style v fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style why3 fill:#3f3f46,color:#fff,stroke:#71717a`;
