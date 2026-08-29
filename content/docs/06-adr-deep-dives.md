# Relay — ADR Deep Dives

**Version:** 1.0
**Companion to:** `05-sad.md` §9
**Purpose:** The ADRs in the SAD are deliberately terse — a decision, its drivers, and its
rejected alternatives in a paragraph. This document is the long form: for each ADR, the
problem as it actually presents itself, the options with their real trade-offs, why the
decision falls out, and the conditions under which it should be reversed. The SAD remains
the source of truth for *what* was decided; this document exists so the *why* survives
contact with a skeptical reviewer.

Each deep dive follows the same shape: **Problem → Options → Analysis → Decision →
Consequences → Revisit when.**

---

## ADR-01 — TypeScript/Node.js for all services

### Problem

Six services need a runtime. The conventional microservices instinct is "right tool per
service" — Go for the gateway, maybe Rust for hot paths, Node for the dashboard. The
question is whether polyglot buys anything here, and what it costs.

### Options

1. **TypeScript/Node everywhere** — one language, one toolchain, shared packages.
2. **Go for gateway + API, TS for dashboard/SDK** — the "correct" pairing by folk wisdom.
3. **Polyglot showcase** — a different language per service, to demonstrate range.

### Analysis

The decisive observation: **the SDK must be TypeScript regardless** (FR-SDK-01 targets
browsers, Node, React Native). The WebSocket protocol has two ends, and the frame types,
cursor semantics, and idempotency-key logic exist on both. If the server is also TS, the
protocol lives in one shared package (`@relay/protocol`) consumed by gateway, API service,
and SDK — a frame type change is one commit, and drift between server and client
serialization becomes a compile error instead of a production incident. If the server is
Go, that contract is maintained twice, forever, by hand or by codegen machinery that is
itself a maintenance surface.

Go's genuine advantages for the gateway — goroutine-per-connection simplicity, lower memory
per socket, no GC pauses of consequence — are real but not binding at v1 scale. Node's
event loop handles tens of thousands of mostly-idle sockets acceptably (this is precisely
the workload it was designed for); the risk is CPU-bound work on the loop, which for us
means JWT verification and HMAC signing. Both are measured in tens of microseconds per
operation and both can move to worker threads or a sidecar if profiling demands (risk R7's
contained escape hatch).

The polyglot showcase deserves explicit rejection because it optimizes for the wrong
audience signal. Reviewers with production experience read "five languages, one author" as
five half-maintained toolchains, five CI configurations, and no depth anywhere. Depth in
one stack — with the protocol-sharing payoff above — is the stronger portfolio statement,
and D8 (one engineer must run and reason about it) makes it the only sustainable choice.

### Decision

TypeScript/Node 20+ everywhere. Shared workspace packages for protocol types, error codes,
and the repository layer's tenant-scoping interfaces.

### Consequences

Positive: one `pnpm` workspace, one test runner, one lint config; protocol drift
structurally impossible; every service is readable by anyone who can read the SDK.
Negative: no in-language escape hatch for CPU-bound hot spots (mitigated: worker threads,
then sidecar per R7); per-instance connection ceiling likely lower than Go's (mitigated:
it's a fleet-size coefficient, not a correctness issue — measure per R2).

### Revisit when

Gateway profiling shows >20% of event-loop time in crypto or serialization at target load;
or a second team with different language competence joins.

---

## ADR-02 — NATS JetStream over Kafka

### Problem

The architecture's spine (D5, D6) is a durable queue between the operational path and its
asynchronous consumers: webhook dispatch, analytics ingestion, dashboard live-stream. The
reflexive industry answer is Kafka. The question is whether Kafka's strengths apply to this
workload, and what they cost a solo operator.

### Options

1. **Apache Kafka** — the default for event streaming.
2. **NATS JetStream** — durable streams over the NATS transport.
3. **Redis Streams** — reuse the already-deployed Redis.
4. **Postgres-as-queue** (`SKIP LOCKED` polling on the outbox, no broker at all).

### Analysis

**Operational asymmetry.** Kafka is a distributed system you *operate*: broker and
partition planning up front, rebalancing on expansion, ISR tuning, per-topic retention
configuration, JVM heap care, and a consumer-group rebalance model with its own failure
modes (rebalance storms under slow consumers). Post-ZooKeeper KRaft removes a component
but not the discipline. NATS is a single ~20 MB Go binary; a three-node JetStream cluster
is three processes and a config file, and it runs in the local docker-compose (NFR-MNT-03)
without ceremony. Streams and consumers are created declaratively by the services
themselves — no topic-provisioning workflow. Under D8 this asymmetry is not marginal; it is
the decision.

**Throughput mismatch.** Kafka's architecture — partitioned append-only logs, zero-copy
reads, offsets as the only per-consumer state — makes *millions* of events per second
cheap. Our envelope is 10 k events/s (NFR-SCL-05) under ASM-04's 10 M messages/day.
JetStream's practical range extends well past our ceiling for this event size. Kafka here
is a freight train delivering groceries: the capacity is real and the operational mass is
paid whether used or not.

**Consumer-model fit.** Walk the actual consumers. The webhook dispatcher needs
*per-message* acknowledgment, individual redelivery, and delay-tiered retries
(FR-WHK-03's 1 s → 2 h schedule). That is JetStream's native model: pull consumers,
explicit ack, `nak` with backoff, `max_deliver` feeding dead-letter handling. Kafka
acknowledges *positions*, not messages — retrying message N while progressing past it
means building the standard retry-topic topology (`retry-1s`, `retry-5s`, …) or adopting a
framework; meaningful custom infrastructure to replicate a consumer config. The SSE
service needs ephemeral, per-tenant-filtered subscriptions: JetStream subject hierarchies
(`events.msg.created.{env}`) give wildcard filtering for free, and ephemeral consumers
cost nothing. In Kafka, per-tenant filtering means either topic-per-tenant (partition
explosion at 10 k tenants) or consume-everything-and-discard. Relay's eventing is
hierarchical and filtered by nature — NATS's home turf.

**Semantics we must build anyway.** Kafka's strongest card is exactly-once machinery and
the Connect ecosystem. But the outbox (ADR-06) makes publication at-least-once by
construction — a relay crash between publish and `published_at` republishes. Every
consumer is therefore idempotent regardless of broker (dedupe on event ID; EIR-WHK-04
pushes the same discipline to customers), and metering's correctness rests on the daily
reconciliation against Postgres (FR-ANL-06), which is a *requirement* — billing accuracy
cannot rest on any pipeline's promises. Kafka's stronger guarantees purchase nothing we
are not already obligated to build. The broker's guarantees are belt; reconciliation is
the suspenders we must wear anyway.

**Why not Redis Streams:** it couples the durability spine to the deliberately-lossy
ephemeral store (ADR-07). One Redis incident would then have two blast radii, and it
forces AOF/fsync persistence configuration onto a component currently run in its simplest,
fastest mode. Failure-domain separation is worth one more moving part.

**Why not Postgres-as-queue:** viable at v1 scale and zero new infrastructure — but it
puts consumer polling load on the operational database (grazing CON-01's spirit), lacks
subject filtering for the SSE path, and the outbox relay already gives us the
Postgres-side durability; the broker adds fan-out and consumer independence cheaply.

### Decision

NATS JetStream, 3-node cluster, R3 replication on streams. Subjects
`events.{domain}.{action}.{env}`; durable pull consumers for dispatcher and ingester;
ephemeral consumers for SSE.

### Consequences

Positive: near-zero operational load; retry/DLQ semantics from consumer config; one
transport for durable and ephemeral messaging; trivially local-runnable. Negative: no
connector ecosystem (any future "stream events to customer's warehouse" feature means
hand-built sinks); weaker exactly-once story (already mitigated by design); smaller
hiring/knowledge pool than Kafka.

### Revisit when

Sustained volume approaches ~100 k events/s; or a customer-facing event-export feature
makes the Connect ecosystem valuable; or long-horizon replayable history becomes a product
requirement (today: 24 h buffer + Postgres as truth). Migration is contained by
construction: ADR-06 means production always starts at the outbox — swap the relay's
target and re-implement consumer subscription; event production is untouched.

---

## ADR-03 — Per-channel sequences via `last_sequence` row lock

### Problem

FR-MSG-02/03 demand strict, server-assigned, per-channel ordering, and the resume protocol
(FR-RTM-03) plus fan-out dedup (ADR-07) lean on it. Where do gap-tolerant, monotonic,
per-channel sequence numbers come from in a system with multiple API instances?

### Options

1. **`UPDATE channels SET last_sequence = last_sequence + 1 … RETURNING`** inside the
   message-insert transaction (row lock).
2. **Per-tenant sequence** — one counter per environment.
3. **Postgres `SEQUENCE` objects, one per channel.**
4. **Time-based IDs (Snowflake/ULID)** — coordination-free.

### Analysis

The row-lock option is usually dismissed on sight — "a lock on every message!" — and the
dismissal is wrong twice over. First, the contention scope is a *single channel's row*:
sends to different channels touch different rows and never contend. Second, and more
fundamentally, serializing a channel's writes **is the requirement**, not a side effect.
FR-MSG-03 says one channel's messages form a strict order; some mechanism must decide that
order; the row lock *is* that mechanism, colocated with the insert in one transaction so
ordering and durability commit atomically. A lock cycle is sub-millisecond, giving
hundreds of messages per second *per channel* — an order of magnitude past human
conversation, and past even bot-heavy channels under FR-CHN-07's member cap.

Per-tenant sequences create a genuinely hot row — every send in an environment serializes
on one counter — converting a non-problem into a real bottleneck for the benefit of a
simpler resume cursor (a scalar instead of a per-channel map). Bad trade: the cursor map
is bounded by channel membership and FR-RTM-04's truncation already handles the long tail.

Per-channel `SEQUENCE` objects: unbounded catalog objects (one per channel, forever), and
sequences are non-transactional — a rolled-back send burns a value, producing gaps that
are *unordered with respect to commits*, which poisons the client's "gap ⇒ refetch"
heuristic. Our gaps (from rare rollbacks) are safe precisely because sequence assignment
commits with the row.

Time-based IDs are coordination-free and globally unique but only *approximately* ordered
(clock skew across instances) and never dense. FR-MSG-03 requires exact order; the SDK's
gap detection requires knowing whether a gap means "missed message" — Snowflake gaps are
meaningless. Wrong tool.

### Decision

Option 1. `SELECT … FOR UPDATE` on the channel row (or the equivalent atomic
`UPDATE … RETURNING`), sequence assigned and message inserted in one transaction.

### Consequences

Positive: exact ordering with zero additional infrastructure; dedup and resume become
integer comparisons; gaps are rare and harmless. Negative: a pathological single-channel
firehose serializes (accepted: it must, per the requirement); hot-channel throughput is
bounded by lock-cycle time (measured in the hundreds/s, far above need).

### Revisit when

A legitimate use case needs >500 msg/s in one channel (e.g. IoT telemetry misusing chat) —
at which point the answer is "that is not a chat channel," a product boundary, not an
architectural fix.

---

## ADR-04 — Single writer: only the API service touches PostgreSQL

### Problem

The gateway could plausibly write messages directly (it receives the frames) and read
backfill directly. Two services touching the database is normal microservices practice —
why forbid it?

### Options

1. **API service is sole DB client**; gateway calls internal HTTP for writes *and* backfill.
2. **Both services share a data-access library** against the same DB.
3. **Gateway owns messages, API owns the rest** (database-per-service orthodoxy).

### Analysis

Count the invariants that live at the data layer: sequence assignment under lock (ADR-03),
idempotency via partial unique index (DR-03), tenant scoping on every query (D4, the
Sev-0 property), tombstone semantics (FR-MSG-08), outbox atomicity (ADR-06). Every one is
easy to enforce in one codebase behind one repository layer and *notoriously* easy to
violate in the second codebase during a refactor six months later. The shared-library
option (2) is the seductive one — "the code is shared, so the invariants are shared" — but
libraries version-skew across services, and the cross-tenant test suite (NFR-SEC-09) would
have to run against two deployment surfaces forever. Isolation is a correctness property;
correctness properties want one enforcement point.

Option 3, orthodox database-per-service, dissolves on contact with the domain: messages,
channels, memberships, and users are one transactional fabric (a send checks membership,
locks the channel, inserts the message — one transaction). Splitting ownership converts
local transactions into sagas for zero scaling benefit, since these entities scale
*together* (§4.2's table).

The cost of option 1 is one intra-cluster HTTP hop (~1–2 ms) on send and on backfill.
Against NFR-PRF-01's 250 ms p95 end-to-end budget, that is noise. The subtler cost is that
backfill load lands on the API service; ADR-04 therefore names its own escape hatch —
backfill is a *read*, reads don't threaten invariants, so a read-replica path for the
gateway is a safe future carve-out (and S4's storm analysis leans on exactly this).

### Decision

Option 1, with the repository layer's constructors *requiring* an `environment_id` and raw
connection access lint-forbidden outside it.

### Consequences

Positive: every data invariant has one home; the cross-tenant suite attacks one surface;
schema migrations coordinate with one deployer. Negative: API service is on the gateway's
critical path (mitigated: it is stateless and horizontally scaled); +1 hop latency
(measured, accepted).

### Revisit when

Backfill reads exceed ~30% of API-service load in production — then open the read-replica
path, not the write path.

---

## ADR-05 — Sends travel through the WebSocket, writes through the API

### Problem

Clients hold two channels to Relay: the WebSocket and REST. Which carries message sends?
The answer shapes the SDK's offline story and the server's write topology.

### Options

1. **WS frame → gateway → internal HTTP → API service** (chosen).
2. **REST-only sends**; the socket is receive-only.
3. **Gateway writes to Postgres directly** on WS sends.

### Analysis

Option 3 is already dead (ADR-04). The live question is 1 vs 2, and it is decided by
Tuan's journey, not by server elegance. The SDK queues messages offline and flushes them
*in order* on reconnection (FR-SDK-07). If sends are REST, the flush interleaves two
transports: the socket is resuming (backfill streaming in) while HTTP requests race it
carrying queued sends — two independently-retrying, independently-ordered paths that must
agree on the final order. Keeping sends on the socket makes the flush a sequenced stream
on one connection: reconnect, resume, replay queue, in that order, on that pipe. Mobile
radio economics agree — one warm connection beats per-send HTTP handshakes for battery and
latency (NFR-PRF-01's p50 < 100 ms is comfortable over an established socket, tight if a
TLS handshake is in the loop).

REST sends still exist — FR-MSG-13's backend-originated sends use them — but they route to
the *identical* API-service code path. One write path, two entrances: the idempotency,
sequencing, and outbox logic cannot diverge between transports because it is the same
function.

### Decision

Option 1. The frame protocol carries `message.send`; the gateway is a forwarding client of
the API service.

### Consequences

Positive: single-pipe ordering for the offline flush; one write path; gateway stays
stateless with respect to persistence. Negative: gateway must implement request/response
correlation over the internal hop (ack routing); a gateway crash mid-forward leaves the
client unacked — resolved by the client's retry with the same idempotency key, which is
the designed path (FR-MSG-04), not an edge case.

### Revisit when

Never independently — this decision is downstream of ADR-04 and moves only if it does.

---

## ADR-06 — Transactional outbox between Postgres and JetStream

### Problem

Every state change must produce an event (webhooks, analytics, live dashboard) — and
metering (FR-ANL-06, 0.1% accuracy) means events cannot be silently lost. But Postgres and
JetStream cannot commit atomically. This is the textbook dual-write problem; the question
is which textbook answer fits.

### Options

1. **Transactional outbox** — event row commits with the state change; a relay drains to
   JetStream.
2. **Publish after commit** — write DB, then publish, hope.
3. **Publish before commit** — publish, then write DB.
4. **CDC (Debezium)** — tail the WAL, derive events.

### Analysis

Publish-after-commit fails silently in the gap: crash between commit and publish, and the
event never existed — a message was sent and no webhook fired, no metering row landed.
The failure is *invisible*: nothing errors, the books are just wrong, and FR-ANL-06's
reconciliation would page someone weekly with unexplainable drift. Publish-before-commit
inverts the failure into phantom events (webhook for a message that rolled back) — worse,
because it lies *outward* to customers.

CDC is the industrial answer and it is architecturally correct — the WAL is already a
transactional event log. It is rejected on D8 grounds alone: Debezium means running Kafka
Connect (or equivalent), schema-to-event mapping configuration, and WAL-format coupling —
an operational subsystem larger than the problem. The outbox is ~50 lines: `INSERT INTO
outbox` in the transaction, a relay loop doing `SELECT … FOR UPDATE SKIP LOCKED` →
batch-publish → mark published. `SKIP LOCKED` makes the relay horizontally scalable
(competing relays skip each other's batches) — R4's mitigation is built into the query.

The outbox has a second, quieter payoff: it is the **abstraction seam that makes ADR-02
reversible**. Every event originates in a Postgres table with a subject and payload;
"which broker" is a relay configuration detail. And the failure matrix's JetStream row
depends on it — broker down, events accumulate in Postgres, relay drains on recovery.

At-least-once is inherent (crash between publish and mark → republish), which is why
consumer idempotency is a system-wide discipline (dedupe on event `id`; the consumer
template bakes it in per R5) rather than a per-consumer choice.

### Decision

Option 1, with the relay as a small loop inside the API service initially (promotable to
its own deployment if outbox depth alarms fire).

### Consequences

Positive: no lost events, no phantom events, broker-swappable, buffer-on-broker-outage for
free. Negative: at-least-once forever (embraced, not mitigated); relay adds seconds-scale
latency to event availability (within FR-ANL-04's 60 s bound with two orders of margin);
outbox table needs pruning (delete published rows older than N days — trivial).

### Revisit when

Event volume makes polling wasteful (~50 k events/s) — then reconsider CDC with the team
size that volume implies.

---

## ADR-07 — Fan-out fabric: Redis pub/sub, at-most-once, by design

### Problem

A message committed in Postgres must reach every connected member's gateway instance.
This fabric runs at the system's highest frequency. How durable must it be?

### Options

1. **Redis pub/sub** — fire-and-forget, at-most-once.
2. **JetStream** for live fan-out — durable.
3. **Core NATS pub/sub** — fire-and-forget on a broker the stack already runs.
4. **Gateway-to-gateway mesh** — direct peer distribution.

### Analysis

The instinct says the fan-out fabric must be reliable — it carries the product. The
architecture says otherwise, and the reasoning is the intellectual core of the design:
**durability already lives in Postgres, and ordering already lives in sequence numbers
(ADR-03).** A client that misses a pub/sub frame sees the next frame's sequence, detects
the gap, and refetches — or, if fully disconnected, resumes by cursor on reconnect
(FR-RTM-03). The recovery machinery *must exist anyway* for network failures on the last
hop (Tuan's tunnel — no broker fixes his radio). Given that machinery, a lost pub/sub
frame is indistinguishable from a lost WiFi packet, and both heal identically.

Once the fabric is *permitted* to be lossy, it should be — Redis pub/sub is single-digit
milliseconds, requires zero consumer state, and one `SUBSCRIBE chan:{id}` per channel per
gateway instance. JetStream for live fan-out means durable consumer state per
channel-per-gateway for deliveries that are ephemeral by nature — heavy machinery to
avoid a problem the cursor already solves, plus higher per-message latency on the hottest
path. The mesh option reinvents a message broker with O(n²) connections and a discovery
protocol; it is what you build when you don't have Redis, and we have Redis.

Core NATS is the honest competitor, and it deserves a better answer than the other two get.
It is at-most-once, subject-based with wildcards, comparably fast, and *already deployed* —
ADR-02 put JetStream in the stack for the durable spine, and core subjects come along with
it. The case against is not mechanical. It is that Redis does not leave: ADR-10 keeps
presence as Redis keys with TTLs, and rate-limit buckets follow. So fan-out on NATS gives
the gateway two broker clients where it had one, deletes nothing from the deployment, and
splits the ephemeral concerns of a single service across two systems. Choosing Redis keeps
a clean mapping — gateway to Redis, api and workers to NATS — where each broker's guarantee
matches its cargo.

**That mapping has an exception, and it is older than the chapter that made it obvious.**
Chapter 3.8 gave the api its own Redis client for rate-limit counters, so "api and workers to
NATS" stopped being exactly true then; chapter 3.18 gave the api a second one, for the
fan-out, on the hottest path there is. The api now holds two broker clients — which is the
cost this analysis rejected core NATS for imposing on the gateway, relocated rather than
avoided.

The **Decision** below is untouched by that. "Publish once per message to `chan:{channel_id}`"
still holds: a message enters through exactly one door, and whichever service accepted it
publishes once. The **Revisit when** clauses are untouched too — they are about gap-refetch
rate and subscription scale, and neither is what changed. What changed is that the selection
argument's tidiest line is no longer literally true, and a reader comparing it against
`05-sad.md`'s component diagram deserves to be told so rather than left to reconcile them. The genuinely interesting alternative is the one nobody proposed: move
presence to NATS KV and remove Redis entirely. That is a coherent architecture and a much
larger decision; it belongs to a deployment review, not to the fan-out fabric's ADR.

The Redis-down case (failure matrix): fan-out pauses, gateways detect and cycle clients,
clients resume by cursor against Postgres. Degraded latency, zero loss — the design's
claim, "Redis holds nothing that is a source of truth," is load-bearing here and audited
in §6.3.

### Decision

Option 1. Publish once per message to `chan:{channel_id}`; every gateway instance holding
a member subscribes.

### Consequences

Positive: minimal latency on the hottest path; zero broker state; the failure story is the
reconnect story, already built and tested. Negative: SDK must implement gap detection
(bounded: a sequence comparison and a refetch); brief Redis outages surface as client
reconnect cycles rather than invisible buffering.

### Revisit when

Gap-refetch rate in production suggests pub/sub loss is frequent rather than exceptional
(would indicate Redis saturation — scale Redis, not the design); or channel-count ×
gateway-count makes subscription management dominate (see R3's wildcard-subject sketch).

---

## ADR-08 — ClickHouse single-node in v1, schema designed for cluster

### Problem

The analytical store needs 10 k inserts/s (NFR-SCL-05) and 2 s p95 tenant-scoped 90-day
queries (NFR-PRF-06). Does it need to be highly available on day one?

### Options

1. **Single node + backups**, cluster-shaped schema.
2. **Replicated cluster** (3+ nodes, ZooKeeper/Keeper) from day one.
3. **ClickHouse Cloud.**
4. **No ClickHouse — Postgres for analytics too.**

### Analysis

Option 4 first, because it is the question every reviewer asks: CON-01 forbids it, and
CON-01 exists because the workloads are irreconcilable, not stylistically different.
Metering scans ("count messages per tenant per day for 90 days") are columnar,
compression-friendly, append-only workloads; running them against the row store means
either table scans competing with live message inserts or a forest of pre-aggregation
tables maintained by triggers — the operational database degrading in service of the
meter. The two-store split is the architecture's founding decision (vision §7).

Between 1, 2, and 3, the deciding fact comes from the failure matrix: **ClickHouse
unavailability is survivable by design.** The ingester pauses, JetStream absorbs 24 h
(NFR-REL-08), dashboards go stale, messaging feels nothing (FR-ANL-03). HA for a component
whose outage costs "stale dashboards for the outage duration" buys almost nothing, and a
replicated cluster brings Keeper coordination, replication queues, and `ReplicatedMergeTree`
operational lore — the single largest step-up in operational complexity of any option in
this document, paid to protect against a tolerable failure. ClickHouse Cloud removes the
ops but adds a cloud dependency against NFR-MNT-06 and a bill disproportionate to v1 data
volumes.

Single-node throughput: MergeTree ingests hundreds of thousands of rows/s on modest
hardware when batched (DR-11 mandates batching); 10 k/s is not a sizing exercise. Query
targets hold because DR-07's `ORDER BY (environment_id, ts)` makes every dashboard query a
tenant-contiguous range read, and DR-10's materialized rollups keep metering off raw
tables entirely.

The schema hedges the future deliberately: monthly partitions, tenant-first ordering keys,
and rollup views are exactly the shapes that survive a later move to
`ReplicatedMergeTree` + `Distributed` — that migration is data movement, not schema
redesign.

### Decision

Option 1: one node, nightly backups to object storage, cluster-shaped schema.

### Consequences

Positive: near-zero analytics ops; full NFR headroom; contained future migration.
Negative: node loss means dashboard gap until restore + replay from the stream (bounded by
24 h retention + backup age — worst case loses analytical history between backup and
outage, never operational data); no query failover.

### Revisit when

The stream's 24 h buffer stops covering realistic restore time; or metering data becomes
contractually irreplaceable (SLA credits computed from it) — the trigger is *data
criticality*, not query volume.

---

## ADR-09 — Dashboard live view over SSE, not WebSocket

### Problem

FR-DSH-02 — the live event stream that converts Mai's first-message anxiety into
confidence (journey Stage 4's highest-leverage feature) — needs server → browser push
under 2 s. Which transport?

### Options

1. **SSE** via a thin relay service off JetStream.
2. **Reuse the production WebSocket gateway.**
3. **Polling.**

### Analysis

The traffic is strictly one-directional (server → dashboard; the dashboard issues commands
over normal REST), which is SSE's exact shape: plain HTTP, native `EventSource`
reconnection with `Last-Event-ID`, no frame protocol to design, no upgrade negotiation,
friendly to proxies and HTTP/2 multiplexing.

Option 2 is the tempting consolidation — "we already have a WebSocket gateway" — and it is
rejected for a reason worth stating precisely: it would couple *observer* load to the
*observed* system. The gateway is the component whose degradation the dashboard exists to
reveal; putting the dashboard on the gateway means an incident's diagnostic tool degrades
with the incident. It would also entangle two authentication models (end-user JWTs vs.
dashboard OAuth sessions) in the security-critical connection path, and pollute the
gateway's scaling signal (connection count, S1) with sessions that behave nothing like end
users. The SSE service is ~200 lines: ephemeral JetStream consumer filtered to
`events.*.*.{env}`, forwarded as SSE frames.

Polling at the 2 s bound means a dashboard tab hammering the API at 0.5 Hz per widget —
crude, chatty, and it turns "live" into "jittery."

### Decision

Option 1. Separate small service, ephemeral consumers, dashboard-session auth.

### Consequences

Positive: gateway isolation preserved; near-zero protocol surface; browser-native
reconnection. Negative: one more (tiny) deployment; SSE's one-directional limit means any
future dashboard *interactivity* over the stream would force a rethink (none is planned —
commands are REST).

### Revisit when

The dashboard needs bidirectional streaming (e.g. an interactive debugging console) — then
a dashboard-dedicated WebSocket, still never the production gateway.

---

## ADR-10 — Presence in Redis with TTL, no dedicated service

### Problem

Presence (FR-RTM-06/07) is conceptually a service — "who is online" — and microservice
instinct says to build one. What is presence, actually, and where does it want to live?

### Options

1. **Redis keys with TTL**, transitions published on channel subjects (chosen).
2. **Dedicated presence service** with its own store and API.
3. **Presence in Postgres** (a `last_seen` column).

### Analysis

Presence is *derived connection state with a grace period* — nothing more. The gateway
already knows connections (it terminates them) and already maintains the Redis connection
registry (D2). Presence is one more key with a 30 s TTL refreshed by the same heartbeat:
the data's producer, natural store, and consumers (gateways, for fan-out to co-members per
FR-RTM-07) are all already in place. A dedicated service would *subscribe to the gateway's
connection events to maintain a copy of state the gateway already has* — a service whose
entire job is being a cache invalidation problem.

The TTL design also answers the hardest presence question — crashed clients — for free: a
gateway that dies stops refreshing; keys expire; users appear offline within the grace
period, no reaper process, no tombstone protocol. And durability analysis says presence
wants *none*: after a Redis flush, every heartbeat repopulates within 30 s. Green dots are
self-healing; engineering durability for them is engineering waste. Postgres presence
(option 3) is the opposite error — heartbeat-frequency writes hammering the operational
store for data with a 30-second half-life.

The honest cost is fan-out volume, not storage: each transition publishes to every channel
the user belongs to. SRS Open Question 3 (opt-in presence per channel) stays open, with
ADR-10 carrying the measurable trigger.

### Decision

Option 1. `presence:{env}:{user}` with 30 s TTL; transitions published on the member
channels' subjects.

### Consequences

Positive: zero new components; crash-correct by expiry; presence load scales with the
gateway that generates it. Negative: presence fan-out rides the same pub/sub fabric as
messages (acceptable while it is a minority of volume — the trigger below guards it);
30 s offline-detection latency is the grace period working as specified.

### Revisit when

Presence exceeds ~30% of gateway publish volume in load tests — then presence subjects get
their own fabric or channels opt in, per Open Question 3.

> **Superseded in part by ADR-19** (chapter 3.19). Two sentences above are now out of date
> and are left standing because an accepted record is not edited. The subject clause —
> "transitions published on the member channels' subjects" — is replaced by
> `presence:{channel_id}`. And the Analysis says Open Question 3 "stays open": it does not.
> SRS v1.4 closed it as **not** opt-in per channel, confirming rather than reversing the
> reasoning above. Everything else in this record stands — Redis, TTL, no dedicated service,
> the same audience — and the ~30% trigger below is still undischarged.

---

## ADR-11 — Custom emoji as shortcodes in plain text, with a read-time resolution map

### Problem

Custom emoji (FR-EMJ) must appear *inside* messages — the one data structure the entire
architecture treats as sacred. Every invariant bled for elsewhere — byte-exact storage,
tombstones, edit history, idempotent retries, export — is defined over `text` as an opaque
string. How do emoji enter without breaking that?

### Options

1. **`:shortcode:` in plain text + read-time resolution map** (chosen).
2. **Structured message entities** — text as an AST of runs and emoji nodes (Slack-style
   blocks).
3. **Unicode Private Use Area** code points mapped to custom emoji.
4. **Server-side rewrite** — replace shortcodes with image URLs/markup at write time.

### Analysis

Option 2 is the "proper" design in a chat *application* and the wrong one in chat
*infrastructure*. The moment `text` becomes a tree, every sacred invariant must be
re-derived over trees: what does an edit diff of an AST mean (FR-MSG-07 stores
`prior_text` — prior *tree*?); what does a tombstone preserve; what does byte-exact
(FR-EMJ-01) even mean; what does the customer's export (FR-MOD-05) contain; how does
Priya's support tool render a five-year-old entity schema version? Each question is
answerable; the *sum* of answers is a permanent complexity tax on the platform's core
object, paid to benefit one read-side feature. Option 1 inverts the dependency: the write
path stays emoji-*ignorant* — send, edit, tombstone, idempotency, export are all still
string operations — and emoji become a pure read-side concern: scan the returned page's
text for `:[a-z0-9_]{2,64}:`, attach a sidecar map `{shortcode → image_url | unresolved}`.

This inversion is what makes FR-EMJ-10 (deleting a pack never mutates history) *free
by construction* rather than carefully implemented: stored messages never contained the
image, only the name. Priya's dispute record (journey 3, stage 3) renders as written
regardless of pack lifecycle — the resolution just degrades to literal text.

Option 3 (PUA code points) achieves compactness at the price of honesty: text becomes
uninspectable (a moderation export full of U+E0xx is meaningless), collides across
environments, and breaks the "text is what the user wrote" property that both audit and
FR-EMJ-01 rest on. Option 4 (write-time rewrite) mutates user content — the original
shortcode is unrecoverable, edits diff against rewritten text, and a pack rename would
strand old markup. Both are rejected on the same axiom: **stored text is testimony; the
platform annotates it but never rewrites it.**

Accepted wart: literal `:text:` that predates a matching shortcode will resolve once the
shortcode exists. The grammar makes accidental matches rare, and the client fallback makes
them benign — a mis-rendered emoji, never lost text.

### Decision

Option 1, resolution assembled server-side on message-bearing responses (see ADR-12 for
how that stays cheap).

### Consequences

Positive: zero change to write-path semantics; FR-EMJ-10 free; REST consumers get
rendering data without SDK logic; export/audit unaffected. Negative: clients must render
from map + text (the SDK ships the segmenter, FR-EMJ-13); the accepted-wart above.

### Revisit when

Rich message *structure* (mentions with identity, formatted blocks) becomes a genuine
platform requirement — entities would then be designed once, holistically, not
retrofitted for emoji alone.

---

## ADR-12 — Environment-scoped resolution map, cached whole, version-invalidated

### Problem

ADR-11 puts resolution-map assembly on history reads — the hottest read path, with a
100 ms p95 budget (NFR-PRF-03). Naïve implementation (join shortcodes against the emoji
table per page) taxes every read for a feature most messages don't use. How does
resolution become nearly free?

### Options

1. **Whole-environment map, cached under a version-stamped key** (chosen).
2. **Per-request lookup** of just the shortcodes present.
3. **Resolve client-side only** (SDK fetches pack data; server returns raw text).

### Analysis

The enabling observation is a *size bound that exists by construction*: FR-EMJ caps packs
at 200 emoji and shortcodes at 64 chars; even a pathological 100-pack environment is a
&lt;1 MB map. Small enough to load in one Redis round trip and — the real win — to memoize
*in-process* per API instance. Steady-state resolution is then a hash lookup against local
memory while scanning the page's text: nanoseconds, no I/O, the 100 ms budget untouched.

The classical objection to whole-map caching is invalidation, and the version-stamp
pattern dissolves it: `emoji_version` on the pack row (DR-13) increments on any mutation;
the cache key is `emoji:{env}:{version}`. A mutation doesn't *invalidate* anything — it
makes the old key *unreachable*, exactly the CDN cache-busting move. No purge fan-out to
API instances, no TTL-staleness window on correctness (an instance holding version N
serves slightly stale emoji for one in-process-cache lifetime after a pack edit —
cosmetically stale, never wrong-tenant, and pack edits are rare against constant reads).

Option 2 keeps a Postgres or Redis round trip on every message-bearing response and its
cost scales with page content — the hot path taxed forever to avoid a bounded cache.
Option 3 pushes resolution to clients: REST-only consumers (customer backends fetching
history for their own processing, Priya's tooling) would receive unresolvable text, and
every client re-implements resolution — duplicated logic to save the server a hash lookup
it can do for free.

### Decision

Option 1. Redis holds the versioned map (24 h TTL as garbage collection, not correctness);
API instances memoize per version; pack mutations bump `emoji_version` transactionally
with the mutation.

### Consequences

Positive: resolution at memory speed on the hot path; invalidation is unreachable-key
simple; REST and SDK consumers get identical resolution. Negative: one cold-start rebuild
per environment per mutation (rare); a bounded staleness window after pack edits
(cosmetic); the map's size bound must be *defended* — raising the 200-emoji pack cap now
has an architectural stakeholder.

### Revisit when

A legitimate customer need breaks the size bound (packs ×10, or emoji-per-pack ×10) —
then per-pack cache sharding, resolved lazily by the shortcodes actually present.

---

## ADR-13 — Media bytes never transit Relay compute

### Problem

Hosted media reverses a founding exclusion (SRS Appendix B). The exclusion's reasons were
real: storage cost, bandwidth, virus scanning, CDN, and erasure semantics. Reversing it
responsibly means the design must *answer* each reason, not outvote them. The central
question: does Relay proxy uploads and downloads, or broker access to storage it never
touches?

### Options

1. **Presigned direct-to-storage** — API issues upload/download URLs; bytes flow
   client ↔ object storage.
2. **Proxied uploads/downloads** through the API (or a dedicated media API) service.
3. **Public-read bucket** with unguessable keys; uploads presigned.

### Analysis

Option 2 puts every media byte on Relay's network path: a 100 MB video upload occupies a
Node request slot for its duration, upload bandwidth becomes an API-service scaling
dimension, and download traffic — the multiplied side, since one upload is read by every
channel member — turns Relay into a CDN it would then need to actually build. This is
*precisely* the cost basket the original exclusion priced as disproportionate; choosing it
voluntarily would make the reversal indefensible. Option 1 dissolves the basket: object
storage's durability, bandwidth, multipart handling, and lifecycle rules are bought, not
rebuilt, and Relay's involvement per media operation is one metadata row plus one HMAC —
NFR-PRF-08's <100 ms is easy because there are no bytes.

Option 3 fails on authorisation shape. FR-MED-08 requires media access to follow *channel
membership* — a revocable, changing relation. Public-read-with-obscure-keys is
irrevocable-by-construction: a key shared once is shared forever, and membership removal
(FR-RTM-10's analogue for bytes) has no mechanism. Time-limited signed URLs are the
compromise position: authorisation is evaluated at mint time against membership, and the
leak window is bounded (1 h) rather than infinite. DR-16 (never persist signed URLs)
exists to keep that window real.

Tenant-prefixed object keys (DR-15) do quiet work: compliance erasure and tenant export
become prefix operations against storage, aligning the bytes' lifecycle with the rows'.

### Decision

Option 1. MinIO in local dev; any S3-compatible store in production (ASM-06 added to the
SRS to make the dependency explicit).

### Consequences

Positive: near-zero media load on Relay compute; provider-grade durability and bandwidth;
the storage bill is the scaling ceiling (S8), not throughput. Negative: coarser auth
granularity (bounded, above); upload completion observed asynchronously; a hard dependency
on S3 semantics (acceptable — S3-compatibility is the closest thing object storage has to
POSIX).

### Revisit when

A customer segment requires media behind their own network boundary (BYO-bucket
federation) — an extension of this design, not a reversal.

---

## ADR-14 — The scan pipeline gates bytes, never messages

### Problem

Hosting user uploads without scanning is a liability no metering revenue covers; scanning
takes seconds. Where do those seconds go — into the send path, the receive path, or
neither?

### Options

1. **Async scan; attach-while-pending; `media.updated` fan-out on transition** (chosen).
2. **Scan before send** — media must be `ready` before a message may reference it.
3. **Scan on first download.**

### Analysis

Option 2 reads as the conservative choice and is actually the coupling the architecture
most forbids: it inserts a CPU-bound, seconds-long, third-party-engine-dependent stage
into the message send path. NFR-PRF-01's latency budget dies; worse, scanner *outage*
becomes message *outage* for any media-bearing send — a new fate-sharing edge violating
D5's spirit. And the UX it produces (spinner between "send" and "sent") contradicts the
expectation consumer messengers have set: the photo appears immediately, sharpens later.

Option 1 splits the concern cleanly along a line the system already knows how to draw:
the *message* (text + a media reference) flows through the ordinary send path at ordinary
speed; the *bytes* are gated — no signed URL is minted for `pending` or `rejected` media.
Recipients render a placeholder from the attachment's state; the worker's
`pending → ready` transition emits `media.updated` on the referencing channels through
the same outbox → fan-out machinery every other state change uses. No new delivery
concepts — the state machine even rhymes with the SDK's existing message states
(`sending/sent/failed` ↔ `pending/ready/rejected`), which halves the teaching burden.

Rejection as a first-class, *rendered* terminal state (FR-MED-09) is Priya's requirement:
a dispute reconstruction must distinguish "an upload was attempted and rejected" from "a
message was deleted" — a broken-image glyph destroys evidence that an explicit marker
preserves.

Option 3 moves the latency to the recipient's tap (the worst moment), re-scans per cache
miss, and means unscanned bytes *rest* in storage indefinitely — the liability deferred,
not addressed.

### Decision

Option 1. ClamAV as a worker sidecar; probe and thumbnail in the same pipeline pass;
transitions via internal API per ADR-04's single-writer rule.

### Consequences

Positive: send latency untouched by media; scanner capacity degrades time-to-ready only;
one delivery machinery serves messages and media transitions alike. Negative: recipients
may see placeholders that resolve to rejection (accepted — the expectation exists);
`pending` objects need a reaper (FR-MED-10's 24 h job); the worker is the one genuinely
CPU-bound service in an I/O-bound fleet (its own HPA signal, and ADR-01's worker-thread
posture from day one).

### Revisit when

Scan-evasion incidents or legal counsel demand synchronous review for specific tenants —
then a per-environment `strict_media` flag flips option 2 on for those who need it,
priced accordingly.

---

## ADR-15 — NestJS for the API service

### Problem

The API service began as a walking skeleton: one health route over `node:http`. By the
end of Phase 2 it owns the write path; through Phases 3–4 it accumulates tenancy, key
management, channels, membership, history, moderation, emoji packs, and the dashboard's
read APIs — dozens of endpoints, every one needing the same things: input validation at
the boundary, the EIR-API-04 error envelope, auth context, request-scoped tenancy, and a
documented contract (EIR-API-07 requires a complete OpenAPI 3.1 spec). The question is
whether those cross-cutting needs are met by conventions we hand-roll and document, or by
a framework whose conventions arrive pre-documented.

### Options

1. **Keep hand-rolled node:http** — extend the skeleton's `serve()` helper with routing,
   validation plumbing, and a hand-maintained OpenAPI document.
2. **Bare Fastify/Express** — a router with middleware, everything else still hand-rolled.
3. **NestJS** — modules, dependency injection, guards/pipes/interceptors, first-class
   validation, generated OpenAPI.

### Analysis

Option 1 is honest at skeleton scale and quadratic after it: every endpoint hand-wires
validation, error shaping, auth, and docs, and every convention lives only in this
repository's heads and READMEs. D8 cuts against that — one engineer cannot afford to be
the framework's sole author *and* its sole documentation. Option 2 buys routing but leaves
the expensive parts (validation discipline, OpenAPI, DI for testability) as bespoke work.
Option 3 buys exactly the cross-cutting layer this surface needs, at two real costs: a
decorator-based programming model (which demands a build/transform step and ends any
run-the-TS-directly purity) and a materially larger dependency tree.

The costs concentrate where request *shape* matters and mechanisms don't. That describes
the API service's REST surface precisely — and describes the gateway not at all. The
gateway's entire job is socket mechanics: the connection registry, the resume buffer, the
subscribe-before-backfill ordering. Abstraction between that code and the socket is
surface without benefit, so the framework stops at the gateway's door.

Isolation deserves its own sentence, because frameworks tempt exactly the failure D4
forbids: putting tenancy checks in guards — handler-land. The repository layer sits
*beneath* the framework and its constructor still requires an `environment_id`; the guard
authenticates and resolves the tenant, the data layer enforces it. The framework changes
who calls the repository, never what the repository demands.

### Decision

NestJS for the API service only. The gateway remains frameworkless; workers remain plain
consumers. Validation, error envelopes, and OpenAPI generation ride the framework;
isolation stays in the repository layer.

### Consequences

A build step joins the API service's toolchain (decorators are not erasable syntax).
Endpoint chapters spend their words on semantics instead of plumbing. EIR-API-07 becomes
generated output instead of a standing documentation debt. The skeleton's shared `serve()`
plumbing survives on the gateway side.

### Revisit when

Framework overhead appears on a latency-budget path (NFR-PRF-01), or a core-loop
mechanism has to fight the abstraction the way it would on the gateway — Fastify is the
named fallback, and the repository layer's independence is what makes that swap survivable.

---

## ADR-16 — Drizzle for the API service's data layer

### Problem

The repository layer is written against `pg` with hand-typed row interfaces. It is
correct, visible, and increasingly verbose: every query hand-declares its result shape,
and NFR-MNT-02's coverage expectations want the compiler carrying more of that load. The
question is which data-layer tool adds type safety **without hiding the SQL the core loop
is made of** — the row lock (ADR-03), the idempotency conflict (DR-03), the partial
unique index, the CHECK constraints.

### Options

1. **Stay on raw pg** — maximum visibility, hand-maintained types.
2. **Prisma** — schema-first ORM, generated client.
3. **TypeORM** — decorator entities, the historical NestJS pairing.
4. **kysely** — a typed SQL query builder with zero schema ownership.
5. **Drizzle** — SQL-shaped typed queries, schema defined in TS, SQL migrations generated.

### Analysis

The test is the five mechanisms. Prisma fails it structurally: DR-03's partial unique
index cannot be expressed in its schema at all, and `FOR UPDATE` exists only through raw
escape hatches — the abstraction is weakest exactly where correctness lives, so its costs
would be paid everywhere and its benefits suspended on every hot path. TypeORM passes the
mechanism test but fails the confidence test: result typing is loose where NFR-MNT-02
wants guarantees, and its API's two personalities make conventions harder, not easier.

kysely and Drizzle both pass. kysely owns nothing — the hand-written migrations stay the
only schema artifact — which is the purest fit for "the SQL is the source." Drizzle owns a
TS schema definition, and pays that cost back with schema-level constraint definitions
(the partial index and CHECKs live next to the tables that own them), relational query
ergonomics for the read-heavy Phase 3–4 surface, and `.for("update")` /
`.onConflictDoNothing()` reading almost exactly like the SQL they emit.

The drift risk is the TS schema diverging from §6.1's SQL. The mitigation is mechanical:
drizzle-kit *generates* SQL migration files, those files are reviewed and applied as SQL,
and generated DDL is diffed against §6.1's definitions. The applied SQL remains what runs.

### Decision

Drizzle inside the repository layer. The layer's constructor discipline (D4) is
untouched; Drizzle is its query engine, never a client that escapes it. Raw SQL islands
remain permitted inside the layer where the builder falls short. Migrations remain
versioned, forward-only SQL files.

### Consequences

Queries gain end-to-end types without losing their SQL shape. The schema exists twice —
once as §6.1's SQL truth, once as TS definitions — with drift checked, not assumed away.
The isolation suite and the lint ban on raw driver imports carry over unchanged.

### Revisit when

The TS schema and applied SQL drift in practice, or new queries routinely bypass the
builder for raw SQL — either signals that kysely's schema-free model (the named fallback)
should take over.

---

## ADR-17 — Turborepo for build orchestration

### Problem

The workspace's three-command gate (`lint`, `typecheck`, `test`) has run everything,
everywhere, on every invocation since chapter 1.1 — the right call when every task was
fast and no task depended on another. ADR-15 breaks both properties at once: NestJS's
decorators give the API service a real compile step, and a compiled `@relay/protocol`
must exist before the services that import it can build. Phases 2–4 add four more
services and several packages. The question is what runs the tasks — not what installs
the packages; pnpm keeps that job — so that gate time scales with the size of a change
rather than the size of the workspace.

### Options

1. **Stay on plain `pnpm -r` scripts** — recursive, uncached, orderless.
2. **Turborepo** — a task graph with content-hash caching over existing package scripts.
3. **Nx** — the heavyweight: plugins, generators, a daemon, distributed execution.
4. **Bazel** (and kin) — hermetic, polyglot, industrial.

### Analysis

Plain `pnpm -r` fails the new requirements structurally: it has no task ordering beyond
package topology per command, and no memory — a one-line docs change re-typechecks six
services. It was the correct choice until this ADR's drivers existed, which is exactly
why it lasted this long.

Bazel solves problems Relay does not have (polyglot builds, thousand-engineer repos) at
a cost D8 cannot pay: its model replaces the npm-script world instead of running it.
Nx and Turborepo both fit the actual need. Nx is more capable — and the capability
arrives as surface: a daemon, code generators, plugin versions to track. The deciding
observation is that every capability the gate needs (task graph, caching, filtering)
is the part of Nx that Turborepo *is*, without the rest.

Turborepo's real cost is trust: a cache hit is a claim that nothing relevant changed,
and the claim is only as good as `turbo.json`'s declared inputs and outputs. An
undeclared input (an env var, a config file outside the package) produces a stale
green — the most dangerous failure a gate can have. The mitigation is the same
discipline the fence rules already established: declarations are reviewed like code,
and tagged chapter checkpoints run against a clean cache, so a lying cache cannot
survive a tag.

### Decision

Turborepo as the task runner over the unchanged pnpm workspace. Every `turbo run`
target remains an ordinary package script — `turbo` orders and caches, packages still
own their commands. Remote caching waits for CI (Part 6).

### Consequences

The gate's cost now tracks the change, not the workspace; the protocol-before-services
build order is declared once instead of implied. One new artifact (`turbo.json`) joins
the reviewed set, and the degradation path stays open: delete it and `pnpm -r` still
runs everything, slowly and correctly.

### Revisit when

A stale-cache incident survives the input-declaration discipline, or the task graph
starts encoding dependency knowledge that belongs in package.json — either way Nx (the
named fallback) or plain recursion takes over.

---

## ADR-18 — Two user populations: platform humans and tenant end users, never merged

### Problem

Two kinds of person interact with Relay. A customer's end users — Tuan, the dispatcher —
exist inside an environment and never sign in to Relay at all; their identity is whatever
`external_id` the customer already had for them. The people who *run* a Relay account sign
in with GitHub or Google, may own several organisations, and belong to no environment.
Should one table hold both?

### Options

1. **Two tables**, one above the tenant boundary and one below.
2. **One `users` table** with a nullable `environment_id`, null meaning "platform human".
3. **One table with a view** per population, hiding the nullable column behind names.

### Analysis

Option 2 is the one that sounds economical and is disqualified by a single column. A
platform human belongs to no tenant, so the tenant column has to be nullable — and a
nullable tenant column is precisely the shape Principle I exists to prevent, the one
FR-TEN-06 rules out in words ("every persisted operational and analytical record shall
carry a non-null tenant identifier"). The consequence is not aesthetic. Chapter 2.1 built
the repository so that a query without an `environment_id` cannot be *expressed*; with a
nullable tenant, isolation stops being enforced by construction and becomes a thing
reviewers must notice. The most important requirement in the system (FR-TEN-05) would then
rest on vigilance, which is exactly the trade the constitution refuses.

Option 3 changes nothing that matters. The column is still nullable; the view only makes it
harder to see.

Option 1 costs two tables and an honest admission: "who is this?" is answered differently on
either side of the boundary. That is not a wart — it is what the boundary *is*. Below it,
identity is the customer's `external_id`, scoped to an environment. Above it, identity is a
provider account, scoped to nothing, because a person is not a tenant.

The identity key is worth its own note. It is `(provider, provider_account_id)`, never the
email: emails change hands, providers may withhold them, and a provider that does release
one has usually not verified it. That makes account linking — the same person arriving via
GitHub and then Google — a deliberate later feature rather than an accident of matching
strings, and chapter 3.1 says so where a reader will meet it.

### Decision

Option 1. `users` stays exactly what Part 2 made it; `humans` and `memberships` join the
schema above the boundary, and no row ever crosses.

### Consequences

Positive: FR-TEN-06 remains true of every operational row without exception, so the
repository's scoping stays enforceable by construction; roles (FR-TEN-07) have somewhere to
live; and the isolation gauntlet (3.7) has an unambiguous answer to "which population does
this identifier belong to?". Negative: two tables to reason about, and any future feature
touching both populations — audit trails naming an actor, for instance — must say which one
it means. That cost is paid in clarity rather than in correctness.

### Revisit when

A product requirement genuinely spans both populations — a customer's end user who is also
a Relay account holder, wanting one login. Even then the answer is likely a link table
rather than a merge, because the tenant column's nullability is the thing that must not
change.

## ADR-19 — Presence on its own subject grammar

### Problem

ADR-10 decided *where presence lives* and, in the same sentence, *which subject carries it*:
"transitions published on the member channels' subjects". Nine chapters later the first
implementation of presence went to write that sentence into code, and the fabric it names
cannot carry a transition. The `chan:{channel_id}` path is typed to messages at three
points, spread across two files: a `publish(message: Message)` signature and a
`messageCreatedSchema` parse in `services/gateway/src/fanout.ts`, and the literal
`message.created` send inside `session.ts`'s `deliver`, a function fenced by ten chapters
of tutorial. A presence payload published there today produces `fanout.invalid_payload`
and no frame at all.

So the question is not the one ADR-10 answered. It is: what does presence publish on, given
that the answer ADR-10 assumed is unavailable without editing the highest-volume path in the
system?

### Options

1. **A second subject grammar**, `presence:{channel_id}`, in its own module (chosen).
2. **An enveloped payload on `chan:{channel_id}`** — a discriminated union, parsed on
   receipt, dispatched by kind.
3. **A pattern subscription** (`PSUBSCRIBE relay:*:{channel_id}`) covering both.

### Analysis

Option 2 is the one that honours ADR-10's letter, and it is the expensive one. The parse it
adds runs on every message every instance receives, forever, to serve traffic that ADR-10
itself describes as a minority of volume — the cost lands entirely on the path that is not
being changed. It is also the option that makes cross-kind mis-delivery a thing tests must
defend against: with one subject, "a message must never arrive as a presence frame" is an
assertion someone has to remember to write, where with two subjects it is a property of the
topology. And there is a deploy window nobody would enjoy: during a rolling restart, an old
instance receiving new enveloped payloads emits `fanout.invalid_payload` for every
transition on every channel until it drains.

Option 3 is the one that gets worse with scale. Redis matches every published channel
against every registered pattern; a fabric whose per-publish cost grows with the number of
subscribers is the wrong shape for the component that exists to fan out.

Option 1's honest price is the subscription count, and this is where a number replaces an
argument. A channel now carries two subscriptions instead of one, so a user in twenty
channels issues forty `SUBSCRIBE`s at connect rather than twenty. Measured on the running
Redis with `CONFIG RESETSTAT` and `INFO commandstats`: two instances across three channels
produced `cmdstat_subscribe calls=12` — six fan-out, six presence, one per channel per
instance, exactly, with the second local member of a channel adding none. `ioredis` takes a
variadic `subscribe(...)`, so the doubling costs no extra round trips.

The placement inside the codebase argues itself once stated. The event spine already keeps
its own `subjectFor` in `internal.ts` rather than in `fanout.ts`; each fabric owning its
subject grammar is this codebase's existing habit. A new file is also a whole-file fence for
the tutorial and leaves two earlier chapters' diff hunks untouched, which a shared file would
not.

### Decision

Option 1. `presence:{channel_id}`, generated by `subjectForPresence` in a new protocol
module alongside the fabric payload schema, published and consumed by a new gateway module
that owns its own Redis clients. `fanout.ts` is not edited.

This supersedes ADR-10's subject clause and nothing else. Presence still lives in Redis,
still expires rather than being reaped, still has no service of its own, and still reaches
exactly the members of the channels the user belongs to.

It also closes SRS Open Question 3 — "should presence be opt-in per channel?" — as **no**.
ADR-10 answered it provisionally and the answer holds, though not for the reason the question
anticipated: a per-channel toggle is a column, a defaulting rule, an API surface and a UI,
bought to solve a volume problem that has still not been measured. The cheaper half of that
remedy is what Option 1 above already delivers.

### Consequences

Positive: the message hot path is byte-identical; cross-kind mis-delivery is structurally
impossible rather than test-enforced; a rolling deploy of a presence-aware instance beside a
presence-blind one produces no errors in either direction, because the blind one is not
subscribed to the new subject. Negative: one more subject grammar for a reader to learn, two
subscriptions per channel per instance, and a fifth and sixth Redis client in the gateway —
a subscriber and a command client, because a connection in subscribe mode cannot run `SET`.

The uncomfortable consequence is the honest one: **this is half of ADR-10's own revisit
remedy, taken before ADR-10's trigger fired.** ADR-10 said that above ~30% of publish volume,
"presence subjects get their own fabric or channels opt in". Presence subjects now have their
own fabric. Nothing here measured publish volume at scale — the reason is the typed fan-out,
not the threshold — so the trigger is not discharged, and neither is NFR-SCL-01. A decision
that arrives at a prepared destination by an unrelated road has not tested the road that was
prepared.

### Revisit when

Presence fan-out exceeds ~30% of gateway publish volume in load tests — ADR-10's trigger,
inherited intact, and now answerable only by the second half of its remedy, channels opting
in. Or when the doubled subscription count becomes the binding constraint on connections per
instance, which is the measurement NFR-SCL-01 has been owed since the SAD was written.

## Reading the nineteen together

Three themes recur, and naming them is the best summary of the architecture's character:

**Durability has one home; everything else is allowed to be cheap.** Postgres holds truth
(ADR-04, -06); therefore the fan-out fabric may be lossy (ADR-07), presence may evaporate
(ADR-10), the analytical store may go down (ADR-08), and the broker may be modest
(ADR-02). Every "surprisingly relaxed" choice is purchased by one strict one.

**The write path is sacred; features live on the read side.** Sequences commit with rows
(ADR-03), sends converge on one code path (ADR-05), and emoji never touch stored text
(ADR-11, -12). When a new feature threatens FR-MSG semantics, the design reflex is to
reformulate it as a read-time concern. Even the application stack bends to this theme:
the framework serves the wide read-and-CRUD surface and stops at the gateway's door
(ADR-15), and the data layer was chosen so the write path's invariants stay written in
visible SQL rather than behind an abstraction (ADR-16).

**Isolation is structural, never procedural.** The single writer (ADR-04), the repository
layer that cannot express an unscoped query (ADR-16), and the refusal to merge the two user
populations (ADR-18) are one argument in three places: tenant safety is a property of the
shapes, not of anyone's attention. Each of those decisions rejected a cheaper option whose
only flaw was needing someone to be careful.

**Every decision names its own undoing.** Reversal triggers are part of each record — not
decoration, but the discipline that keeps a solo-built system honest: the day a trigger
fires, the argument for change is already written. ADR-19 is the first record to test that
claim, and it complicates it: the change arrived, the prepared argument fit, and the trigger
had not fired. A written remedy can be reached by a road it did not anticipate — which is
worth knowing, because the trigger it was attached to is then still owed.
