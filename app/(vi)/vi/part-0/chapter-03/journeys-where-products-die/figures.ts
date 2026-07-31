// Hình minh họa chương 0.3 (feature 011). Hai hình dòng chảy thay thế các khối
// vẽ-bằng-chữ trước đây của chương — tên chặng và dấu ★ giữ nguyên đúng như
// bản dịch đã duyệt (quy ước feature 006).

export const figMaiFlow = `flowchart LR
    d["KHÁM PHÁ"] --> e["ĐÁNH GIÁ"] --> s["ĐĂNG KÝ"]
    s --> f["★ TIN NHẮN ĐẦU TIÊN<br/>chặng quyết định tất cả"]
    f --> b["XÂY DỰNG"] --> t["KIỂM THỬ"] --> l["RA MẮT"] --> o["VẬN HÀNH"]`;

export const figEmotionalArc = `xychart-beta
    title "Cung bậc cảm xúc của Mai (thấp → cao)"
    x-axis ["KHÁM PHÁ", "ĐÁNH GIÁ", "ĐĂNG KÝ", "TIN NHẮN ĐẦU", "XÂY DỰNG", "KIỂM THỬ", "RA MẮT", "VẬN HÀNH"]
    y-axis "cảm xúc" 0 --> 10
    line [5, 2, 6, 9, 3, 6, 3, 8]`;

export const figTuanFlow = `flowchart LR
    ty["GÕ"] --> se["GỬI"]
    se --> ls["★ MẤT SÓNG<br/>khoảnh khắc mà nền tảng này<br/>thực sự được sinh ra để phục vụ"]
    ls --> rc["KẾT NỐI LẠI"] --> co["XÁC NHẬN"] --> mo["ĐI TIẾP"]`;
