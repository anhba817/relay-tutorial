// Chapter 4.20 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/066-chapter-4-20/baseline.txt.
//
// PASSED TO <Figure> AS `code`, NOT `chart` — 4.11 used `chart` for all three of its
// diagrams and every one rendered nothing on a page that built green. `check:figures`
// is the gate that catches it and `pnpm build` is not.

export const figThePincer = `flowchart TB
    goal["destroy an expired message<br/>FR-MOD-06"] --> a["DELETE FROM messages"]
    a --> fk["REFUSED<br/>message_edits_message_id_fkey"]
    fk --> b["then delete the version rows first"]
    b --> tr["REFUSED<br/>message versions are append-only (FR-MSG-07)"]
    tr --> c["then make the FK ON DELETE CASCADE"]
    c --> tr2["REFUSED — the SAME trigger.<br/>a cascade issues an ordinary DELETE<br/>and a ROW trigger fires on it"]
    tr2 --> d["SET session_replication_role = replica"]
    d --> ok["DELETE 1 — and it is the hole<br/>ADR-35 published as the limit<br/>of its own guarantee"]`;

export const figTwoPaths = `flowchart LR
    c["constitution II<br/>hard deletion exists only<br/>on the compliance PATH"]
    s1["FR-MSG-08<br/>only via the compliance<br/>deletion ENDPOINT"]
    s2["DR-06<br/>a deleted message<br/>RETAINS ITS ROW"]
    m["FR-MOD-06<br/>expired messages<br/>HARD-DELETED"]
    c -. "the broadest, and unamendable<br/>by a feature" .-> dec["ADR-36 decision 1:<br/>a retention sweep IS<br/>a compliance path"]
    s1 -. "amended: endpoint -> path" .-> dec
    s2 -. "amended: until it expires" .-> dec
    m --> dec
    dec --> two["TWO named paths:<br/>FR-MOD-04's erasure endpoint<br/>FR-MOD-06's retention sweep"]`;

export const figTheSweep = `flowchart TB
    e["environmentsWithPolicy — UNSCOPED<br/>0 of 33,051 today<br/>546 buffers, or 1 with the partial index"]
    e --> loop["for each environment: one Repository, one bound"]
    loop --> p["expiredMessageIds — keyset on (channel_id, created_at)<br/>73 buffers, Index Cond not Filter"]
    p --> col["collect media_ids from the jsonb<br/>BEFORE the delete — free, and afterwards they are gone"]
    col --> del["SET LOCAL relay.expiring = 'on'<br/>DELETE — cascades to message_edits"]
    del --> ref["unreferencedAmong — AFTER, because an object<br/>referenced only by expired messages<br/>is unreferenced only once they are"]
    ref --> obj["destroy objects + renditions + bytes<br/>publish 'deleted', bytesDelta NEGATIVE"]`;

export const figTwoPopulations = `flowchart TB
    subgraph reaper["FR-MED-10 — row 22's, unbuilt"]
      o1["objects nothing ever attached<br/>48 in one environment on the lane"]
    end
    subgraph retention["FR-MED-11 — this chapter"]
      o2["objects the expired messages referenced,<br/>that no surviving message still names"]
    end
    f["unreferencedMediaIn(db, env, olderThan)"] --> o1
    f --> o2
    g["unreferencedAmong(db, env, theseIds)"] --> o2
    note["reusing the whole function looked free.<br/>it answers the union, and a retention policy<br/>has nothing to do with the orphans."]`;
