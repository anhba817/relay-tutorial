// Figures của chương 3.15. Mermaid source sống ở đây, không bao giờ nằm trong page.mdx.
// Tên lấy từ tài liệu, schema và code — không đặt tên mới.

export const figRefusalOrder = `flowchart TB
    req["một request gọi tên một channel id"]
    req --> ban["1 — BỊ BAN?<br/>kiểm tra trước khi channel được resolve"]
    ban -->|có| one["một câu trả lời cho mọi channel id,<br/>thật hay bịa"]
    ban -->|không| vis["2 — THẤY ĐƯỢC?<br/>private và không phải member → envelope not-found"]
    vis -->|không| gone["giống từng byte với một channel<br/>không tồn tại"]
    vis -->|có| arch["3 — ĐÃ LƯU TRỮ?<br/>channel_archived"]
    arch --> ok["thực hiện operation"]
    leak["ARCHIVE TRƯỚC, MEMBERSHIP SAU:<br/>người không phải member của một channel private ĐÃ LƯU TRỮ<br/>nhận channel_archived và biết nó tồn tại"]
    style leak fill:#7f1d1d,color:#fff,stroke:#dc2626
    style gone fill:#064e3b,color:#fff,stroke:#059669
    style one fill:#064e3b,color:#fff,stroke:#059669`;

export const figThreePlaces = `flowchart LR
    subgraph places["MỘT CHECK VỀ NGƯỜI GỌI CẦN BA CHỖ"]
      h["handler<br/>resolve principal"]
      s["service<br/>chuyền nó xuống"]
      r["hàm repository<br/>nhận một userId"]
      h --> s --> r
    end
    r --> fires["check mới có thể chạy"]
    gap1["send: handler không truyền user nào<br/>send(channelId, body)"]
    gap2["history: listMessages(channelId, opts)<br/>không có chỗ nào để đặt user"]
    gap1 --> dead["một tham số không ai điền<br/>thì không mã hoá điều gì"]
    gap2 --> dead
    style dead fill:#7f1d1d,color:#fff,stroke:#dc2626
    style fires fill:#064e3b,color:#fff,stroke:#059669`;

export const figSameTenant = `flowchart TB
    old["BỐN HÌNH THÁI TẤN CÔNG CHƯƠNG 3.12 DỰNG<br/>cả bốn đều lấy identifier của tenant KHÁC"]
    old --> s1["một id lạ trên credential của tenant"]
    old --> s2["một id lạ trên user token"]
    old --> s3["một credential từ environment khác"]
    old --> s4["một socket frame gọi tên channel lạ"]
    new["HÌNH THÁI KHÔNG CÓ FIXTURE NÀO<br/>channel private của CHÍNH tenant bạn,<br/>và bạn không phải member"]
    new --> pair["cặp đôi: id đó, và một id không tồn tại ở đâu cả"]
    pair --> oracle["withoutRequestId — giống từng byte, hoặc test đỏ"]
    ctrl["VÀ ĐỐI CHỨNG: token của một member,<br/>cùng channel đó, 200"]
    ctrl --> why["thiếu nó, hai lời từ chối vì<br/>lý do chẳng liên quan cũng khớp nhau"]
    style new fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style why fill:#7f1d1d,color:#fff,stroke:#dc2626
    style oracle fill:#064e3b,color:#fff,stroke:#059669`;
