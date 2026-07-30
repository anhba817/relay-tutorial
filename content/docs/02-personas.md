# Relay — Personas

Four personas, ordered by how much influence they have over the product. For a developer
platform this ordering is unusual and deliberate: the person who *uses* the product and the
person who *pays* for it are different, and the person who *benefits* from it never knows
it exists.

| # | Persona | Role in the product | Priority |
|---|---|---|---|
| 1 | Mai — Integrating Developer | Primary user; evaluates, integrates, maintains | **Highest** |
| 2 | David — Engineering Lead | Economic buyer; approves and is accountable | High |
| 3 | Priya — Support & Operations | Daily operator of the customer-facing surface | Medium |
| 4 | Tuan — End User | Indirect; never sees Relay, feels every defect | Constraint |

---

## Persona 1 — Mai, the Integrating Developer

> **Primary persona. If a decision helps Mai and hurts everyone else, it is probably still
> the right decision.**

**Senior Full-Stack Engineer · 29 · B2B SaaS, ~30 engineers · Ho Chi Minh City**

Mai has been at a logistics coordination platform for three years. She works across React
and Node, owns features end to end, and has shipped integrations with Stripe, Twilio, and
two mapping providers. She is not an infrastructure specialist and does not want to become
one.

**The situation**

Her PM has committed to in-app messaging between dispatchers and drivers for the next
quarter. Mai spent a weekend prototyping with `ws` and Postgres. It worked beautifully with
one server. Then she thought about two servers, and about what happens when a driver's
phone drops off 4G mid-conversation, and she started reading vendor documentation instead.

**Goals**

- Ship messaging this quarter without it becoming her permanent responsibility
- Prove viability in a day so she can give her lead a confident estimate
- Keep her own UI — the design system is not negotiable
- Understand the failure modes before production, not during an incident

**Frustrations**

- Documentation that starts with concept diagrams instead of a code sample
- SDKs that force their own UI components on her
- Signup flows that demand a sales call before showing an API key
- Vague error responses — `400 Bad Request` with no field-level detail
- Pricing pages that make her estimate her own bill from three interacting variables

**How she evaluates**

Reads the docs before signing up. Looks for a quickstart she can paste into a scratch file.
Checks the WebSocket protocol documentation — whether reconnection and message ordering are
specified tells her whether the team is serious. Searches for the error-handling section
before the feature list. Builds a throwaway prototype and shows a colleague.

**What wins her over**

A working chat between two browser tabs in under ten minutes. An SDK that is transport and
state, not components. An OpenAPI spec she can generate types from. Error responses that
name the offending field. A status page with real history.

**What loses her**

"Contact us for API access." A quickstart that does not run as written. Discovering that
something advertised as available requires a plan upgrade. Any mandatory UI kit.

> "I don't need it to do everything. I need to know exactly what it does and what happens
> when it breaks."

---

## Persona 2 — David, the Engineering Lead

> **Buyer and blocker. He does not read the SDK, but he can veto it.**

**Director of Engineering · 41 · Reports to the CTO · Manages four teams**

David has built messaging before, at a previous company, and remembers exactly how long it
took. He is sympathetic to buying. He is also the person who gets paged and the person who
answers the security questionnaire.

**Goals**

- Keep the team on the product's actual differentiator
- Predictable cost that scales with revenue, not with surprises
- Pass a customer security review without a fire drill
- Avoid a dependency that becomes impossible to leave

**Frustrations**

- Usage-based pricing he cannot model before committing
- Vendors that go quiet during incidents
- Discovering data residency or retention gaps during a customer's procurement review
- Lock-in with no export path

**Decision criteria**

Cost modelling at 10× current volume. Uptime history and incident communication quality.
Data handling — where messages live, how long, how they are deleted. Whether the team can
extract their data if they leave. Whether the vendor will still exist in three years.

**What wins him over**

A pricing calculator with real numbers. A usage dashboard the team can watch daily. A
documented export path. Clear retention and deletion semantics. Honest, timely status
communication.

**What loses him**

Opaque metering. Enterprise-only SSO and audit logs. Any hint that support ends at a
community forum.

> "The build-versus-buy maths is easy. It's the buy-versus-regret maths I'm doing."

---

## Persona 3 — Priya, Support & Operations

> **Not the buyer, not the integrator — but the person using it every working day.**

**Customer Support Lead · 34 · Non-technical, comfortable with dashboards**

Priya's team handles disputes on the platform. When a driver claims a dispatcher never sent
an address, she needs to see the conversation. When someone is abusive, she needs to act
within minutes.

**Goals**

- Find a specific conversation quickly, from a ticket reference
- See an accurate, ordered, timestamped record including edits and deletions
- Remove content and restrict a user without an engineer's help
- Respond to a data deletion request confidently

**Frustrations**

- Asking engineering to run a database query for routine lookups
- Missing edit and deletion history, which makes disputes unresolvable
- No audit trail of her own team's moderation actions

**What she needs from Relay**

Moderation and history APIs that are complete and honest enough for her employer to build a
usable internal tool on. Relay does not serve Priya directly — it makes it possible for
Mai to serve her in an afternoon.

**Design implication:** soft-delete with tombstones rather than hard delete; an immutable
edit history; moderation events in the webhook stream. Priya is the reason those exist.

> "I don't need it to be pretty. I need it to be complete and in the right order."

---

## Persona 4 — Tuan, the End User

> **Never signs up, never logs in, never hears the name Relay. Every latency spike is his.**

**Delivery driver · 26 · Android mid-range phone · Intermittent 4G**

Tuan messages dispatchers between stops, often one-handed, often on a weak connection, in a
tunnel or a basement car park.

**What he needs**

Messages that arrive. Messages that stay arrived after the app reconnects. Correct order.
No duplicates when the network flaps. No battery drain from a connection that reconnects in
a tight loop.

**Design implications — the constraints Tuan imposes on the protocol**

- Reconnection with backfill from a cursor, not a full history reload
- Server-assigned ordering that survives out-of-order client delivery
- Client-supplied idempotency keys so a retried send is not a duplicate
- Exponential backoff with jitter on reconnect
- Explicit `sending` / `sent` / `failed` states surfaced by the SDK, so Mai's UI can be honest

> He never articulates any of this. He just closes the app if it feels unreliable.

---

## How the personas trade off

Where personas conflict, this is the resolution order:

1. **Tuan's reliability** beats everything. An unreliable platform is not a platform.
2. **Mai's integration speed** beats feature breadth. Slow adoption kills the product before feature gaps do.
3. **David's cost predictability** beats Mai's convenience — this is why usage metering is a Phase 3 requirement rather than a later nicety.
4. **Priya's completeness** beats storage efficiency — tombstones and edit history cost space and are kept anyway.

**A worked example.** End-to-end encryption would serve Tuan's privacy and please David's
security reviewers. It would also make Priya's dispute resolution impossible and complicate
Mai's integration considerably. Given the ordering above and the target market in the
vision document, it stays a non-goal — but the reasoning is recorded, not assumed.
