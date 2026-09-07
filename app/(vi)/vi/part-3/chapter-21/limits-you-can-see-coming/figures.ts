// Hình minh hoạ chương 3.8. Nguồn mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên gọi chỉ lấy từ tài liệu, schema và code.

export const figTwoDirections = `flowchart TB
    out(["Redis không truy cập được"])
    subgraph tenant["bộ giới hạn TENANT · rl:{env}:{op}:{window}"]
      t1["không biết số đếm"]
      t2["PHỤC VỤ request"]
      t3["chỉ còn X-RateLimit-Limit<br/>Remaining và Reset vắng mặt"]
      t1 --> t2 --> t3
    end
    subgraph auth["bộ giới hạn XÁC THỰC · rlauth:{address}:{window}"]
      a1["không biết số đếm"]
      a2["bộ đếm dự phòng in-process<br/>cùng ngưỡng"]
      a3["TỪ CHỐI khi quá 10/phút<br/>trên mỗi instance, không phải toàn fleet"]
      a1 --> a2 --> a3
    end
    out --> t1
    out --> a1
    why1["sự cố cache không được phép<br/>từ chối lưu lượng đã trả tiền<br/>SAD §6.3"]
    why2["một cửa sổ không giới hạn cho<br/>đăng nhập thất bại không phải<br/>suy giảm, nó là lỗ hổng"]
    t3 -.-> why1
    a3 -.-> why2
    style t2 fill:#064e3b,color:#fff,stroke:#059669
    style a3 fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figTwoPositions = `flowchart LR
    req(["request"])
    rc["RequestContextMiddleware<br/>chương 2.2"]
    am["AuthenticateMiddleware<br/>chương 3.2"]
    rl["RateLimitMiddleware<br/>chương 3.8"]
    cg{"CredentialGuard"}
    h["handler"]
    req --> rc --> am --> rl --> cg --> h
    inside[["bộ đếm XÁC THỰC sống<br/>BÊN TRONG middleware này:<br/>nó phải chạy được cả khi<br/>không có principal"]]
    after[["bộ giới hạn TENANT đứng SAU nó:<br/>giới hạn thuộc về một environment<br/>và chỉ bước này mới biết<br/>đó là environment nào"]]
    am -.-> inside
    rl -.-> after
    style am fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style rl fill:#064e3b,color:#fff,stroke:#059669`;

export const figBoundaryBurst = `flowchart TB
    subgraph w1["cửa sổ N · 12:00:00 – 12:00:59"]
      b1["600 request<br/>lúc 12:00:59"]
    end
    subgraph w2["cửa sổ N+1 · 12:01:00 – 12:01:59"]
      b2["600 request<br/>lúc 12:01:00"]
    end
    cost["1.200 request trong hai giây<br/>đối lại giới hạn 600 mỗi phút"]
    b1 --> cost
    b2 --> cost
    gain["Reset gọi tên MỘT khoảnh khắc.<br/>Câu trả lời trung thực của một<br/>bucket đang tự đầy lại là một<br/>đường cong, mà header chỉ đủ<br/>chỗ cho một con số."]
    cost -.->|"cái giá"| gain
    style cost fill:#78350f,color:#fff,stroke:#d97706
    style gain fill:#064e3b,color:#fff,stroke:#059669`;
