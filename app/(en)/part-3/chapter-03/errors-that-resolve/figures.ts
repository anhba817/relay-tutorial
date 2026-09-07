// Chapter 3.14 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figThirteenCodes = `flowchart TB
    reg["ERROR_CODES — the registry"]
    reg --> had["8 registered<br/>before this chapter"]
    reg --> never["5 the platform SENT<br/>and never registered"]
    never --> ladder["ProtocolErrorFilter's status ladder:<br/>invalid_request, unauthorized,<br/>forbidden, not_found, internal_error"]
    ladder --> link["every one shipped a docs_url<br/>to a page that could not exist"]
    reg --> now["13 codes"]
    now --> url["docsUrl(code)"]
    url --> frag["base + '#' + the code VERBATIM"]
    frag --> anchor["## quota_exceeded in the reference<br/>anchors at #quota_exceeded"]
    anchor --> slug["slugifyHeading keeps _<br/>so no transform lives in two repositories"]
    style link fill:#7f1d1d,color:#fff,stroke:#dc2626
    style now fill:#064e3b,color:#fff,stroke:#059669`;

export const figFourTypeGates = `flowchart LR
    typo["a typo in a code:<br/>wrong_credental_type"]
    typo --> g1["ProtocolErrorFilter's ladder<br/>typed ErrorCode"]
    typo --> g2["protocolError(code, …)<br/>a new helper"]
    typo --> g3["sendError(socket, code, …)<br/>narrowed from string"]
    typo --> g4["docsUrl(code)<br/>the two sites that write<br/>the envelope directly"]
    g1 --> stop["stops compiling"]
    g2 --> stop
    g3 --> stop
    g4 --> stop
    before["BEFORE: HttpException's response is unknown,<br/>so eight sites named their code by hand"]
    before --> ship["compiled, shipped,<br/>became a URL"]
    style stop fill:#064e3b,color:#fff,stroke:#059669
    style ship fill:#7f1d1d,color:#fff,stroke:#dc2626`;
