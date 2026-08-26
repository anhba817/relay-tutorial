// Figure của chương 3.17. Nguồn mermaid nằm ở đây, không bao giờ trong page.mdx.
// Tên lấy từ tài liệu, schema và code — định danh, tên bảng và tên cột giữ nguyên tiếng Anh.

export const figAbsence = `flowchart TB
    q["một lần gửi bằng key phải nêu tên MỘT CÁI GÌ ĐÓ"]
    q --> n["NGƯỜI GỬI NULLABLE<br/>giữ lại sự vắng mặt"]
    q --> s["USER TỔNG HỢP<br/>nền tảng bịa ra một cái"]
    q --> b["BOT USER<br/>khách hàng khai báo một cái"]
    n --> nc["mọi bên đọc phải xử lý null<br/>— ba chương đã trả giá cho điều này<br/>toFrame bỏ hẳn row đó đi"]
    s --> sc["chương 3.10 phản đối:<br/>làm phồng cái dimension mà khách hàng<br/>đang bị đo"]
    b --> bc["một row users với kind và description<br/>mọi bên đọc từ 3.15 đã đọc users<br/>description làm nó CÓ THỂ TRẢ LỜI ĐƯỢC"]
    style nc fill:#7f1d1d,color:#fff,stroke:#dc2626
    style sc fill:#7f1d1d,color:#fff,stroke:#dc2626
    style bc fill:#064e3b,color:#fff,stroke:#059669`;

export const figBlastRadius = `flowchart TB
    subgraph counted["BA CON SỐ, ĐO TRƯỚC KHI LÀM"]
      g["grep -c 'sendMessage('<br/>100"]
      r["HTTP send site của R1<br/>46"]
      o["call site BỎ TRỐNG userId<br/>27"]
    end
    counted --> t["làm userId thành bắt buộc"]
    t --> c["trình biên dịch nêu tên 28"]
    c --> x["cái thứ 28 là messages.service.ts<br/>caller production DUY NHẤT<br/>— nó truyền string | undefined,<br/>và cái đó bị từ chối y như vậy"]
    x --> l["một con số đếm chỗ bỏ trống thuộc tính<br/>không thấy được chỗ truyền một giá trị<br/>có thể là undefined"]
    style x fill:#7f1d1d,color:#fff,stroke:#dc2626
    style l fill:#1e3a5f,color:#fff,stroke:#3b82f6`;

export const figRefusalOrder = `flowchart TB
    r["phân giải người gửi được nêu tên<br/>400, field: user"]
    r --> b["người gửi có BỊ BAN không?<br/>403 user_banned"]
    b --> v["người gửi có THẤY được channel không?<br/>404, như thể không tồn tại"]
    v --> a["channel có bị LƯU TRỮ không?<br/>403 channel_archived"]
    a --> k["credential này có được gửi VỚI DANH NGHĨA ĐÓ?<br/>403 sender_not_permitted"]
    r --- why1["bản hợp đồng đánh số cái này là THỨ TƯ.<br/>phần kiểm tra ban đọc ROW của người gửi,<br/>nên phân giải không thể đứng sau nó"]
    k --- why2["CUỐI CÙNG, vì lời từ chối này nêu một sự thật<br/>về một USER — nó không được bị kích ra cho<br/>một channel mà caller không tới được"]
    style r fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style k fill:#1e3a5f,color:#fff,stroke:#3b82f6`;

export const figTwoCounters = `flowchart LR
    ins["INSERT vào usage_active_users<br/>repository.ts ~3874"]
    cap["count(*) so với caps.active_users.hard<br/>repository.ts ~4055"]
    row["một row cho mỗi user mỗi kỳ"]
    ins --> row
    row --> cap
    ins --- m["HOÁ ĐƠN — FR-ANL-05<br/>'shall meter ... unique active users'<br/>một bot được tính"]
    cap --- e["CÁI NGƯỠNG — FR-RTL-05<br/>thu hẹp thành 'unique active persons'<br/>một bot KHÔNG được tính"]
    cap --> ref["từ chối lần gửi ĐẦU TIÊN của một kỳ.<br/>một bot chiếm chỗ cuối cùng nghĩa là<br/>một CON NGƯỜI bị từ chối, và không phải<br/>người đã gây ra chuyện đó"]
    style ref fill:#7f1d1d,color:#fff,stroke:#dc2626
    style m fill:#064e3b,color:#fff,stroke:#059669
    style e fill:#064e3b,color:#fff,stroke:#059669`;
