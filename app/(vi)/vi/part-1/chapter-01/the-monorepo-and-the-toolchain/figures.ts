// Hình minh họa chương 1.1 (feature 013) — bản dịch từ figures.ts tiếng Anh.
// Tên gói, tên lệnh, tên tag giữ nguyên tiếng Anh.

export const figWorkspaceMap = `flowchart TB
    root["relay-platform/<br/>package.json · pnpm-workspace.yaml<br/>tsconfig.base.json · eslint.config.mjs · vitest.config.ts"]
    pkgs["packages/"]
    svcs["services/<br/>(trống cho đến chương 1.4)"]
    config["@relay/config<br/>hằng số dùng chung + bài smoke test<br/>(hôm nay)"]
    protocol["@relay/protocol<br/>kiểu frame, mã lỗi<br/>(chương 1.3)"]
    api["api · gateway · worker…<br/>(từ chương 1.4 trở đi)"]
    root --> pkgs
    root --> svcs
    pkgs --> config
    pkgs -.-> protocol
    svcs -.-> api`;

export const figProtocolPayoff = `flowchart TB
    proto["@relay/protocol<br/>kiểu frame · ngữ nghĩa cursor ·<br/>logic idempotency key (một gói duy nhất)"]
    gw["Gateway service"]
    apisvc["API service"]
    sdk["SDK JavaScript<br/>(trình duyệt · Node · React Native)"]
    proto --> gw
    proto --> apisvc
    proto --> sdk
    note["Đổi một kiểu frame chỉ tốn MỘT commit —<br/>sai lệch trở thành lỗi biên dịch,<br/>không phải sự cố ngoài production"]
    proto ~~~ note`;

export const figToolchainGate = `flowchart LR
    code["code của chương"]
    lint["pnpm lint<br/>một cấu hình ESLint"]
    types["pnpm typecheck<br/>một tsconfig nghiêm ngặt"]
    test["pnpm test<br/>một trình chạy test (Vitest)"]
    tag["tag của chương<br/>part1-ch1 · part1-ch2 · …"]
    code --> lint --> types --> test --> tag`;
