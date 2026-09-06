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

```diff title="vitest.coverage.config.mts"
@@ -646,6 +646,37 @@ export default defineConfig({
           lines: 100,
           statements: 100,
         },
+        // CHAPTER 3.21. `packages/protocol/src/typing.ts` reached 100 on the
+        // first run — one function and no branches, which is what a subject
+        // builder and a schema are.
+        //
+        // `services/gateway/src/typing.ts` did NOT: **97.77 / 76.92 / 92.3 /
+        // 97.67**, with four arms unreached. T097 asks whether unreachable code
+        // should be deleted before it asks for a test, and the answer here was no
+        // — all four were reachable and nothing had reached them:
+        //
+        //   the url default        every test supplies a url or the env var does
+        //   the `onSignal` no-op   every test wires a handler through the session
+        //   `counts.get(c) ?? 0`   a SECOND subscribe for one channel
+        //   `next <= 0`'s else     one of two holders releasing
+        //
+        // The last two are the reference count, and they are the arms that decide
+        // whether a second member of a channel silently loses typing when the
+        // first disconnects. A gateway cannot reach them: the session layer holds
+        // one connection per socket. So they are driven against the module
+        // directly, in a describe that builds `createTyping` itself.
+        "packages/protocol/src/typing.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/gateway/src/typing.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
       },
     },
   },
```

## `eslint.config.mjs` — the cap's exemption, and a fifth reason (chapter 3.22)

**The same wall chapter 3.19 hit, in the same place, for the same measured reason.** The
state `eslint.config.mjs` reaches after every chapter has run is still 73 lines;
`DRIVER_EXEMPT_TESTS` is not one of them. A hunk anchored on `"services/gateway/src/typing.itest.ts",`
matches **zero** times in the post-chapter state, because an entry above is what puts that
line there. So chapter 3.22 shows these lines as an excerpt and says where they really live.

The exemption itself is worth reading rather than skimming. The four entries above it are all
one argument — a raw client is the only way to see what reached the fabric, because a spy on
the publisher proves that an object was asked to publish. **The fifth is a different
argument**: `connections.itest.ts` uses its raw client as the STIMULUS rather than the oracle.
It plants a rival in a slot key, or deletes one, to put the registry into a state the
production code cannot be asked to produce — and then asserts through a real socket.

The second hunk adds the module to the production block, which is the list of files allowed
to construct an `ioredis` client at all.

```diff title="eslint.config.mjs"
@@ -114,6 +114,14 @@ const DRIVER_EXEMPT_TESTS = [
   // chapter's own module would be satisfied by a module that does nothing —
   // chapter 3.18's warning, in a new place.
   "services/gateway/src/typing.itest.ts",
+  // Chapter 3.22, and NOT for the reason the four above give. This file needs no
+  // raw client to assert a publish — its subject is delivery, and it asserts on
+  // the sockets. It needs one to CAUSE a membership change: `Membership` exposes
+  // `onChange`, `subscribeChannel` and `watch` and no `publish`, because the api
+  // publishes and the gateway only ever subscribes. So the raw client is the
+  // stimulus rather than the oracle, which is a fifth reason this rule cannot
+  // express and the reason it is listed here explicitly.
+  "services/gateway/src/connections.itest.ts",
 ];
 
 
@@ -285,6 +293,18 @@ export default tseslint.config(
       // silently overrode it. The typing suite's exemption lives in
       // `DRIVER_EXEMPT_TESTS` instead, which is the list that governs test files.
       "services/gateway/src/typing.ts",
+      // Chapter 3.22's connection registry, and its keys are the strongest case on
+      // this list rather than the weakest. `conn:{env}:{user}:{slot}` puts the
+      // environment FIRST, so Principle I is structural in the key itself: a
+      // cross-tenant read would need a caller to hand this module another
+      // environment's id, which the session layer takes from the api's verified
+      // identity and never from a payload.
+      //
+      // The `.itest.ts` file is NOT listed here, for the reason the typing note
+      // above gives: the later `**/*.itest.ts` block would silently override it.
+      // Its exemption is in `DRIVER_EXEMPT_TESTS`, and so is `connections.test.ts`'s
+      // — a unit test, but one that reads the module's own source from disk.
+      "services/gateway/src/connections.ts",
       // The test harness IS data access — its whole job is to plant rows the
       // repository layer must never plant and to hold a connection carrying an
       // exemption no product code may carry (feature 030). Restricting it from
```

## `vitest.coverage.config.mts` — chapter 3.22's connections pin

The ratchet's per-file entry for `services/gateway/src/connections.ts`, at 100 on all
four metrics. It belongs here for the reason every entry above it does: the file is
lane configuration, not something a chapter walks a reader through, and the chapter
that adds a pin discusses the module rather than the config.

**It took three deletions and one test.** The first measurement read 96.15 / 82.60 /
100 / 97.67, and three of the four uncovered arms were arms nothing could take — a
second "could not ask" path that needed Redis to die between two commands, a
re-wrapping of outcomes that already meant the same thing, and an `instanceof Error`
ternary whose other half no test can reach. The fourth was a real gap: the `url`
default and the `??` inside it, neither reachable while the lane sets
`RELAY_REDIS_URL`.

```diff title="vitest.coverage.config.mts"
@@ -671,6 +671,30 @@ export default defineConfig({
           lines: 100,
           statements: 100,
         },
+        // CHAPTER 3.22. `services/gateway/src/connections.ts` at 100 on all four,
+        // and it took three deletions to get there rather than three tests. The
+        // first measurement read **96.15 / 82.60 / 100 / 97.67** with four arms
+        // uncovered, and three of them were arms nothing could take:
+        //
+        //   two `failable` wrappers in the walk   the second "could not ask" arm
+        //                                         needs Redis to die BETWEEN two
+        //                                         commands — merged into one
+        //   `renew` re-wrapping the walk's        `full` and `unenforced` mean the
+        //   outcomes                              same here as there — returned whole
+        //   `instanceof Error ? … : String(…)`    `presence.ts:241` uses `String`
+        //                                         alone, and the other arm is
+        //                                         unreachable from any test
+        //
+        // The fourth was a real gap and got a real test: the `url` default and the
+        // `??` inside it, neither reachable while the lane sets `RELAY_REDIS_URL`.
+        // That is the ratchet removing code for the fourth time in this repository
+        // rather than covering it.
+        "services/gateway/src/connections.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
         "services/gateway/src/typing.ts": {
           branches: 100,
           functions: 100,
```

### Chapter 3.24 pins two files at 100, and says what 100 does not mean

The ratchet asked its question — *is any arm of these four files uncovered, and should the code
be deleted rather than tested?* — and the answer was no code, four times. Two of the four measure
100 on all four metrics, and neither appears in the coverage reporter's text table, because that
reporter omits a file with nothing to report. They were read out of `coverage-summary.json`.

The caveat in the comment is the part worth carrying. v8 records a `&&` arm as covered when the
operand was **evaluated**, not when it went both ways, so a guard whose left side is always true
reads as fully covered. Constitution VI's 100%-branch clause is stated in exactly this number.

```diff title="vitest.coverage.config.mts"
@@ -467,6 +467,42 @@ export default defineConfig({
           statements: 97,
         },
 
+        // CHAPTER 3.24. The attachment shape and the REST door's schemas, both at 100 on
+        // all four metrics — which is why neither appears in the text reporter's table
+        // and why this pin was written from `coverage-summary.json` instead.
+        //
+        // `attachments.ts` holds FR-MSG-11's whole contract: the two arms, the scheme
+        // allowlist, the ten-item bound, and the pair rule all three send doors call. A
+        // later chapter that adds an arm and no test turns this red, which is the job.
+        //
+        // AND A MEASURED CAVEAT ON THE BRANCH NUMBER, because 100 here means less than it
+        // reads. v8 records a `binary-expr` arm as covered when the OPERAND WAS
+        // EVALUATED, not when it went both ways: `typeof value.text === "string" &&
+        // value.text.length > 0` measures `[7, 7]`, and the `typeof` check has never once
+        // been false — no schema that calls the refinement declares `text` as anything
+        // but `z.string()`. The guard stays because the signature it narrows is
+        // deliberately `string | null | undefined` (see the comment on
+        // `refineTextAndAttachments`), so the compiler requires it. **A file at 100%
+        // branches is not a file whose every arm has run.**
+        "packages/protocol/src/attachments.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+
+        // The REST door, pinned for the first time because chapter 3.24 is the first to
+        // find a defect in it: `editMessageBodySchema.text` was
+        // `sendMessageBodySchema.shape.text`, so relaxing the send's floor for FR-019
+        // relaxed the edit's, and an edit has no attachments field to restore it. Two
+        // schemas that must differ cannot share a reference at all.
+        "services/api/src/messages/messages.schema.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+
         "services/api/src/webhooks/disable.ts": {
           branches: 100,
           functions: 100,
```

## Feature 043 — fixing the review's findings

Not a chapter. `docs/09-platform-implementation-review-2026-09-03.md` recorded ten findings
against `part3-ch24`, and Part 3 is closed, so nothing here teaches this work — it lands as
amendments. Fourteen of the fifteen platform files it edits are fenced by a published chapter;
the fifteenth, `services/gateway/src/limits.itest.ts`, is published only as an `(excerpt)`, so
`check-fence-chain` never collects it and there is nothing here to amend. That is `gaps.md`
3.22-3 in practice rather than in principle.


The exemption for `reset-lane.itest.ts`. Constitution I forbids raw `pg` outside the repository
layer, and `packages/test-harness/**` is exempt while its `.itest.ts` files are not — a later
block overrides that, which the config says in a comment and then points at
`DRIVER_EXEMPT_TESTS`. Counting organisations to prove a script did NOT delete them is a read no
repository method offers.

```diff title="eslint.config.mjs"
@@ -60,6 +60,12 @@ const DRIVER_EXEMPT_TESTS = [
   "services/api/src/db/history-drift.itest.ts",
   // The harness IS data access (see the note on `packages/test-harness/**`).
   "packages/test-harness/src/guard.itest.ts",
+  // Feature 043. `reset-lane.mjs` clears lane debris and must leave the seeded demo
+  // tenant alone — the constitution requires `docker compose up` to bring the stack
+  // up with one. Counting organisations to prove a script did NOT delete them is a
+  // read no repository method offers, and doing it through the repository layer would
+  // scope the count to one environment, which is the opposite of what it has to check.
+  "packages/test-harness/src/reset-lane.itest.ts",
   // Redis, read with neither service's code, which is the whole subject: the api
   // and the gateway must increment the SAME key.
   "services/api/src/limits/limits.itest.ts",
```

The api logs the port it BOUND. `port` is the request — `Number(process.env.PORT ?? 4000)` — so
under `PORT=0` this line reported `0` while the server listened elsewhere. A log stating a
requested value as though it were assigned is wrong whether or not anybody reads it; that it also
makes `PORT=0` usable by a harness is the second reason, not the first.

```diff title="services/api/src/main.ts"
@@ -39,7 +39,17 @@ async function bootstrap(): Promise<void> {
   // Nest calls onModuleDestroy on shutdown hooks; without this the relay's loop
   // would outlive the process's intent to stop.
   app.enableShutdownHooks();
-  createLogger("api").log("info", "listening", { port });
+  // THE PORT IT BOUND, NOT THE ONE IT ASKED FOR (feature 043, FR-002). `port` is the
+  // REQUEST — `Number(process.env.PORT ?? 4000)` — and with `PORT=0` the operating system
+  // assigns an ephemeral one, so this line used to report `0` while the server listened
+  // somewhere else. A log that states a requested value as though it were the assigned one
+  // is wrong whether or not anybody reads it; that it also makes `PORT=0` usable by a test
+  // harness is the second reason, not the first.
+  const bound = (app.getHttpServer() as { address(): { port: number } | string | null })
+    .address();
+  createLogger("api").log("info", "listening", {
+    port: typeof bound === "object" && bound !== null ? bound.port : port,
+  });
 }
 
 void bootstrap();
```

The same change, the same shape, in the gateway's entry point.

```diff title="services/gateway/src/main.ts"
@@ -151,7 +151,13 @@ if (import.meta.main) {
   const port = Number(process.env.PORT ?? 4001);
   const logger = createLogger("gateway");
   const server = createServer(logger).listen(port, () => {
-    logger.log("info", "listening", { port });
+    // THE PORT IT BOUND, NOT THE ONE IT ASKED FOR (feature 043, FR-002), and the api's
+    // entry point carries the same change for the same reason. With `PORT=0` this line
+    // used to report `0` while the server listened on an ephemeral port.
+    const bound = server.address();
+    logger.log("info", "listening", {
+      port: typeof bound === "object" && bound !== null ? bound.port : port,
+    });
   });
 
   // A GRACEFUL SHUTDOWN, WHICH THIS SERVICE DID NOT HAVE (research R11, FR-RTL-05).
```

**The edit's UPDATE became a compare-and-set, and it closes a defect the record said was not
there.** `gaps.md` 3.23-3 asserted that both orderings of a concurrent edit and deletion end in a
tombstone. They do not: the edit read the row, threw if it was deleted, and then updated
`WHERE id = ?` unconditionally, so a deletion committing in that window was overwritten —
`deleted_at` set with `text` present, four such rows left in the lane. Three runs in five.

```diff title="services/api/src/db/repository.ts"
@@ -4537,12 +4537,33 @@ export class Repository {
       // would be two instants, and the history row's own primary key is
       // (message_id, edited_at), so a caller reading the history could not match an
       // entry to the message state it produced.
+      // THE WRITE REFUSES, NOT ONLY THE READ (feature 043, FR-007).
+      //
+      // This was `.where(eq(messages.id, messageId))`, and the `row.text === null`
+      // check above it is a read taken earlier in the same transaction. Neither this
+      // method nor `deleteMessage` takes a row lock, so a deletion committing in that
+      // window left the edit free to overwrite it: `text` restored, `deleted_at` still
+      // set — **a row one filter calls deleted and another calls alive**, and a
+      // deletion that returned successfully undone by an edit already in flight.
+      //
+      // `gaps.md` 3.23-3 recorded the opposite — *"both interleavings end in a
+      // tombstone… there is no order of the two that leaves a message saying something
+      // nobody wrote"* — and the test that item asked for is what disproved it: three
+      // of five runs, and four incoherent rows left behind in the lane.
+      //
+      // A COMPARE-AND-SET, NOT A LOCK. `SELECT … FOR UPDATE` in both methods would
+      // close it too, and would serialise a pair `assertWithinQuota` deliberately
+      // declined to serialise on the send path. A conditional UPDATE costs nothing
+      // when there is no race and refuses exactly when there is one: zero rows
+      // affected means the row stopped being editable between the read and the write,
+      // which is what `MessageDeletedError` already says.
       const [updated] = await tx
         .update(messages)
         .set({ text, editedAt: sql`now()` })
-        .where(eq(messages.id, messageId))
+        .where(and(eq(messages.id, messageId), isNull(messages.deletedAt)))
         .returning({ editedAt: messages.editedAt });
-      const editedAt = updated!.editedAt!;
+      if (!updated) throw new MessageDeletedError(messageId);
+      const editedAt = updated.editedAt!;
 
       // FR-004. The row carries what the message said BEFORE this edit — `row.text`,
       // read above and narrowed to a string by the tombstone check.
```

The four tests that found it. Three cover the orderings; the fourth reproduces the guard's case
deterministically, because a race cannot be commanded and an assertion that one happened proved
flaky in one run of three.

```diff title="services/api/src/db/repository.itest.ts"
@@ -1424,3 +1424,140 @@ describe("the read shapes that do NOT carry attachments (FR-009 (3.24))", () =>
     expect(Object.keys(rows[0]!).sort()).toEqual(["id", "seq", "text"]);
   });
 });
+
+// A CONCURRENT EDIT AND DELETION OF ONE MESSAGE (feature 043, FR-007).
+//
+// `gaps.md` 3.23-3 has carried this since chapter 3.23 built both writes. Neither takes
+// a row lock — no `FOR UPDATE`, following `assertWithinQuota`'s recorded decision to
+// state an overshoot rather than engineer around it — so the two orderings are not
+// symmetrical, and the claim that has never been tested is that **both of them end in a
+// tombstone**. Not the outcome: the claim.
+//
+// DO NOT START FROM `Promise.all` ON ONE CLIENT. Chapter 3.22 spent a phase learning
+// that two operations issued on one connection serialise at the socket, so a test built
+// that way proves the code cannot race by never letting it. The third case below uses
+// TWO POOLS, which is what that chapter found it needed.
+describe("a concurrent edit and deletion (feature 043, FR-007)", () => {
+  const seed = async (label: string) => {
+    const author = await repoA.createUser(`${label}-author`, "Author");
+    const channel = await repoA.createChannel(label, "public");
+    await repoA.addMember(channel.id, author.id);
+    const sent = await repoA.sendMessage(channel.id, {
+      text: "the original",
+      userId: author.id,
+    });
+    return { author, channel, sent };
+  };
+
+  const tombstoned = async (id: string) => {
+    const [row] = (
+      await db.execute<{ text: string | null; deleted_at: Date | null }>(
+        sql`SELECT text, deleted_at FROM messages WHERE id = ${id}`,
+      )
+    ).rows;
+    return row!.text === null && row!.deleted_at !== null;
+  };
+
+  it("delete then edit: the edit is refused and the tombstone stands", async () => {
+    const { author, channel, sent } = await seed("race-de");
+    await repoA.deleteMessage(channel.id, sent.id, { userId: author.id });
+    await expect(
+      repoA.editMessage(channel.id, sent.id, { text: "too late", userId: author.id }),
+    ).rejects.toThrow(MessageDeletedError);
+    expect(await tombstoned(sent.id)).toBe(true);
+  });
+
+  it("edit then delete: the tombstone stands and the history keeps what the edit superseded", async () => {
+    const { author, channel, sent } = await seed("race-ed");
+    await repoA.editMessage(channel.id, sent.id, { text: "corrected", userId: author.id });
+    await repoA.deleteMessage(channel.id, sent.id, { userId: author.id });
+    expect(await tombstoned(sent.id)).toBe(true);
+
+    // THE HISTORY ROW HOLDS THE TEXT THE EDIT SUPERSEDED, and that is correct rather
+    // than a leak: the edit did happen, and `message_edits` records what was replaced.
+    // A deletion removes the message's text; it does not rewrite the fact that an edit
+    // occurred before it.
+    const [edit] = (
+      await db.execute<{ prior_text: string }>(
+        sql`SELECT prior_text FROM message_edits WHERE message_id = ${sent.id}`,
+      )
+    ).rows;
+    expect(edit!.prior_text).toBe("the original");
+  });
+
+  it("both at once from two separate pools: whichever lands first, the message ends a tombstone", async () => {
+    // TWO POOLS, NOT TWO CALLS. `poolB` is a second connection pool with its own
+    // sockets, so the two statements are genuinely in flight together instead of being
+    // serialised by one client's write queue.
+    const poolB = createPool();
+    const dbB = createDb(poolB);
+    const repoB2 = new Repository(dbB, envA.id);
+    // WHICH ORDERING ACTUALLY HAPPENED, COUNTED AND REPORTED. The assertions below
+    // hold whether the edit lands first or the deletion does — which is the property,
+    // and also exactly how a test passes while exercising one branch and never the
+    // other. Counting is how a reader learns which case the run covered.
+    let editRefused = 0;
+    try {
+      // Ten attempts rather than one. A race asserted once is a race observed once,
+      // and the outcome is the same either way — which is the property.
+      for (let i = 0; i < 10; i++) {
+        const { author, channel, sent } = await seed(`race-both-${String(i)}`);
+        const results = await Promise.allSettled([
+          repoA.editMessage(channel.id, sent.id, {
+            text: `corrected ${String(i)}`,
+            userId: author.id,
+          }),
+          repoB2.deleteMessage(channel.id, sent.id, { userId: author.id }),
+        ]);
+
+        // The deletion always wins the row: it is the only one of the two that can
+        // refuse the other, and the edit's refusal is `MessageDeletedError`.
+        expect(await tombstoned(sent.id), `attempt ${String(i)}`).toBe(true);
+
+        const edit = results[0];
+        if (edit.status === "rejected") {
+          editRefused++;
+          expect(edit.reason).toBeInstanceOf(MessageDeletedError);
+        }
+        // And the deletion never fails: FR-009 makes a second one idempotent, and a
+        // concurrent edit is not a reason to refuse the first.
+        expect(results[1].status, `attempt ${String(i)}`).toBe("fulfilled");
+      }
+    } finally {
+      await poolB.end();
+    }
+    // WHAT THIS TEST CANNOT PROMISE, SAID OUT LOUD. `editRefused` counts the attempts
+    // where the deletion won, and it is NOT asserted to be greater than zero: measured
+    // over three runs it was zero in one of them, so requiring a race would make this
+    // flaky about one run in three. **A race cannot be commanded, so the test does not
+    // claim it happened.**
+    //
+    // The evidence that the interleaving is real is a measurement, not this assertion:
+    // before the compare-and-set went into `editMessage`, this same test failed in
+    // three runs of five, at attempts 3, 8 and 3, and left four rows in the lane with
+    // `deleted_at` set and `text` present. What survives here is the invariant — the
+    // message ends a tombstone whichever way the two land — and the deterministic
+    // proof of the guard is the test below.
+    expect(editRefused).toBeGreaterThanOrEqual(0);
+  }, 60_000);
+
+  it("the edit's UPDATE refuses a tombstone even if the read said otherwise", async () => {
+    // THE GUARD, DETERMINISTICALLY. The test above can only hit the compare-and-set
+    // when the two writes genuinely interleave, which no test can force. This one
+    // reproduces the state that predicate exists for — a row deleted after the edit's
+    // read — by deleting first and then issuing exactly the statement `editMessage`
+    // issues. Zero rows affected is what makes it throw `MessageDeletedError` instead
+    // of overwriting the tombstone.
+    const { author, channel, sent } = await seed("race-guard");
+    await repoA.deleteMessage(channel.id, sent.id, { userId: author.id });
+
+    const affected = await db.execute(
+      sql`UPDATE messages SET text = 'resurrected', edited_at = now()
+          WHERE id = ${sent.id} AND deleted_at IS NULL`,
+    );
+    expect(affected.rowCount).toBe(0);
+
+    // And the row is untouched: still a tombstone, still no text.
+    expect(await tombstoned(sent.id)).toBe(true);
+  });
+});
```

**Port 0 and a teardown that waits.** Every child now binds an ephemeral port and the harness
reads the assignment out of the child's own `listening` line — from the buffer `capture` already
filled and only ever used for a failure message. `stop()` waits for each child with a one-second
grace then SIGKILL: the api holds its listener for all 5,035 ms of a graceful exit, so awaiting
one cost 30.56 s on a lane with 5.39 s of headroom.

```diff title="packages/e2e/src/harness.ts"
@@ -349,6 +349,38 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
     });
     return child;
   };
+  /** THE PORT THE CHILD ACTUALLY BOUND (feature 043, FR-002).
+   *
+   * Every child is spawned with `PORT=0`, so the operating system assigns one nothing
+   * else holds and there is no range to register, collide with, or maintain by hand.
+   * The value comes back out of the child's own `listening` line, which
+   * `services/api/src/main.ts` and `services/gateway/src/main.ts` were changed to
+   * report correctly — both used to log the port they ASKED for, which is `0`.
+   *
+   * IT READS THE BUFFER `capture` ALREADY FILLS. `gaps.md` 3.22-6 counts eleven files
+   * that spawn a child and six that discard its output entirely; this one captured it
+   * and used it for a failure message only. Now it is load-bearing.
+   *
+   * The alternative was a fixed port, which collides always under contention, or a
+   * random one from a band, which `session.itest.ts:133` draws and chapter 3.23
+   * measured as self-colliding 2.96% of runs. Binding 0 cannot collide at all. */
+  const boundPort = async (name: string, timeoutMs = 30_000): Promise<number> => {
+    const deadline = Date.now() + timeoutMs;
+    for (;;) {
+      for (const line of output.get(name) ?? []) {
+        const m = /"msg":"listening","port":(\d+)/.exec(line);
+        if (m) return Number(m[1]);
+      }
+      if (Date.now() > deadline) {
+        throw new Error(
+          `${name} never reported a listening port within ${timeoutMs}ms\n` +
+            (output.get(name) ?? []).slice(-12).join("\n"),
+        );
+      }
+      await new Promise((r) => setTimeout(r, 50));
+    }
+  };
+
   const dump = (what: string) => {
     const lines = [`${what}; child output follows:`];
     for (const [name, log] of output) {
@@ -408,33 +440,40 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
     RELAY_DELIVERY_RELAY: "off",
   };
 
-  const apiPort = Number(process.env.RELAY_E2E_API_PORT ?? 4100);
+  // `RELAY_E2E_API_PORT` IS GONE, AND SO IS THE 4100 BEHIND IT (feature 043, FR-002).
+  // A fixed default put three ports inside a range `limits.itest.ts` registers to
+  // itself, unlisted in that file's map; `PORT=0` needs no map and no variable.
   children.push(
     capture(
       "api",
       spawn("node", [join(REPO, "services", "api", "dist", "main.js")], {
-        env: { ...env, PORT: String(apiPort) },
+        env: { ...env, PORT: "0" },
         stdio: ["ignore", "pipe", "pipe"],
       }),
     ),
   );
+  const apiPort = await boundPort("api");
   const apiUrl = `http://127.0.0.1:${apiPort}`;
   await waitForHealth(`${apiUrl}/healthz`, "api");
   say(`api up on ${apiPort}`);
 
   const urls: string[] = [];
   for (let i = 0; i < gateways; i++) {
-    const port = apiPort + 1 + i;
+    // NOT `apiPort + 1 + i` ANY MORE. Deriving a gateway's port from the api's made
+    // three ports out of one collision, and an ephemeral api port is no basis for
+    // arithmetic. Each child binds its own.
+    const name = `gateway ${i + 1}`;
     children.push(
       capture(
-        `gateway ${i + 1}`,
+        name,
         spawn("pnpm", ["exec", "tsx", "src/main.ts"], {
           cwd: join(REPO, "services", "gateway"),
-          env: { ...env, PORT: String(port), RELAY_API_URL: apiUrl },
+          env: { ...env, PORT: "0", RELAY_API_URL: apiUrl },
           stdio: ["ignore", "pipe", "pipe"],
         }),
       ),
     );
+    const port = await boundPort(name);
     await waitForHealth(`http://127.0.0.1:${port}/healthz`, `gateway ${i + 1}`);
     urls.push(`ws://127.0.0.1:${port}`);
     say(`gateway ${i + 1} up on ${port}`);
@@ -532,8 +571,48 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
       return new Client(name, await token(environmentId, name), say);
     },
     async stop() {
+      // WAIT FOR THEM TO GO, DO NOT SLEEP AND HOPE (feature 043, FR-001).
+      //
+      // This signalled and slept 200 ms. A child that took longer to close its
+      // listeners was still holding its port when the next suite booted — and the
+      // next suite's health check passed against the dying predecessor, printed
+      // `api up on …`, and then failed at its first real request with
+      // `ECONNREFUSED`. **Ten of chapter 3.24's twenty-run battery failed exactly
+      // that way**, and the debt was not settled when a run ended: it was paid by
+      // whatever booted next, in that run or the following one.
+      //
+      // ALL OF THEM AT ONCE, NOT EACH IN TURN, or the waits add up per child. The
+      // timeout has its own message so a hung child is not reported as a port
+      // problem — which is the misdiagnosis this whole change exists to end.
       for (const child of children) child.kill("SIGTERM");
-      await new Promise((resolve) => setTimeout(resolve, 200));
+      await Promise.all(
+        children.map(
+          (child) =>
+            new Promise<void>((resolve) => {
+              if (child.exitCode !== null || child.signalCode !== null) return resolve();
+              // A SHORT GRACE, THEN SIGKILL — AND THE NUMBER IS MEASURED, NOT CHOSEN.
+              //
+              // The api takes **5,035 ms** to exit on SIGTERM, and its listener stays
+              // open for all of it: the port frees at 5,037 ms and the process exits at
+              // 5,034 ms, so there is no early release to wait for. Waiting the full
+              // drain cost the e2e package **37.28 s against a 6.72 s baseline**, on a
+              // lane with 5.39 s of budget headroom.
+              //
+              // What this harness needs is the port, not a clean drain. A second is
+              // enough for a child to flush the log lines `dump()` reports on failure,
+              // and SIGKILL frees the port at once. The old code sent SIGTERM, slept
+              // 200 ms and moved on, leaving the child alive and the port held — this
+              // is strictly stronger, because the process is confirmed dead either way.
+              const timer = setTimeout(() => {
+                child.kill("SIGKILL");
+              }, 1_000);
+              child.once("exit", () => {
+                clearTimeout(timer);
+                resolve();
+              });
+            }),
+        ),
+      );
     },
   };
 }
```

The suite deletes the two durables it names per run. `consumer.itest.ts` has done this since
chapter 3.4; chapter 3.24's close-out counted 216 consumers on DELIVERIES, 215 of them this
file's.

```diff title="services/dispatcher/src/dispatcher.itest.ts"
@@ -406,6 +406,29 @@ describe("the dispatcher", () => {
 
   afterAll(async () => {
     await dispatcher?.stop();
+
+    // DELETE THE DURABLES THIS RUN NAMED (feature 043, FR-003).
+    //
+    // A durable is server-side state that outlives the process that made it, and this
+    // suite named a fresh pair per run — `itest-expand-<8 hex>` and
+    // `itest-deliver-<8 hex>` — and deleted neither. Chapter 3.24's close-out found
+    // **216 consumers on DELIVERIES**, 215 of them this file's, each holding a position
+    // in a stream of 56,193 messages, and the twenty-run battery added 19 more.
+    //
+    // `services/api/src/consumer/consumer.itest.ts` has done this since chapter 3.4 and
+    // its comment says why: *"without this, every run of this suite left another handful
+    // behind on a shared broker, and `stream-info.mjs` found twelve of them the first
+    // time it looked."* That chapter learned it at twelve. **The fix was written in the
+    // file next door for twenty chapters and never applied here.**
+    //
+    // BY NAME, NOT BY PREFIX. `consumer.itest.ts` records that sweeping `itest-` deleted
+    // another suite's live consumer off the same stream; these two are this run's own.
+    if (nats && !nats.isClosed()) {
+      const jsm = await nats.jetstreamManager();
+      await jsm.consumers.delete("EVENTS", durables.expand).catch(() => undefined);
+      await jsm.consumers.delete("DELIVERIES", durables.deliver).catch(() => undefined);
+    }
+
     if (nats && !nats.isClosed()) await nats.drain();
     child?.kill();
     endpoint?.close();
```

**Twelve tests left this file and five stayed.** It is a `.test.ts` in the lane chapter 2.1 built
to need no containers, and twelve of its seventeen talked to a real Redis. Which five stay was
measured — `12 failed | 5 passed` against a dead broker — not argued: research predicted two.

```diff title="services/gateway/src/connections.test.ts"
@@ -3,29 +3,43 @@ import { readFileSync } from "node:fs";
 import { dirname, join } from "node:path";
 import { fileURLToPath } from "node:url";
 
-import { afterAll, beforeEach, describe, expect, it } from "vitest";
+import { describe, expect, it } from "vitest";
 
 import {
   createConnections,
   DEFAULT_BOUND_MS,
   DEFAULT_HEARTBEAT_MS,
   MAX_CONNECTIONS_PER_USER,
-  type Connections,
 } from "./connections.js";
 
-// CHAPTER 3.22 — the slot registry.
+// CHAPTER 3.22's slot registry — THE HALF THAT NEEDS NO BROKER (feature 043: FR-006,
+// FR-006a, FR-024, FR-024a).
 //
-// AGAINST A REAL REDIS, NOT A STUB, and that is the correctness argument rather
-// than a preference. The whole design rests on what `SET … NX` and `SET … IFEQ`
-// do: `NX` settles FR-013's race inside the command, and `IFEQ` is what stops a
-// returning connection taking a slot somebody else now holds. **A stubbed client
-// would pass with a non-atomic implementation, with an `XX` renewal that hijacks,
-// and with a `DEL` release that frees another connection's place** — all three of
-// which this chapter's analysis passes found and corrected. It would also pass
-// against a server that does not support `IFEQ` at all.
+// This file held all seventeen of the registry's tests and twelve of them talk to a real
+// Redis. It is a `.test.ts`, so it runs in the lane chapter 2.1 built specifically to
+// need no containers — the lane whose whole point is that `pnpm test` is honest on a
+// laptop with nothing running. With the stack down it reported twelve failures that were
+// correct behaviour, and `gaps.md` 3.23-9 has carried that since it was found by
+// accident.
 //
-// That is chapter 3.17's T047c one dimension over: a test that passes with half
-// its subject applied.
+// **WHICH FIVE STAY WAS MEASURED, NOT ARGUED.** Run the original against a dead broker
+// and it reports `12 failed | 5 passed`:
+//
+//   RELAY_REDIS_URL=redis://127.0.0.1:6399 vitest run src/connections.test.ts
+//
+// Research predicted two and the measurement found five. The heartbeat test was filed
+// under "asserts registry behaviour" on the strength of its title; it asserts a ratio
+// between two constants and never reaches the broker. **A title is not an inventory of
+// what a test touches** — the same defect as a task id in a test title, one category
+// over.
+//
+// AND THE SHARED `beforeEach` IS GONE. The describe these came from built a registry
+// against `REDIS` for every test in it, including the two that provably need none. It
+// did not break them — `createConnections` connects lazily, which one command settled
+// after a reading of the code said otherwise — but a container-free lane holding a Redis
+// client it never uses is a lane that will grow one that matters.
+//
+// The twelve that need a broker are in `connections.itest.ts`, unchanged in behaviour.
 
 const REDIS = process.env["RELAY_REDIS_URL"] ?? "redis://localhost:6379";
 const silent = { log: () => {} };
@@ -34,209 +48,13 @@ const silent = { log: () => {} };
  * that share a constant `"env-1"` and both lean on the user name "tuan". */
 const ENV = `env-${randomUUID()}`;
 
-describe("the slot registry", () => {
-  let registry: Connections;
-  let user: string;
-
-  beforeEach(() => {
-    registry = createConnections({ url: REDIS, logger: silent });
-    // A fresh user per test rather than a flush: `FLUSHDB` would delete the keys
-    // of every other suite running in parallel, and this package's config sets no
-    // `fileParallelism`.
-    user = `u-${randomUUID()}`;
-  });
-
-  afterAll(async () => {
-    await registry.close();
-  });
-
-  // ---- ARM 1 and ARM 2: the walk -----------------------------------------
-
-  it("claims the first free slot, and reports how many were held", async () => {
-    const first = await registry.claim(ENV, user, randomUUID());
-    expect(first).toEqual({ kind: "claimed", slot: 0, held: 0 });
-
-    const second = await registry.claim(ENV, user, randomUUID());
-    // ARM 1: `SET NX` missed on slot 0 and the walk moved on.
-    expect(second).toEqual({ kind: "claimed", slot: 1, held: 1 });
-  });
-
-  it("refuses when every slot is held, and says five (FR-001 (3.22))", async () => {
-    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
-      expect((await registry.claim(ENV, user, randomUUID())).kind).toBe("claimed");
-    }
-    // ARM 2: the walk found no free slot.
-    expect(await registry.claim(ENV, user, randomUUID())).toEqual({
-      kind: "full",
-      held: 5,
-    });
-  });
-
-  it("counts each environment separately for one user identifier (FR-012 (3.22))", async () => {
-    const other = `env-${randomUUID()}`;
-    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
-      await registry.claim(ENV, user, randomUUID());
-    }
-    expect((await registry.claim(other, user, randomUUID())).kind).toBe("claimed");
-  });
-
-  // ---- ARM 3 and ARM 9: the renewal, and the re-claim --------------------
-
-  it("renews a slot it still holds (FR-008 (3.22))", async () => {
-    const id = randomUUID();
-    const claimed = await registry.claim(ENV, user, id);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    expect(await registry.renew(ENV, user, id, claimed.slot)).toEqual({
-      kind: "renewed",
-    });
-  });
-
-  it("re-claims when its slot is GONE and nothing else took it (FR-011b (3.22))", async () => {
-    // ARM 3 then ARM 9. A short-lived registry so the bound elapses inside a test
-    // rather than in a minute: the boundMs option exists for exactly this, the way
-    // `membership.ts`'s reread interval does — sixty seconds does not fit in a
-    // package whose whole wall clock is forty-five.
-    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
-    const id = randomUUID();
-    const claimed = await brief.claim(ENV, user, id);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    await new Promise((resolve) => setTimeout(resolve, 120));
-
-    // THE COMMON CASE AFTER ANY BRIEF OUTAGE, and the branch a design that closes
-    // on every refused renewal gets wrong. The user is under the limit; the slot
-    // simply expired.
-    expect(await brief.renew(ENV, user, id, claimed.slot)).toEqual({
-      kind: "reclaimed",
-      slot: 0,
-    });
-    await brief.close();
-  });
-
-  // ---- ARM 4 and ARM 10: the hijack, and the cap genuinely full ----------
+describe("the slot registry, without a broker", () => {
+  /** A registry and a user per test, not a shared hook. The two below need the OBJECT
+   * and not the broker: `release` on a slot never held and `releaseAll([])` both settle
+   * before any command is sent. */
+  const registryFor = () => createConnections({ url: REDIS, logger: silent });
+  const userFor = () => `u-${randomUUID()}`;
 
-  it("refuses to renew a slot ANOTHER connection now holds (FR-011 (3.22))", async () => {
-    // ARM 4, and the one test in the chapter that catches `IFEQ` being replaced by
-    // `XX`. `XX` tests existence and not ownership — measured on 8.10.0,
-    // `SET k B XX` against a key holding `A` returns OK — so under `XX` this
-    // renewal would silently take the slot and the count would say five while six
-    // connections were open.
-    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
-    const mine = randomUUID();
-    const claimed = await brief.claim(ENV, user, mine);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    await new Promise((resolve) => setTimeout(resolve, 120));
-
-    // Somebody else takes the expired slot, and fills the rest so the re-claim has
-    // nowhere to go — ARM 10.
-    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
-      await brief.claim(ENV, user, randomUUID());
-    }
-    expect(await brief.renew(ENV, user, mine, claimed.slot)).toEqual({
-      kind: "full",
-      held: 5,
-    });
-    await brief.close();
-  });
-
-  // ---- ARM 6, ARM 7 and ARM 8: the release ------------------------------
-
-  it("frees a slot it holds, and the slot is reusable at once (FR-010 (3.22))", async () => {
-    const id = randomUUID();
-    const claimed = await registry.claim(ENV, user, id);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    await registry.release(ENV, user, id, claimed.slot);
-    // NO WAIT, AND THE SLOT IS NOT PINNED — because at the default one-millisecond
-    // tombstone there are THREE outcomes, not two, and the coverage lane found the
-    // third by failing here with `slot: 1` where this assertion had demanded 0.
-    //
-    //   the tombstone is still there   `SET NX` fails, `SET IFEQ -` takes it -> 0
-    //   it expired before the walk     `SET NX` succeeds                     -> 0
-    //   it expires BETWEEN the two     both fail, the walk moves on          -> 1
-    //
-    // The third is a millisecond wide and harmless: a slot is skipped, never
-    // over-admitted, and the connection is accepted. What must not happen is a
-    // refusal, and that is what this asserts. The determinate version lives in the
-    // test below, where the window is held open at 500 ms so it cannot race.
-    //
-    // This test's FIRST version slept 20 ms and accepted any slot; the sleep is
-    // what hid the `releaseAll` defect for two phases. Removing the sleep was
-    // right and pinning the slot with it was not — the two changes arrived
-    // together and only one of them was justified.
-    const again = await registry.claim(ENV, user, randomUUID());
-    expect(again.kind).toBe("claimed");
-    if (again.kind !== "claimed") throw new Error("unreachable");
-    expect(again.slot, "a released slot cost more than one place").toBeLessThanOrEqual(1);
-  });
-
-  it("claims a slot whose tombstone has NOT expired (FR-010 (3.22))", async () => {
-    // A HALF-SECOND TOMBSTONE, so the window is a window rather than a coin flip.
-    // With the shipped one-millisecond value this test would pass against the
-    // broken walk about half the time, which is how the defect survived: two of six
-    // runs of the clean-shutdown test, reported as `no connection.ack within 5s`.
-    const slow = createConnections({
-      url: REDIS,
-      logger: silent,
-      tombstoneMs: 500,
-    });
-    const id = randomUUID();
-    const claimed = await slow.claim(ENV, user, id);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    await slow.release(ENV, user, id, claimed.slot);
-    expect(await slow.claim(ENV, user, randomUUID())).toEqual({
-      kind: "claimed",
-      slot: 0,
-      held: 0,
-    });
-    await slow.close();
-  });
-
-  it("accepts a claim immediately after releaseAll frees all five (FR-011a (3.22))", async () => {
-    // THE CASE THAT WAS ACTUALLY BROKEN, and it is a deploy. One slot tombstoned is
-    // one slot skipped; five tombstoned is a walk that finds nothing free and
-    // reports `full` — so a client reconnecting to the new instance is refused with
-    // `connection_limit_reached`, and the remedy that close code names is to close
-    // one of the connections it already holds. Those went with the old instance.
-    const slow = createConnections({
-      url: REDIS,
-      logger: silent,
-      tombstoneMs: 500,
-    });
-    const held = [];
-    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
-      const id = randomUUID();
-      const claimed = await slow.claim(ENV, user, id);
-      if (claimed.kind !== "claimed") throw new Error("expected a slot");
-      held.push({ environmentId: ENV, user, connectionId: id, slot: claimed.slot });
-    }
-    await slow.releaseAll(held);
-    expect(await slow.claim(ENV, user, randomUUID())).toEqual({
-      kind: "claimed",
-      slot: 0,
-      held: 0,
-    });
-    await slow.close();
-  });
-
-  it("does NOT free a slot another connection now holds (FR-010 (3.22))", async () => {
-    // ARM 6, and the reason the release is conditional. Under a plain `DEL` this
-    // would delete the new owner's key and hand out a place that is in use — the
-    // same ownership hole `IFEQ` closed on the renewal, on the path that fix
-    // introduced.
-    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
-    const mine = randomUUID();
-    const claimed = await brief.claim(ENV, user, mine);
-    if (claimed.kind !== "claimed") throw new Error("expected a slot");
-    await new Promise((resolve) => setTimeout(resolve, 120));
-
-    const theirs = randomUUID();
-    const retaken = await brief.claim(ENV, user, theirs);
-    expect(retaken).toEqual({ kind: "claimed", slot: 0, held: 0 });
-
-    await brief.release(ENV, user, mine, claimed.slot);
-    // Still theirs: the release was refused. Renewing proves it.
-    expect(await brief.renew(ENV, user, theirs, 0)).toEqual({ kind: "renewed" });
-    await brief.close();
-  });
 
   it("does not throw for a slot the connection never held", async () => {
     // ARM 7, AND THE TITLE SAYS ONLY WHAT THE ASSERTION PROVES. It used to read
@@ -248,31 +66,15 @@ describe("the slot registry", () => {
     // 3.20's rule: a claim about an observable difference needs falsifying before
     // the test is written.
     await expect(
-      registry.release(ENV, user, randomUUID(), 3),
+      registryFor().release(ENV, userFor(), randomUUID(), 3),
     ).resolves.toBeUndefined();
   });
 
-  it("releases every slot this instance holds (FR-011a (3.22))", async () => {
-    const held = [];
-    for (let i = 0; i < 3; i += 1) {
-      const id = randomUUID();
-      const claimed = await registry.claim(ENV, user, id);
-      if (claimed.kind !== "claimed") throw new Error("expected a slot");
-      held.push({ environmentId: ENV, user, connectionId: id, slot: claimed.slot });
-    }
-    await registry.releaseAll(held);
-    await new Promise((resolve) => setTimeout(resolve, 20));
-    // All three back, so the next three claims all succeed.
-    for (let i = 0; i < 3; i += 1) {
-      expect((await registry.claim(ENV, user, randomUUID())).kind).toBe("claimed");
-    }
-  });
-
   it("does not throw when it holds nothing", async () => {
     // ARM 8: the empty loop, which is the shutdown path of an instance that never
     // had a connection. Renamed for the same reason as the test above — "releases
     // nothing" describes the keys and the assertion describes the promise.
-    await expect(registry.releaseAll([])).resolves.toBeUndefined();
+    await expect(registryFor().releaseAll([])).resolves.toBeUndefined();
   });
 
   // ---- ARM 5 and ARM 11: the registry cannot be reached -----------------
@@ -295,7 +97,7 @@ describe("the slot registry", () => {
       },
       boundMs: 60,
     });
-    expect(await gone.claim(ENV, user, randomUUID())).toEqual({
+    expect(await gone.claim(ENV, userFor(), randomUUID())).toEqual({
       kind: "unenforced",
     });
     expect(lines.some((l) => l["msg"] === "connections.failed")).toBe(true);
@@ -315,35 +117,6 @@ describe("the slot registry", () => {
     expect(DEFAULT_HEARTBEAT_MS).not.toBe(30_000);
   });
 
-  it("builds without a url, from the environment or from the default", async () => {
-    // TWO BRANCHES IN ONE LINE, and the ratchet wanted both: the default parameter
-    // — which every test above steps over by passing `url` — and the `??` inside
-    // it, whose right-hand side the lane can never reach because it always sets
-    // `RELAY_REDIS_URL`. `codes.test.ts:128` established the swap-and-restore
-    // shape for exactly this; the `finally` is what keeps a failure here from
-    // silently pointing every later suite at a different Redis.
-    const defaulted = createConnections({ logger: silent });
-    const outcome = await defaulted.claim(ENV, `u-${randomUUID()}`, randomUUID());
-    expect(outcome.kind).toBe("claimed");
-    await defaulted.close();
-
-    const before = process.env["RELAY_REDIS_URL"];
-    try {
-      delete process.env["RELAY_REDIS_URL"];
-      // `DEFAULT_REDIS_URL` is localhost:6379, which is where the lane's Redis is,
-      // so this claims a place rather than failing open — and the assertion is that
-      // it reached A Redis, not that it reached a particular one.
-      const fallback = createConnections({ logger: silent });
-      expect((await fallback.claim(ENV, `u-${randomUUID()}`, randomUUID())).kind).toBe(
-        "claimed",
-      );
-      await fallback.close();
-    } finally {
-      if (before === undefined) delete process.env["RELAY_REDIS_URL"];
-      else process.env["RELAY_REDIS_URL"] = before;
-    }
-  });
-
   it("states the maximum in exactly one place (FR-002 (3.22))", async () => {
     // The requirement is about DRIFT, not about the value. `policy.ts` derived
     // `connect: 3_000` from "ten thousand divided by five" and shipped a third
```

The twelve that arrived, unchanged in behaviour.

```diff title="services/gateway/src/connections.itest.ts"
@@ -1113,3 +1113,275 @@ describe("the cap fails open, and says so (US4)", () => {
     }
   }, 60_000);
 });
+
+// THE TWELVE THAT NEED A RUNNING BROKER (feature 043: FR-006, FR-024, FR-024a).
+//
+// Moved here from `connections.test.ts`, unchanged in behaviour. That file is a
+// `.test.ts` and runs in the lane chapter 2.1 built to need no containers; these twelve
+// talk to a real Redis, so with the stack down they reported failures that were correct
+// behaviour and made the lane's exit code answer "does this work HERE, today" instead of
+// "does this work without infrastructure". `gaps.md` 3.23-9 carried that from the day it
+// was found by accident.
+//
+// WHICH TWELVE WAS MEASURED. `RELAY_REDIS_URL=redis://127.0.0.1:6399 vitest run
+// src/connections.test.ts` reported `12 failed | 5 passed`; these are the twelve.
+//
+// AGAINST A REAL REDIS, NOT A STUB, and the original file's argument for that stands
+// unchanged and is why they moved rather than being rewritten: the design rests on what
+// `SET … NX` and `SET … IFEQ` do. **A stubbed client would pass with a non-atomic
+// implementation, with an `XX` renewal that hijacks, and with a `DEL` release that frees
+// another connection's place** — all three of which chapter 3.22's analysis found and
+// corrected, and it would also pass against a server with no `IFEQ` at all.
+
+describe("the slot registry, against a real broker", () => {
+  let registry: Connections;
+  let user: string;
+  const silent = { log: () => {} };
+  const ENV = `env-${randomUUID()}`;
+
+  beforeEach(() => {
+    registry = createConnections({ url: REDIS, logger: silent });
+    // A fresh user per test rather than a flush: `FLUSHDB` would delete the keys of
+    // every other suite running in parallel, and this package's config sets no
+    // `fileParallelism`.
+    user = `u-${randomUUID()}`;
+  });
+
+  afterAll(async () => {
+    await registry.close();
+  });
+
+
+  // ---- ARM 1 and ARM 2: the walk -----------------------------------------
+
+  it("claims the first free slot, and reports how many were held", async () => {
+    const first = await registry.claim(ENV, user, randomUUID());
+    expect(first).toEqual({ kind: "claimed", slot: 0, held: 0 });
+
+    const second = await registry.claim(ENV, user, randomUUID());
+    // ARM 1: `SET NX` missed on slot 0 and the walk moved on.
+    expect(second).toEqual({ kind: "claimed", slot: 1, held: 1 });
+  });
+
+  it("refuses when every slot is held, and says five (FR-001 (3.22))", async () => {
+    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
+      expect((await registry.claim(ENV, user, randomUUID())).kind).toBe("claimed");
+    }
+    // ARM 2: the walk found no free slot.
+    expect(await registry.claim(ENV, user, randomUUID())).toEqual({
+      kind: "full",
+      held: 5,
+    });
+  });
+
+  it("counts each environment separately for one user identifier (FR-012 (3.22))", async () => {
+    const other = `env-${randomUUID()}`;
+    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
+      await registry.claim(ENV, user, randomUUID());
+    }
+    expect((await registry.claim(other, user, randomUUID())).kind).toBe("claimed");
+  });
+
+  // ---- ARM 3 and ARM 9: the renewal, and the re-claim --------------------
+
+  it("renews a slot it still holds (FR-008 (3.22))", async () => {
+    const id = randomUUID();
+    const claimed = await registry.claim(ENV, user, id);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    expect(await registry.renew(ENV, user, id, claimed.slot)).toEqual({
+      kind: "renewed",
+    });
+  });
+
+  it("re-claims when its slot is GONE and nothing else took it (FR-011b (3.22))", async () => {
+    // ARM 3 then ARM 9. A short-lived registry so the bound elapses inside a test
+    // rather than in a minute: the boundMs option exists for exactly this, the way
+    // `membership.ts`'s reread interval does — sixty seconds does not fit in a
+    // package whose whole wall clock is forty-five.
+    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
+    const id = randomUUID();
+    const claimed = await brief.claim(ENV, user, id);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    await new Promise((resolve) => setTimeout(resolve, 120));
+
+    // THE COMMON CASE AFTER ANY BRIEF OUTAGE, and the branch a design that closes
+    // on every refused renewal gets wrong. The user is under the limit; the slot
+    // simply expired.
+    expect(await brief.renew(ENV, user, id, claimed.slot)).toEqual({
+      kind: "reclaimed",
+      slot: 0,
+    });
+    await brief.close();
+  });
+
+  // ---- ARM 4 and ARM 10: the hijack, and the cap genuinely full ----------
+
+  it("refuses to renew a slot ANOTHER connection now holds (FR-011 (3.22))", async () => {
+    // ARM 4, and the one test in the chapter that catches `IFEQ` being replaced by
+    // `XX`. `XX` tests existence and not ownership — measured on 8.10.0,
+    // `SET k B XX` against a key holding `A` returns OK — so under `XX` this
+    // renewal would silently take the slot and the count would say five while six
+    // connections were open.
+    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
+    const mine = randomUUID();
+    const claimed = await brief.claim(ENV, user, mine);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    await new Promise((resolve) => setTimeout(resolve, 120));
+
+    // Somebody else takes the expired slot, and fills the rest so the re-claim has
+    // nowhere to go — ARM 10.
+    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
+      await brief.claim(ENV, user, randomUUID());
+    }
+    expect(await brief.renew(ENV, user, mine, claimed.slot)).toEqual({
+      kind: "full",
+      held: 5,
+    });
+    await brief.close();
+  });
+
+  // ---- ARM 6, ARM 7 and ARM 8: the release ------------------------------
+
+  it("frees a slot it holds, and the slot is reusable at once (FR-010 (3.22))", async () => {
+    const id = randomUUID();
+    const claimed = await registry.claim(ENV, user, id);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    await registry.release(ENV, user, id, claimed.slot);
+    // NO WAIT, AND THE SLOT IS NOT PINNED — because at the default one-millisecond
+    // tombstone there are THREE outcomes, not two, and the coverage lane found the
+    // third by failing here with `slot: 1` where this assertion had demanded 0.
+    //
+    //   the tombstone is still there   `SET NX` fails, `SET IFEQ -` takes it -> 0
+    //   it expired before the walk     `SET NX` succeeds                     -> 0
+    //   it expires BETWEEN the two     both fail, the walk moves on          -> 1
+    //
+    // The third is a millisecond wide and harmless: a slot is skipped, never
+    // over-admitted, and the connection is accepted. What must not happen is a
+    // refusal, and that is what this asserts. The determinate version lives in the
+    // test below, where the window is held open at 500 ms so it cannot race.
+    //
+    // This test's FIRST version slept 20 ms and accepted any slot; the sleep is
+    // what hid the `releaseAll` defect for two phases. Removing the sleep was
+    // right and pinning the slot with it was not — the two changes arrived
+    // together and only one of them was justified.
+    const again = await registry.claim(ENV, user, randomUUID());
+    expect(again.kind).toBe("claimed");
+    if (again.kind !== "claimed") throw new Error("unreachable");
+    expect(again.slot, "a released slot cost more than one place").toBeLessThanOrEqual(1);
+  });
+
+  it("claims a slot whose tombstone has NOT expired (FR-010 (3.22))", async () => {
+    // A HALF-SECOND TOMBSTONE, so the window is a window rather than a coin flip.
+    // With the shipped one-millisecond value this test would pass against the
+    // broken walk about half the time, which is how the defect survived: two of six
+    // runs of the clean-shutdown test, reported as `no connection.ack within 5s`.
+    const slow = createConnections({
+      url: REDIS,
+      logger: silent,
+      tombstoneMs: 500,
+    });
+    const id = randomUUID();
+    const claimed = await slow.claim(ENV, user, id);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    await slow.release(ENV, user, id, claimed.slot);
+    expect(await slow.claim(ENV, user, randomUUID())).toEqual({
+      kind: "claimed",
+      slot: 0,
+      held: 0,
+    });
+    await slow.close();
+  });
+
+  it("accepts a claim immediately after releaseAll frees all five (FR-011a (3.22))", async () => {
+    // THE CASE THAT WAS ACTUALLY BROKEN, and it is a deploy. One slot tombstoned is
+    // one slot skipped; five tombstoned is a walk that finds nothing free and
+    // reports `full` — so a client reconnecting to the new instance is refused with
+    // `connection_limit_reached`, and the remedy that close code names is to close
+    // one of the connections it already holds. Those went with the old instance.
+    const slow = createConnections({
+      url: REDIS,
+      logger: silent,
+      tombstoneMs: 500,
+    });
+    const held = [];
+    for (let i = 0; i < MAX_CONNECTIONS_PER_USER; i += 1) {
+      const id = randomUUID();
+      const claimed = await slow.claim(ENV, user, id);
+      if (claimed.kind !== "claimed") throw new Error("expected a slot");
+      held.push({ environmentId: ENV, user, connectionId: id, slot: claimed.slot });
+    }
+    await slow.releaseAll(held);
+    expect(await slow.claim(ENV, user, randomUUID())).toEqual({
+      kind: "claimed",
+      slot: 0,
+      held: 0,
+    });
+    await slow.close();
+  });
+
+  it("does NOT free a slot another connection now holds (FR-010 (3.22))", async () => {
+    // ARM 6, and the reason the release is conditional. Under a plain `DEL` this
+    // would delete the new owner's key and hand out a place that is in use — the
+    // same ownership hole `IFEQ` closed on the renewal, on the path that fix
+    // introduced.
+    const brief = createConnections({ url: REDIS, logger: silent, boundMs: 60 });
+    const mine = randomUUID();
+    const claimed = await brief.claim(ENV, user, mine);
+    if (claimed.kind !== "claimed") throw new Error("expected a slot");
+    await new Promise((resolve) => setTimeout(resolve, 120));
+
+    const theirs = randomUUID();
+    const retaken = await brief.claim(ENV, user, theirs);
+    expect(retaken).toEqual({ kind: "claimed", slot: 0, held: 0 });
+
+    await brief.release(ENV, user, mine, claimed.slot);
+    // Still theirs: the release was refused. Renewing proves it.
+    expect(await brief.renew(ENV, user, theirs, 0)).toEqual({ kind: "renewed" });
+    await brief.close();
+  });
+
+  it("releases every slot this instance holds (FR-011a (3.22))", async () => {
+    const held = [];
+    for (let i = 0; i < 3; i += 1) {
+      const id = randomUUID();
+      const claimed = await registry.claim(ENV, user, id);
+      if (claimed.kind !== "claimed") throw new Error("expected a slot");
+      held.push({ environmentId: ENV, user, connectionId: id, slot: claimed.slot });
+    }
+    await registry.releaseAll(held);
+    await new Promise((resolve) => setTimeout(resolve, 20));
+    // All three back, so the next three claims all succeed.
+    for (let i = 0; i < 3; i += 1) {
+      expect((await registry.claim(ENV, user, randomUUID())).kind).toBe("claimed");
+    }
+  });
+
+  it("builds without a url, from the environment or from the default", async () => {
+    // TWO BRANCHES IN ONE LINE, and the ratchet wanted both: the default parameter
+    // — which every test above steps over by passing `url` — and the `??` inside
+    // it, whose right-hand side the lane can never reach because it always sets
+    // `RELAY_REDIS_URL`. `codes.test.ts:128` established the swap-and-restore
+    // shape for exactly this; the `finally` is what keeps a failure here from
+    // silently pointing every later suite at a different Redis.
+    const defaulted = createConnections({ logger: silent });
+    const outcome = await defaulted.claim(ENV, `u-${randomUUID()}`, randomUUID());
+    expect(outcome.kind).toBe("claimed");
+    await defaulted.close();
+
+    const before = process.env["RELAY_REDIS_URL"];
+    try {
+      delete process.env["RELAY_REDIS_URL"];
+      // `DEFAULT_REDIS_URL` is localhost:6379, which is where the lane's Redis is,
+      // so this claims a place rather than failing open — and the assertion is that
+      // it reached A Redis, not that it reached a particular one.
+      const fallback = createConnections({ logger: silent });
+      expect((await fallback.claim(ENV, `u-${randomUUID()}`, randomUUID())).kind).toBe(
+        "claimed",
+      );
+      await fallback.close();
+    } finally {
+      if (before === undefined) delete process.env["RELAY_REDIS_URL"];
+      else process.env["RELAY_REDIS_URL"] = before;
+    }
+  });
+});
```

## The port bands, retired

Every lane in this repository chose its api's port from a hand-allocated band: nine of them
across eight files, listed in a map at the top of `services/gateway/src/limits.itest.ts`.
Two of those nine bands contained a service the lane itself runs. `membership.itest.ts` drew
from 5400-5599, which holds Postgres's **5432**; this file drew from 4100-4299, which holds
NATS's **4222**.

The failure is silent in both directions. The api child cannot bind, its `EADDRINUSE` goes to
a pipe nobody reads, and the health check then gets its answer from whatever *does* hold the
port — so a run prints the same "up" line whether it succeeded or not. A twenty-run battery
stopped at eight runs with two of them dead this way, every test in the file failing against
Postgres with `other side closed` and no port named anywhere in the output.

Chapter 3.24's record carries an eleventh red it calls unexplainable — this file, reporting
*"api never became healthy"*. 4222 is in its band.

**A band table cannot be checked.** It has to avoid every other band, and every service port
on every contributor's machine, and stay right as both move. So there is no table now: each
child is spawned with `PORT=0` and reports the port the OS gave it, which `main.ts` already
logs because chapter 3.24's harness needed exactly this.

`presence.itest.ts` drew 4700-4899, which contained `meter.itest.ts`'s own api range
at 4710-4769 — an overlap the retired port map recorded and nobody could act on. Its
health probe also asked for `/health`, a route this api has never served.

```diff title="services/gateway/src/presence.itest.ts"
@@ -88,11 +88,58 @@ interface ApiUnderTest {
   stop: () => void;
 }
 
+/** The port the OS actually gave a child, read from the child's own `listening` line.
+ *
+ * Feature 043 (FR-002). `main.ts` logs the address it BOUND rather than the one it was
+ * asked for, which is the only number that is true when `PORT=0`. Waiting on a health
+ * URL cannot replace this: a health check answers from whoever holds the port, so it
+ * says "up" just as cheerfully when the answer is somebody else's process.
+ *
+ * It rejects on exit rather than waiting out the timeout, so a child that dies on
+ * startup reports the reason it printed instead of thirty seconds of nothing. */
+async function boundPort(
+  child: ChildProcess,
+  label: string,
+  timeoutMs = 30_000,
+): Promise<number> {
+  let output = "";
+  return new Promise<number>((resolve, reject) => {
+    const done = (fn: () => void) => {
+      clearTimeout(timer);
+      child.off("exit", onExit);
+      fn();
+    };
+    const timer = setTimeout(
+      () =>
+        done(() =>
+          reject(
+            new Error(`${label} never reported a listening port in ${timeoutMs}ms\n${output}`),
+          ),
+        ),
+      timeoutMs,
+    );
+    const onExit = (code: number | null) =>
+      done(() => reject(new Error(`${label} exited ${code} before listening\n${output}`)));
+    const onData = (chunk: Buffer | string) => {
+      output += String(chunk);
+      const m = /"msg":"listening","port":(\d+)/.exec(output);
+      if (m) done(() => resolve(Number(m[1])));
+    };
+    child.stdout?.on("data", onData);
+    child.stderr?.on("data", onData);
+    child.once("exit", onExit);
+  });
+}
+
 /** Two members of ONE channel, which no existing gateway fixture provides:
  * `seedSocketTenants` gives one user per tenant, and presence needs a watcher and
  * a subject who share a channel. */
 async function startApi(): Promise<ApiUnderTest> {
-  const port = 4700 + Math.floor(Math.random() * 200);
+  // NO PORT IS CHOSEN HERE (feature 043, FR-001/FR-002). This drew from 4700-4899,
+  // one of nine hand-allocated bands, two of which contained a service the lane runs —
+  // `membership.itest.ts` held Postgres's 5432 and `limits.itest.ts` holds NATS's 4222.
+  // This band collided with `meter.itest.ts`'s api range instead, which the table two
+  // files over recorded and nobody could act on. Asking the OS ends the bookkeeping.
   const dist = join(REPO, "services", "api", "dist");
   if (!existsSync(join(dist, "main.js"))) {
     throw new Error(
@@ -175,23 +222,31 @@ async function startApi(): Promise<ApiUnderTest> {
   const child: ChildProcess = spawn("node", [join(dist, "main.js")], {
     env: {
       ...process.env,
-      PORT: String(port),
+      PORT: "0",
       RELAY_OUTBOX_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
     },
-    stdio: "ignore",
+    // PIPED, NOT IGNORED — the port is read back out of the child, and a spawn that
+    // fails gets to say why.
+    stdio: ["ignore", "pipe", "pipe"],
   });
+  const port = await boundPort(child, "api");
   const url = `http://127.0.0.1:${port}`;
-  for (let i = 0; i < 100; i += 1) {
+  // `/healthz`, AND A THROW. This probed `/health`, which the api has never served
+  // (`health.controller.ts:7`), so `res.ok` was false on all hundred iterations and the
+  // loop fell through and returned `url` anyway — a flat ten-second sleep that reported
+  // success. The wrong path and the missing throw each hid the other.
+  let healthy = false;
+  for (let i = 0; i < 100 && !healthy; i += 1) {
     try {
-      const res = await fetch(`${url}/health`);
-      if (res.ok) break;
+      healthy = (await fetch(`${url}/healthz`)).ok;
     } catch {
       /* not up yet */
     }
-    await new Promise((r) => setTimeout(r, 100));
+    if (!healthy) await new Promise((r) => setTimeout(r, 100));
   }
+  if (!healthy) throw new Error(`api bound ${port} and never answered /healthz`);
   return {
     url,
     credential: key.credential,
```

`isolation.itest.ts` starts TWO api children, and its band came with a counter so the
two draws could not collide with each other. `PORT=0` makes that impossible rather
than unlikely, so the counter goes with the band.

```diff title="services/gateway/src/isolation.itest.ts"
@@ -79,9 +79,54 @@ async function waitForHealth(url: string): Promise<void> {
  * children, and two draws from one range can collide with each other — a 1-in-200
  * failure that would read as a broken gateway rather than a broken fixture, which
  * is the exact trap the fixed port was. */
-let children = 0;
+/** The port the OS actually gave a child, read from the child's own `listening` line.
+ *
+ * Feature 043 (FR-002). `main.ts` logs the address it BOUND rather than the one it was
+ * asked for, which is the only number that is true when `PORT=0`. Waiting on a health
+ * URL cannot replace this: a health check answers from whoever holds the port, so it
+ * says "up" just as cheerfully when the answer is somebody else's process.
+ *
+ * It rejects on exit rather than waiting out the timeout, so a child that dies on
+ * startup reports the reason it printed instead of thirty seconds of nothing. */
+async function boundPort(
+  child: ChildProcess,
+  label: string,
+  timeoutMs = 30_000,
+): Promise<number> {
+  let output = "";
+  return new Promise<number>((resolve, reject) => {
+    const done = (fn: () => void) => {
+      clearTimeout(timer);
+      child.off("exit", onExit);
+      fn();
+    };
+    const timer = setTimeout(
+      () =>
+        done(() =>
+          reject(
+            new Error(`${label} never reported a listening port in ${timeoutMs}ms\n${output}`),
+          ),
+        ),
+      timeoutMs,
+    );
+    const onExit = (code: number | null) =>
+      done(() => reject(new Error(`${label} exited ${code} before listening\n${output}`)));
+    const onData = (chunk: Buffer | string) => {
+      output += String(chunk);
+      const m = /"msg":"listening","port":(\d+)/.exec(output);
+      if (m) done(() => resolve(Number(m[1])));
+    };
+    child.stdout?.on("data", onData);
+    child.stderr?.on("data", onData);
+    child.once("exit", onExit);
+  });
+}
+
 async function startApi(): Promise<{ url: string; stop: () => void }> {
-  const port = 4900 + ((Math.floor(Math.random() * 100) * 2 + children++) % 200);
+  // NO BAND, AND NO COUNTER (feature 043, FR-001/FR-002). The `+ children`
+  // alternation existed so this file's TWO api children could not draw the same
+  // port from one 200-wide range. `PORT=0` makes that impossible rather than
+  // unlikely — the OS does not hand the same port to two listeners.
   const dist = join(REPO, "services", "api", "dist");
   if (!existsSync(join(dist, "main.js"))) {
     throw new Error(
@@ -92,7 +137,7 @@ async function startApi(): Promise<{ url: string; stop: () => void }> {
   const child: ChildProcess = spawn("node", [join(dist, "main.js")], {
     env: {
       ...process.env,
-      PORT: String(port),
+      PORT: "0",
       // Neither relay: this suite asserts on rows and on frames, and a
       // background loop draining the tables another file is asserting on turns
       // two unrelated suites into a race (chapters 3.3 and 3.8).
@@ -106,6 +151,7 @@ async function startApi(): Promise<{ url: string; stop: () => void }> {
     },
     stdio: ["ignore", "pipe", "pipe"],
   });
+  const port = await boundPort(child, "api");
   const url = `http://127.0.0.1:${port}`;
   await waitForHealth(`${url}/healthz`);
   return { url, stop: () => child.kill() };
```

`public-surface.itest.ts` is the same change, and its own comment already knew the
shape of the problem: a previous run's child still holding a port answers the health
check from a different environment.

```diff title="services/gateway/src/public-surface.itest.ts"
@@ -71,8 +71,53 @@ async function waitForHealth(url: string): Promise<void> {
  * still holding a fixed port answers the health check from a DIFFERENT
  * environment, and every token this run minted is then refused by an api that has
  * never heard of it. */
+/** The port the OS actually gave a child, read from the child's own `listening` line.
+ *
+ * Feature 043 (FR-002). `main.ts` logs the address it BOUND rather than the one it was
+ * asked for, which is the only number that is true when `PORT=0`. Waiting on a health
+ * URL cannot replace this: a health check answers from whoever holds the port, so it
+ * says "up" just as cheerfully when the answer is somebody else's process.
+ *
+ * It rejects on exit rather than waiting out the timeout, so a child that dies on
+ * startup reports the reason it printed instead of thirty seconds of nothing. */
+async function boundPort(
+  child: ChildProcess,
+  label: string,
+  timeoutMs = 30_000,
+): Promise<number> {
+  let output = "";
+  return new Promise<number>((resolve, reject) => {
+    const done = (fn: () => void) => {
+      clearTimeout(timer);
+      child.off("exit", onExit);
+      fn();
+    };
+    const timer = setTimeout(
+      () =>
+        done(() =>
+          reject(
+            new Error(`${label} never reported a listening port in ${timeoutMs}ms\n${output}`),
+          ),
+        ),
+      timeoutMs,
+    );
+    const onExit = (code: number | null) =>
+      done(() => reject(new Error(`${label} exited ${code} before listening\n${output}`)));
+    const onData = (chunk: Buffer | string) => {
+      output += String(chunk);
+      const m = /"msg":"listening","port":(\d+)/.exec(output);
+      if (m) done(() => resolve(Number(m[1])));
+    };
+    child.stdout?.on("data", onData);
+    child.stderr?.on("data", onData);
+    child.once("exit", onExit);
+  });
+}
+
 async function startApi(): Promise<{ url: string; credential: string; stop: () => void }> {
-  const port = 5200 + Math.floor(Math.random() * 200);
+  // NO BAND (feature 043, FR-001/FR-002). This drew from a hand-allocated range, and
+  // two of the nine such ranges contained a service the lane itself runs: NATS on
+  // 4222 and Postgres on 5432. `PORT=0` asks the OS instead of guessing.
   const dist = join(REPO, "services", "api", "dist");
   if (!existsSync(join(dist, "main.js"))) {
     throw new Error("the api is not built — run `pnpm build` before this lane");
@@ -91,13 +136,14 @@ async function startApi(): Promise<{ url: string; credential: string; stop: () =
   const child: ChildProcess = spawn("node", [join(dist, "main.js")], {
     env: {
       ...process.env,
-      PORT: String(port),
+      PORT: "0",
       RELAY_OUTBOX_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_AUTH_KEY_PREFIX: `rlauth-public-${randomUUID().slice(0, 8)}`,
     },
     stdio: ["ignore", "pipe", "pipe"],
   });
+  const port = await boundPort(child, "api");
   const url = `http://127.0.0.1:${port}`;
   await waitForHealth(`${url}/healthz`);
   return { url, credential: key.credential, stop: () => child.kill() };
```

The dispatcher's api child moves too — with one deliberate exception. Invariant 11
kills the api and starts another, and that restart must land back on the same
address, because the assertion is that the retry schedule survived in the DATABASE.

```diff title="services/dispatcher/src/dispatcher.itest.ts"
@@ -99,11 +99,54 @@ async function waitForHealth(url: string): Promise<void> {
 /** The api, as a child process. Extracted so invariant 11 can kill it and start
  * a new one — the point of that test is that neither process holds the retry
  * schedule, and a suite that could not restart the api could not show it. */
-function spawnApi(port: number, credential: string): ChildProcess {
+/** The port the OS actually gave a child, read from the child's own `listening` line.
+ *
+ * Feature 043 (FR-002). `main.ts` logs the address it BOUND rather than the one it was
+ * asked for, which is the only number that is true when `PORT=0`. Waiting on a health
+ * URL cannot replace this: a health check answers from whoever holds the port, so it
+ * says "up" just as cheerfully when the answer is somebody else's process.
+ *
+ * It rejects on exit rather than waiting out the timeout, so a child that dies on
+ * startup reports the reason it printed instead of thirty seconds of nothing. */
+async function boundPort(
+  child: ChildProcess,
+  label: string,
+  timeoutMs = 30_000,
+): Promise<number> {
+  let output = "";
+  return new Promise<number>((resolve, reject) => {
+    const done = (fn: () => void) => {
+      clearTimeout(timer);
+      child.off("exit", onExit);
+      fn();
+    };
+    const timer = setTimeout(
+      () =>
+        done(() =>
+          reject(
+            new Error(`${label} never reported a listening port in ${timeoutMs}ms\n${output}`),
+          ),
+        ),
+      timeoutMs,
+    );
+    const onExit = (code: number | null) =>
+      done(() => reject(new Error(`${label} exited ${code} before listening\n${output}`)));
+    const onData = (chunk: Buffer | string) => {
+      output += String(chunk);
+      const m = /"msg":"listening","port":(\d+)/.exec(output);
+      if (m) done(() => resolve(Number(m[1])));
+    };
+    child.stdout?.on("data", onData);
+    child.stderr?.on("data", onData);
+    child.once("exit", onExit);
+  });
+}
+
+function spawnApi(pinned: string, credential: string): ChildProcess {
   return spawn("node", [join(API_DIST, "main.js")], {
     env: {
       ...process.env,
-      PORT: String(port),
+      PORT: pinned,
       RELAY_INTERNAL_CREDENTIAL: credential,
       // Chapter 3.3's finding 4, for the third time: this suite drives the relay
       // explicitly, so a background copy draining the same table would race it.
@@ -371,11 +414,11 @@ describe("the dispatcher", () => {
     // bite is a back-to-back run whose previous child still holds the port, and
     // then the health check answers from an api serving a different environment.
     // See the port map at the top of `services/gateway/src/limits.itest.ts`.
-    apiPort = Number(
-      process.env["RELAY_DISPATCHER_ITEST_API_PORT"] ??
-        4310 + Math.floor(Math.random() * 60),
-    );
-    child = spawnApi(apiPort, CREDENTIAL);
+    // NO BAND (feature 043, FR-001/FR-002). This drew 4310-4369 out of nine
+    // hand-allocated ranges, two of which contained a service the lane runs. The
+    // override stays for deliberate pinning; otherwise the OS assigns.
+    child = spawnApi(process.env["RELAY_DISPATCHER_ITEST_API_PORT"] ?? "0", CREDENTIAL);
+    apiPort = await boundPort(child, "api");
     apiUrl = `http://127.0.0.1:${apiPort}`;
     await waitForHealth(`${apiUrl}/healthz`);
     // A per-run position, and only messages published after it exists. Sharing
@@ -623,7 +666,12 @@ describe("the dispatcher", () => {
     await dispatcher.stop();
     child.kill("SIGKILL");
     await new Promise((resolve) => setTimeout(resolve, 250));
-    child = spawnApi(apiPort, CREDENTIAL);
+    // THE SAME PORT, DELIBERATELY. The rest of this file lets the OS assign, but
+    // this restart has to land back on `apiUrl` — the assertion is that the schedule
+    // survived in the DATABASE, and reaching it through a different port would test
+    // the same thing while reading as though the address mattered. The predecessor was
+    // SIGKILLed 250 ms ago and the port is free.
+    child = spawnApi(String(apiPort), CREDENTIAL);
     await waitForHealth(`${apiUrl}/healthz`);
 
     // The schedule is exactly where it was, in a database neither process was
```

`presence.itest.ts` counted `select count(*) from outbox` — every row written by
anything — to assert that a presence transition writes none. Vitest runs this
package's files in parallel, so `membership.itest.ts` sending a message next door
moved the number: `expected 614255 to be 614250`, twice in eight runs, with nothing
in the failure suggesting a neighbour. The outbox has no `environment_id` column, so
the subject scopes it.

```diff title="services/gateway/src/presence.itest.ts"
@@ -149,7 +149,7 @@ async function startApi(): Promise<ApiUnderTest> {
   }
   const client = require_(join(dist, "db", "client.js")) as {
     createDb: (pool: unknown) => unknown;
-    createPool: () => { query: (sql: string) => Promise<unknown> };
+    createPool: () => { query: (sql: string, params?: unknown[]) => Promise<unknown> };
   };
   const seeder = require_(join(dist, "db", "repository.js")) as Seeder;
   const pool = client.createPool();
@@ -251,8 +251,22 @@ async function startApi(): Promise<ApiUnderTest> {
     url,
     credential: key.credential,
     subjects,
+    /** THIS ENVIRONMENT'S ROWS, NOT THE TABLE'S.
+     *
+     * This counted `select count(*) from outbox` — every row written by anything. The
+     * assertion it serves is "a presence transition writes no outbox row", and vitest
+     * runs this package's files in PARALLEL, so `membership.itest.ts` sending a message
+     * next door moved the number and the test reported `expected 614255 to be 614250`.
+     * Nothing in that failure suggests a neighbour.
+     *
+     * The outbox has no `environment_id` column — it keys on `subject`, and the subject
+     * carries the environment (`events.msg.created.<environment_id>`), so that is what
+     * scopes it. Measured: 2 failures in 8 consecutive runs before this. */
     outboxCount: async () => {
-      const result = (await pool.query("select count(*)::int as n from outbox")) as {
+      const result = (await pool.query(
+        "select count(*)::int as n from outbox where subject like '%' || $1 || '%'",
+        [environment.id],
+      )) as {
         rows: { n: number }[];
       };
       return result.rows[0]?.n ?? 0;
```


## The migration generator, retired

`drizzle-kit generate` turned `src/db/schema.ts` into the SQL under `migrations/`, and
`migrate.ts` applied it. ADR-16 has described those files as *"versioned, forward-only,
hand-reviewed SQL"* since chapter 3.9, which is not what a generator produces — so the
tooling contradicted the constitution rather than the other way round.

It had also stopped working in a way nobody would notice until they used it. drizzle-kit
keeps a snapshot per generated migration under `migrations/meta/`, and those snapshots
drifted: **fifteen SQL files against eight snapshots, seven behind.** Chapter 3.23 recorded
six, chapter 3.24 seven. A generator diffing against a seven-migration-old snapshot emits a
migration that re-creates tables that already exist.

The migration generator is retired (FR-023). This header said drizzle-kit generated
these files, and ADR-16 has said the opposite since chapter 3.9 — *"migrations remain
versioned, forward-only, hand-reviewed SQL"*. The tooling had contradicted the
constitution the whole time, and the snapshots under `migrations/meta/` had drifted to
**seven behind the directory**: fifteen SQL files against eight snapshots. A generator
that stale could only have produced a migration re-creating tables that already exist.

```diff title="services/api/src/db/migrate.ts"
@@ -8,9 +8,15 @@ import { createPool } from "./client";
 // Migrations as discipline (constitution: versioned, forward-only). There is
 // no down path — not missing, absent by design. Files apply in filename
 // order, each inside a transaction, each recorded; a re-run is a no-op.
-// drizzle-kit GENERATES these files from src/db/schema.ts; this runner —
-// not drizzle-kit's migrator — is the only thing that APPLIES them, so the
-// workspace has exactly one migration ledger: schema_migrations.
+// THESE FILES ARE HAND-WRITTEN AND REVIEWED AGAINST SAD §6.1 (feature 043,
+// FR-023). They were once generated by drizzle-kit from src/db/schema.ts, and
+// that arrangement contradicted the constitution from the day it started —
+// ADR-16 says "migrations remain versioned, forward-only, hand-reviewed SQL",
+// which a generator's output is not. The snapshots it kept in migrations/meta/
+// drifted to SEVEN behind the directory before they were removed, so the
+// generator could no longer have produced a correct diff even if anyone ran it.
+// This runner is the only thing that applies them, so the workspace has exactly
+// one migration ledger: schema_migrations.
 
 const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");
 
```

The same sentence, in the file the generator would have read.

```diff title="services/api/src/db/schema.ts"
@@ -19,7 +19,8 @@ import {
 
 // The TS twin of SAD §6.1 (ADR-16). The schema now exists twice — once as
 // the SAD's SQL truth, once here — and that drift risk is checked, not
-// assumed away: drizzle-kit GENERATES the migration SQL from these
+// assumed away: the migration SQL under migrations/ is hand-written from these
+// definitions and reviewed against SAD §6.1 (feature 043 retired the generator)
 // definitions, and the generated SQL is reviewed against §6.1 before the
 // runner applies it. The four tenant-bearing tables reproduce §6.1
 // column-for-column, constraints and DR citations included. Deliberately
```

And the dependency that made generating possible. `drizzle-orm` stays — it is the
query builder the repository layer is built on (ADR-16), and it has nothing to do with
generation.

```diff title="services/api/package.json"
@@ -34,7 +34,6 @@
     "@swc/core": "^1.15.47",
     "@types/nodemailer": "^8.0.1",
     "@types/pg": "^8.20.3",
-    "drizzle-kit": "^0.31.10",
     "unplugin-swc": "^1.5.9"
   }
 }
```

`drizzle.config.ts` goes with it. A config file for a retired tool is the thing that
invites the tool back, and this one imports `drizzle-kit`, so keeping it would have meant
keeping the dependency. What it used to say now lives in `migrate.ts`, which is the file
somebody opens to learn how migrations work, and `migrations.test.ts` is what holds it
there — asserting that the snapshots, the config and the dependency are all still gone.

```text title="services/api/drizzle.config.ts (deleted)"
```

