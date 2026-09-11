// Figures của chương 3.14. Mermaid source nằm ở đây, không bao giờ trong page.mdx.
// Nhãn tường thuật thì dịch; identifier và tên code giữ nguyên tiếng Anh.

export const figThreeLevels = `flowchart TB
    want["packages/outsider muốn<br/>ERROR_CODES"]
    want --> l1["CẤP 1 — không phải rule nào cả.<br/>Không có dependency @relay/*, và node_modules<br/>cô lập của pnpm không có @relay ở gốc"]
    l1 --> r1["Cannot find package '@relay/protocol'"]
    want --> l2["CẤP 2 — no-restricted-imports.<br/>../../protocol/src/codes.js"]
    l2 --> r2["không được với ra ngoài chính nó"]
    want --> l3["CẤP 3 — no-restricted-syntax.<br/>join(dirname, '..', …) và createRequire"]
    l3 --> r3["không được dựng một path ra khỏi package"]
    l3 --> why["một rule về import không thấy được path<br/>dựng từ chuỗi — packages/e2e<br/>dựng một cái và spawn từ đó"]
    want --> l4["KHÔNG CẤP NÀO CHẶN ĐƯỢC:<br/>đọc source bằng mắt người"]
    l4 --> disc["một kỷ luật, không phải một cơ chế.<br/>Ba rule không được ngụ ý cái thứ tư."]
    style r1 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style r2 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style r3 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style disc fill:#78350f,color:#fff,stroke:#d97706`;

export const figVerdict = `flowchart TB
    crit["Tiêu chí ra khỏi Phase 2 của SRS:<br/>một developer bên ngoài tích hợp<br/>chỉ bằng tài liệu công khai, không ai trợ giúp"]
    crit --> met["ĐẠT — đã đo"]
    crit --> not["KHÔNG ĐẠT — hai thứ, khác loại nhau"]
    met --> m1["8 test, một lượt tích hợp đầy đủ<br/>vào một stack mà nó không tự khởi động"]
    met --> m2["niêm phong ba lớp, mỗi lớp đều được chứng minh"]
    met --> m3["một CI job riêng, trên mọi build"]
    not --> n1["bộ test được một test fail SỬA LẠI<br/>về đường REST-tới-socket —<br/>đó đúng là sự trợ giúp mà tiêu chí cấm"]
    not --> n2["đủ nội dung không phải là dễ hiểu.<br/>Chỉ con người là thiết bị đo được điều đó,<br/>và chương này không dùng một người nào."]
    style met fill:#064e3b,color:#fff,stroke:#059669
    style n1 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style n2 fill:#78350f,color:#fff,stroke:#d97706`;
