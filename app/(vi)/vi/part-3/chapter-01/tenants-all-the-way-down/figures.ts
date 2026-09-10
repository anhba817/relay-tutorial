// Hình minh họa chương 3.1. Mermaid sources sống ở đây, không bao giờ nằm
// trong page.mdx. Tên đến từ documents và schema.

export const figBoundary = `flowchart TB
    subgraph above["PHÍA TRÊN tenant boundary — ai sở hữu account"]
      org["organisations"]
      app["applications<br/>(FR-TEN-03: nhiều per organisation)"]
      hum["humans<br/>(một người, một provider account)"]
      mem["memberships<br/>(owner · admin · member — FR-TEN-07)"]
    end
    subgraph below["PHÍA DƯỚI — mọi row mang environment_id"]
      env["environments<br/>(đúng hai: development · production — FR-TEN-04)"]
      rest["users · channels · members · messages<br/>(toàn bộ Phần 2)"]
    end
    org --> app
    app --> env
    env --> rest
    org --- mem
    mem --- hum
    note["Đường này là cả chương. Phía trên, không row nào có<br/>environment_id — một người không phải tenant. Phía dưới,<br/>mọi row có một environment_id và repository require nó<br/>(constitution I, FR-TEN-06)"]
    below ~~~ note`;

export const figSignup = `sequenceDiagram
    participant B as Browser (a human)
    participant A as API service
    participant P as Provider (GitHub)
    participant DB as PostgreSQL
    B->>A: GET /auth/github/start
    A->>A: mint state · set vào HttpOnly cookie
    A-->>B: 302 tới provider, mang cùng state
    B->>P: authorize (consent screen)
    P-->>B: 302 quay về với code + state
    B->>A: GET /auth/github/callback?code&state
    A->>A: state từ query PHẢI bằng cookie —<br/>check TRƯỚC mọi provider call
    A->>P: POST token endpoint (code -> access token)
    A->>P: GET user endpoint (đây là ai?)
    A->>DB: một transaction: human · organisation ·<br/>application · environment(development) · owner
    A-->>B: 200 {organisation, application, environment, created}
    Note over A,DB: năm rows hoặc không row nào (FR-TEN-02) —<br/>và authentication thứ hai không tạo gì`;

export const figTwoPopulations = `flowchart LR
    subgraph rejected["Shape hấp dẫn — rejected (ADR-18)"]
      one["một users table<br/>environment_id NULLABLE<br/>(null = platform human)"]
      cost["nullable tenant column là shape<br/>Principle I cấm: repository không còn<br/>refuse unscoped query BY CONSTRUCTION,<br/>và FR-TEN-05 thành code review"]
      one --> cost
    end
    subgraph chosen["Thứ chương này build"]
      humans["humans — identified by<br/>(provider, provider_account_id)<br/>không bao giờ có environment_id"]
      users["users — identified by<br/>external_id của customer<br/>environment_id NOT NULL"]
    end
    humans -.->|"không bao giờ merged, không row nào crossing"| users`;
