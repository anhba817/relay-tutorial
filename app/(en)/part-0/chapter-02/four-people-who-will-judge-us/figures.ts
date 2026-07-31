// Chapter 0.2 figures (feature 011). Mermaid sources live here, never in
// page.mdx.

export const figQuartet = `flowchart TB
    mai["MAI — integrating developer<br/>PRIMARY: the only person<br/>who can adopt us"]
    david["DAVID — engineering director<br/>BUYER: never reads the SDK,<br/>can still veto it"]
    relay["RELAY<br/>chat infrastructure API"]
    priya["PRIYA — support lead<br/>OPERATOR: uses it daily,<br/>through a tool Mai builds"]
    tuan["TUAN — delivery driver<br/>CONSTRAINT: never hears our name,<br/>feels every latency spike"]
    mai -- "adopts" --> relay
    david -- "approves" --> relay
    priya -- "operates on" --> relay
    relay -- "delivers to" --> tuan`;

export const figPulls = `flowchart LR
    t["Tuan:<br/>never lose my message"]
    m["Mai:<br/>let me ship this quarter"]
    d["David:<br/>costs I can predict"]
    p["Priya:<br/>complete, ordered history"]
    order["THE RECORDED RESOLUTION ORDER<br/>Tuan's reliability beats everything<br/>Mai's speed beats feature breadth<br/>David's predictability beats convenience<br/>Priya's completeness beats storage"]
    t --> order
    m --> order
    d --> order
    p --> order`;
