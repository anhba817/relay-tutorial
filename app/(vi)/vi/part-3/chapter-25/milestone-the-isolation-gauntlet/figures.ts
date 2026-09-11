// Figures của chương 3.12. Mermaid source nằm ở đây, không bao giờ trong page.mdx.
// Nhãn tường thuật thì dịch; tên requirement, driver, ADR, bảng và cột giữ nguyên
// tiếng Anh — figures không phải fence nên mirror check không với tới, và đó
// chính là điều cho phép luật này hoạt động.

export const figWhatMaskedWhat = `flowchart TB
    attack["GET /v1/channels/:id/messages<br/>với channel id của tenant khác"]
    attack --> exists["channelExists(id)<br/>ĐÃ SCOPE — từ chối ngay đây"]
    exists --> four["404, y hệt một id không tồn tại"]
    exists -. không bao giờ tới .-> list["listMessages(id)<br/>scope BỊ BỎ để thí nghiệm"]
    list --> leak["lẽ ra đã trả về<br/>các row của tenant khác"]
    four --> green["bộ test vẫn XANH.<br/>21 trên 21."]
    green --> lesson["nhạy với lớp kiểm tra NGOÀI CÙNG;<br/>mù với lớp bên trong bị lớp ngoài còn sống che đi"]
    style green fill:#78350f,color:#fff,stroke:#d97706
    style lesson fill:#1e3a8a,color:#fff,stroke:#3b82f6
    style leak fill:#7f1d1d,color:#fff,stroke:#dc2626`;
