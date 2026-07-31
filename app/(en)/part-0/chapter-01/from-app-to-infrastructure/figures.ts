// Chapter 0.1 figures (feature 011). Mermaid sources live here, never in
// page.mdx — that invariant keeps the canonical word-count formula stable.

export const figCostCurve = `xychart-beta
    title "The two-week feature: cost of build vs buy over time"
    x-axis ["Month 1", "Month 3", "Month 6", "Year 1", "Year 2"]
    y-axis "engineering cost (relative)" 0 --> 10
    line [1, 2, 4, 5, 9]
    line [2, 2, 2, 3, 3]`;

export const figWedge = `flowchart LR
    app["Your product<br/>(the vet scheduler,<br/>the dispatch tool)"]
    relay["RELAY<br/>chat infrastructure API<br/>channels · history · delivery · read state"]
    transport["Raw transports<br/>(WebSockets, pub/sub)<br/>bytes move — no chat domain model"]
    incumbent["Heavyweight platforms<br/>capable, but too big<br/>to hold in your head"]
    app -- "embeds" --> relay
    transport -. "the gap begins above these" .- relay
    relay -. "and ends below these" .- incumbent`;

export const figNonGoals = `flowchart TB
    subgraph is ["Relay IS"]
        a["a hosted API + one JS SDK"]
        b["channels · membership · history · delivery"]
        c["webhooks + per-tenant usage analytics"]
        d["media FILES — image, audio, video<br/>(a reversed non-goal, reasons answered)"]
    end
    subgraph isnot ["Relay is NOT"]
        e["a hosted chat application"]
        f["end-to-end encryption (v1)"]
        g["an identity provider"]
        h["voice / video CALLS"]
        i["native mobile SDKs (v1)"]
        j["AI copilot features"]
    end
    is ~~~ isnot`;
