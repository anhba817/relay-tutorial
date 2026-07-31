// Chapter 0.5 figures (feature 011). Mermaid sources live here, never in
// page.mdx. The three specimen fences in the chapter are verbatim quotes and
// are untouched by these figures.

export const figAdrAnatomy = `flowchart TB
    status["STATUS<br/>accepted · resolves SRS Open Question 1"]
    drivers["DRIVERS<br/>D1, D3 — the forces served"]
    decision["DECISION<br/>per-channel sequence via row lock —<br/>the lock is not a cost, it is the mechanism"]
    trade["TRADE-OFFS ACCEPTED<br/>a channel's writes serialise (they must)"]
    rejected["REJECTED ×3, each WITH ITS REASON<br/>per-tenant sequence · Postgres sequences ·<br/>Snowflake IDs"]
    reversal["REVERSAL CONDITION<br/>revisit when a channel legitimately<br/>needs >500 msg/s"]
    status --> drivers --> decision --> trade --> rejected --> reversal`;

export const figFunnel = `flowchart TB
    srs["224 REQUIREMENTS<br/>the SRS — every promise with an ID"]
    drivers["8 DRIVERS (D1–D8)<br/>the handful that shape structure"]
    adrs["14 ADRs<br/>decisions with rejected alternatives<br/>and reversal conditions"]
    services["6 SERVICES<br/>the smallest number that still<br/>demonstrates real boundaries"]
    srs -- "distillation" --> drivers
    drivers -- "press on every choice" --> adrs
    adrs -- "become" --> services`;
