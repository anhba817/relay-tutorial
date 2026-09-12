// Hình minh hoạ chương 3.9. Nguồn mermaid sống ở đây, không bao giờ nằm trong page.mdx.
// Tên gọi chỉ lấy từ tài liệu, schema và code.

export const figOutboxThrice = `flowchart TB
    subgraph c33["chương 3.3 · event"]
      o1["outbox<br/>published_at"] --> o1x["NATS"]
    end
    subgraph c35["chương 3.5 · delivery"]
      o2["webhook_deliveries<br/>state · next_attempt_at"] --> o2x["endpoint của khách hàng"]
    end
    subgraph c38["chương 3.8 · notification"]
      o3["webhook_disable_notifications<br/>delivered_at"] --> o3x["SMTP"]
    end
    note["cái thứ ba KHÔNG cần migration:<br/>chương 3.6 đã viết delivered_at<br/>và để nó null suốt"]
    o3 -.-> note
    style o3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figHeadOfLine = `flowchart TB
    subgraph before["một transaction cho cả lô"]
      b1["nhận việc cũ nhất trước<br/>dòng A · địa chỉ hỏng<br/>dòng B · dòng C"]
      b2["gửi A → NÉM LỖI"]
      b3["transaction cuộn ngược"]
      b4["A, B và C đều chưa được đánh dấu"]
      b5["lượt sau lại nhận A đầu tiên"]
      b1 --> b2 --> b3 --> b4 --> b5
      b5 -.->|"mãi mãi"| b1
    end
    subgraph after["cô lập theo từng dòng"]
      a1["nhận việc cũ nhất trước"]
      a2["A ném lỗi → onError, không đánh dấu"]
      a3["B và C gửi đi → đánh dấu"]
      a4["A thử lại lượt sau<br/>B và C đã đi rồi"]
      a1 --> a2 --> a3 --> a4
    end
    style b5 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style a3 fill:#064e3b,color:#fff,stroke:#059669`;

export const figWhatMailpitProves = `flowchart LR
    facts["DisableFacts<br/>url · environment · attempts<br/>KHÔNG có trường nào cho bí mật"]
    mail["disableNotification()"]
    smtp["Mailpit · SMTP"]
    api["Mailpit HTTP API"]
    test["lời khẳng định"]
    facts --> mail --> smtp --> api --> test
    stub["một STUB sẽ để test đọc lại<br/>chính đối tượng bên gửi truyền vào —<br/>nên một bí mật nằm trong header mà<br/>stub không mô hình hóa sẽ lọt qua"]
    test -.-> stub
    style smtp fill:#064e3b,color:#fff,stroke:#059669
    style stub fill:#7f1d1d,color:#fff,stroke:#dc2626`;
