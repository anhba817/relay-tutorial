// Hình minh họa chương 0.5 (feature 011) — bản dịch từ figures.ts tiếng Anh.
// Ba khối trích dẫn nguyên văn của chương không bị các hình này chạm tới.

export const figAdrAnatomy = `flowchart TB
    status["STATUS<br/>accepted · giải quyết Open Question 1 của SRS"]
    drivers["DRIVERS<br/>D1, D3 — những lực được phục vụ"]
    decision["DECISION<br/>sequence theo từng channel qua row lock —<br/>chiếc khóa không phải cái giá, nó chính là cơ chế"]
    trade["TRADE-OFFS CHẤP NHẬN<br/>các lần ghi của một channel tuần tự hóa<br/>(buộc phải thế)"]
    rejected["BÁC BỎ ×3, mỗi phương án KÈM LÝ DO<br/>sequence theo tenant · Postgres sequence ·<br/>Snowflake ID"]
    reversal["ĐIỀU KIỆN ĐẢO NGƯỢC<br/>xem lại khi một channel chính đáng<br/>cần >500 msg/s"]
    status --> drivers --> decision --> trade --> rejected --> reversal`;

export const figFunnel = `flowchart TB
    srs["224 YÊU CẦU<br/>bản SRS — mỗi lời hứa một ID"]
    drivers["8 DRIVER (D1–D8)<br/>nhóm nhỏ nhào nặn cấu trúc"]
    adrs["17 ADR<br/>quyết định kèm phương án bị bác bỏ<br/>và điều kiện đảo ngược"]
    services["6 SERVICE<br/>số nhỏ nhất vẫn phô bày được<br/>ranh giới thực thụ"]
    srs -- "chưng cất" --> drivers
    drivers -- "đè lực lên mọi lựa chọn" --> adrs
    adrs -- "trở thành" --> services`;
