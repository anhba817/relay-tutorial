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

### Three — two runtimes with no filter, forty lines from the fix (feature 030)

The amendment above scoped invariant 9's restarted runtime and left the test
immediately below it alone. That test constructs two runtimes sharing one durable,
publishes three events with `ENV()` called three times — the same detail that made
invariant 9 unfilterable — and polls them 400 times.

So both runtimes start at the head of the whole stream, and the 400 has to cover
every event earlier chapters left in it. It is the identical fault, in the
identical file, forty lines down, and chapter 3.7 fixed one and did not look at the
other.

It has never failed, which is the property of this class rather than a defence of
it: a fixed budget against a growing shared resource passes until the resource
outgrows the budget, and then it fails in whichever run happens to cross the line.
Invariant 9 crossed on run 11 of twenty. This one has not crossed yet.

The environments were incidental. What the test is about is two runtimes sharing
one durable, each message handled exactly once, and that is unchanged by publishing
the three events to one environment and filtering both runtimes to its subject.

Found by grepping for the class while the first instance was on screen, which is a
step feature 030 added to its own task list after chapter 3.7 recorded that fixing
an instance is not fixing a class.

```diff title="services/api/src/consumer/consumer.itest.ts"
@@ -351,16 +351,45 @@ describe("the consumer", () => {
     // broker provides here that `SKIP LOCKED` provides for the outbox.
     const durable = `${RUN}-shared-${Date.now()}`;
     const byA: string[] = [];
     const byB: string[] = [];
+    // ONE environment, and both runtimes filtered to it (feature 030, T032).
+    //
+    // This used to call `ENV()` three times and construct both runtimes with no
+    // filter, which is instance 3 exactly — the fault chapter 3.7 fixed forty lines
+    // down in this same file, in the test above this one. Three environments means
+    // no single subject covers them, and an unfiltered durable starts at the head
+    // of a stream holding every event earlier chapters left behind; the 400-pass
+    // budget below then has to drain all of it before reaching these three.
+    //
+    // It has never failed, which is the whole problem with the class: it passes
+    // until the stream outgrows the budget, and then it fails in whichever run
+    // happens to cross the line. Fixing an instance is not fixing a class
+    // (research R46).
+    //
+    // The environments were incidental. What this test is about is two runtimes
+    // sharing one durable, and that is unchanged.
+    const environmentId = ENV();
     const ids = [
-      await publish(ENV()),
-      await publish(ENV()),
-      await publish(ENV()),
+      await publish(environmentId),
+      await publish(environmentId),
+      await publish(environmentId),
     ];
 
-    const a = runtimeFor(db, durable, async (e) => void byA.push(e.id));
-    const b = runtimeFor(db, durable, async (e) => void byB.push(e.id));
+    const a = runtimeFor(
+      db,
+      durable,
+      async (e) => void byA.push(e.id),
+      silent,
+      environmentId,
+    );
+    const b = runtimeFor(
+      db,
+      durable,
+      async (e) => void byB.push(e.id),
+      silent,
+      environmentId,
+    );
     for (let i = 0; i < 400; i++) {
       await Promise.all([a.pollOnce(), b.pollOnce()]);
       if (ids.every((id) => byA.includes(id) || byB.includes(id))) break;
     }
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

**Extended by chapter 3.8**, and the extension is here rather than in that
chapter for the reason above: 3.8 teaches rate limiting, not how a credential
suite compares error bodies.

Two changes. The suite raises `RELAY_AUTH_FAILURES_PER_MINUTE` because it submits
bad credentials on purpose — that is what it is for — and it now takes its own
`RELAY_AUTH_KEY_PREFIX` as well. Raising the threshold is private to a vitest
worker; the Redis key is not, so a suite that raised only its ceiling pushed a
SHARED count to 8 while being personally immune to it. Measured across a full
lane at T004a.

And `request_id` on every error body broke the tenant-isolation assertion that
compares a foreign-credential response with a missing-resource response for
equality. The property is right — the two must be indistinguishable, or the error
enumerates what exists — so the comparison now strips the one field that
legitimately differs.

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
@@ -18,6 +18,23 @@ import {
 import { parseApiKeyCredential } from "./api-key";
 import { MAX_TOKEN_LIFETIME_SECONDS } from "./user-token";
 
+// Chapter 3.8 added `request_id` to every error body (constitution V's fourth
+// field, promised since 1.3). It is unique per request BY DESIGN, so two error
+// bodies can no longer be compared whole — and comparing them whole is how this
+// suite proves a foreign resource is indistinguishable from an absent one, which
+// is a tenant-isolation property (constitution I).
+//
+// The id is the one field that reveals nothing about the resource, so it is the
+// one field the comparison must drop. Everything discriminating still has to
+// match exactly.
+function withoutRequestId(body: unknown): unknown {
+  if (typeof body !== "object" || body === null) return body;
+  const rest: Record<string, unknown> = { ...(body as Record<string, unknown>) };
+  delete rest["request_id"];
+  return rest;
+}
+
+
 // The refusals, over real HTTP against the compose Postgres (chapter 3.2).
 // Invariants 1-7, 9 and 11 of contracts/credentials.md live here; 8 and 12 are
 // pure and live in the unit lane; 10 needs a socket and lives in the gateway's
@@ -86,6 +103,31 @@ describe("credentials", () => {
   };
 
   beforeAll(async () => {
+    // Chapter 3.8. This suite submits bad credentials ON PURPOSE — that is what
+    // it is for — and the failed-authentication limiter counts them all against
+    // one loopback address. The default is ten a minute.
+    //
+    // RAISING WORKS HOWEVER POLLUTED THE SHARED COUNT, which is why this is a
+    // threshold and not a private key: the integration lane runs files in
+    // parallel, every suite asserting a `401` lands in the same bucket, and a
+    // high ceiling never refuses. A suite needing a LOW threshold needs its own
+    // key instead — see `limits.itest.ts` (research R21).
+    //
+    // Explicit and visible, rather than the default being chosen to suit the
+    // tests. Chapter 3.6's `RELAY_DISABLE_SWEEP` states the rule: a flag whose
+    // default disabled a requirement would be a requirement nobody had built.
+    process.env["RELAY_AUTH_FAILURES_PER_MINUTE"] = "10000";
+    // AND ITS OWN BUCKET. Raising the threshold is private to this worker —
+    // vitest gives each file its own process — but the Redis key is not, so a
+    // suite that raises its ceiling and keeps the default prefix pushes a SHARED
+    // count up while being personally immune to it. T004a measured this file's
+    // contribution to the default bucket at 8 and signup's at 13, against a
+    // threshold of 10: nothing was refused, and only because the suites that
+    // spawn a child reach the api over `::ffff:127.0.0.1` while this one reaches
+    // it in-process over `::1`. Two address formats were the whole of the
+    // isolation. Now it is a prefix, which is a decision rather than an accident.
+    process.env["RELAY_AUTH_KEY_PREFIX"] =
+      `rlauth-credentials-${Date.now()}`;
     db = createDb(createPool());
 
     env = await createEnvironment(db, { name: "credentials-itest" });
@@ -178,7 +220,9 @@ describe("credentials", () => {
     );
     expect(foreignAnswer.status).toBe(404);
     expect(absentAnswer.status).toBe(404);
-    expect(await foreignAnswer.json()).toEqual(await absentAnswer.json());
+    expect(withoutRequestId(await foreignAnswer.json())).toEqual(
+      withoutRequestId(await absentAnswer.json()),
+    );
 
     // And the reverse direction, so the test cannot pass by both being broken.
     expect(
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


### Three — a delta over a global count still races (chapter 3.10 baseline)

The two amendments above scoped a sweep and a drain. This one is the same class in
its subtlest form yet, and the test's own comment defended it:

```text
// GLOBAL, and asserted as a delta for that reason — this is the number an
// operator watches, so it counts every tenant's backlog, and another suite
// seeding rows beside this one must not be able to break it.
```

A delta is two reads with a gap. Another suite **seeding** rows in that gap was
defended against; another suite **delivering** one of its own was not, and that
moves the second read by one more:

```text
FAIL src/webhooks/deliveries.itest.ts >
     counts what is pending and stops counting it once it is delivered
AssertionError: expected 22741 to be 22742
```

Found on the third of three lane runs at chapter 3.10's baseline, which is the
twelfth occurrence of this fault and the third whose defence was a comment saying
why this one was fine.

The global function keeps a caller, because `pendingDeliveryDepth` is the number
an operator watches and it needs one — it is now asked only what cannot race,
which is that a backlog exists. The delta is asserted against this environment's
own rows.

**No chapter owns this.** 3.7 fenced the two amendments above and is about the
resume duplicate; 3.10 is about quotas. A baseline fix belongs to whichever
chapter's baseline found it, and that chapter teaches something else.

```diff title="services/api/src/webhooks/deliveries.itest.ts"
@@ -660,19 +660,40 @@ describe("the material for one attempt", () => {
     expect(await deliveryMaterial(db, randomUUID())).toBeNull();
   });
 
   it("counts what is pending and stops counting it once it is delivered", async () => {
-    const { deliveryId } = await seedDelivery();
+    const { deliveryId, envId } = await seedDelivery();
 
-    // GLOBAL, and asserted as a delta for that reason — this is the number an
-    // operator watches, so it counts every tenant's backlog, and another suite
-    // seeding rows beside this one must not be able to break it.
-    const before = await pendingDeliveryDepth(db);
-    expect(before).toBeGreaterThan(0);
+    // THE DELTA USED TO BE ASSERTED ON THE GLOBAL COUNT, and the comment above it
+    // said a delta was safe because "another suite seeding rows beside this one
+    // must not be able to break it". It is not, and one did:
+    //
+    //   AssertionError: expected 22741 to be 22742
+    //
+    // A delta is two reads with a gap. Another suite delivering one of its own
+    // rows in that gap moves the second read by one more, and the assertion is a
+    // local fact about a global operation with an extra step — the twelfth
+    // occurrence of the fault this lane has been recording since chapter 3.3, and
+    // the third whose defence was a comment explaining why it was fine.
+    //
+    // The global function still has a caller, because it is the number an operator
+    // watches and it needs one. What it is asked is the part that cannot race:
+    // there is a backlog.
+    expect(await pendingDeliveryDepth(db)).toBeGreaterThan(0);
+
+    // The delta is asserted where it can be attributed — this environment, whose
+    // rows nobody else writes.
+    const pendingHere = async (): Promise<number> => {
+      const { rows } = (await db.execute(
+        `SELECT count(*)::int AS n FROM webhook_deliveries
+          WHERE environment_id = '${envId}' AND state = 'pending'`,
+      )) as unknown as { rows: { n: number }[] };
+      return rows[0]!.n;
+    };
 
+    expect(await pendingHere()).toBe(1);
     await recordAttemptOutcome(db, { deliveryId, attempt: 1, status: 200 });
-
-    expect(await pendingDeliveryDepth(db)).toBe(before - 1);
+    expect(await pendingHere()).toBe(0);
   });
 });
 
 // The answers nobody asks for on a good day.
```

---

## `services/api/src/tenancy/signup.itest.ts` — the global count chapter 3.3 already removed once (chapter 3.7)

Chapter 3.3 carries this fix-forward:

> Chapter 3.1's signup suite asserted that a failed provisioning left the
> *global* organisation count unchanged. That passed for two chapters and failed
> here with `expected 884 to be 883`, because 3.3's crash tests spawn child
> processes that provision tenants of their own while it runs. The count was
> never the evidence.

It removed the count from invariant 1. **The identical assertion at invariant 7,
about a hundred lines further down the same file, was not looked for.**

It failed during chapter 3.7's lane runs with `expected 9918 to be 9917` — the
same sentence, four chapters and nine thousand organisations later. The test
compared `count(*) FROM organisations` before and after a single credential-free
`fetch`, which in a lane running these files in parallel is the claim that nobody
anywhere signed up during that one request.

What replaces it is the property asserted where it can be attributed to this
call: the route refuses, and a request refused before it reaches a handler has
created nothing. The surrounding loop already made exactly that assertion for the
same path with `POST`.

**The lesson is not about counts.** Fixing an instance is not fixing a class, and
the cheapest moment to grep for the other instances is while the first one is
still on the screen. A chapter that writes "the count was never the evidence" and
then leaves a second count in the same file has diagnosed the disease and treated
a symptom. Every `count(*)` in every integration suite was checked after this one;
the remaining seven are all scoped to an environment, an endpoint or an account.

**No chapter owns this.** 3.1 wrote the assertion and 3.3 fenced the file last;
both are about tenancy and the outbox, not about which assertions survive a
parallel lane. 3.7 is about the resume duplicate.

**Extended by chapter 3.8** for the same reason as `credentials.itest.ts`: this
suite raises the failed-authentication threshold and now takes its own key prefix
too. Its contribution to the shared default bucket measured 13 against a threshold
of 10, and nothing was refused only because the suites that spawn a child reach
the api over `::ffff:127.0.0.1` while this one reaches it in-process over `::1`.
Two address formats were the whole of the isolation.

```diff title="services/api/src/tenancy/signup.itest.ts"
@@ -277,20 +277,25 @@ describe("signup", () => {
       const text = await res.text();
       expect(text).not.toContain("organisation");
     }
-    const before = await db.execute(
-      `SELECT count(*)::int AS n FROM organisations`,
-    );
-    // Chapter 3.2: there is no header left to forge here. The assertion is
+    // Chapter 3.2: there is no header left to forge here. The property is
     // unchanged — no route but signup creates a tenant — and a credential-free
     // internal call is now refused before it reaches a handler, which is a
     // stronger form of the same guarantee.
-    await fetch(`${url}/internal/memberships`);
-    const after = await db.execute(
-      `SELECT count(*)::int AS n FROM organisations`,
-    );
-    expect((after.rows[0] as { n: number }).n).toBe(
-      (before.rows[0] as { n: number }).n,
-    );
+    //
+    // THIS USED TO COMPARE `count(*) FROM organisations` BEFORE AND AFTER, and
+    // that assertion was not about this request. The count is global, every other
+    // suite in the lane signs organisations up while this runs, and vitest runs
+    // these files in parallel — so it asserted that nobody anywhere created a
+    // tenant during one `fetch`. Chapter 3.7's lane runs caught it at 9,917
+    // organisations: `expected 9918 to be 9917`.
+    //
+    // What is left is the property itself, asserted where it can be attributed to
+    // this call: the route refuses, and a request refused before it reaches a
+    // handler has created nothing. Same reasoning as `test-event.itest.ts`, which
+    // finds its own row rather than calling a global drain.
+    const refused = await fetch(`${url}/internal/memberships`);
+    expect(refused.status).not.toBe(200);
+    expect(await refused.text()).not.toContain("organisation");
   });
 
   it("refuses a callback whose state does not match the cookie (invariant 5, over HTTP)", async () => {
@@ -49,6 +49,26 @@ describe("signup", () => {
   let provider: Awaited<ReturnType<typeof standInProvider>>;
 
   beforeAll(async () => {
+    // Chapter 3.8 limited account creation per source address (FR-AUT-12), and this
+    // suite drives the signup routes repeatedly from one loopback address — which
+    // is what a suite about signup does.
+    //
+    // Raised explicitly and visibly, rather than the default being chosen to suit
+    // the tests. The same move `credentials.itest.ts` makes for the
+    // failed-authentication threshold, and for the same reason: raising survives a
+    // shared count, lowering does not (research R21).
+    process.env["RELAY_AUTH_FAILURES_PER_MINUTE"] = "10000";
+    // AND ITS OWN BUCKET. Raising the threshold is private to this worker —
+    // vitest gives each file its own process — but the Redis key is not, so a
+    // suite that raises its ceiling and keeps the default prefix pushes a SHARED
+    // count up while being personally immune to it. T004a measured this file's
+    // contribution to the default bucket at 8 and signup's at 13, against a
+    // threshold of 10: nothing was refused, and only because the suites that
+    // spawn a child reach the api over `::ffff:127.0.0.1` while this one reaches
+    // it in-process over `::1`. Two address formats were the whole of the
+    // isolation. Now it is a prefix, which is a decision rather than an accident.
+    process.env["RELAY_AUTH_KEY_PREFIX"] =
+      `rlauth-signup-${Date.now()}`;
     db = createDb(createPool());
     provider = await standInProvider({
       id: 90210,
```

---

## `services/dispatcher/src/dispatcher.itest.ts` — the sixth global drain (chapter 3.8 baseline)

Chapter 3.7's baseline found four tests asserting a local fact about a global
operation, and fixed `drainDueDeliveries` in `deliveries.itest.ts` twice: an
explicit limit for the sweep, and a settle loop for the drain. It never looked at
the dispatcher's suite, which reaches the same global drain through a different
door.

`publishDue()` builds a delivery relay and calls `drainOnce()` with no batch size,
so it takes `BATCH_SIZE = 50` — the fifty oldest due deliveries in the platform,
oldest first. This suite's own delivery is the newest. Once more than fifty
accumulate from earlier suites the batch fills before reaching it, `pollUntil`
times out at eight seconds, and the reader sees:

```text
FAIL  dispatcher.itest.ts > the dispatcher >
      invariant 7: delivers an event the endpoint subscribes to
AssertionError: expected 0 to be greater than 0
```

**Only in the coverage lane.** `vitest.coverage.config.mts` sets
`fileParallelism: false` — every suite in one process against one database — so
the dispatcher runs after everything else has filled the queue. The integration
lane runs packages separately and starts clean: three integration runs found
nothing, one coverage run in two did.

**And it reads as a flake because the failing run drains the backlog itself**, so
the next one passes. It returns whenever the queue rebuilds past fifty.

**No chapter owns this.** 3.5 fenced the file and teaches the dispatcher, not the
batch size of a test helper's drain call. 3.8 is about rate limiting and never
mentions webhook delivery.

**Extended by chapter 3.9.** The api child this suite spawns now runs a
notification relay, and a background loop marking rows delivered while another
suite asserts on that column is a race between test files rather than a property
of the system. Switched off here exactly as `RELAY_OUTBOX_RELAY` and
`RELAY_EVENT_CONSUMER` already were — the third instance of one rule.

```diff title="services/dispatcher/src/dispatcher.itest.ts"
@@ -264,6 +264,22 @@ describe("the dispatcher", () => {
         ensure: relay.ensureDeliveriesStream,
       }),
       logger: kit.createLogger("itest-relay"),
+      // A BATCH BIG ENOUGH TO REACH THIS TEST'S OWN DELIVERY. `drainOnce` is
+      // global: it takes the fifty oldest due deliveries in the platform,
+      // oldest first, and this suite's is the newest. Every earlier suite in the
+      // run leaves due deliveries behind, so once more than fifty of them
+      // accumulate the batch fills before reaching ours, the poll times out at
+      // eight seconds, and `expected 0 to be greater than 0` is what a reader
+      // sees.
+      //
+      // It only bites in the COVERAGE lane, where `fileParallelism: false` puts
+      // every suite in one process against one database. The failing run drains
+      // the backlog itself, so the next run passes — which is why it reads as a
+      // flake rather than as the threshold it is.
+      //
+      // Found at chapter 3.8's baseline. Chapter 3.7 fixed the same global drain
+      // in `deliveries.itest.ts` twice and never looked at this door.
+      batchSize: 10_000,
     });
     return r.drainOnce();
   };
@@ -108,6 +108,8 @@ function spawnApi(port: number, credential: string): ChildProcess {
       // Chapter 3.3's finding 4, for the third time: this suite drives the relay
       // explicitly, so a background copy draining the same table would race it.
       RELAY_OUTBOX_RELAY: "off",
+      // Chapter 3.8: nor the notification relay, for the same reason.
+      RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
       RELAY_DELIVERY_RELAY: "off",
     },
```

---

## `services/api/src/db/repository.ts` — two defaults that made forgetting silent (feature 030)

Six times between chapters 3.3 and 3.9, an integration test asserted a local fact
about a global operation, or performed one and damaged a neighbouring suite's
fixture. Feature 030 is the work that makes that fail deterministically, and this
is the smallest of its three parts: the admin functions in this file no longer
supply a value the caller forgot to think about.

`sweepDisabledEndpoints` was the last of the four batch-taking functions to carry
`limit = 100`. Requiring the argument would not have prevented any of the six —
the call that damaged a neighbour's fixture was `sweepDisabledEndpoints(db)`, and
`sweepDisabledEndpoints(db, 10_000)` reaches *further* into other people's rows.
It is a prompt to think about whose rows are in scope, and the comment says so
rather than claiming to be a control.

`drainDisableNotifications`'s `onError = () => {}` is the sharper one. It
discarded a row's failure with no log line, and no caller in the tree has ever
used it — `notification-relay.ts` is the only one and it has always passed a
handler. It was found as the file's last uncovered function: `repository.ts`
measured 98.7% functions against a ratchet of 100, and it had measured that
before this feature touched anything.

The block comment is the other half. Three separate documents asserted this file
held "five" batch-taking functions; the answer is four, and the count kept slipping
because the third category — functions that cross environments but take an id, so
they are bounded by construction — has no home in a sentence about batch sizes.
Whoever adds the next one reads this file, not a spec.

**No chapter owns this.** 2.4 fenced the file and 3.5, 3.6 and 3.8 extended it;
none of them is about the shape of a test lane, and a required parameter that
exists to make an integration suite think twice would be code those chapters never
mention.

```diff title="services/api/src/db/repository.ts"
@@ -415,9 +415,21 @@ export interface DisableNotificationRow {
 export async function drainDisableNotifications(
   db: Db,
   limit: number,
   deliver: (row: DisableNotificationRow) => Promise<void>,
-  onError: (row: DisableNotificationRow, error: unknown) => void = () => {},
+  /** REQUIRED, as of feature 030, and for a sharper reason than `limit`'s.
+   *
+   * It carried `= () => {}`, a default that DISCARDS a row's failure without a
+   * log line — the swallowed-refusal shape twice over (research R13, R39). No
+   * caller in the tree has ever used it: `notification-relay.ts` is the only one
+   * and it has always passed a handler. So the default was dead code that existed
+   * only to make forgetting the handler silent.
+   *
+   * It also had a second life as the file's last uncovered function, which is how
+   * it was found: `repository.ts` measures 98.7% functions against a ratchet of
+   * 100, and it measured that before this feature touched anything (research
+   * R47). */
+  onError: (row: DisableNotificationRow, error: unknown) => void,
 ): Promise<number> {
   return db.transaction(async (tx) => {
     const claimed = (await tx.execute(
       sql`SELECT n.id                AS "id",
@@ -1136,11 +1148,38 @@ export async function testDeliveryResult(
  * and not two implementations of it.
  *
  * Returns how many it disabled, so the relay can log a number rather than a claim.
  */
+/*
+ * THE FOUR CATEGORIES OF CROSS-ENVIRONMENT FUNCTION IN THIS FILE (feature 030). Three documents asserted there were five batch-taking functions; the
+ * answer is four, and the reason the count kept slipping is that the third
+ * category below has no home in a sentence about batch sizes:
+ *
+ *   1. TAKE A BATCH SIZE, and now all four REQUIRE one:
+ *      drainOutbox, drainDueDeliveries, drainDisableNotifications,
+ *      sweepDisabledEndpoints.
+ *   2. RETURN A GLOBAL COUNT and have nothing to bound: outboxDepth,
+ *      pendingDeliveryDepth. A count is one row; there is no batch to size. These
+ *      are restricted from tests by lint instead — a global count(*)
+ *      compared against itself is instance 4, twice in one file.
+ *   3. CROSS ENVIRONMENTS BUT TAKE AN ID, so they are bounded by construction:
+ *      recordAttemptOutcome, disableEndpoint. Nothing to require and nothing to
+ *      restrict.
+ *
+ * Whoever adds the next cross-environment function reads this file, not the spec.
+ */
 export async function sweepDisabledEndpoints(
   db: Db,
-  limit = 100,
+  /** REQUIRED, as of feature 030 — the last of the four to carry a default.
+   *
+   * This would not have prevented instance 6 (research R8). The call that damaged
+   * a neighbour's fixture was `sweepDisabledEndpoints(db)`, and
+   * `sweepDisabledEndpoints(db, 10_000)` is worse rather than better: a bigger
+   * batch reaches further into other people's rows. The required argument is a
+   * prompt to think about WHOSE rows are in scope. The control is the trigger in
+   * `packages/test-harness/src/sentinel.sql`, and a comment here claiming
+   * otherwise would teach the wrong lesson. */
+  limit: number,
 ): Promise<number> {
   // An INTERVAL built from the same constant the pure policy uses, so the sweep and
   // `shouldDisable` can never disagree about how long an hour is. Milliseconds
   // rather than a literal `'1 hour'`: one definition, in `disable.ts`.
```

---

## `services/api/src/webhooks/delivery-relay.ts` — the caller the compiler found (feature 030)

One line, and it is here because the amendment above created it. Removing
`sweepDisabledEndpoints`'s default broke exactly one production call site, which
is the whole return on the change: the compiler enumerated the callers so nobody
had to grep for them. The four call sites in `deliveries.itest.ts` already passed
`10_000`, chapter 3.7's fix for the first recorded instance.

```diff title="services/api/src/webhooks/delivery-relay.ts"
@@ -165,9 +165,10 @@ export function createDeliveryRelay({
    * every customer's webhooks. */
   async function sweepOnce(): Promise<number> {
     if (!sweepEnabled) return 0;
     try {
-      const disabled = await sweepDisabledEndpoints(db);
+      // The batch the default used to supply, now said out loud (feature 030).
+      const disabled = await sweepDisabledEndpoints(db, 100);
       if (disabled > 0) {
         // A COUNT, and only when it is not zero. This runs several times a second
         // when the platform is idle, and a line per pass would bury every other
         // line in the service.
```

---

## `eslint.config.mjs` — the global admin functions, restricted in tests (feature 030)

The rule this file already carried says isolation lives in data access: only the
repository layer may import `pg`, `drizzle-orm` or `ioredis`. This adds the same
idea one level up. Six functions in `repository.ts` operate across every
environment in the database, and every one of the six recorded instances imported
one of them into an `*.itest.ts` and called it as though the database held only
its own rows.

Two of the six are there for a different reason from the other four. `outboxDepth`
and `pendingDeliveryDepth` take no batch size and cannot — a count is one row —
and a global count compared against itself is the fourth recorded instance, which
appeared twice in one file four chapters apart. An earlier draft of the rule said
"every cross-environment function must require a batch size"; that was false of
these two, so they are restricted rather than fixed.

Both import spellings are entries, because `no-restricted-imports` matches the
specifier as written. `../db/repository` covers most of the api's suites and
`./repository` covers the two that live in `src/db` — measured by adding the
import to each and running eslint, not assumed.

The ignores list and `packages/test-harness/src/exempt.ts` name the same six
files, and a test in the harness compares them, because a file exempt from the
linter but not from the trigger is a trap for whoever adds the seventh.

The comment also records what the rule does not catch — an indirect call through a
helper, and raw SQL, both of which the trigger sees — and what neither catches: a
consumer runtime constructed without a subject filter rides the broker rather than
the database, and no import is wrong.

The `pg` ignores list grows by one. The harness IS data access: its job is to
plant rows the repository layer must never plant, and to hold a connection
carrying an exemption no product code may carry.

**No chapter owns this.** 2.5 fenced this file to introduce the driver
restriction; the chapters that followed added rules to it without discussing them.
This one is lane hygiene, which no chapter teaches.

```diff title="eslint.config.mjs"
@@ -36,8 +36,13 @@ export default tseslint.config(
       "services/api/src/limits/**",
       "services/gateway/src/limits.ts",
       "services/gateway/src/limits.itest.ts",
       "services/gateway/src/fanout.ts",
+      // Chapter 3.18. THE RULE'S REASON DOES NOT APPLY HERE, and that is the
+      // whole justification rather than a convenience. The restriction exists
+      // because rate-limit counters are keyed `rl:{environment_id}:…`, so an
+      // unrestricted client can read another tenant's counter. This client
+      // touches no keys: it calls PUBLISH and nothing else, onto
+      // `chan:{channel_id}` — a channel UUID, not an environment-scoped key —
+      // and a subject is not readable at all, only listened to by whoever is
+      // already subscribed. The gateway's `fanout.ts` is on this list one line
+      // up for the same reason; the api needs it too now that it publishes.
+      "services/api/src/fanout/**",
+      // The test harness IS data access — its whole job is to plant rows the
+      // repository layer must never plant and to hold a connection carrying an
+      // exemption no product code may carry (feature 030). Restricting it from
+      // `pg` would restrict it from existing.
+      "packages/test-harness/**",
     ],
     rules: {
       "no-restricted-imports": [
         "error",
@@ -69,5 +74,87 @@ export default tseslint.config(
         },
       ],
     },
   },
+  {
+    // THE GLOBAL ADMIN FUNCTIONS, RESTRICTED IN INTEGRATION TESTS (feature 030).
+    //
+    // Six recorded instances of one fault: a test asserts a local fact about a
+    // global operation, or performs one and damages a neighbour's fixture. Each
+    // one imported one of these functions into an `*.itest.ts` and called it as
+    // though the database held only its own rows.
+    //
+    // The two `*Depth` functions are here for a different reason from the other
+    // four. They take no batch size and cannot — a count has nothing to bound —
+    // and a global count compared against itself is instance 4, which appeared
+    // twice in one file four chapters apart. An earlier draft of this rule said
+    // "every cross-environment function must require a batch size"; that was
+    // false of these two, which is why they are restricted rather than fixed.
+    //
+    // WHAT THIS RULE DOES NOT CATCH, and must not be trusted to:
+    //   * an indirect call — a helper in another file that calls the function,
+    //     imported here under an innocent name;
+    //   * raw SQL — `UPDATE webhook_endpoints SET enabled = false` names no
+    //     import at all.
+    // Both are covered by the trigger in `packages/test-harness/src/sentinel.sql`,
+    // which watches statements rather than imports. A rule trusted further than
+    // it goes is worse than no rule (contracts/guard.md).
+    //
+    // AND WHAT NEITHER CATCHES: instance 3 rode the JetStream stream rather than
+    // the database — an unfiltered `createConsumerRuntime` in a test replays every
+    // event earlier chapters left behind, on a fixed budget of polls. No trigger
+    // sees that and no import is wrong; the subject filter is the property, and
+    // the call site is the only place to notice it (research R43).
+    files: ["**/*.itest.ts"],
+    ignores: [
+      // The suites that drive a global drain on purpose. THIS LIST AND
+      // `packages/test-harness/src/exempt.ts` MUST AGREE: a file exempt from one
+      // and not the other is a trap for whoever adds the seventh instance.
+      "services/api/src/outbox/outbox.itest.ts",
+      "services/api/src/webhooks/deliveries.itest.ts",
+      "services/api/src/webhooks/test-event.itest.ts",
+      "services/api/src/webhooks/attempts.itest.ts",
+      "services/api/src/notifications/notifications.itest.ts",
+      "services/dispatcher/src/dispatcher.itest.ts",
+    ],
+    rules: {
+      "no-restricted-imports": [
+        "error",
+        {
+          // BOTH SPELLINGS. `no-restricted-imports` matches the specifier as
+          // written, so `../db/repository` and `./repository` are two rules —
+          // and the second is the one `db/repository.itest.ts` and
+          // `db/history-drift.itest.ts` would use, both of them non-exempt.
+          // Measured by adding the import to each and running eslint.
+          paths: [
+            {
+              name: "../db/repository",
+              importNames: [
+                "drainOutbox",
+                "drainDueDeliveries",
+                "drainDisableNotifications",
+                "sweepDisabledEndpoints",
+                "outboxDepth",
+                "pendingDeliveryDepth",
+              ],
+              message:
+                "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+            },
+            {
+              name: "./repository",
+              importNames: [
+                "drainOutbox",
+                "drainDueDeliveries",
+                "drainDisableNotifications",
+                "sweepDisabledEndpoints",
+                "outboxDepth",
+                "pendingDeliveryDepth",
+              ],
+              message:
+                "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+            },
+          ],
+        },
+      ],
+    },
+  },
 );
```

---

## The four vitest configs — wiring the guard into every lane (feature 030)

Feature 030 installs a Postgres trigger that refuses any statement modifying a
sentinel row from a connection that does not carry an exemption, and plants bait
so that a test asserting on an unbounded global batch fails on the first run
against a clean database. Both arrive through two vitest hooks: a `globalSetup`
that migrates and then installs the trigger, and a `setupFiles` entry that sets
the exemption for files on the harness's list and, where the lane carries bait,
plants it per file.

**Every lane pointed at the database needs the hooks, not just the one that
installs them.** The trigger is database state and outlives whichever lane created
it, so a lane with no way to answer meets it and fails six suites for the right
reason and the wrong cause. The coverage lane is the sharp one: it runs every
`*.itest.ts` in a single process with `fileParallelism: false`, so it would meet
the trigger with no hook at all.

**Bait goes to the api lane only.** The gateway and e2e lanes hold no reader-shape
fault, and planting changes a suite's workload for no return. The dispatcher lane
was on the list until it was measured: 200 bait deliveries failed 10 of its 16
tests with the fault they were meant to catch already fixed, because that suite
waits eight seconds on a shared FIFO broker rather than on a query. Bait that
fails a suite whether or not the fault is present carries no information.

**The relay flags are the other half, and they are a correction.** Nine suites in
the api lane import `AppModule`, and each of the four relays defaults to on when
its flag is unset — so nine of seventeen files were running background loops that
sweep the whole database while every other suite's fixtures sat in it. A relay
catches and logs its own errors, so the guard's refusal inside one is a log line
and a green lane. Setting the flags in the config makes a quiet database a
property of the lane rather than a convention nobody had applied.

`services/dispatcher/vitest.integration.config.mts` gets the same treatment and no
amendment here, because no chapter fences it.

**No chapter owns any of this.** 2.1 introduced the integration lane, 2.6 and 2.8
added lanes of their own, and 3.1 added the coverage lane. None of them is about
what a shared database does to a suite that assumes it is alone.

```diff title="services/api/vitest.integration.config.mts"
@@ -6,7 +6,31 @@ import { defineConfig } from "vitest/config";
 // the compose Postgres. (.mts because this package compiles to CommonJS —
 // a .ts config would be loaded as CJS, which vitest refuses.)
 export default defineConfig({
   test: {
+    // Feature 030: the global-operation guard. `globalSetup` migrates and
+    // then installs the trigger once per lane; `setupFiles` sets the
+    // exemption for files on the harness's list and, where the lane carries
+    // bait, plants it per file.
+    globalSetup: ["../../packages/test-harness/src/global-setup.ts"],
+    setupFiles: ["../../packages/test-harness/src/setup.ts"],
+    // FEATURE 030, MEASURED: nine suites in this lane import `AppModule`, and none
+    // of them set a relay flag. Each relay defaults to on when its flag is unset
+    // (`process.env.RELAY_OUTBOX_RELAY ?? "on"`), so those nine booted four
+    // background loops that sweep the whole database while every other suite's
+    // fixtures sit in it. Research R13 recorded the exposure as nil on the strength
+    // of the four suites that spawn an api CHILD and set the flags in the child's
+    // env; it did not look at the suites that boot the app in process.
+    //
+    // A relay catches and logs its own errors, so the guard's refusal inside one is
+    // a log line and a green lane. Setting the flags here makes the quiet database
+    // a property of the lane rather than a convention nobody applied.
+    env: {
+      RELAY_HARNESS_BAIT: "on",
+      RELAY_OUTBOX_RELAY: "off",
+      RELAY_DELIVERY_RELAY: "off",
+      RELAY_NOTIFICATION_RELAY: "off",
+      RELAY_EVENT_CONSUMER: "off",
+    },
     include: ["src/**/*.itest.ts"],
   },
 });
```

```diff title="services/gateway/vitest.integration.config.mts"
@@ -5,7 +5,15 @@ import { defineConfig } from "vitest/config";
 // include, and this config is what `pnpm --filter @relay/gateway
 // test:integration` runs against the compose Redis.
 export default defineConfig({
   test: {
+    // Feature 030: the global-operation guard. `globalSetup` migrates and
+    // then installs the trigger once per lane; `setupFiles` sets the
+    // exemption for files on the harness's list and, where the lane carries
+    // bait, plants it per file. This lane gets exemption
+    // handling and NO bait: it holds no reader-shape fault, and planting
+    // would change its workload for no return (feature 030).
+    globalSetup: ["../../packages/test-harness/src/global-setup.ts"],
+    setupFiles: ["../../packages/test-harness/src/setup.ts"],
     include: ["src/**/*.itest.ts"],
   },
 });
```

```diff title="packages/e2e/vitest.integration.config.mts"
@@ -9,8 +9,16 @@ import { defineConfig } from "vitest/config";
 // The whole suite is one journey, and it boots real processes — so it gets
 // a real timeout, and it does not run its files in parallel.
 export default defineConfig({
   test: {
+    // Feature 030: the global-operation guard. `globalSetup` migrates and
+    // then installs the trigger once per lane; `setupFiles` sets the
+    // exemption for files on the harness's list and, where the lane carries
+    // bait, plants it per file. This lane gets exemption
+    // handling and NO bait: it holds no reader-shape fault, and planting
+    // would change its workload for no return (feature 030).
+    globalSetup: ["../../packages/test-harness/src/global-setup.ts"],
+    setupFiles: ["../../packages/test-harness/src/setup.ts"],
     include: ["src/**/*.itest.ts"],
     testTimeout: 60_000,
     hookTimeout: 60_000,
     fileParallelism: false,
```

```diff title="vitest.coverage.config.mts"
@@ -18,8 +18,33 @@ import swc from "unplugin-swc";
 // would silently resolve nothing. It is harmless for the packages that use no
 // decorators.
 export default defineConfig({
   test: {
+    // Feature 030: the global-operation guard. `globalSetup` migrates and
+    // then installs the trigger once per lane; `setupFiles` sets the
+    // exemption for files on the harness's list and, where the lane carries
+    // bait, plants it per file. This lane gets exemption
+    // handling and NO bait: it holds no reader-shape fault, and planting
+    // would change its workload for no return (feature 030).
+    globalSetup: ["./packages/test-harness/src/global-setup.ts"],
+    // FEATURE 030, MEASURED: nine suites in this lane import `AppModule`, and none
+    // of them set a relay flag. Each relay defaults to on when its flag is unset
+    // (`process.env.RELAY_OUTBOX_RELAY ?? "on"`), so those nine booted four
+    // background loops that sweep the whole database while every other suite's
+    // fixtures sit in it. Research R13 recorded the exposure as nil on the strength
+    // of the four suites that spawn an api CHILD and set the flags in the child's
+    // env; it did not look at the suites that boot the app in process.
+    //
+    // A relay catches and logs its own errors, so the guard's refusal inside one is
+    // a log line and a green lane. Setting the flags here makes the quiet database
+    // a property of the lane rather than a convention nobody applied.
+    env: {
+      RELAY_OUTBOX_RELAY: "off",
+      RELAY_DELIVERY_RELAY: "off",
+      RELAY_NOTIFICATION_RELAY: "off",
+      RELAY_EVENT_CONSUMER: "off",
+    },
+    setupFiles: ["./packages/test-harness/src/setup.ts"],
     include: [
       "packages/*/src/**/*.test.ts",
       "services/*/src/**/*.test.ts",
       "packages/*/src/**/*.itest.ts",
@@ -47,8 +72,12 @@ export default defineConfig({
         // not by asserting on it. Counting them measures how much of `main.ts`
         // a test happened to touch, which is not what "business logic" means.
         "**/main.ts",
         "**/*.module.ts",
+        // The lane's own scaffolding (feature 030). Same argument one step out:
+        // counting how much of the harness a test touched measures the harness,
+        // not the product.
+        "packages/test-harness/src/**",
       ],
       thresholds: {
         // Constitution VI, first clause: 70% of business logic. Set to what the
         // constitution says, not to what the code achieves — a threshold tuned
```

---

## `services/api/src/outbox/outbox.itest.ts` — instances 7 and 9, found by the bait (feature 030)

Two more of the same fault, in a file whose comments already explain the fault at
length. Both were found by the seeder on the first run it did, before any
deliberate reintroduction.

**Invariants 7 and 8 drove a global relay on a fixed budget.**
`drainUntilClear(relay, db, environmentId, passes = 20)` bounded the *driving* in
units of batches while the work is bounded by the whole table. Twenty passes of
the default batch move 2,000 rows; the seeder's bait alone is 3,400, so the loop
returned with this environment's rows untouched and a correctly scoped assertion
reported `expected 4 to be +0`. Invariant 8 was sharper still: `batchSize: 7`
made twenty passes a budget of 140 rows.

There is no right constant, which is the point. The relay is global and
oldest-first, so reaching this suite's rows means draining everything older than
them, and how much that is depends on who else is in the database. The loops now
stop on the only two conditions that mean anything — this environment is clear, or
a pass moved nothing — and each pass that moves rows reduces the backlog, so they
terminate.

**Invariant 7's deduplication assertion was global.** `publisher.sent` holds every
row the relay moved out of a table it drains for everybody, so
`expect(new Set(ids).size).toBe(ids.length)` asserted that no row anywhere in the
outbox is ever published twice by anyone — a claim about the platform dressed up as
a claim about three messages. It failed once in a full lane run,
`expected 3001 to be 4800`, and passed when the file ran alone: the recurring
fault's signature exactly. The sentence above the assertion — "every event this
environment produced" — was describing the scoped version all along, and the file
already used that idiom forty lines down.

**No chapter owns this.** 3.3 fenced the file and is about the outbox pattern; how
a test drives a global drain without asserting on other tenants' rows is not what
3.3 teaches.

```diff title="services/api/src/outbox/outbox.itest.ts"
@@ -177,9 +177,22 @@ describe("the outbox", () => {
     expect((await unpublishedFor(db, env.id)).length).toBe(0);
 
     // Every event this environment produced reached the destination with its
     // own id as the deduplication key.
-    const ids = publisher.sent.map((m) => m.id);
+    //
+    // SCOPED, and it was not (feature 030, instance 9). `publisher.sent` holds
+    // every row this relay moved out of a table it drains globally, so the
+    // unfiltered version asserted that no row anywhere in the outbox is ever
+    // published twice by anybody — which is a claim about the whole platform
+    // dressed up as a claim about three messages. It failed once in a full lane
+    // run, `expected 3001 to be 4800`, and passed when the file ran alone: the
+    // recurring fault's signature. The scoped idiom is the one this file already
+    // uses forty lines down, and the sentence above the assertion was describing
+    // it all along.
+    const ids = publisher.sent
+      .filter((m) => m.subject.endsWith(env.id))
+      .map((m) => m.id);
+    expect(ids.length).toBeGreaterThan(0);
     expect(new Set(ids).size).toBe(ids.length);
 
     // A second pass has nothing of OURS to do — marked rows are done.
     //
@@ -214,12 +227,20 @@ describe("the outbox", () => {
     const b = recordingPublisher();
     const relayA = createRelay({ db, publisher: a, logger: silent, batchSize: 7 });
     const relayB = createRelay({ db, publisher: b, logger: silent, batchSize: 7 });
 
-    // Run them at the same time, repeatedly, until the backlog is gone.
-    for (let pass = 0; pass < 20; pass++) {
+    // Run them at the same time, repeatedly, until THIS environment's backlog is
+    // gone. Same reader fix as `drainUntilClear`, and sharper here: `batchSize: 7`
+    // made twenty passes a budget of 140 rows, against a table holding thousands.
+    // The loop ends when our rows are done or when neither relay can move
+    // anything.
+    for (;;) {
       if ((await outboxDepthFor(db, env.id)) === 0) break;
-      await Promise.all([relayA.drainOnce(), relayB.drainOnce()]);
+      const [movedA, movedB] = await Promise.all([
+        relayA.drainOnce(),
+        relayB.drainOnce(),
+      ]);
+      if (movedA + movedB === 0) break;
     }
 
     expect(await outboxDepthFor(db, env.id)).toBe(0);
     const all = [...a.sent, ...b.sent].map((m) => m.id);
@@ -391,16 +412,35 @@ describe("the outbox", () => {
  * filled entirely by rows this suite did not write, and a test that assumes
  * otherwise passes alone and fails in a full lane. (It did exactly that here.)
  * Suites cannot isolate themselves by construction on this table the way 2.1's
  * per-suite environments let them everywhere else. */
+/*
+ * READER FIX (feature 030). The comment above was right about the table and wrong
+ * about the loop.
+ *
+ * `passes = 20` bounded the DRIVING in units of batches while the work is bounded
+ * by the whole table. Twenty passes of the default batch move 2,000 rows; the
+ * seeder's bait alone is 3,400, so the loop returned with this environment's rows
+ * untouched and the assertion below reported `expected 4 to be +0` — a correctly
+ * scoped read of a wrongly driven relay.
+ *
+ * There is no right constant here, which is the point: the relay is global and
+ * oldest-first, so reaching this suite's rows means draining everything older than
+ * them, and how much that is depends on who else is in the database. So the loop
+ * has no pass budget. It stops on the only two conditions that mean anything —
+ * this environment is clear, or a pass moved nothing and the relay is therefore
+ * done — and each pass that moves rows reduces the global backlog, so it
+ * terminates. `safety` exists to turn a hypothetical infinite loop into a failed
+ * test, and is derived from the work that actually exists rather than guessed.
+ */
 async function drainUntilClear(
   relay: { drainOnce: () => Promise<number> },
   db: Db,
   environmentId: string,
-  passes = 20,
 ): Promise<number> {
   let moved = 0;
-  for (let i = 0; i < passes; i++) {
+  const safety = (await outboxDepth(db)) + 100;
+  for (let i = 0; i < safety; i++) {
     if ((await outboxDepthFor(db, environmentId)) === 0) break;
     const drained = await relay.drainOnce();
     moved += drained;
     if (drained === 0) break;
```

---

## The quota relay's flag, and a harness method (chapter 3.10)

Chapter 3.10 adds the fourth relay in this codebase, and a relay needs a switch:
`RELAY_QUOTA_RELAY`, off in the lanes that want a quiet database, on everywhere
else. Same switch and same reasoning as the three before it — a background loop
marking rows delivered mid-assertion is a race between test files rather than a
property of the system, and feature 030's R39 found nine suites booting the whole
app with every relay defaulting on.

Three configs carry the other relay flags and now carry this one. `turbo.json`
declares the variable, because Turborepo runs in strict env mode and an
undeclared variable is invisible to the task that needs it.

`packages/e2e/src/harness.ts` gains `setQuota`, because the e2e lane may not
import `pg` — chapter 2.5's driver restriction, and this package is not on its
ignores list — so the one place allowed to write is the one place that does.

**No chapter owns any of it.** 3.10 teaches what a quota is and where it is
enforced; which lanes switch a background loop off, and how a test harness sets a
column, are hygiene it never discusses. A chapter may only fence a change it
explains.

```diff title="turbo.json"
@@ -37,9 +37,10 @@
         "RELAY_NATS_REPLICAS",
         "RELAY_E2E_API_PORT",
         "RELAY_SMTP_URL",
         "RELAY_MAILPIT_URL",
-        "RELAY_NOTIFICATION_RELAY"
+        "RELAY_NOTIFICATION_RELAY",
+        "RELAY_QUOTA_RELAY"
       ]
     },
     "//#lint:root": {
       "inputs": [
```

```diff title="services/api/vitest.integration.config.mts"
@@ -29,8 +29,10 @@ export default defineConfig({
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
+      // Chapter 3.10's relay, the fourth. Same reason as the other three.
+      RELAY_QUOTA_RELAY: "off",
     },
     include: ["src/**/*.itest.ts"],
   },
 });
```

```diff title="vitest.coverage.config.mts"
@@ -41,8 +41,10 @@ export default defineConfig({
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
+      // Chapter 3.10's relay, the fourth. Same reason as the other three.
+      RELAY_QUOTA_RELAY: "off",
     },
     setupFiles: ["./packages/test-harness/src/setup.ts"],
     include: [
       "packages/*/src/**/*.test.ts",
```

```diff title="packages/e2e/src/harness.ts"
@@ -288,8 +288,15 @@ export interface System {
     dispatcher: Client;
     tuan: Client;
   }>;
   seedForeignTenant: () => Promise<{ channel: string; text: string }>;
+  /** Set an environment's quota policy (chapter 3.10).
+   *
+   * Here rather than in the test, because `packages/e2e` may not import `pg` —
+   * the driver restriction chapter 2.5 added, and this package is not on its
+   * ignores list. The harness already holds the api's own database handle, so
+   * the one place that may write is the one place that does. */
+  setQuota: (environmentId: string, config: unknown) => Promise<void>;
   client: (name: string, environmentId: string) => Promise<Client>;
   stop: () => Promise<void>;
 }
 
@@ -486,8 +493,16 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
       await repo.sendMessage(channel.id, { text, userId: user.id });
       say(`seeded a foreign tenant (${other}) with one message`);
       return { channel: channel.id, text };
     },
+    async setQuota(environmentId, config) {
+      await (
+        db as { execute: (q: string) => Promise<unknown> }
+      ).execute(
+        `UPDATE environments SET quota_config = '${JSON.stringify(config)}'::jsonb
+          WHERE id = '${environmentId}'`,
+      );
+    },
     async client(name, environmentId) {
       return new Client(name, await token(environmentId, name), say);
     },
     async stop() {
```

## Chapter 3.11's neighbours

Four files chapter 3.11 changed and does not teach. The chapter's subject is
metering a duration from a service that cannot write; a coverage ratchet, a lint
list and two test fixtures are not that, and putting them on the page would show
a reader code the chapter never discusses.

- `vitest.coverage.config.mts` — three ratchet entries for the chapter's new
  files. The convention is chapter 3.6's and 3.8's; the numbers are measurements.
- `eslint.config.mjs` — `drainQuotaNotifications` joins the restricted family,
  where chapter 3.10 should have put it. The chapter mentions the guard and not
  the lint list.
- `services/api/src/auth/credentials.itest.ts` — a latent flake fixed forward.
  Invariant 1 took an api key's secret as `split("_").at(-1)`; base64url includes
  the separator, so once in a while the last segment is a single character the
  stored row contains by chance. Eleven chapters old, surfaced by chapter 3.11's
  twenty-run battery.
- `services/gateway/src/resume.itest.ts` — `boot` takes
  `Omit<ApiClient, "reportUsage">` so six stubs did not each grow a no-op.

```diff title="vitest.coverage.config.mts"
@@ -271,6 +271,46 @@ export default defineConfig({
           lines: 100,
           statements: 100,
         },
+
+        // CHAPTER 3.11's three, pinned at what they measure, with a reason each.
+        //
+        // `credit.ts` is here at 100 on everything and has no excuse not to be:
+        // two functions, no clock, no store, no framework, and between them they
+        // ARE the report protocol — a replay credits nothing, a lost report is
+        // repaid by the next, a late one lowers nothing. An unmeasured branch
+        // there is a hole in the thing the chapter is about.
+        //
+        // `usage.controller.ts` reached 100 second. It measured 88.88 / 50 with
+        // the 409 tested and the RETHROW beside it untested, which is the branch
+        // that separates "this connection moved tenants" from "something else
+        // broke". Swallowing the second as the first turns a broken caller into a
+        // conflict nobody investigates; the test that closed it reports usage for
+        // an environment that does not exist.
+        //
+        // `meter.ts` is 93.75 on branches and NOT 100, and the shortfall is
+        // named rather than chased: the remaining arm is the retention cap's
+        // `!closedEntries.has(key)` guard for a duplicate key arriving exactly at
+        // the ceiling. Reaching it needs four thousand closed connections and a
+        // repeat among them, which is a fixture that would take longer to read
+        // than the branch is worth.
+        "services/api/src/quotas/credit.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/internal/usage.controller.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/gateway/src/meter.ts": {
+          branches: 93,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
       },
     },
   },
```

```diff title="eslint.config.mjs"
@@ -123,24 +123,37 @@ export default tseslint.config(
           // BOTH SPELLINGS. `no-restricted-imports` matches the specifier as
           // written, so `../db/repository` and `./repository` are two rules —
           // and the second is the one `db/repository.itest.ts` and
           // `db/history-drift.itest.ts` would use, both of them non-exempt.
           // Measured by adding the import to each and running eslint.
           paths: [
             {
               name: "../db/repository",
               importNames: [
                 "drainOutbox",
                 "drainDueDeliveries",
                 "drainDisableNotifications",
+                // Chapter 3.11 added this one, and chapter 3.10 should have.
+                // `drainQuotaNotifications` claims undelivered rows across every
+                // environment, exactly as its three siblings above do, and 3.10
+                // listed it in neither this rule nor `exempt.ts` — whose comment
+                // says the two MUST AGREE.
+                //
+                // SAY WHAT THIS DOES NOT BUY. It protects a future DIRECT
+                // importer. It does not protect the suites that already drive the
+                // drain, because they reach it through `createQuotaRelay`, and
+                // the note above is explicit that an indirect call is what this
+                // rule cannot see. Scoping those assertions to rows the test
+                // created is the half that works.
+                "drainQuotaNotifications",
                 "sweepDisabledEndpoints",
                 "outboxDepth",
                 "pendingDeliveryDepth",
               ],
               message:
                 "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
             },
             {
               name: "./repository",
               importNames: [
                 "drainOutbox",
                 "drainDueDeliveries",
```

```diff title="services/api/src/auth/credentials.itest.ts"
@@ -16,6 +16,7 @@ import {
   revokeApiKey,
 } from "../db/repository";
 import { parseApiKeyCredential } from "./api-key";
+import { resolvePrincipal } from "./authenticate.middleware";
 import { MAX_TOKEN_LIFETIME_SECONDS } from "./user-token";
 
 // Chapter 3.8 added `request_id` to every error body (constitution V's fourth
@@ -164,7 +165,22 @@ describe("credentials", () => {
       environmentId: env.id,
       name: "once",
     });
-    const secret = minted.credential.split("_").at(-1)!;
+    // THE SECRET IS EVERYTHING AFTER THE PUBLIC ID, and it is not
+    // `split("_").at(-1)`. `api-key.ts` says why three lines from its own regex:
+    // "the public id is hex when the secret is base64url … base64url's alphabet
+    // INCLUDES the separator". So the secret contains underscores, and taking the
+    // last segment yields whatever happens to follow the final one — occasionally
+    // a single character, which the row below then contains by chance:
+    //
+    //     AssertionError: expected '[{"public_id":"9e5240d…' not to contain 'A'
+    //
+    // Latent since chapter 3.1 and found by chapter 3.11's twenty-run battery on
+    // the gate run after it. Parsed with the same shape the production code
+    // parses (`CREDENTIAL` in `api-key.ts`) rather than a guess about delimiters.
+    const secret = /^rk_(?:dev|live)_[0-9a-f]{32}_(.+)$/.exec(
+      minted.credential,
+    )![1]!;
+    expect(secret.length).toBeGreaterThan(20);
 
     // Nothing in the row it left behind contains what was returned. Read with
     // a plain string rather than drizzle's `sql` helper: the query engine lives
@@ -424,3 +440,64 @@ describe("credentials", () => {
       expect(JSON.stringify(body)).not.toContain(PLATFORM);
     });
   });
+
+  // --- chapter 3.11: one credential per service ---------------------------
+
+  describe("which service presented it", () => {
+    // SET, not read, for the reason the block above gives.
+    const DISPATCHER = "rk_svc_credentials_itest_0123456789abcdef01234";
+    const GATEWAY = "rk_svc_gateway_itest_fedcba98765432100fedcba9";
+    process.env["RELAY_INTERNAL_CREDENTIAL"] = DISPATCHER;
+    process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"] = GATEWAY;
+
+    it("names the dispatcher for the dispatcher's secret", async () => {
+      expect(await resolvePrincipal(db, DISPATCHER)).toEqual({
+        kind: "platform",
+        service: "dispatcher",
+      });
+    });
+
+    it("names the GATEWAY for the gateway's secret", async () => {
+      // Until this chapter `resolvePlatformCredential` ended with a hardcoded
+      // `service: "dispatcher"`, which was true while there was one caller and
+      // became a lie the moment there were two. `PlatformPrincipal.service` is
+      // documented as "which internal service presented it, for logs".
+      expect(await resolvePrincipal(db, GATEWAY)).toEqual({
+        kind: "platform",
+        service: "gateway",
+      });
+    });
+
+    it("gives neither service the other's reach", async () => {
+      // The property beyond honest logs: the gateway terminates public traffic
+      // and the dispatcher does not, so one shared secret would let the more
+      // exposed service set the blast radius for both.
+      expect(DISPATCHER).not.toBe(GATEWAY);
+      const swapped = await resolvePrincipal(db, GATEWAY);
+      expect(swapped).not.toBeNull();
+      expect((swapped as { service: string }).service).not.toBe("dispatcher");
+    });
+
+    it("refuses a secret shorter than 32 characters, per service", async () => {
+      // A short secret is a misconfiguration, and the safe reading of one is
+      // "this service cannot authenticate" rather than "this service is open".
+      const short = "rk_svc_tooshort";
+      process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"] = short;
+      expect(await resolvePrincipal(db, short)).toBeNull();
+      process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"] = GATEWAY;
+    });
+
+    it("makes an unconfigured service unusable rather than universal", async () => {
+      delete process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"];
+      expect(await resolvePrincipal(db, GATEWAY)).toBeNull();
+      // The dispatcher is untouched by its neighbour's absence.
+      expect(await resolvePrincipal(db, DISPATCHER)).not.toBeNull();
+      process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"] = GATEWAY;
+    });
+
+    it("refuses a well-formed secret that matches nobody", async () => {
+      expect(
+        await resolvePrincipal(db, "rk_svc_nobodys_secret_0000000000000000000"),
+      ).toBeNull();
+    });
+  });
```

```diff title="services/gateway/src/resume.itest.ts"
@@ -56,20 +56,29 @@ interface Harness {
   close: () => Promise<void>;
 }
 
-async function boot(api: ApiClient): Promise<Harness> {
+/** Chapter 3.11 widened `ApiClient` with `reportUsage`, and every stub in this
+ * file is about resume rather than metering — so the method is supplied here
+ * once instead of six times, and the `Omit` says which half these tests speak
+ * to. */
+async function boot(api: Omit<ApiClient, "reportUsage">): Promise<Harness> {
   const fanout = createFanout({ url, logger: silent });
   const server: Server = serve({
     service: "gateway",
     health: () => ({}),
     logger: silent,
   });
-  const sessions = attachSessions({ server, api, logger: silent, fanout });
+  const sessions = attachSessions({
+    server,
+    api: { ...api, reportUsage: async () => null },
+    logger: silent,
+    fanout,
+  });
   await new Promise<void>((resolve) => server.listen(0, resolve));
   const { port } = server.address() as AddressInfo;
   return {
     url: `ws://127.0.0.1:${port}/v1/ws`,
     close: async () => {
-      sessions.close();
+      await sessions.close();
       await fanout.close();
       await new Promise<void>((resolve) => server.close(() => resolve()));
     },
```

---

## `eslint.config.mjs` — the ban that was not in force (chapter 3.13)

Chapter 3.13 explains this change; the amendment lands here because this file's
chain does. Feature 030's block for `**/*.itest.ts` lives in this file, and a
chapter cannot amend a state that a later file builds.

`no-restricted-imports` is one rule, and in flat config a later block **replaces**
an earlier block's setting for it rather than merging. Feature 030's entry above
added a block keyed on `**/*.itest.ts` — and in doing so switched off the driver,
engine and Redis ban for every integration test in the workspace. Measured before
anything changed:

```
$ npx eslint services/api/src/quotas/period.itest.ts
$ echo $?
0
```

while that file's first line is `import { and, eq } from "drizzle-orm";` and it is
on no exemption list. Ten integration tests import one of the three; all ten passed.

The fix is three blocks rather than two, because the two exemption lists are
different files and a block has one `ignores`: one block carries the union for every
integration test needing neither exemption, and one block per list carries the other
set. The seal on `packages/outsider` is last in the file for the same reason, and it
was written before the itest blocks on its first draft — which is this same fault, a
second time, in the same chapter.

```diff title="eslint.config.mjs"
@@ -2,6 +2,139 @@ import eslint from "@eslint/js";
 import globals from "globals";
 import tseslint from "typescript-eslint";
 
+// ── THE TWO RESTRICTION SETS, NAMED SO THEY CAN BE COMBINED ──────────────────
+//
+// `no-restricted-imports` is one rule, and in flat config a later block REPLACES
+// an earlier block's setting for it rather than merging. That is the bug chapter
+// 3.12 found (R23, FR-043): a second block for `**/*.itest.ts` carrying feature
+// 030's global-drain restriction switched the driver-and-engine ban OFF for every
+// integration test in the workspace. Measured — `npx eslint
+// services/api/src/quotas/period.itest.ts` exited 0 while that file imports
+// `drizzle-orm` and is on no exemption list.
+//
+// So the sets live here as data and each block below composes the union it needs.
+// Three blocks rather than two, because the two exemption lists are different
+// files and a single block can only have one `ignores`.
+//
+// WHAT THIS RULE DOES NOT BUY, and it is the same boundary feature 030 drew for
+// its own half: it sees an IMPORT. A test that reaches raw SQL through a helper in
+// another file, or through the repository's own `db` handle, names none of these
+// specifiers and is invisible to it. `packages/test-harness/src/sentinel.sql`
+// watches statements instead, which is why both exist.
+const DRIVER_AND_ENGINE = {
+  paths: [
+    {
+      name: "pg",
+      message:
+        "Raw database access is forbidden outside services/api/src/db (constitution I).",
+    },
+    {
+      name: "drizzle-orm",
+      message:
+        "The query engine lives inside the repository layer only (constitution I, ADR-16).",
+    },
+    {
+      name: "ioredis",
+      message:
+        "The counter store lives in services/api/src/limits and services/gateway/src/limits.ts only (constitution I, chapter 3.8). Its keys are per environment; an unrestricted client is a cross-tenant read.",
+    },
+  ],
+  patterns: [
+    {
+      group: ["drizzle-orm/*"],
+      message:
+        "The query engine lives inside the repository layer only (constitution I, ADR-16).",
+    },
+  ],
+};
+
+// The files that legitimately need the driver or the engine in an integration
+// test — a LIST WITH REASONS, not a directory pattern, by the doctrine
+// `exempt.ts` states. `services/api/src/isolation/**` is deliberately ABSENT:
+// its suites read through the repository and through `db/catalogue.ts`, written
+// to this constraint rather than around it, which is the point of restoring the
+// rule in the chapter that adds them.
+const DRIVER_EXEMPT_TESTS = [
+  // The repository layer's own suites — the layer under test IS the query layer.
+  "services/api/src/db/repository.itest.ts",
+  "services/api/src/db/history-drift.itest.ts",
+  // The harness IS data access (see the note on `packages/test-harness/**`).
+  "packages/test-harness/src/guard.itest.ts",
+  // Redis, read with neither service's code, which is the whole subject: the api
+  // and the gateway must increment the SAME key.
+  "services/api/src/limits/limits.itest.ts",
+  "services/gateway/src/limits.itest.ts",
+  // The quota suites drive period rollover and connection accounting by writing
+  // rows no repository method writes — a period boundary in the past, a
+  // connection open across a rollover.
+  "services/api/src/quotas/quotas.itest.ts",
+  "services/api/src/quotas/period.itest.ts",
+  "services/api/src/quotas/connections.itest.ts",
+  // Chapter 3.17. THE SUBJECT IS A ROW NO REPOSITORY METHOD CAN WRITE ANY MORE, which
+  // is the same reason the three quota suites are here. `sendMessage` requires a sender
+  // as of FR-MSG-15, so a senderless message — 121,250 of them exist in the lane, and
+  // any deployment older than chapter 3.17 has them — can only be planted by hand. The
+  // arms that read one (history's `user: null`, the resume's drop) have no other fixture.
+  //
+  // Exempted explicitly rather than reached through a helper in another file: the note
+  // at the top of this rule says a helper would make the SQL invisible to it, and an
+  // invisible exemption is worse than a listed one.
+  "services/api/src/internal/backfill.itest.ts",
+  // Chapter 3.18. THE SAME ARGUMENT AS THE TWO LIMITS SUITES: its subject is what
+  // reaches the fabric, and the only way to check that is to subscribe with
+  // neither the api's publisher nor the gateway's `createFanout`. A spy on either
+  // would prove that an object was asked to publish, not that a frame arrived —
+  // and the isolation gauntlet cannot cover this path at all, because its oracle
+  // compares response bodies and a publish is a second output channel.
+  "services/api/src/fanout/fanout.itest.ts",
+  "services/api/src/messages/history.itest.ts",
+];
+
+
+// Feature 030's global-admin functions, and the suites whose SUBJECT is the global
+// drain. THIS LIST AND `packages/test-harness/src/exempt.ts` MUST AGREE: a file
+// exempt from one and not the other is a trap for whoever adds the seventh
+// instance.
+const DRAIN_EXEMPT_TESTS = [
+  "services/api/src/outbox/outbox.itest.ts",
+  "services/api/src/webhooks/deliveries.itest.ts",
+  "services/api/src/webhooks/test-event.itest.ts",
+  "services/api/src/webhooks/attempts.itest.ts",
+  "services/api/src/notifications/notifications.itest.ts",
+  "services/dispatcher/src/dispatcher.itest.ts",
+];
+
+const GLOBAL_DRAINS = {
+  // BOTH SPELLINGS. `no-restricted-imports` matches the specifier as
+  // written, so `../db/repository` and `./repository` are two rules —
+  // and the second is the one `db/repository.itest.ts` and
+  // `db/history-drift.itest.ts` would use, both of them non-exempt.
+  // Measured by adding the import to each and running eslint.
+  paths: [
+    {
+      name: "../db/repository",
+      importNames: [
+        "drainOutbox",
+        "drainDueDeliveries",
+        "drainDisableNotifications",
+        // Chapter 3.11 added this one, and chapter 3.10 should have.
+        // `drainQuotaNotifications` claims undelivered rows across every
+        // environment, exactly as its three siblings above do, and 3.10
+        // listed it in neither this rule nor `exempt.ts` — whose comment
+        // says the two MUST AGREE.
+        //
+        // SAY WHAT THIS DOES NOT BUY. It protects a future DIRECT
+        // importer. It does not protect the suites that already drive the
+        // drain, because they reach it through `createQuotaRelay`, and
+        // the note above is explicit that an indirect call is what this
+        // rule cannot see. Scoping those assertions to rows the test
+        // created is the half that works.
+        "drainQuotaNotifications",
+        "sweepDisabledEndpoints",
+        "outboxDepth",
+        "pendingDeliveryDepth",
+      ],
+      message:
+        "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+    },
+    {
+      name: "./repository",
+      importNames: [
+        "drainOutbox",
+        "drainDueDeliveries",
+        "drainDisableNotifications",
+        "sweepDisabledEndpoints",
+        "outboxDepth",
+        "pendingDeliveryDepth",
+      ],
+      message:
+        "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+    },
+  ],
+};
+
 // One lint config for the whole workspace (ADR-01's consequence made literal).
 export default tseslint.config(
   { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] },
@@ -26,10 +159,18 @@ export default tseslint.config(
     // layer; the gateway holds its own client in `services/gateway/src/limits.ts`
     // and for fan-out in `fanout.ts`.
     //
-    // `limits.itest.ts` is the one TEST allowed a raw client, and for a reason
-    // the rule cannot express: its whole subject is that the api and the gateway
-    // increment the SAME key, and the only way to check that is to read the key
-    // with neither of their code.
+    // The tests allowed a raw client are named in `DRIVER_EXEMPT_TESTS` above, and
+    // `services/gateway/src/limits.itest.ts` is one of them for a reason the rule
+    // cannot express: its whole subject is that the api and the gateway increment
+    // the SAME key, and the only way to check that is to read the key with neither
+    // of their code.
+    //
+    // CORRECTED IN 3.12 (T069c). This comment used to say it was "the one TEST
+    // allowed a raw client". Every test was allowed one, and had been since the
+    // `**/*.itest.ts` block below was added — that block replaced this rule rather
+    // than adding to it, which is the whole of R23. Its `ignores` entry here has
+    // been redundant for exactly as long and stays only because this block also
+    // covers the file as plain `**/*.ts`.
     files: ["**/*.ts"],
     ignores: [
       "services/api/src/db/**",
@@ -44,35 +185,7 @@ export default tseslint.config(
       "packages/test-harness/**",
     ],
     rules: {
-      "no-restricted-imports": [
-        "error",
-        {
-          paths: [
-            {
-              name: "pg",
-              message:
-                "Raw database access is forbidden outside services/api/src/db (constitution I).",
-            },
-            {
-              name: "drizzle-orm",
-              message:
-                "The query engine lives inside the repository layer only (constitution I, ADR-16).",
-            },
-            {
-              name: "ioredis",
-              message:
-                "The counter store lives in services/api/src/limits and services/gateway/src/limits.ts only (constitution I, chapter 3.8). Its keys are per environment; an unrestricted client is a cross-tenant read.",
-            },
-          ],
-          patterns: [
-            {
-              group: ["drizzle-orm/*"],
-              message:
-                "The query engine lives inside the repository layer only (constitution I, ADR-16).",
-            },
-          ],
-        },
-      ],
+      "no-restricted-imports": ["error", DRIVER_AND_ENGINE],
     },
   },
   {
@@ -90,84 +203,143 @@ export default tseslint.config(
     // "every cross-environment function must require a batch size"; that was
     // false of these two, which is why they are restricted rather than fixed.
     //
-    // WHAT THIS RULE DOES NOT CATCH, and must not be trusted to:
-    //   * an indirect call — a helper in another file that calls the function,
-    //     imported here under an innocent name;
-    //   * raw SQL — `UPDATE webhook_endpoints SET enabled = false` names no
-    //     import at all.
-    // Both are covered by the trigger in `packages/test-harness/src/sentinel.sql`,
-    // which watches statements rather than imports. A rule trusted further than
-    // it goes is worse than no rule (contracts/guard.md).
+    // AND WHAT NEITHER THIS NOR THE TRIGGER CATCHES: instance 3 rode the
+    // JetStream stream rather than the database — an unfiltered
+    // `createConsumerRuntime` in a test replays every event earlier chapters left
+    // behind, on a fixed budget of polls. No trigger sees that and no import is
+    // wrong; the subject filter is the property, and the call site is the only
+    // place to notice it (research R43).
     //
-    // AND WHAT NEITHER CATCHES: instance 3 rode the JetStream stream rather than
-    // the database — an unfiltered `createConsumerRuntime` in a test replays every
-    // event earlier chapters left behind, on a fixed budget of polls. No trigger
-    // sees that and no import is wrong; the subject filter is the property, and
-    // the call site is the only place to notice it (research R43).
+    // THREE BLOCKS, and the shape is the fix rather than a tidying (R23, FR-043).
+    // This block carries the UNION for every integration test that needs neither
+    // exemption. The two below carry one set each, for the two exemption lists —
+    // because a block has one `ignores` and the lists are different files, so a
+    // single block would have had to exempt both sets from both rules.
     files: ["**/*.itest.ts"],
-    ignores: [
-      // The suites that drive a global drain on purpose. THIS LIST AND
-      // `packages/test-harness/src/exempt.ts` MUST AGREE: a file exempt from one
-      // and not the other is a trap for whoever adds the seventh instance.
-      "services/api/src/outbox/outbox.itest.ts",
-      "services/api/src/webhooks/deliveries.itest.ts",
-      "services/api/src/webhooks/test-event.itest.ts",
-      "services/api/src/webhooks/attempts.itest.ts",
-      "services/api/src/notifications/notifications.itest.ts",
-      "services/dispatcher/src/dispatcher.itest.ts",
-    ],
+    ignores: [...DRAIN_EXEMPT_TESTS, ...DRIVER_EXEMPT_TESTS],
     rules: {
       "no-restricted-imports": [
         "error",
         {
-          // BOTH SPELLINGS. `no-restricted-imports` matches the specifier as
-          // written, so `../db/repository` and `./repository` are two rules —
-          // and the second is the one `db/repository.itest.ts` and
-          // `db/history-drift.itest.ts` would use, both of them non-exempt.
-          // Measured by adding the import to each and running eslint.
-          paths: [
+          paths: [...DRIVER_AND_ENGINE.paths, ...GLOBAL_DRAINS.paths],
+          patterns: DRIVER_AND_ENGINE.patterns,
+        },
+      ],
+    },
+  },
+  {
+    // The driver-exempt suites still get the drain restriction. Reading raw SQL
+    // is why they are on that list; draining every environment's rows is not.
+    files: DRIVER_EXEMPT_TESTS,
+    rules: {
+      "no-restricted-imports": ["error", GLOBAL_DRAINS],
+    },
+  },
+  {
+    // And the drain-exempt suites still get the driver ban. Their subject is the
+    // global drain, which says nothing about whether they may hold a raw client.
+    files: DRAIN_EXEMPT_TESTS,
+    rules: {
+      "no-restricted-imports": ["error", DRIVER_AND_ENGINE],
+    },
+  },
+  {
+    // THE SEAL ON `packages/outsider` (chapter 3.14, FR-030, FR-034, R12).
+    //
+    // That package holds one suite that behaves like a customer, and the claim it
+    // makes — an integration built from published documentation alone — is worth
+    // nothing if the suite can read the platform's source. So the claim is made
+    // mechanical, in three levels, and this block is levels 2 and 3.
+    //
+    // LEVEL 1 IS NOT A RULE AT ALL. `packages/outsider/package.json` declares no
+    // `@relay/*` dependency, and pnpm's isolated `node_modules` means there is no
+    // `@relay` directory at the workspace root — so
+    // `import { ERROR_CODES } from "@relay/protocol"` fails to RESOLVE. Nothing
+    // lints it; the module is not there.
+    //
+    // LEVEL 2 is the import rule below: a specifier that climbs out of the package
+    // by a relative or absolute path is refused. That closes the obvious way round
+    // level 1, which is to spell the same import as `../protocol/src/codes.js`.
+    //
+    // LEVEL 3 is the syntax rule, and an import rule cannot reach it.
+    // `packages/e2e/src/harness.ts:31` builds `join(HERE, "..", "..", "..")` and
+    // spawns the api's build output from it — a STRING, not an import specifier, so
+    // `no-restricted-imports` never sees it. The file cited as proof the hole
+    // exists is also proof the import rule does not close it. So `".."` as a
+    // literal is banned here, and so is `createRequire`, which is the other way to
+    // turn a computed path into a module.
+    //
+    // WHAT NONE OF THE THREE CLOSES, and three rules must not be left to imply a
+    // fourth: reading the repository's source with human eyes. Whoever writes that
+    // suite can open `codes.ts` in an editor, and no configuration can stop them.
+    // The seals make workspace code unIMPORTABLE; not reading it is a discipline,
+    // and the chapter says so in those words rather than presenting three rules as
+    // if they were four (FR-034).
+    // LAST IN THE FILE, AND THAT IS THE FIX RATHER THAN A TIDYING. This block sat
+    // BEFORE the `**/*.itest.ts` blocks on its first draft, and the outsider's only
+    // file is `integrate.itest.ts` — so a later block set `no-restricted-imports`
+    // again and the seal was not in force. `npx eslint` on a file importing
+    // `@relay/protocol` reported NOTHING.
+    //
+    // That is R23's fault a second time, in the same chapter, in code written by
+    // whoever had just finished fixing the first instance. One rule name, one
+    // winner: the last matching block. So this one is last, and it carries the
+    // union it needs — the driver and engine ban included, because `pg` DOES
+    // resolve here by the ordinary parent walk even though `@relay/*` does not.
+    //
+    // `no-restricted-syntax` survived the first draft only because no other block
+    // sets it. Level 3 worked by luck, which is not a property to rely on.
+    files: ["packages/outsider/**/*.ts", "packages/outsider/**/*.mts"],
+    rules: {
+      "no-restricted-imports": [
+        "error",
+        {
+          paths: DRIVER_AND_ENGINE.paths,
+          patterns: [
+            ...DRIVER_AND_ENGINE.patterns,
             {
-              name: "../db/repository",
-              importNames: [
-                "drainOutbox",
-                "drainDueDeliveries",
-                "drainDisableNotifications",
-                // Chapter 3.11 added this one, and chapter 3.10 should have.
-                // `drainQuotaNotifications` claims undelivered rows across every
-                // environment, exactly as its three siblings above do, and 3.10
-                // listed it in neither this rule nor `exempt.ts` — whose comment
-                // says the two MUST AGREE.
-                //
-                // SAY WHAT THIS DOES NOT BUY. It protects a future DIRECT
-                // importer. It does not protect the suites that already drive the
-                // drain, because they reach it through `createQuotaRelay`, and
-                // the note above is explicit that an indirect call is what this
-                // rule cannot see. Scoping those assertions to rows the test
-                // created is the half that works.
-                "drainQuotaNotifications",
-                "sweepDisabledEndpoints",
-                "outboxDepth",
-                "pendingDeliveryDepth",
-              ],
+              group: ["@relay/*"],
               message:
-                "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+                "packages/outsider integrates from published documentation alone. It may not import workspace code — see the three levels in eslint.config.mjs.",
             },
             {
-              name: "./repository",
-              importNames: [
-                "drainOutbox",
-                "drainDueDeliveries",
-                "drainDisableNotifications",
-                "sweepDisabledEndpoints",
-                "outboxDepth",
-                "pendingDeliveryDepth",
-              ],
+              // NOT `/*` as a third entry here: minimatch matched `vitest/config`
+              // with it, and a rule that refuses the test runner is a rule
+              // somebody turns off. Absolute paths are covered by the syntax
+              // selector below, which matches on the specifier itself.
+              group: ["../*", "../../*"],
               message:
-                "This function operates across every environment in the database, and an integration test shares that database with every other suite. Assert on the rows this test created — read them back by id, or scope the count to your own environment_id — instead of on what a global batch happened to contain. If this suite's subject IS the global drain, add it to packages/test-harness/src/exempt.ts with a reason, and to the ignores list beside this rule.",
+                "packages/outsider may not reach outside itself. A relative path out of the package is the same import by another spelling.",
             },
           ],
         },
       ],
+      "no-restricted-syntax": [
+        "error",
+        {
+          selector: "Literal[value='..']",
+          message:
+            "packages/outsider may not build a path out of the package. `join(HERE, \"..\", …)` is how packages/e2e reaches the api's build output, and an import rule cannot see it.",
+        },
+        {
+          selector: "CallExpression[callee.name='createRequire']",
+          message:
+            "createRequire turns a computed path into a module, which is the escape the import rule cannot see.",
+        },
+        {
+          selector: "ImportDeclaration[source.value='node:module']",
+          message:
+            "node:module is only useful here for createRequire, which is banned above.",
+        },
+        {
+          // An absolute path is the third spelling of the same import. Matched on
+          // the specifier rather than by glob, because the glob for it also
+          // matched `vitest/config`.
+          selector: "ImportDeclaration[source.value=/^\\//]",
+          message:
+            "packages/outsider may not import by absolute path. See the three levels in eslint.config.mjs.",
+        },
+      ],
     },
   },
 );
```

---

## Chapter 3.14's neighbours

Chapter 3.14 explains all three of these; the amendments land here because these
files' chains do. Each already carries an entry above, so a chapter cannot amend the
state those entries build.

`turbo.json` gains four variables. `RELAY_DOCS_BASE_URL` lets a preview deployment
point `docs_url` at itself; the other three are what the sealed integration reads,
and it has no workspace constant to fall back on by design. Under turbo's strict env
mode an undeclared variable does not reach the task at all — the live proof is
`RELAY_LIMITS_ITEST_API_PORT`, absent from that list and therefore unusable, which is
why a fixed 4124 was the only port that ever ran.

`package.json` splits the lane. `pnpm test:integration` excludes the sealed package
and `pnpm test:outsider` is the way in: the default lane spawns what it talks to,
while that suite needs the api and gateway already serving from built images with a
tenant already seeded.

`resume.itest.ts` gains one line, because `serve()`'s `notFoundDocsUrl` became
required and the compiler named every call site.

```diff title="turbo.json"
@@ -15,7 +15,8 @@
     },
     "test": {
       "dependsOn": ["^build"],
-      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/compose.yaml"]
+      "inputs": ["$TURBO_DEFAULT$", "$TURBO_ROOT$/compose.yaml"],
+      "env": ["RELAY_DOCS_BASE_URL"]
     },
     "test:integration": {
       "dependsOn": ["^build", "build"],
@@ -41,7 +42,11 @@
         "RELAY_SMTP_URL",
         "RELAY_MAILPIT_URL",
         "RELAY_NOTIFICATION_RELAY",
-        "RELAY_QUOTA_RELAY"
+        "RELAY_QUOTA_RELAY",
+        "RELAY_DOCS_BASE_URL",
+        "RELAY_API_URL",
+        "RELAY_WS_URL",
+        "RELAY_DEMO_CREDENTIAL"
       ]
     },
     "//#lint:root": {
```

```diff title="package.json"
@@ -12,7 +12,8 @@
     "lint:root": "eslint .",
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
-    "test:integration": "turbo run test:integration --concurrency=1",
+    "test:integration": "turbo run test:integration --concurrency=1 --filter=!@relay/outsider",
+    "test:outsider": "turbo run test:integration --filter=@relay/outsider",
     "coverage": "vitest run --config vitest.coverage.config.mts --coverage",
     "build": "turbo run build"
   },
```

```diff title="services/gateway/src/resume.itest.ts"
@@ -1,3 +1,4 @@
+import { docsUrl } from "@relay/protocol";
 import { randomUUID } from "node:crypto";
 
 import { WebSocket } from "ws";
@@ -66,6 +67,7 @@ async function boot(api: Omit<ApiClient, "reportUsage">): Promise<Harness> {
     service: "gateway",
     health: () => ({}),
     logger: silent,
+    notFoundDocsUrl: docsUrl("not_found"),
   });
   const sessions = attachSessions({
     server,
```


## One lane learned an exclusion and the other did not (chapter 3.15)

`packages/outsider` is chapter 3.14's sealed integration: it drives a running stack
through the public API and the socket, and without `RELAY_API_URL`, `RELAY_WS_URL` and
`RELAY_DEMO_CREDENTIAL` it throws on purpose and prints the five commands that would
satisfy it.

Chapter 3.12 split the lanes so `pnpm test:integration` is
`turbo run test:integration --concurrency=1 --filter=!@relay/outsider`. **The exclusion
went into the script and not into this config**, so `pnpm coverage` — which sets none of
those variables — ran the suite and failed on it every time: eight tests skipped, one
failed suite, on every coverage run from the day 3.14 shipped.

No chapter owns the fix. 3.14's subject is the seal and the error registry, and it made
the same argument the other way round: the outsider is excluded from the integration
lane *because* it needs a stack nobody in that lane starts. Coverage needs the same
sentence and got it a feature late.

```diff title="vitest.coverage.config.mts"
@@ -55,7 +55,23 @@
     // The e2e journey spawns real services and is excluded on purpose: it
     // measures the system, not any file's branches, and its child processes'
     // coverage is not attributable here anyway.
-    exclude: ["**/node_modules/**", "packages/e2e/**"],
+    //
+    // AND `packages/outsider` FOR A DIFFERENT REASON, added in chapter 3.15's Phase 1.
+    // That suite integrates against a platform it does not start: without
+    // RELAY_API_URL, RELAY_WS_URL and RELAY_DEMO_CREDENTIAL it throws on purpose and
+    // prints the five commands that would satisfy it. `pnpm coverage` sets none of
+    // them, so it failed every coverage run — 8 tests skipped, one failed suite.
+    //
+    // Chapter 3.12 split the lanes so `pnpm test:integration` is
+    // `turbo run test:integration --filter=!@relay/outsider`, and the exclusion went
+    // into the script and NOT into this config. One lane learned it and the other did
+    // not. `pnpm test:outsider` is the way in, and the CI `outsider` job is where it
+    // runs with its stack.
+    exclude: [
+      "**/node_modules/**",
+      "packages/e2e/**",
+      "packages/outsider/**",
+    ],
     // Suites in one process would share a database in ways their authors did
     // not design for — 3.3's outbox suite learned that the hard way.
     fileParallelism: false,
```

---

## `eslint.config.mjs` — presence's ioredis exemption (chapter 3.19)

**A chapter teaches this one and cannot fence it**, which no entry here has had to say
before. Chapter 3.19 quotes these lines and argues about them: presence opens a Redis
client, `ioredis` is a restricted import under constitution I, and the exemption's
justification is the interesting part — the fan-out's entry one line up is justified by
*"this client touches no keys"*, and presence's client touches keys. It borrows the
limiter's justification instead.

So why is the hunk here. The state `eslint.config.mjs` reaches after every chapter has run
is **73 lines**; the repository's is 386. The two restriction sets and all three ignore
lists were added by the entries above, which apply *after* the last chapter. The line this
amendment adds goes into an ignore list that does not exist yet at the moment a chapter
could fence it — a hunk anchored on `"services/api/src/fanout/**",` matches **zero** times
in the pre-3.19 chapter state, because an entry above is what puts that line there.

The chapter shows the same lines as an excerpt and says where they really live. When Part 6
folds these amendments into a CI chapter, this one folds with them.

```diff title="eslint.config.mjs"
@@ -88,6 +88,15 @@ const DRIVER_EXEMPT_TESTS = [
   // compares response bodies and a publish is a second output channel.
   "services/api/src/fanout/fanout.itest.ts",
   "services/api/src/messages/history.itest.ts",
+  // Chapter 3.19, and it is 3.18's argument in the other direction. The presence
+  // fabric's receive half has two rejection paths — a body that is not JSON, and a
+  // body that is JSON and not a transition — and neither can be reached through
+  // `createPresence`, which only ever publishes payloads its own schema produced.
+  // Putting arbitrary bytes on `presence:{channel_id}` needs a client that belongs to
+  // neither module, exactly as checking what reaches `chan:{id}` did.
+  //
+  // A `publish` and nothing else: this file reads no key and composes none.
+  "services/gateway/src/presence.itest.ts",
+  // Chapter 3.20's, for that same reason and on THIS list rather than the `**/*.ts`
+  // block's `ignores` — which is where it was written first, and where an `.itest.ts`
+  // entry does nothing. The `**/*.itest.ts` block below REPLACES the rule for every
+  // integration test not on one of these two lists, so an exemption above it is
+  // overwritten in silence. This file's header states that hazard (R23, FR-043) and
+  // the entry still went to the wrong list.
+  //
+  // The membership fabric's receive half has the same two rejection paths presence's
+  // has — a body that is not JSON, and JSON the schema refuses — and neither is
+  // reachable through `createMembership`, which only delivers what it already
+  // accepted. A `publish` and nothing else: no key read, no key composed.
+  "services/gateway/src/membership.itest.ts",
+  // Chapter 3.21, and the same case as the two above: the assertion is on Redis,
+  // read with neither service's code. A publish count taken through this
+  // chapter's own module would be satisfied by a module that does nothing —
+  // chapter 3.18's warning, in a new place.
+  "services/gateway/src/typing.itest.ts",
 ];
 
 
@@ -206,6 +215,19 @@ export default tseslint.config(
       // already subscribed. The gateway's `fanout.ts` is on this list one line
       // up for the same reason; the api needs it too now that it publishes.
       "services/api/src/fanout/**",
+      // Chapter 3.20, AND IT IS THE ENTRY ABOVE'S CASE RATHER THAN THE LIMITER'S.
+      // The membership publisher calls PUBLISH and nothing else, onto
+      // `member:{channel_id}` and `member:{env}:{user}` — a subject is not
+      // readable at all, only listened to by whoever is already subscribed, so
+      // there is no key here for a cross-tenant read to reach.
+      //
+      // The SECOND of those subjects carries an environment id, which is the
+      // shape the restriction guards, and it still does not make this the
+      // limiter's case: the id is composed from the repository's own scope on
+      // the way out, never read from a payload on the way in. The gateway's half
+      // of this fabric IS the limiter's case, and its entry says so.
+      "services/api/src/membership/**",
+      // Chapter 3.19. THIS IS `limits.ts`'s CASE, NOT `fanout.ts`'s, and the
+      // distinction is the rule's own reason. The entry above is justified by
+      // "this client touches no keys" — a publish onto a channel UUID, and a
+      // subject is not readable at all. Presence's client touches keys and they
+      // are environment-scoped: `presence:{env}:{user}`, exactly the shape the
+      // restriction exists to guard.
+      //
+      // So the justification is the limiter's instead: it composes every key from
+      // the environment id on the authenticated connection's own identity, and it
+      // reads no key it did not compose. There is no path here that takes an
+      // environment id from a client, and no scan, `KEYS` or pattern read that
+      // could reach a key belonging to another tenant.
+      "services/gateway/src/presence.ts",
+      // Chapter 3.20, AND IT IS THE FAN-OUT'S CASE RATHER THAN PRESENCE'S — the
+      // opposite of what the entry above had to argue. This client SUBSCRIBES and
+      // nothing else: no `SET`, no `EXISTS`, no key of any kind, because the
+      // module's only command-shaped work is an HTTP re-read against the api.
+      //
+      // One of its two subject shapes carries an environment id
+      // (`member:{env}:{user}`) and that still does not make it presence's case: a
+      // subject is not readable, only listened to by whoever already subscribed, and
+      // the id is composed from the authenticated connection's own identity on the
+      // way in. There is no path here that takes an environment id from a payload.
+      "services/gateway/src/membership.ts",
+      // Chapter 3.21, AND IT IS THE FAN-OUT'S CASE — the cleanest of the four, and
+      // the only one of them that both publishes and subscribes. This client calls
+      // PUBLISH and SUBSCRIBE and nothing else, onto `typing:{channel_id}` — a
+      // channel UUID, not an environment-scoped key — and a subject is not readable
+      // at all, only listened to by whoever is already subscribed.
+      //
+      // No environment id appears in the subject, so this entry does not even need
+      // the argument the two above had to make. The environment travels INSIDE the
+      // payload, where a receiving gateway checks it against the connection it is
+      // about to act on; it is never composed into a key, because this module
+      // composes no keys.
+      //
+      // THE `.itest.ts` FILE IS NOT LISTED HERE. Chapter 3.20 put an `.itest.ts`
+      // entry in this block's `ignores` and the later `**/*.itest.ts` block
+      // silently overrode it. The typing suite's exemption lives in
+      // `DRIVER_EXEMPT_TESTS` instead, which is the list that governs test files.
+      "services/gateway/src/typing.ts",
       // The test harness IS data access — its whole job is to plant rows the
       // repository layer must never plant and to hold a connection carrying an
       // exemption no product code may carry (feature 030). Restricting it from
```

---

## `vitest.coverage.config.mts` — chapter 3.19's two presence pins

The same reason as the entry above, one file over: chapter 3.19 argues about these
numbers and cannot fence the file. `vitest.coverage.config.mts` is fenced by chapter
3.18 and amended three times here, so a chapter's hunk would have to be written against
a state the chapters never reach.

The pins are 100 on every metric for both `presence.ts` files, and NFR-MNT-02's MUST is
why — presence keys are `presence:{env}:{user}`, which makes them tenant-isolation code.
The comment records what it cost: six arms had never executed, one of them behind a test
whose title claimed it, and one branch was deleted rather than covered.

```diff title="vitest.coverage.config.mts"
@@ -551,6 +551,54 @@ export default defineConfig({
           lines: 100,
           statements: 100,
         },
+
+        // CHAPTER 3.19's two, both at 100 on every metric, and the pin is
+        // NFR-MNT-02's MUST rather than a preference: presence keys are
+        // `presence:{env}:{user}`, so this is tenant-isolation code and the clause
+        // asks 100% of its branches.
+        //
+        // `packages/protocol/src/presence.ts` reached it on the first run — two
+        // exports, no clock, no client, and `presence.test.ts` covers both.
+        //
+        // `services/gateway/src/presence.ts` measured **91.52 / 81.81 / 93.93 /
+        // 92.92** with all 31 integration tests and 8 unit tests green, and closing
+        // it is the whole argument for a ratchet. Six arms had never executed:
+        //
+        //   the JSON.parse catch            a body that is not JSON
+        //   the safeParse rejection         JSON that is not a transition
+        //   the refresh re-election         the key lost under a live connection
+        //   `counts.get(c) ?? 1`            unsubscribe for a channel never subscribed
+        //   the no-op `deliver`             a transition with no handler registered
+        //   the pending-timer clear         close() while a grace check is armed
+        //
+        // ONE OF THEM HAD A TEST WHOSE TITLE CLAIMED IT. "logs
+        // presence.invalid_payload for a payload that is not a transition" asserted
+        // `toEqual([])` — it publishes a MESSAGE on a MESSAGE subject and checks
+        // presence never sees it, which is FR-029 from the other side and a good
+        // test under the wrong name. Both rejection arms read zero while it was
+        // green. It is renamed; the real ones publish onto `presence:{channel_id}`
+        // with a client belonging to neither module.
+        //
+        // AND ONE BRANCH WAS DELETED RATHER THAN COVERED, which is the fourth time
+        // this ratchet has done that. The re-election's `if (wonTransition(won))`
+        // guard around clearing the offline marker is reachable only when two
+        // instances race the same re-election — a test that could only flake. The
+        // marker is now cleared unconditionally, which is also more correct: unlike
+        // `connected`, nothing publishes here, so a loser that skipped the delete
+        // left a stale "somebody already said they left" standing against a user who
+        // is demonstrably connected.
+        "packages/protocol/src/presence.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/gateway/src/presence.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+
+        // ── CHAPTER 3.20'S FOUR NEW PRODUCTION FILES ───────────────────────
+        //
+        // All four at 100 on every metric, and the pin is NFR-MNT-02's MUST rather
+        // than a preference: membership decides who may hear what, so this is
+        // tenant-isolation code and the clause asks 100% of its branches.
+        //
+        // THREE REACHED IT ON THE FIRST RUN, and the reason is worth keeping. The
+        // phase that built the gateway module listed its arms BEFORE writing them —
+        // the `JSON.parse` catch, the `safeParse` rejection, an unsubscribe for a
+        // channel never subscribed, a change arriving before `onChange` is wired,
+        // `close()` with a timer armed, and a construction taking both defaults —
+        // and drove each with a test in that phase. Chapter 3.19 met its equivalents
+        // at close-out instead and paid for it with seven tests, a deleted branch and
+        // a re-measured battery.
+        //
+        // `memberships.controller.ts` did NOT reach it: 28.57% statements and 0%
+        // branches on the first run, for a route the gateway's suite exercises end to
+        // end. That suite runs in another package, and this is where the api's
+        // coverage is measured — **a route can be thoroughly tested and completely
+        // uncovered**. Four tests in `internal.itest.ts` fixed the measurement, and
+        // its last unreachable branch — a `principal?.kind !== "user"` throw the
+        // guard makes impossible — moved into the signature's type.
+        "packages/protocol/src/membership.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/membership/publisher.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/internal/memberships.controller.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/gateway/src/membership.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
       },
     },
   },
```
