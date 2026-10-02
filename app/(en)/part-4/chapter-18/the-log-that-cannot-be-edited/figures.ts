// Chapter 4.18 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/064-chapter-4-18/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green.

export const figWhatTheBanLeaves = `flowchart TB
    subgraph before["before this chapter — a ban, then the ban lifted"]
      direction LR
      b1["POST /v1/users/ana/ban"] --> b2["users.banned_at = now()"]
      b2 --> b3["DELETE /v1/users/ana/ban"] --> b4["users.banned_at = NULL"]
    end
    before --> q["what is left?"]
    q --> c1["the column<br/>back where it started"]
    q --> c2["no event — a user in no channel<br/>publishes nothing"]
    q --> c3["the request log<br/>3 of 5 fields, TTL 30 days"]
    c1 --> none["two moderation actions happened<br/>and nothing records that either did"]
    c2 --> none
    c3 --> none`;

export const figTwentyFourRoutes = `flowchart LR
    r["the router, booted<br/>48 routes derived"] --> m["33 mutating"]
    m --> i["9 /internal/<br/>outside BY CONSTRUCTION:<br/>no environment, so no<br/>tenant's log to appear in"]
    m --> t["24 tenant-reachable<br/>— each owes a DECISION"]
    t --> mod["7 moderation<br/>ban · unban · delete a user<br/>remove a member · change a role<br/>archive · unarchive"]
    t --> when["1 moderation-when-application<br/>DELETE a message"]
    t --> not["16 not-moderation<br/>each with a reason"]
    mod --> line["the line is STANDING, not data"]
    when --> line
    not --> line`;

export const figWhatStopsTheWrite = `flowchart TB
    w["UPDATE audit_log SET actor_id = '...'"] --> g1
    subgraph g1["REVOKE UPDATE, DELETE — what a reader reaches for"]
      direction LR
      rv["privilege check"] --> su["the api connects as a SUPERUSER"]
      su --> pass["UPDATE 1 — the value changed"]
    end
    g1 --> g2
    subgraph g2["BEFORE UPDATE OR DELETE trigger — what fires"]
      direction LR
      tg["the trigger runs for a superuser too"] --> err["ERROR: audit entries are append-only"]
    end
    g2 --> g3
    subgraph g3["and what still gets through"]
      direction LR
      by1["SET session_replication_role = replica"] --> ok1["UPDATE 1"]
      by2["DROP TRIGGER"] --> ok2["DELETE 1"]
    end
    g3 --> claim["immutable to the application and to accident<br/>NOT to somebody holding the database password"]`;

export const figTwoListsTwoQuestions = `flowchart TB
    router["the routes a booted application reports<br/>— the one source both lists check against"]
    router --> t1["isolation/targets.ts<br/>WHICH ATTACK APPLIES<br/>read · write · list · credential · exempt"]
    router --> t2["audit/moderation-routes.ts<br/>WHICH ACTIONS OWE AN ENTRY<br/>moderation · when-application · not"]
    t1 --> p["a throwaway POST /v1/channels/probe-unclassified"]
    t2 --> p
    p --> s1["classified in NEITHER<br/>both suites red"]
    p --> s2["classified in targets.ts ONLY<br/>targets 9 of 9 GREEN<br/>moderation-routes STILL RED"]
    s2 --> why["a route can be covered for attack<br/>and undecided for audit —<br/>which one list cannot say"]`;
