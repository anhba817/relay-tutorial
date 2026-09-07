// Figures của chương 3.16. Mermaid source sống ở đây, không bao giờ nằm trong page.mdx.
// Tên lấy từ tài liệu, schema và code — không đặt tên mới.

export const figWrongWay = `flowchart TB
    q["ORDER BY max(messages.created_at)<br/>— không cần cột mới nào"]
    q --> lane["TEST LANE<br/>579 tin nhắn, 32 channel<br/>0.87 ms"]
    lane --> settle["'đủ nhanh rồi. ship thôi.'"]
    q --> real["MỘT TRIỆU TIN NHẮN<br/>159 ms<br/>Seq Scan qua mọi tin nhắn<br/>trong environment, mỗi lần liệt kê"]
    real --> col["channels.last_activity_at có index<br/>1.1 ms"]
    col --> ratio["cách nhau 145 lần, và khoảng cách còn giãn ra<br/>theo đúng con số mà một nền tảng chat<br/>chắc chắn sẽ tăng"]
    style settle fill:#7f1d1d,color:#fff,stroke:#dc2626
    style ratio fill:#064e3b,color:#fff,stroke:#059669`;

export const figUnread = `flowchart LR
    subgraph have["THỨ ĐƯỜNG GHI VẪN ĐANG DUY TRÌ"]
      seq["channels.last_sequence<br/>thẩm quyền về sequence từ chương 2.2"]
    end
    subgraph new["MỘT TABLE MỚI, MỘT CỘT"]
      pos["read_positions.sequence<br/>chỉ tiến, theo từng (channel, user)"]
    end
    seq --> sub["greatest(last_sequence - coalesce(position, 0), 0)"]
    pos --> sub
    sub --> out["số tin chưa đọc"]
    none["KHÔNG CÓ DÒNG = VỊ TRÍ 0<br/>số chưa đọc của member mới là toàn bộ lịch sử,<br/>và của member được thêm lại cũng vậy"]
    none --> sub
    clamp["greatest(..., 0) là phòng vệ trước một bug:<br/>vị trí vượt quá cuối bị từ chối ngay khi ghi,<br/>và last_sequence không bao giờ đi ngược"]
    clamp --> sub
    counter["MỘT COUNTER CACHE đo được 1.2-2.1 ms<br/>so với 1.1-4.5 ms của phép trừ này<br/>— không nhanh hơn, mà lại có thể lệch"]
    style out fill:#064e3b,color:#fff,stroke:#059669
    style counter fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figKeyset = `flowchart TB
    first["TRANG ĐẦU, user ở trong 20.000 channel<br/>10.62 ms — top-N heapsort trên 20.000 dòng"]
    first --> deep["TRANG SÂU, cursor gần cuối<br/>0.03 ms — keyset đã cắt tập dữ liệu xuống"]
    deep --> rev["TRANG ĐẦU LÀ TRANG ĐẮT NHẤT,<br/>ngược hẳn với phân trang bằng OFFSET"]
    flip["Ở 50.000 PLANNER ĐỔI KẾ HOẠCH<br/>đi tuần tự có thứ tự trên channels_environment_last_activity<br/>kèm một lần dò membership — không còn Sort — và<br/>NHANH HƠN cả mốc 20.000"]
    first --> flip
    tie["id NẰM TRONG KEY vì last_activity_at không unique:<br/>chỉ dùng '&lt;' trên timestamp sẽ bỏ sót dòng thứ hai bị trùng,<br/>còn '&lt;=' thì trả lại dòng đầu mãi mãi"]
    style rev fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style flip fill:#064e3b,color:#fff,stroke:#059669`;

export const figDeletion = `flowchart TB
    del["DELETE /v1/users/:externalId"]
    del --> gone["MẤT: display_name, avatar_url, metadata,<br/>mọi membership, mọi read position"]
    del --> stays["CÒN: dòng user, mọi tin nhắn,<br/>mọi dòng usage_active_users"]
    stays --> why["messages.user_id vẫn trỏ tới một dòng thật"]
    why --> frame["nên toFrame vẫn dựng được message.created,<br/>và client đang resume vẫn nhận được"]
    setnull["ON DELETE SET NULL thoả mãn<br/>câu 'tin nhắn được giữ lại'"]
    setnull --> drop["toFrame LOẠI BỎ một dòng không có người gửi —<br/>messageSchema.user là z.string().min(1)"]
    drop --> silent["mọi tin nhắn người đó từng gửi biến mất<br/>khỏi mọi client kết nối lại, dấu vết duy nhất<br/>là một khoảng trống trong sequence"]
    style frame fill:#064e3b,color:#fff,stroke:#059669
    style silent fill:#7f1d1d,color:#fff,stroke:#dc2626`;
