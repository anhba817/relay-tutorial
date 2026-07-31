// Hình minh họa chương 0.1 (feature 011) — bản dịch từ figures.ts tiếng Anh.
// Mã nguồn mermaid sống ở đây, không bao giờ nằm trong page.mdx.

export const figCostCurve = `xychart-beta
    title "Tính năng 'hai tuần': chi phí tự xây so với mua, theo thời gian"
    x-axis ["Tháng 1", "Tháng 3", "Tháng 6", "Năm 1", "Năm 2"]
    y-axis "chi phí kỹ thuật (tương đối)" 0 --> 10
    line [1, 2, 4, 5, 9]
    line [2, 2, 2, 3, 3]`;

export const figWedge = `flowchart LR
    app["Sản phẩm của bạn<br/>(phần mềm đặt lịch thú y,<br/>công cụ điều phối)"]
    relay["RELAY<br/>API hạ tầng chat<br/>channel · lịch sử · gửi nhận · trạng thái đọc"]
    transport["Transport thô<br/>(WebSocket, pub/sub)<br/>byte di chuyển — không có mô hình chat"]
    incumbent["Nền tảng đồ sộ<br/>đủ mạnh, nhưng quá lớn<br/>để nắm trọn trong đầu"]
    app -- "nhúng vào" --> relay
    transport -. "khoảng trống bắt đầu phía trên đây" .- relay
    relay -. "và kết thúc phía dưới đây" .- incumbent`;

export const figNonGoals = `flowchart TB
    subgraph is ["Relay LÀ"]
        a["một API hosted + một SDK JavaScript"]
        b["channel · thành viên · lịch sử · gửi nhận"]
        c["webhook + phân tích sử dụng theo tenant"]
        d["FILE media — ảnh, âm thanh, video<br/>(non-goal đã đảo ngược, mọi lý do được hồi đáp)"]
    end
    subgraph isnot ["Relay KHÔNG PHẢI"]
        e["một ứng dụng chat hoàn chỉnh"]
        f["mã hóa đầu-cuối (v1)"]
        g["một nhà cung cấp danh tính"]
        h["CUỘC GỌI thoại / video"]
        i["SDK mobile native (v1)"]
        j["tính năng AI copilot"]
    end
    is ~~~ isnot`;
