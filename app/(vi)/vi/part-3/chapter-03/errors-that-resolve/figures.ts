// Figures của chương 3.14. Mermaid source nằm ở đây, không bao giờ trong page.mdx.
// Nhãn tường thuật thì dịch; identifier và tên code giữ nguyên tiếng Anh.

export const figThirteenCodes = `flowchart TB
    reg["ERROR_CODES — cái registry"]
    reg --> had["8 cái đã đăng ký<br/>trước chương này"]
    reg --> never["5 cái platform ĐÃ GỬI<br/>mà chưa bao giờ đăng ký"]
    never --> ladder["thang status của ProtocolErrorFilter:<br/>invalid_request, unauthorized,<br/>forbidden, not_found, internal_error"]
    ladder --> link["mỗi cái đều gửi một docs_url<br/>trỏ tới một trang không thể tồn tại"]
    reg --> now["13 code"]
    now --> url["docsUrl(code)"]
    url --> frag["base + '#' + code NGUYÊN VĂN"]
    frag --> anchor["## quota_exceeded trong tài liệu<br/>neo tại #quota_exceeded"]
    anchor --> slug["slugifyHeading giữ lại _<br/>nên không phép biến đổi nào sống ở hai repository"]
    style link fill:#7f1d1d,color:#fff,stroke:#dc2626
    style now fill:#064e3b,color:#fff,stroke:#059669`;

export const figFourTypeGates = `flowchart LR
    typo["một lỗi chính tả trong code:<br/>wrong_credental_type"]
    typo --> g1["thang của ProtocolErrorFilter<br/>đã gắn type ErrorCode"]
    typo --> g2["protocolError(code, …)<br/>một helper mới"]
    typo --> g3["sendError(socket, code, …)<br/>thu hẹp từ string"]
    typo --> g4["docsUrl(code)<br/>hai chỗ ghi envelope<br/>trực tiếp ra response"]
    g1 --> stop["không compile được"]
    g2 --> stop
    g3 --> stop
    g4 --> stop
    before["TRƯỚC: response của HttpException là unknown,<br/>nên tám chỗ tự gõ code bằng tay"]
    before --> ship["compile được, ship được,<br/>rồi thành một URL"]
    style stop fill:#064e3b,color:#fff,stroke:#059669
    style ship fill:#7f1d1d,color:#fff,stroke:#dc2626`;
