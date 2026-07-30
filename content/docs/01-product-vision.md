# Relay — Product Vision

> Working name. Relay is a chat infrastructure API: real-time messaging that software
> companies embed in their own products, instead of building it themselves.

---

## 1. Vision statement

**In five years:** any product team that needs real-time conversation inside their
application ships it in a week, not a quarter — with the same confidence they have when
they add Stripe for payments or Twilio for SMS.

**Positioning statement**

> For **product engineering teams at B2B and marketplace software companies**
> who **need in-app messaging but cannot justify building and operating it**,
> **Relay** is a **chat infrastructure platform**
> that **provides real-time messaging as a hosted API with a client SDK, webhooks, and per-tenant usage analytics**.
> Unlike **building on raw WebSockets or adopting a heavyweight incumbent**,
> Relay **is API-first, transparent about delivery and usage, and small enough to understand in an afternoon**.

---

## 2. The problem

Chat looks like a two-week feature and turns into a six-month system.

The naïve build — a WebSocket server plus a `messages` table — works in development and
degrades on contact with reality:

| What teams underestimate | What it actually requires |
|---|---|
| "Just open a WebSocket" | Connection state across multiple server instances, sticky routing or a pub/sub fabric, reconnection with backfill |
| "Store the messages" | Ordering guarantees, idempotent writes, cursor pagination over a hot table, retention policy |
| "Show who's online" | Presence with heartbeat, TTL, and graceful degradation on network partition |
| "Send a notification" | Delivery state machine, fan-out to offline users, retry semantics, deduplication |
| "Let support look at a thread" | Moderation tooling, audit trail, export, deletion on request |
| "How much is this costing us?" | Per-customer metering over millions of events, which the operational database cannot serve |

The cost is not the first version. The cost is the second year: on-call rotations for a
system that is not the company's product, and an engineer who now owns messaging
permanently.

**The alternatives, and why they leave a gap**

- **Build in-house** — full control, but a permanent maintenance tax on a non-differentiating feature.
- **Incumbent platforms** (Stream, Sendbird, PubNub, Ably) — capable, but priced and scoped for large deployments, with broad surface areas that take real time to learn, and opaque usage reporting that makes cost forecasting hard.
- **General real-time infrastructure** (Pusher, Supabase Realtime, plain Redis pub/sub) — a transport, not a chat domain model. Channels, membership, history, and read state are still yours to build.

Relay targets the space between the last two: a **real chat domain model**, with a surface
area small enough to hold in your head.

---

## 3. Product principles

These are the decisions the product is willing to be judged on.

1. **API-first, UI-optional.** The API is the product. Any UI Relay ships is a reference
   implementation, never a requirement. Customers must be able to build an interface we
   never imagined.
2. **The integrating developer is the user.** Not their PM, not their end users. Docs,
   error messages, and SDK ergonomics are product features with the same priority as
   message delivery.
3. **Time-to-first-message under ten minutes.** From signup to a message travelling between
   two browser tabs. Everything on that path gets optimised; everything off it can wait.
4. **Delegated trust, not shared secrets.** Customers' own backends authorise their own
   users. Relay never asks for end-user passwords and never becomes their identity provider.
5. **Usage is observable, not a surprise.** Every metered unit is visible in the dashboard
   the moment it is counted. No customer should learn their consumption from an invoice.
6. **Tenant isolation is a correctness property.** Cross-tenant data exposure is treated as
   a Sev-0 class of bug, not a configuration mistake.
7. **Boring where it matters.** Ordering, idempotency, and retry semantics are documented
   precisely and changed rarely.

---

## 4. Target market

**Primary — the initial wedge**

B2B SaaS products with a collaboration surface: project management tools, healthcare
coordination platforms, logistics dashboards, professional services marketplaces.
Typically 5–50 engineers, no dedicated infrastructure team.

They share three traits: chat is adjacent to their core value rather than being it; their
users are identified and authenticated already; and their volume is meaningful but not
internet-scale.

**Secondary**

- **Marketplaces** needing buyer↔seller conversation with moderation and audit trails.
- **Consumer applications** in an early stage, where speed to market outweighs unit cost.
- **Internal platform teams** at larger companies standardising messaging across several
  products rather than letting each rebuild it.

**Explicitly not the target**

Social networks operating at hundreds of millions of connections; regulated deployments
requiring end-to-end encryption or on-premise installation; teams wanting a finished
Slack-style application rather than infrastructure.

---

## 5. What Relay does

**Messaging core**
Channels with membership, persistent history with cursor pagination, real-time delivery
over WebSocket, presence and typing indicators, message edit and delete with tombstones.

**Hosted media**
Image, audio, and video attachments, uploaded directly from end-user clients to Relay's
object storage via presigned URLs — bytes never transit Relay's compute. Every upload is
virus-scanned and probed before it becomes deliverable; access to media follows channel
membership via time-limited signed URLs; storage is metered per tenant and erased with the
messages that reference it.

> This is a deliberate reversal of an earlier exclusion. The original judgement — that
> hosted storage's cost, scanning, and CDN concerns were disproportionate — is answered by
> the presigned-upload design (bytes bypass Relay's services), by scanning as an async
> queue consumer, and by media being a customer-visible differentiator in the wedge market:
> a driver's voice note or a damaged-parcel photo *is* the message.

**Platform layer** — the part that makes it infrastructure rather than an app
Organisations with separate development and production environments; API key issuance,
scoping, and rotation; delegated user tokens signed by the customer's backend; per-tenant
rate limits and quotas; signed webhooks with retry and dead-lettering; idempotency keys on
every write.

**Analytics and metering**
Message volume, active users, connection-minutes, and storage per tenant. Delivery latency
percentiles, webhook success rates, and API error rates. A queryable request log for
debugging integrations. All of it available to the customer, not just to Relay.

**Developer experience**
A JavaScript SDK, an OpenAPI specification, a documented WebSocket protocol, and a
reference chat client built entirely on the public API.

---

## 6. Explicit non-goals

Naming these is as much a part of the vision as the feature list — each one is a real
product that Relay is choosing not to be.

- **Not a chat application.** No hosted, brandable end-user product.
- **No end-to-end encryption** in v1. It is incompatible with server-side moderation and
  search, and the target market is not asking for it yet.
- **Not an identity provider.** Customers own their user directory.
- **No voice or video *calls*.** Real-time A/V is a different transport problem with
  different economics. Media *files* — image, audio, and video attachments — are supported
  and hosted (see §5); the line is drawn at streams, not bytes.
- **No AI copilot features** beyond optional content classification. The temptation is
  strong and the focus cost is high.
- **No native mobile SDKs in v1.** One well-made JavaScript SDK, usable from browsers,
  Node, and React Native, beats four half-finished ones.

---

## 7. Architecture rationale

Two data paths, chosen deliberately, because the read patterns are irreconcilable.

**Operational path (PostgreSQL).** Messages, channels, memberships, tenants, API keys.
Row-level reads and writes, strong consistency, low latency. This is what a chat client
talks to.

**Analytical path (ClickHouse).** Every message send, connection open and close, API
request, and webhook delivery attempt is emitted as an event to a queue, then written to
ClickHouse. Billing metering and dashboard analytics read only from here.

The separation is the point. "Count messages per tenant per day for the last 90 days"
against the operational database is a table scan competing with live traffic; against a
columnar store it is unremarkable. Metering that degrades the product it meters is a
design failure.

The two paths also fail independently. If the analytics pipeline stalls, messages still
deliver — usage figures simply lag. That property is worth more than pipeline uptime.

---

## 8. Success metrics

**Activation** — the only metric that matters early
- Median time from signup to first message delivered: **< 10 minutes**
- Proportion of signups reaching first message: **> 60%**
- Proportion reaching a second session: **> 40%**

**Product health**
- p95 end-to-end delivery latency (send acknowledged → recipient receives): **< 250 ms**
- Message durability: no acknowledged message lost
- Webhook delivery success within three attempts: **> 99.9%**
- Metered usage accurate to **< 0.1%** against source events

**Adoption**
- Applications sending traffic in the last 7 days
- Median messages per active application per week
- Retention of applications 30 and 90 days after first message

---

## 9. Roadmap outline

**Phase 1 — Core loop.** Auth and tenancy, channels, messages, WebSocket delivery,
persistence. Success: two browser tabs exchange messages through the public API.

**Phase 2 — Platform surface.** API keys and environments, delegated user tokens, rate
limiting, idempotency, webhooks with retry and DLQ.

**Phase 3 — Analytics and media.** Event pipeline into ClickHouse, metering, developer
dashboard, request log viewer. Hosted media: presigned uploads, scan pipeline, signed
delivery, storage metering.

**Phase 4 — Developer experience.** JavaScript SDK, OpenAPI spec, docs site, reference
client application.

**Later, if ever.** Moderation hooks, message search, native SDKs,
threads and reactions.

---

## 10. Risks

| Risk | Response |
|---|---|
| Crowded market with well-funded incumbents | Compete on API clarity and usage transparency in a specific segment, not on feature breadth |
| Chat scope creep — threads, reactions, read receipts, search | Non-goals in §6 are treated as commitments, not suggestions |
| Real-time delivery is genuinely hard to get right | Fan-out via a pub/sub fabric from the start; correctness of ordering and reconnection is the primary engineering focus |
| Metering drift between events and invoices | Single source of truth in ClickHouse; reconciliation job comparing operational counts against event counts |
| Hosted media cost grows faster than revenue | Storage metered and billed per tenant from day one; per-file size caps; retention deletes objects with messages |
| Analytics pipeline outage affecting messaging | Paths are independent by design; queue absorbs backlog, delivery is unaffected |
