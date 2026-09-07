// Hình minh hoạ chương 3.11. Mã mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên bảng, tên cột và định danh giữ nguyên tiếng Anh.

export const figWhatABucketIs = `flowchart LR
    subgraph clock["đồng hồ treo tường"]
      m0["phút 00:00"]
      m1["phút 00:01"]
      m2["phút 00:02"]
    end
    open["socket mở<br/>00:00:59"] --> m0
    close["socket đóng<br/>00:01:01"] --> m1
    m0 --> c1["bị tính"]
    m1 --> c2["bị tính"]
    m2 --> c3["không bị tính"]
    total["2 giây trên đồng hồ<br/>HAI connection-minutes"]
    c1 --> total
    c2 --> total
    style c1 fill:#064e3b,color:#fff,stroke:#059669
    style c2 fill:#064e3b,color:#fff,stroke:#059669
    style total fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figTotalsNotDeltas = `flowchart TB
    subgraph delta["giao thức gửi phần chênh"]
      d1["báo: +5"] --> d2["báo: +5 MẤT"]
      d2 --> d3["báo: +5"]
      d3 --> d4["ghi nhận 10<br/>năm phút đã mất là mất hẳn"]
    end
    subgraph total["giao thức gửi tổng"]
      t1["báo: tổng 5"] --> t2["báo: tổng 10 MẤT"]
      t2 --> t3["báo: tổng 15"]
      t3 --> t4["ghi nhận 15<br/>mất mát tự lành"]
    end
    style d4 fill:#7c2d12,color:#fff,stroke:#ea580c
    style t4 fill:#064e3b,color:#fff,stroke:#059669`;

export const figTwoHops = `flowchart LR
    client["client"] -->|"WebSocket upgrade"| gw["gateway"]
    gw -->|"POST /internal/session<br/>Bearer &lt;user token&gt;"| api["api"]
    api -->|"402 quota_exceeded<br/>không có Retry-After"| gw
    gw -->|"error frame: quota_exceeded<br/>rồi close 4008"| client
    style api fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style gw fill:#3f2d63,color:#fff,stroke:#8b5cf6`;

export const figWhatTheApiCannotTell = `stateDiagram-v2
    [*] --> counting: báo cáo đầu tiên
    counting --> counting: báo cáo có tổng lớn hơn<br/>ghi nhận phần chênh
    counting --> counting: báo cáo có tổng bằng<br/>không ghi nhận gì
    counting --> stopped: báo cáo ngừng
    stopped --> [*]
    note right of stopped
      Một cú đóng sạch sẽ và một gateway
      bị giết đều đến đây giống hệt nhau.
      api không phân biệt được, và cũng
      không cần — đó là lý do trong thiết
      kế này không có reaper nào cả.
    end note`;
