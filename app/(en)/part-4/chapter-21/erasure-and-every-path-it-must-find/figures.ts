// Chapter 4.21 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/067-chapter-4-21/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green. `check:figures`
// is the gate that catches it and `pnpm build` is not.

export const figSevenStores = `flowchart TB
    u["one end user"]
    u --> o["OPERATIONAL — Postgres"]
    u --> a["ANALYTICAL — ClickHouse"]
    o --> p["users<br/>profile cleared, external_id REPLACED"]
    o --> m["members · read_positions<br/>deleted"]
    o --> md["media_objects<br/>attributed ones destroyed<br/>73.6% record no uploader"]
    o --> msg["messages<br/>KEPT — FR-USR-05"]
    o --> ua["usage_active_users<br/>KEPT — already invoiced"]
    o --> al["audit_log<br/>CANNOT — holds the external id,<br/>append-only, and gains a row"]
    a --> ce["connection_events<br/>deleted, both predicates bound"]
    a --> ar["api_requests<br/>no user column at all"]
    a --> du["daily_usage<br/>uniq sketches, keyed on the uuid"]`;

export const figTheTombstone = `flowchart LR
    d["FR-USR-05 keeps<br/>the messages"] --> k["so messages.user_id stays"]
    k --> f["and all five foreign keys<br/>to users are NO ACTION"]
    f --> t["so the ROW CANNOT BE DELETED.<br/>erasure leaves a tombstone"]
    t --> r["and a key into an erased row<br/>names nobody — ADR-37"]
    r --> b["usage_active_users keeps every row,<br/>count unchanged"]
    r --> s["the uniq sketches need no subtract<br/>operation, which is as well"]`;

export const figTheInjection = `flowchart TB
    i["external_id<br/>z.string().min(1).max(255)<br/>255 characters of the customer's choosing"]
    i --> q{"how does it reach SQL?"}
    q -->|interpolated| bad["WHERE environment_id = '...'<br/>AND user_external_id = '' OR 1=1 --'"]
    q -->|bound| good["WHERE environment_id = {env:UUID}<br/>AND user_external_id = {uid:String}"]
    bad --> x["OR binds looser than the AND chain.<br/>1,113 of 1,116 rows destroyed,<br/>all of them other tenants'"]
    good --> ok["the value can never become syntax.<br/>0 rows outside this tenant"]`;

export const figTheArms = `flowchart LR
    subgraph probe["each arm deleted alone, both suites re-run"]
      a["A · eraseUser's env scope"] --> ga["14/14 · 64/64<br/>INVISIBLE"]
      b["B · the media collection's scope"] --> gb["14/14 · 64/64<br/>INVISIBLE"]
      c["C · the analytical env predicate"] --> gc["1 RED"]
      d["D · @Accepts(application)"] --> gd["14/14 · 64/64<br/>INVISIBLE"]
    end
    ga --> w["A: a defence behind a defence.<br/>the service resolves the id scoped first"]
    gb --> y["B: genuinely redundant.<br/>deleting BOTH turns 2 of 122 red"]
    gd --> z["D: an end-user token could erase<br/>another person's data, and<br/>nothing was red"]`;
