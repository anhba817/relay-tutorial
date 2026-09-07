// Chapter 3.12 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figWhatMaskedWhat = `flowchart TB
    attack["GET /v1/channels/:id/messages<br/>with another tenant's channel id"]
    attack --> exists["channelExists(id)<br/>SCOPED — refuses here"]
    exists --> four["404, identical to an absent id"]
    exists -. never reached .-> list["listMessages(id)<br/>scope REMOVED for the experiment"]
    list --> leak["would have returned<br/>the other tenant's rows"]
    four --> green["the suite stayed GREEN.<br/>21 of 21."]
    green --> lesson["sensitive to the OUTERMOST check;<br/>blind to an inner one a live outer check masks"]
    style green fill:#78350f,color:#fff,stroke:#d97706
    style lesson fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style leak fill:#7f1d1d,color:#fff,stroke:#dc2626`;
