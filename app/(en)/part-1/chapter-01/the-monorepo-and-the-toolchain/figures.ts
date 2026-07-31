// Chapter 1.1 figures (feature 013). Mermaid sources live here, never in
// page.mdx.

export const figWorkspaceMap = `flowchart TB
    root["relay-platform/<br/>package.json · pnpm-workspace.yaml<br/>tsconfig.base.json · eslint.config.mjs · vitest.config.ts"]
    pkgs["packages/"]
    svcs["services/<br/>(empty until 1.4)"]
    config["@relay/config<br/>shared constants + the smoke test<br/>(today)"]
    protocol["@relay/protocol<br/>frame types, error codes<br/>(chapter 1.3)"]
    api["api · gateway · workers…<br/>(chapters 1.4 →)"]
    root --> pkgs
    root --> svcs
    pkgs --> config
    pkgs -.-> protocol
    svcs -.-> api`;

export const figProtocolPayoff = `flowchart TB
    proto["@relay/protocol<br/>frame types · cursor semantics ·<br/>idempotency-key logic (one package)"]
    gw["Gateway service"]
    apisvc["API service"]
    sdk["The JS SDK<br/>(browsers · Node · React Native)"]
    proto --> gw
    proto --> apisvc
    proto --> sdk
    note["A frame type change is ONE commit —<br/>drift becomes a compile error,<br/>not a production incident"]
    proto ~~~ note`;

export const figToolchainGate = `flowchart LR
    code["the chapter's code"]
    lint["pnpm lint<br/>one ESLint config"]
    types["pnpm typecheck<br/>one strict tsconfig"]
    test["pnpm test<br/>one runner (Vitest)"]
    tag["the chapter tag<br/>part1-ch1 · part1-ch2 · …"]
    code --> lint --> types --> test --> tag`;
