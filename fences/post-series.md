# Post-series fence amendments

Changes to fenced files made by work that publishes **no chapter**.

The fence chain exists so that a reader who copies a chapter's code ends up with
the canonical repository. Occasionally something changes a fenced file without
teaching anything — tooling, CI, a dependency the series never discusses. Those
amendments used to have two bad homes: hide them (and the chain breaks) or paste
them into whichever chapter happened to fence the file last (and that chapter
then shows a reader code it never mentions).

They live here instead. `check-fence-chain` applies them **after** the last
chapter and checks the result exactly as strictly, so the chain stays byte-exact
and no chapter is made to lie. Every entry states why no chapter owns it.

Diffs only. A whole-file fence here would silently overwrite whatever the
chapters built, which is the opposite of what this file is for.

---

## `package.json` — coverage tooling (feature 024)

Constitution VI requires 70% coverage of business logic and 100% branch coverage
for ordering, idempotency and tenant isolation. Neither was measurable: the
workspace had no coverage provider. Chapters 3.1, 3.2 and 3.3 each deferred the
measurement, the third time by explicit decision.

Two devDependencies and one script make it measurable. No chapter teaches them
because no chapter is about test tooling — Part 6 owns CI, and when it arrives
this amendment should fold into it and disappear from here.

`unplugin-swc` is listed here as well as in `services/api` because the coverage
config lives at the workspace root, and pnpm's isolated `node_modules` will not
resolve a package's devDependency from above it.

```diff title="package.json"
@@ -13,6 +13,7 @@
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
     "test:integration": "turbo run test:integration",
+    "coverage": "vitest run --config vitest.coverage.config.mts --coverage",
     "build": "turbo run build"
   },
   "devDependencies": {
@@ -25,6 +26,8 @@
     "turbo": "^2.10.8",
     "typescript": "^5.9.3",
     "typescript-eslint": "^8.65.0",
+    "unplugin-swc": "^1.5.9",
+    "@vitest/coverage-v8": "^4.1.10",
     "vitest": "^4.1.10",
     "ws": "^8.21.1"
   }
```

---

## `services/api/src/consumer/consumer.itest.ts` — two tests that outgrew a shared stream (chapters 3.6 and 3.7)

### One — a teardown that deleted another suite's consumer (chapter 3.6 baseline)

Chapter 3.4's consumer suite cleaned up after itself by deleting every durable
consumer on `EVENTS` whose name began with `itest-`. Chapter 3.5's dispatcher
suite then named its own expand consumer `itest-expand-<run>`, on the same
stream — and Turborepo runs the two packages' integration lanes at the same
time. So one suite's teardown deleted the other's live consumer mid-run.

It showed up as `NatsError: consumer deleted` in whichever dispatcher test
happened to be polling, and `consumer not found` in the next one along. Two of
three full-lane runs failed; the dispatcher suite passed every time it ran
alone. Chapter 3.6's baseline was measuring a lane that had been intermittently
red since 3.5 shipped.

The fix is a prefix that names this suite rather than every suite. The sweep uses
`itest-consumer`, so it still tidies up after a run that crashed before its own
teardown, and the durables themselves stay unique per run.

### Two — a catch-up test with a fixed budget on a growing stream (chapter 3.7)

Invariant 9 asserts that a consumer stopped for N publishes receives all N when it
restarts. To make "everything published while away" measurable it first drove a
fresh durable to the head of the stream, capped at 800 polls.

It called `ENV()` three times for its three publishes — and `ENV` is
`() => randomUUID()`, so the three events went to three different subjects and no
`filterSubject` could cover them. Without a filter the durable starts at the
beginning of a stream that earlier chapters have left about thirteen thousand
events in, and all of those had to be drained inside the 800 before the three
under test were reachable.

That worked until the stream outgrew the budget. Chapter 3.7 ran the integration
lane twenty times and it failed on run 11 and again on run 12:

```text
FAIL  src/consumer/consumer.itest.ts > the consumer >
      invariant 9: a consumer stopped for N publishes receives all N on restart
AssertionError: expected [ …(2756) ] to include 'd3dbb0a4-…'
```

**Not a flake — a threshold.** 2,756 events drained and the backlog still not
cleared. Ten clean runs then two failures in a row is the signature of a test that
was passing on headroom rather than on correctness, and the twenty runs are the
only reason anyone saw the crossover rather than a lone red build.

The three publishes now share one environment and both runtimes filter on its
subject, which is the pattern every other test in the file already used and the
reason its `runtimeFor` helper takes an `environmentId` at all. Scoped, the drain
has nothing to drain. The invariant is untouched: the stream holds messages
whether or not anybody is reading, and the backlog waits.

**No chapter owns either of these.** 3.4 fenced the file and is about the claim
ledger; a teardown prefix and a subject filter are test-harness hygiene it never
discusses. 3.6 does not discuss the consumer suite at all, and 3.7 is about the
resume duplicate. Putting either amendment in one of them would make that chapter
show a reader code it never mentions, which is what this file exists to avoid.

```diff title="services/api/src/consumer/consumer.itest.ts"
@@ -102,6 +102,33 @@
   });
 }
 
+/** The prefix every durable this suite names in-process carries. Unique per RUN,
+ * and — the part that was missing — unique to THIS SUITE.
+ *
+ * The cleanup below deletes by prefix, and `itest-` was never this suite's to
+ * claim. The dispatcher's own integration suite names its expand consumer
+ * `itest-expand-<run>` on the SAME `EVENTS` stream, and under Turborepo the two
+ * suites run at the same time against the same broker. So this suite's teardown
+ * deleted a live consumer belonging to another suite mid-run, and whichever
+ * dispatcher test happened to be polling failed with `NatsError: consumer
+ * deleted` — or, for the next test along, `consumer not found`. It reproduced on
+ * two of three full-lane runs and never once when the dispatcher suite ran
+ * alone, which is what a cross-suite race looks like from the outside.
+ *
+ * The comment on `spawnedDurables` below had already written down the rule that
+ * would have prevented this: a prefix sweep deletes things it did not create.
+ * That reasoning was applied to the walk's durables and not to this suite's own.
+ * Found by chapter 3.6's baseline.
+ *
+ * Two names, because they answer two different questions. `SUITE` is what the
+ * teardown sweeps — this suite's whole namespace, so a run that crashed before
+ * its own teardown is still tidied up by the next one. `RUN` is what the durables
+ * are actually called, so two runs never share a position. Sweeping `RUN` alone
+ * would leak every crashed run's consumers forever, which is the leak this
+ * teardown was written to stop. */
+const SUITE = "itest-consumer";
+const RUN = `${SUITE}-${randomUUID().slice(0, 8)}`;
+
 /** Durables this suite created through a CHILD process rather than directly.
  * The walk names its own — `walk-<uuid>` — so the suite cannot predict them and
  * a prefix sweep would delete a reader's walk running alongside it. It records
@@ -172,7 +199,7 @@
   }, 60_000);
 
   afterAll(async () => {
-    await db.execute(`DELETE FROM consumed_events WHERE consumer LIKE 'itest-%'`);
+    await db.execute(`DELETE FROM consumed_events WHERE consumer LIKE '${SUITE}-%'`);
     for (const durable of spawnedDurables) {
       await db.execute(
         `DELETE FROM consumed_events WHERE consumer = '${durable}'`,
@@ -184,15 +211,18 @@
     // found twelve of them the first time it looked. Per-run names keep runs
     // independent; they do not clean up after themselves.
     //
-    // Both kinds go: the ones this process named `itest-…`, and the `walk-…`
+    // Both kinds go: the ones this process named `${RUN}-…`, and the `walk-…`
     // ones its child processes named for themselves. Missing the second kind is
     // how the first count reached twelve.
+    //
+    // The prefix is this SUITE's, not `itest-`. Sweeping `itest-` deleted another
+    // suite's live consumer off this same stream — see `RUN` above.
     const nc = await connect({
       servers: process.env.RELAY_NATS_URL ?? "nats://localhost:4222",
     });
     const jsm = await nc.jetstreamManager();
     for await (const info of jsm.consumers.list("EVENTS")) {
-      if (info.name.startsWith("itest-") || spawnedDurables.includes(info.name)) {
+      if (info.name.startsWith(SUITE) || spawnedDurables.includes(info.name)) {
         await jsm.consumers.delete("EVENTS", info.name).catch(() => undefined);
       }
     }
@@ -234,7 +264,7 @@
 
   it("invariant 3: an event is delivered, handled once, and acknowledged", async () => {
     const environmentId = ENV();
-    const durable = `itest-basic-${Date.now()}`;
+    const durable = `${RUN}-basic-${Date.now()}`;
     const seen: string[] = [];
     const eventId = await publish(environmentId);
 
@@ -303,7 +333,7 @@
     // The ledger is in Postgres precisely so that a process restart does not
     // reset it. A second runtime with the same durable name gets the same
     // answer the first one would have.
-    const durable = `itest-restart-${Date.now()}`;
+    const durable = `${RUN}-restart-${Date.now()}`;
     const eventId = randomUUID();
 
     expect(await claimEvent(db, durable, eventId, async () => {})).toBe(
@@ -319,7 +349,7 @@
     // The ordinary deployment. A durable consumer is one position in the stream,
     // so two api processes pulling from it share the work — the property the
     // broker provides here that `SKIP LOCKED` provides for the outbox.
-    const durable = `itest-shared-${Date.now()}`;
+    const durable = `${RUN}-shared-${Date.now()}`;
     const byA: string[] = [];
     const byB: string[] = [];
     const ids = [
@@ -352,7 +382,7 @@
     // answer this chapter gives rather than a dead-letter path that does not
     // exist yet.
     const environmentId = ENV();
-    const durable = `itest-poison-${Date.now()}`;
+    const durable = `${RUN}-poison-${Date.now()}`;
     const eventId = await publish(environmentId);
     let attempts = 0;
 
@@ -386,7 +416,7 @@
     // runtime terminates the message instead of burning the budget and dropping
     // it anyway — and says so in a log line carrying no payload.
     const environmentId = ENV();
-    const durable = `itest-garbage-${Date.now()}`;
+    const durable = `${RUN}-garbage-${Date.now()}`;
     const lines: string[] = [];
     const noisy = createLogger("consumer-itest", (line) =>
       lines.push(typeof line === "string" ? line : JSON.stringify(line)),
@@ -416,12 +446,38 @@
   it("invariant 9: a consumer stopped for N publishes receives all N on restart", async () => {
     // What `limits` retention means: the stream holds messages whether or not
     // anybody is reading. The backlog waits.
-    const durable = `itest-catchup-${Date.now()}`;
+    const durable = `${RUN}-catchup-${Date.now()}`;
     const seen: string[] = [];
-    const runtime = runtimeFor(db, durable, async (e) => void seen.push(e.id));
+    // ONE environment for all three publishes, and the consumer filtered to it.
+    //
+    // This test used to call `ENV()` three times — and `ENV` mints a fresh uuid
+    // on every call, so the three events went to three different subjects and no
+    // filter could cover them. Without a filter the durable starts at the head of
+    // a stream holding ~13,000 events from earlier chapters, and the loop below
+    // had to drain all of them inside a fixed budget of 800 polls before the
+    // three under test were even reachable.
+    //
+    // Found on run 11 of chapter 3.7's twenty post-fix lane runs: `expected
+    // [ …(2756) ] to include '<uuid>'`. 2,756 events drained and the backlog
+    // still not cleared. It is the same shape as the sweep and the drain in
+    // `deliveries.itest.ts` — a test riding a shared, growing resource with a
+    // fixed budget, which passes until the resource outgrows the budget.
+    //
+    // Scoped, the drain below has nothing to drain and the assertion is about
+    // exactly the three events it published. The invariant is unchanged: the
+    // stream holds messages whether or not anybody is reading, and the backlog
+    // waits.
+    const environmentId = ENV();
+    const runtime = runtimeFor(
+      db,
+      durable,
+      async (e) => void seen.push(e.id),
+      silent,
+      environmentId,
+    );
 
     // Get to the head of the stream first, so "everything published while away"
-    // is measurable rather than lost in twelve thousand older events.
+    // is measurable rather than lost among older events.
     for (let i = 0; i < 800; i++) {
       const { handled, duplicates } = await runtime.pollOnce();
       if (handled + duplicates === 0) break;
@@ -429,12 +485,18 @@
     await runtime.stop();
 
     const published = [
-      await publish(ENV()),
-      await publish(ENV()),
-      await publish(ENV()),
+      await publish(environmentId),
+      await publish(environmentId),
+      await publish(environmentId),
     ];
 
-    const restarted = runtimeFor(db, durable, async (e) => void seen.push(e.id));
+    const restarted = runtimeFor(
+      db,
+      durable,
+      async (e) => void seen.push(e.id),
+      silent,
+      environmentId,
+    );
     for (let i = 0; i < 100; i++) {
       await restarted.pollOnce();
       if (published.every((id) => seen.includes(id))) break;
@@ -446,7 +508,7 @@
 
   it("invariant 12: a consumer log line carries counts, never payloads", async () => {
     const environmentId = ENV();
-    const durable = `itest-logs-${Date.now()}`;
+    const durable = `${RUN}-logs-${Date.now()}`;
     const lines: string[] = [];
     const noisy = createLogger("consumer-itest", (line) =>
       lines.push(typeof line === "string" ? line : JSON.stringify(line)),
```

---

## `services/api/src/auth/credentials.itest.ts` — a leak assertion with a one-character needle (chapter 3.6 baseline)

Invariant 11 is the test standing between a customer's credential and a log file.
It derived the secret to search for with `key.credential.split("_").at(-1)`.

A credential is `rk_dev_<32 hex>_<32 bytes base64url>`, and base64url's alphabet
contains `_`. `api-key.ts` carries a paragraph about exactly this, and even records
that an earlier document said "split on the last separator" until the first mint
that produced a secret with an underscore said otherwise. The test did it anyway.

It failed when a mint ended `…_I`: the assertion had become "no log line contains
the letter I", and the error body for a misused key says "this route expects an
API key". That was the visible half, and it is the cheap half. The invisible half
was true on most runs — whenever the secret contained an underscore, only the
fragment after the last one was checked, so a log line leaking the first thirty
characters of a secret would have passed.

It now parses with the same function production parses with, and asserts the
needle is longer than 20 characters so it can never degenerate again. The foreign
key's secret is checked too, which it never was.

**No chapter owns this.** 3.2 wrote the test and 3.5 amended it; both are about
what the assertion checks, not about how a credential is split. The correction is
a test-harness bug fix, and putting it in either chapter would show a reader a
diff that chapter never discusses.

```diff title="services/api/src/auth/credentials.itest.ts"
@@ -15,6 +15,7 @@ import {
   Repository,
   revokeApiKey,
 } from "../db/repository";
+import { parseApiKeyCredential } from "./api-key";
 import { MAX_TOKEN_LIFETIME_SECONDS } from "./user-token";
 
 // The refusals, over real HTTP against the compose Postgres (chapter 3.2).
@@ -295,10 +296,29 @@ describe("credentials", () => {
     }
 
     const haystack = captured.join("") + bodies.join("");
-    const secret = key.credential.split("_").at(-1)!;
+    // PARSED, not split. `api-key.ts` carries a paragraph explaining that
+    // base64url's alphabet includes `_`, so the secret may contain the separator
+    // and splitting on it is wrong — and this assertion used to do exactly that:
+    // `key.credential.split("_").at(-1)`.
+    //
+    // It failed the day a mint ended `…_I`, because the assertion had become
+    // "no log line contains the letter I" and the error body for a misused key
+    // says "this route expects an API key". That was the visible half. The
+    // invisible half is worse and was true on most runs: whenever the secret
+    // contained an underscore, this checked only the fragment after the LAST
+    // one, so a log line leaking the first thirty characters of a secret passed.
+    //
+    // Found by chapter 3.6's baseline, which ran the lane three times.
+    const parsed = parseApiKeyCredential(key.credential);
+    expect(parsed).not.toBeNull();
+    const secret = parsed!.secret;
+    // Guards the guard: a one-character "secret" is how this assertion turned
+    // vacuous-then-flaky, and 32 base64url-encoded bytes are never short.
+    expect(secret.length).toBeGreaterThan(20);
     expect(haystack).not.toContain(key.credential);
     expect(haystack).not.toContain(secret);
     expect(haystack).not.toContain(foreignKey.credential);
+    expect(haystack).not.toContain(parseApiKeyCredential(foreignKey.credential)!.secret);
     expect(haystack).not.toContain(token);
     // The prefix alone is not a secret and may legitimately appear.
   });
```

---

## `package.json` — the integration lane runs one package at a time (chapter 3.6 baseline)

Every integration suite in this workspace assumes exclusive use of the shared
stores, and several say so in comments. Turborepo was running them concurrently,
so they interfered — most sharply through the broker, where the dispatcher's
expand consumer legitimately filters `events.>` across every environment and
therefore also consumes whatever the api's consumer suite is publishing. The
symptom was a 60-second timeout in a test whose own message was queued behind
another suite's traffic.

Serialising is the fix rather than narrowing that consumer, because the wildcard
is correct in production and the suites are what make the assumption.
`vitest.coverage.config.mts` already sets `fileParallelism: false` for this exact
reason, so the precedent was already in the repository; this applies it to the
other lane. The lane goes from about three minutes to about nine, which is the
honest price of a readable result.

**No chapter owns this.** Part 6 owns CI, and when it arrives this belongs with
it.

```diff title="package.json"
@@ -12,7 +12,7 @@
     "lint:root": "eslint .",
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
-    "test:integration": "turbo run test:integration",
+    "test:integration": "turbo run test:integration --concurrency=1",
     "coverage": "vitest run --config vitest.coverage.config.mts --coverage",
     "build": "turbo run build"
   },
```

---

## `services/api/src/webhooks/deliveries.itest.ts` — two tests that depended on being alone (chapter 3.7)

Two separate faults in the same file, found at either end of chapter 3.7's work
and amended in one diff because they share a shape: a test calling a **global,
unscoped** operation and then asserting about its own row.

### One — the sweep, found at the baseline

Chapter 3.6's sweep is global: it takes the hundred oldest endpoints whose failure
run has outrun the hour. The test that proves it works aged its own endpoint by 64
minutes and then called the sweep with the default limit.

Every earlier run of that suite leaves endpoints behind with an open failure run,
and those are older. Once enough of them accumulate — 781 by the time chapter 3.7
measured its baseline — they fill the batch, the test's own endpoint is never
reached, and the assertion fails. On a fresh database it passes every time.

**Which assertion caught it is the interesting part.** The test checks
`disabled >= 1` first, and that PASSED: the sweep had just disabled a hundred
endpoints belonging to nobody in particular. Only the assertion about *this*
endpoint could tell the difference between "the sweep works" and "the sweep did
something".

The five calls now pass an explicit limit large enough to reach the endpoint under
test whatever else is eligible.

### Two — the drain, found on run 2 of twenty

Chapter 3.7 ran the integration lane twenty times after its fix to show the change
caused no regression. Run 2 failed on a different test in the same file:

```text
FAIL  deliveries.itest.ts > the relay drains only what is due >
      invariant 10: a not-yet-due delivery holds no acknowledgement slot
AssertionError: expected null not to be null
```

The delivery was unambiguously due and had not been published.

`drainDueDeliveries` claims its batch `FOR UPDATE SKIP LOCKED`. When a suite in a
parallel vitest worker holds that row inside its own open transaction, this call
**skips** it and returns having done nothing about it — and a single call is then
indistinguishable from the relay declining to publish something due, which is
exactly the failure this test exists to report. Vitest runs `*.itest.ts` files in
parallel by default and `attempts.itest.ts` drains globally too.

The comment already sitting above the helper had the principle right — *assert the
property, not the observer; whoever claims the row, a due delivery ends up
dispatched* — and the implementation was one call short of it. The drain is now
retried until the row this suite owns has settled, bounded at ten passes. If the
property is genuinely false, nothing dispatches the row and the test fails with
the same message a second later.

**This is the third instance of the same disease in this file's neighbourhood.**
Chapter 3.6's `test-event.itest.ts` carries a long comment about the first: another
suite's global drain claimed its delivery, stamped `dispatched_at`, and discarded
it, so the route under test waited out ten seconds and reported `delivered: false`
for an endpoint that had answered 200. It passed alone and failed in the lane.

So does this one, and more rarely: once in twenty runs rather than most of them.
That is worse, not better. A suite that fails every time in the lane gets fixed
the day it lands; one that fails once in twenty gets blamed on the network.

**No chapter owns either of these.** 3.6 fenced the file and teaches auto-disable
and the attempt record, not the batch size of a test's sweep call or the locking
behaviour of a claim it does not describe. 3.7 is about the resume duplicate and
never mentions webhooks.

```diff title="services/api/src/webhooks/deliveries.itest.ts"
@@ -285,7 +285,37 @@ describe("the relay drains only what is due", () => {
    * observer. Whoever claims the row, a due delivery ends up dispatched and a
    * not-yet-due one does not. */
   const drainEverythingDue = async (): Promise<void> => {
-    await drainDueDeliveries(db, 500, async () => {});
+    await drainDueDeliveries(db, 50_000, async () => {});
+  };
+
+  /** The same drain, retried until a row this suite owns has settled.
+   *
+   * FOUND AT CHAPTER 3.7'S POST-FIX MEASUREMENT, on run 2 of 20: "expected null
+   * not to be null" for a delivery that was unambiguously due. The comment above
+   * had the principle right and the implementation one call short.
+   *
+   * `drainDueDeliveries` claims `FOR UPDATE SKIP LOCKED`. When a suite running in
+   * a parallel worker holds this row inside its own open transaction, this call
+   * SKIPS it and returns having done nothing about it — and one call is then
+   * indistinguishable from "the relay declined to publish a due delivery", which
+   * is the failure this test is meant to report. Draining again once the other
+   * transaction has ended finds the row either already dispatched by that suite
+   * or free to claim here. Either outcome satisfies the invariant; neither is
+   * visible to a single call.
+   *
+   * Bounded rather than open-ended: if the property is genuinely false the row is
+   * never dispatched and this fails after the budget with the same message, one
+   * second later. */
+  const drainUntilSettled = async (delivery: {
+    id: string;
+    event_id: string;
+  }): Promise<void> => {
+    for (let attempt = 0; attempt < 10; attempt++) {
+      await drainEverythingDue();
+      const rows = await repo.listDeliveriesForEvent(delivery.event_id);
+      if (rows.find((r) => r.id === delivery.id)?.dispatched_at !== null) return;
+      await new Promise((resolve) => setTimeout(resolve, 100));
+    }
   };
 
   const stateOf = async (delivery: { id: string; event_id: string }) => {
@@ -319,7 +349,7 @@ describe("the relay drains only what is due", () => {
   it("invariant 10: publishes a delivery that is due", async () => {
     const delivery = await seed();
 
-    await drainEverythingDue();
+    await drainUntilSettled(delivery);
 
     expect((await stateOf(delivery)).dispatched_at).not.toBeNull();
   });
@@ -361,7 +391,7 @@ describe("the relay drains only what is due", () => {
     }
 
     const healthy = await seed();
-    await drainEverythingDue();
+    await drainUntilSettled(healthy);
 
     expect((await stateOf(healthy)).dispatched_at).not.toBeNull();
     for (const s of sleeping) {
@@ -372,7 +402,7 @@ describe("the relay drains only what is due", () => {
   it("invariant 9: a claimed delivery is not claimed twice", async () => {
     const delivery = await seed();
 
-    await drainEverythingDue();
+    await drainUntilSettled(delivery);
     const first = await stateOf(delivery);
     await drainEverythingDue();
     const second = await stateOf(delivery);
@@ -400,7 +430,7 @@ describe("the relay drains only what is due", () => {
 
     // Tier 2 is one second out.
     await new Promise((resolve) => setTimeout(resolve, 1_500));
-    await drainEverythingDue();
+    await drainUntilSettled(delivery);
 
     expect((await stateOf(delivery)).dispatched_at).not.toBeNull();
   });
@@ -1131,7 +1161,17 @@ describe("the failure run", () => {
     // Still enabled: nothing has happened since, which is the whole point.
     expect((await runOf(endpoint.id)).enabled).toBe(true);
 
-    const disabled = await sweepDisabledEndpoints(db);
+    // A LIMIT BIG ENOUGH TO REACH THIS ENDPOINT. The sweep is global and takes the
+    // hundred oldest eligible endpoints; every earlier run of this suite leaves
+    // endpoints with an open failure run behind, and those are older than this
+    // one, so they fill the batch and this endpoint is never reached. The suite
+    // then fails on a shared database and passes on a fresh one.
+    //
+    // Found at chapter 3.7's baseline, after 781 endpoints had accumulated an open
+    // run. Note which assertion caught it: `disabled >= 1` PASSED, because the
+    // sweep had just disabled a hundred endpoints belonging to nobody. Only the
+    // assertion about THIS endpoint could tell the difference.
+    const disabled = await sweepDisabledEndpoints(db, 10_000);
     expect(disabled).toBeGreaterThanOrEqual(1);
 
     const after = await runOf(endpoint.id);
@@ -1160,9 +1200,9 @@ describe("the failure run", () => {
     await failTimes(scoped.id, scopedRepo, endpoint.id, 5, 503);
     await ageRun(endpoint.id, 64);
 
-    await sweepDisabledEndpoints(db);
-    await sweepDisabledEndpoints(db);
-    await sweepDisabledEndpoints(db);
+    await sweepDisabledEndpoints(db, 10_000);
+    await sweepDisabledEndpoints(db, 10_000);
+    await sweepDisabledEndpoints(db, 10_000);
 
     expect(await notificationsFor(endpoint.id)).toHaveLength(1);
   }, 120_000);
@@ -1179,7 +1219,7 @@ describe("the failure run", () => {
     // Inside the hour: five failures, but the window has not elapsed.
     await ageRun(recent.id, 30);
 
-    await sweepDisabledEndpoints(db);
+    await sweepDisabledEndpoints(db, 10_000);
 
     expect((await runOf(healthy.id)).enabled).toBe(true);
     expect((await runOf(recent.id)).enabled).toBe(true);
```
