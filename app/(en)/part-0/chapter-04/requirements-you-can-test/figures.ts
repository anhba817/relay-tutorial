// Chapter 0.4 figures (feature 011). Mermaid sources live here, never in
// page.mdx. The three specimen fences in the chapter are verbatim quotes and
// are untouched by these figures.

export const figAnatomy = `flowchart TB
    req["FR-MSG-04 · The system shall accept a client-supplied<br/>idempotency key on send…<br/>Priority: P1 · Verification: T"]
    id["ID — a permanent address<br/>family-prefixed, never reused"]
    shall["SHALL — an obligation<br/>concrete object, measurable outcome"]
    pri["PRIORITY — a phase<br/>P1: the core loop"]
    ver["VERIFICATION — how would we know?<br/>T: a script can fail it"]
    id --> req
    shall --> req
    pri --> req
    ver --> req`;

export const figTraceChain = `flowchart LR
    p["PERSONA<br/>Tuan (chapter 0.2)"]
    j["JOURNEY ★<br/>lose signal in the tunnel<br/>(chapter 0.3)"]
    r["REQUIREMENT<br/>FR-MSG-04 · P1 · T<br/>(this chapter)"]
    t["THE TEST THAT CAN FAIL IT<br/>send the same key twice,<br/>count the messages (Part 2)"]
    p --> j --> r --> t`;
