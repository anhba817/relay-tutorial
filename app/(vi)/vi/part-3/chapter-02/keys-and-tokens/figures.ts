// Hình minh họa chương 3.2. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và routes.

export const figTwoCredentials = `flowchart TB
    subgraph app["APPLICATION — backend của một công ty"]
      key["API key<br/>rk_dev_&lt;public_id&gt;_&lt;secret&gt;<br/>(FR-AUT-01, FR-AUT-03)"]
    end
    subgraph user["END USER — một người trong product của công ty đó"]
      tok["End-user token<br/>HS256, signed bằng secret riêng của environment<br/>(FR-AUT-06, FR-AUT-08)"]
    end
    rest["REST: POST · GET /v1/channels/:id/messages<br/>chấp nhận cả hai class"]
    dev["POST /auth/dev-token<br/>CHỈ API key, CHỈ development (FR-AUT-09)"]
    ws["WebSocket upgrade /v1/ws?token=<br/>CHỈ end-user token (EIR-WS-05)"]
    key --> rest
    key --> dev
    tok --> rest
    tok --> ws
    key -. "403 wrong_credential_type" .-> ws
    tok -. "403 wrong_credential_type" .-> dev
    note["Cả hai resolve thành MỘT principal mang environment_id.<br/>Không phần downstream nào hỏi nó thuộc class nào — trừ<br/>những route bắt buộc phải hỏi (research R6)"]
    rest ~~~ note`;

export const figConnect = `sequenceDiagram
    participant C as Client
    participant G as Gateway
    participant A as API service
    participant DB as PostgreSQL
    C->>G: upgrade /v1/ws?token=eyJ…
    Note over G: KHÔNG giữ signing secret<br/>sau chương này
    G->>A: POST /internal/session<br/>Authorization: Bearer (the same token)
    A->>DB: environments.signing_secret cho env claim của token
    A->>A: verify HS256 · check sub/env/iat/exp (FR-AUT-06/07/08)
    A->>DB: channels user này thuộc về
    A-->>G: 200 { environment_id, user, channel_ids }
    G-->>C: connection.ack
    Note over G,A: MỘT call, đúng call mà 2.5 đã dùng cho<br/>memberships. Connect path không thêm round trip —<br/>nó chỉ ngừng hỏi câu nhỏ hơn (research R1)`;

export const figAuthOrder = `flowchart LR
    req["request đến"]
    mw["RequestContextMiddleware<br/>then AuthenticateMiddleware<br/>→ req.principal"]
    fac["request-scoped Repository factory<br/>đọc principal.environmentId"]
    grd["CredentialGuard<br/>class NÀY có được dùng route NÀY không?"]
    hnd["handler"]
    req --> mw --> fac --> grd --> hnd
    measured["Đo được, không giả định (T004):<br/>middleware → factory → guard.<br/>2.6 thấy factory chạy trước enhancer chain,<br/>nên authentication không thể nằm trong guard"]
    fac -.-> measured`;
