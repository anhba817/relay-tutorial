// Figures của chương 3.12. Mermaid source nằm ở đây, không bao giờ trong page.mdx.
// Nhãn tường thuật thì dịch; tên requirement, driver, ADR, bảng và cột giữ nguyên
// tiếng Anh — figures không phải fence nên mirror check không với tới, và đó
// chính là điều cho phép luật này hoạt động.

export const figDerivedTargets = `flowchart LR
    app["Nest application<br/>instance"] --> adapter["httpAdapter<br/>.getInstance()"]
    adapter --> router["router.stack<br/>(hoặc _router, hoặc none)"]
    router --> layers["các layer"]
    layers --> mw["middleware<br/>không có route"]
    layers --> routes["24 route<br/>method + path"]
    routes --> cls["CLASSIFICATIONS"]
    cls --> read["read 2"]
    cls --> list["list 1"]
    cls --> write["write 17"]
    cls --> cred["credential 1"]
    cls --> exempt["exempt 3<br/>mỗi cái một lý do"]
    routes --> un["không khớp cái nào"]
    un --> fail["build fail,<br/>và gọi tên route đó"]
    style fail fill:#7f1d1d,color:#fff,stroke:#dc2626
    style routes fill:#1e3a8a,color:#fff,stroke:#3b82f6`;

export const figWhoMayCall = `flowchart TB
    subgraph user["end-user token"]
      ut["mang MỘT environment<br/>và một subject"]
      ut --> uattack["tấn công: token cấp ở A<br/>nhắm vào resource ở B"]
      uattack --> upair["so lời từ chối với<br/>một resource không tồn tại ở đâu cả"]
    end
    subgraph platform["platform credential"]
      pc["KHÔNG mang environment nào.<br/>Dispatcher phục vụ mọi tenant."]
      pc --> pclass["chương 3.2: LOẠI nào được gọi?"]
      pclass --> pserv["chương 3.12: SERVICE nào được gọi?"]
      pserv --> refuse["wrong_credential_service"]
      pc --> pattack["tấn công: gọi tên environment A,<br/>mang identifier của B"]
      pattack --> only2["chỉ 2 trong 5 route<br/>diễn đạt được điều đó"]
    end
    style refuse fill:#7f1d1d,color:#fff,stroke:#dc2626
    style only2 fill:#78350f,color:#fff,stroke:#d97706`;

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
