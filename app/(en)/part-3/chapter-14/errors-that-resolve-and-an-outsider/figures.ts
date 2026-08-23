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

export const figThreeLevels = `flowchart TB
    want["packages/outsider wants<br/>ERROR_CODES"]
    want --> l1["LEVEL 1 — not a rule at all.<br/>No @relay/* dependency, and pnpm's isolated<br/>node_modules has no @relay at the root"]
    l1 --> r1["Cannot find package '@relay/protocol'"]
    want --> l2["LEVEL 2 — no-restricted-imports.<br/>../../protocol/src/codes.js"]
    l2 --> r2["may not reach outside itself"]
    want --> l3["LEVEL 3 — no-restricted-syntax.<br/>join(dirname, '..', …) and createRequire"]
    l3 --> r3["may not build a path out of the package"]
    l3 --> why["an import rule cannot see a path<br/>built from strings — packages/e2e<br/>builds one and spawns from it"]
    want --> l4["NOT CLOSED BY ANY OF THEM:<br/>reading the source with human eyes"]
    l4 --> disc["a discipline, not a mechanism.<br/>Three rules must not imply a fourth."]
    style r1 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style r2 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style r3 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style disc fill:#78350f,color:#fff,stroke:#d97706`;

export const figVerdict = `flowchart TB
    crit["SRS Phase 2 exit criterion:<br/>an external developer integrates using<br/>only public documentation, with no assistance"]
    crit --> met["MET — measured"]
    crit --> not["NOT MET — two things, different in kind"]
    met --> m1["8 tests, a full integration<br/>against a stack it does not start"]
    met --> m2["sealed three ways, each demonstrated"]
    met --> m3["its own CI job, on every build"]
    not --> n1["the suite was CORRECTED by a failing test<br/>about the REST-to-socket path —<br/>which is the assistance the criterion forbids"]
    not --> n2["content sufficiency is not comprehensibility.<br/>A person is the only instrument,<br/>and this chapter does not use one."]
    style met fill:#064e3b,color:#fff,stroke:#059669
    style n1 fill:#7f1d1d,color:#fff,stroke:#dc2626
    style n2 fill:#78350f,color:#fff,stroke:#d97706`;
