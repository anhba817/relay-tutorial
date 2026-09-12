// Hình minh hoạ chương 3.10. Mã mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên bảng, tên cột và định danh giữ nguyên tiếng Anh.

export const figTwoPromises = `flowchart LR
    subgraph limit["chương 3.8 · một rate limit"]
      l1["counter trong Redis<br/>rl:{environment_id}:{window}"]
      l2["cửa sổ: 60 giây"]
      l3["một cú flush tốn<br/>MỘT CỬA SỔ phục vụ quá tay"]
      l1 --> l2 --> l3
    end
    subgraph quota["chương 3.10 · một quota"]
      q1["usage_periods<br/>(environment_id, period)"]
      q2["kỳ: một tháng dương lịch"]
      q3["một cú flush tốn<br/>KHÔNG GÌ CẢ"]
      q1 --> q2 --> q3
    end
    style l3 fill:#7c2d12,color:#fff,stroke:#ea580c
    style q3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figWhereItIsEnforced = `flowchart TB
    rest["POST /v1/channels/:id/messages"] --> mw["RateLimitMiddleware"]
    ws["POST /internal/messages<br/>(gateway, cho một lần gửi qua WebSocket)"] -.->|"operationsFor trả về []"| mw
    mw --> svc["MessagesService.send"]
    ws --> svc
    svc --> repo["Repository.sendMessage<br/>MỘT transaction"]
    repo --> check["đọc hạn mức + usage"]
    check --> msg["INSERT messages"]
    msg --> out["INSERT outbox"]
    out --> usage["INSERT usage_periods<br/>ON CONFLICT DO UPDATE"]
    usage --> cross["INSERT quota_notifications<br/>cho mỗi mốc đã vượt"]
    style mw fill:#7c2d12,color:#fff,stroke:#ea580c
    style repo fill:#064e3b,color:#fff,stroke:#059669`;

export const figNoSweep = `flowchart TB
    subgraph obvious["thiết kế hiển nhiên"]
      s1["mỗi 5 phút"] --> s2["đi qua TỪNG environment"]
      s2 --> s3["so usage với hạn mức"]
      s3 --> s4["một global operation:<br/>trigger, một mục miễn trừ,<br/>một lint ignore, một bài test cẩn thận"]
    end
    subgraph actual["những gì một lần gửi đã biết"]
      a1["usage CHỈ tăng khi có người gửi"] --> a2["transaction giữ cả<br/>giá trị TRƯỚC và SAU"]
      a2 --> a3["nên nó biết đã vượt qua mốc nào"]
      a3 --> a4["không sweep, không miễn trừ,<br/>không file nào vào danh sách"]
    end
    style s4 fill:#7c2d12,color:#fff,stroke:#ea580c
    style a4 fill:#064e3b,color:#fff,stroke:#059669`;

export const figOutboxFourth = `flowchart LR
    o1["chương 3.3<br/>outbox<br/>published_at"]
    o2["chương 3.5<br/>webhook_deliveries<br/>state · next_attempt_at"]
    o3["chương 3.9<br/>webhook_disable_notifications<br/>delivered_at"]
    o4["chương 3.10<br/>quota_notifications<br/>delivered_at"]
    o1 --> o2 --> o3 --> o4
    note["bốn bảng cụ thể trông giống nhau là một PATTERN.<br/>một bảng trừu tượng phục vụ bốn mục đích là một FRAMEWORK."]
    o4 -.-> note
    style o4 fill:#064e3b,color:#fff,stroke:#059669`;
