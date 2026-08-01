// Hình minh họa chương 2.1 (feature 018). Mã mermaid sống ở đây, không bao
// giờ nằm trong page.mdx. Tên bảng, tên cột, tên lệnh giữ nguyên tiếng Anh.

export const figTenantSpine = `flowchart TB
    apps["applications<br/>(mỏ neo tenancy — bản stub, Phần 3 sở hữu)"]
    envs["environments<br/>CHÍNH LÀ tenant"]
    users["users<br/>environment_id NOT NULL"]
    channels["channels<br/>environment_id NOT NULL"]
    messages["messages<br/>tenant qua channel_id (một bước nhảy)"]
    members["members<br/>tenant qua channel_id (một bước nhảy)"]
    apps --> envs
    envs --> users
    envs --> channels
    channels --> messages
    channels --> members
    users -.-> members
    note["Constitution I: mọi bản ghi đều mang tenant của nó,<br/>trực tiếp hoặc qua đúng một bước foreign key —<br/>chiếc xương sống chạy xuyên mọi bảng"]
    envs ~~~ note`;

export const figTwoDoors = `flowchart TB
    dbcyl[("một PostgreSQL<br/>chứa hàng của mọi tenant")]
    repoA["new Repository(pool, envA)<br/>mọi truy vấn: WHERE environment_id = A"]
    repoB["new Repository(pool, envB)<br/>mọi truy vấn: WHERE environment_id = B"]
    codeA["request của tenant A"]
    codeB["request của tenant B"]
    codeA --> repoA --> dbcyl
    codeB --> repoB --> dbcyl
    note["Mệnh đề WHERE sống bên trong cánh cửa, một lần duy nhất —<br/>đưa cửa B một id thật của tenant A<br/>và nó mở ra khoảng không"]
    dbcyl ~~~ note`;

export const figTwoLanes = `flowchart LR
    subgraph unit["làn unit — nguyên vẹn từ 1.1, không Docker"]
      u1["pnpm lint"]
      u2["pnpm typecheck"]
      u3["pnpm test<br/>(chỉ *.test.ts)"]
      u1 --> u2 --> u3
    end
    subgraph integration["làn integration — Postgres của compose"]
      i1["docker compose up -d --wait postgres"]
      i2["pnpm --filter @relay/api migrate"]
      i3["pnpm --filter @relay/api test:integration<br/>(chỉ *.itest.ts)"]
      i1 --> i2 --> i3
    end
    unit --> tag["tag part2-ch1"]
    integration --> tag`;
