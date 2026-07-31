// Hình minh họa chương 0.4 (feature 011) — bản dịch từ figures.ts tiếng Anh.
// Ba khối trích dẫn nguyên văn của chương không bị các hình này chạm tới.

export const figAnatomy = `flowchart TB
    req["FR-MSG-04 · Hệ thống phải chấp nhận một idempotency key<br/>do client cung cấp khi gửi…<br/>Priority: P1 · Verification: T"]
    id["ID — một địa chỉ vĩnh viễn<br/>tiền tố theo họ, không bao giờ tái sử dụng"]
    shall["SHALL — một nghĩa vụ<br/>đối tượng cụ thể, kết quả đo được"]
    pri["PRIORITY — một phase<br/>P1: vòng lặp cốt lõi"]
    ver["VERIFICATION — làm sao chúng ta biết?<br/>T: một script có thể đánh trượt nó"]
    id --> req
    shall --> req
    pri --> req
    ver --> req`;

export const figTraceChain = `flowchart LR
    p["CHÂN DUNG<br/>Tuan (chương 0.2)"]
    j["HÀNH TRÌNH ★<br/>mất sóng trong đường hầm<br/>(chương 0.3)"]
    r["YÊU CẦU<br/>FR-MSG-04 · P1 · T<br/>(chương này)"]
    t["PHÉP THỬ CÓ THỂ ĐÁNH TRƯỢT NÓ<br/>gửi cùng một key hai lần,<br/>đếm số tin nhắn (Phần 2)"]
    p --> j --> r --> t`;
