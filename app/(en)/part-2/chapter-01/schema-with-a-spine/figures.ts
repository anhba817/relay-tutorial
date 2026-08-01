// Chapter 2.1 figures (feature 018). Mermaid sources live here, never in
// page.mdx. Table names come from the chapter's schema slice only.

export const figTenantSpine = `flowchart TB
    apps["applications<br/>(tenancy anchor — stub, Part 3 owns it)"]
    envs["environments<br/>THE tenant"]
    users["users<br/>environment_id NOT NULL"]
    channels["channels<br/>environment_id NOT NULL"]
    messages["messages<br/>tenant via channel_id (one hop)"]
    members["members<br/>tenant via channel_id (one hop)"]
    apps --> envs
    envs --> users
    envs --> channels
    channels --> messages
    channels --> members
    users -.-> members
    note["Constitution I: every record carries its tenant,<br/>directly or through a single foreign-key hop —<br/>the spine runs through every table"]
    envs ~~~ note`;

export const figTwoDoors = `flowchart TB
    dbcyl[("one PostgreSQL<br/>rows from every tenant")]
    repoA["new Repository(pool, envA)<br/>every query: WHERE environment_id = A"]
    repoB["new Repository(pool, envB)<br/>every query: WHERE environment_id = B"]
    codeA["tenant A's requests"]
    codeB["tenant B's requests"]
    codeA --> repoA --> dbcyl
    codeB --> repoB --> dbcyl
    note["The WHERE lives inside the door, once —<br/>hand door B a real id from tenant A<br/>and it opens onto nothing"]
    dbcyl ~~~ note`;

export const figTwoLanes = `flowchart LR
    subgraph unit["unit lane — unchanged since 1.1, no Docker"]
      u1["pnpm lint"]
      u2["pnpm typecheck"]
      u3["pnpm test<br/>(*.test.ts only)"]
      u1 --> u2 --> u3
    end
    subgraph integration["integration lane — compose Postgres"]
      i1["docker compose up -d --wait postgres"]
      i2["pnpm --filter @relay/api migrate"]
      i3["pnpm --filter @relay/api test:integration<br/>(*.itest.ts only)"]
      i1 --> i2 --> i3
    end
    unit --> tag["tag part2-ch1"]
    integration --> tag`;
