// Chapter 4.22 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/068-chapter-4-22/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green. `check:figures`
// is the gate that catches it and `pnpm build` is not.

export const figTwoSpaces = `flowchart TB
    subgraph identity["THE IDENTITY — what the customer already had"]
      ie["order-88412"]
      iu["u-4821"]
    end
    subgraph key["THE KEY — what Relay minted"]
      ke["419320ca-eaa8-412f-b157-c0a8f4bc8de5"]
    end
    ie -->|"users: 8 of 8 routes take it"| ok["accepted"]
    iu -->|"channels: 0 of 13 before this chapter"| no["500 internal_error"]
    ke -->|"channels: 13 of 13"| ok
    ok --> fk["foreign keys · ordering · primary key<br/>the key keeps all three jobs"]`;

export const figTheCast = `sequenceDiagram
    participant C as customer
    participant R as route
    participant D as driver
    participant P as Postgres
    C->>R: GET /v1/channels/order-88412
    R->>D: where external_id = $1 OR id = $1::uuid
    D->>P: both predicates, one statement
    P-->>D: ERROR 22P02 invalid input syntax for type uuid
    Note over P,D: raised BEFORE the OR can short-circuit
    D-->>R: throw
    R-->>C: 500 internal_error
    Note over R,C: the log records "status":500 and no cause`;

export const figTheOrder = `flowchart TB
    seg["the path segment"] --> shape{"parses as a uuid?"}
    shape -->|no| one["one query: external_id only<br/>THE CAST NEVER HAPPENS"]
    shape -->|yes| both["one query: external_id OR id<br/>order by (external_id = $1) desc"]
    one --> r["a key, or nothing"]
    both --> r
    r --> f["nothing becomes a fresh uuid —<br/>the handler refuses in its own order"]`;

export const figThePipeline = `flowchart LR
    m["middleware"] --> g["guards"] --> i["interceptors"] --> p["pipes"] --> h["handler"]
    m -.->|"no principal yet"| x["cannot scope<br/>a resolution here"]
    g -.->|"sets req.principal"| ok["the Repository can be built"]
    p -.->|"runs BEFORE the handler"| warn["so it answers before<br/>the ban check, and before<br/>'unknown user'"]`;
