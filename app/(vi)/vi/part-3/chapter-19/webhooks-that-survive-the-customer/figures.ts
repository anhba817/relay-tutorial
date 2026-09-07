// Hình minh họa chương 3.5. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và code.

export const figThePatternStops = `sequenceDiagram
    participant B as Broker (DELIVERIES)
    participant D as Dispatcher
    participant C as Server của khách hàng
    participant A as api service
    Note over D,A: 3.4 claim work và chạy effect trong MỘT<br/>transaction. Ở đây không có nửa nào dùng được:<br/>effect nằm trên cỗ máy ta không sở hữu, còn<br/>claim là một lời gọi sang service khác.
    D->>C: POST /hook · đã ký
    C-->>D: 200
    Note over D,A: KHOẢNG HỞ — khách hàng đã có webhook,<br/>nền tảng chưa ghi nhận,<br/>và chưa có gì báo sai
    D->>A: report outcome
    A-->>D: delivered
    D--xB: ack
    Note over D: nếu process chết trong khoảng hở,<br/>delivery được gửi lại và POST THÊM LẦN NỮA.<br/>Khách hàng hấp thụ nó bằng event id`;

export const figTheSchedule = `flowchart TB
    ev["một event trên events.><br/>(envelope của chương 3.3)"]
    claim{"claim event<br/>consumed_events"}
    dupe["ack — đã nở rồi<br/>bởi một lần deliver trước"]
    rows[("N dòng delivery,<br/>mỗi endpoint khớp một dòng,<br/>ghi BÊN TRONG claim")]
    due{"next_attempt_at &lt;= now()<br/>VÀ dispatched_at IS NULL?"}
    wait["chưa tới hạn — là một DÒNG, không phải<br/>message broker đang giữ.<br/>Không chiếm slot acknowledgement"]
    post["dispatcher post, đã ký"]
    out{"khách hàng nói gì?"}
    ok["state = delivered"]
    again["attempt + 1 · next_attempt_at<br/>= now + tier[attempt]"]
    dead["cạn 7 lần thử:<br/>state = dead, ghi dead letter"]
    ev --> claim
    claim -- "không (trùng)" --> dupe
    claim -- có --> rows --> due
    due -- chưa --> wait --> due
    due -- rồi --> post --> out
    out -- "2xx" --> ok
    out -- "bất kỳ thứ gì khác, hoặc không gì" --> again
    again --> due
    again -- "hết tier" --> dead`;

export const figWhereItRuns = `flowchart LR
    subgraph api["api service — người DUY NHẤT ghi Postgres (hiến pháp IV)"]
      http["HTTP handlers<br/>CRUD webhook endpoint"]
      relay["delivery relay<br/>rút cạn thứ TỚI HẠN"]
      internal["/internal/dispatch<br/>expand · material · outcome"]
      pg[("webhook_endpoints<br/>webhook_deliveries<br/>webhook_dead_letters")]
    end
    subgraph disp["dispatcher service — KHÔNG ghi gì"]
      expand["expand consumer<br/>events.>"]
      deliver["deliver consumer<br/>deliveries.>"]
    end
    js[("JetStream<br/>EVENTS · DELIVERIES")]
    cust["server của khách hàng"]
    http --> pg
    relay --> pg
    internal --> pg
    relay --> js
    js --> expand
    js --> deliver
    expand -->|HTTP| internal
    deliver -->|HTTP| internal
    deliver -->|"POST, đã ký"| cust`;
