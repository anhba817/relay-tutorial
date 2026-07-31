// Hình minh họa chương 0.2 (feature 011) — bản dịch từ figures.ts tiếng Anh.

export const figQuartet = `flowchart TB
    mai["MAI — kỹ sư tích hợp<br/>CHÍNH YẾU: người duy nhất<br/>có thể chọn dùng chúng ta"]
    david["DAVID — giám đốc kỹ thuật<br/>NGƯỜI MUA: không bao giờ đọc SDK,<br/>vẫn nắm quyền phủ quyết"]
    relay["RELAY<br/>API hạ tầng chat"]
    priya["PRIYA — trưởng nhóm CSKH<br/>NGƯỜI VẬN HÀNH: dùng hằng ngày,<br/>qua công cụ Mai xây"]
    tuan["TUAN — tài xế giao hàng<br/>RÀNG BUỘC: không bao giờ nghe tên chúng ta,<br/>hứng trọn mọi cú trễ"]
    mai -- "chọn dùng" --> relay
    david -- "phê duyệt" --> relay
    priya -- "vận hành trên" --> relay
    relay -- "chuyển tin đến" --> tuan`;

export const figPulls = `flowchart LR
    t["Tuan:<br/>đừng bao giờ làm mất tin nhắn của tôi"]
    m["Mai:<br/>cho tôi ship ngay trong quý này"]
    d["David:<br/>chi phí tôi dự đoán được"]
    p["Priya:<br/>lịch sử đầy đủ, đúng thứ tự"]
    order["THỨ TỰ PHÂN XỬ ĐƯỢC GHI THÀNH VĂN<br/>Độ tin cậy của Tuan thắng tất cả<br/>Tốc độ tích hợp của Mai thắng độ rộng tính năng<br/>Tính dự đoán được của David thắng sự tiện lợi<br/>Sự đầy đủ của Priya thắng chi phí lưu trữ"]
    t --> order
    m --> order
    d --> order
    p --> order`;
