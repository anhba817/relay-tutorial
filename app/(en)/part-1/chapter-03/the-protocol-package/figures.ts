// Chapter 1.3 figures (feature 016). Mermaid sources live here, never in
// page.mdx. Frame names come from the chapter's derivation table only.

export const figFrameMap = `flowchart LR
    client["Client<br/>(SDK, later)"]
    server["Server<br/>(gateway, 1.4 →)"]
    client -- "message.send" --> server
    server -- "connection.ack · message.ack" --> client
    server -- "message.created · message.updated · message.deleted" --> client
    server -- "membership.changed · presence.changed · typing" --> client
    server -- "error {code, message, docs_url}" --> client
    codes["close codes<br/>4001 auth · 4002 protocol ·<br/>4008 quota · 4009 shutdown"]
    server -.-> codes`;

export const figOneSource = `flowchart TB
    schema["ONE zod schema<br/>messageSendSchema"]
    runtime["runtime validation<br/>parseFrame(raw) →<br/>accepts or rejects, never throws"]
    types["static type<br/>type MessageSend = z.infer&lt;…&gt;<br/>(no hand-written twin)"]
    schema --> runtime
    schema --> types
    note["Types erase at runtime.<br/>Schemas are types that survive —<br/>and they cannot drift apart:<br/>there is no second definition."]
    schema ~~~ note`;

export const figPayoffRevisited = `flowchart TB
    proto["@relay/protocol ✓ BUILT<br/>frame schemas · inferred types ·<br/>error + close codes (this chapter)"]
    gw["Gateway service<br/>(1.4 →)"]
    apisvc["API service<br/>(1.4 →)"]
    sdk["The JS SDK<br/>(a later part)"]
    proto -.-> gw
    proto -.-> apisvc
    proto -.-> sdk
    note["1.1 promised it, 1.3 built it:<br/>a frame change is ONE commit —<br/>drift is a compile error,<br/>not a production incident"]
    proto ~~~ note`;
