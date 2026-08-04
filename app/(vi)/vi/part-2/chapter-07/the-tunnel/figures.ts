// Hình minh họa chương 2.7. Mã Mermaid sống ở đây, không bao giờ nằm trong
// page.mdx. Tên đến từ tài liệu và code được giữ nguyên khi là technical term.

export const figRaceTimeline = `sequenceDiagram
    participant T as Tuan (đang reconnect)
    participant G as Gateway
    participant A as API service
    participant R as Redis
    Note over T,R: NAIVE ORDER: backfill, rồi subscribe
    T->>G: connect {cursor: seq 41}
    G->>A: backfill since 41
    A-->>G: seq 42 (reply)
    Note over R: seq 43 được publish NGAY LÚC NÀY —<br/>trong backfill window
    G-->>T: seq 42
    G->>R: subscribe (quá muộn)
    Note over T: seq 43 rơi vào gap — MẤT.<br/>Đảo thứ tự mà không có buffer thì test<br/>thấy [43, 42, 43]: hai lần, và sai thứ tự.<br/>Cả hai order đều sai.`;

export const figBufferMachine = `flowchart TB
    s1["1 · SUBSCRIBE trước<br/>(live frames bắt đầu arrive)"]
    s2["2 · BUFFER<br/>giữ live frames, chưa deliver gì"]
    s3["3 · BACKFILL<br/>fetch seq > cursor từ api,<br/>emit theo sequence order · ghi high-water mark H"]
    s4["4 · FLUSH<br/>emit buffered frames có seq > H,<br/>DISCARD seq ≤ H (đã nằm trong backfill)"]
    s5["5 · LIVE<br/>deliver khi frames arrive"]
    s1 --> s2 --> s3 --> s4 --> s5
    note["Overlap là CỐ Ý: một frame có thể nằm trong cả<br/>buffer và backfill — và seq làm duplicate<br/>phát hiện được, đó là phần lớn lý do<br/>sequence numbers tồn tại (SAD §5.2 → ADR-03)"]
    s4 ~~~ note`;

export const figTunnelWalk = `sequenceDiagram
    participant T as Tuan
    participant G as Gateway (bất kỳ instance nào)
    participant A as API service
    T->>G: WS connect {token, cursor: ch1=41}
    G->>G: verify JWT · register
    G->>G: subscribe Redis subjects TRƯỚC, buffer live frames
    G->>A: POST /internal/backfill {user, cursors}
    A-->>G: seq > 41 per channel, cap 500
    G-->>T: connection.ack {resume_ok}
    G-->>T: backfilled frames, sequence order
    G->>G: flush buffer, discard seq ≤ high-water mark
    G-->>T: live frames resume
    Note over T: "B2, north ramp" trong queue retry<br/>với key GỐC (path của 2.3)`;
