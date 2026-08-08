// Chapter 3.2 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the routes only.

export const figTwoCredentials = `flowchart TB
    subgraph app["The APPLICATION — a company's backend"]
      key["API key<br/>rk_dev_&lt;public_id&gt;_&lt;secret&gt;<br/>(FR-AUT-01, FR-AUT-03)"]
    end
    subgraph user["The END USER — a person in that company's product"]
      tok["End-user token<br/>HS256, signed with the environment's own secret<br/>(FR-AUT-06, FR-AUT-08)"]
    end
    rest["REST: POST · GET /v1/channels/:id/messages<br/>accepts either class"]
    dev["POST /auth/dev-token<br/>API key ONLY, development ONLY (FR-AUT-09)"]
    ws["WebSocket upgrade /v1/ws?token=<br/>end-user token ONLY (EIR-WS-05)"]
    key --> rest
    key --> dev
    tok --> rest
    tok --> ws
    key -. "403 wrong_credential_type" .-> ws
    tok -. "403 wrong_credential_type" .-> dev
    note["Both resolve to ONE principal carrying an environment_id.<br/>Nothing downstream asks which class it was — except the<br/>routes that must (research R6)"]
    rest ~~~ note`;

export const figConnect = `sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as API service
    participant DB as PostgreSQL
    C->>G: upgrade /v1/ws?token=eyJ…
    Note over G: holds NO signing secret<br/>after this chapter
    G->>A: POST /internal/session<br/>Authorization: Bearer (the same token)
    A->>DB: environments.signing_secret for the token's env claim
    A->>A: verify HS256 · check sub/env/iat/exp (FR-AUT-06/07/08)
    A->>DB: channels this user belongs to
    A-->>G: 200 { environment_id, user, channel_ids }
    G-->>C: connection.ack
    Note over G,A: ONE call, the same one 2.5 already made for<br/>memberships. The connect path gained no round trip —<br/>it stopped asking the smaller question (research R1)`;

export const figAuthOrder = `flowchart LR
    req["request arrives"]
    mw["RequestContextMiddleware<br/>then AuthenticateMiddleware<br/>→ req.principal"]
    fac["request-scoped Repository factory<br/>reads principal.environmentId"]
    grd["CredentialGuard<br/>may THIS class use THIS route?"]
    hnd["handler"]
    req --> mw --> fac --> grd --> hnd
    measured["Measured, not assumed (T004):<br/>middleware → factory → guard.<br/>2.6 found the factory runs before the enhancer chain,<br/>which is why authentication cannot live in a guard"]
    fac -.-> measured`;
