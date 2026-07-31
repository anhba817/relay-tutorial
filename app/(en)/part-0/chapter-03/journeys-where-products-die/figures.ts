// Chapter 0.3 figures (feature 011). The two flow figures replace the
// chapter's former text-drawn fences — stage names and ★ markers preserved
// exactly. Mermaid sources live here, never in page.mdx.

export const figMaiFlow = `flowchart LR
    d["DISCOVER"] --> e["EVALUATE"] --> s["SIGN UP"]
    s --> f["★ FIRST MESSAGE<br/>the stage that decides everything"]
    f --> b["BUILD"] --> t["TEST"] --> l["LAUNCH"] --> o["OPERATE"]`;

export const figEmotionalArc = `xychart-beta
    title "Mai's emotional arc (low → high)"
    x-axis ["DISCOVER", "EVALUATE", "SIGN UP", "FIRST MSG", "BUILD", "TEST", "LAUNCH", "OPERATE"]
    y-axis "emotion" 0 --> 10
    line [5, 2, 6, 9, 3, 6, 3, 8]`;

export const figTuanFlow = `flowchart LR
    ty["TYPE"] --> se["SEND"]
    se --> ls["★ LOSE SIGNAL<br/>the moment the platform<br/>was actually built for"]
    ls --> rc["RECONNECT"] --> co["CONFIRM"] --> mo["MOVE ON"]`;
