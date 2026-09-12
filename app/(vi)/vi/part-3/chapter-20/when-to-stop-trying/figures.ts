// Hình minh họa chương 3.6. Mã Mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên chỉ lấy từ documents, schema và code.

export const figTheTimeline = `gantt
    title Một delivery hỏng, đo theo quy tắc một giờ
    dateFormat X
    axisFormat %H:%M
    section Các lần thử
    1 · +0s          :milestone, 0, 0
    2 · +1s          :milestone, 1, 0
    3 · +6s          :milestone, 6, 0
    4 · +36s         :milestone, 36, 0
    5 · +5m36s       :milestone, 336, 0
    6 · +35m36s      :milestone, 2136, 0
    7 · +2h35m36s    :milestone, 9336, 0
    section Quy tắc
    một giờ trôi qua ở đây :crit, milestone, 3600, 0
    section Khoảng trống
    không có gì xảy ra ở mốc một giờ :active, 2136, 9336`;

export const figTwoTriggers = `flowchart TB
    out["một outcome được ghi<br/>recordAttemptOutcome"]
    run{"hỏng?"}
    clear["chuỗi hỏng bị xoá<br/>cả hai cột null"]
    open["chuỗi hỏng mở ra hoặc dài thêm<br/>started_at · attempts + 1"]
    check{"quá 1h VÀ >= 5 lần thử?"}
    sweep["vòng lặp của relay<br/>một truy vấn mỗi lượt drain"]
    find{"có endpoint nào có chuỗi hỏng<br/>đã vượt quá một giờ?"}
    disable["tắt, MỘT LẦN<br/>UPDATE ... WHERE enabled = true"]
    note["không dòng nào được cập nhật:<br/>ai đó đã tới trước"]
    notify[("webhook_disable_notifications<br/>delivered_at NULL")]
    out --> run
    run -- "2xx" --> clear
    run -- "bất kỳ thứ gì khác" --> open --> check
    check -- không --> wait["không có gì để làm"]
    check -- có --> disable
    sweep --> find
    find -- không --> wait
    find -- có --> disable
    disable -- "1 dòng" --> notify
    disable -- "0 dòng" --> note`;

export const figWhereTheRecordGoes = `flowchart LR
    disp["dispatcher<br/>gửi, đo, báo cáo"]
    subgraph api["api service — người DUY NHẤT ghi Postgres"]
      outcome["/internal/dispatch/outcome"]
      tx[["MỘT transaction:<br/>state của delivery · chuỗi hỏng<br/>· tắt · thông báo"]]
      pub["publishAttempt<br/>SAU khi commit"]
    end
    pg[("PostgreSQL<br/>vận hành")]
    js[("JetStream ANALYTICS<br/>analytics.webhook.attempt.env")]
    p4["ingester của Phần 4<br/>CHƯA DỰNG"]
    ch[("ClickHouse<br/>CHƯA DỰNG")]
    disp -->|"status · latency · error"| outcome
    outcome --> tx --> pg
    tx -.->|"commit trước"| pub
    pub -->|"nhiều nhất một lần<br/>hỏng thì ghi log rồi bỏ"| js
    js -.-> p4 -.-> ch
    pub -.->|"KHÔNG BAO GIỜ chặn"| outcome`;
