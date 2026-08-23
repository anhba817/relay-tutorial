// Chapter 3.12 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figDerivedTargets = `flowchart LR
    app["Nest application<br/>instance"] --> adapter["httpAdapter<br/>.getInstance()"]
    adapter --> router["router.stack<br/>(or _router, or none)"]
    router --> layers["layers"]
    layers --> mw["middleware<br/>no route"]
    layers --> routes["24 routes<br/>method + path"]
    routes --> cls["CLASSIFICATIONS"]
    cls --> read["read 2"]
    cls --> list["list 1"]
    cls --> write["write 17"]
    cls --> cred["credential 1"]
    cls --> exempt["exempt 3<br/>each with a reason"]
    routes --> un["matched by nothing"]
    un --> fail["the build fails,<br/>naming the route"]
    style fail fill:#7f1d1d,color:#fff,stroke:#dc2626
    style routes fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figWhoMayCall = `flowchart TB
    subgraph user["an end-user token"]
      ut["carries ONE environment<br/>and one subject"]
      ut --> uattack["attack: a token minted in A<br/>against a resource in B"]
      uattack --> upair["compare the refusal against<br/>a resource that exists nowhere"]
    end
    subgraph platform["a platform credential"]
      pc["carries NO environment.<br/>The dispatcher serves every tenant."]
      pc --> pclass["chapter 3.2: which CLASS may call?"]
      pclass --> pserv["chapter 3.12: which SERVICE may call?"]
      pserv --> refuse["wrong_credential_service"]
      pc --> pattack["attack: name environment A,<br/>carry an identifier from B"]
      pattack --> only2["only 2 of 5 routes<br/>can express it"]
    end
    style refuse fill:#7f1d1d,color:#fff,stroke:#dc2626
    style only2 fill:#78350f,color:#fff,stroke:#d97706`;

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
