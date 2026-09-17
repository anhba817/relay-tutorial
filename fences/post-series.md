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
@@ -9,23 +9,27 @@
   "scripts": {
     "dev": "turbo run dev",
     "lint": "turbo run //#lint:root",
     "lint:root": "eslint .",
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
-    "test:integration": "turbo run test:integration --concurrency=1",
+    "test:integration": "turbo run test:integration --concurrency=1 --filter=!@relay/outsider",
+    "test:outsider": "turbo run test:integration --filter=@relay/outsider",
+    "coverage": "vitest run --config vitest.coverage.config.mts --coverage",
     "build": "turbo run build"
   },
   "devDependencies": {
     "@eslint/js": "^10.0.1",
     "@types/node": "^26.1.2",
     "eslint": "^10.8.0",
     "globals": "^17.9.0",
     "jose": "^6.2.7",
     "prettier": "^3.9.6",
     "turbo": "^2.10.8",
     "typescript": "^5.9.3",
     "typescript-eslint": "^8.65.0",
+    "unplugin-swc": "^1.5.9",
+    "@vitest/coverage-v8": "^4.1.10",
     "vitest": "^4.1.10",
     "ws": "^8.21.1"
   }
 }
\ No newline at end of file
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
@@ -101,12 +101,39 @@ function runtimeFor(
     ...(environmentId
       ? { filterSubject: subjectFor("message.created", environmentId) }
       : {}),
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
+ * Found by the retry-and-disable chapter's baseline.
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
  * what it spawned instead, and cleans exactly that. */
 const spawnedDurables: string[] = [];
 
@@ -178,33 +205,36 @@ describe("the consumer", () => {
     });
     await ensureStream(nc);
     await nc.drain();
   }, 60_000);
 
   afterAll(async () => {
-    await db.execute(`DELETE FROM consumed_events WHERE consumer LIKE 'itest-%'`);
+    await db.execute(`DELETE FROM consumed_events WHERE consumer LIKE '${SUITE}-%'`);
     for (const durable of spawnedDurables) {
       await db.execute(
         `DELETE FROM consumed_events WHERE consumer = '${durable}'`,
       );
     }
     // And the durable consumers themselves. A durable is server-side state that
     // outlives the process that made it: without this, every run of this suite
     // left another handful behind on a shared broker, and `stream-info.mjs`
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
       servers: process.env.RELAY_NATS_URL ?? DEFAULT_NATS_URL,
     });
     const jsm = await nc.jetstreamManager();
     for await (const info of jsm.consumers.list("EVENTS")) {
-      if (info.name.startsWith("itest-") || spawnedDurables.includes(info.name)) {
+      if (info.name.startsWith(SUITE) || spawnedDurables.includes(info.name)) {
         await jsm.consumers.delete("EVENTS", info.name).catch(() => undefined);
       }
     }
     await nc.drain();
   }, 60_000);
 
@@ -240,13 +270,13 @@ describe("the consumer", () => {
     expect(after.state.messages).toBeGreaterThanOrEqual(before.state.messages);
     await nc.drain();
   });
 
   it("invariant 3: an event is delivered, handled once, and acknowledged", async () => {
     const environmentId = ENV();
-    const durable = `itest-basic-${Date.now()}`;
+    const durable = `${RUN}-basic-${Date.now()}`;
     const seen: string[] = [];
     const eventId = await publish(environmentId);
 
     const runtime = runtimeFor(
       db,
       durable,
@@ -309,13 +339,13 @@ describe("the consumer", () => {
   }, 180_000);
 
   it("invariant 5: deduplication survives a restart", async () => {
     // The ledger is in Postgres precisely so that a process restart does not
     // reset it. A second runtime with the same durable name gets the same
     // answer the first one would have.
-    const durable = `itest-restart-${Date.now()}`;
+    const durable = `${RUN}-restart-${Date.now()}`;
     const eventId = randomUUID();
 
     expect(await claimEvent(db, durable, eventId, async () => {})).toBe(
       "handled",
     );
     expect(await claimEvent(db, durable, eventId, async () => {})).toBe(
@@ -325,13 +355,13 @@ describe("the consumer", () => {
   });
 
   it("invariant 6: two instances sharing a durable name divide the work", async () => {
     // The ordinary deployment. A durable consumer is one position in the stream,
     // so two api processes pulling from it share the work — the property the
     // broker provides here that `SKIP LOCKED` provides for the outbox.
-    const durable = `itest-shared-${Date.now()}`;
+    const durable = `${RUN}-shared-${Date.now()}`;
     const byA: string[] = [];
     const byB: string[] = [];
     // ONE environment, and both runtimes filtered to it.
     //
     // This used to call `ENV()` three times and construct both runtimes with no
     // filter — the same fault the test above this one already carries a comment
@@ -388,13 +418,13 @@ describe("the consumer", () => {
   it("invariant 7: a handler that always throws stops being retried", async () => {
     // `max_deliver` is 5. After that the broker stops delivering and the message
     // leaves the consumer's view — measured in research R4, and the honest
     // answer this chapter gives rather than a dead-letter path that does not
     // exist yet.
     const environmentId = ENV();
-    const durable = `itest-poison-${Date.now()}`;
+    const durable = `${RUN}-poison-${Date.now()}`;
     const eventId = await publish(environmentId);
     let attempts = 0;
 
     const runtime = runtimeFor(
       db,
       durable,
@@ -422,13 +452,13 @@ describe("the consumer", () => {
 
   it("invariant 8: an unparseable payload is terminated on the first attempt", async () => {
     // Retrying malformed bytes five times changes nothing about them. The
     // runtime terminates the message instead of burning the budget and dropping
     // it anyway — and says so in a log line carrying no payload.
     const environmentId = ENV();
-    const durable = `itest-garbage-${Date.now()}`;
+    const durable = `${RUN}-garbage-${Date.now()}`;
     const lines: string[] = [];
     const noisy = createLogger("consumer-itest", (line) =>
       lines.push(typeof line === "string" ? line : JSON.stringify(line)),
     );
     await publishGarbage(environmentId);
     const marker = await publish(environmentId);
@@ -452,13 +482,13 @@ describe("the consumer", () => {
     expect(unparseable.join("")).not.toContain("this is not an event");
   }, 180_000);
 
   it("invariant 9: a consumer stopped for N publishes receives all N on restart", async () => {
     // What `limits` retention means: the stream holds messages whether or not
     // anybody is reading. The backlog waits.
-    const durable = `itest-catchup-${Date.now()}`;
+    const durable = `${RUN}-catchup-${Date.now()}`;
     const seen: string[] = [];
     // ONE environment for all three publishes, and the consumer filtered to it.
     //
     // This test used to call `ENV()` three times — and `ENV` mints a fresh uuid
     // on every call, so the three events went to three different subjects and no
     // filter could cover them. Without a filter the durable starts at the head of
@@ -514,13 +544,13 @@ describe("the consumer", () => {
 
     for (const id of published) expect(seen).toContain(id);
   }, 240_000);
 
   it("invariant 12: a consumer log line carries counts, never payloads", async () => {
     const environmentId = ENV();
-    const durable = `itest-logs-${Date.now()}`;
+    const durable = `${RUN}-logs-${Date.now()}`;
     const lines: string[] = [];
     const noisy = createLogger("consumer-itest", (line) =>
       lines.push(typeof line === "string" ? line : JSON.stringify(line)),
     );
     const eventId = await publish(environmentId, {
       data: {
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
@@ -14,12 +14,13 @@ import {
   environmentSigningSecret,
   provisionOrganisation,
   Repository,
   revokeApiKey,
 } from "../db/repository";
 import { parseApiKeyCredential } from "./api-key";
+import { resolvePrincipal } from "./authenticate.middleware";
 import { MAX_TOKEN_LIFETIME_SECONDS } from "./user-token";
 import { withoutRequestId } from "../isolation/compare";
 
 // The refusals, over real HTTP against the compose Postgres.
 // Invariants 1-7, 9 and 11 of contracts/credentials.md live here; 8 and 12 are
 // pure and live in the unit lane; 10 needs a socket and lives in the gateway's
@@ -404,32 +405,47 @@ describe("credentials", () => {
     // `key.credential.split("_").at(-1)` was the secret only by luck, and MEASURED OVER
     // 200,000 MINTS it is luck that runs out both ways. The secret is base64url of 32
     // bytes and `_` IS IN THAT ALPHABET:
     //
     //   26.9% of credentials  the last segment is 20 characters or fewer — the test
     //                         searched for a FRAGMENT and passed more easily than it
-    //                         should. A false negative, and the quiet half.
+    //                         should. A false negative, and the quiet half, true on
+    //                         MOST runs: a log line leaking the first thirty characters
+    //                         of a secret passed.
     //   1.57%                 the segment is one character or none, and `not.toContain`
     //                         on a single character fails against any haystack. That is
-    //                         the loud half, and it is what the battery hit: `expected
-    //                         '{"time":…' not to contain '0'`.
+    //                         the loud half.
+    //
+    // BOTH HALVES WERE FOUND TWICE, INDEPENDENTLY, AND THE FIXES AGREE. The published
+    // order hit it at this chapter's baseline, which ran the lane three times: the mint
+    // ended `…_I`, so the assertion had become "no log line contains the letter I" and
+    // the error body for a misused key says "this route expects an API key". This order
+    // hit it one chapter earlier, in the coverage battery, on a mint ending `_0`:
+    // `expected '{"time":…' not to contain '0'`. Two draws of the same 1.57%, and both
+    // readings arrived at the same parser and the same threshold.
     //
     // `parseApiKeyCredential` is the function the guard itself uses to split a
     // presented credential, so the needle is now the same substring the product calls
     // the secret. A test that re-derives what the code under test already computes is
     // a second definition, and the two can disagree.
     const parsed = parseApiKeyCredential(key.credential);
     expect(parsed, "the fixture minted something this api cannot parse").not.toBeNull();
     const secret = parsed!.secret;
     // AND THE NEEDLE IS CHECKED BEFORE IT IS USED. A short needle is found in any
     // haystack, so `not.toContain` on one is a test that always fails — the inverse of
-    // the vacuous assertion this file is otherwise full of guards against.
+    // the vacuous assertion this file is otherwise full of guards against. 32
+    // base64url-encoded bytes are never short.
     expect(secret.length, "the needle is too short to mean anything").toBeGreaterThan(20);
     expect(haystack).not.toContain(key.credential);
     expect(haystack).not.toContain(secret);
     expect(haystack).not.toContain(foreignKey.credential);
+    // AND THE FOREIGN KEY'S SECRET, PARSED THE SAME WAY. Checking the whole
+    // credential catches a verbatim echo; the secret alone is what a log line
+    // truncating a header would leak, and it is the half worth having.
+    expect(haystack).not.toContain(parseApiKeyCredential(foreignKey.credential)!.secret);
+    expect(haystack).not.toContain(parseApiKeyCredential(foreignKey.credential)!.secret);
     expect(haystack).not.toContain(token);
     // The prefix alone is not a secret and may legitimately appear.
   });
 
   it("signup hands over exactly one key, and only when it creates something", async () => {
     // R8: with no console session, signup is the only thing that can bootstrap
@@ -616,7 +632,68 @@ describe("credentials", () => {
       const body = (await res.json()) as { code?: string; message?: string };
       expect(body.code).toBe("wrong_credential_type");
       // And it must not quote the credential back (NFR-SEC-06).
       expect(JSON.stringify(body)).not.toContain(PLATFORM);
     });
   });
+
+  // --- one credential per service -----------------------------------------
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
 });
\ No newline at end of file
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
@@ -106,12 +106,14 @@ function spawnApi(port: number, credential: string): ChildProcess {
       ...process.env,
       PORT: String(port),
       RELAY_INTERNAL_CREDENTIAL: credential,
       // The outbox chapter's finding 4, for the third time: this suite drives the relay
       // explicitly, so a background copy draining the same table would race it.
       RELAY_OUTBOX_RELAY: "off",
+      // The rate-limit chapter: nor the notification relay, for the same reason.
+      RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
       RELAY_DELIVERY_RELAY: "off",
     },
     stdio: ["ignore", "pipe", "pipe"],
   });
 }
@@ -392,12 +394,35 @@ describe("the dispatcher", () => {
     // Created BEFORE anything is published, or "New" would skip the first event.
     await dispatcher.ready();
   }, 60_000);
 
   afterAll(async () => {
     await dispatcher?.stop();
+
+    // DELETE THE DURABLES THIS RUN NAMED (feature 043, FR-003).
+    //
+    // A durable is server-side state that outlives the process that made it, and this
+    // suite named a fresh pair per run — `itest-expand-<8 hex>` and
+    // `itest-deliver-<8 hex>` — and deleted neither. The attachments chapter's close-out found
+    // **216 consumers on DELIVERIES**, 215 of them this file's, each holding a position
+    // in a stream of 56,193 messages, and the twenty-run battery added 19 more.
+    //
+    // `services/api/src/consumer/consumer.itest.ts` has done this since the broker chapter and
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
     second?.close();
   });
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

---

## `services/api/src/webhooks/delivery-relay.ts` — the caller the compiler found (feature 030)

One line, and it is here because the amendment above created it. Removing
`sweepDisabledEndpoints`'s default broke exactly one production call site, which
is the whole return on the change: the compiler enumerated the callers so nobody
had to grep for them. The four call sites in `deliveries.itest.ts` already passed
`10_000`, chapter 3.7's fix for the first recorded instance.

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
@@ -1,11 +1,277 @@
 import eslint from "@eslint/js";
 import globals from "globals";
 import tseslint from "typescript-eslint";
 
 // One lint config for the whole workspace (ADR-01's consequence made literal).
+// ── THE RESTRICTION SETS, HOISTED SO THEY CAN BE COMPOSED ───────────────────────
+//
+// `no-restricted-imports` is ONE rule, and in flat config a later block REPLACES an
+// earlier block's setting for it rather than merging. Everything below exists because
+// of that sentence: a second block matching `**/*.itest.ts` — every one of which the
+// `**/*.ts` block already matched — switches the first block's rule OFF for every
+// integration test in the workspace, silently.
+//
+// MEASURED BEFORE IT WAS WRITTEN. `services/api/src/channels/channels.itest.ts` is on
+// no exemption list. Given `import { sql } from "drizzle-orm"` it fails lint under a
+// single block, and under a naively-added second block the only error left is
+// `'sql' is defined but never used`.
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
+        "The counter store lives in services/api/src/limits and services/gateway/src/limits.ts only (constitution I). Its keys are per environment; an unrestricted client is a cross-tenant read.",
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
+// The paths excused from the driver and the engine. Two data-access LAYERS as
+// directories and everything else by path, each with the argument it needs.
+const DRIVER_EXEMPT = [
+    "services/api/src/db/**",
+    "services/api/src/limits/**",
+    // DRIVER_EXEMPT — every path below is exempt from all three restricted modules,
+    // the driver's name on the marker notwithstanding: `driver-exempt.test.ts` reads
+    // the module names out of the rule, so this list governs whatever the rule names.
+    //
+    // First the lane's own infrastructure. Reasons, one per path:
+    //   global-setup.ts  installs the guard against a database vitest names
+    //   setup.ts         rewrites the connection string to carry the exemption
+    //   guard.itest.ts   holds one exempt client and one plain one, and the
+    //                    difference between them is the whole test
+    "packages/test-harness/src/global-setup.ts",
+    "packages/test-harness/src/setup.ts",
+    "packages/test-harness/src/guard.itest.ts",
+  // AND THE LANE RESET'S OWN TEST, which arrives with the table it clears. It asserts
+  // what the SCRIPT DID — a planted stale delivery gone, an organisation count unmoved
+  // — and both are facts about rows the script reached through its own connection.
+  // Going through the repository layer would mean asserting the script's effect against
+  // the code the script does not use.
+  "packages/test-harness/src/reset-lane.itest.ts",
+    // AND TWO SUITES THAT WRITE A ROW THE TYPE SYSTEM FORBIDS.
+    //
+    //   backfill.itest.ts  asserts what `toFrame` does with a SENDERLESS message.
+    //                      Those rows exist — every one written through the socket
+    //                      before the sender was threaded looks like this — and the
+    //                      repository can no longer produce one, because `userId` is
+    //                      required. The fixture has to be raw SQL or the behaviour
+    //                      has no test at all.
+    //   history.itest.ts   reads the same row from the other end: a page whose
+    //                      `user` comes back null. FR-MSG-15 made `sendMessage`
+    //                      require a sender, so this suite lost the ability to build
+    //                      its own fixture in the same change that gave it the case.
+    //
+    // This is the exemption's honest case: not "the repository is inconvenient" but
+    // "the state under test is one the repository is now unable to reach". Both are
+    // listed by path rather than reached through a shared helper, because a helper in
+    // another file names none of these specifiers and this rule sees only imports —
+    // an invisible exemption is worse than a listed one.
+    "services/api/src/internal/backfill.itest.ts",
+    "services/api/src/messages/history.itest.ts",
+    // THE QUOTA CHAPTER'S PERIOD SUITE, and its case is the two above's in a third
+    // shape: the state under test is one the repository cannot reach. `periodOf`
+    // returns the month a timestamp falls in, and the property is that a row INSERTED
+    // under that value is FOUND by it — which needs a `usage_periods` row written
+    // directly, because every repository path that writes one derives the period from
+    // the clock and so cannot disagree with the function under test.
+    //
+    // A suite that used the repository here would be asserting that `periodOf` equals
+    // itself.
+    "services/api/src/quotas/period.itest.ts",
+    // AND THE QUOTA SUITE ITSELF, for a different reason from its sibling above.
+    // `period.itest.ts` writes a row the repository cannot; this one READS the two
+    // roll-up tables directly to check what a send left behind. Going through
+    // `usageFor` would mean asserting the roll-up against the function that reads
+    // it — the same circularity, one table over.
+    "services/api/src/quotas/quotas.itest.ts",
+    // AND THE CONNECTION-METERING CHAPTER'S, WHICH MAKES THE SAME CLAIM ONE
+    // DIMENSION OVER: a credited minute survives a `FLUSHALL` of the counter store,
+    // because a quota is about THIS MONTH and the rate limiter's store is allowed to
+    // lose things. Proving that needs the flush, and the flush needs a raw client.
+    //
+    // LISTED RATHER THAN DODGED. Published's version reached for
+    // `await import("ioredis")` inside the test, which this rule cannot see — an
+    // exemption that is invisible, which the note at the top of this block calls
+    // worse than a listed one. The static import puts it back under the rule and
+    // this entry is the answer.
+    "services/api/src/quotas/connections.itest.ts",
+    // ── AND EVERY OTHER REDIS CLIENT, BY PATH, WITH THE ARGUMENT IT NEEDS ──
+    //
+    // The rule arrives here and TWELVE files older than it already import `ioredis`.
+    // A missing exemption is not a silent one — this rule goes red on a chapter
+    // nobody is editing — so all of them land in the commit that adds the rule.
+    // FIVE DIFFERENT ARGUMENTS, and a blanket "the gateway's Redis files" would
+    // erase all five distinctions the rule exists to make.
+    //
+    // (1) NO KEY IS TOUCHED AT ALL — these name a pub/sub SUBJECT and never a key,
+    // which is the property, not whether they publish or subscribe. The subjects are
+    // `chan:{channel_id}`, `member:{channel_id}` and `typing:{channel_id}`: a channel
+    // UUID, and a subject is not readable at all, only listened to by whoever already
+    // subscribed. There is no key here for a cross-tenant read to reach. (The api's
+    // two publishers publish; the gateway's `membership.ts` only ever subscribes,
+    // because the api publishes that fabric — and the argument is the same either
+    // way.)
+    "services/api/src/fanout/publisher.ts",
+    "services/api/src/membership/publisher.ts",
+    //
+    // (2) THE COUNTER STORE'S OTHER HALF. `rl:{environment_id}:…` is the key shape
+    // the whole restriction is about, and this file composes it — so it is exempt as
+    // the rule's own subject, not against its reason. `limits.itest.ts` is listed
+    // beside it for something the rule cannot express at all: its subject is that
+    // the api and the gateway increment the SAME key, and the only way to check that
+    // is to read the key with NEITHER of their code.
+    "services/gateway/src/limits.ts",
+    "services/gateway/src/limits.itest.ts",
+    "services/gateway/src/fanout.ts",
+    // `member:{env}:{user}` — the principal-addressed half of that fabric — DOES
+    // carry an environment id, and that still does not make it the limiter's case:
+    // a subject is not readable, and the id is composed from the repository's own
+    // scope on the way out and from the authenticated connection's identity on the
+    // way in, never read from a payload.
+    "services/gateway/src/membership.ts",
+    // `typing.ts` both publishes and subscribes and composes no key at all — the
+    // environment travels INSIDE the payload, where the receiving gateway checks it
+    // against the connection it is about to act on.
+    "services/gateway/src/typing.ts",
+    //
+    // (2) KEYS ARE COMPOSED AND THEY ARE ENVIRONMENT-SCOPED — the limiter's own
+    // argument rather than the publishers'. `presence:{env}:{user}` is exactly the
+    // shape the restriction guards. Every key is composed from the environment id on
+    // the authenticated connection's own identity; no path takes one from a client,
+    // and there is no scan, `KEYS` or pattern read that could reach another tenant's.
+    "services/gateway/src/presence.ts",
+    //
+    // (3) THE ENVIRONMENT COMES FIRST IN THE KEY, which is the strongest case on
+    // this list rather than the weakest. `conn:{env}:{user}:{slot}` makes
+    // constitution I structural in the key itself: reaching across a tenant needs a
+    // caller to hand this module another environment's id, and the session layer
+    // takes that from the api's verified identity. The other entries argue about
+    // what they touch; this one cannot be wrong without being lied to.
+    "services/gateway/src/connections.ts",
+    //
+    // (4) THE SUBJECT IS WHAT REACHES THE FABRIC, so the oracle cannot be either
+    // service's own client. A spy on `createFanout` or on `createPresence` proves
+    // that an object was asked to publish, not that a frame arrived — and these
+    // suites' receive halves have rejection paths (a body that is not JSON, a body
+    // that is JSON and not a transition) that no module-level API can produce,
+    // because each only ever publishes payloads its own schema built.
+    "services/api/src/fanout/fanout.itest.ts",
+    "services/gateway/src/presence.itest.ts",
+    "services/gateway/src/membership.itest.ts",
+    "services/gateway/src/typing.itest.ts",
+    //
+    // (5) THE RAW CLIENT IS THE STIMULUS, NOT THE ORACLE — a fifth reason, and the
+    // rule cannot express it. This suite's subject is delivery and it asserts on
+    // sockets. It needs a client to CAUSE a membership change: `Membership` exposes
+    // `onChange`, `subscribeChannel` and `watch` and no `publish`, because the api
+    // publishes and the gateway only ever subscribes.
+    "services/gateway/src/connections.itest.ts",
+    //
+    // `services/gateway/src/connections.test.ts` IS DELIBERATELY ABSENT, and the
+    // ledger that owed these entries said to add it. It reads the module's own
+    // source off disk and imports nothing restricted, so the exemption would be one
+    // over nothing — and `driver-exempt.test.ts`'s stale-entry check is the half of
+    // this list that goes red when a listed file stops needing it.
+];
+
+// The suites that drive a global drain on purpose — derived by asking, not by
+// remembering: these are exactly the `*.itest.ts` files in this tree that import one of
+// the functions `GLOBAL_DRAINS` names, and `drain-exempt.test.ts` asserts that in both
+// directions against the tree rather than against a second list.
+const DRAIN_EXEMPT_TESTS = [
+  // `outboxDepth` — the relay's whole subject IS a global drain.
+  "services/api/src/outbox/outbox.itest.ts",
+  // `drainDueDeliveries`, `sweepDisabledEndpoints`, `pendingDeliveryDepth`.
+  "services/api/src/webhooks/deliveries.itest.ts",
+  // `drainDueDeliveries`.
+  "services/api/src/webhooks/attempts.itest.ts",
+  //
+  // THREE, AND PUBLISHED'S LIST IS SIX. `test-event.itest.ts`,
+  // `notifications.itest.ts` and `dispatcher.itest.ts` are on it there and import
+  // nothing restricted HERE: two name a drain only in prose explaining why they do not
+  // call one, and the dispatcher's suite declares `drainDueDeliveries` as a property on
+  // a stub it builds. Listing them would be three standing exemptions over nothing on
+  // the list's first day — the failure mode this file's own note calls out, arriving
+  // by inheritance rather than by drift.
+  //
+  // `drain-exempt.test.ts` found all three, which is the only reason the list is three
+  // long. It reads the names out of `DRAIN_NAMES` below and asserts both directions
+  // against the TREE.
+];
+
+/** The six functions, and the two counts that cannot be bounded. Named once so the
+ * two specifier spellings below cannot drift apart. */
+const DRAIN_NAMES = [
+  "drainOutbox",
+  "drainDueDeliveries",
+  "drainDisableNotifications",
+  "drainQuotaNotifications",
+  "sweepDisabledEndpoints",
+  "outboxDepth",
+  "pendingDeliveryDepth",
+];
+
+const DRAIN_MESSAGE =
+  "This claims or counts rows across EVERY environment. In an integration test that " +
+  "is a local assertion about a global operation, or a global operation over a " +
+  "neighbour's fixture. Scope the assertion to rows this test created, or add the " +
+  "suite to DRAIN_EXEMPT_TESTS with its reason.";
+
+// THE GLOBAL ADMIN FUNCTIONS, RESTRICTED IN INTEGRATION TESTS.
+//
+// Six recorded instances of one fault: a test asserts a local fact about a global
+// operation, or performs one and damages a neighbour's fixture. Each imported one of
+// these and called it as though the database held only its own rows.
+//
+// The two `*Depth` functions are here for a different reason from the other five. They
+// take no batch size and cannot — a count has nothing to bound — and a global count
+// compared against itself is the instance that appeared twice in one file, four
+// chapters apart.
+//
+// WHAT THIS DOES NOT CATCH, and must not be trusted to: an indirect call — a helper in
+// another file that calls the function, imported here under an innocent name — and raw
+// SQL, which names no import at all. Both are the sentinel trigger's job; it watches
+// STATEMENTS rather than imports. A rule trusted further than it goes is worse than no
+// rule.
+//
+// BOTH SPELLINGS, because `no-restricted-imports` matches the specifier as WRITTEN.
+// `../db/repository` and `./repository` are two rules, and the second is the one a
+// suite inside `services/api/src/db/` would use.
+const GLOBAL_DRAINS = {
+  paths: [
+    {
+      name: "../db/repository",
+      importNames: DRAIN_NAMES,
+      message: DRAIN_MESSAGE,
+    },
+    {
+      name: "./repository",
+      importNames: DRAIN_NAMES,
+      message: DRAIN_MESSAGE,
+    },
+  ],
+};
+
 export default tseslint.config(
   { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] },
   eslint.configs.recommended,
   ...tseslint.configs.recommended,
   {
     // Dev scripts run on Node directly, outside any package's tsconfig —
@@ -39,168 +305,145 @@ export default tseslint.config(
     // file that imports the driver; nothing here can catch a LISTED file that stopped
     // importing it, so the list can only grow and a stale entry holds a standing
     // exemption forever. `driver-exempt.test.ts` reads this array and asserts each
     // path exists and still imports a module the rule below restricts — with those
     // module names read out of the rule rather than restated.
     files: ["**/*.ts"],
-    ignores: [
-      "services/api/src/db/**",
-      "services/api/src/limits/**",
-      // DRIVER_EXEMPT — every path below is exempt from all three restricted modules,
-      // the driver's name on the marker notwithstanding: `driver-exempt.test.ts` reads
-      // the module names out of the rule, so this list governs whatever the rule names.
-      //
-      // First the lane's own infrastructure. Reasons, one per path:
-      //   global-setup.ts  installs the guard against a database vitest names
-      //   setup.ts         rewrites the connection string to carry the exemption
-      //   guard.itest.ts   holds one exempt client and one plain one, and the
-      //                    difference between them is the whole test
-      "packages/test-harness/src/global-setup.ts",
-      "packages/test-harness/src/setup.ts",
-      "packages/test-harness/src/guard.itest.ts",
-      // AND TWO SUITES THAT WRITE A ROW THE TYPE SYSTEM FORBIDS.
-      //
-      //   backfill.itest.ts  asserts what `toFrame` does with a SENDERLESS message.
-      //                      Those rows exist — every one written through the socket
-      //                      before the sender was threaded looks like this — and the
-      //                      repository can no longer produce one, because `userId` is
-      //                      required. The fixture has to be raw SQL or the behaviour
-      //                      has no test at all.
-      //   history.itest.ts   reads the same row from the other end: a page whose
-      //                      `user` comes back null. FR-MSG-15 made `sendMessage`
-      //                      require a sender, so this suite lost the ability to build
-      //                      its own fixture in the same change that gave it the case.
-      //
-      // This is the exemption's honest case: not "the repository is inconvenient" but
-      // "the state under test is one the repository is now unable to reach". Both are
-      // listed by path rather than reached through a shared helper, because a helper in
-      // another file names none of these specifiers and this rule sees only imports —
-      // an invisible exemption is worse than a listed one.
-      "services/api/src/internal/backfill.itest.ts",
-      "services/api/src/messages/history.itest.ts",
-      // THE QUOTA CHAPTER'S PERIOD SUITE, and its case is the two above's in a third
-      // shape: the state under test is one the repository cannot reach. `periodOf`
-      // returns the month a timestamp falls in, and the property is that a row INSERTED
-      // under that value is FOUND by it — which needs a `usage_periods` row written
-      // directly, because every repository path that writes one derives the period from
-      // the clock and so cannot disagree with the function under test.
-      //
-      // A suite that used the repository here would be asserting that `periodOf` equals
-      // itself.
-      "services/api/src/quotas/period.itest.ts",
-      // AND THE QUOTA SUITE ITSELF, for a different reason from its sibling above.
-      // `period.itest.ts` writes a row the repository cannot; this one READS the two
-      // roll-up tables directly to check what a send left behind. Going through
-      // `usageFor` would mean asserting the roll-up against the function that reads
-      // it — the same circularity, one table over.
-      "services/api/src/quotas/quotas.itest.ts",
-      // ── AND EVERY OTHER REDIS CLIENT, BY PATH, WITH THE ARGUMENT IT NEEDS ──
-      //
-      // The rule arrives here and TWELVE files older than it already import `ioredis`.
-      // A missing exemption is not a silent one — this rule goes red on a chapter
-      // nobody is editing — so all of them land in the commit that adds the rule.
-      // FIVE DIFFERENT ARGUMENTS, and a blanket "the gateway's Redis files" would
-      // erase all five distinctions the rule exists to make.
-      //
-      // (1) NO KEY IS TOUCHED AT ALL — these name a pub/sub SUBJECT and never a key,
-      // which is the property, not whether they publish or subscribe. The subjects are
-      // `chan:{channel_id}`, `member:{channel_id}` and `typing:{channel_id}`: a channel
-      // UUID, and a subject is not readable at all, only listened to by whoever already
-      // subscribed. There is no key here for a cross-tenant read to reach. (The api's
-      // two publishers publish; the gateway's `membership.ts` only ever subscribes,
-      // because the api publishes that fabric — and the argument is the same either
-      // way.)
-      "services/api/src/fanout/publisher.ts",
-      "services/api/src/membership/publisher.ts",
-      //
-      // (2) THE COUNTER STORE'S OTHER HALF. `rl:{environment_id}:…` is the key shape
-      // the whole restriction is about, and this file composes it — so it is exempt as
-      // the rule's own subject, not against its reason. `limits.itest.ts` is listed
-      // beside it for something the rule cannot express at all: its subject is that
-      // the api and the gateway increment the SAME key, and the only way to check that
-      // is to read the key with NEITHER of their code.
-      "services/gateway/src/limits.ts",
-      "services/gateway/src/limits.itest.ts",
-      "services/gateway/src/fanout.ts",
-      // `member:{env}:{user}` — the principal-addressed half of that fabric — DOES
-      // carry an environment id, and that still does not make it the limiter's case:
-      // a subject is not readable, and the id is composed from the repository's own
-      // scope on the way out and from the authenticated connection's identity on the
-      // way in, never read from a payload.
-      "services/gateway/src/membership.ts",
-      // `typing.ts` both publishes and subscribes and composes no key at all — the
-      // environment travels INSIDE the payload, where the receiving gateway checks it
-      // against the connection it is about to act on.
-      "services/gateway/src/typing.ts",
-      //
-      // (2) KEYS ARE COMPOSED AND THEY ARE ENVIRONMENT-SCOPED — the limiter's own
-      // argument rather than the publishers'. `presence:{env}:{user}` is exactly the
-      // shape the restriction guards. Every key is composed from the environment id on
-      // the authenticated connection's own identity; no path takes one from a client,
-      // and there is no scan, `KEYS` or pattern read that could reach another tenant's.
-      "services/gateway/src/presence.ts",
-      //
-      // (3) THE ENVIRONMENT COMES FIRST IN THE KEY, which is the strongest case on
-      // this list rather than the weakest. `conn:{env}:{user}:{slot}` makes
-      // constitution I structural in the key itself: reaching across a tenant needs a
-      // caller to hand this module another environment's id, and the session layer
-      // takes that from the api's verified identity. The other entries argue about
-      // what they touch; this one cannot be wrong without being lied to.
-      "services/gateway/src/connections.ts",
-      //
-      // (4) THE SUBJECT IS WHAT REACHES THE FABRIC, so the oracle cannot be either
-      // service's own client. A spy on `createFanout` or on `createPresence` proves
-      // that an object was asked to publish, not that a frame arrived — and these
-      // suites' receive halves have rejection paths (a body that is not JSON, a body
-      // that is JSON and not a transition) that no module-level API can produce,
-      // because each only ever publishes payloads its own schema built.
-      "services/api/src/fanout/fanout.itest.ts",
-      "services/gateway/src/presence.itest.ts",
-      "services/gateway/src/membership.itest.ts",
-      "services/gateway/src/typing.itest.ts",
-      //
-      // (5) THE RAW CLIENT IS THE STIMULUS, NOT THE ORACLE — a fifth reason, and the
-      // rule cannot express it. This suite's subject is delivery and it asserts on
-      // sockets. It needs a client to CAUSE a membership change: `Membership` exposes
-      // `onChange`, `subscribeChannel` and `watch` and no `publish`, because the api
-      // publishes and the gateway only ever subscribes.
-      "services/gateway/src/connections.itest.ts",
-      //
-      // `services/gateway/src/connections.test.ts` IS DELIBERATELY ABSENT, and the
-      // ledger that owed these entries said to add it. It reads the module's own
-      // source off disk and imports nothing restricted, so the exemption would be one
-      // over nothing — and `driver-exempt.test.ts`'s stale-entry check is the half of
-      // this list that goes red when a listed file stops needing it.
-    ],
+    ignores: DRIVER_EXEMPT,
+
+    rules: {
+      "no-restricted-imports": ["error", DRIVER_AND_ENGINE],
+    },
+  },
+  {
+    // ── AND THE UNION, WHICH IS THE WHOLE REASON THE SETS ARE NAMED ─────────────
+    //
+    // Every `*.itest.ts` the block above matched as `**/*.ts` is matched again here, so
+    // this rule must be the UNION or the driver ban is switched off for all of them.
+    // The two exemption lists are ignored here and given their own single rule below,
+    // because `ignores` on the FIRST block cannot reach a rule the SECOND one sets.
+    files: ["**/*.itest.ts"],
+    ignores: [...DRAIN_EXEMPT_TESTS, ...DRIVER_EXEMPT],
     rules: {
       "no-restricted-imports": [
         "error",
         {
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
+          paths: [...DRIVER_AND_ENGINE.paths, ...GLOBAL_DRAINS.paths],
+          patterns: DRIVER_AND_ENGINE.patterns,
+        },
+      ],
+    },
+  },
+  {
+    // The driver-exempt paths keep their exemption and gain the drain rule. Without
+    // this block the union above would restore the ban they were excused from.
+    files: DRIVER_EXEMPT,
+    rules: {
+      "no-restricted-imports": ["error", GLOBAL_DRAINS],
+    },
+  },
+  {
+    // And the drain-exempt suites get the driver rule alone. They drive a global drain
+    // on purpose; they are excused from nothing else.
+    files: DRAIN_EXEMPT_TESTS,
+    rules: {
+      "no-restricted-imports": ["error", DRIVER_AND_ENGINE],
+    },
+  },
+  {
+    // THE SEAL ON `packages/outsider` (FR-030, FR-034, research R12).
+    //
+    // That package holds one suite that behaves like a customer, and the claim it makes
+    // — an integration built from published documentation alone — is worth nothing if
+    // the suite can read the platform's source. So the claim is made mechanical, in
+    // three levels, and this block is levels 2 and 3.
+    //
+    // LEVEL 1 IS NOT A RULE AT ALL. `packages/outsider/package.json` declares no
+    // `@relay/*` dependency, and pnpm's isolated `node_modules` means there is no
+    // `@relay` directory at the workspace root — so
+    // `import { ERROR_CODES } from "@relay/protocol"` fails to RESOLVE. Nothing lints
+    // it; the module is not there.
+    //
+    // LEVEL 2 is the import rule below: a specifier that climbs out of the package by a
+    // relative or absolute path is refused. That closes the obvious way round level 1,
+    // which is to spell the same import as `../protocol/src/codes.js`.
+    //
+    // LEVEL 3 is the syntax rule, and an import rule cannot reach it.
+    // `packages/e2e/src/harness.ts` builds `join(HERE, "..", "..", "..")` and spawns the
+    // api's build output from it — a STRING, not an import specifier, so
+    // `no-restricted-imports` never sees it. The file cited as proof the hole exists is
+    // also proof the import rule does not close it. So `".."` as a literal is banned
+    // here, and so is `createRequire`, which is the other way to turn a computed path
+    // into a module.
+    //
+    // WHAT NONE OF THE THREE CLOSES, and three rules must not be left to imply a
+    // fourth: reading the repository's source with human eyes. Whoever writes that suite
+    // can open `codes.ts` in an editor, and no configuration can stop them. The seals
+    // make workspace code unIMPORTABLE; not reading it is a discipline, and the chapter
+    // says so in those words rather than presenting three rules as if they were four
+    // (FR-034).
+    //
+    // ── AND THIS BLOCK IS LAST, WHICH IS LOAD-BEARING ───────────────────────────────
+    //
+    // `no-restricted-imports` has one winner per file: the last matching block. Every
+    // block above matches `**/*.ts`, so this one has to carry the UNION it needs rather
+    // than only its own half — the driver and the engine included, because `pg` DOES
+    // resolve here by the ordinary parent walk even though `@relay/*` does not.
+    //
+    // Published's version set only the outsider's own patterns and worked by luck:
+    // `no-restricted-syntax` survives because no other block sets it, and the driver
+    // ban was simply gone for this package. That is the same replacement fault the
+    // hoisted sets above exist for, in the one block that most needs the ban.
+    files: ["packages/outsider/**/*.ts", "packages/outsider/**/*.mts"],
+    rules: {
+      "no-restricted-imports": [
+        "error",
+        {
+          paths: DRIVER_AND_ENGINE.paths,
+          patterns: [
+            ...DRIVER_AND_ENGINE.patterns,
             {
-              name: "ioredis",
+              group: ["@relay/*"],
               message:
-                "The counter store lives in services/api/src/limits and services/gateway/src/limits.ts only (constitution I). Its keys are per environment; an unrestricted client is a cross-tenant read.",
+                "packages/outsider integrates from published documentation alone. It may not import workspace code — see the three levels in eslint.config.mjs.",
             },
-          ],
-          patterns: [
             {
-              group: ["drizzle-orm/*"],
+              // NOT `/*` as a third entry here: minimatch matched `vitest/config` with
+              // it, and a rule that refuses the test runner is a rule somebody turns
+              // off. Absolute paths are covered by the syntax selector below, which
+              // matches on the specifier itself.
+              group: ["../*", "../../*"],
               message:
-                "The query engine lives inside the repository layer only (constitution I, ADR-16).",
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
+          // An absolute path is the third spelling of the same import. Matched on the
+          // specifier rather than by glob, because the glob for it also matched
+          // `vitest/config`.
+          selector: "ImportDeclaration[source.value=/^\\//]",
+          message:
+            "packages/outsider may not import by absolute path. See the three levels in eslint.config.mjs.",
+        },
+      ],
     },
   },
 );
\ No newline at end of file
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
@@ -43,15 +43,28 @@
         "RELAY_REDIS_PORT",
         "RELAY_NATS_URL",
         "RELAY_NATS_PORT",
         "RELAY_OUTBOX_RELAY",
         "RELAY_DELIVERY_RELAY",
         "RELAY_INTERNAL_CREDENTIAL",
+        "RELAY_INTERNAL_CREDENTIAL_GATEWAY",
+        "RELAY_METER_INTERVAL_MS",
+        "RELAY_AUTH_FAILURES_PER_MINUTE",
+        "RELAY_AUTH_KEY_PREFIX",
         "RELAY_WEBHOOK_SECRET_KEY",
         "RELAY_EVENT_CONSUMER",
-        "RELAY_NATS_REPLICAS"
+        "RELAY_NATS_REPLICAS",
+        "RELAY_E2E_API_PORT",
+        "RELAY_SMTP_URL",
+        "RELAY_MAILPIT_URL",
+        "RELAY_NOTIFICATION_RELAY",
+        "RELAY_QUOTA_RELAY",
+        "RELAY_DOCS_BASE_URL",
+        "RELAY_API_URL",
+        "RELAY_WS_URL",
+        "RELAY_DEMO_CREDENTIAL"
       ]
     },
     "//#lint:root": {
       "inputs": [
         "**/*.{ts,mts,cts,mjs,js}",
         "eslint.config.mjs",
```

```diff title="vitest.coverage.config.mts"
@@ -41,8 +41,10 @@ export default defineConfig({
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
+      // The quota chapter's relay, the fourth. Same reason as the other three.
+      RELAY_QUOTA_RELAY: "off",
     },
     setupFiles: ["./packages/test-harness/src/setup.ts"],
     include: [
       "packages/*/src/**/*.test.ts",
```

```diff title="packages/e2e/src/harness.ts"
@@ -399,19 +399,35 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
       "RELAY_NATS_PORT",
       // The api decrypts webhook signing secrets and authenticates
       // the dispatcher. Both are configuration, and a child that invents either
       // would be a second source of truth for a credential.
       "RELAY_WEBHOOK_SECRET_KEY",
       "RELAY_INTERNAL_CREDENTIAL",
+      // The rate-limit chapter's other half: where the notification relay posts its SMTP.
+      // The lane runs Mailpit on 11025 and the default is 1025, so an
+      // unforwarded variable is not a missing feature — it is a mailer talking
+      // confidently to a port nothing is listening on.
+      "RELAY_SMTP_URL",
+      // The failed-authentication threshold and the counter's key
+      // prefix. Forwarded for the reason this list exists at all — turbo runs
+      // tasks in STRICT env mode, so an undeclared variable reaches a child as
+      // `undefined` and the `??` behind it silently wins. A suite that raised the
+      // threshold would raise it in the parent and not in the api the child runs.
+      "RELAY_AUTH_FAILURES_PER_MINUTE",
+      "RELAY_AUTH_KEY_PREFIX",
     ),
     // The api children run WITHOUT the outbox relay. This journey
     // asserts message delivery, and a background loop draining the outbox while
     // the outbox chapter's own suite asserts on that same table is a race between two test
     // files, not a property of the system. The relay has its own suite, which
     // drives it explicitly.
     RELAY_OUTBOX_RELAY: "off",
+    // The rate-limit chapter: and no notification relay either, for the same reason. This
+    // journey asserts message delivery; a loop marking rows delivered while
+    // the rate-limit chapter's own suite asserts on that column is a race between test files.
+    RELAY_NOTIFICATION_RELAY: "off",
     // No event consumer in these children either, for the reason
     // the line above exists — this journey asserts message delivery, and a
     // background consumer writing to a table the broker chapter's suite asserts on is a race
     // between test files rather than a property of the system.
     RELAY_EVENT_CONSUMER: "off",
     // The webhook dispatcher chapter: nor the delivery relay, for the third time and the same
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
+        // The connection-metering chapter's three, pinned at what they measure, with a reason each.
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

```diff title="services/gateway/src/resume.itest.ts"
@@ -55,27 +55,36 @@ function token(): Promise<string> {
 
 interface Harness {
   url: string;
   close: () => Promise<void>;
 }
 
-async function boot(api: ApiClient): Promise<Harness> {
+/** The connection-metering chapter widened `ApiClient` with `reportUsage`, and every stub in this
+ * file is about resume rather than metering — so the method is supplied here
+ * once instead of six times, and the `Omit` says which half these tests speak
+ * to. */
+async function boot(api: Omit<ApiClient, "reportUsage">): Promise<Harness> {
   const fanout = createFanout({ url, logger: silent });
   const server: Server = serve({
     service: "gateway",
       notFoundDocsUrl: docsUrl("not_found"),
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
   };
 }
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
+    // AND `packages/outsider` FOR A DIFFERENT REASON, added in the channel-control chapter's Phase 1.
+    // That suite integrates against a platform it does not start: without
+    // RELAY_API_URL, RELAY_WS_URL and RELAY_DEMO_CREDENTIAL it throws on purpose and
+    // prints the five commands that would satisfy it. `pnpm coverage` sets none of
+    // them, so it failed every coverage run — 8 tests skipped, one failed suite.
+    //
+    // The isolation gauntlet split the lanes so `pnpm test:integration` is
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
     // not design for — the outbox chapter's outbox suite learned that the hard way.
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
+        // The presence chapter's two, both at 100 on every metric, and the pin is
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
+        // ── THE MEMBERSHIP-REVOCATION CHAPTER'S FOUR NEW PRODUCTION FILES ──
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
+        // and drove each with a test in that phase. The presence chapter met its equivalents
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
+        // `packages/protocol/src/typing.ts` reached 100 on the
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
+        // `services/gateway/src/connections.ts` at 100 on all four,
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
 
+        // The attachment shape and the REST door's schemas, both at 100 on
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
+        // The REST door, pinned for the first time because the attachments chapter is the first to
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

The api logs the port it BOUND. `port` is the request — `Number(process.env.PORT ?? 4000)` — so
under `PORT=0` this line reported `0` while the server listened elsewhere. A log stating a
requested value as though it were assigned is wrong whether or not anybody reads it; that it also
makes `PORT=0` usable by a harness is the second reason, not the first.

The same change, the same shape, in the gateway's entry point.

**The edit's UPDATE became a compare-and-set, and it closes a defect the record said was not
there.** `gaps.md` 3.23-3 asserted that both orderings of a concurrent edit and deletion end in a
tombstone. They do not: the edit read the row, threw if it was deleted, and then updated
`WHERE id = ?` unconditionally, so a deletion committing in that window was overwritten —
`deleted_at` set with `text` present, four such rows left in the lane. Three runs in five.

The four tests that found it. Three cover the orderings; the fourth reproduces the guard's case
deterministically, because a race cannot be commanded and an assertion that one happened proved
flaky in one run of three.

**Port 0 and a teardown that waits.** Every child now binds an ephemeral port and the harness
reads the assignment out of the child's own `listening` line — from the buffer `capture` already
filled and only ever used for a failure message. `stop()` waits for each child with a one-second
grace then SIGKILL: the api holds its listener for all 5,035 ms of a graceful exit, so awaiting
one cost 30.56 s on a lane with 5.39 s of headroom.

The suite deletes the two durables it names per run. `consumer.itest.ts` has done this since
chapter 3.4; chapter 3.24's close-out counted 216 consumers on DELIVERIES, 215 of them this
file's.

**Twelve tests left this file and five stayed.** It is a `.test.ts` in the lane chapter 2.1 built
to need no containers, and twelve of its seventeen talked to a real Redis. Which five stay was
measured — `12 failed | 5 passed` against a dead broker — not argued: research predicted two.

The twelve that arrived, unchanged in behaviour.

```diff title="services/gateway/src/connections.itest.ts"
@@ -143,12 +143,16 @@ async function boot(options: {
     }),
     memberships: async () => options.channels,
     backfill: async () => ({}) as never,
     sendMessage: async () => {
       throw new Error("not used");
     },
+    // NULL, WHICH IS WHAT A GATEWAY WITH NO METERING CREDENTIAL GETS. This suite is
+    // about the connection cap and reports nothing; the api's side takes the same safe direction, so
+    // with nothing configured no report is sent and no route is reached.
+    reportUsage: async () => null,
   };
   const registry: Connections | undefined =
     options.cap === undefined
       ? undefined
       : createConnections({
           url: options.cap.url ?? REDIS,
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
@@ -91,13 +91,15 @@ interface ApiUnderTest {
 }
 
 /** Two members of ONE channel, which no existing gateway fixture provides:
  * `seedSocketTenants` gives one user per tenant, and presence needs a watcher and
  * a subject who share a channel. */
 async function startApi(): Promise<ApiUnderTest> {
-  const port = 4700 + Math.floor(Math.random() * 200);
+  // `PORT=0`, AND THE PORT READ BACK FROM THE CHILD. This picked 4700–4899 from a
+  // table of bands maintained in comments across seven files; nothing checks such a
+  // table, and this one already overlapped another suite's range by sixty ports.
   const dist = join(REPO, "services", "api", "dist");
   if (!existsSync(join(dist, "main.js"))) {
     throw new Error(
       "the api is not built — run `pnpm build` before this lane " +
         "(the suite talks to the real service, not a stub)",
     );
@@ -174,29 +176,51 @@ async function startApi(): Promise<ApiUnderTest> {
   await otherRepo.addMember(elsewhere.id, stranger.id);
   const otherKey = await seeder.createApiKey(db, { environmentId: other.id });
 
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
+    // PIPED, NOT IGNORED: a child whose output is discarded cannot report the port it
+    // bound, which is why the two decisions are one decision.
+    stdio: ["ignore", "pipe", "pipe"],
   });
+  const port = await new Promise<number>((resolve, reject) => {
+    const timer = setTimeout(() => reject(new Error("api never reported a port")), 30_000);
+    let buffered = "";
+    child.stdout?.on("data", (chunk: Buffer) => {
+      buffered += chunk.toString();
+      for (const line of buffered.split("\n")) {
+        if (!line.trim()) continue;
+        try {
+          const parsed = JSON.parse(line) as { msg?: string; port?: number };
+          if (parsed.msg === "listening" && typeof parsed.port === "number") {
+            clearTimeout(timer);
+            resolve(parsed.port);
+            return;
+          }
+        } catch {
+          /* a partial line; the next chunk completes it */
+        }
+      }
+    });
+    child.on("exit", (code) => {
+      clearTimeout(timer);
+      reject(new Error(`api exited before listening (code ${String(code)})`));
+    });
+  });
+  // AND NO HEALTH LOOP. The `listening` line IS the readiness signal. The loop this
+  // replaced probed `/health` against an api that serves `/healthz` — a hundred failed
+  // requests, ten seconds of sleeping, and the url returned anyway. It had never once
+  // succeeded, and nothing could tell: a flat sleep long enough for the api to boot
+  // reports success either way.
   const url = `http://127.0.0.1:${port}`;
-  for (let i = 0; i < 100; i += 1) {
-    try {
-      const res = await fetch(`${url}/health`);
-      if (res.ok) break;
-    } catch {
-      /* not up yet */
-    }
-    await new Promise((r) => setTimeout(r, 100));
-  }
   return {
     url,
     credential: key.credential,
     subjects,
     outboxCount: async () => {
       const result = (await pool.query("select count(*)::int as n from outbox")) as {
```

`isolation.itest.ts` starts TWO api children, and its band came with a counter so the
two draws could not collide with each other. `PORT=0` makes that impossible rather
than unlikely, so the counter goes with the band.

`public-surface.itest.ts` is the same change, and its own comment already knew the
shape of the problem: a previous run's child still holding a port answers the health
check from a different environment.

The dispatcher's api child moves too — with one deliberate exception. Invariant 11
kills the api and starts another, and that restart must land back on the same
address, because the assertion is that the retry schedule survived in the DATABASE.

`presence.itest.ts` counted `select count(*) from outbox` — every row written by
anything — to assert that a presence transition writes none. Vitest runs this
package's files in parallel, so `membership.itest.ts` sending a message next door
moved the number: `expected 614255 to be 614250`, twice in eight runs, with nothing
in the failure suggesting a neighbour. The outbox has no `environment_id` column, so
the subject scopes it.

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

The same sentence, in the file the generator would have read.

```diff title="services/api/src/db/schema.ts"
@@ -649,18 +649,21 @@ export const consumedEvents = pgTable(
 // the platform's own bookkeeping AND no tenant-visible content. An endpoint is
 // customer configuration; a dead letter holds a payload that was being sent to a
 // customer. Both fail the test on both halves, so both are scoped and both join
 // the cross-tenant gauntlet as targets.
 //
 // NAMED, NOT NUMBERED. This line used to say "chapter 3.7's cross-tenant
-// gauntlet". The gauntlet was 3.7 when that was written, became 3.8 when a chapter
-// was inserted ahead of it, and is now 3.9 after a second insertion — and the
-// comment was carried neither time. A chapter number in a source comment is a
-// reference that ages every time the plan changes, and this file is fenced
-// byte-exact into a published chapter, so correcting it costs a fence amendment.
-// The subject does not move; the ordinal does.
+// gauntlet", and the gauntlet has moved three times since — carried by the
+// comment none of them. A chapter number in a source comment is a reference that
+// ages every time the plan changes, and this file is fenced byte-exact into a
+// published chapter, so correcting it costs a fence amendment.
+//
+// The sentence you are reading replaced one that stated the ordinals and went
+// stale in the very next chapter, which is the rule proving itself on its own
+// explanation. It now names no numbers at all. The subject does not move; the
+// ordinal does.
 // ---------------------------------------------------------------------------
 
 // DECISION: no source document defines this table. FR-WHK-01 and
 // FR-WHK-08 require the behaviour — up to five endpoints per environment, each
 // with an independently rotatable signing secret — and leave the shape open.
 //
```

And the dependency that made generating possible. `drizzle-orm` stays — it is the
query builder the repository layer is built on (ADR-16), and it has nothing to do with
generation.

```diff title="services/api/package.json"
@@ -19,20 +19,22 @@
     "@relay/protocol": "workspace:*",
     "@relay/service-kit": "workspace:*",
     "drizzle-orm": "^0.45.2",
     "ioredis": "^6.0.0",
     "jose": "^6.2.7",
     "nats": "^2.29.3",
+    "nodemailer": "^9.0.5",
     "pg": "^8.22.0",
     "reflect-metadata": "^0.2.2",
     "rxjs": "^7.8.2",
     "zod": "^4.4.3"
   },
   "devDependencies": {
     "@nestjs/cli": "^11.0.24",
     "@nestjs/testing": "^11.1.28",
     "@swc/core": "^1.15.47",
+    "@types/nodemailer": "^8.0.1",
     "@types/pg": "^8.20.3",
     "drizzle-kit": "^0.31.10",
     "unplugin-swc": "^1.5.9"
   }
 }
\ No newline at end of file
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

The internal door stops spelling the number.

The REST door, and the edit body beside it — which keeps its own `.min(1)` and now
shares only the maximum.

The tests, including the one asserting that `messageSchema` is deliberately NOT
bounded: it is what the server emits, read off rows already stored, and a reader of
anything durable cannot impose a rule its writer did not have.

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

And the tests, including the control that catches an over-tight refinement: a rule
refusing everything would pass the refusal test and break every customer.

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
@@ -395,19 +395,19 @@ describe("the public channel surface", () => {
       expect(await second.json()).toMatchObject({ type: "private" });
     });
   });
 
   // ── REMOVAL, BULK, BECAUSE THE REQUIREMENT ALWAYS WAS ───────────────────────
   //
-  // FR-006 says "up to 100 in one request" and FR-007 says the result is reported
-  // per user — the channel-endpoints chapter's add shape in both halves. The contract specified a
-  // single-user `DELETE` for ten analysis passes, having read "the shape the
-  // endpoints chapter chose" as *named outcomes* and dropped *bulk*. Every pass
-  // requirements to tasks, both said "removal", and identifier coverage read 100%.
-  // Comparing US2's scenario 4 — which names a hundred users — to the route's path,
-  // which named one, is what found it.
+  // FR-006 says "up to 100 in one request" and FR-007 says the result is reported per
+  // user — the endpoints chapter's add shape in both halves. The contract specified a
+  // single-user `DELETE` for ten analysis passes, having read "the shape that chapter
+  // chose" as *named outcomes* and dropped *bulk*. Every pass compared requirements
+  // to tasks, both said "removal", and identifier coverage read 100%. Comparing US2's
+  // scenario 4 — which names a hundred users — to the route's path, which named one,
+  // is what found it.
   describe("POST /v1/channels/:channelId/members/remove (FR-006, FR-007)", () => {
     let target: string;
 
     const remove = (channel: string, users: string[], key = credential) =>
       fetch(`${url}/v1/channels/${channel}/members/remove`, {
         method: "POST",
```

The isolation gauntlet's describe carried two ids at once, and the comment above it a third. What
that comment is actually saying survives the edit intact: only two of the five platform routes
name an environment alongside an identifier, so only those two can be told to act on one tenant
while carrying something from another.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -1,15 +1,18 @@
 import "reflect-metadata";
 
+import { randomUUID } from "node:crypto";
+
 import type { INestApplication } from "@nestjs/common";
 import { Test } from "@nestjs/testing";
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 
 import { AppModule } from "../app.module";
+import { createAnalyticalStore } from "../metering/clickhouse";
 import { mintUserToken } from "../auth/user-token";
-import { environmentSigningSecret, Repository } from "../db/repository";
+import { environmentSigningSecret, Repository, usageFor } from "../db/repository";
 import { createDb, createPool } from "../db/client";
 import {
   credentialAttack,
   listAttack,
   readAttack,
   rowsOf,
@@ -23,12 +26,13 @@
   seedSameTenant,
   seedTwoTenants,
   type CollidingTenants,
   type SameTenant,
   type TwoTenants,
 } from "./fixtures";
+import { periodOf } from "../quotas/period";
 import { CLASSIFICATIONS, targetKey } from "./targets";
 
 import type { Db } from "../db/client";
 
 // THE GAUNTLET (NFR-SEC-09, constitution I).
 //
@@ -340,12 +344,28 @@
     // Whatever it answers, nothing of the victim's may appear in it.
     expect(serialised).not.toContain(t.victim.userId);
     expect(serialised).not.toContain(t.victim.channelId);
     expect(serialised).not.toContain(t.victim.environmentId);
   });
 
+  it("GET /internal/memberships — the attacker's token hears only its own channels", async () => {
+    attacked.add("GET /internal/memberships");
+    // THE SAME ATTACK AS `/internal/session` AND FOR THE SAME REASON: nothing here is
+    // forgeable but the credential. The backstop's whole job is to answer "what may
+    // this connection hear now", so a leak here is a channel id the caller could then
+    // subscribe to.
+    const res = await fetch(`${url}/internal/memberships`, {
+      headers: { authorization: `Bearer ${attackerToken}` },
+    });
+    const body: unknown = res.ok ? await res.json() : null;
+    const serialised = JSON.stringify(body ?? "");
+    expect(serialised).not.toContain(t.victim.channelId);
+    expect(serialised).not.toContain(t.victim.userId);
+    expect(serialised).not.toContain(t.victim.environmentId);
+  });
+
   // ── the two routes this chapter added ──────────────────────────────────────────
   //
   // A chapter that adds an endpoint attacks it in the same chapter. The derivation
   // found these before the classification did: `targets.itest.ts` went from 9 targets
   // to 11 and failed naming both as unclassified.
   it("POST /v1/channels/:channelId/members — refuses, and adds nobody", async () => {
@@ -973,14 +993,293 @@
       // zero from an unrecognised shape reads exactly like a count of zero from a
       // correctly-scoped list. That is the one answer this block must never confuse
       // with success, so the recogniser is asserted against both shapes it claims to
       // handle and against one it does not.
       expect(rowsOf([1, 2])).toHaveLength(2);
       expect(rowsOf({ data: [1] })).toHaveLength(1);
+      // The request log's envelope (chapter 4.8), added by name rather than derived.
+      expect(rowsOf({ requests: [1, 2, 3] })).toHaveLength(3);
       expect(rowsOf({ items: [1, 2, 3] })).toEqual([]);
       expect(rowsOf(null)).toEqual([]);
+      // AND THIS LINE IS WHY THE SET IS NAMED RATHER THAN DERIVED. 4.8 replaced the
+      // lookup with "the first array-valued property" and this assertion went red: a
+      // body whose rows are under `data` but which carries some other array first would
+      // be counted from the wrong one, and a `count > 0` control satisfied by the wrong
+      // array is a false pass where an unknown shape is a loud failure.
+      expect(rowsOf({ cursors: [1, 2, 3], data: [1] })).toHaveLength(1);
+    });
+  });
+
+  // ── the webhook surface (this chapter) ─────────────────────────────────────────
+  //
+  // WRITTEN BECAUSE THE LEDGER OWED THEM AND THE ACCOUNTING TEST COLLECTED. Eleven
+  // routes were classified here and none attacked; the failure named all eleven by
+  // path. Seven are the customer's endpoint surface and four are the internal seam
+  // beneath it, of which one can be attacked at all — see `targets.ts` for why the
+  // other three are `exempt` rather than silently unattacked.
+  describe("webhooks: a foreign endpoint id is another tenant's", () => {
+    const victimEndpoints = () => t.victim.repo.listEndpoints();
+
+    it("GET /v1/webhooks/:id — a foreign endpoint reads as an absent one", async () => {
+      attacked.add("GET /v1/webhooks/:id");
+      const verdict = await readAttack(
+        url,
+        t.attacker.credential,
+        { method: "GET", path: `/v1/webhooks/${t.victim.endpointId}` },
+        { method: "GET", path: `/v1/webhooks/${ABSENT_UUID}` },
+      );
+      expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+      // A PAIR CAN AGREE BY BOTH LEAKING. The status says it refused, and the body
+      // says the victim's url never came back — an endpoint's url is the customer's
+      // own infrastructure and is exactly what must not cross.
+      expect(verdict.foreign.status).toBe(404);
+      expect(JSON.stringify(verdict.foreign.body)).not.toContain("victim");
+    });
+
+    it("GET /v1/webhooks — the listing carries its own rows and none of the victim's", async () => {
+      attacked.add("GET /v1/webhooks");
+      const verdict = await listAttack(
+        url,
+        t.attacker.credential,
+        { method: "GET", path: "/v1/webhooks" },
+        [t.victim.endpointId, t.victim.environmentId],
+      );
+      expect(verdict.status).toBe(200);
+      expect(verdict.leaked, `leaked: ${verdict.leaked.join(", ")}`).toEqual([]);
+      // AND ITS OWN ENDPOINT IS THERE. A listing that returned nothing at all would
+      // pass the leak check while being broken, which is the `list` shape's own trap.
+      expect(verdict.count, "the attacker's own listing came back empty").toBeGreaterThan(0);
+    });
+
+    /** THE REQUEST LOG (chapter 4.8, FR-ANL-07, FR-029).
+     *
+     * `GET /v1/webhooks`'s argument, one surface over, and the isolation claim is
+     * STRONGER here than on any other `list`. 60.5% of `api_requests` carries no tenant
+     * at all — every 404, every 401, `/healthz`, signup, and every call the dispatcher
+     * and gateway make on the internal seam — so this attack has two things to show
+     * rather than one: no row from another environment appears in a 200, and **no
+     * tenantless row does either**. That is chapter 4.4's reading of constitution I
+     * asserted rather than argued: a record with no tenant is not tenant data, and it is
+     * unreachable from every tenant's query because it carries no tenant to match.
+     *
+     * AND THIS ATTACK PLANTS ITS OWN ROWS, WHICH NO OTHER ONE IN THIS FILE HAS TO.
+     * `compose.yaml` runs no ingester (`gaps.md` 050-8), so both tenants' logs are empty
+     * on a fresh lane — and an empty log passes the leak check for the same reason an
+     * empty page does: there is nothing in it to leak. Without the plant this test could
+     * not fail for its own reason, which is the class this suite exists to catch one
+     * level up.
+     *
+     * NOTHING IS DELETED AFTERWARDS, which is this fixture's own convention stated at the
+     * top of `fixtures.ts`: every row is scoped to an environment the fixture minted, and
+     * a teardown that reached wider would be a global operation asserting a local fact. */
+    it("GET /v1/request-log — a tenant's log holds its own rows, none of the victim's, and none of the platform's", async () => {
+      attacked.add("GET /v1/request-log");
+      const store = createAnalyticalStore();
+      const victimRequestId = randomUUID();
+      const tenantlessRequestId = randomUUID();
+      await store.query(
+        `INSERT INTO relay_analytics.api_requests
+           (environment_id, ts, request_id, endpoint, method, status, latency_ms, principal_kind, refused_at)
+         VALUES
+           (toUUID('${t.attacker.environmentId}'), now64(3), toUUID('${randomUUID()}'), '/v1/request-log', 'GET', 200, 1.5, 'application', 'handler'),
+           (toUUID('${t.victim.environmentId}'), now64(3), toUUID('${victimRequestId}'), '/v1/webhooks', 'GET', 200, 2.5, 'application', 'handler'),
+           (NULL, now64(3), toUUID('${tenantlessRequestId}'), '/healthz', 'GET', 200, 0.3, 'none', 'handler')`,
+      );
+      const verdict = await listAttack(
+        url,
+        t.attacker.credential,
+        { method: "GET", path: "/v1/request-log" },
+        [t.victim.environmentId, victimRequestId, tenantlessRequestId],
+      );
+      expect(verdict.status).toBe(200);
+      expect(verdict.leaked, `leaked: ${verdict.leaked.join(", ")}`).toEqual([]);
+      // AND ITS OWN ROW IS THERE. A listing that returned nothing at all would pass the
+      // leak check while being broken, which is the `list` shape's own trap — and here it
+      // is not hypothetical, because a log with no ingester behind it really is empty.
+      expect(verdict.count, "the attacker's own log came back empty").toBeGreaterThan(0);
+    });
+
+    it("POST /v1/webhooks — a create by one tenant cannot appear in another's list", async () => {
+      attacked.add("POST /v1/webhooks");
+      // NO IDENTIFIER TO FORGE on this route: the tenant comes from the key. So the
+      // pair is two legitimate creates and the assertion is about the VICTIM's state —
+      // this is the one webhook write whose attack is entirely the state read.
+      const body = (n: string) => ({
+        url: `https://attacker.example/${n}`,
+        event_types: ["message.created"],
+      });
+      const verdict = await writeAttack(
+        url,
+        t.attacker.credential,
+        { method: "POST", path: "/v1/webhooks", body: body("x") },
+        { method: "POST", path: "/v1/webhooks", body: body("y") },
+        victimEndpoints,
+      );
+      expect(verdict.foreign.status).toBe(201);
+      expect(verdict.stateChanged, "the victim's endpoints moved").toBe(false);
+    });
+
+    it.each(["rotate-secret", "enable", "disable", "test"])(
+      "POST /v1/webhooks/:id/%s — refused on a foreign endpoint, and nothing moves",
+      async (action) => {
+        attacked.add(`POST /v1/webhooks/:id/${action}`);
+        const verdict = await writeAttack(
+          url,
+          t.attacker.credential,
+          { method: "POST", path: `/v1/webhooks/${t.victim.endpointId}/${action}` },
+          { method: "POST", path: `/v1/webhooks/${ABSENT_UUID}/${action}` },
+          victimEndpoints,
+        );
+        expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+        expect(verdict.foreign.status).toBe(404);
+        // ROTATE IS THE ONE THAT WOULD HURT MOST. A successful rotation on somebody
+        // else's endpoint breaks every signature they verify, and the state read is
+        // what sees it: `secret_rotated_at` is on the row this returns.
+        //
+        // AND `test` IS THE ONE THAT REACHES OUTWARD. It makes the platform POST to the
+        // url on the row, so a successful attack on a foreign endpoint would have this
+        // tenant's request arriving at another customer's server — the only route in
+        // this list whose damage lands outside the platform.
+        expect(verdict.stateChanged, "the victim's endpoints moved").toBe(false);
+      },
+    );
+
+    it("DELETE /v1/webhooks/:id — a foreign endpoint is not deleted", async () => {
+      attacked.add("DELETE /v1/webhooks/:id");
+      const verdict = await writeAttack(
+        url,
+        t.attacker.credential,
+        { method: "DELETE", path: `/v1/webhooks/${t.victim.endpointId}` },
+        { method: "DELETE", path: `/v1/webhooks/${ABSENT_UUID}` },
+        victimEndpoints,
+      );
+      expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+      expect(verdict.foreign.status).toBe(404);
+      // DELETION IS SOFT, so the row survives either way and only the listing can
+      // tell: `listEndpoints` excludes soft-deleted rows, which is what makes this
+      // state read able to see a successful attack.
+      expect(verdict.stateChanged, "the victim's endpoints moved").toBe(false);
+    });
+  });
+
+  // ── the platform credential (this chapter) ─────────────────────────────────────
+  //
+  // A PLATFORM CREDENTIAL IS NOT TENANT-SCOPED AND IS NOT MEANT TO BE. One dispatcher
+  // serves every tenant, so its credential reaches every tenant's deliveries and a
+  // FOREIGN CREDENTIAL cannot be forged for it. What is attackable is the one route
+  // that names an environment alongside an identifier.
+  describe("the platform routes", () => {
+    const dispatcher = process.env["RELAY_INTERNAL_CREDENTIAL"];
+    // AND THE GATEWAY'S, WHICH IS A DIFFERENT SECRET SINCE FR-044. Both are `platform`
+    // and neither reaches the other's routes: the usage report is
+    // `@Accepts({ platform: ["gateway"] })` and dispatch is the dispatcher's.
+    //
+    // This suite presented the dispatcher's here and the positive control below caught
+    // it — `expected 403 to be 200` on the SETUP call, before any attack was made. A
+    // narrowing that goes unnoticed by the suite it narrows is a narrowing nobody has
+    // measured; this one announced itself on the first run.
+    const gateway = process.env["RELAY_INTERNAL_CREDENTIAL_GATEWAY"];
+
+    const expand = async (environmentId: string) =>
+      send(url, dispatcher ?? "", {
+        method: "POST",
+        path: "/internal/dispatch/expand",
+        body: {
+          event_id: randomUUID(),
+          environment_id: environmentId,
+          type: "message.created",
+          payload: { text: "expand names one environment" },
+        },
+      });
+
+    it("expand reaches only the endpoints of the environment it names", async () => {
+      attacked.add("POST /internal/dispatch/expand");
+      if (dispatcher === undefined) return; // not configured in this lane
+
+      const before = (await t.victim.repo.listEndpoints()).length;
+      const answer = await expand(t.attacker.environmentId);
+      expect(answer.status).toBe(200);
+      // THE POSITIVE CONTROL FIRST. The attacker's own endpoint subscribes to this
+      // type, so the call did something — without this the assertion below passes on
+      // a no-op, which is how this shape of test goes green while proving nothing.
+      expect((answer.body as { created?: number }).created ?? 0).toBeGreaterThan(0);
+      const rows = await t.victim.repo.listDeliveriesForEvent(
+        (answer.body as { event_id?: string }).event_id ?? randomUUID(),
+      );
+      expect(rows, "a delivery reached the victim's environment").toEqual([]);
+      expect((await t.victim.repo.listEndpoints()).length).toBe(before);
+    });
+
+    it("expand naming an environment that exists nowhere creates nothing", async () => {
+      if (dispatcher === undefined) return;
+      const answer = await expand(ABSENT_UUID);
+      expect(answer.status).toBe(200);
+      expect((answer.body as { created?: number }).created ?? -1).toBe(0);
+    });
+
+    // AND THE SECOND PLATFORM ROUTE THAT NAMES AN ENVIRONMENT ALONGSIDE AN IDENTIFIER.
+    //
+    // The derivation named it the moment this chapter added it, which is the whole
+    // reason the target list is derived and not typed: `POST /internal/usage/connections`
+    // arrived unclassified and three tests went red at once, in a file the chapter was
+    // not editing.
+    //
+    // `expand` was the only attackable platform route until now, and the argument
+    // transfers exactly. A usage report carries a connection id AND the environment to
+    // bill it to, so a caller can name one tenant while carrying an identifier from
+    // another — and the refusal has to come from the ROW, because the caller is the
+    // platform and is allowed to reach every tenant.
+    const period = periodOf(new Date());
+    const report = (connectionId: string, environmentId: string, minutes: number) =>
+      send(url, gateway ?? "", {
+        method: "POST",
+        path: "/internal/usage/connections",
+        body: {
+          connections: [
+            { connection_id: connectionId, environment_id: environmentId, period, minutes },
+          ],
+        },
+      });
+
+    it("a connection billed to one environment cannot be re-billed to another", async () => {
+      attacked.add("POST /internal/usage/connections");
+      if (gateway === undefined) return; // not configured in this lane
+
+      // THE POSITIVE CONTROL FIRST, and it is a legitimate call: the platform may
+      // report the victim's own connection. Without it the refusal below would also
+      // arrive from a route that credits nothing at all.
+      const connection = randomUUID();
+      expect((await report(connection, t.victim.environmentId, 3)).status).toBe(200);
+
+      const attackerBefore = (await usageFor(db, t.attacker.environmentId, period))
+        .connectionMinutes;
+      const victimBefore = (await usageFor(db, t.victim.environmentId, period))
+        .connectionMinutes;
+      // AND THE READER IS CHECKED BEFORE IT IS COMPARED. Both assertions at the foot
+      // of this test compare a number against itself, which is exactly the shape that
+      // passes when the reader returns nothing at all.
+      expect(victimBefore, "usageFor read no minutes for a connection just credited")
+        .toBeGreaterThanOrEqual(3);
+
+      const stolen = await report(connection, t.attacker.environmentId, 90);
+      expect(stolen.status).toBe(409);
+      expect((stolen.body as { code?: string }).code).toBe(
+        "connection_environment_conflict",
+      );
+
+      // BOTH SIDES, because only one of them is the obvious assertion. The attacker
+      // gained nothing — and the victim did not LOSE the minutes it already had, which
+      // a refusal that moved the row and then failed would still satisfy.
+      expect(
+        (await usageFor(db, t.attacker.environmentId, period)).connectionMinutes,
+        "the attacker was credited a connection it does not own",
+      ).toBe(attackerBefore);
+      expect(
+        (await usageFor(db, t.victim.environmentId, period)).connectionMinutes,
+        "the victim's minutes moved",
+      ).toBe(victimBefore);
     });
   });
 
   // ── and the suite accounts for itself ───────────────────────────────────────────
   it("ran an attack for every route the classification says to attack", () => {
     const shouldAttack = CLASSIFICATIONS.filter((c) => c.shape !== "exempt").map(targetKey);
```

## The teardown, and the process that holds the port

`stop()` signalled its children and slept 200 ms. A child that took longer to close its
listeners was still holding its port when the next suite booted, so that suite's health check
passed against the dying predecessor and then failed at its first real request with
`ECONNREFUSED`. **Ten of the attachments chapter's twenty-run battery failed exactly that
way** — and the debt was not settled when a run ended, it was paid by whatever booted next.
It waits for them now, with a measured one-second grace before `SIGKILL`: the api takes
5,035 ms to drain and its listener stays open for all of it, so waiting for a clean exit cost
the e2e package 37.28 s against a 6.72 s baseline. This harness needs the port, not the
drain.

**AND THE ASSERTION THAT PROVES IT HAD A BLIND SPOT OF ITS OWN.** The test probes the first
system's api port after `stop()` returns, which is the right probe for the api: it is one
`spawn("node", …)` and the signal reaches the server. The gateway was
`spawn("pnpm", ["exec", "tsx", …])` — four processes deep. SIGTERM reached `pnpm`, `pnpm`
exited without passing it on, `child.once("exit")` resolved on `pnpm`'s exit, and the gateway
kept running with its port held. **Twelve survivors per lane run, indefinitely, under a green
test.**

Measured rather than reasoned about: clear every stray, run the lane, count what is left.
Twelve before, zero after, and the run got faster — 13 s for four files. The gateway is
spawned the way the api is now, from `dist/main.js`, which the lane already builds because
`test:integration` dependsOn `build`.

**A red probe proves the teardown for the process you spawned.** Only a probe of the service
that leaks proves it for the process that holds the port — and a package-manager wrapper is
not the thing you are trying to kill.

**No chapter owns this.** The harness belongs to chapter 2.8 and its teardown is not any Part
3 chapter's subject; the fix is here because the thing it repairs is lane hygiene, not a
chapter's argument.

```diff title="packages/e2e/src/harness.ts"
@@ -465,13 +465,26 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
   const urls: string[] = [];
   for (let i = 0; i < gateways; i++) {
     const name = `gateway ${i + 1}`;
     children.push(
       capture(
         name,
-        spawn("pnpm", ["exec", "tsx", "src/main.ts"], {
+        // `node dist/main.js`, THE SAME WAY THE API IS SPAWNED, AND THE REASON IS THE
+        // TEARDOWN. This was `pnpm exec tsx src/main.ts`, which is four processes: pnpm,
+        // its own launcher, tsx, and the node worker that binds the port. `stop()` holds
+        // the FIRST of those. SIGTERM reached pnpm, pnpm exited without passing it on,
+        // `child.once("exit")` resolved on pnpm's exit, and the gateway kept running with
+        // its port held — twelve survivors per lane run, indefinitely.
+        //
+        // AND THE TEARDOWN TEST WAS GREEN THROUGHOUT, because it probes the API's port.
+        // The api is one `spawn("node", …)` and always died correctly. A red probe proves
+        // the teardown for the process you spawned; only a probe of the LEAKING service
+        // proves it for the process that holds the port. `dist/main.js` exists here for
+        // the same reason it does for the api — `test:integration` dependsOn `build` —
+        // so this costs nothing and removes three processes from the chain.
+        spawn("node", [join(REPO, "services", "gateway", "dist", "main.js")], {
           cwd: join(REPO, "services", "gateway"),
           env: { ...env, PORT: "0", RELAY_API_URL: apiUrl },
           stdio: ["ignore", "pipe", "pipe"],
         }),
       ),
     );
@@ -570,11 +583,51 @@ export async function boot({ gateways = 2 } = {}): Promise<System> {
       );
     },
     async client(name, environmentId) {
       return new Client(name, await token(environmentId, name), say);
     },
     async stop() {
+      // WAIT FOR THEM TO GO, DO NOT SLEEP AND HOPE (feature 043, FR-001).
+      //
+      // This signalled and slept 200 ms. A child that took longer to close its
+      // listeners was still holding its port when the next suite booted — and the
+      // next suite's health check passed against the dying predecessor, printed
+      // `api up on …`, and then failed at its first real request with
+      // `ECONNREFUSED`. **Ten of the attachments chapter's twenty-run battery failed exactly
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

## Two imports the tenancy chapter's fence cannot carry

`signup.itest.ts`'s invariant 7 stopped counting the whole `organisations` table and started
reading the source instead — which needs `node:fs` and `node:path`. The assertion itself is
taught where it lives, in the keys-and-tokens chapter's diff. **The two import lines are not**,
and the reason is structural rather than an oversight: this file arrives before Part 3 begins,
so the tenancy chapter fences it as a WHOLE @@ -1,10 +1,12 @@
 import "reflect-metadata";
 
+import { readFileSync, readdirSync } from "node:fs";
 import { createServer } from "node:http";
 import type { AddressInfo } from "node:net";
+import { join } from "node:path";
 
 import { Test } from "@nestjs/testing";
 import type { INestApplication } from "@nestjs/common";
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 
 import { AppModule } from "../app.module";, and a whole-body fence is the chain's
foundation — every later diff in every later chapter is anchored on it.

**REGENERATING IT WAS TRIED AND MEASURED.** Bringing that fence up to date satisfies the
per-chapter check and takes the cumulative chain from **111 problems to 203**, because
ninety-two hunks downstream are anchored on the bytes it replaced. The per-chapter checker and
the chain disagree here, and the chain is the one carrying the readers: a foundation fence is
not a thing to regenerate for two lines.

So the two lines arrive here, after every chapter, the way any change no chapter owns does.

```diff title="services/api/src/tenancy/signup.itest.ts"
@@ -1,10 +1,12 @@
 import "reflect-metadata";
 
+import { readFileSync, readdirSync } from "node:fs";
 import { createServer } from "node:http";
 import type { AddressInfo } from "node:net";
+import { join } from "node:path";
 
 import { Test } from "@nestjs/testing";
 import type { INestApplication } from "@nestjs/common";
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 
 import { AppModule } from "../app.module";
```

## The generator that was retired twice

`drizzle-kit` generated the migration SQL from `schema.ts` and kept snapshots under
`migrations/meta/`. **That arrangement contradicted ADR-16 from the day it started** — *"migrations
remain versioned, forward-only, hand-reviewed SQL"*, which a generator's output is not — and by the
time anyone looked the snapshots had drifted **seven behind** the directory, so the generator could
no longer have produced a correct diff even if somebody ran it. Feature 043 deleted the config, the
nine snapshots and the dependency, and added `migrations.test.ts` to assert it stays gone.

**IT HAD TO BE RETIRED TWICE BECAUSE A DEFERRAL WAS RECORDED AND NEVER EXECUTED.** The rework's
carry log filed this as "absent, appendix material, no chapter teaches it" — correct about
chapters, and the appendix is exactly where such work goes, so the note was right and the move was
never made. A chapter's fence had already retired `drizzle.config.ts` while the tree still carried
it; the chain said so on every run and the line read as one of the backlog. **A deferral that names
its destination is not the same as arriving there.**

The two comments below are the rest of it: both described a generator that no longer exists.

```diff title="services/api/src/db/migrate.ts"
@@ -5,15 +5,21 @@ import type pg from "pg";
 
 import { createPool } from "./client";
 
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
 
 export async function migrate(pool: pg.Pool): Promise<string[]> {
   await pool.query(
     `CREATE TABLE IF NOT EXISTS schema_migrations (
```

```diff title="services/api/src/db/schema.ts"
@@ -16,15 +16,17 @@ import {
   uniqueIndex,
   uuid,
 } from "drizzle-orm/pg-core";
 
 // The TS twin of SAD §6.1 (ADR-16). The schema now exists twice — once as
 // the SAD's SQL truth, once here — and that drift risk is checked, not
-// assumed away: drizzle-kit GENERATES the migration SQL from these
-// definitions, and the generated SQL is reviewed against §6.1 before the
-// runner applies it. The four tenant-bearing tables reproduce §6.1
+// assumed away: the migration SQL under migrations/ is hand-written from these
+// definitions and reviewed against SAD §6.1 before the runner applies it.
+// Feature 043 retired the generator that used to produce it — the sentence here
+// described "the generated SQL" for one more feature than the generator lasted,
+// which is what a comment does when a change edits around it instead of through it. The four tenant-bearing tables reproduce §6.1
 // column-for-column, constraints and DR citations included. Deliberately
 // absent, with named arrivals: emoji/media tables (their parts), messages
 // partitioning (SAD growth note -> retention chapter). The outbox arrives with the
 // chapter of that name and is at the bottom of this file. `message_edits` ARRIVES WITH
 // THE REVISIONS CHAPTER and is below `messages` — the list above said "edit chapter"
 // and this is it.
```

<Why>
**Why the second one reads oddly.** 043 edited AROUND this sentence rather than through it, leaving
"definitions" twice and a tail still reviewing "the generated SQL". It shipped that way and stayed
for two more features. Repaired here, and said out loud, because **a comment a change edits around
outlives the thing it describes** — which is the whole reason this file needed a test rather than a
note.
</Why>
