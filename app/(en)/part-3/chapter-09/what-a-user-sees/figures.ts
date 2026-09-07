// Chapter 3.16 figures. Mermaid sources live here, never in page.mdx.
// Names come from the documents, the schema and the code only.

export const figWrongWay = `flowchart TB
    q["ORDER BY max(messages.created_at)<br/>— no new column needed"]
    q --> lane["THE TEST LANE<br/>579 messages, 32 channels<br/>0.87 ms"]
    lane --> settle["'fast enough. ship it.'"]
    q --> real["A MILLION MESSAGES<br/>159 ms<br/>Seq Scan over every message<br/>in the environment, every listing"]
    real --> col["an indexed channels.last_activity_at<br/>1.1 ms"]
    col --> ratio["145x apart, and the gap grows with<br/>the one number a chat platform<br/>guarantees will grow"]
    style settle fill:#7f1d1d,color:#fff,stroke:#dc2626
    style ratio fill:#064e3b,color:#fff,stroke:#059669`;

export const figUnread = `flowchart LR
    subgraph have["WHAT THE WRITE PATH ALREADY MAINTAINS"]
      seq["channels.last_sequence<br/>the sequencing authority since chapter 2.2"]
    end
    subgraph new["ONE NEW TABLE, ONE COLUMN"]
      pos["read_positions.sequence<br/>forwards only, per (channel, user)"]
    end
    seq --> sub["greatest(last_sequence - coalesce(position, 0), 0)"]
    pos --> sub
    sub --> out["the unread count"]
    none["NO ROW = POSITION ZERO<br/>a new member's count is the whole history,<br/>and so is a re-added member's"]
    none --> sub
    clamp["greatest(..., 0) is defence against a bug:<br/>a position past the end is refused when written,<br/>and last_sequence never goes backwards"]
    clamp --> sub
    counter["A CACHED COUNTER measured 1.2-2.1 ms<br/>against this subtraction's 1.1-4.5 ms<br/>— no faster, and it can go stale"]
    style out fill:#064e3b,color:#fff,stroke:#059669
    style counter fill:#7f1d1d,color:#fff,stroke:#dc2626`;

export const figKeyset = `flowchart TB
    first["FIRST PAGE, user in 20,000 channels<br/>10.62 ms — top-N heapsort over 20,000 rows"]
    first --> deep["DEEP PAGE, cursor near the end<br/>0.03 ms — the keyset cut the set down"]
    deep --> rev["THE FIRST PAGE IS THE MOST EXPENSIVE ONE,<br/>which is the reverse of an OFFSET paginator"]
    flip["AT 50,000 THE PLANNER FLIPS<br/>an ordered walk of channels_environment_last_activity<br/>with a membership probe — no Sort at all — and it is<br/>FASTER than 20,000 was"]
    first --> flip
    tie["id IS IN THE KEY because last_activity_at is not unique:<br/>'&lt;' on the timestamp alone skips the second tied row,<br/>'&lt;=' returns the first for ever"]
    style rev fill:#1e3a5f,color:#fff,stroke:#3b82f6
    style flip fill:#064e3b,color:#fff,stroke:#059669`;

export const figDeletion = `flowchart TB
    del["DELETE /v1/users/:externalId"]
    del --> gone["GOES: display_name, avatar_url, metadata,<br/>every membership, every read position"]
    del --> stays["STAYS: the row, every message,<br/>every usage_active_users row"]
    stays --> why["messages.user_id still points at a row"]
    why --> frame["so toFrame can build a message.created,<br/>and a resuming client still receives it"]
    setnull["ON DELETE SET NULL satisfies<br/>'messages are preserved'"]
    setnull --> drop["toFrame DROPS a senderless row —<br/>messageSchema.user is z.string().min(1)"]
    drop --> silent["every message the user ever sent vanishes<br/>from every reconnecting client, with a<br/>sequence gap as the only trace"]
    style frame fill:#064e3b,color:#fff,stroke:#059669
    style silent fill:#7f1d1d,color:#fff,stroke:#dc2626`;
