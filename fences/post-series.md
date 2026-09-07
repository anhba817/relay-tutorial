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

## One message-length maximum, and the door that never had one

FR-MSG-01 fixes the message-length maximum at 8,000 characters, and the platform enforced
it at two doors out of three. The REST body and the internal hop each spelled `8000` as a
literal; `messageSendSchema` — the socket door a customer's client writes to — carried
`z.string()` with no bound at all.

What that cost is not "no bound". The api's `internalSendRequestSchema` caught the
over-long text one hop later, so the customer got `invalid_request`, a code that names the
INTERNAL contract, for a field on the frame they wrote. Removing the bound and re-running
the test reproduces it exactly: `expected 'invalid_request' to be 'invalid_frame'`.

**The constant goes in `frames.ts`, not `attachments.ts`**, whose six exports are all about
attachments. And it is a constant rather than a shared schema for a reason chapter 3.24
paid for: `editMessageBodySchema.text` was once `sendMessageBodySchema.shape.text`, so
relaxing the send's `.min(1)` silently relaxed the edit's, and an edit has no attachments
field to justify empty text. **The maximum is common to all four sites; the floor is what
must differ. A number cannot drag a floor along with it.**

```diff title="packages/protocol/src/frames.ts"
@@ -15,6 +15,24 @@ import {
 /** Per-channel resume cursor: { channel_id: highest seq seen } (ADR-03). */
 export const cursorSchema = z.record(z.string(), z.number().int().positive());
 
+/** FR-MSG-01's message-length maximum, in one place because it is one rule (FR-008).
+ *
+ * THREE DOORS ENFORCE IT AND ONE OF THEM DID NOT. The REST body and the internal hop each
+ * spelled `8000` as a literal, and `messageSendSchema` below — the socket door a customer's
+ * client writes to — carried `z.string()` with no bound at all. A rule the contract
+ * publishes and one door does not enforce is the review's finding, and three literals is
+ * how it happened.
+ *
+ * NOT IN `attachments.ts`, whose six exports are all about attachments. A message-text
+ * bound on that shelf is the drift this constant exists to remove.
+ *
+ * A CONSTANT IS SAFE TO SHARE WHERE A SCHEMA WAS NOT. Chapter 3.24 found
+ * `editMessageBodySchema.text` defined as `sendMessageBodySchema.shape.text`, so relaxing
+ * the send's `.min(1)` silently relaxed the edit's — and an edit has no attachments to
+ * justify empty text. The maximum is common to all four sites; the FLOOR is what must
+ * differ. A number cannot drag a floor along with it. */
+export const MESSAGE_TEXT_MAX = 8000;
+
 /** The message on the wire — derived from the SAD §6.1 `messages` columns.
  * Wire spellings follow SAD §5.1's own frame line (`channel`, `seq`).
  *
@@ -69,7 +87,19 @@ export const messageSendSchema = z.strictObject({
     .strictObject({
       idem_key: z.string().min(1).max(255),
       channel: z.string().min(1),
-      text: z.string(),
+      /** BOUNDED HERE FOR THE FIRST TIME (feature 043, FR-008/FR-009).
+       *
+       * This was `z.string()`. The REST and internal doors have refused over-long text
+       * since chapter 2.2, and a socket client could send any length at all — the api's
+       * `internalSendRequestSchema` caught it one hop later, so the refusal named the
+       * internal contract rather than the field the customer wrote.
+       *
+       * The refusal now happens at the gateway, before the internal request is made:
+       * `session.ts:1452` fails the frame parse and answers `invalid_frame` with
+       * `payload.text` as the field. That is the same shape the attachments bound already
+       * takes, and `refineTextAndAttachments` below records why one payload must not be
+       * refused at two layers under two codes. */
+      text: z.string().max(MESSAGE_TEXT_MAX),
       /** OPTIONAL here and required on the outbound `messageSchema`, which is not an
        * inconsistency: a caller may send none, and a payload the platform BUILDS must
        * always say. The bound is imported rather than spelled — two schemas that happen
```

The internal door stops spelling the number.

```diff title="packages/protocol/src/internal.ts"
@@ -6,7 +6,7 @@ import {
   refineTextAndAttachments,
 } from "./attachments.js";
 
-import { messageSchema } from "./frames.js";
+import { MESSAGE_TEXT_MAX, messageSchema } from "./frames.js";
 
 // The INTERNAL service contract (chapter 2.5) — distinct from the wire
 // contract above it. `frames.ts` is what a customer's client speaks;
@@ -29,7 +29,7 @@ export const internalSendRequestSchema = z
      * would meet FR-019 on the REST door alone: a REST client could send a
      * photograph with no caption and a socket client could not, with no
      * requirement anywhere saying so. The 8,000 stays — FR-MSG-01 is untouched. */
-    text: z.string().max(8000), // FR-MSG-01
+    text: z.string().max(MESSAGE_TEXT_MAX), // FR-MSG-01, imported not spelled
     idempotency_key: z.string().min(1).max(255).optional(), // FR-MSG-04
     attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
   })
```

The REST door, and the edit body beside it — which keeps its own `.min(1)` and now
shares only the maximum.

```diff title="services/api/src/messages/messages.schema.ts"
@@ -1,6 +1,7 @@
 import {
   attachmentSchema,
   MAX_ATTACHMENTS,
+  MESSAGE_TEXT_MAX,
   refineTextAndAttachments,
 } from "@relay/protocol";
 import { z } from "zod";
@@ -15,7 +16,7 @@ export const sendMessageBodySchema = z
      * refinement below rather than disappearing. An attachments-only message is a
      * photograph with no caption, and it stores `text = ""` rather than a null so
      * chapter 3.23's tombstone predicate — `text === null` — is untouched. */
-    text: z.string().max(8000),
+    text: z.string().max(MESSAGE_TEXT_MAX),
     metadata: z.record(z.string(), z.unknown()).optional(),
     // Chapter 2.3 (FR-MSG-04): the client's idempotency key — minted at send
     // time (FR-SDK-06), optional because server-originated messages may not
@@ -53,10 +54,18 @@ export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
 
 /** The edit body (chapter 3.23, FR-001).
  *
- * THE SAME BOUNDS AS THE SEND BODY'S `text`, and the same reason: FR-MSG-01 fixes them
- * for a message and an edited message is still a message. Written as a reference to that
- * shape rather than as a second `z.string().min(1).max(8000)`, so the two cannot drift
- * when FR-EMJ-02's code-point counting replaces the character bound.
+ * THE SAME MAXIMUM AS THE SEND BODY'S `text` AND A DIFFERENT FLOOR, which is the whole
+ * history of this field in one line. FR-MSG-01 fixes the maximum for a message and an
+ * edited message is still a message, so both import `MESSAGE_TEXT_MAX` and neither
+ * spells it.
+ *
+ * THE FLOORS DIVERGED IN CHAPTER 3.24 AND MUST STAY DIVERGED. This paragraph used to say
+ * the field was "written as a reference to that shape" — it was
+ * `sendMessageBodySchema.shape.text` — and that is what broke: FR-019 removed the send's
+ * `.min(1)` so an attachments-only message could carry empty text, and the edit's floor
+ * went with it silently, because the types are identical either way. An edit has no
+ * attachments field to justify empty text. 3.24 separated them into two literals; this
+ * feature shares the number they agree on and leaves the rule they do not.
  *
  * ONE FIELD, AND THE ABSENCES ARE DECISIONS:
  *
@@ -84,7 +93,17 @@ export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
  * chapter has already recorded twice; two schemas that must DIFFER cannot share a
  * reference at all. */
 export const editMessageBodySchema = z.strictObject({
-  text: z.string().min(1).max(8000),
+  /** THE MAXIMUM IS SHARED; THE FLOOR IS NOT, AND THAT IS THE WHOLE POINT (FR-008).
+   *
+   * Chapter 3.24 found this field defined as `sendMessageBodySchema.shape.text`, so
+   * relaxing the send's `.min(1)` for attachments-only messages silently relaxed the
+   * edit's too — and an edit has no attachments field to restore its floor. The compiler
+   * could not see it: the types are identical either way.
+   *
+   * Importing a NUMBER cannot bring that back. `MESSAGE_TEXT_MAX` is FR-MSG-01's bound,
+   * common to all four doors; `.min(1)` is this schema's own rule and stays written here
+   * where it can be read. */
+  text: z.string().min(1).max(MESSAGE_TEXT_MAX),
 });
 
 export type EditMessageBody = z.infer<typeof editMessageBodySchema>;
```

The tests, including the one asserting that `messageSchema` is deliberately NOT
bounded: it is what the server emits, read off rows already stored, and a reader of
anything durable cannot impose a rule its writer did not have.

```diff title="packages/protocol/src/frames.test.ts"
@@ -1,9 +1,15 @@
 import { describe, expect, it } from "vitest";
 
-import { frameSchema, messageDeletedSchema, messageSchema, parseFrame } from "./frames.js";
+import {
+  frameSchema,
+  MESSAGE_TEXT_MAX,
+  messageDeletedSchema,
+  messageSchema,
+  parseFrame,
+} from "./frames.js";
 
 // The contract must bite: for every frame, one specimen that parses and a
 // table of malformed near-misses that MUST reject. A schema that accepts
 // garbage is worse than no schema — it certifies garbage.
 
 const message = {
@@ -277,6 +283,53 @@ describe("the frame union's membership (chapter 3.21)", () => {
     );
     expect(
       parseFrame({ type: "typing.send", payload: { channel: "c1" } }).success,
     ).toBe(true);
   });
 });
+
+describe("the message-length maximum (feature 043, FR-008)", () => {
+  const send = (text: string) =>
+    parseFrame({
+      type: "message.send",
+      payload: { idem_key: "k1", channel: "c1", text },
+    });
+
+  it("refuses a socket send one character over the maximum", () => {
+    // The door this feature closed. It was `z.string()` — no bound at all — so an
+    // over-long text parsed here and was refused one hop later by the api's
+    // `internalSendRequestSchema`, under a code that named the internal contract rather
+    // than the field the customer wrote.
+    expect(send("a".repeat(MESSAGE_TEXT_MAX)).success).toBe(true);
+    expect(send("a".repeat(MESSAGE_TEXT_MAX + 1)).success).toBe(false);
+  });
+
+  it("names `payload.text` when it refuses, which is what the gateway sends as `field`", () => {
+    // `session.ts` answers a failed frame parse with `invalid_frame` and
+    // `issues[0].path.join(".")`. This asserts the path that produces, because the
+    // field a customer sees is this array and not a string written anywhere.
+    const result = send("a".repeat(MESSAGE_TEXT_MAX + 1));
+    expect(result.success).toBe(false);
+    if (result.success) return;
+    expect(result.error.issues[0]?.path.join(".")).toBe("payload.text");
+  });
+
+  it("does NOT bound the outbound message, and that is deliberate", () => {
+    // `messageSchema` is what the server EMITS, read off rows the platform already
+    // stored. Chapter 3.24's `outboxEventSchema` defect is the argument: a reader of
+    // anything durable cannot impose a rule its writer did not have. Every stored row
+    // came through a bounded door, so the bound buys nothing here and would turn a
+    // hypothetical long row into an undeliverable one.
+    //
+    // This test exists because the task for FR-008 named THIS schema by line number.
+    const long = {
+      id: "m1",
+      channel: "c1",
+      seq: 1,
+      user: "u1",
+      text: "a".repeat(MESSAGE_TEXT_MAX + 1),
+      attachments: [],
+      created_at: "2026-09-06T00:00:00.000Z",
+    };
+    expect(messageSchema.safeParse(long).success).toBe(true);
+  });
+});
```


## The avatar URL's scheme

`avatar_url` was `z.string().url()`. Re-measured against zod 4.4.3 on 2026-09-06 — the same
table research R7 ran — that validator ACCEPTS `javascript:alert(1)`, `data:text/html,…`,
`file:///etc/passwd`, `vbscript:` and `ftp:`. It refuses `not-a-url` and little else.

So a field the API publishes as a URL would store a scheme the customer's own client
executes when it renders the avatar. `attachments.ts` said this in chapter 3.24 — *"A URL
validator that accepts `javascript:alert(1)` is not a scheme rule"* — and the avatar field,
which is older, never got the same treatment.

**The red probe proved it by writing two of them.** Reverting the rule to check the tests
could see its absence left `javascript:alert(1)` stored on two users, accepted with a 200.

One fragment, consumed by both the PATCH and the bulk upsert, because
`upsertUserEntrySchema`'s own comment already promises the two routes cannot drift into
accepting different things for the same column.

```diff title="services/api/src/users/users.schema.ts"
@@ -49,9 +49,46 @@ const userMetadataSchema = z
  * `null` CLEARS, and it is distinct from absent. `{"display_name": null}` removes the
  * name; `{}` leaves it. Both columns are nullable, so the API can express the difference
  * and a PATCH that could only set would leave a customer unable to undo one. */
+/** FR-011, FR-012. The schemes an avatar URL may use — a list, because the list is the
+ * requirement, and `packages/protocol/src/attachments.ts:49` is the precedent.
+ *
+ * `z.url()` IS NOT THIS CHECK. Re-measured against zod 4.4.3 on 2026-09-06, the same
+ * table research R7 ran: `z.string().url()` ACCEPTS `javascript:alert(1)`,
+ * `data:text/html,<b>`, `file:///etc/passwd`, `vbscript:` and `ftp:`. It refuses
+ * `not-a-url` and almost nothing else. So the field this API publishes as a URL would
+ * store a scheme the customer's own client executes when it renders the avatar — an
+ * `<img src>` or an `<a href>` built from a value we accepted.
+ *
+ * `attachments.ts` already said this in chapter 3.24 — *"A URL validator that accepts
+ * `javascript:alert(1)` is not a scheme rule"* — and the avatar field, which is older,
+ * never got the same treatment. One schema fragment, consumed twice below, because
+ * `upsertUserEntrySchema`'s own comment already promises the two routes "cannot drift
+ * into accepting different things for the same column". */
+export const AVATAR_URL_SCHEMES = ["http:", "https:"] as const;
+
+const avatarUrl = z
+  .string()
+  .url()
+  .max(2048)
+  .refine(
+    (value) => {
+      // `new URL`, not a prefix match. A prefix match passes `https:/example.test` and
+      // `httpsx://…` depending on how it is written, and the parser already knows what a
+      // scheme is. Same argument, same code, as `attachments.ts`.
+      let parsed: URL;
+      try {
+        parsed = new URL(value);
+      } catch {
+        return false;
+      }
+      return (AVATAR_URL_SCHEMES as readonly string[]).includes(parsed.protocol);
+    },
+    { message: "avatar_url must use the http or https scheme" },
+  );
+
 export const userProfileBodySchema = z.strictObject({
   display_name: z.string().min(1).max(255).nullable().optional(),
-  avatar_url: z.string().url().max(2048).nullable().optional(),
+  avatar_url: avatarUrl.nullable().optional(),
   metadata: userMetadataSchema.optional(),
   /** A bot's description, editable here (chapter 3.17, FR-004).
    *
@@ -89,7 +126,7 @@ export const upsertUserEntrySchema = z
   .strictObject({
     external_id: z.string().min(1).max(255),
     display_name: z.string().min(1).max(255).nullable().optional(),
-    avatar_url: z.string().url().max(2048).nullable().optional(),
+    avatar_url: avatarUrl.nullable().optional(),
     metadata: userMetadataSchema.optional(),
     /** What kind of thing this user is (chapter 3.17, FR-USR-07).
      *
```

And the tests, including the control that catches an over-tight refinement: a rule
refusing everything would pass the refusal test and break every customer.

```diff title="services/api/src/users/users.itest.ts"
@@ -485,6 +485,60 @@ describe("a user's channel listing", () => {
       body: JSON.stringify(body),
     });
 
+  // ── Feature 043: the avatar's scheme (FR-011, FR-012, SC-005) ───────────────
+  it("refuses an avatar_url whose scheme the browser would execute, naming the field", async () => {
+    // MEASURED, NOT ASSUMED. zod 4.4.3's `z.string().url()` accepts every one of these —
+    // re-run on 2026-09-06, the same table research R7 produced. The field is published
+    // as a URL and a customer's client renders it into an `<img src>` or an `<a href>`,
+    // so `javascript:` here is a value we handed them to execute.
+    await repo.createUser("schemer", "Schemer");
+    for (const bad of [
+      "javascript:alert(1)",
+      "data:text/html,<script>alert(1)</script>",
+      "file:///etc/passwd",
+      "vbscript:msgbox(1)",
+    ]) {
+      const res = await patchProfile("schemer", { avatar_url: bad });
+      expect(res.status).toBe(400);
+      const body = (await res.json()) as { code: string; field?: string };
+      // THE FIELD, NOT ONLY THE STATUS. A 400 that does not name `avatar_url` sends a
+      // customer to check their whole body, and this route takes four fields.
+      expect(body.field).toBe("avatar_url");
+    }
+  });
+
+  it("accepts http and https, so the rule is a scheme rule and not a ban on URLs", async () => {
+    // THE CONTROL, and it is the half that catches an over-tight refinement. A rule that
+    // refused everything would pass the test above and break every customer.
+    await repo.createUser("schemer-ok", "Fine");
+    for (const good of [
+      "https://cdn.example.com/a/b.png",
+      "http://cdn.example.com/a/b.png",
+    ]) {
+      const res = await patchProfile("schemer-ok", { avatar_url: good });
+      expect(res.status).toBe(200);
+    }
+  });
+
+  it("applies the same rule on the bulk upsert, not just the PATCH", async () => {
+    // TWO ROUTES, ONE FRAGMENT. `upsertUserEntrySchema`'s own comment promises the two
+    // "cannot drift into accepting different things for the same column" — and before
+    // this feature both accepted `javascript:`, which is agreement of the wrong kind.
+    const res = await fetch(`${url}/v1/users`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${credential}`,
+      },
+      body: JSON.stringify({
+        users: [{ external_id: "bulk-schemer", avatar_url: "javascript:alert(1)" }],
+      }),
+    });
+    expect(res.status).toBe(400);
+    const body = (await res.json()) as { field?: string };
+    expect(body.field).toContain("avatar_url");
+  });
+
   // ── T131: the round trip, all three fields (SC-011) ─────────────────────────
   it("round-trips display name, avatar url and metadata", async () => {
     await repo.createUser("profiled", "Before");
```

## A refusal that names the customer's mistake

Five throws in `webhooks.service.ts` were bare `UnprocessableEntityException`s.
`ProtocolErrorFilter` derives an error code from 400, 401, 403 and 404 and answers
`internal_error` for everything else — so every one of those refusals told a customer that
**Relay** had failed, when Relay had understood them perfectly and declined.

`codes.ts` had already written the rule they broke: *"a 422 MUST supply this code explicitly
through `protocolError` — an unnamed 422 ships a body calling itself an internal error"*. It
even named the five as still open. Reverting one and re-running the test reproduces it:
`expected 'internal_error' to be 'webhook_url_insecure'`.

**Six codes, not five.** Validating the event-type set creates a refusal that did not exist
to be counted. `codes.test.ts`'s exact-count assertion moves 21 -> 27 deliberately, which is
the fifth time that line has turned a new code into a decision rather than an accident.

**And the tests assert the code, not the status.** `webhooks.itest.ts` checked `status` and
the message text, both of which were right the whole time while the body said
`internal_error`. That is why this has been open since chapter 3.5.

```diff title="packages/protocol/src/codes.ts"
@@ -245,6 +245,39 @@ export const ERROR_CODES = {
    * platform no longer has — at which point it is deleted, not repurposed. */
   media_not_available:
     "hosted media is not available yet; attach an http or https url instead",
+  /** THE FIVE BARE 422s, NAMED (feature 043, FR-014). `gaps.md` records them as still
+   * open and the paragraph above says exactly what they cost: `ProtocolErrorFilter`
+   * answers `internal_error` for any status outside 400/401/403/404, so every one of
+   * these refusals told a customer the PLATFORM had failed when the platform had
+   * understood them perfectly and declined.
+   *
+   * SIX CODES, NOT FIVE. The plan said one per bare throw; validating the event-type set
+   * (FR-016) adds a refusal that did not exist to be counted. Chapter 3.24's plan
+   * expected one new code and shipped two, and `codes.test.ts`'s exact-count assertion is
+   * what caught it — so the count moves deliberately here rather than being discovered
+   * there.
+   *
+   * ALL 422 AND NOT 400. Each body is well-formed and each request is understood; what
+   * cannot be done is the thing it asks for. That is the same line `media_not_available`
+   * draws above. It is also why the avatar scheme rule in `users.schema.ts` is a 400 and
+   * these are not: a bad scheme fails SCHEMA validation, and these fail after it. */
+  webhook_endpoint_limit_reached:
+    "this environment already holds the maximum number of webhook endpoints; delete one before adding another",
+  webhook_url_invalid:
+    "the endpoint url is not a valid absolute url",
+  webhook_url_insecure:
+    "the endpoint url must use https — a signature over a plaintext channel protects the body, not the reader",
+  webhook_url_private_address:
+    "the endpoint url points at a loopback, link-local or private address, which this platform will not call",
+  webhook_event_types_empty:
+    "event_types must name at least one event type",
+  /** THE REFUSAL THE REVIEW ASKED FOR, AND NOT THE ONE IT RECOMMENDED. It says to compare
+   * a subscription with the types the platform EMITS. Measured: 741 stored subscriptions
+   * name `channel.created`, which FR-WHK-02 declares and the platform has not built. Those
+   * customers made no mistake, so the comparand is the DECLARED eight and this code is for
+   * a name outside them — a typo, which is the finding. */
+  webhook_event_type_unknown:
+    "that event type is not one this platform declares; the message names the accepted set",
   not_found:
     "no such resource for this tenant — and DELIBERATELY the same answer as for a resource in another tenant (FR-TEN-05)",
   internal_error:
```

And the count that makes the sixth a decision.

```diff title="packages/protocol/src/codes.test.ts"
@@ -77,7 +77,12 @@ describe("the registry is the whole vocabulary (FR-024)", () => {
     // its plan did not expect. **One pinned place, not the four chapter 3.22's close code
     // moved** — that chapter's task predicted two and found four, so this one counted
     // before editing: this assertion is the only place in the file that names a total.
-    expect(Object.keys(ERROR_CODES)).toHaveLength(21);
+    // Twenty-one until feature 043 named the five bare 422s in `webhooks.service.ts` and
+    // added the event-type refusal alongside them — SIX, where the plan said "one per
+    // customer-caused webhook refusal" and would have counted five. The sixth is FR-016's,
+    // and it did not exist to be counted until validating the set created it. Fifth time
+    // this line has turned a new code into a decision instead of an accident.
+    expect(Object.keys(ERROR_CODES)).toHaveLength(27);
   });
 
   it("names the non-author refusal separately from the generic 403 (chapter 3.23)", () => {
```

The five throws, and the event-type check beside them.

```diff title="services/api/src/webhooks/webhooks.service.ts"
@@ -1,9 +1,7 @@
-import {
-  Inject,
-  Injectable,
-  NotFoundException,
-  UnprocessableEntityException,
-} from "@nestjs/common";
+import { Inject, Injectable, NotFoundException } from "@nestjs/common";
+
+import { WEBHOOK_EVENT_TYPES } from "../outbox/event";
+import { protocolError } from "../protocol-error";
 
 import type { Db } from "../db/client";
 import {
@@ -85,8 +83,10 @@ export class WebhooksService {
 
     const existing = await this.repo.countEndpoints();
     if (existing >= MAX_ENDPOINTS_PER_ENVIRONMENT) {
-      throw new UnprocessableEntityException(
+      throw protocolError(
+        "webhook_endpoint_limit_reached",
         `an environment may have at most ${MAX_ENDPOINTS_PER_ENVIRONMENT} webhook endpoints; this one already has ${existing}`,
+        422,
       );
     }
 
@@ -190,25 +190,62 @@ export class WebhooksService {
     try {
       parsed = new URL(raw);
     } catch {
-      throw new UnprocessableEntityException("url must be a valid absolute URL");
+      throw protocolError(
+        "webhook_url_invalid",
+        "url must be a valid absolute URL",
+        422,
+        "url",
+      );
     }
     if (parsed.protocol !== "https:") {
-      throw new UnprocessableEntityException(
+      throw protocolError(
+        "webhook_url_insecure",
         "url must use https — a signature over a plaintext channel protects the body, not the reader",
+        422,
+        "url",
       );
     }
     const host = parsed.hostname;
     if (BLOCKED_HOSTS.test(host) || BLOCKED_RANGES.some((r) => r.test(host))) {
-      throw new UnprocessableEntityException(
+      throw protocolError(
+        "webhook_url_private_address",
         "url must not point at a loopback, link-local or private address",
+        422,
+        "url",
       );
     }
   }
 
+  /** FR-016. Validate against the DECLARED eight, not the emitted five.
+   *
+   * THE REVIEW AND `gaps.md` 3.23-1 BOTH RECOMMEND `OUTBOX_EVENT_TYPES`, AND BOTH ARE
+   * WRONG. That array holds the five types the platform emits; FR-WHK-02 declares eight.
+   * Measured before this was written: **741 stored subscriptions name
+   * `channel.created`**, which is declared and not yet built. Comparing against the
+   * emitted set would refuse every one of them, and those customers made no mistake —
+   * they subscribed to a published event type and are waiting for the feature.
+   *
+   * So a name outside the declared eight is a typo and is refused; a declared name the
+   * platform does not emit yet is accepted, and the refusal message for the typo names
+   * the set so a customer can see which they hit. */
   private assertEventTypes(types: string[]): void {
     if (!Array.isArray(types) || types.length === 0) {
-      throw new UnprocessableEntityException(
+      throw protocolError(
+        "webhook_event_types_empty",
         "event_types must list at least one event type",
+        422,
+        "event_types",
+      );
+    }
+    const declared = Object.keys(WEBHOOK_EVENT_TYPES);
+    const unknown = types.filter((t) => !declared.includes(t));
+    if (unknown.length > 0) {
+      throw protocolError(
+        "webhook_event_type_unknown",
+        `not an event type this platform declares: ${unknown.join(", ")}. ` +
+          `The accepted set is ${declared.join(", ")}.`,
+        422,
+        "event_types",
       );
     }
   }
```


## The declared eight, and the five that are built

FR-WHK-02 declares eight event types; the platform emits five. Those were two lists that had
to agree, maintained separately, with nothing comparing them — the defect `gaps.md` 3.23-4
records about `targets.ts`. Now `WEBHOOK_EVENT_TYPES` carries the eight with an `emitted`
flag each, `satisfies` makes a type added without deciding a compile error, and
`OUTBOX_EVENT_TYPES` is derived.

**The obvious derivation would have destroyed a production guarantee.**
`Object.entries(...).filter(...).map(...)` returns `string[]`, which widens
`OutboxEventType` to `string` — and `outboxEventSchema` is a discriminated union that must
cover every emitted type, because `consumer/runtime.ts:163` answers a failed parse with
`message.term()`. A missing branch is a customer's event destroyed, and the lane cannot see
it: it runs `RELAY_EVENT_CONSUMER=off`. So the union is derived at the type level and stays
as sharp as the tuple it replaced.

**The guarantee also turned out not to live where this file said it did.** `event.ts` has
claimed since chapter 3.23 that adding a type "forces a branch here". It did not — the
typecheck failure came from `event.test.ts`'s `Record<…, unknown>` map, which happens to be
exhaustive. A guarantee living in another file's incidental map is one a refactor deletes,
so there is now an explicit `Assert<…>` in `event.ts` itself. Removing a branch fails there
even with the test's map neutralised.

**Validation is against the declared eight and not the emitted five**, which is where the
review's recommendation was wrong. 838 stored subscriptions name `channel.created` —
declared, published, unbuilt. Comparing against the emitted set would refuse all of them.

```diff title="services/api/src/outbox/event.ts"
@@ -81,29 +81,67 @@ export interface MembershipChangedData {
  * WIDENED FROM A LITERAL. `type` was `"message.created"` alone, which is the shape a
  * consumer narrows on: every `switch` and every `===` against it sees this change,
  * which is what a typecheck catches and an integration lane does not. */
-/** THE ARRAY IS THE SOURCE AND THE TYPE IS DERIVED, so the set has a size a test can
- * read. A bare union has no runtime form: "the union has exactly three members" is
- * unassertable, and chapter 3.19's `codes.test.ts` earned its keep precisely by
- * asserting an exact set and an exact count — which is what makes a new member a
- * decision rather than an accident. `as const` plus `(typeof …)[number]` costs one
- * line and buys that. */
-export const OUTBOX_EVENT_TYPES = [
-  "message.created",
+/** FR-WHK-02's DECLARED SET, AND WHETHER THE PLATFORM EMITS EACH ONE (feature 043,
+ * FR-016).
+ *
+ * TWO LISTS THAT MUST AGREE AND ARE MAINTAINED SEPARATELY IS THE DEFECT. `gaps.md`
+ * 3.23-4 records it about `targets.ts`, and `eslint.config.mjs`'s own comment says *MUST
+ * AGREE* with nothing comparing them. The declared eight and the emitted five were
+ * exactly that pair: FR-WHK-02 names eight, this array named five, and the only thing
+ * connecting them was somebody remembering.
+ *
+ * `emitted` IS NOT OPTIONAL, AND THAT IS THE POINT. `satisfies Record<string, { emitted:
+ * boolean }>` makes a type added without deciding a compile error. A type declared and
+ * not emitted is a subscription a customer can create and never hear from — which is
+ * survivable when it is written down and a silent trap when it is not.
+ *
+ * THE THREE FALSE ONES ARE NOT OVERSIGHTS. `channel.created`, `user.connected` and
+ * `user.disconnected` are declared by FR-WHK-02 and unbuilt, and **741 stored
+ * subscriptions name `channel.created`**. The review and `gaps.md` 3.23-1 both recommend
+ * validating subscriptions against the EMITTED set; doing that would refuse those rows,
+ * and those customers made no mistake. */
+export const WEBHOOK_EVENT_TYPES = {
+  "message.created": { emitted: true },
   // CHAPTER 3.23's TWO, spelled as FR-WHK-02 spells them because a customer's
   // subscription filters on these exact strings.
-  //
-  // BROUGHT FORWARD FROM PHASE 9, and the reason is ADR-06 rather than convenience.
-  // `repository.deleteMessage` writes its event INSIDE the transaction that writes the
-  // tombstone — publishing after the commit leaves a window where the row changed and
-  // the event never existed — so the envelope cannot arrive three phases after the
-  // transaction that has to build it. FR-009's "no second event" is also unassertable
-  // without it: two 204s prove nothing, and the outbox row is what carries the
-  // requirement. `baseline.txt` records the ordering defect.
-  "message.updated",
-  "message.deleted",
-  "channel.member_added",
-  "channel.member_removed",
-] as const;
+  "message.updated": { emitted: true },
+  "message.deleted": { emitted: true },
+  "channel.created": { emitted: false },
+  "channel.member_added": { emitted: true },
+  "channel.member_removed": { emitted: true },
+  "user.connected": { emitted: false },
+  "user.disconnected": { emitted: false },
+} as const satisfies Record<string, { emitted: boolean }>;
+
+export type WebhookEventType = keyof typeof WEBHOOK_EVENT_TYPES;
+
+/** THE EMITTED NAMES, DERIVED AT THE TYPE LEVEL AND NOT ONLY AT RUNTIME.
+ *
+ * This is the part that cannot be done the obvious way.
+ * `Object.entries(...).filter(...).map(...)` returns `string[]`, which would widen
+ * `OutboxEventType` to `string` — and `outboxEventSchema` below is a discriminated union
+ * **exhaustive over those literals**. Widening it means every branch still typechecks and
+ * the compile error that catches a MISSING branch never fires again.
+ *
+ * What that error protects is not tidiness. `consumer/runtime.ts:163` answers a failed
+ * parse with `message.term()`, which stops redelivery for good, so a type added with no
+ * branch is a customer's event DESTROYED in production — and the api's own suite cannot
+ * see it, because it runs `RELAY_EVENT_CONSUMER=off`.
+ *
+ * So the union is derived from the object's literal keys, and stays as sharp as the
+ * hand-written tuple it replaced. */
+type Declared = typeof WEBHOOK_EVENT_TYPES;
+type EmittedName = {
+  [K in keyof Declared]: Declared[K]["emitted"] extends true ? K : never;
+}[keyof Declared];
+
+/** THE ARRAY IS STILL THE RUNTIME FORM, so the set has a size a test can read. A bare
+ * union has no runtime form: "the union has exactly five members" is unassertable, and
+ * chapter 3.19's `codes.test.ts` earned its keep by asserting an exact set and an exact
+ * count — which is what makes a new member a decision rather than an accident. */
+export const OUTBOX_EVENT_TYPES = (
+  Object.keys(WEBHOOK_EVENT_TYPES) as WebhookEventType[]
+).filter((name): name is EmittedName => WEBHOOK_EVENT_TYPES[name].emitted);
 
 export type OutboxEventType = (typeof OUTBOX_EVENT_TYPES)[number];
 
@@ -302,9 +340,13 @@ const envelope = {
  * second, permissive envelope in `packages/protocol/src/internal.ts:276` whose `type`
  * is `z.string().min(1)`, which is what a grep for "outboxEventSchema" finds first.
  *
- * Adding a type to `OUTBOX_EVENT_TYPES` now forces a branch here: the union is
- * exhaustive over the same three names, and a fourth added above without one below is
- * a typecheck failure rather than a terminated message in production. */
+ * Adding an emitted type forces a branch here — and until feature 043 this comment was
+ * overstating where that came from. `z.discriminatedUnion` builds from whatever branches
+ * are listed; nothing in this file compared them with the type. **The typecheck failure
+ * came from `event.test.ts:405`**, whose `Record<(typeof OUTBOX_EVENT_TYPES)[number],
+ * unknown>` happens to be exhaustive. A real guarantee living in another file's
+ * incidental map is one an unrelated refactor can delete. The assertion below moves it
+ * here, where the claim is made. */
 export const outboxEventSchema = z.discriminatedUnion("type", [
   z.strictObject({
     ...envelope,
@@ -409,3 +451,22 @@ export const outboxEventSchema = z.discriminatedUnion("type", [
     }),
   }),
 ]);
+
+/** COMPILE-TIME PROOF THAT EVERY EMITTED TYPE HAS A BRANCH ABOVE (feature 043).
+ *
+ * `Assert<T extends true>` fails to instantiate when the condition is false, so a type
+ * added to `WEBHOOK_EVENT_TYPES` with `emitted: true` and no branch in the union is a
+ * compile error in THIS file rather than a coincidence in a test.
+ *
+ * What it protects: `consumer/runtime.ts:163` answers a failed parse with
+ * `message.term()`, which stops redelivery permanently. A missing branch is a customer's
+ * event destroyed, and the lane cannot see it — it runs `RELAY_EVENT_CONSUMER=off`, so
+ * the api suite stayed green through 505 tests with exactly that defect in place.
+ *
+ * Exported rather than a local `const`, because an unused local trips this repository's
+ * eslint config, which sets no `varsIgnorePattern`. */
+type Assert<T extends true> = T;
+export type EveryEmittedTypeHasASchemaBranch = Assert<
+  OutboxEventType extends z.infer<typeof outboxEventSchema>["type"] ? true : false
+>;
+
```

A declared type the platform has not built is accepted — and the response says which. That
second half is the difference between this and silence: the review's finding is that a bad
subscription produces "a permanently silent endpoint", and subscribing to
`channel.created` produces exactly the same silence for a blameless reason. `not_emitted_yet`
is present only when non-empty, so an endpoint subscribed entirely to built types keeps the
response it always had.

```diff title="services/api/src/webhooks/webhooks.service.ts"
@@ -49,6 +49,15 @@ export interface CreateEndpointInput {
 /** What a customer receives once and never again. */
 export interface EndpointWithSecret extends WebhookEndpointRow {
   secret: string;
+  /** The subscribed types this platform declares and does not emit yet (FR-016).
+   *
+   * PRESENT ONLY WHEN NON-EMPTY, so an endpoint subscribed entirely to built types has
+   * the response it always had. This is the finding's actual remedy: the review describes
+   * a typo producing "a permanently silent endpoint", and a subscription to a
+   * declared-but-unbuilt type produces exactly the same silence for a different and
+   * blameless reason. Refusing it is wrong — 838 stored rows name `channel.created` — so
+   * the acceptance has to carry the distinction the refusal would have made. */
+  not_emitted_yet?: string[];
 }
 
 /** How long a caller waits for a test event to come back.
@@ -98,7 +107,12 @@ export class WebhooksService {
       eventTypes: input.event_types,
       secretCiphertext: encryptSecret(secret),
     });
-    return { ...row, secret };
+    const unemitted = this.unemittedAmong(input.event_types);
+    return {
+      ...row,
+      secret,
+      ...(unemitted.length > 0 ? { not_emitted_yet: unemitted } : {}),
+    };
   }
 
   list(): Promise<WebhookEndpointRow[]> {
@@ -228,6 +242,14 @@ export class WebhooksService {
    * So a name outside the declared eight is a typo and is refused; a declared name the
    * platform does not emit yet is accepted, and the refusal message for the typo names
    * the set so a customer can see which they hit. */
+  /** Which of these the platform declares and does not emit yet. */
+  private unemittedAmong(types: string[]): string[] {
+    return types.filter(
+      (t) => t in WEBHOOK_EVENT_TYPES &&
+        !WEBHOOK_EVENT_TYPES[t as keyof typeof WEBHOOK_EVENT_TYPES].emitted,
+    );
+  }
+
   private assertEventTypes(types: string[]): void {
     if (!Array.isArray(types) || types.length === 0) {
       throw protocolError(
```

## The ratchet, re-pinned

Three files this feature changed measured 100 on every metric, so they are pinned there —
`frames.ts`, `webhooks.service.ts` and `event.ts`. The pin's job is not to celebrate the
number; it is to stop a later change lowering it silently.

**Two are named as deliberately unpinned**, with their figures, because a file that quietly
falls off a ratchet list is indistinguishable from one nobody thought about.
`internal.ts` (92.68 / 85.71 / 60) had one literal replaced by an import and `codes.ts`
(83.33 / 100 / 50) gained six registry entries, which are data. Neither change moved those
numbers, and pinning a file at 85.71 ratchets a figure nobody chose.

**And 100% branches still does not mean every arm ran.** v8 records a `binary-expr` arm as
covered when the operand was evaluated, not when it went both ways — which is the number
constitution VI's 100%-branch clause is stated in.

```diff title="vitest.coverage.config.mts"
@@ -775,6 +775,43 @@ export default defineConfig({
           lines: 100,
           statements: 100,
         },
+        // FEATURE 043's THREE, ALL AT 100 ON EVERY METRIC.
+        //
+        // `frames.ts` gained `MESSAGE_TEXT_MAX` and the bound on the socket door;
+        // `webhooks.service.ts` had all five bare 422s replaced and gained the event-type
+        // check; `event.ts` gained the declared-eight object and the compile-time
+        // assertion that every emitted type has a schema branch.
+        //
+        // Pinned because they measured 100 and not because 100 was the target — the
+        // ratchet's job is to stop a later change lowering them silently.
+        "packages/protocol/src/frames.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/webhooks/webhooks.service.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/outbox/event.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // NOT PINNED, AND NAMED RATHER THAN QUIETLY OMITTED (feature 043):
+        //
+        //   packages/protocol/src/internal.ts   92.68 lines · 85.71 branches · 60 funcs
+        //   packages/protocol/src/codes.ts      83.33 lines · 100 branches · 50 funcs
+        //
+        // Both were touched by this feature and neither was touched in a way that moved
+        // these numbers: `internal.ts` had one literal replaced with an import, and
+        // `codes.ts` gained six registry ENTRIES, which are data. Pinning a file at 85.71
+        // ratchets a number nobody chose, and the honest version is to say so here — the
+        // omission is a decision, not an oversight.
       },
     },
   },
```

## A channel counts its own revisions

Resume is ordered by the channel sequence, and an edit or a deletion carries the sequence of
the message it CHANGES rather than a new one. A message revised below a client's cursor is
therefore in neither the replay nor the live stream — and consumes no sequence, so no gap
appears for a client to notice. SRS FR-016a already said the stale copy was repairable by
re-reading history; nothing told a client when to.

**Measured before it was built.** A client holding message seq 1, reconnecting on cursor 2
after that message was edited, received exactly one frame — the ack — and zero sequences. The
same probe confirmed the other half: a message edited ABOVE the cursor comes back on the
replay carrying its new text, because the backfill reads current state.

One column, `bigint` to match `last_sequence`, `default 0` so existing channels start where
every client's stored count starts. **A count reconstructed from history would have been
correct and useless** — it would exceed every client's stored count on the first reconnect
after shipping and tell every client to repair every channel once.

```diff title="services/api/src/db/schema.ts"
@@ -326,6 +326,22 @@ export const channels = pgTable(
     lastSequence: bigint("last_sequence", { mode: "number" })
       .notNull()
       .default(0), // ADR-03
+    /** How many revisions this channel's messages have received (feature 044, FR-001).
+     *
+     * A REVISION IS AN EDIT OR A DELETION, and each raises this by exactly one. A SEND
+     * DOES NOT (FR-011): a new message is delivered by the ordinary replay, and counting
+     * sends here would make every active channel report a repair after every absence.
+     *
+     * WHAT IT ANSWERS. Resume is ordered by `lastSequence` above, and a revision carries
+     * the sequence of the message it changes rather than a new one — so a message revised
+     * below a client's cursor reaches it on no frame and consumes no sequence, leaving no
+     * gap to notice. This is the number a reconnecting client compares against to learn
+     * that it holds something stale.
+     *
+     * `{ mode: "number" }` and `bigint`, matching `lastSequence` for the same reason. */
+    revisionSequence: bigint("revision_sequence", { mode: "number" })
+      .notNull()
+      .default(0),
     archivedAt: timestamp("archived_at", { withTimezone: true }),
     // WHEN THIS CHANNEL LAST TOOK A MESSAGE (chapter 3.15, FR-014).
     //
```


The counter rises inside the transaction that applies the revision, so a revision that commits
and a count that rises are the same event. **After** the compare-and-set on the edit path,
which refuses an edit to an already-deleted message by affecting zero rows — bumping before it
would raise the count for an edit that then threw.

**A deletion is a revision**, and raises the count exactly as an edit does. The test that
catches the opposite mistake is the one asserting a SEND does not: a counter bumped on send
makes every active channel report a repair after every absence, and every other assertion
passes with that defect in place.

```diff title="services/api/src/db/repository.ts"
@@ -3275,18 +3275,39 @@ export class Repository {
     return rows.map((r) => r.user_id);
   }
 
-  async channelsForUser(userId: string): Promise<string[]> {
-    const rows = await this.db
-      .select({ channel_id: members.channelId })
+  /** The channels a user belongs to, each with its revision count (feature 044, FR-014).
+   *
+   * ONE QUERY, NOT TWO. The count could have come from a second call, and giving each
+   * caller its own is the two-lists-that-must-agree defect `gaps.md` 3.23-4 records about
+   * `targets.ts` — two things that must match, maintained separately, with nothing
+   * comparing them. The join costs nothing: `members` is already reached and `channels` is
+   * one hop from it on a primary key.
+   *
+   * FR-014 IS WHY THE COUNT RIDES THIS QUERY AT ALL. At 10,000 connections a per-channel
+   * read per handshake is 10,000 extra reads, and the reconnect rate measured before this
+   * feature was 1,402 per second. The count has to arrive on work the api already does.
+   *
+   * TWO CALLERS, AND BOTH ARE REPAIRED IN THE SAME CHANGE. `session.controller.ts` wants
+   * the counts; `memberships.controller.ts` wants ids alone and maps them. Widening the
+   * return without fixing both leaves the second assigning objects to a `string[]`, which
+   * is a typecheck failure at exactly the boundary this project commits at. */
+  async channelsForUser(
+    userId: string,
+  ): Promise<{ channel_id: string; revision_sequence: number }[]> {
+    return await this.db
+      .select({
+        channel_id: members.channelId,
+        revision_sequence: channels.revisionSequence,
+      })
       .from(members)
       .innerJoin(users, eq(users.id, members.userId))
+      .innerJoin(channels, eq(channels.id, members.channelId))
       .where(
         and(
           eq(members.userId, userId),
           eq(users.environmentId, this.environmentId),
         ),
       );
-    return rows.map((r) => r.channel_id);
   }
 
   /** Upsert a user by external id, updating the profile fields present (chapter 3.15,
@@ -4565,6 +4586,25 @@ export class Repository {
       if (!updated) throw new MessageDeletedError(messageId);
       const editedAt = updated.editedAt!;
 
+      // FEATURE 044, FR-002/FR-003. The channel's revision counter rises by one, inside the
+      // transaction that applies the revision — so a revision that commits and a count that
+      // rises are the same event, and a count can never describe a revision the transaction
+      // refused.
+      //
+      // AFTER THE COMPARE-AND-SET ABOVE, deliberately. That statement refuses an edit to an
+      // already-deleted message by affecting zero rows; bumping before it would raise the
+      // count for an edit that then threw.
+      //
+      // AN EXTRA ROUND TRIP, AND THE RIGHT SIDE OF THE TRADE. The send path updates this row
+      // anyway, so `lastActivityAt` there "costs an extra assignment rather than an extra
+      // round trip"; this path touches `messages` and `message_edits` only, so the counter
+      // costs one UPDATE. Revisions are rare and reconnects are not, and the alternative puts
+      // a scan on the handshake (FR-014).
+      await tx
+        .update(channels)
+        .set({ revisionSequence: sql`${channels.revisionSequence} + 1` })
+        .where(eq(channels.id, channelId));
+
       // FR-004. The row carries what the message said BEFORE this edit — `row.text`,
       // read above and narrowed to a string by the tombstone check.
       //
@@ -4798,6 +4838,14 @@ export class Repository {
       // assigned, and the event and the frame must both quote that one.
       const deletedAt = toIso(updated!.deletedAt!);
 
+      // FEATURE 044, FR-002/FR-003. A DELETION IS A REVISION and raises the count exactly as
+      // an edit does — US1's third acceptance scenario fails if only edits are counted. Same
+      // transaction, same argument as the edit path.
+      await tx
+        .update(channels)
+        .set({ revisionSequence: sql`${channels.revisionSequence} + 1` })
+        .where(eq(channels.id, channelId));
+
       // THE EVENT COMMITS WITH THE TOMBSTONE (ADR-06), on the send path's argument at
       // its own outbox insert: publishing after the commit leaves a gap where the row
       // changed and the event never existed, silently, with nothing to reconcile.
```


The count reaches the gateway on the membership query the api already runs, because at 10,000
connections a per-channel read per handshake is 10,000 extra reads — the reconnect rate
measured before this feature was 1,402 per second. **Both callers of that query are repaired
in the same change**: widening the return without fixing both leaves the second assigning
objects to a `string[]`.

```diff title="services/api/src/internal/session.controller.ts"
@@ -126,7 +126,10 @@ export class SessionController {
       // verified token naming somebody with no row, which chapter 2.5 decided is a user
       // with no channels rather than an error — and a user with no row has no ban either.
       banned: user?.banned_at != null,
-      channel_ids: user ? await this.repo.channelsForUser(user.id) : [],
+      // Ids here; the counts ride the same rows and are filled in below (feature 044).
+      channel_ids: user
+        ? (await this.repo.channelsForUser(user.id)).map((c) => c.channel_id)
+        : [],
       limits: {
         connect: policy.limits.connect,
         send: policy.limits.send,
```

And the caller that wants ids alone maps them off, so one query stands behind both.

```diff title="services/api/src/internal/memberships.controller.ts"
@@ -65,7 +65,12 @@ export class MembershipsController {
       req.principal.userExternalId,
     );
     return {
-      channel_ids: user ? await this.repo.channelsForUser(user.id) : [],
+      // Ids alone: this route answers what a user may hear, not what has changed in it.
+      // `channelsForUser` carries revision counts for the session route (feature 044);
+      // mapping them off here keeps one query behind both.
+      channel_ids: user
+        ? (await this.repo.channelsForUser(user.id)).map((c) => c.channel_id)
+        : [],
     };
   }
 }
```

The tests, including the one that asserts a send moves nothing.

```diff title="services/api/src/db/repository.itest.ts"
@@ -1437,6 +1437,106 @@ describe("the read shapes that do NOT carry attachments (FR-009 (3.24))", () =>
 // that two operations issued on one connection serialise at the socket, so a test built
 // that way proves the code cannot race by never letting it. The third case below uses
 // TWO POOLS, which is what that chapter found it needed.
+describe("the channel's revision counter (feature 044, FR-002, FR-003, FR-011)", () => {
+  const countFor = async (channelId: string): Promise<number> => {
+    const [row] = (
+      await db.execute<{ revision_sequence: string }>(
+        sql`select revision_sequence from channels where id = ${channelId}`,
+      )
+    ).rows;
+    return Number(row!.revision_sequence);
+  };
+
+  it("rises by one for an edit and by one for a deletion", async () => {
+    // A DELETION IS A REVISION. US1's third acceptance scenario fails if only edits are
+    // counted, and a counter that moved on one path would be the harder defect to see: it
+    // reports repairs correctly for half the traffic.
+    const author = await repoA.createUser("t044-a", "A");
+    const channel = await repoA.createChannel("t044-a", "public");
+    await repoA.addMember(channel.id, author.id);
+    expect(await countFor(channel.id)).toBe(0);
+
+    const m1 = await repoA.sendMessage(channel.id, {
+      text: "one", userId: author.id, userExternalId: "t044-a",
+    });
+    const m2 = await repoA.sendMessage(channel.id, {
+      text: "two", userId: author.id, userExternalId: "t044-a",
+    });
+
+    await repoA.editMessage(channel.id, m1.id, { text: "one edited", userId: author.id });
+    expect(await countFor(channel.id)).toBe(1);
+
+    await repoA.deleteMessage(channel.id, m2.id, { userId: author.id, userExternalId: "t044-a" });
+    expect(await countFor(channel.id)).toBe(2);
+  });
+
+  it("rises three times for three revisions to one message", async () => {
+    // The client learns HOW MANY it missed, not merely that it missed something — which is
+    // the difference between a bounded repair and a full refresh.
+    const author = await repoA.createUser("t044-b", "B");
+    const channel = await repoA.createChannel("t044-b", "public");
+    await repoA.addMember(channel.id, author.id);
+    const m = await repoA.sendMessage(channel.id, {
+      text: "v0", userId: author.id, userExternalId: "t044-b",
+    });
+
+    for (const text of ["v1", "v2", "v3"]) {
+      await repoA.editMessage(channel.id, m.id, { text, userId: author.id });
+    }
+    expect(await countFor(channel.id)).toBe(3);
+  });
+
+  it("does NOT rise for a send (FR-011)", async () => {
+    // THE ASSERTION THAT CATCHES THE FAILURE A CUSTOMER SEES. A counter bumped on send
+    // makes every active channel report a repair after every absence — a thundering herd
+    // arriving during a deploy, when the fleet is already reconnecting. Every other test
+    // here passes with that defect in place.
+    const author = await repoA.createUser("t044-c", "C");
+    const channel = await repoA.createChannel("t044-c", "public");
+    await repoA.addMember(channel.id, author.id);
+
+    for (const text of ["a", "b", "c", "d", "e"]) {
+      await repoA.sendMessage(channel.id, { text, userId: author.id, userExternalId: "t044-c" });
+    }
+    expect(await countFor(channel.id)).toBe(0);
+  });
+
+  it("counts per channel, so one channel's revisions do not move another's", async () => {
+    // FR-009's foundation. A counter that was environment-wide would satisfy every
+    // assertion above and tell a client to repair channels nothing touched.
+    const author = await repoA.createUser("t044-d", "D");
+    const left = await repoA.createChannel("t044-d-left", "public");
+    const right = await repoA.createChannel("t044-d-right", "public");
+    await repoA.addMember(left.id, author.id);
+    await repoA.addMember(right.id, author.id);
+    const m = await repoA.sendMessage(left.id, {
+      text: "in left", userId: author.id, userExternalId: "t044-d",
+    });
+
+    await repoA.editMessage(left.id, m.id, { text: "edited in left", userId: author.id });
+
+    expect(await countFor(left.id)).toBe(1);
+    expect(await countFor(right.id)).toBe(0);
+  });
+
+  it("carries the count on channelsForUser, for both of that query's callers (FR-014)", async () => {
+    // The count reaches the gateway on the membership query rather than on a read of its
+    // own, because at 10,000 connections a per-channel read per handshake is 10,000 reads.
+    const author = await repoA.createUser("t044-e", "E");
+    const channel = await repoA.createChannel("t044-e", "public");
+    await repoA.addMember(channel.id, author.id);
+    const m = await repoA.sendMessage(channel.id, {
+      text: "x", userId: author.id, userExternalId: "t044-e",
+    });
+    await repoA.editMessage(channel.id, m.id, { text: "y", userId: author.id });
+
+    const rows = await repoA.channelsForUser(author.id);
+    const row = rows.find((r) => r.channel_id === channel.id);
+    expect(row).toBeDefined();
+    expect(row!.revision_sequence).toBe(1);
+  });
+});
+
 describe("a concurrent edit and deletion (feature 043, FR-007)", () => {
   const seed = async (label: string) => {
     const author = await repoA.createUser(`${label}-author`, "Author");
```

### The shape the count travels in

Two schemas, and the second one exists because of one word in the first. `cursorSchema` is
`.positive()` — every channel that has never been revised has a count of **zero**, so reusing it
would have made an unrevised channel unrepresentable, forced the api to omit it, and left the
gateway unable to tell "no revisions" from "not reported". Those are exactly the two states the
client contract turns on.

The ack's field is **required**, not optional, and that is the correct direction here for the
reason chapter 3.24 got wrong from the other side: required is a claim about what you WRITE, and
the platform builds every ack it sends. A reader of anything durable — 3.24's `outboxEventSchema`
— cannot require a field its writer did not have. The two cases look identical in a diff and
invert in consequence.

```diff title="packages/protocol/src/frames.ts"
@@ -12,12 +12,29 @@ import {
 // so the types and the validation cannot drift — there is no second
 // definition. Payloads are strict: unknown fields are rejected.
 
 /** Per-channel resume cursor: { channel_id: highest seq seen } (ADR-03). */
 export const cursorSchema = z.record(z.string(), z.number().int().positive());
 
+/** Per-channel revision count: { channel_id: revisions this channel has seen } (feature 044).
+ *
+ * NOT `cursorSchema`, AND THE DIFFERENCE IS ONE WORD. That schema is `.positive()`, and every
+ * channel that has never been revised has a count of **zero** — so reusing it would make an
+ * unrevised channel unrepresentable, force the api to omit it, and leave the gateway unable to
+ * tell "no revisions" from "not reported". Those are exactly the two states FR-007 turns on: a
+ * count of zero can signal a repair once the channel is revised, and an absent count never
+ * does, because the client holds nothing there to be stale.
+ *
+ * A COUNTER RATHER THAN A TIMESTAMP (FR-010). A clock the client and the platform disagree
+ * about produces wrong repairs in both directions, and a counter answers "how many" for free —
+ * which is the difference between a bounded repair and a full refresh. */
+export const revisionCountSchema = z.record(
+  z.string(),
+  z.number().int().nonnegative(),
+);
+
 /** FR-MSG-01's message-length maximum, in one place because it is one rule (FR-008).
  *
  * THREE DOORS ENFORCE IT AND ONE OF THEM DID NOT. The REST body and the internal hop each
  * spelled `8000` as a literal, and `messageSendSchema` below — the socket door a customer's
  * client writes to — carried `z.string()` with no bound at all. A rule the contract
  * publishes and one door does not enforce is the review's finding, and three literals is
@@ -72,12 +89,31 @@ export const connectionAckSchema = z.strictObject({
   type: z.literal("connection.ack"),
   payload: z.strictObject({
     user: z.string().min(1),
     cursor: cursorSchema,
     resume_ok: z.boolean(),
     truncated: z.array(z.string().min(1)),
+    /** How many revisions each of this user's channels has seen (feature 044, FR-004).
+     *
+     * WHAT IT IS FOR. Resume is ordered by the channel sequence, and an edit or a deletion
+     * carries the sequence of the message it CHANGES rather than a new one — so a message
+     * revised below this client's cursor arrives on no frame and consumes no sequence,
+     * leaving no gap to notice. Measured: a client on cursor 2 whose message at seq 1 was
+     * edited while away receives exactly this ack and nothing else. SRS FR-016a says the
+     * stale copy is repairable by re-reading history; this is what says when.
+     *
+     * EVERY CHANNEL THE USER BELONGS TO, including those at zero and those the client asked
+     * nothing about (FR-007a). A client needing no repair still needs a baseline to store,
+     * or its next reconnect is the first one again.
+     *
+     * A CLIENT COMPARES, THE PLATFORM DOES NOT DECIDE. Higher here than the client holds
+     * means one or more messages it already has were revised; equal means nothing was; and
+     * a client presenting MORE than this is told nothing is needed rather than refused
+     * (FR-008) — refusing over a number the client supplied is a denial of service the
+     * client controls. */
+    revisions: revisionCountSchema,
   }),
 });
 
 /** Client → server send (SAD §5.1: `message.send {idem_key, channel, text}`).
  * The idempotency key is client-supplied (FR-SDK-06), deduplicated
  * server-side within 24 h (FR-MSG-04). */
```

The internal hop carries the same map, and **only on the session response**. The memberships
response is a backstop that answers "is this user still in this channel"; a revision count there
would be a second place for the same number to be read from and disagree.

`.default({})` follows `banned`'s precedent in this same schema: during a rolling deploy an api
built before this feature still satisfies it, and the gateway then reports every channel at zero
— which is the pre-feature behaviour rather than a crash at the door.

```diff title="packages/protocol/src/internal.ts"
@@ -3,13 +3,17 @@ import { z } from "zod";
 import {
   attachmentSchema,
   MAX_ATTACHMENTS,
   refineTextAndAttachments,
 } from "./attachments.js";
 
-import { MESSAGE_TEXT_MAX, messageSchema } from "./frames.js";
+import {
+  MESSAGE_TEXT_MAX,
+  messageSchema,
+  revisionCountSchema,
+} from "./frames.js";
 
 // The INTERNAL service contract (chapter 2.5) — distinct from the wire
 // contract above it. `frames.ts` is what a customer's client speaks;
 // this is what the gateway and the API service speak to each other over
 // the internal HTTP hop (ADR-05).
 //
@@ -170,12 +174,37 @@ export const internalMembershipsResponseSchema = z.strictObject({
  * `user` is the EXTERNAL id, as everywhere else on this contract: internal uuids
  * are the api's business. */
 export const internalSessionResponseSchema = z.strictObject({
   environment_id: z.string().min(1),
   user: z.string().min(1),
   channel_ids: z.array(z.string().min(1)),
+  /** How many revisions each of those channels has seen (feature 044, FR-004, FR-014).
+   *
+   * IT RIDES THIS RESPONSE FOR THE REASON `banned` AND THE LIMITS DO: the gateway has no
+   * database and must not gain one, `revision_sequence` is a column in Postgres, and the api
+   * is the only service that reads Postgres. So the counts travel on the one call the gateway
+   * already makes at connect — no new table reaches the gateway and no new round trip is
+   * added. At 10,000 connections a second call per handshake is 10,000 calls, and the
+   * reconnect rate measured before this feature was 1,402 per second.
+   *
+   * ON THIS RESPONSE AND NOT ON `internalMembershipsResponseSchema` above. That route answers
+   * what a user MAY HEAR — the periodic re-read ADR-20 uses as its backstop — and a revision
+   * count is no part of that question. The watermark is a connect-time signal.
+   *
+   * A PARALLEL MAP RATHER THAN A WIDENED `channel_ids`. Eleven chapters publish that field;
+   * turning it into an array of objects would edit all of them for a field they do not read.
+   * The keys here are the ids above.
+   *
+   * `revisionCountSchema` IMPORTED, NOT RESPELLED. The same shape appears on the ack, and two
+   * records that must agree and are maintained separately is the defect `gaps.md` 3.23-4
+   * records about `targets.ts` — one file apart in this case.
+   *
+   * `.default({})` FOR THE DEPLOY WINDOW, following `banned` below: an api built before this
+   * feature still satisfies the schema during a rolling deploy, and the gateway then reports
+   * every channel at zero, which is today's behaviour. */
+  channel_revisions: revisionCountSchema.default({}),
   /** Chapter 3.15, FR-031. Whether this user is banned in this environment.
    *
    * IT RIDES THIS RESPONSE FOR THE REASON THE LIMITS DO: the gateway has no database and
    * must not gain one, `banned_at` is a column in Postgres, and the api is the only
    * service that reads Postgres. So the ban travels on the one call the gateway already
    * makes at connect — no new table reaches the gateway and no new round trip is added.
```

**The protocol's own suite went red the moment the field became required**, at the specimen every
frame test parses. That is the pinned place a payload change is supposed to move, and it was
repaired rather than relaxed.

```diff title="packages/protocol/src/frames.test.ts"
@@ -1,14 +1,17 @@
 import { describe, expect, it } from "vitest";
 
 import {
+  connectionAckSchema,
+  cursorSchema,
   frameSchema,
   MESSAGE_TEXT_MAX,
   messageDeletedSchema,
   messageSchema,
   parseFrame,
+  revisionCountSchema,
 } from "./frames.js";
 
 // The contract must bite: for every frame, one specimen that parses and a
 // table of malformed near-misses that MUST reject. A schema that accepts
 // garbage is worse than no schema — it certifies garbage.
 
@@ -26,13 +29,24 @@ const message = {
   created_at: "2026-08-01T09:00:00.000Z",
 };
 
 const valid: Record<string, unknown> = {
   "connection.ack": {
     type: "connection.ack",
-    payload: { user: "u1", cursor: { c1: 42 }, resume_ok: true, truncated: [] },
+    // Feature 044: `revisions` is REQUIRED here, and this specimen went red the moment it
+    // was added — which is the point. The ack is a frame the platform BUILDS, so required
+    // is what makes every construction site name it. Chapter 3.24's inverse case is the
+    // one to keep straight: a reader of anything durable cannot require a field its writer
+    // did not have, and `outboxEventSchema` learned that the expensive way.
+    payload: {
+      user: "u1",
+      cursor: { c1: 42 },
+      resume_ok: true,
+      truncated: [],
+      revisions: { c1: 7 },
+    },
   },
   "message.send": {
     type: "message.send",
     payload: { idem_key: "k-1", channel: "c1", text: "hi" },
   },
   "message.ack": { type: "message.ack", payload: { seq: 43 } },
@@ -330,6 +344,72 @@ describe("the message-length maximum (feature 043, FR-008)", () => {
       attachments: [],
       created_at: "2026-09-06T00:00:00.000Z",
     };
     expect(messageSchema.safeParse(long).success).toBe(true);
   });
 });
+
+describe("the revision count on the ack (feature 044, FR-004, FR-007, FR-009)", () => {
+  const ack = (revisions: unknown) =>
+    parseFrame({
+      type: "connection.ack",
+      payload: {
+        user: "u1",
+        cursor: { c1: 42 },
+        resume_ok: true,
+        truncated: [],
+        revisions,
+      },
+    });
+
+  it("accepts a count of ZERO, which is the whole reason it is not `cursorSchema`", () => {
+    // The two schemas differ by one word — `.positive()` against `.nonnegative()` — and
+    // the difference decides whether a never-revised channel can be reported at all.
+    // Reusing `cursorSchema` would have forced the api to omit those channels, and an
+    // omitted channel is indistinguishable from one the platform never mentioned, which
+    // is exactly the pair FR-007 turns on.
+    expect(ack({ c1: 0 }).success).toBe(true);
+    expect(cursorSchema.safeParse({ c1: 0 }).success).toBe(false);
+    // And the other direction still holds, so nothing was relaxed by accident: a cursor
+    // of zero is still refused, because sequence numbering starts at one.
+    expect(cursorSchema.safeParse({ c1: 1 }).success).toBe(true);
+  });
+
+  it("REQUIRES the field, because the platform is the one that builds it", () => {
+    // The specimen above went red when this was added and was repaired rather than
+    // relaxed. Required on a frame the server emits names every construction site; the
+    // compiler cannot do that for an optional field.
+    const withoutIt = connectionAckSchema.safeParse({
+      type: "connection.ack",
+      payload: { user: "u1", cursor: {}, resume_ok: true, truncated: [] },
+    });
+    expect(withoutIt.success).toBe(false);
+  });
+
+  it("refuses a negative count and a fractional one", () => {
+    // A count that falls would silently tell a client it is up to date (FR-002), and a
+    // fraction is not a number of revisions. Neither is reachable from the writer, which
+    // is why the door is here rather than trusted upstream.
+    expect(ack({ c1: -1 }).success).toBe(false);
+    expect(ack({ c1: 1.5 }).success).toBe(false);
+    expect(ack({ c1: "7" }).success).toBe(false);
+  });
+
+  it("does not require the cursor and the counts to name the same channels", () => {
+    // The joined-during-absence case, at the schema layer. A client resuming presents a
+    // cursor for the channels it held; the platform reports counts for every channel the
+    // user belongs to, which is a superset. A schema that tied them together would make
+    // the correct response unrepresentable.
+    expect(ack({ c1: 3, c2: 0 }).success).toBe(true);
+    // And the empty map, which is what a user in no channels gets.
+    expect(ack({}).success).toBe(true);
+  });
+
+  it("exports the count schema on its own, so the internal hop validates the same rule", () => {
+    // `internalSessionResponseSchema` reuses this rather than restating it. Two schemas
+    // that must agree and are spelled twice are two schemas that will stop agreeing —
+    // feature 043 found that with `editMessageBodySchema.text`, from the other side: two
+    // that must DIFFER cannot share a reference at all.
+    expect(revisionCountSchema.safeParse({ c1: 0 }).success).toBe(true);
+    expect(revisionCountSchema.safeParse({ c1: -1 }).success).toBe(false);
+  });
+});
```

### One query, two fields

The api already resolved the caller's memberships on `/internal/session`; the count rides the
same rows. The membership query was widened to return the column and both of its callers were
repaired in the same commit — the other one throws the count away and maps back to bare ids,
which is what its response has always been.

**No per-channel query per handshake.** At the ten thousand connections this platform was
measured at, that cost is the one this feature cannot pay.

```diff title="services/api/src/internal/session.controller.ts"
@@ -111,28 +111,39 @@ export class SessionController {
           HttpStatus.PAYMENT_REQUIRED,
         );
       }
       throw error;
     }
 
+    // ONE QUERY FEEDING TWO FIELDS (feature 044, FR-014). Hoisted out of the object below
+    // because `channel_ids` and `channel_revisions` come from the same rows — calling
+    // `channelsForUser` twice would be two queries per handshake, and at 10,000 connections
+    // that is 10,000 extra reads on the one call this feature was careful not to add.
+    const memberships = user ? await this.repo.channelsForUser(user.id) : [];
+
     return {
       environment_id: principal.environmentId,
       user: principal.userExternalId,
       // Chapter 3.15, FR-031. THE ROW IS ALREADY IN HAND — `getUserByExternalId` above
       // reads it for the channel list — so carrying the ban costs one field and no query.
       // The gateway refuses the socket; this route only reports the fact, because the
       // gateway has no database and the column is in Postgres.
       //
       // A USER THIS ENVIRONMENT HAS NEVER SEEN IS NOT BANNED. `user` is null for a
       // verified token naming somebody with no row, which chapter 2.5 decided is a user
       // with no channels rather than an error — and a user with no row has no ban either.
       banned: user?.banned_at != null,
-      // Ids here; the counts ride the same rows and are filled in below (feature 044).
-      channel_ids: user
-        ? (await this.repo.channelsForUser(user.id)).map((c) => c.channel_id)
-        : [],
+      channel_ids: memberships.map((c) => c.channel_id),
+      /** The counts, from the same rows (feature 044, FR-004).
+       *
+       * EVERY CHANNEL, INCLUDING THOSE AT ZERO. The gateway reports all of them on the ack
+       * so a client needing no repair still has a baseline to store (FR-007a); omitting the
+       * zeros here would make that impossible one layer up. */
+      channel_revisions: Object.fromEntries(
+        memberships.map((c) => [c.channel_id, c.revision_sequence]),
+      ),
       limits: {
         connect: policy.limits.connect,
         send: policy.limits.send,
       },
     };
   }
```

### The gateway reports, and does not compare

The counts arrive with the identity and the memberships, from the session call at the door, for
the reason `banned` and `limits` arrived the same way: the gateway has no database and must not
gain one.

**A draft had the client present its own counts on the upgrade URL** so the gateway could compare
and answer with the stale channels. It was built and removed. A parameter the server parses and
never acts on is a contract it can never remove — and the removal keeps the rsplit rule intact,
which a third cursor field would have broken silently, parsing a revision count as a sequence and
resuming every client from a plausible wrong place.

```diff title="services/gateway/src/auth.ts"
@@ -36,12 +36,19 @@ export type { Identity } from "./api-client.js";
  * acts on by re-authenticating for ever. */
 export type Authentication =
   | {
       outcome: "ok";
       identity: Identity;
       channelIds: string[];
+      /** How many revisions each of those channels has seen (feature 044, FR-004).
+       *
+       * Carried for the same reason `channelIds` and `limits` are: the api read a column
+       * the gateway has no database to read, and this is the one call the gateway makes at
+       * connect. The gateway puts it on the ack and does nothing else with it — it never
+       * learns what a client holds, so it cannot be wrong about it. */
+      channelRevisions: Record<string, number>;
       /** Chapter 3.8. The environment's two socket allowances, read from
        * Postgres by the api and carried on the same response — the gateway has
        * no database client and R12 spent its whole argument on keeping it that
        * way. */
       limits: { connect: number; send: number };
     }
@@ -85,12 +92,13 @@ export async function authenticate(
         userExternalId: session.user,
         // Carried, not trusted: the internal hop forwards this instead of
         // asserting an identity the gateway invented.
         token,
       },
       channelIds: session.channel_ids,
+      channelRevisions: session.channel_revisions,
       limits: session.limits,
     };
   } catch (error) {
     return { outcome: "unavailable", error: String(error) };
   }
 }
```

```diff title="services/gateway/src/registry.ts"
@@ -16,12 +16,23 @@ import type { ResumePhase } from "./resume.js";
 
 export interface Connection {
   readonly id: string;
   readonly identity: Identity;
   readonly socket: WebSocket;
   channelIds: Set<string>;
+  /** How many revisions each of those channels has seen, as the api reported them at
+   *  connect (feature 044, FR-004).
+   *
+   * ON THE CONNECTION RATHER THAN PASSED DOWN, because `ack` is a sibling of the function
+   * that receives them and is called from three places. A parameter threaded through all
+   * three would have to be threaded through `resume` as well, for a value that belongs to
+   * the connection exactly as `channelIds` does.
+   *
+   * READ ONLY. Nothing updates this after connect: it is what the platform said when the
+   * socket opened, and a client that wants a fresher figure reconnects. */
+  revisions: Record<string, number>;
   missedPings: number;
   /** Chapter 2.7. A connection resuming through the tunnel spends its first
    * milliseconds holding live frames back so the backfill can go first; a
    * fresh connect is born "live" and never buffers. Delivery reads this
    * field and nothing else — the resume machinery is invisible to it. */
   phase: ResumePhase;
```

`revisions` sits inside the single `ack()` helper rather than at its three call sites — the fresh
connect, the successful resume, and the degrade. All three carry it by construction, which is the
difference between one fact and three branches somebody has to keep matching.

Reported on every ack, resume or not: a fresh connect holds nothing that can be stale, and giving
it the counts anyway is what lets its NEXT reconnect compare.

```diff title="services/gateway/src/session.ts"
@@ -889,12 +889,13 @@ export function attachSessions({
           return;
         }
         void open(
           ws,
           result.identity,
           result.channelIds,
+          result.channelRevisions,
           req.url ?? "/",
           result.limits.send,
           pendingId,
           claimed,
         );
       });
@@ -902,12 +903,22 @@ export function attachSessions({
   });
 
   async function open(
     socket: WebSocket,
     identity: Identity,
     channelIds: string[],
+    /** How many revisions each of those channels has seen (feature 044, FR-004).
+     *
+     * Arrives with the memberships, from the same session call at the door, for the same
+     * reason: the api read a column the gateway has no database to read. It goes onto the
+     * ack and nowhere else — the gateway reports it and the client decides what it means,
+     * so the gateway never learns what a client holds and cannot be wrong about it.
+     *
+     * Defaults to `{}` for the fixtures that do not wire a session response, which then
+     * report every channel at zero — the pre-feature behaviour. */
+    channelRevisions: Record<string, number>,
     url: string,
     sendLimit: number,
     /** Chapter 3.22. The id the cap claimed a place with, so the connection and
      * its slot agree — FR-011's "exactly one place for its lifetime". Absent when
      * no `connections` module is wired, which is every fixture that does not opt
      * in and the reason the cap is not enforced there. */
@@ -923,12 +934,13 @@ export function attachSessions({
       socket,
       // Chapter 3.2: memberships arrived with the identity, from the session
       // call at the door. There is no second lookup to fail here — the api is
       // still the only source of membership (ADR-05), it just answers both
       // questions at once, and a failure now closes the socket before it opens.
       channelIds: new Set(channelIds),
+      revisions: channelRevisions,
       missedPings: 0,
       phase: presented === undefined ? "live" : "buffering",
       buffer: [],
       overflowed: false,
       // A fresh connect suppresses nothing; a resume fills this in when it
       // succeeds, and leaves it null when it degrades.
@@ -1239,13 +1251,26 @@ export function attachSessions({
       resume_ok: boolean;
       truncated: string[];
     },
   ): void {
     send(connection.socket, {
       type: "connection.ack",
-      payload: { user: connection.identity.userExternalId, ...payload },
+      payload: {
+        user: connection.identity.userExternalId,
+        ...payload,
+        /** EVERY CHANNEL THIS USER BELONGS TO, including those at zero and those this
+         *  client asked nothing about (feature 044, FR-004, FR-007a).
+         *
+         * A client needing no repair still needs a baseline to store, or its next
+         * reconnect is the first one again — so a response carrying only the changed
+         * channels would leave most clients unable to establish one.
+         *
+         * Reported on every ack, resume or not. A fresh connect holds nothing that can be
+         * stale, and giving it the counts anyway is what lets its NEXT reconnect compare. */
+        revisions: connection.revisions,
+      },
     });
   }
 
   /** The five steps (chapter 2.7, SAD §5.2). Steps 1 and 2 already happened
    * — the connection was born `buffering` and the subscribes are in flight
    * — so what is left is: confirm, backfill, ack, emit, flush, live. */
```

And the parameter that is not there is recorded where it would have been, because a reader who
wonders why the client sends nothing deserves the answer in the file rather than in a commit
message.

```diff title="services/gateway/src/resume.ts"
@@ -173,6 +173,26 @@ export async function withDeadline(
       deadline,
     ]);
   } finally {
     if (timer) clearTimeout(timer);
   }
 }
+
+/** THERE IS NO `?rev=` PARAMETER ON THIS URL, AND THAT IS A DECISION (feature 044).
+ *
+ * A draft of the revision watermark had the client present the counts it holds so the gateway
+ * could compare and answer with the channels that were stale. It was built here and removed:
+ * `connection.ack` carries the platform's count for **every** channel the user belongs to, so
+ * a client that stores those counts compares them itself, and the parameter was never read.
+ *
+ * The whole of the request table in that feature's contract is satisfied without it. A client
+ * built before the feature simply ignores the new ack field, which is the same outcome as
+ * "presented no counts, so no repair signalled" — reached by doing nothing rather than by a
+ * rule the gateway has to hold.
+ *
+ * **A parameter the server parses and never acts on is a contract it can never remove.**
+ *
+ * It also keeps `parseCursors` above untouched, which matters more than it looks: that
+ * function splits on the LAST colon because a channel id is opaque and may contain one, so a
+ * `<channel>:<seq>:<rev>` entry would have parsed `rev` as the sequence. Every resume would
+ * have silently resumed from the wrong place, producing plausible numbers rather than an
+ * error. */
```

### The fixtures that had to say something

Every stub of the session response now states a revision count, and the ones that state `{}` are
saying the pre-feature thing on purpose. A stub that does not say is a stub that has not thought
about it — the same argument chapter 3.15 made when `banned` was added to this response.

```diff title="services/gateway/src/session.test.ts"
@@ -51,12 +51,16 @@ function stubApi(overrides: Partial<ApiClient> = {}): ApiClient {
             environment_id: "env-1",
             user: "tuan",
             // Chapter 3.15: the api now reports whether the user is banned, and a stub
             // that does not say is a stub that has not thought about it.
             banned: false,
             channel_ids: [CHANNEL],
+            // Feature 044: the api reports a revision count per channel. These fixtures wire
+            // none, so every channel reports zero — the pre-feature behaviour, and what a
+            // client that stores the counts will compare against next time.
+            channel_revisions: {},
             // Chapter 3.8. The limits ride the session response because the
             // gateway has no database to read them from — so the stub supplies
             // them, exactly as the api would. Generous by default: every test
             // above this line is about something else.
             limits: { connect: 3_000, send: 600 },
           }
@@ -986,12 +990,16 @@ describe("the socket's limits (chapter 3.8)", () => {
           environment_id: "env-1",
           user: "tuan",
           // Chapter 3.15: the api now reports whether the user is banned, and a stub
           // that does not say is a stub that has not thought about it.
           banned: false,
           channel_ids: [CHANNEL],
+          // Feature 044: the api reports a revision count per channel. These fixtures wire
+          // none, so every channel reports zero — the pre-feature behaviour, and what a
+          // client that stores the counts will compare against next time.
+          channel_revisions: {},
           limits: { connect: 2, send: 600 },
         }),
       }),
       undefined,
       undefined,
       undefined,
@@ -1022,12 +1030,16 @@ describe("the socket's limits (chapter 3.8)", () => {
           environment_id: "env-1",
           user: "tuan",
           // Chapter 3.15: the api now reports whether the user is banned, and a stub
           // that does not say is a stub that has not thought about it.
           banned: false,
           channel_ids: [CHANNEL],
+          // Feature 044: the api reports a revision count per channel. These fixtures wire
+          // none, so every channel reports zero — the pre-feature behaviour, and what a
+          // client that stores the counts will compare against next time.
+          channel_revisions: {},
           limits: { connect: 3_000, send: configured },
         }),
       }),
       undefined,
       undefined,
       undefined,
```

```diff title="services/gateway/src/resume.itest.ts"
@@ -124,20 +124,24 @@ describe("resume across a real fabric", () => {
     // different fanout client on the same subject — publishes into the
     // window. Neither side coordinates; only the buffer saves this.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         await publishFromElsewhere(frame(43));
         await settle(150); // give Redis time to actually deliver it
         return {
           [CHANNEL]: { messages: [frame(42), frame(43)], truncated: false },
         };
@@ -165,20 +169,24 @@ describe("resume across a real fabric", () => {
     // Committed after the backfill's snapshot: it exists ONLY in the buffer,
     // and the flush is the only reason the client ever sees it.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         await publishFromElsewhere(frame(43));
         await settle(150);
         return { [CHANNEL]: { messages: [frame(42)], truncated: false } };
       },
       sendMessage: async () => {
@@ -200,20 +208,24 @@ describe("resume across a real fabric", () => {
 
   it("goes live after the flush, with no buffering left behind", async () => {
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
@@ -253,20 +265,24 @@ describe("resume across a real fabric", () => {
     //
     // One number different from the test above it. That is the whole bug.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
@@ -299,20 +315,24 @@ describe("resume across a real fabric", () => {
     // retiring the mark once a higher sequence arrived — which would see the 43,
     // drop the mark, and then deliver the 42 (research R3).
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
@@ -358,20 +378,24 @@ describe("resume across a real fabric", () => {
    * **THE ABSENCE IS THE ASSERTION.** A resume that carried `message.updated` for a
    * message the client is receiving for the first time would be telling it that
    * something it has never seen has changed. */
   it("chapter 3.23: replays an edited message as message.created with its current text, and no message.updated", async () => {
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         limits: { connect: 3_000, send: 600 },
       }),
       // The api's backfill returns ROWS AS THEY ARE NOW — which for an edited message
       // is the corrected text under its original sequence. The stub says exactly that,
       // and `backfill.itest.ts` proves the real one does.
       backfill: async () => ({
         [CHANNEL]: {
           messages: [{ ...frame(42), text: "m42, corrected" }],
           truncated: false,
         },
@@ -404,20 +428,24 @@ describe("resume across a real fabric", () => {
     // would suppress messages the client never got — turning this chapter's
     // duplicate into a gap, which constitution II ranks worse.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // Chapter 3.15: the api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
         channel_ids: [CHANNEL],
+        // Feature 044: the api reports a revision count per channel. These fixtures wire
+        // none, so every channel reports zero — the pre-feature behaviour, and what a
+        // client that stores the counts will compare against next time.
+        channel_revisions: {},
         // Chapter 3.8: the limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         throw new Error("backfill unavailable");
       },
       sendMessage: async () => {
         throw new Error("not used");
       },
@@ -434,20 +462,144 @@ describe("resume across a real fabric", () => {
     // A sequence at or below the presented cursor. With no mark retained it must
     // still arrive: the client was told to page history, not to expect silence.
     await publishFromElsewhere(frame(41));
     await settle(300);
 
     expect(created(frames)).toEqual([41]);
     socket.close();
   });
 });
 
+// ── feature 044: the revision count on every ack (US1) ──────────────────────
+//
+// WHY HERE AND NOT IN `session.itest.ts`. The task named that file and the four
+// `cursor`/`rev` combinations from the contract. `rev` was built and removed —
+// a client sends nothing to obtain this — so there are no four combinations
+// left to enumerate; what remains is which ACK a connection gets, and there are
+// three of those. This file is where a stubbed api lets a test SAY what the
+// counts are, which is the only way to assert the case the earlier draft got
+// wrong: a channel the presented cursor never mentions.
+//
+// The end-to-end half — a real edit raising a real count on a real ack — is in
+// `session.itest.ts`, which spawns an api. Neither fixture does both.
+describe("the revision count rides every ack (feature 044, FR-004, FR-007a)", () => {
+  let harness: Harness | undefined;
+
+  afterEach(async () => {
+    await harness?.close();
+    harness = undefined;
+  });
+
+  const OTHER = randomUUID();
+
+  /** The counts a test wants reported, wired into an api stub that is otherwise
+   * every other stub in this file. */
+  async function bootReporting(
+    revisions: Record<string, number>,
+    backfill: Omit<ApiClient, "reportUsage">["backfill"],
+  ): Promise<Harness> {
+    return boot({
+      session: async () => ({
+        environment_id: "env-1",
+        user: "tuan",
+        banned: false,
+        channel_ids: [CHANNEL, OTHER],
+        channel_revisions: revisions,
+        limits: { connect: 3_000, send: 600 },
+      }),
+      backfill,
+      sendMessage: async () => {
+        throw new Error("not used");
+      },
+      memberships: async () => [CHANNEL, OTHER],
+    });
+  }
+
+  const ackOf = (frames: Frame[]) =>
+    frames.find((f) => f.type === "connection.ack") as
+      | {
+          payload: {
+            cursor: Record<string, number>;
+            resume_ok: boolean;
+            revisions: Record<string, number>;
+          };
+        }
+      | undefined;
+
+  it("reports on a FRESH connect, which presents no cursor and holds nothing stale", async () => {
+    // FR-007's first absence. A first connection cannot be stale — it has nothing —
+    // and it gets the counts anyway, because the baseline it stores now is what its
+    // NEXT reconnect compares against. A response that gave it nothing would make
+    // every reconnect the first one again (FR-007a).
+    harness = await bootReporting({ [CHANNEL]: 7, [OTHER]: 0 }, async () => ({}));
+    const socket = new WebSocket(`${harness.url}?token=${await token()}`);
+    const frames = record(socket);
+    await settle(400);
+
+    const ack = ackOf(frames);
+    expect(ack?.payload.revisions).toEqual({ [CHANNEL]: 7, [OTHER]: 0 });
+    // Including the zero. `cursorSchema` could not have carried that channel at all.
+    expect(ack?.payload.revisions[OTHER]).toBe(0);
+    socket.close();
+  });
+
+  it("reports a channel the presented cursor never mentions", async () => {
+    // FR-007's THIRD absence, and the one a literal reading of the earlier draft got
+    // wrong: it said an absent count was "treated as presenting zero", and zero
+    // compares as lower than any revised channel — so a channel joined during the
+    // absence signalled a repair to a client that holds nothing in it to repair.
+    //
+    // The gateway now compares nothing at all, so this asserts the shape rather than
+    // a branch: the counts are reported WHOLE, never scoped to the presented cursor.
+    harness = await bootReporting({ [CHANNEL]: 2, [OTHER]: 5 }, async () => ({
+      [CHANNEL]: { messages: [frame(42)], truncated: false },
+    }));
+    const socket = new WebSocket(
+      `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
+    );
+    const frames = record(socket);
+    await settle(400);
+
+    const ack = ackOf(frames);
+    expect(ack?.payload.resume_ok).toBe(true);
+    expect(ack?.payload.revisions).toEqual({ [CHANNEL]: 2, [OTHER]: 5 });
+    // The cursor is scoped to what the client presented; the counts are not. That
+    // asymmetry is the requirement, so both halves are asserted here rather than
+    // trusting the one that happens to be easier to read.
+    expect(ack?.payload.cursor).toEqual({ [CHANNEL]: 41 });
+    socket.close();
+  });
+
+  it("reports on a DEGRADED resume too, where the client is told to page everything", async () => {
+    // The ack a client gets when the backfill failed. It is the one most likely to be
+    // written without the field — the code path exists to say "resume did not happen" —
+    // and it is the one where the counts matter most: a client about to re-read every
+    // channel still needs the baseline to compare against NEXT time.
+    //
+    // Structural, not incidental: `revisions` sits inside the single `ack()` helper
+    // rather than at its three call sites, so all three carry it by construction.
+    harness = await bootReporting({ [CHANNEL]: 4, [OTHER]: 0 }, async () => {
+      throw new Error("backfill unavailable");
+    });
+    const socket = new WebSocket(
+      `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
+    );
+    const frames = record(socket);
+    await settle(400);
+
+    const ack = ackOf(frames);
+    expect(ack?.payload.resume_ok).toBe(false);
+    expect(ack?.payload.revisions).toEqual({ [CHANNEL]: 4, [OTHER]: 0 });
+    socket.close();
+  });
+});
+
 // ── chapter 3.18: two instances, one fabric (US2) ───────────────────────────
 //
 // `boot()` IS UNTOUCHED. It is called six times above and each call builds its
 // own `createFanout` and its own server, so two calls already give two gateway
 // instances sharing one Redis — which is precisely what SC-002 needs. Changing
 // the fixture to "support" that would have changed six passing tests to prove
 // nothing new (3.17's T040b, the fifth such incident in two features).
 //
 // WHAT THIS PROVES AND WHAT IT DOES NOT. The api here is a stub, as everywhere
 // in this file: the gateway has no database (ADR-05) and these suites are about
@@ -471,20 +623,24 @@ describe("two instances on one fabric (chapter 3.18)", () => {
     sockets.push(socket);
     return record(socket);
   };
 
   const stub = (channels: string[]) => ({
     session: async () => ({
       environment_id: "env-1",
       user: "tuan",
       banned: false,
       channel_ids: channels,
+      // Feature 044: the api reports a revision count per channel. These fixtures wire
+      // none, so every channel reports zero — the pre-feature behaviour, and what a
+      // client that stores the counts will compare against next time.
+      channel_revisions: {},
       limits: { connect: 3_000, send: 600 },
     }),
     backfill: async () => ({}),
     sendMessage: async () => {
       throw new Error("not used");
     },
     // Chapter 3.20. The same list `session` answers with, so the backstop confirms
     // what the connect already established and changes nothing.
     memberships: async () => channels,
   });
```

```diff title="services/gateway/src/connections.itest.ts"
@@ -135,12 +135,16 @@ async function boot(options: {
   const api: ApiClient = {
     session: async () => ({
       environment_id: environment,
       user: options.user,
       banned: false,
       channel_ids: options.channels,
+      // Feature 044: the api reports a revision count per channel. These fixtures wire
+      // none, so every channel reports zero — the pre-feature behaviour, and what a
+      // client that stores the counts will compare against next time.
+      channel_revisions: {},
       limits: { connect: 3_000, send: 600 },
     }),
     memberships: async () => options.channels,
     backfill: async () => ({}) as never,
     sendMessage: async () => {
       throw new Error("not used");
```

```diff title="services/gateway/src/typing.itest.ts"
@@ -108,12 +108,16 @@ async function boot(options: {
   const api: ApiClient = {
     session: async () => ({
       environment_id: environment,
       user: options.user,
       banned: false,
       channel_ids: options.channels,
+      // Feature 044: the api reports a revision count per channel. These fixtures wire
+      // none, so every channel reports zero — the pre-feature behaviour, and what a
+      // client that stores the counts will compare against next time.
+      channel_revisions: {},
       limits: { connect: 3_000, send: 600 },
     }),
     memberships: async () => options.channels,
     backfill: async () => {
       if (options.backfillDelayMs !== undefined) {
         await new Promise((r) => setTimeout(r, options.backfillDelayMs));
```

**The forged-frame builder is the one that mattered.** It asserts that a well-formed outbound
frame is refused for its DIRECTION, and a sample missing a newly-required field is refused a
phase earlier for its SHAPE — turning nine direction assertions into nine parser assertions,
still green. Chapter 3.23 made the identical repair to this identical pair of builders when
`message.deleted` gained its own payload. Second incident, same two files.

```diff title="services/gateway/src/isolation.itest.ts"
@@ -803,13 +803,19 @@ function sample(type: string, channel: string, user: string): unknown {
     // `invalid_frame` — a phase before the direction check this suite is about.
     attachments: [],
     created_at: new Date().toISOString(),
   };
   switch (type) {
     case "connection.ack":
-      return { type, payload: { user, cursor: {}, resume_ok: true, truncated: [] } };
+      // Feature 044 added a required `revisions` to this payload, and a sample missing
+      // it is refused for its SHAPE a phase before the direction check — see the
+      // `message.deleted` note below, which is chapter 3.23 making the same repair.
+      return {
+        type,
+        payload: { user, cursor: {}, resume_ok: true, truncated: [], revisions: {} },
+      };
     case "message.ack":
       return { type, payload: { seq: 1 } };
     case "message.created":
     case "message.updated":
       return { type, payload: message };
     // CHAPTER 3.23 SPLIT THIS CASE OFF. `message.deleted` shared the `Message` above
```

### The close-out pass, and the two tests it changed

**A title audit is a source change like any other**, which is why these hunks exist at all. The
audit read each of this feature's fifteen new test titles against what the test actually asserts
and found four that claimed more than they proved — one of them a `describe` citing a requirement
a schema file cannot see, and one claiming to cover both callers of a query it calls once.

```diff title="packages/protocol/src/frames.test.ts"
@@ -345,13 +345,13 @@ describe("the message-length maximum (feature 043, FR-008)", () => {
       created_at: "2026-09-06T00:00:00.000Z",
     };
     expect(messageSchema.safeParse(long).success).toBe(true);
   });
 });
 
-describe("the revision count on the ack (feature 044, FR-004, FR-007, FR-009)", () => {
+describe("the revision count on the ack (feature 044, FR-007, FR-009)", () => {
   const ack = (revisions: unknown) =>
     parseFrame({
       type: "connection.ack",
       payload: {
         user: "u1",
         cursor: { c1: 42 },
@@ -382,13 +382,13 @@ describe("the revision count on the ack (feature 044, FR-004, FR-007, FR-009)",
       type: "connection.ack",
       payload: { user: "u1", cursor: {}, resume_ok: true, truncated: [] },
     });
     expect(withoutIt.success).toBe(false);
   });
 
-  it("refuses a negative count and a fractional one", () => {
+  it("refuses a negative count, a fractional one, and a string", () => {
     // A count that falls would silently tell a client it is up to date (FR-002), and a
     // fraction is not a number of revisions. Neither is reachable from the writer, which
     // is why the door is here rather than trusted upstream.
     expect(ack({ c1: -1 }).success).toBe(false);
     expect(ack({ c1: 1.5 }).success).toBe(false);
     expect(ack({ c1: "7" }).success).toBe(false);
@@ -401,13 +401,13 @@ describe("the revision count on the ack (feature 044, FR-004, FR-007, FR-009)",
     // the correct response unrepresentable.
     expect(ack({ c1: 3, c2: 0 }).success).toBe(true);
     // And the empty map, which is what a user in no channels gets.
     expect(ack({}).success).toBe(true);
   });
 
-  it("exports the count schema on its own, so the internal hop validates the same rule", () => {
+  it("exports the count schema on its own, not only as part of the ack", () => {
     // `internalSessionResponseSchema` reuses this rather than restating it. Two schemas
     // that must agree and are spelled twice are two schemas that will stop agreeing —
     // feature 043 found that with `editMessageBodySchema.text`, from the other side: two
     // that must DIFFER cannot share a reference at all.
     expect(revisionCountSchema.safeParse({ c1: 0 }).success).toBe(true);
     expect(revisionCountSchema.safeParse({ c1: -1 }).success).toBe(false);
```

**And it found FR-003 cited by two titles and asserted by neither.** The first remedy was itself
vacuous: delete a message, edit it, confirm the count did not move. It passes — and it passes
identically with the counter moved outside the transaction, because the edit path refuses a
deleted message *before* the counter's statement is ever reached. The bump never runs, so the
test says nothing about the property it named.

The behavioural test keeps its real property under an honest title, and FR-003 gets a
source-reading test instead — the instrument `main.test.ts` already uses for producers nothing
else can see. It scans the repository for both bumps and asserts each runs on `tx`. Moving one
onto `this.db` turns it red, which is the whole point of writing it that way.

```diff title="services/api/src/db/repository.itest.ts"
@@ -1,9 +1,16 @@
 import { randomUUID } from "node:crypto";
+import { readFileSync } from "node:fs";
+import { join } from "node:path";
 
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
+
+// `__dirname`, not `import.meta` — this service builds to CommonJS, and `import.meta`
+// is a hard compile error there. `migrations.test.ts` carries the same line and the same
+// reason, three files away, which is where this was read from rather than rediscovered.
+const HERE = __dirname;
 import { sql } from "drizzle-orm";
 
 import { createDb, createPool, DEFAULT_DATABASE_URL, type Db } from "./client";
 import { migrate } from "./migrate";
 import {
   createEnvironment,
@@ -1516,13 +1523,13 @@ describe("the channel's revision counter (feature 044, FR-002, FR-003, FR-011)",
     await repoA.editMessage(left.id, m.id, { text: "edited in left", userId: author.id });
 
     expect(await countFor(left.id)).toBe(1);
     expect(await countFor(right.id)).toBe(0);
   });
 
-  it("carries the count on channelsForUser, for both of that query's callers (FR-014)", async () => {
+  it("carries the count on channelsForUser, the query the gateway's session read already makes", async () => {
     // The count reaches the gateway on the membership query rather than on a read of its
     // own, because at 10,000 connections a per-channel read per handshake is 10,000 reads.
     const author = await repoA.createUser("t044-e", "E");
     const channel = await repoA.createChannel("t044-e", "public");
     await repoA.addMember(channel.id, author.id);
     const m = await repoA.sendMessage(channel.id, {
@@ -1532,12 +1539,70 @@ describe("the channel's revision counter (feature 044, FR-002, FR-003, FR-011)",
 
     const rows = await repoA.channelsForUser(author.id);
     const row = rows.find((r) => r.channel_id === channel.id);
     expect(row).toBeDefined();
     expect(row!.revision_sequence).toBe(1);
   });
+
+  it("does not rise for an edit refused before it is applied", async () => {
+    // WHAT THIS PROVES, AND WHAT IT DOES NOT. The edit path refuses a deleted message
+    // twice — once on the read (`MessageDeletedError`) and once on the compare-and-set
+    // that affects zero rows — and BOTH refusals happen before the counter's statement.
+    // So this asserts that the refusal path does not count, which is worth having and is
+    // NOT FR-003: the bump never executes here, so the test would pass just as well with
+    // the bump outside the transaction entirely.
+    //
+    // It was written titled `(FR-003)` and the title audit caught it. FR-003's actual
+    // failure mode — a bump that commits when the revision behind it does not — is
+    // asserted by the source test below, because nothing after the bump can be made to
+    // fail from out here without breaking the repository to do it.
+    const author = await repoA.createUser("t044-f", "F");
+    const channel = await repoA.createChannel("t044-f", "public");
+    await repoA.addMember(channel.id, author.id);
+    const m = await repoA.sendMessage(channel.id, {
+      text: "to be deleted", userId: author.id, userExternalId: "t044-f",
+    });
+
+    await repoA.deleteMessage(channel.id, m.id, { userId: author.id, userExternalId: "t044-f" });
+    const afterDeletion = await countFor(channel.id);
+    expect(afterDeletion).toBe(1);
+
+    await expect(
+      repoA.editMessage(channel.id, m.id, { text: "too late", userId: author.id }),
+    ).rejects.toThrow();
+    // Unmoved — because the edit was refused before the counter was reached.
+    expect(await countFor(channel.id)).toBe(afterDeletion);
+  });
+
+  it("raises the counter INSIDE the transaction, on both revision paths (FR-003)", () => {
+    // FR-003 says a revision that commits and a count that rises are the same event. The
+    // way that stops being true is somebody moving the bump onto `this.db`, where it
+    // commits on its own — and then a failure in the `messageEdits` or `outbox` insert
+    // that follows it leaves a count describing a revision that never happened.
+    //
+    // NO RUNTIME TEST CAN REACH THAT. Everything after the bump succeeds unless the
+    // repository is broken on purpose, so the property is read off the source instead —
+    // the same instrument `main.test.ts` uses for the producers it cannot otherwise see.
+    const source = readFileSync(join(HERE, "repository.ts"), "utf8");
+    const MARKER = "revisionSequence: sql";
+    const at: number[] = [];
+    for (let i = source.indexOf(MARKER); i !== -1; i = source.indexOf(MARKER, i + 1)) {
+      at.push(i);
+    }
+    // Two revision paths, and a third would need its own decision rather than inheriting
+    // this assertion silently.
+    expect(at).toHaveLength(2);
+    for (const i of at) {
+      // The statement this bump belongs to, read back to the `await` that opens it.
+      const statement = source.slice(source.lastIndexOf("await ", i), i);
+      expect(statement, `the bump at ${i} must run on the transaction`).toContain("tx\n");
+      expect(statement, `the bump at ${i} must not run on the pool`).not.toContain(
+        "this.db",
+      );
+    }
+  });
 });
 
 describe("a concurrent edit and deletion (feature 043, FR-007)", () => {
   const seed = async (label: string) => {
     const author = await repoA.createUser(`${label}-author`, "Author");
     const channel = await repoA.createChannel(label, "public");
```

**The ratchet's new pins, and one of them carries a measured swing rather than a measurement.**
Two full coverage runs on identical code, twenty minutes apart, gave `session.ts` 87.80% and
85.36% functions — about one function of forty — while every other file this feature pinned was
byte-identical across both. A floor at the measured value would go red on the next run for no
change to the code, and the fix would then be to lower it: a ratchet that teaches people to lower
ratchets. Both numbers are in the config so the next feature does not rediscover them.

The pins were proved live before being trusted. Demanding 101% of a file at 100% names the key;
demanding 101% of a file that does not exist produces **nothing at all**, which is the failure
mode this class of threshold has and the reason the probe is worth running every time.

```diff title="vitest.coverage.config.mts"
@@ -198,12 +198,89 @@ export default defineConfig({
           branches: 92,
           functions: 100,
           lines: 99,
           statements: 97,
         },
 
+        // ── feature 044: the revision watermark ──────────────────────────────
+        //
+        // FIVE FILES THIS FEATURE CHANGED AND NOTHING PINNED. `repository.ts`,
+        // `resume.ts`, `frames.ts` and `memberships.controller.ts` were already
+        // here and all four still meet their floors, so only the unpinned ones
+        // are added — at the values measured on 2026-09-06, not at round numbers
+        // chosen to look tidy.
+        //
+        // AND `services/api/src/db/schema.ts` IS DELIBERATELY NOT PINNED. It
+        // measures 59.15 statements / 40.81 functions, which looks alarming and
+        // is not: the file is drizzle table declarations, and the "functions"
+        // are the per-table callbacks that build indexes, executed only when a
+        // query touches that table. A floor here would ratchet on which tables
+        // the suite happens to query, which is not a property anybody wants to
+        // defend. The column this feature added is covered by
+        // `repository.itest.ts` at the level that matters — whether it moves.
+        "packages/protocol/src/internal.ts": {
+          // 85.71 branches, 60 functions. The functions figure is the schema
+          // module's shape rather than a gap: most exports are zod schemas whose
+          // `.default()` and refinement callbacks only run on the inputs a test
+          // supplies, and this feature's `channel_revisions` default is one of
+          // them — exercised by the fixtures that omit it.
+          branches: 85,
+          functions: 60,
+          lines: 92,
+          statements: 91,
+        },
+        "services/gateway/src/auth.ts": {
+          // 100 across all four. The counts pass through this file untouched, so
+          // the arm that reads them is on the path every socket takes.
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/gateway/src/registry.ts": {
+          branches: 100,
+          functions: 87,
+          lines: 87,
+          statements: 88,
+        },
+        "services/gateway/src/session.ts": {
+          // The largest file this feature touched, and the ack's three call
+          // sites are all on covered paths — the fresh connect, the resume and
+          // the degrade each have a test in `resume.itest.ts`.
+          //
+          // UNUSUAL HEADROOM, AND IT WAS MEASURED RATHER THAN CHOSEN. Two full
+          // coverage runs on IDENTICAL code gave 87.80% and 85.36% functions —
+          // a 2.44-point swing, about one function of forty. The other three
+          // metrics moved by a third of a point and every other file this
+          // feature pinned was byte-identical across both runs.
+          //
+          // A floor at the measured value would have been red on the next run
+          // for no change to the code, and the fix would then be to lower it —
+          // which is a ratchet that trains people to lower ratchets. Pinned
+          // below the lower observation by roughly the observed swing, and the
+          // swing is recorded so the next feature does not rediscover it.
+          //
+          // The instability itself is a `C7` case in `gaps.md`: something in
+          // this suite is timing-dependent, and coverage reports the symptom
+          // without naming the arm.
+          branches: 90,
+          functions: 83,
+          lines: 93,
+          statements: 93,
+        },
+        "services/api/src/internal/session.controller.ts": {
+          // 62.5 branches, and the uncovered arms are the null-user paths this
+          // feature did not touch: a verified token naming somebody with no row.
+          // Pinned at what it measures so a later change cannot lower it
+          // silently, and not raised to a number the file does not reach.
+          branches: 62,
+          functions: 100,
+          lines: 83,
+          statements: 83,
+        },
+
         // The dispatcher's two decision-bearing files (chapter 3.5). `expand.ts`
         // decides whether a redelivered event produces a second set of webhooks
         // — constitution VI names idempotency explicitly — and `deliver.ts`
         // holds the post-then-report ordering that chooses a duplicate over a
         // silent loss. Pinned here because they measured 0% and 87.5% when the
         // service arrived, which is exactly what research R12 warned a new
```

## Task ids do not belong in test titles

A task id names a step in one feature's plan. The plan is finished; the test is not. Six months
on, `T052` names nothing a reader can look up — and a test title is the one piece of a test that
shows up **detached from its file**, in a CI summary with no repository to grep. That is what
separates a title from a comment: somebody reading the comment already has the file open.

Seven such ids survived across four suites, left by chapters whose audits reached only the files
they were touching. They are removed here, and each replacement says what the title already
proved rather than pointing at a plan.

**One of them could not be removed on its own.** `fanout.itest.ts` carried a comment fifty lines
above the test reading *"Raw is kept because T018 asserts on the exact key set"* — a reference
pointing AT the title by its id. Deleting the id from the title alone would have left a comment
citing something no longer findable. Fix the file that describes the thing and the one that
refers to it, or the second is worse off than before.

**And one was printing to standard output.** `membership.itest.ts` logged
`[T066] request-return to notice: … ms`, which lands in CI output with no file, no line and no
way back. That is the title problem in its purest form.

```diff title="services/api/src/channels/channels.itest.ts"
@@ -174,13 +174,13 @@ describe("the public channel surface", () => {
       expect(body.members.every((m) => m.status === "added")).toBe(true);
       // The users did not exist a moment ago. FR-CHN-04: membership creates them.
       expect(await repo.getUserByExternalId("tuan")).not.toBeNull();
       expect((await repo.listMembers(channelId)).length).toBe(2);
     });
 
-    it("says already_a_member on a repeat, and is not a 500 (T052)", async () => {
+    it("says already_a_member on a repeat, and is not a 500", async () => {
       const res = await addMembers(channelId, { user_ids: ["tuan"] });
       expect(res.status).toBe(200);
       const body = (await res.json()) as { members: { status: string }[] };
       expect(body.members[0]?.status).toBe("already_a_member");
       // Before this chapter `members`' primary key raised a unique violation here
       // and `ProtocolErrorFilter` rendered it as `internal_error` — a 500 for a
@@ -707,13 +707,13 @@ describe("the public channel surface", () => {
       expect(absent.status).toBe(foreign.status);
       const a = withoutRequestId(await absent.json());
       const b = withoutRequestId(await foreign.json());
       expect(a).toEqual(b);
     });
 
-    it("does not change what a user has left unread (FR-022, T078)", async () => {
+    it("does not change what a user has left unread (FR-022)", async () => {
       // The edge case the spec names, and this is where "the count is still true"
       // gets a definition: archiving writes ONE column on `channels` and touches no
       // message and no read position. So `last_sequence` is what it was, every read
       // position is what it was, and the arithmetic between them is unchanged.
       //
       // Asserted on the sequence rather than on a count, because the count is phase
```

The isolation gauntlet's describe carried two ids at once, and the comment above it a third. What
that comment is actually saying survives the edit intact: only two of the five platform routes
name an environment alongside an identifier, so only those two can be told to act on one tenant
while carrying something from another.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -679,34 +679,34 @@ describe("the isolation gauntlet", () => {
       // environment — this is the assertion that the scoping is real.
       expect(body).not.toContain(tenants.victim.channelId);
     });
   });
   // ── T031: the five platform routes, and what isolation means for them ──────
   //
-  // T031b, the comment the plan asked for: a platform credential is not
-  // tenant-scoped and is not meant to be. The dispatcher serves every tenant, so
+  // A platform credential is not tenant-scoped and is not meant to be. The
+  // dispatcher serves every tenant, so
   // its credential reaches every tenant's deliveries. FR-044 narrowed WHICH
   // ROUTES each service may call and changed nothing about that reach.
   //
   // So the attack shape differs here, and the difference is worth stating
   // exactly. Only TWO of the five platform routes name an environment alongside
   // an identifier — `dispatch/expand` (`environment_id` beside `event_id`) and
   // `usage/connections` (an environment per connection). Those two can be told
   // to act on environment A while carrying something from B, and both are
   // attacked: expand below, connections by `usage.itest.ts`'s
-  // `connection_environment_conflict` assertion (T032).
+  // `connection_environment_conflict` assertion.
   //
   // The other three — `material`, `outcome`, `replay` — take one opaque
   // identifier and DERIVE the environment from the row they find. There is no
   // cross-environment request to make, because the caller never says which
   // environment it means. That is not a hole this suite declines to test; it is
   // the absence of the parameter that would make the attack expressible. What
   // guards them is FR-044 and nothing else — which is why `material`, the one
   // response in the platform that returns a decrypted customer secret, is the
   // route to watch first if a platform credential ever leaks.
-  describe("the platform routes (T031, T031b)", () => {
+  describe("the platform routes", () => {
     const dispatcher = process.env["RELAY_INTERNAL_CREDENTIAL"] ?? "";
 
     // Through the victim's OWN repository, which is both scoped and the only
     // place the query engine is allowed to live (FR-043).
     const victimDeliveries = () =>
       tenants.victim.repo.countDeliveriesForEndpoint(tenants.victim.endpointId);
```
