// Chapter 3.1 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents and the schema only.

export const figBoundary = `flowchart TB
    subgraph above["ABOVE the tenant boundary — who owns the account"]
      org["organisations"]
      app["applications<br/>(FR-TEN-03: many per organisation)"]
      hum["humans<br/>(a person, one provider account)"]
      mem["memberships<br/>(owner · admin · member — FR-TEN-07)"]
    end
    subgraph below["BELOW it — every row carries environment_id"]
      env["environments<br/>(exactly two: development · production — FR-TEN-04)"]
      rest["users · channels · members · messages<br/>(all of Part 2)"]
    end
    org --> app
    app --> env
    env --> rest
    org --- mem
    mem --- hum
    note["The line is the whole chapter. Above it, no row has an<br/>environment_id — a person is not a tenant. Below it,<br/>every row has one and the repository requires it<br/>(constitution I, FR-TEN-06)"]
    below ~~~ note`;

export const figSignup = `sequenceDiagram
    participant B as Browser (a human)
    participant A as API service
    participant P as Provider (GitHub)
    participant DB as PostgreSQL
    B->>A: GET /auth/github/start
    A->>A: mint state · set it in an HttpOnly cookie
    A-->>B: 302 to the provider, carrying the same state
    B->>P: authorize (the consent screen)
    P-->>B: 302 back with code + state
    B->>A: GET /auth/github/callback?code&state
    A->>A: state from the query MUST equal the cookie —<br/>checked BEFORE any provider call
    A->>P: POST token endpoint (code -> access token)
    A->>P: GET user endpoint (who is this?)
    A->>DB: one transaction: human · organisation ·<br/>application · environment(development) · owner
    A-->>B: 200 {organisation, application, environment, created}
    Note over A,DB: five rows or none (FR-TEN-02) —<br/>and a second authentication creates nothing`;

export const figTwoPopulations = `flowchart LR
    subgraph rejected["The tempting shape — rejected (ADR-18)"]
      one["one users table<br/>environment_id NULLABLE<br/>(null = a platform human)"]
      cost["a nullable tenant column is the one shape<br/>Principle I forbids: the repository can no<br/>longer refuse an unscoped query BY CONSTRUCTION,<br/>and FR-TEN-05 becomes a code review"]
      one --> cost
    end
    subgraph chosen["What the chapter builds"]
      humans["humans — identified by<br/>(provider, provider_account_id)<br/>no environment_id, ever"]
      users["users — identified by the<br/>customer's external_id<br/>environment_id NOT NULL"]
    end
    humans -.->|"never merged, no row crosses"| users`;
