// Hình minh họa chương 2.4 (feature 020 — DRAFT, chưa công bố). Mã Mermaid
// sống ở đây, không bao giờ nằm trong page.mdx. Tên định danh giữ nguyên
// tiếng Anh khi chúng đến từ code hoặc tài liệu.

export const figOffsetDrift = `sequenceDiagram
    participant C as Client
    participant A as API service
    Note over C,A: OFFSET pagination dưới live inserts
    C->>A: GET messages?offset=0&limit=50
    A-->>C: rows 1–50 (newest first)
    Note over A: ba NEW messages đến —<br/>mọi row dịch xuống ba vị trí
    C->>A: GET messages?offset=50&limit=50
    A-->>C: rows 51–100 — nhưng rows 48–50<br/>của page 1 xuất hiện LẠI (duplicates),<br/>và với deletes thì rows có thể BIẾN MẤT (gaps)
    Note over C: page 2 đã nói dối — feed dịch chuyển<br/>bên dưới page numbers`;

export const figCursorStability = `sequenceDiagram
    participant C as Client
    participant A as API service
    Note over C,A: CURSOR pagination dưới cùng inserts
    C->>A: GET messages?limit=50
    A-->>C: seq 412…363 + next_cursor(seq 363)
    Note over A: ba new messages đến —<br/>seq 413, 414, 415: không nằm dưới cursor nào
    C->>A: GET messages?cursor=…&limit=50
    A-->>C: seq 362…313 — đúng 50 tiếp theo,<br/>không repeats, không holes
    Note over C: cursor gọi tên một POSITION,<br/>không phải count — inserts không dịch chuyển được nó`;

export const figIndexRide = `flowchart LR
    q["WHERE channel_id = ?<br/>AND sequence < cursor<br/>ORDER BY sequence DESC<br/>LIMIT 50"]
    idx["messages_channel_seq<br/>(channel_id, sequence DESC)"]
    scan["pure index-order scan:<br/>seek một lần, đọc 50 entries, stop"]
    q --> idx --> scan
    note["Page của FR-MSG-09 là hướng đi tự nhiên<br/>của index — hot-path index<br/>mà 2.1 tạo cuối cùng cũng nằm trên hot path"]
    scan ~~~ note`;
