// Hình minh họa chương 1.3 (feature 016). Mã mermaid sống ở đây, không bao
// giờ nằm trong page.mdx. Tên frame, tên mã, tên lệnh giữ nguyên tiếng Anh.

export const figFrameMap = `flowchart LR
    client["Client<br/>(SDK, về sau)"]
    server["Server<br/>(gateway, 1.4 →)"]
    client -- "message.send" --> server
    server -- "connection.ack · message.ack" --> client
    server -- "message.created · message.updated · message.deleted" --> client
    server -- "membership.changed · presence.changed · typing" --> client
    server -- "error {code, message, docs_url}" --> client
    codes["close code<br/>4001 auth · 4002 protocol ·<br/>4008 quota · 4009 shutdown"]
    server -.-> codes`;

export const figOneSource = `flowchart TB
    schema["MỘT schema zod<br/>messageSendSchema"]
    runtime["kiểm tra lúc chạy<br/>parseFrame(raw) →<br/>nhận hoặc từ chối, không bao giờ throw"]
    types["kiểu tĩnh<br/>type MessageSend = z.infer&lt;…&gt;<br/>(không có bản chép tay)"]
    schema --> runtime
    schema --> types
    note["Kiểu tĩnh bốc hơi khi chạy.<br/>Schema là kiểu sống sót qua runtime —<br/>và hai bên không thể lệch nhau:<br/>làm gì có định nghĩa thứ hai."]
    schema ~~~ note`;

export const figPayoffRevisited = `flowchart TB
    proto["@relay/protocol ✓ ĐÃ XÂY<br/>schema frame · kiểu suy ra ·<br/>mã lỗi + close code (chương này)"]
    gw["Gateway service<br/>(1.4 →)"]
    apisvc["API service<br/>(1.4 →)"]
    sdk["JS SDK<br/>(một phần sau)"]
    proto -.-> gw
    proto -.-> apisvc
    proto -.-> sdk
    note["1.1 hứa, 1.3 trả:<br/>đổi một frame chỉ tốn MỘT commit —<br/>sai lệch là lỗi biên dịch,<br/>không phải sự cố ngoài production"]
    proto ~~~ note`;
