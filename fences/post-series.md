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

**And `test:integration` points at a script rather than at turbo, which chapter 4.9
explains and cannot publish.** The flags it used to carry —
`--concurrency=1 --filter=!@relay/outsider` — live inside
`scripts/integration-gate.mjs` now, beside `--continue` and the suite count the gate
reports. **This line is published here and nowhere else in the series**, and the
appendix applies after every chapter, so a chapter hunk for it would be anchored on a
pre-appendix state and then silently overwritten. A file can be free on the HEAD half
of the fence checker and expensive on the APPLY half; this is the APPLY half.

```diff title="package.json"
@@ -9,23 +9,27 @@
   "scripts": {
     "dev": "turbo run dev",
     "lint": "turbo run //#lint:root",
     "lint:root": "eslint .",
     "typecheck": "turbo run typecheck",
     "test": "turbo run test",
-    "test:integration": "turbo run test:integration --concurrency=1",
+    "test:integration": "node scripts/integration-gate.mjs",
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
@@ -14,12 +14,13 @@
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
@@ -404,32 +405,47 @@
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
@@ -616,7 +632,68 @@
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
@@ -273,13 +273,15 @@
   { ignores: ["**/node_modules/**", "**/dist/**", "**/coverage/**"] },
   eslint.configs.recommended,
   ...tseslint.configs.recommended,
   {
     // Dev scripts run on Node directly, outside any package's tsconfig —
     // so the globals have to be declared rather than inferred (chapter 2.5).
-    files: ["scripts/**/*.mjs"],
+    // `analytics/` is the same situation one directory over: chapter 4.2's schema runner
+    // talks to ClickHouse through Node's own `fetch` and runs outside every tsconfig.
+    files: ["scripts/**/*.mjs", "analytics/**/*.mjs"],
     languageOptions: { globals: globals.nodeBuiltin },
   },
   {
     // Isolation lives in data access, not in handlers (constitution I):
     // only the repository layer may touch the driver.
     //
@@ -346,7 +348,104 @@
     // on purpose; they are excused from nothing else.
     files: DRAIN_EXEMPT_TESTS,
     rules: {
       "no-restricted-imports": ["error", DRIVER_AND_ENGINE],
     },
   },
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
+            {
+              group: ["@relay/*"],
+              message:
+                "packages/outsider integrates from published documentation alone. It may not import workspace code — see the three levels in eslint.config.mjs.",
+            },
+            {
+              // NOT `/*` as a third entry here: minimatch matched `vitest/config` with
+              // it, and a rule that refuses the test runner is a rule somebody turns
+              // off. Absolute paths are covered by the syntax selector below, which
+              // matches on the specifier itself.
+              group: ["../*", "../../*"],
+              message:
+                "packages/outsider may not reach outside itself. A relative path out of the package is the same import by another spelling.",
+            },
+          ],
+        },
+      ],
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

```diff title="vitest.coverage.config.mts"
@@ -21,12 +21,37 @@
   test: {
     // Feature 030: the global-operation guard. `globalSetup` migrates and
     // then installs the trigger once per lane; `setupFiles` sets the
     // exemption for files on the harness's list and, where the lane carries
     // bait, plants it per file. This lane gets exemption
     // handling and NO bait: it holds no reader-shape fault, and planting
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
+    // Feature 030: the global-operation guard. `globalSetup` migrates and
+    // then installs the trigger once per lane; `setupFiles` sets the
+    // exemption for files on the harness's list and, where the lane carries
+    // bait, plants it per file. This lane gets exemption
+    // handling and NO bait: it holds no reader-shape fault, and planting
     // would change its workload for no return (FR-022).
     globalSetup: ["./packages/test-harness/src/global-setup.ts"],
     // FEATURE 030, MEASURED: nine suites in this lane import `AppModule`, and none
     // of them set a relay flag. Each relay defaults to on when its flag is unset
     // (`process.env.RELAY_OUTBOX_RELAY ?? "on"`), so those nine booted four
     // background loops that sweep the whole database while every other suite's
@@ -72,12 +97,16 @@
         "packages/e2e/**",
         // Entry points and framework wiring: reached by running the service,
         // not by asserting on it. Counting them measures how much of `main.ts`
         // a test happened to touch, which is not what "business logic" means.
         "**/main.ts",
         "**/*.module.ts",
+        // The lane's own scaffolding (feature 030). Same argument one step out:
+        // counting how much of the harness a test touched measures the harness,
+        // not the product.
+        "packages/test-harness/src/**",
         // THE LANE'S OWN INFRASTRUCTURE IS NOT BUSINESS LOGIC. `include` is
         // `packages/*/src/**`, so the harness arrived inside the measurement the
         // moment it became a package. Its files run on every integration suite and
         // would score near the top, raising the workspace figure while saying
         // nothing about the product — the same dilution `**/*.module.ts` is
         // excluded for.
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
@@ -47,15 +47,28 @@
         "RELAY_DELIVERY_RELAY",
         "RELAY_INTERNAL_CREDENTIAL",
         "RELAY_INTERNAL_CREDENTIAL_GATEWAY",
         "RELAY_METER_INTERVAL_MS",
         "RELAY_AUTH_FAILURES_PER_MINUTE",
         "RELAY_AUTH_KEY_PREFIX",
+        "RELAY_INTERNAL_CREDENTIAL_GATEWAY",
+        "RELAY_METER_INTERVAL_MS",
+        "RELAY_AUTH_FAILURES_PER_MINUTE",
+        "RELAY_AUTH_KEY_PREFIX",
         "RELAY_WEBHOOK_SECRET_KEY",
         "RELAY_EVENT_CONSUMER",
         "RELAY_NATS_REPLICAS",
+        "RELAY_E2E_API_PORT",
+        "RELAY_SMTP_URL",
+        "RELAY_MAILPIT_URL",
+        "RELAY_NOTIFICATION_RELAY",
+        "RELAY_QUOTA_RELAY",
+        "RELAY_DOCS_BASE_URL",
+        "RELAY_API_URL",
+        "RELAY_WS_URL",
+        "RELAY_DEMO_CREDENTIAL",
         "RELAY_QUOTA_RELAY"
       ]
     },
     "//#lint:root": {
       "inputs": [
         "**/*.{ts,mts,cts,mjs,js}",
```

```diff title="vitest.coverage.config.mts"
@@ -39,12 +39,14 @@
     // a property of the lane rather than a convention nobody applied.
     env: {
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
+      // The quota chapter's relay, the fourth. Same reason as the other three.
+      RELAY_QUOTA_RELAY: "off",
     },
     setupFiles: ["./packages/test-harness/src/setup.ts"],
     // Feature 030: the global-operation guard. `globalSetup` migrates and
     // then installs the trigger once per lane; `setupFiles` sets the
     // exemption for files on the harness's list and, where the lane carries
     // bait, plants it per file. This lane gets exemption
```

```diff title="packages/e2e/src/harness.ts"
@@ -406,19 +406,35 @@
       // prefix. Forwarded for the reason this list exists at all — turbo runs
       // tasks in STRICT env mode, so an undeclared variable reaches a child as
       // `undefined` and the `??` behind it silently wins. A suite that raised the
       // threshold would raise it in the parent and not in the api the child runs.
       "RELAY_AUTH_FAILURES_PER_MINUTE",
       "RELAY_AUTH_KEY_PREFIX",
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
@@ -583,12 +583,52 @@
         "services/api/src/quotas/quota-relay.ts": {
           branches: 100,
           functions: 100,
           lines: 96,
           statements: 96,
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
   plugins: [
     swc.vite({
       module: { type: "es6" },
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
@@ -79,13 +79,29 @@
       "packages/*/src/**/*.itest.ts",
       "services/*/src/**/*.itest.ts",
     ],
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
     // not design for — the outbox chapter's suite learned that the hard way.
     fileParallelism: false,
     testTimeout: 60_000,
     hookTimeout: 60_000,
     coverage: {
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
@@ -309,12 +309,48 @@
         // `analytics.ts` is here for a different reason: everything it does is
         // decide what NOT to put on a stream. Its allow-list is the mechanism
         // standing between a customer's payload and seven days of retention
         // (FR-004, SC-006), and its `catch` is what stops an analytics outage
         // becoming a delivery outage (contract invariant 4). Both are branches, and
         // an unmeasured branch here fails silently in the direction nobody checks.
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
           lines: 100,
           statements: 100,
         },
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
@@ -91,13 +91,15 @@
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
@@ -174,29 +176,51 @@
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
       /** THIS ENVIRONMENT'S ROWS, NOT THE TABLE'S.
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


---

## The platform credentials, in the lane that measures coverage (chapter 4.9)

Chapter 4.9 configures `RELAY_INTERNAL_CREDENTIAL` and `RELAY_INTERNAL_CREDENTIAL_GATEWAY` in
`services/api/vitest.integration.config.mts`, and publishes that hunk itself. **The coverage lane
needs the same two variables and this appendix cannot publish them**, which is worth stating
rather than leaving as an absence.

`vitest.coverage.config.mts` has diverged from the chain since before Part 4 (`gaps.md` 048-3).
The divergence is not cosmetic: **the chain's state for this file has no `env` block at all**,
because the appendix hunk that would add it is itself one of the fourteen that no longer apply.
So there is no anchor for a hunk adding two lines to that block, and a hunk that recreated the
block would be a whole-file rewrite — the 111-to-203 trap feature 045 measured.

The edit is in the repository and is described here in words:
`RELAY_INTERNAL_CREDENTIAL: "rk_svc_local_development_credential_0000"` and
`RELAY_INTERNAL_CREDENTIAL_GATEWAY: "rk_svc_local_development_gateway_00000"` join the four relay
flags in that config's `env` block, for the reason chapter 4.9 gives about the other config: without
them `pnpm coverage` fails `limits.itest.ts` and silently skips three cross-tenant attacks, in the
run that measures constitution VI's own coverage bar.

---

## The chain, reconciled (feature 055)

Feature 055 repaired the fence chain from 110 problems to zero. Forty-two hunks were
re-anchored on the state the checker replays and eight files were published whole at the
chapter that first amends them — and what is left is **accumulated drift**: every line by
which the repaired chain still differs from `relay-platform`, in files no chapter is about.

**Twenty-nine files, 3,471 lines.** They are here rather than in a chapter for the reason this
whole file exists: a chapter that showed them would be showing a reader code it never
discusses. Each hunk below is generated from the checker's own replay (`check:fences --dump`),
not from a `git diff` against the working tree, which is the distinction that makes them apply
at all.

**Ten of the twenty-nine were invisible before this feature.** A checker reports the first
failure per file, so a file with a broken hunk never had its end state compared —
`session.itest.ts`, `turbo.json` and `packages/e2e/src/harness.ts` among them. Repairing the
hunks is what let the chain say how far behind it was.

### `services/gateway/src/session.itest.ts` — the gateway's session suite. Six chapters amend it and two more are declared excerpts (055/T056); everything after 3.9 arrives here.

1322 differing lines, 7 hunks.

```diff title="services/gateway/src/session.itest.ts"
@@ -5,18 +5,21 @@
 import { dirname, join } from "node:path";
 import type { Server } from "node:http";
 import type { AddressInfo } from "node:net";
 import { fileURLToPath } from "node:url";
 
 import { createLogger, serve, type Logger } from "@relay/service-kit";
+import { docsUrl, frameSchema } from "@relay/protocol";
 import { WebSocket } from "ws";
 import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
 
 import { createApiClient } from "./api-client.js";
+import { createFanout, type Fanout } from "./fanout.js";
+import { createMembership, type Membership } from "./membership.js";
+import { createConnections, type Connections } from "./connections.js";
 import { attachSessions } from "./session.js";
-import { docsUrl } from "@relay/protocol";
 
 // The socket's credential cases, against a REAL api.
 //
 // The unit suite stubs the api, which is right for the ordering and framing
 // questions it asks — but it cannot prove the thing this chapter changed: that
 // a token the api minted opens a socket, that an API key does not, and that the
@@ -68,24 +71,47 @@
     createChannel: (
       externalId: string,
       type: string,
       name?: string,
     ) => Promise<{ id: string }>;
     addMember: (channelId: string, userId: string) => Promise<boolean>;
+    /** An application credential may send only as a bot user
+     * So a REST send needs one to exist — and `createUser`
+     * makes a person. Widening this type rather than reaching around it: the
+     * shape here is a hand-written mirror of the real repository, and a member
+     * it does not name is a member this suite cannot call. */
+    upsertUser: (
+      externalId: string,
+      profile: {
+        display_name?: string;
+        kind?: "person" | "bot";
+        description?: string;
+      },
+    ) => Promise<unknown>;
   };
 }
 
-async function waitForHealth(url: string): Promise<void> {
+async function waitForHealth(url: string, why?: () => string): Promise<void> {
   const deadline = Date.now() + 30_000;
   for (;;) {
     try {
       if ((await fetch(url)).ok) return;
     } catch {
       // not up yet
     }
-    if (Date.now() > deadline) throw new Error(`api never became healthy`);
+    if (Date.now() > deadline) {
+      // **The child has already said why and nobody was
+      // listening.** This file spawns with `stdio: ["ignore", "pipe", "pipe"]`
+      // and never read either pipe, so an api that died took its reason with it —
+      // which is the entire reason the membership-revocation chapter's `gaps.md` item 19a has four
+      // occurrences and three eliminated hypotheses rather than a cause. The
+      // buffer is drained below and its tail is attached here.
+      throw new Error(
+        `api never became healthy${why === undefined ? "" : `\n--- child output ---\n${why()}`}`,
+      );
+    }
     await new Promise((resolve) => setTimeout(resolve, 100));
   }
 }
 
 async function startApi(): Promise<ApiUnderTest> {
   const dist = join(REPO, "services", "api", "dist");
@@ -104,14 +130,35 @@
 
   const environment = await seeder.createEnvironment(db, {
     name: `session-itest-${randomUUID().slice(0, 8)}`,
   });
   const repo = new seeder.Repository(db, environment.id);
   const user = await repo.createUser("tuan", "Tuan");
+  // The sender a REST send names. ADDITIVE to this fixture — the
+  // tests above assert on "tuan" and a second user changes nothing for them,
+  // which is the difference between adding a capability and repurposing one.
+  await repo.upsertUser("delivery-bot", {
+    display_name: "Delivery Bot",
+    kind: "bot",
+    description: "sends over REST so a socket can receive it",
+  });
+  // Two PEOPLE in the channel, because FR-005's property is "every
+  // connected member" and one socket cannot show it. ADDITIVE, on the fan-out chapter's
+  // precedent recorded just above — the tests that assert on "tuan" are unaffected by
+  // two more members of a public channel, and T033 is the only test that names these.
+  //
+  // BOTH ARE MEMBERS, and that is what the first run of T033 got wrong: `mintToken`
+  // mints a token for any identifier, so two sockets opened fine and neither was
+  // delivered to. The failure read "no the creation; saw connection.ack" — a
+  // membership problem wearing a delivery problem's message.
+  const editor = await repo.createUser("editor", "The Editor");
+  const watcher = await repo.createUser("watcher", "The Watcher");
   const channel = await repo.createChannel("fleet", "public");
   await repo.addMember(channel.id, user.id);
+  await repo.addMember(channel.id, editor.id);
+  await repo.addMember(channel.id, watcher.id);
   const key = await seeder.createApiKey(db, {
     environmentId: environment.id,
   });
 
   // PORT=0, AND THE PORT READ BACK FROM THE CHILD. This bound a fixed 4123 behind an
   // environment variable nothing set — so every run took the same port, and a
@@ -119,15 +166,44 @@
   // environment. Every token this run minted is then refused by an api that has never
   // heard of it, which reads as a credential fault and is a busy port.
   const child: ChildProcess = spawn("node", [join(dist, "main.js")], {
     // No outbox relay in this child. This suite is about the socket's credentials; a
     // background loop draining a table the outbox chapter's suite is asserting on
     // turns two unrelated test files into a race.
-    env: { ...process.env, PORT: "0", RELAY_OUTBOX_RELAY: "off" },
+    env: {
+      ...process.env,
+      PORT: "0",
+      RELAY_OUTBOX_RELAY: "off",
+      // Nor the notification relay, for the same reason.
+      RELAY_NOTIFICATION_RELAY: "off",
+      // And its own failed-authentication keyspace. The auth limiter counts
+      // failures per SOURCE ADDRESS in Redis, every suite in this lane is
+      // 127.0.0.1, and vitest runs the files in parallel — so ten failures a
+      // minute across ALL of them turns a neighbour's expected 401 into a 429.
+      //
+      // NOT what the port fix was about, and published held this as its first
+      // theory long enough to write it down before the evidence arrived. Kept
+      // because the coupling is real and the isolation costs one line, and said
+      // plainly rather than taking credit for a fault it did not fix.
+      RELAY_AUTH_KEY_PREFIX: `rlauth-session-${randomUUID().slice(0, 8)}`,
+    },
     stdio: ["ignore", "pipe", "pipe"],
   });
+  // DRAINED, AND KEPT. Two reasons, and the second is why this exists at all: an
+  // undrained pipe eventually fills, and an unread pipe throws the evidence away when
+  // the child dies. The port reader below listens on `stdout` for one line; this keeps
+  // BOTH streams and hands their tail to `waitForHealth`.
+  const output: string[] = [];
+  const keep = (chunk: unknown): void => {
+    output.push(String(chunk));
+    // A ring, so a long-lived child cannot turn diagnosis into a memory leak.
+    if (output.length > 200) output.splice(0, output.length - 200);
+  };
+  child.stdout?.on("data", keep);
+  child.stderr?.on("data", keep);
+
   const port = await new Promise<number>((resolve, reject) => {
     const timer = setTimeout(() => reject(new Error("api never reported a port")), 30_000);
     let buffered = "";
     child.stdout?.on("data", (chunk: Buffer) => {
       buffered += chunk.toString();
       for (const line of buffered.split("\n")) {
@@ -141,19 +217,25 @@
           }
         } catch {
           /* a partial line; the next chunk completes it */
         }
       }
     });
-    child.on("exit", (code) => {
+    child.on("exit", (code, signal) => {
+      keep(`\n[child exited code=${String(code)} signal=${String(signal)}]\n`);
       clearTimeout(timer);
-      reject(new Error(`api exited before listening (code ${String(code)})`));
+      reject(
+        new Error(
+          `api exited before listening (code ${String(code)})` +
+            `\n--- child output ---\n${output.join("")}`,
+        ),
+      );
     });
   });
   const url = `http://127.0.0.1:${port}`;
-  await waitForHealth(`${url}/healthz`);
+  await waitForHealth(`${url}/healthz`, () => output.join(""));
 
   return {
     url,
     environmentId: environment.id,
     credential: key.credential,
     channelId: channel.id,
@@ -288,12 +370,170 @@
     expect(refusal.payload.message).toMatch(/expired/);
     expect(refusal.payload.message).toMatch(/reconnect/);
     // Still open after the refusal: refusing a write is not closing a socket.
     expect(socket.readyState).toBe(WebSocket.OPEN);
   }, 20_000);
 
+  // T022c and T020a. THE SOCKET DOOR, WHICH IS THE ONE THAT DROPS THINGS.
+  //
+  // Every other send test in this chapter walks the REST door, and the REST door was never
+  // at risk: it validates with `sendMessageBodySchema` and hands a typed body straight to
+  // the service. The socket path has three named points where a field can vanish without
+  // an error — `session.ts`'s inbound destructure, `internal.controller.ts`'s named build,
+  // and `session.ts`'s outbound payload — and a message that commits without its
+  // attachments is acked as though it worked.
+  it("refuses eleven at the GATEWAY, naming the field (FR-005)", async () => {
+    // NAME THE LAYER AND THE CODE. The bound is on `messageSendSchema`, so the gateway
+    // refuses the frame before the api sees it and the client gets `invalid_frame` —
+    // not the api's `invalid_request`. Two doors, two refusals, one bound, and a test
+    // asserting only "it was refused" could not tell a working bound from a socket that
+    // dropped the field entirely.
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "eleven over the socket",
+          attachments: Array.from({ length: 11 }, (_, i) => ({
+            type: "url",
+            kind: "image",
+            url: `https://example.test/${i}.png`,
+          })),
+        },
+      }),
+    );
+    const refusal = (await firstFrame(socket, "error")) as {
+      payload: { code: string; field?: string };
+    };
+    expect(refusal.payload.code).toBe("invalid_frame");
+    // T041a: the frame contract has published `field` since chapter 1.3 and the gateway
+    // had never set it. The joined path is what a developer reading their own frame sees.
+    expect(refusal.payload.field).toBe("payload.attachments");
+  }, 20_000);
+
+  it("refuses a media_id and SAYS hosted media is unavailable (FR-003a)", async () => {
+    // THE MESSAGE, BECAUSE THE CODE IS THE SAME ONE EVERY MALFORMED FRAME GETS. A one-arm
+    // union would also refuse this — with "Invalid discriminator value. Expected 'url'",
+    // which is the sentence FR-003a forbids by name. This assertion is the only thing
+    // that can tell the two-arm schema from a one-arm one on this door.
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "hosted media over the socket",
+          attachments: [{ type: "media", media_id: "m_1" }],
+        },
+      }),
+    );
+    const refusal = (await firstFrame(socket, "error")) as {
+      payload: { code: string; message: string };
+    };
+    // `invalid_frame` AND NOT `media_not_available`: `sendError` fixes its code at the
+    // call site, so the REST door answers with the code and the socket answers with the
+    // sentence. T039 records that split.
+    expect(refusal.payload.code).toBe("invalid_frame");
+    expect(refusal.payload.message).toMatch(/hosted media is not available/i);
+  }, 20_000);
+
+  it("commits TWO attachments sent over the socket, in order (FR-001, FR-006)", async () => {
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "two over the socket",
+          // TWO, IN A DELIBERATE ORDER. One cannot show an order, and the ordered pair is
+          // what makes §4.14's later arm safe to add.
+          attachments: [
+            { type: "url", kind: "image", url: "https://example.test/socket-first.png" },
+            { type: "url", kind: "video", url: "https://example.test/socket-second.mp4" },
+          ],
+        },
+      }),
+    );
+    const ack = (await firstFrame(socket, "message.ack")) as { payload: { seq: number } };
+    expect(ack.payload.seq).toBeGreaterThan(0);
+
+    // THROUGH THE COLUMN, NOT HISTORY, AND THAT IS A PHASE ORDERING FACT. The ack carries
+    // a sequence and nothing else — it has never carried a message and this chapter does
+    // not widen it — so an ack alone cannot tell a stored attachment from a dropped one.
+    // History would be the natural reader, and `listMessages` does not select the column
+    // until phase 5 (T028), so asserting there would fail for the next phase's reason.
+    // Phase 5's T030 is where this claim moves to the wire.
+    const client = require_(
+      join(REPO, "services", "api", "dist", "db", "client.js"),
+    ) as {
+      createPool: () => {
+        query: (q: string, v: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
+        end: () => Promise<void>;
+      };
+    };
+    const pool = client.createPool();
+    const { rows } = await pool.query(
+      "SELECT attachments FROM messages WHERE sequence = $1 AND channel_id = $2",
+      [ack.payload.seq, api.channelId],
+    );
+    await pool.end();
+    expect(
+      (rows[0]!["attachments"] as Array<{ url: string }>).map((a) => a.url),
+    ).toEqual([
+      "https://example.test/socket-first.png",
+      "https://example.test/socket-second.mp4",
+    ]);
+  }, 20_000);
+
+  it("accepts an attachments-only message and refuses one with neither (FR-019, FR-019b)", async () => {
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+
+    // BOTH HALVES. The acceptance passes the moment the text bound is relaxed; the refusal
+    // needs a rule that relaxation removes, and `refineTextAndAttachments` is the only
+    // thing putting it back on this door.
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "",
+          attachments: [
+            { type: "url", kind: "image", url: "https://example.test/no-caption.png" },
+          ],
+        },
+      }),
+    );
+    const ack = (await firstFrame(socket, "message.ack")) as { payload: { seq: number } };
+    expect(ack.payload.seq).toBeGreaterThan(0);
+
+    const bare = connect(await mintToken("tuan", 3600));
+    await firstFrame(bare, "connection.ack");
+    bare.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: { idem_key: randomUUID(), channel: api.channelId, text: "", attachments: [] },
+      }),
+    );
+    const refusal = (await firstFrame(bare, "error")) as {
+      payload: { code: string; message: string };
+    };
+    // `invalid_frame`, NOT `invalid_request`. The bound is on `messageSendSchema`, so the
+    // GATEWAY refuses the frame before the api sees it — two doors, two codes, one rule,
+    // and a test asserting only "it was refused" could not tell which layer answered.
+    expect(refusal.payload.code).toBe("invalid_frame");
+  }, 20_000);
+
   it("a reconnect with a fresh token can send again", async () => {
     // The recovery path the refusal above names, proven rather than asserted.
     const socket = connect(await mintToken("tuan", 3600));
     await firstFrame(socket, "connection.ack");
     socket.send(
       JSON.stringify({
@@ -313,6 +553,1074 @@
 
   afterAll(async () => {
     api?.stop();
     server?.close();
   });
 });
+
+describe("the socket's delivery, with a fan-out attached", () => {
+  let api: ApiUnderTest;
+  let server: Server;
+  let url: string;
+  let fanout: Fanout;
+  /** A SECOND client on the same subject, standing in for whoever published —
+   * the api, in this chapter, and any other gateway instance before it. The
+   * subscriber under test must not be the publisher, or the test proves only
+   * that an object can call itself. */
+  let publisher: Fanout;
+  /** **Its dependency injection is three hundred lines above the test
+   * that needs it**, and without this line the inversion below simply fails: this
+   * describe injected no `presence`, no `limits` and no `membership`, so the gateway
+   * under it never learned of a removal. */
+  let membership: Membership;
+  const sockets: WebSocket[] = [];
+
+  const mintToken = async (user = "tuan") => {
+    const res = await fetch(`${api.url}/auth/dev-token`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({ user, ttl_seconds: 3600 }),
+    });
+    if (!res.ok) throw new Error(`dev-token: ${res.status}`);
+    return ((await res.json()) as { token: string }).token;
+  };
+
+  const connect = (token: string) => {
+    const socket = new WebSocket(`${url}/v1/ws?token=${token}`);
+    sockets.push(socket);
+    return socket;
+  };
+
+  /** Every frame a socket sees, in order. Attached before `open` resolves,
+   * because `connection.ack` arrives the instant the upgrade completes and a
+   * listener added after a yield to the event loop misses it. */
+  const record = (socket: WebSocket): { type: string; payload?: unknown }[] => {
+    const frames: { type: string; payload?: unknown }[] = [];
+    socket.on("message", (raw) => {
+      frames.push(JSON.parse(String(raw)) as { type: string });
+    });
+    return frames;
+  };
+
+  const waitFor = async (
+    frames: { type: string; payload?: unknown }[],
+    predicate: (f: { type: string; payload?: unknown }) => boolean,
+    what: string,
+    ms = 4_000,
+  ) => {
+    const deadline = Date.now() + ms;
+    for (;;) {
+      const found = frames.find(predicate);
+      if (found) return found;
+      if (Date.now() > deadline) {
+        throw new Error(
+          `no ${what}; saw ${frames.map((f) => f.type).join(", ") || "nothing"}`,
+        );
+      }
+      await new Promise((r) => setTimeout(r, 25));
+    }
+  };
+
+  beforeAll(async () => {
+    api = await startApi();
+    fanout = createFanout({ logger: silent });
+    publisher = createFanout({ logger: silent });
+    server = serve({
+      service: "gateway",
+      health: () => ({}),
+      logger: silent,
+      notFoundDocsUrl: docsUrl("not_found"),
+    });
+    membership = createMembership({ logger: silent });
+    attachSessions({
+      server,
+      api: createApiClient(api.url),
+      logger: silent,
+      fanout,
+      membership,
+    });
+    await new Promise<void>((resolve) => server.listen(0, resolve));
+    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
+  }, 60_000);
+
+  afterEach(() => {
+    for (const socket of sockets.splice(0)) socket.close();
+  });
+
+  afterAll(async () => {
+    await fanout.close();
+    await publisher.close();
+    await membership.close();
+    server.close();
+    api?.stop();
+  });
+
+  it("delivers a frame published by somebody else to a member's socket", async () => {
+    // T014's own proof that the harness works. Nothing here is about the api
+    // publishing — that is Phase 3 — only that a frame placed on the subject by
+    // a different client reaches a socket this gateway holds. Without it, every
+    // delivery test below would fail for the same uninformative reason.
+    const socket = connect(await mintToken());
+    const frames = record(socket);
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    // `api.channelId`, not the ack. `connectionAckSchema.payload` is
+    // `{ user, cursor, resume_ok, truncated }` — there is no `channels` field on
+    // it, and the first version of this test read one. The gateway knows the
+    // channel list internally, from `POST /internal/session`; it does not tell
+    // the client, which is why this reads the seeded id from the harness.
+    const channel = api.channelId;
+
+    await publisher.publish({
+      id: randomUUID(),
+      channel,
+      seq: 9_001,
+      user: "tuan",
+      text: "published by somebody else",
+      attachments: [],
+      created_at: new Date(0).toISOString(),
+    });
+
+    const delivered = (await waitFor(
+      frames,
+      (f) => f.type === "message.created",
+      "message.created",
+    )) as { payload: { text: string; seq: number } };
+    expect(delivered.payload.text).toBe("published by somebody else");
+    expect(delivered.payload.seq).toBe(9_001);
+  });
+
+  it("delivers to EVERY connection the same person holds", async () => {
+    // Spec edge case 5. What is under test is the registry's fan-out to local
+    // sockets, so who published is irrelevant — this publishes directly. Two
+    // sockets for one user is the case a naive registry keyed by user id gets
+    // wrong, and it is worth its own test because the failure is invisible: one
+    // of the two tabs just stops updating.
+    const token = await mintToken();
+    const a = record(connect(token));
+    const b = record(connect(token));
+    await waitFor(a, (f) => f.type === "connection.ack", "ack on a");
+    await waitFor(b, (f) => f.type === "connection.ack", "ack on b");
+
+    const text = `to both tabs ${randomUUID()}`;
+    await publisher.publish({
+      id: randomUUID(),
+      channel: api.channelId,
+      seq: 9_002,
+      user: "tuan",
+      text,
+      attachments: [],
+      created_at: new Date(0).toISOString(),
+    });
+
+    for (const [frames, which] of [[a, "a"], [b, "b"]] as const) {
+      const got = (await waitFor(
+        frames,
+        (f) => f.type === "message.created",
+        `message.created on ${which}`,
+      )) as { payload: { text: string } };
+      expect(got.payload.text).toBe(text);
+    }
+  });
+
+  // T028b, T030 and T029a. THE TWO DELIVERY DOORS AND THE ACK.
+  const twoAttachments = [
+    { type: "url", kind: "image", url: "https://example.test/deliver-first.png" },
+    { type: "url", kind: "audio", url: "https://example.test/deliver-second.mp3" },
+  ];
+  const urlsOf = (payload: { attachments: Array<{ url?: string }> }) =>
+    payload.attachments.map((a) => a.url);
+
+  it("delivers attachments SOCKET to SOCKET, in order (FR-008, SC-001)", async () => {
+    // ONE MEMBER SENDS OVER ITS SOCKET AND ANOTHER RECEIVES. The REST delivery test below
+    // cannot see this path: the api builds the fan-out payload for a REST send and the
+    // GATEWAY builds it for a socket send, so they are two constructions of one frame.
+    // BOTH MUST BE MEMBERS, and `mintToken` mints a token for any identifier — so two
+    // sockets open fine and neither is delivered to. This file already records that trap
+    // 630 lines above, written for T033, and this test hit it anyway: the failure reads
+    // "no message.created on the watcher; saw connection.ack", which is a membership
+    // problem wearing a delivery problem's message.
+    const added = await fetch(`${api.url}/v1/channels/${api.channelId}/members`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({ user_ids: ["linh"] }),
+    });
+    expect([200, 201, 409]).toContain(added.status);
+
+    const senderSocket = connect(await mintToken("tuan"));
+    const sender = record(senderSocket);
+    const watcher = record(connect(await mintToken("linh")));
+    await waitFor(sender, (f) => f.type === "connection.ack", "ack on sender");
+    await waitFor(watcher, (f) => f.type === "connection.ack", "ack on watcher");
+
+    const text = `socket to socket ${randomUUID()}`;
+    senderSocket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text,
+          attachments: twoAttachments,
+        },
+      }),
+    );
+
+    const delivered = (await waitFor(
+      watcher,
+      (f) => f.type === "message.created" && (f as { payload: { text: string } }).payload.text === text,
+      "message.created on the watcher",
+    )) as { payload: { attachments: Array<{ url?: string }> } };
+    expect(urlsOf(delivered.payload)).toEqual([
+      "https://example.test/deliver-first.png",
+      "https://example.test/deliver-second.mp3",
+    ]);
+  }, 20_000);
+
+  it("delivers a deletion with NO attachment field at all (FR-013)", async () => {
+    // AN EXACT KEY SET, NOT `payload.attachments === undefined`. An absent key and an
+    // undefined value are the same to a truthiness check and different to a contract —
+    // and the contract is the point: `message.deleted` carries no text because a payload
+    // with a text field can carry the words somebody asked to have removed, and an
+    // attachment URL is exactly as recoverable. So the absence is the assertion.
+    const watcher = record(connect(await mintToken("tuan")));
+    await waitFor(watcher, (f) => f.type === "connection.ack", "ack on watcher");
+
+    const text = `to be deleted ${randomUUID()}`;
+    const posted = await fetch(`${api.url}/v1/channels/${api.channelId}/messages`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({
+        text,
+        user: "delivery-bot",
+        idempotency_key: randomUUID(),
+        attachments: twoAttachments,
+      }),
+    });
+    expect(posted.status, await posted.clone().text()).toBe(201);
+    const created = (await posted.json()) as { id: string };
+    await waitFor(watcher, (f) => f.type === "message.created", "message.created");
+
+    const removed = await fetch(
+      `${api.url}/v1/channels/${api.channelId}/messages/${created.id}`,
+      { method: "DELETE", headers: { authorization: `Bearer ${api.credential}` } },
+    );
+    expect(removed.status, await removed.clone().text()).toBe(204);
+
+    const deleted = (await waitFor(
+      watcher,
+      (f) => f.type === "message.deleted",
+      "message.deleted",
+    )) as { payload: Record<string, unknown> };
+    expect(Object.keys(deleted.payload).sort()).toEqual([
+      "channel",
+      "deleted_at",
+      "id",
+      "seq",
+      "user",
+    ]);
+  }, 20_000);
+
+  it("carries only `seq` on the sender's ack (FR-008)", async () => {
+    // THE ACK HAS NEVER CARRIED A MESSAGE AND THIS CHAPTER DOES NOT WIDEN IT. A sender
+    // learns its attachments landed from the `message.created` frame the fan-out returns
+    // to it, not from the ack — so the ack's exact key set is the assertion.
+    const ackSocket = connect(await mintToken("tuan"));
+    const sender = record(ackSocket);
+    await waitFor(sender, (f) => f.type === "connection.ack", "ack on sender");
+    ackSocket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: `ack only ${randomUUID()}`,
+          attachments: twoAttachments,
+        },
+      }),
+    );
+    const ack = (await waitFor(
+      sender,
+      (f) => f.type === "message.ack",
+      "message.ack",
+    )) as { payload: Record<string, unknown> };
+    expect(Object.keys(ack.payload).sort()).toEqual(["seq"]);
+  }, 20_000);
+
+  it("delivers a message SENT OVER REST to an open socket (SC-001, FR-004)", async () => {
+    // THE CHAPTER, END TO END, in the integration lane. A real api spawned from
+    // dist/main.js, a real gateway, a real socket opened before the send, and a
+    // POST to the route a customer's backend calls. Nothing here publishes by
+    // hand.
+    //
+    // `user` is required and must name a bot: an application credential may
+    // speak only as software. `idempotency_key` must be a UUID on
+    // this route, where the socket frame takes any string.
+    const frames = record(connect(await mintToken()));
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    const text = `over REST to a socket ${randomUUID()}`;
+    const posted = await fetch(
+      `${api.url}/v1/channels/${api.channelId}/messages`,
+      {
+        method: "POST",
+        headers: {
+          "content-type": "application/json",
+          authorization: `Bearer ${api.credential}`,
+        },
+        body: JSON.stringify({
+          text,
+          user: "delivery-bot",
+          idempotency_key: randomUUID(),
+          // T030. TWO, because one cannot show an order.
+          attachments: twoAttachments,
+        }),
+      },
+    );
+    expect(posted.status, await posted.clone().text()).toBe(201);
+
+    const delivered = (await waitFor(
+      frames,
+      (f) => f.type === "message.created",
+      "message.created for a REST send",
+    )) as {
+      payload: {
+        text: string;
+        user: string;
+        seq: number;
+        attachments: Array<{ url?: string }>;
+      };
+    };
+    // SC-001 IS A CLAIM THAT TWO READERS AGREE, so this compares the frame's list against
+    // what the history route returns for the same message rather than asserting each
+    // alone. The api builds this payload; the socket-to-socket test above covers the
+    // gateway's own construction of the same frame.
+    expect(urlsOf(delivered.payload)).toEqual([
+      "https://example.test/deliver-first.png",
+      "https://example.test/deliver-second.mp3",
+    ]);
+    const history = await fetch(
+      `${api.url}/v1/channels/${api.channelId}/messages?limit=10`,
+      { headers: { authorization: `Bearer ${api.credential}` } },
+    );
+    const page = (await history.json()) as {
+      messages: Array<{ seq: number; attachments: Array<{ url?: string }> }>;
+    };
+    const read = page.messages.find((m) => m.seq === delivered.payload.seq)!;
+    expect(urlsOf(read)).toEqual(urlsOf(delivered.payload));
+    expect(delivered.payload.text).toBe(text);
+    expect(delivered.payload.user).toBe("delivery-bot");
+    // The sequence the api committed, not one the gateway invented.
+    expect(delivered.payload.seq).toBeGreaterThan(0);
+  });
+
+  it("an edit over REST reaches every member's socket as message.updated exactly once (FR-005, SC-001)", async () => {
+    // TWO SOCKETS, TWO DIFFERENT PEOPLE, and a count rather than a first match.
+    // `waitFor` resolves on the first frame that matches, so it cannot see a duplicate;
+    // FR-005 is one property with two halves — everybody gets it, and nobody gets it
+    // twice — and only counting after a settle covers the second.
+    const first = record(connect(await mintToken("editor")));
+    const second = record(connect(await mintToken("watcher")));
+    await waitFor(first, (f) => f.type === "connection.ack", "connection.ack (editor)");
+    await waitFor(second, (f) => f.type === "connection.ack", "connection.ack (watcher)");
+
+    // SENT BY THE EDITOR'S OWN TOKEN. Only an author may edit (FR-013) and the edit
+    // route takes no application credential at all (FR-013a), so the send has to be
+    // attributed to the same person — which a user token does by itself, and which is
+    // why this body names no `user`.
+    const editorToken = await mintToken("editor");
+    const before = `to be corrected ${randomUUID()}`;
+    const posted = await fetch(`${api.url}/v1/channels/${api.channelId}/messages`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${editorToken}`,
+      },
+      body: JSON.stringify({ text: before }),
+    });
+    expect(posted.status, await posted.clone().text()).toBe(201);
+    const sent = (await posted.json()) as { id: string; seq: number };
+    await waitFor(second, (f) => f.type === "message.created", "the creation");
+
+    const after = `${before} (corrected)`;
+    const edited = await fetch(
+      `${api.url}/v1/channels/${api.channelId}/messages/${sent.id}`,
+      {
+        method: "PATCH",
+        headers: {
+          "content-type": "application/json",
+          authorization: `Bearer ${editorToken}`,
+        },
+        body: JSON.stringify({ text: after }),
+      },
+    );
+    expect(edited.status, await edited.clone().text()).toBe(200);
+
+    for (const [who, frames] of [
+      ["editor", first],
+      ["watcher", second],
+    ] as const) {
+      const updated = (await waitFor(
+        frames,
+        (f) => f.type === "message.updated",
+        `message.updated (${who})`,
+      )) as { payload: { text: string; seq: number; id: string } };
+      expect(updated.payload.text, who).toBe(after);
+      // THE SEQUENCE IT ALREADY HAD (FR-002), on the wire. A new number here would
+      // put the edit at the end of every client's list and break every cursor.
+      expect(updated.payload.seq, who).toBe(sent.seq);
+      expect(updated.payload.id, who).toBe(sent.id);
+    }
+
+    // AND EXACTLY ONCE EACH, after a settle long enough for a second copy to have
+    // arrived. Both counts, because the two sockets take different paths through the
+    // registry — the editor's connection and the watcher's are separate entries and a
+    // per-connection duplicate would show on one of them.
+    await new Promise((r) => setTimeout(r, 300));
+    expect(first.filter((f) => f.type === "message.updated")).toHaveLength(1);
+    expect(second.filter((f) => f.type === "message.updated")).toHaveLength(1);
+    // …AND NO SECOND CREATION, which is what ADR-24 is for. Routed to the old callback
+    // the edit arrives as `message.created` and no shape check can see it, because the
+    // `updated` arm's payload IS a `Message`.
+    expect(first.filter((f) => f.type === "message.created")).toHaveLength(1);
+    expect(second.filter((f) => f.type === "message.created")).toHaveLength(1);
+  });
+
+  it("a deletion over REST reaches a member's socket with NO text field, and a second deletion sends nothing (FR-007, FR-009)", async () => {
+    const frames = record(connect(await mintToken("watcher")));
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    // Sent by the editor and deleted by the TENANT KEY, which FR-012 permits
+    // irrespective of author — the path a moderator takes, exercised here because the
+    // frame must be identical either way.
+    const editorToken = await mintToken("editor");
+    const text = `to be removed ${randomUUID()}`;
+    const posted = await fetch(`${api.url}/v1/channels/${api.channelId}/messages`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${editorToken}`,
+      },
+      body: JSON.stringify({ text }),
+    });
+    expect(posted.status, await posted.clone().text()).toBe(201);
+    const sent = (await posted.json()) as { id: string; seq: number };
+    await waitFor(frames, (f) => f.type === "message.created", "the creation");
+
+    const removed = await fetch(
+      `${api.url}/v1/channels/${api.channelId}/messages/${sent.id}`,
+      { method: "DELETE", headers: { authorization: `Bearer ${api.credential}` } },
+    );
+    expect(removed.status, await removed.clone().text()).toBe(204);
+
+    const frame = (await waitFor(
+      frames,
+      (f) => f.type === "message.deleted",
+      "message.deleted",
+    )) as { payload: Record<string, unknown> };
+    // THE EXACT KEY SET, which is the assertion FR-020's sibling requirement needs:
+    // "no text" as `Object.keys` rather than as `payload.text === undefined`, because
+    // an absent key and a null one read the same through a property access.
+    expect(Object.keys(frame.payload).sort()).toEqual([
+      "channel",
+      "deleted_at",
+      "id",
+      "seq",
+      "user",
+    ]);
+    expect(frame.payload).not.toHaveProperty("text");
+    // Identity and position (FR-008), and the sequence is the one it had — a tombstone
+    // that gave up its place would leave a gap in every client's ordering.
+    expect(frame.payload["id"]).toBe(sent.id);
+    expect(frame.payload["seq"]).toBe(sent.seq);
+    // THE AUTHOR, NOT THE DELETER. A tenant key removed it; the frame names who wrote
+    // it, which is the fact every client already holds beside the message.
+    expect(frame.payload["user"]).toBe("editor");
+
+    // AND NO SECOND FRAME FOR A SECOND DELETION (FR-009, SC-007). The status is 204
+    // either way, so this count is the only thing that can tell the two apart on the
+    // wire.
+    expect(
+      (
+        await fetch(`${api.url}/v1/channels/${api.channelId}/messages/${sent.id}`, {
+          method: "DELETE",
+          headers: { authorization: `Bearer ${api.credential}` },
+        })
+      ).status,
+    ).toBe(204);
+    await new Promise((r) => setTimeout(r, 300));
+    expect(frames.filter((f) => f.type === "message.deleted")).toHaveLength(1);
+  });
+
+  it("stops delivering to a member who was REMOVED while connected (FR-RTM-10)", async () => {
+    // INVERTED IN THE MEMBERSHIP-REVOCATION CHAPTER, AND THE TITLE WITH IT. This test read "keeps
+    // delivering" and asserted the violation on purpose from the fan-out chapter until
+    // now — its own closing comment carried the instruction: "change this to
+    // `.rejects` on the day a re-read exists".
+    //
+    // FR-RTM-10 is P1: events "shall not be delivered to a client whose membership
+    // no longer grants access, effective within 5 seconds of the membership change".
+    // What the old comment described is what changed:
+    //
+    //   `connection.channelIds` is a Set built once at connect, `fanout.subscribe`
+    //   runs once over it, `fanout.unsubscribe` runs once when the socket CLOSES,
+    //   and `registry.subscribersOf` reads that same set on every delivery. Nothing
+    //   in between re-reads membership. **There is no code path that could.**
+    //
+    // There is now: `deliverMembership` in `session.ts` deletes the channel from
+    // that Set when the fabric says the membership ended.
+    //
+    // **THE 5,500 ms WAIT IS UNCHANGED**, which is the whole point of inverting this
+    // test rather than writing a new one. A pass means the clause is met, not that
+    // the assertion moved to somewhere easier.
+    //
+    // AND THE TITLE IS PART OF THE CHANGE. THE PRESENCE CHAPTER shipped a test whose title
+    // claimed an arm it never touched and nothing caught it for four phases; a title
+    // saying "keeps delivering" over an assertion that nothing arrives is the same
+    // defect with the sign flipped.
+    const channel = api.channelId;
+    const frames = record(connect(await mintToken()));
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    const removed = await fetch(
+      `${api.url}/v1/channels/${channel}/members/remove`,
+      {
+        method: "POST",
+        headers: {
+          "content-type": "application/json",
+          authorization: `Bearer ${api.credential}`,
+        },
+        body: JSON.stringify({ user_ids: ["tuan"] }),
+      },
+    );
+    expect(removed.status, await removed.clone().text()).toBe(200);
+
+    // The clause's own window, plus a margin. If a re-read existed anywhere —
+    // a poll, an invalidation, a message on another subject — five seconds is
+    // the budget it was given.
+    await new Promise((r) => setTimeout(r, 5_500));
+
+    const text = `after removal ${randomUUID()}`;
+    const posted = await fetch(`${api.url}/v1/channels/${channel}/messages`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({
+        text,
+        user: "delivery-bot",
+        idempotency_key: randomUUID(),
+      }),
+    });
+    expect(posted.status).toBe(201);
+
+    await expect(
+      waitFor(
+        frames,
+        (f) =>
+          f.type === "message.created" &&
+          (f as { payload: { text: string } }).payload.text === text,
+        "the frame FR-RTM-10 says must not arrive",
+      ),
+    ).rejects.toThrow(/must not arrive/);
+
+    // AND THE NOTICE DID ARRIVE, which is the half that separates a working
+    // revocation from a socket that broke. `waitFor` rejecting proves only that
+    // nothing came; a gateway that dropped the connection satisfies that perfectly.
+    expect(
+      frames.filter((f) => f.type === "membership.changed"),
+    ).toHaveLength(1);
+  }, 20_000);
+
+  it("delivers nothing from a PRIVATE channel to a non-member's socket (FR-014, SC-007)", async () => {
+    // FR-CHN-05's fourth door. The read paths got three in the channel-control chapter — list,
+    // history, and the channel itself — and delivery is the one this chapter
+    // opens. Tested as its own case rather than inferred from the others,
+    // because the mechanism is different: the read paths ask the repository,
+    // and delivery asks whether a subject was ever subscribed to.
+    //
+    // A non-member's connection subscribes to nothing, so it cannot hear the
+    // subject at all. That is a stronger property than a refusal — there is no
+    // decision to get wrong — and it is worth pinning for exactly that reason:
+    // a future re-read that "fixed" subscriptions could break it.
+    const stranger = `stranger-${randomUUID().slice(0, 8)}`;
+    const created = await fetch(`${api.url}/v1/users`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({ users: [{ external_id: stranger }] }),
+    });
+    expect(created.status, await created.clone().text()).toBeLessThan(300);
+
+    const privately = await fetch(`${api.url}/v1/channels`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({
+        external_id: `private-${randomUUID().slice(0, 8)}`,
+        type: "private",
+      }),
+    });
+    expect(privately.status).toBe(201);
+    const privateId = ((await privately.json()) as { id: string }).id;
+
+    const frames = record(connect(await mintToken(stranger)));
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    // Published directly: what is under test is whether a non-member's socket
+    // can hear the subject, not whether the api will publish to it.
+    await publisher.publish({
+      id: randomUUID(),
+      channel: privateId,
+      seq: 9_100,
+      user: "tuan",
+      text: "not for a stranger",
+      attachments: [],
+      created_at: new Date(0).toISOString(),
+    });
+    await new Promise((r) => setTimeout(r, 800));
+
+    expect(frames.filter((f) => f.type === "message.created")).toEqual([]);
+  });
+  /** Something schema-valid for each outbound type, so the refusal under test is
+   * the direction one. Mirrors `isolation.itest.ts`'s builder; the duplication is
+   * deliberate, because that file proves a client cannot FORGE these and this one
+   * proves the seam still refuses them after being widened. */
+  const sampleOutbound = (type: string, channel: string): unknown => {
+    const message = {
+      id: randomUUID(),
+      channel,
+      seq: 1,
+      user: "tuan",
+      text: "forged",
+      // WELL-FORMED IS THE POINT. `messageSchema` requires
+      // attachments, and a forged frame missing them is refused for its SHAPE —
+      // `invalid_frame` — a phase before the direction check this suite is about.
+      attachments: [],
+      created_at: new Date().toISOString(),
+    };
+    switch (type) {
+      case "connection.ack":
+      // AND `revisions` FOR THE SAME REASON, ONE FIELD LATER. This chapter made it
+      // required on the ack, so the sample above stopped satisfying
+      // `connectionAckSchema` and the forged frame came back `invalid_frame` —
+      // the refusal a phase before the one this loop asserts. Identical to the
+      // `message.deleted` split below, in the same two files, in the same feature.
+        return {
+          type,
+          payload: {
+            user: "tuan",
+            cursor: {},
+            resume_ok: true,
+            truncated: [],
+            revisions: {},
+          },
+        };
+      case "message.ack":
+        return { type, payload: { seq: 1 } };
+      case "message.created":
+      case "message.updated":
+        return { type, payload: message };
+      // THE REVISIONS CHAPTER SPLIT THIS CASE OFF, and the failure that forced it is the point
+      // of the test. `message.deleted` shared `message` — a `Message` with a `text` —
+      // until this chapter gave the frame a payload of its own with no text and a
+      // `deleted_at`. The forged frame then failed the SHAPE check and came back
+      // `invalid_frame`, so the test asserting `unknown_frame_type` went red.
+      //
+      // It was red for the right reason: this test's whole claim is that a WELL-FORMED
+      // outbound frame is refused for its DIRECTION. A malformed one is refused a
+      // phase earlier and proves nothing about direction at all — which is what it
+      // would have been quietly asserting had the payload merely been tolerated.
+      case "message.deleted":
+        return {
+          type,
+          payload: {
+            id: message.id,
+            channel,
+            seq: 1,
+            user: "tuan",
+            deleted_at: new Date().toISOString(),
+          },
+        };
+      case "membership.changed":
+        return { type, payload: { channel, user: "tuan", change: "added" } };
+      case "presence.changed":
+        return { type, payload: { user: "tuan", state: "online" } };
+      case "typing":
+        return { type, payload: { channel, user: "tuan" } };
+      default:
+      // A `request_id` IN THE ERROR SAMPLE, AND THIS COMMENT USED TO SAY THE OPPOSITE.
+      // It read *"NO `request_id` IN THE ERROR SAMPLE — the payload is a `strictObject`,
+      // so an extra field is refused as `invalid_frame`"*, and it was right for exactly
+      // as long as the field did not exist. The limits chapter makes it REQUIRED, so
+      // the same `strictObject` now refuses the sample for its ABSENCE, and the loop's
+      // nine direction assertions came back `invalid_frame` — the failure this
+      // builder's own header warns about, arriving from the other side.
+      //
+      // The unchanged half is the reason: this loop asserts `unknown_frame_type`, a
+      // claim about DIRECTION, and a sample that fails validation tests the validator
+      // instead. Which fields make a sample valid is a fact about the schema on the
+      // day, not a rule to be stated once.
+        return {
+          type,
+          payload: {
+            code: "forged",
+            message: "forged",
+            docs_url: "/x",
+            request_id: randomUUID(),
+          },
+        };
+    }
+  };
+
+  /** T034 — T009 INVERTED, and the same shape on purpose.
+   *
+   * The send is byte-identical to the one that got `unknown_frame_type` and a
+   * 4002 in phase 2. Only the seam moved, so a pass here means the seam moved —
+   * not that somebody softened an assertion until it passed.
+   *
+   * The refusal's three states, closed:
+   *
+   *   phase 1   not in the union         ->  invalid_frame, socket open
+   *   phase 2   in the union, not send   ->  unknown_frame_type, close 4002
+   *   phase 4   in the named inbound set ->  accepted, socket open        <- here
+   *
+   * NO ACK, AND THAT IS THE ASSERTION. A typing signal is answered by nothing:
+   * no `message.ack`, no error, no close. So "accepted" can only be tested as
+   * the absence of a refusal plus a socket still open — which is why the wait
+   * below is real time rather than a frame to await. */
+  it("accepts typing.send and answers with nothing at all", async () => {
+    const socket = connect(await mintToken());
+    const frames = record(socket);
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    let closeCode: number | undefined;
+    socket.on("close", (code: number) => {
+      closeCode = code;
+    });
+
+    socket.send(
+      JSON.stringify({
+        type: "typing.send",
+        payload: { channel: api.channelId },
+      }),
+    );
+
+    await new Promise((r) => setTimeout(r, 400));
+    expect(frames.filter((f) => f.type === "error")).toEqual([]);
+    expect(closeCode).toBeUndefined();
+    expect(socket.readyState).toBe(WebSocket.OPEN);
+  });
+
+  /** T035. EVERY OTHER TYPE, DRIVEN FROM THE UNION rather than from a list.
+   *
+   * A hand-written list is a second place to forget the eleventh type — and this
+   * chapter added one, so the list would already be wrong. `frameSchema.options`
+   * yields the discriminators at runtime, so a twelfth frame appears here without
+   * an edit and fails until somebody decides its direction.
+   *
+   * **EVERY SAMPLE IS SCHEMA-VALID FOR ITS TYPE**, which is the whole care in
+   * this test. A frame that fails `safeParse` is answered `invalid_frame` and
+   * never reaches the direction check — so a sloppy payload would turn nine
+   * direction assertions into nine parser assertions and still be green.
+   * `isolation.itest.ts`'s sample builder makes the same point in its own
+   * comment, and this is a second copy rather than a shared helper because the
+   * two files disagree about what they are proving. */
+  it("refuses every non-inbound type with unknown_frame_type and 4002", async () => {
+    const outbound = frameSchema.options
+      .map((option) => (option.shape.type as { value: string }).value)
+      .filter((type) => type !== "message.send" && type !== "typing.send");
+
+    expect(outbound).toHaveLength(9);
+
+    for (const type of outbound) {
+      const socket = connect(await mintToken());
+      const frames = record(socket);
+      await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+      const closed = new Promise<number>((resolve) =>
+        socket.on("close", (code: number) => resolve(code)),
+      );
+
+      socket.send(JSON.stringify(sampleOutbound(type, api.channelId)));
+
+      const error = await waitFor(frames, (f) => f.type === "error", `error for ${type}`);
+      expect(error.payload, `direction refusal for ${type}`).toMatchObject({
+        code: "unknown_frame_type",
+      });
+      expect(await closed, `close code for ${type}`).toBe(4002);
+    }
+  });
+
+  /** T037. THE PAYLOAD CANNOT NAME A USER, and the delivered frame names the
+   * connection's identity in the same run.
+   *
+   * Two halves because they fail differently: a `user` on the way IN is a schema
+   * rejection (`typingSendSchema` is strict and has no such field), and the user
+   * on the way OUT is `signalTyping` reading `connection.identity`. A test that
+   * only checked the first would pass against a handler that took the user from
+   * anywhere. */
+  it("refuses a typing.send whose payload names a user", async () => {
+    const socket = connect(await mintToken());
+    const frames = record(socket);
+    await waitFor(frames, (f) => f.type === "connection.ack", "connection.ack");
+
+    socket.send(
+      JSON.stringify({
+        type: "typing.send",
+        payload: { channel: api.channelId, user: "somebody-else" },
+      }),
+    );
+
+    const error = await waitFor(frames, (f) => f.type === "error", "error");
+    // `invalid_frame`, not `unknown_frame_type`: the type IS inbound, so this
+    // never reaches the direction check — the strict schema rejects it first.
+    expect(error.payload).toMatchObject({ code: "invalid_frame" });
+    expect(socket.readyState).toBe(WebSocket.OPEN);
+  });
+});
+
+
+describe("the connection cap at the door (US1)", () => {
+  // ITS OWN FIXTURE, AND THE PUBLISHED ORDER PAID FOR THAT LESSON. There, this
+  // module was wired into an existing "cap at the door" describe whose quota tests
+  // all shared the user "tuan" — so the cap bit them and two went red:
+  //
+  //   × opens normally the moment the cap is raised
+  //   × leaves a socket opened before the breach open and receiving
+  //
+  // **Wiring a new module into an existing describe changes the behaviour of every
+  // test in it.** The same class as the leak inside `connections.itest.ts`, where
+  // tests sharing a user shared five places — fixed there with a fresh user per
+  // test, and fixed here by not joining anybody else's fixture at all. In this
+  // order there is nothing to join: the connection cap is the first refusal at the
+  // door, so the block holds only what it is named for.
+  let api: ApiUnderTest;
+  let server: Server;
+  let url: string;
+  let connections: Connections;
+  let stopSessions: () => Promise<void>;
+  const sockets: WebSocket[] = [];
+
+  const mintToken = async (user: string) => {
+    const res = await fetch(`${api.url}/auth/dev-token`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({ user, ttl_seconds: 3600 }),
+    });
+    if (!res.ok) throw new Error(`dev-token: ${res.status}`);
+    return ((await res.json()) as { token: string }).token;
+  };
+
+  const connect = (token: string) => {
+    const socket = new WebSocket(`${url}/v1/ws?token=${token}`);
+    sockets.push(socket);
+    return socket;
+  };
+
+  beforeAll(async () => {
+    api = await startApi();
+    connections = createConnections({ logger: silent });
+    server = serve({
+      service: "gateway",
+      health: () => ({}),
+      logger: silent,
+      notFoundDocsUrl: docsUrl("not_found"),
+    });
+    const sessions = attachSessions({
+      server,
+      api: createApiClient(api.url),
+      logger: silent,
+      connections,
+    });
+    await new Promise<void>((resolve) => server.listen(0, resolve));
+    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
+    stopSessions = sessions.close;
+  }, 60_000);
+
+  afterAll(async () => {
+    for (const socket of sockets) socket.close();
+    await stopSessions?.();
+    await connections?.close();
+    server?.close();
+    api?.stop();
+  });
+
+  // T011. RED ON PURPOSE, and the phase commit says so.
+  //
+  // FR-RTM-09 permits five concurrent connections per user and nothing counts
+  // them, so all six of these are accepted today. This test asserts the sixth is
+  // refused, which is the behaviour the chapter builds — so it fails now and
+  // passes when Phase 5 lands. A red lane nobody explained is indistinguishable
+  // from a red lane nobody noticed, and CI cannot tell them apart.
+  //
+  // IT LIVES IN THIS DESCRIBE FOR A REASON, and the reason was found in Phase 1.
+  // Every gateway module is an optional parameter (`session.ts:192` onward) and
+  // this block calls `attachSessions` with none, so the cap will not be enforced
+  // here until Phase 5 passes the module in — which it must, or this test can
+  // never go green. The block is named "the cap at the door" and already holds
+  // the other two door refusals: the rate-limit chapter's rate limit and the connection-metering chapter's
+  // quota. The connection cap is the third and belongs beside them.
+  //
+  // `expect.fail` is deliberate over `it.fails`: the assertion below states the
+  // requirement, and a reader of a red run should see the count that was allowed
+  // rather than "this test was expected to throw".
+  it("refuses a sixth connection for one user (FR-RTM-09)", async () => {
+    // A user this test alone uses. The api's seed created "tuan"; a dev token for
+    // any name works, and a name of its own is what keeps five places to itself.
+    const token = await mintToken("tuan");
+    const accepted: number[] = [];
+    for (let i = 0; i < 5; i += 1) {
+      const frame = (await firstFrame(connect(token), "connection.ack")) as {
+        payload: { user: string };
+      };
+      expect(frame.payload.user).toBe("tuan");
+      accepted.push(i);
+    }
+    expect(accepted).toHaveLength(5);
+
+    // The sixth. Today it acks like the rest; after Phase 5 it closes with the
+    // cap's own code, which is NOT 4001, 4002, 4003, 4008 or 4009 — every reuse
+    // fails `codes.ts`'s standing test, "a client that cannot tell them apart
+    // retries the wrong one for ever".
+    const sixth = connect(token);
+    const code = await closeCode(sixth);
+    expect(code).not.toBe(4001);
+    expect(code).toBeGreaterThanOrEqual(4000);
+    expect(code).toBeLessThan(5000);
+  }, 30_000);
+
+});
+
+describe("the cap at the door (US3)", () => {
+  let api: ApiUnderTest;
+  let server: Server;
+  let url: string;
+  const sockets: WebSocket[] = [];
+  let stopSessions: () => Promise<void>;
+
+  const mintToken = async (user = "tuan") => {
+    const res = await fetch(`${api.url}/auth/dev-token`, {
+      method: "POST",
+      headers: {
+        "content-type": "application/json",
+        authorization: `Bearer ${api.credential}`,
+      },
+      body: JSON.stringify({ user, ttl_seconds: 3600 }),
+    });
+    if (!res.ok) throw new Error(`dev-token: ${res.status}`);
+    return ((await res.json()) as { token: string }).token;
+  };
+
+  const connect = (token: string) => {
+    const socket = new WebSocket(`${url}/v1/ws?token=${token}`);
+    sockets.push(socket);
+    return socket;
+  };
+
+  const setCap = async (config: unknown) => {
+    const client = require_(
+      join(REPO, "services", "api", "dist", "db", "client.js"),
+    ) as { createPool: () => { query: (q: string, v: unknown[]) => Promise<unknown>; end: () => Promise<void> } };
+    const pool = client.createPool();
+    await pool.query(
+      "UPDATE environments SET quota_config = $1 WHERE id = $2",
+      [JSON.stringify(config), api.environmentId],
+    );
+    await pool.end();
+  };
+
+  beforeAll(async () => {
+    api = await startApi();
+    server = serve({
+      service: "gateway",
+      health: () => ({}),
+      logger: silent,
+      // Required in this tree: the error-registry chapter made `serve` take the
+      // not-found link from `docsUrl` rather than spelling it, and it is upstream here.
+      notFoundDocsUrl: docsUrl("not_found"),
+    });
+    const sessions = attachSessions({
+      server,
+      api: createApiClient(api.url),
+      logger: silent,
+    });
+    await new Promise<void>((resolve) => server.listen(0, resolve));
+    url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
+    stopSessions = sessions.close;
+  }, 60_000);
+
+  afterAll(async () => {
+    for (const socket of sockets) socket.close();
+    await stopSessions?.();
+    server?.close();
+    api?.stop();
+  });
+
+  it("closes 4008 with an error frame naming the resume date", async () => {
+    // THE CLIENT'S HALF. The api answers 402; what reaches the browser is the
+    // socket's own vocabulary — a code the protocol has declared since chapter
+    // 1.3 and nothing has ever sent.
+    await setCap({ connection_minutes: { hard: 0 } });
+    const socket = connect(await mintToken());
+
+    const frame = (await firstFrame(socket, "error")) as {
+      payload: { code: string; message: string; docs_url: string; request_id: string };
+    };
+    expect(frame.payload.code).toBe("quota_exceeded");
+    expect(frame.payload.message).toContain("connection-minute");
+    expect(frame.payload.message).toContain("connections resume on");
+    // Four fields, like every other error this contract carries.
+    expect(frame.payload.docs_url).toBeTruthy();
+    expect(frame.payload.request_id).toBeTruthy();
+
+    expect(await closeCode(socket)).toBe(4008);
+  });
+
+  it("is NOT 4001, and not 1011 either", async () => {
+    // Before this chapter a 402 fell through to `parse`, threw, and closed 1011
+    // — "we are broken, retry". Mapping it to `refused` instead would close 4001
+    // — "your credential is bad" — which a client acts on by re-authenticating
+    // for ever. The token here is perfectly good.
+    await setCap({ connection_minutes: { hard: 0 } });
+    const code = await closeCode(connect(await mintToken()));
+    expect(code).not.toBe(4001);
+    expect(code).not.toBe(1011);
+    expect(code).toBe(4008);
+  });
+
+  it("opens normally the moment the cap is raised", async () => {
+    await setCap({ connection_minutes: { hard: 100_000 } });
+    const socket = connect(await mintToken());
+    expect(await firstFrame(socket, "connection.ack")).toBeTruthy();
+  });
+
+  it("leaves a socket opened before the breach open and receiving", async () => {
+    // FR-RTL-08's promise, and the reason the overshoot exists at all.
+    await setCap({ connection_minutes: { hard: 100_000 } });
+    const early = connect(await mintToken());
+    expect(await firstFrame(early, "connection.ack")).toBeTruthy();
+
+    await setCap({ connection_minutes: { hard: 0 } });
+    const refused = connect(await mintToken());
+    expect(await closeCode(refused)).toBe(4008);
+
+    // The early socket is untouched by its neighbour's refusal.
+    expect(early.readyState).toBe(WebSocket.OPEN);
+  });
+});
```

### `vitest.coverage.config.mts` — the coverage ratchet. Eleven chapters and nine appendix hunks pin thresholds in it, and the pins move whenever a measurement does — which no chapter teaches.

743 differing lines, 8 hunks.

```diff title="vitest.coverage.config.mts"
@@ -21,39 +21,12 @@
   test: {
     // Feature 030: the global-operation guard. `globalSetup` migrates and
     // then installs the trigger once per lane; `setupFiles` sets the
     // exemption for files on the harness's list and, where the lane carries
     // bait, plants it per file. This lane gets exemption
     // handling and NO bait: it holds no reader-shape fault, and planting
-    // would change its workload for no return (feature 030).
-    globalSetup: ["./packages/test-harness/src/global-setup.ts"],
-    // FEATURE 030, MEASURED: nine suites in this lane import `AppModule`, and none
-    // of them set a relay flag. Each relay defaults to on when its flag is unset
-    // (`process.env.RELAY_OUTBOX_RELAY ?? "on"`), so those nine booted four
-    // background loops that sweep the whole database while every other suite's
-    // fixtures sit in it. Research R13 recorded the exposure as nil on the strength
-    // of the four suites that spawn an api CHILD and set the flags in the child's
-    // env; it did not look at the suites that boot the app in process.
-    //
-    // A relay catches and logs its own errors, so the guard's refusal inside one is
-    // a log line and a green lane. Setting the flags here makes the quiet database
-    // a property of the lane rather than a convention nobody applied.
-    env: {
-      RELAY_OUTBOX_RELAY: "off",
-      RELAY_DELIVERY_RELAY: "off",
-      RELAY_NOTIFICATION_RELAY: "off",
-      RELAY_EVENT_CONSUMER: "off",
-      // The quota chapter's relay, the fourth. Same reason as the other three.
-      RELAY_QUOTA_RELAY: "off",
-    },
-    setupFiles: ["./packages/test-harness/src/setup.ts"],
-    // Feature 030: the global-operation guard. `globalSetup` migrates and
-    // then installs the trigger once per lane; `setupFiles` sets the
-    // exemption for files on the harness's list and, where the lane carries
-    // bait, plants it per file. This lane gets exemption
-    // handling and NO bait: it holds no reader-shape fault, and planting
     // would change its workload for no return (FR-022).
     globalSetup: ["./packages/test-harness/src/global-setup.ts"],
     // FEATURE 030, MEASURED: nine suites in this lane import `AppModule`, and none
     // of them set a relay flag. Each relay defaults to on when its flag is unset
     // (`process.env.RELAY_OUTBOX_RELAY ?? "on"`), so those nine booted four
     // background loops that sweep the whole database while every other suite's
@@ -68,63 +41,87 @@
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
       // The quota relay, the fourth. Same reason as the other three.
       RELAY_QUOTA_RELAY: "off",
+      // THE TWO PLATFORM CREDENTIALS, IN BOTH LANES THAT RUN `.itest.ts` FILES (chapter 4.9).
+      //
+      // `services/api/vitest.integration.config.mts` carries the argument in full: without
+      // these, `limits.itest.ts` fails loudly and three attacks in `isolation/gauntlet.itest.ts`
+      // return at their first line and report green. **This file runs the same suites**, and the
+      // first version of that fix went into the integration config alone — so `pnpm coverage`
+      // stayed red on `limits.itest.ts` and the gauntlet stayed quietly skipped in the run that
+      // measures constitution VI's own coverage bar. An amendment that fixes one config and
+      // leaves its twin standing is the defect rather than the config.
+      RELAY_INTERNAL_CREDENTIAL: "rk_svc_local_development_credential_0000",
+      RELAY_INTERNAL_CREDENTIAL_GATEWAY: "rk_svc_local_development_gateway_00000",
     },
     setupFiles: ["./packages/test-harness/src/setup.ts"],
     include: [
       "packages/*/src/**/*.test.ts",
       "services/*/src/**/*.test.ts",
       "packages/*/src/**/*.itest.ts",
       "services/*/src/**/*.itest.ts",
     ],
     // The e2e journey spawns real services and is excluded on purpose: it
     // measures the system, not any file's branches, and its child processes'
     // coverage is not attributable here anyway.
     //
-    // AND `packages/outsider` FOR A DIFFERENT REASON, added in the channel-control chapter's Phase 1.
-    // That suite integrates against a platform it does not start: without
-    // RELAY_API_URL, RELAY_WS_URL and RELAY_DEMO_CREDENTIAL it throws on purpose and
-    // prints the five commands that would satisfy it. `pnpm coverage` sets none of
-    // them, so it failed every coverage run — 8 tests skipped, one failed suite.
+    // AND `packages/outsider` FOR A DIFFERENT REASON. That suite integrates against a
+    // platform it does not start: without `RELAY_API_URL`, `RELAY_WS_URL` and
+    // `RELAY_DEMO_CREDENTIAL` it throws on purpose and prints the five commands that
+    // would satisfy it. `pnpm coverage` sets none of them.
     //
-    // The isolation gauntlet split the lanes so `pnpm test:integration` is
-    // `turbo run test:integration --filter=!@relay/outsider`, and the exclusion went
-    // into the script and NOT into this config. One lane learned it and the other did
-    // not. `pnpm test:outsider` is the way in, and the CI `outsider` job is where it
-    // runs with its stack.
-    exclude: [
-      "**/node_modules/**",
-      "packages/e2e/**",
-      "packages/outsider/**",
-    ],
+    // THREE LANES, AND THE THIRD DID NOT LEARN. The package declares no `test` script,
+    // so the Docker-free unit lane cannot see it. `pnpm test:integration` is
+    // `turbo run test:integration --filter=!@relay/outsider`, so that lane was told.
+    // The exclusion went into a SCRIPT and this config globs the filesystem — so the
+    // coverage lane found the suite anyway and reported **one failed file, ten skipped
+    // tests**, every run.
+    //
+    // Published shipped it that way and fixed it two chapters later. The measurement
+    // here is the same shape and two tests larger, because the typing leg above added
+    // two: a count in a filter is a count of what somebody remembered to filter.
+    //
+    // `pnpm test:outsider` is the way in.
+    exclude: ["**/node_modules/**", "packages/e2e/**", "packages/outsider/**"],
     // Suites in one process would share a database in ways their authors did
     // not design for — the outbox chapter's suite learned that the hard way.
     fileParallelism: false,
     testTimeout: 60_000,
     hookTimeout: 60_000,
     coverage: {
       provider: "v8",
       reporter: ["text", "json-summary"],
+      // REPORT EVEN WHEN A TEST FAILS, AND CHAPTER 4.7 FOUND OUT WHY BY RUNNING IT.
+      //
+      // This defaults to false, which means a single red test suppresses the WHOLE
+      // report: no table, no per-file threshold errors, no `coverage/` directory —
+      // only the line `Coverage enabled with v8`. Measured both ways over the same
+      // three files: all green printed the table and every threshold error; one
+      // failing test printed neither.
+      //
+      // The api's `request-log.itest.ts` has been red on any machine with no ingester
+      // process since chapter 4.4 shipped it (050-8), so the gate that measures
+      // constitution VI has been answering with silence rather than with a number —
+      // and silence is indistinguishable from a pass at a glance. **A ratchet that
+      // only reports on a green lane cannot guard a lane that is red for an unrelated
+      // reason.**
+      reportOnFailure: true,
       include: ["packages/*/src/**/*.ts", "services/*/src/**/*.ts"],
       exclude: [
         "**/*.test.ts",
         "**/*.itest.ts",
         "**/dist/**",
         "packages/e2e/**",
         // Entry points and framework wiring: reached by running the service,
         // not by asserting on it. Counting them measures how much of `main.ts`
         // a test happened to touch, which is not what "business logic" means.
         "**/main.ts",
         "**/*.module.ts",
-        // The lane's own scaffolding (feature 030). Same argument one step out:
-        // counting how much of the harness a test touched measures the harness,
-        // not the product.
-        "packages/test-harness/src/**",
         // THE LANE'S OWN INFRASTRUCTURE IS NOT BUSINESS LOGIC. `include` is
         // `packages/*/src/**`, so the harness arrived inside the measurement the
         // moment it became a package. Its files run on every integration suite and
         // would score near the top, raising the workspace figure while saying
         // nothing about the product — the same dilution `**/*.module.ts` is
         // excluded for.
@@ -280,12 +277,144 @@
         // both are exercised almost entirely by `dispatcher.itest.ts`, which runs the api
         // as a CHILD PROCESS whose coverage is not attributable to this lane. Pinning
         // them would pin the harness rather than the code, and lowering the whole file's
         // floor to match would be a ratchet describing a test topology. What was pinned
         // instead is what a suite in THIS process can reach: the repository methods those
         // two call, covered by `webhooks/deliveries.itest.ts`.
+        //
+        // THE MAIL-TRANSPORT CHAPTER ADDED A THIRD FILE TO THAT LIST:
+        // `notifications/notification-relay.ts` measures 58.06/50/62.5/62.06 for the same
+        // reason — its loop is started by `main.ts` in a spawned api, and what this
+        // process reaches is `drainOnce`, which the suite calls directly. Three files now
+        // read low because of where their code RUNS rather than whether it is tested, and
+        // the honest place for that fact is here rather than in three lowered pins.
+        // THE INGESTER (chapter 4.3), AND THE INTERESTING NUMBER IS THE ONE THAT IS 100.
+        //
+        // `shape.ts` is 100/100/100. It is the code that decides what a record BECOMES --
+        // the rename from `attempted_at` to `ts`, and the absent-means-NULL pair -- and it
+        // is the file where being wrong looks exactly like success: an unmatched key takes
+        // the epoch, the TTL deletes the row at insert, and every other check in the
+        // chapter passes over an empty table.
+        //
+        // `main.ts` reads 37.50 branches for the reason three files above it read low: its
+        // `main()` -- connect, consumer creation, the loop, signal handlers -- is started
+        // by a process, not by a suite. The part that decides anything, `ingestOnce`, is
+        // exercised by `ingest.itest.ts` directly.
+        //
+        // AND CONSTITUTION VI's 100%-BRANCH CLAUSE DOES NOT REACH THE THING IT IS ABOUT
+        // HERE. It names idempotency, and this service's idempotency is a
+        // `ReplacingMergeTree` sorting key -- a schema, with no branches to cover. Branch
+        // coverage is the wrong instrument for a guarantee that is not implemented in
+        // code, and `ingest.itest.ts` is the right one: it replays a batch under three
+        // different groupings and asserts ten records stay ten rows.
+        "services/ingester/src/shape.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/ingester/src/clickhouse.ts": {
+          branches: 80,
+          functions: 75,
+          lines: 88,
+          statements: 84,
+        },
+        // CHAPTER 4.4 MOVED `ingestOnce` OUT OF `main.ts`, AND THE PIN BELOW IS THE FIRST
+        // ONE HERE THAT CAN FAIL. The key was `services/ingester/src/main.ts` -- a file
+        // `coverage.exclude`'s `**/main.ts` removes from collection, so the threshold matched
+        // nothing and produced no error, no warning, nothing. Swept at 049's opening: 45
+        // per-file pins in this file, exactly 1 unbindable, and it was that one. Both halves
+        // of the probe are run now, which is the step that was skipped.
+        //
+        // The old numbers -- branches 33, functions 25, lines 40, statements 41 -- were
+        // recorded against a file nothing measured, so they are not carried across. Measured
+        // on `ingest.ts`: 76.66 statements, 75 branches, 100 functions, 75 lines.
+        // CHAPTER 4.4's PRODUCER. `event.ts` is where the TENANCY branch lives -- the choice
+        // between a tenant's subject and the `_none` arm -- and constitution VI names tenant
+        // isolation for 100% branch coverage. It measures 100/100/100/100, so the clause is
+        // met rather than pinned-with-a-shortfall, which is the first time this feature could
+        // say that: 048 recorded the same clause as unreachable because its idempotency was a
+        // sorting key and a schema has no branches to cover.
+        "services/api/src/request-log/event.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The middleware measures 88.46 branches. The uncovered arms are the defensive reads
+        // -- an absent `req.requestId`, an absent `req.method` -- which no route can produce
+        // through the running app, and which are there because the types say the fields are
+        // optional on a bare IncomingMessage.
+        "services/api/src/request-log/request-log.middleware.ts": {
+          branches: 84,
+          functions: 100,
+          lines: 95,
+          statements: 95,
+        },
+        // CHAPTER 4.5's PRODUCER, AND THE SECOND FILE IN PART 4 TO MEET CONSTITUTION VI's
+        // 100%-BRANCH CLAUSE RATHER THAN PIN A SHORTFALL. `event.ts` holds the tenancy
+        // branch -- a tenant's subject against a refusal -- and there is no `_none` arm
+        // here at all: a connection event only exists after a handshake, so a record with
+        // no tenant is malformed rather than tenantless. The 100 was reached by DELETING a
+        // branch, not by testing one.
+        //
+        // TWO OBSERVATIONS, IDENTICAL. This project pins below the lower reading by the
+        // observed swing because coverage is not reproducible run to run -- `session.ts`
+        // measured 87.80 and 85.36 on identical code twenty minutes apart. These two files
+        // measured byte-identical figures on two runs, so the swing recorded here is 0 and
+        // the pins sit at the measurement.
+        "services/gateway/src/connection-log/event.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The publisher is broker wiring: connect lazily, share the in-flight promise,
+        // drain on close. Measured 56 statements / 44.44 branches / 66.66 functions /
+        // 60.86 lines over the unit suite and the integration suite together. The
+        // uncovered arms are the reconnect and error paths, which need a broker that fails
+        // in a particular way rather than one that is absent -- and FR-004e's retention is
+        // what makes those arms recoverable rather than load-bearing.
+        //
+        // PINNED BELOW 70 DELIBERATELY. Constitution VI's 70% is about business logic, and
+        // a file whose whole job is holding one client is not that. Pinning it at 70 would
+        // mean either a test that mocks a reconnect to move a number, or a ratchet somebody
+        // lowers later -- and this project has written down that a ratchet which teaches
+        // people to lower ratchets is worse than no ratchet.
+        "services/gateway/src/connection-log/publisher.ts": {
+          branches: 40,
+          functions: 60,
+          lines: 55,
+          statements: 50,
+        },
+        // CHAPTER 4.6's READ, AT 100 ON ALL FOUR -- AND IT GOT THERE BY DELETING TWO
+        // BRANCHES RATHER THAN BY TESTING THEM.
+        //
+        // It measured 50% branches twice. The uncovered halves were a `?? ""` / `?? 0`
+        // fallback per column and a `rows.length === 0` guard, both written as defensive
+        // reads and both unreachable: the SELECT names four columns, so a short row cannot
+        // arrive, and **a bare aggregate with no GROUP BY always returns exactly one row** --
+        // asked of the server, `sum()` over a tenant with nothing answers `0`, not an empty
+        // result. The guard carried a comment claiming a test drove both arms. It did not;
+        // the test passed through the else.
+        //
+        // A branch that cannot go both ways is a branch nothing checks, and 4.5 reached the
+        // same figure the same way. Two observations, identical.
+        "services/ingester/src/metering.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/ingester/src/ingest.ts": {
+          branches: 71,
+          functions: 100,
+          lines: 71,
+          statements: 72,
+        },
+
         "services/dispatcher/src/expand.ts": {
           branches: 92,
           functions: 100,
           lines: 100,
           statements: 92,
         },
@@ -309,48 +438,83 @@
         // `analytics.ts` is here for a different reason: everything it does is
         // decide what NOT to put on a stream. Its allow-list is the mechanism
         // standing between a customer's payload and seven days of retention
         // (FR-004, SC-006), and its `catch` is what stops an analytics outage
         // becoming a delivery outage (contract invariant 4). Both are branches, and
         // an unmeasured branch here fails silently in the direction nobody checks.
-        // The attachment shape and the REST door's schemas, both at 100 on
-        // all four metrics — which is why neither appears in the text reporter's table
-        // and why this pin was written from `coverage-summary.json` instead.
+        // ── THIS CHAPTER'S NEW FILES, PINNED DELIBERATELY ─────────────────────
         //
-        // `attachments.ts` holds FR-MSG-11's whole contract: the two arms, the scheme
-        // allowlist, the ten-item bound, and the pair rule all three send doors call. A
-        // later chapter that adds an arm and no test turns this red, which is the job.
-        //
-        // AND A MEASURED CAVEAT ON THE BRANCH NUMBER, because 100 here means less than it
-        // reads. v8 records a `binary-expr` arm as covered when the OPERAND WAS
-        // EVALUATED, not when it went both ways: `typeof value.text === "string" &&
-        // value.text.length > 0` measures `[7, 7]`, and the `typeof` check has never once
-        // been false — no schema that calls the refinement declares `text` as anything
-        // but `z.string()`. The guard stays because the signature it narrows is
-        // deliberately `string | null | undefined` (see the comment on
-        // `refineTextAndAttachments`), so the compiler requires it. **A file at 100%
-        // branches is not a file whose every arm has run.**
-        "packages/protocol/src/attachments.ts": {
+        // T079 asked for an explicit decision either way, and the answer is: pin
+        // the ones that decide something, at what they measure. All of these sit
+        // inside the coverage `include` glob, so an unpinned file here is bounded
+        // by nothing but the aggregate 70 — the connection-metering chapter's T033c made the same
+        // call for the same reason, and its comment is the one to read: an
+        // unpinned file is a figure that can slide.
+        //
+        // `catalogue.ts` matters most of the four. It lands in
+        // `services/api/src/db/`, the one directory that already carries a
+        // per-file ratchet and the directory constitution VI's 100%-branch clause
+        // is about. It reaches 100 on every metric — but only after the
+        // classification was separated from the query, because the arm that
+        // returns `null` cannot execute against a database that has no
+        // unclassified table, which is the state the check exists to keep. The
+        // separation is the finding; the number is what it bought.
+        "services/api/src/db/catalogue.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
 
-        // The REST door, pinned for the first time because the attachments chapter is the first to
-        // find a defect in it: `editMessageBodySchema.text` was
-        // `sendMessageBodySchema.shape.text`, so relaxing the send's floor for FR-019
-        // relaxed the edit's, and an edit has no attachments field to restore it. Two
-        // schemas that must differ cannot share a reference at all.
-        "services/api/src/messages/messages.schema.ts": {
+        // The gauntlet's own instruments. Test infrastructure that the include
+        // glob cannot tell from product code — and rather than adding an exclude
+        // entry to hide them, they are pinned, because Phase 7's whole argument
+        // applies one layer down: an instrument that has never produced output has
+        // never had its output checked. Both reached 100 only after the arms a
+        // PASSING suite cannot reach were driven with fakes: the router shapes the
+        // live adapter does not have, and the difference strings a healthy
+        // platform never produces.
+        "services/api/src/isolation/targets.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/isolation/compare.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
 
+        // `attack.ts` is NOT at 100, and the remaining arms are named rather than
+        // chased. `send`'s empty-body arm and `credentialAttack`'s mint-failure arm
+        // both need an HTTP fake to reach, and faking the transport in a file whose
+        // subject is real HTTP would test the fake. `rowsOf` was extracted and
+        // closed because it holds a real decision — zero rows from an unrecognised
+        // shape reads exactly like zero rows from a correctly-scoped list, and only
+        // one of those is a pass.
+        "services/api/src/isolation/attack.ts": {
+          branches: 83,
+          functions: 100,
+          lines: 100,
+          statements: 96,
+        },
+
+        // The channel surface's decisions: the scoped read that comes FIRST so a
+        // foreign channel and an absent one answer alike, and the ceiling counted
+        // from storage before any user is created. The one uncovered branch is the
+        // `not_found` outcome after a successful scoped read — the channel deleted
+        // between two statements of one call — which nothing in the api can do.
+        "services/api/src/channels/channels.service.ts": {
+          branches: 75,
+          functions: 100,
+          lines: 94,
+          statements: 94,
+        },
+
         "services/api/src/webhooks/disable.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
@@ -470,12 +634,204 @@
           branches: 92,
           functions: 100,
           lines: 97,
           statements: 97,
         },
 
+        // The attachment shape and the REST door's schemas, both at 100 on
+        // all four metrics — which is why neither appears in the text reporter's table
+        // and why this pin was written from `coverage-summary.json` instead. Measured on
+        // this tree at 945 tests across 62 files: 100/100/100/100 for both.
+        //
+        // AND THE TWO FILES THIS CHAPTER ADDED THE MOST CODE TO DID NOT MOVE THEIR PINS.
+        // `messages.controller.ts` reads 97.95/92.85/100/97.91 — byte-identical to the
+        // revisions chapter's reading, on a file this chapter widened — and
+        // `repository.ts`'s branches went 92.66 (sender chapter) to 92.97 (revisions) to
+        // **93.35** here, still above the 92 it is pinned at. Three chapters of upward
+        // drift and no pin edit is the ratchet working, not the ratchet asleep.
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
+        // THE PRESENCE CHAPTER'S TWO, both at 100 on every metric, and the pin is
+        // NFR-MNT-02's MUST rather than a preference: presence keys are
+        // `presence:{env}:{user}`, so this is tenant-isolation code and the clause asks
+        // 100% of its branches.
+        //
+        // `packages/protocol/src/presence.ts` reached it on the first run — two exports,
+        // no clock, no client, and `presence.test.ts` covers both.
+        //
+        // `services/gateway/src/presence.ts` did not, and closing it is the whole
+        // argument for a ratchet. Six arms had never executed:
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
+        // `toEqual([])` — it publishes a MESSAGE on a MESSAGE subject and checks presence
+        // never sees it, which is FR-029 from the other side and a good test under the
+        // wrong name. Both rejection arms read zero while it was green. It is renamed;
+        // the real ones publish onto `presence:{channel_id}` with a client belonging to
+        // neither module.
+        //
+        // AND ONE BRANCH WAS DELETED RATHER THAN COVERED. The re-election's
+        // `if (wonTransition(won))` guard around clearing the offline marker is reachable
+        // only when two instances race the same re-election — a test that could only
+        // flake. The marker is now cleared unconditionally, which is also more correct:
+        // unlike `connected`, nothing publishes here, so a loser that skipped the delete
+        // left a stale "somebody already said they left" standing against a user who is
+        // demonstrably connected.
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
+        // ── THIS CHAPTER'S FOUR NEW PRODUCTION FILES ───────────────────────
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
+        "services/gateway/src/typing.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+
         // The rate-limit chapter's limiter. Pinned at what the work achieves, which for the
         // three pure files is everything — they hold no clock, no store and no
         // framework, so a branch they miss is a case nobody thought of rather
         // than a case nobody could reach.
         //
         // `bucket.ts`, `policy.ts` and `fallback.ts` are here at 100 on every
@@ -581,21 +937,21 @@
         // will not narrow:
         //
         //   config.ts:65      `parsed.error.issues[0]?.message ?? "invalid"` — a zod
         //                     failure carries at least one issue, always
         //   period.ts:43-44   `(m ?? 1)` and `(y ?? 0)` in `nextPeriod`, on a period
         //                     that came from `periodOf` or from a `date` column
-        //   quota-email.ts:31 `months[Number(m) - 1] ?? m` — a month outside 1..12
+        //   quota-email.ts:51 `months[Number(m) - 1] ?? m` — a month outside 1..12
         //
         // READ THE FRACTION, NOT THE PERCENTAGE, because 75 reads like a hole and is
         // not one. These files are small enough that one arm moves the figure a long
         // way, and the counts say what the percentages hide:
         //
         //   config.ts       9/10 branches   the one is the `?? "invalid"`
         //   period.ts       6/8             the two are `?? 1` and `?? 0`
-        //   quota-email.ts  6/8             the two are `?? m`, both arms of one guard
+        //   quota-email.ts  9/10            the one is `?? m`; see the note on its pin
         //   quota-relay.ts  29/30 statements  the one is the catch inside `run()`
         //
         // A pin of 75 on an eight-branch file leaves room for exactly the two arms
         // named above and nothing else: lose a third and it goes red.
         //
         // NOT DELETED, WHICH IS THIS RATCHET'S USUAL ANSWER, because deleting them
@@ -615,14 +971,26 @@
         "services/api/src/quotas/period.ts": {
           branches: 75,
           functions: 100,
           lines: 100,
           statements: 100,
         },
+        // 9/10, RAISED FROM 6/8 BY A TEST RATHER THAN LOWERED BY A CHAPTER. The
+        // connection-metering chapter added a third guard here —
+        // `STOPPAGE[facts.dimension] ?? DEFAULT_STOPPAGE` — which took the reading to
+        // 7/10 and turned this pin red at 75. That is the ratchet working: a pin set
+        // at the previous reading catches the arm the new code did not cover.
+        //
+        // The answer was NOT 70. Two of the three fallbacks are reachable — a
+        // dimension is a string off `usage_periods`, not a member of a union — and
+        // "says something true for a dimension it has never heard of" reaches both,
+        // asserting that neither map puts the word `undefined` in a customer's email.
+        // Only `months[…] ?? m` is left, and a month outside 1..12 cannot come from a
+        // `date` column.
         "services/api/src/quotas/quota-email.ts": {
-          branches: 75,
+          branches: 90,
           functions: 100,
           lines: 100,
           statements: 100,
         },
 
         // The relay's loop, and the shortfall is the one every relay in this codebase
@@ -676,198 +1044,135 @@
           branches: 93,
           functions: 100,
           lines: 100,
           statements: 100,
         },
 
-        // The presence chapter's two, both at 100 on every metric, and the pin is
-        // NFR-MNT-02's MUST rather than a preference: presence keys are
-        // `presence:{env}:{user}`, so this is tenant-isolation code and the clause
-        // asks 100% of its branches.
-        //
-        // `packages/protocol/src/presence.ts` reached it on the first run — two
-        // exports, no clock, no client, and `presence.test.ts` covers both.
+        // ── CHAPTER 4.7's RECONCILER, AND EVERY UNCOVERED ARM IS THE SAME ONE ─────
         //
-        // `services/gateway/src/presence.ts` measured **91.52 / 81.81 / 93.93 /
-        // 92.92** with all 31 integration tests and 8 unit tests green, and closing
-        // it is the whole argument for a ratchet. Six arms had never executed:
+        // Measured twice, identical both times: 100 / 97.14 / 100 / 100. Pinned one
+        // point below on branches for the run-to-run swing this provider has.
         //
-        //   the JSON.parse catch            a body that is not JSON
-        //   the safeParse rejection         JSON that is not a transition
-        //   the refresh re-election         the key lost under a live connection
-        //   `counts.get(c) ?? 1`            unsubscribe for a channel never subscribed
-        //   the no-op `deliver`             a transition with no handler registered
-        //   the pending-timer clear         close() while a grace check is armed
-        //
-        // ONE OF THEM HAD A TEST WHOSE TITLE CLAIMED IT. "logs
-        // presence.invalid_payload for a payload that is not a transition" asserted
-        // `toEqual([])` — it publishes a MESSAGE on a MESSAGE subject and checks
-        // presence never sees it, which is FR-029 from the other side and a good
-        // test under the wrong name. Both rejection arms read zero while it was
-        // green. It is renamed; the real ones publish onto `presence:{channel_id}`
-        // with a client belonging to neither module.
-        //
-        // AND ONE BRANCH WAS DELETED RATHER THAN COVERED, which is the fourth time
-        // this ratchet has done that. The re-election's `if (wonTransition(won))`
-        // guard around clearing the offline marker is reachable only when two
-        // instances race the same re-election — a test that could only flake. The
-        // marker is now cleared unconditionally, which is also more correct: unlike
-        // `connected`, nothing publishes here, so a loser that skipped the delete
-        // left a stale "somebody already said they left" standing against a user who
-        // is demonstrably connected.
-        "packages/protocol/src/presence.ts": {
-          branches: 100,
-          functions: 100,
-          lines: 100,
-          statements: 100,
-        },
-        "services/gateway/src/presence.ts": {
-          branches: 100,
+        // THE ONE UNCOVERED BRANCH IS 4.6's FACT, AND HERE IT IS KEPT RATHER THAN
+        // DELETED. `rollup[0] === undefined` never fires: the rollup read is a bare
+        // aggregate, and **a bare aggregate with no GROUP BY always returns exactly
+        // one row**. Chapter 4.6 met the same arm and deleted it. This one stays, for
+        // a reason that chapter did not have: `noUncheckedIndexedAccess` is on, so
+        // `rollup[0]` is `string[] | undefined` and removing the check means asserting
+        // a type the store's signature does not promise. An uncovered arm is cheaper
+        // than a lie about a type.
+        //
+        // AND THE ARM IS NOT DEAD AT THE STORE — only at this call site.
+        // `reconcile.itest.ts` proves `query` really does answer `[]`, for a filtered
+        // NON-aggregate. That difference is exactly why this function counts rows
+        // instead of testing the result for emptiness.
+        "services/api/src/metering/reconcile.ts": {
+          branches: 96,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-
-        // ── THE MEMBERSHIP-REVOCATION CHAPTER'S FOUR NEW PRODUCTION FILES ──
-        //
-        // All four at 100 on every metric, and the pin is NFR-MNT-02's MUST rather
-        // than a preference: membership decides who may hear what, so this is
-        // tenant-isolation code and the clause asks 100% of its branches.
+        // The api's own analytical caller. 100 / 91.3 / 100 / 100 — LOWERED FROM 93 BY
+        // CHAPTER 4.8, WHICH IS THE THING A RATCHET IS SUPPOSED TO MAKE HARD.
         //
-        // THREE REACHED IT ON THE FIRST RUN, and the reason is worth keeping. The
-        // phase that built the gateway module listed its arms BEFORE writing them —
-        // the `JSON.parse` catch, the `safeParse` rejection, an unsubscribe for a
-        // channel never subscribed, a change arriving before `onChange` is wired,
-        // `close()` with a timer armed, and a construction taking both defaults —
-        // and drove each with a test in that phase. The presence chapter met its equivalents
-        // at close-out instead and paid for it with seven tests, a deleted branch and
-        // a re-measured battery.
-        //
-        // `memberships.controller.ts` did NOT reach it: 28.57% statements and 0%
-        // branches on the first run, for a route the gateway's suite exercises end to
-        // end. That suite runs in another package, and this is where the api's
-        // coverage is measured — **a route can be thoroughly tested and completely
-        // uncovered**. Four tests in `internal.itest.ts` fixed the measurement, and
-        // its last unreachable branch — a `principal?.kind !== "user"` throw the
-        // guard makes impossible — moved into the signature's type.
-        "packages/protocol/src/membership.ts": {
-          branches: 100,
-          functions: 100,
-          lines: 100,
-          statements: 100,
-        },
-        "services/api/src/membership/publisher.ts": {
-          branches: 100,
-          functions: 100,
-          lines: 100,
-          statements: 100,
-        },
-        "services/api/src/internal/memberships.controller.ts": {
-          branches: 100,
-          functions: 100,
-          lines: 100,
-          statements: 100,
-        },
-        "services/gateway/src/membership.ts": {
-          branches: 100,
+        // IT WAS 88.88 / 78.94 UNTIL 4.7's TWO STORE-LEVEL TESTS — the refusal path and
+        // the empty result set, both real behaviour and neither exercised by a
+        // reconciliation test that only ever asks well-formed questions. The branch left
+        // over was line 115's `?? "clickhouse refused"`, which `String.prototype.split`
+        // makes unreachable and the type checker makes mandatory.
+        //
+        // 4.8 ADDED A SECOND ARM OF EXACTLY THE SAME KIND and the pin caught it, which is
+        // the pin working rather than the pin being in the way. The store client now
+        // catches `fetch` rejecting — an abort, a refused connection, a DNS failure — and
+        // `cause` is typed `unknown`, so `cause instanceof Error ? cause.message : …` has
+        // an else the runtime never takes: `fetch` rejects with an `Error`. Driving it
+        // would mean mocking `fetch`, which buys a green number by testing a stub.
+        //
+        // **TWO UNREACHABLE ARMS, BOTH NAMED, BOTH TYPE-MANDATED**, and the file is at
+        // 100 on every other measure. An uncovered arm is cheaper than a lie about a
+        // type — 4.7's sentence, now applying twice in the same file.
+        "services/api/src/metering/clickhouse.ts": {
+          branches: 91,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        // `packages/protocol/src/typing.ts` reached 100 on the
-        // first run — one function and no branches, which is what a subject
-        // builder and a schema are.
-        //
-        // `services/gateway/src/typing.ts` did NOT: **97.77 / 76.92 / 92.3 /
-        // 97.67**, with four arms unreached. T097 asks whether unreachable code
-        // should be deleted before it asks for a test, and the answer here was no
-        // — all four were reachable and nothing had reached them:
+        // The operational half of the comparison. 100 / 83.33 / 100 / 100, twice.
         //
-        //   the url default        every test supplies a url or the env var does
-        //   the `onSignal` no-op   every test wires a handler through the session
-        //   `counts.get(c) ?? 0`   a SECOND subscribe for one channel
-        //   `next <= 0`'s else     one of two holders releasing
-        //
-        // The last two are the reference count, and they are the arms that decide
-        // whether a second member of a channel silently loses typing when the
-        // first disconnects. A gateway cannot reach them: the session layer holds
-        // one connection per socket. So they are driven against the module
-        // directly, in a describe that builds `createTyping` itself.
-        "packages/protocol/src/typing.ts": {
-          branches: 100,
+        // 83.33 IS FIVE ARMS OF SIX, and the sixth is the same shape a third time,
+        // asked of the other engine: `select count(*)` with no GROUP BY returns one
+        // row for a filter matching nothing — checked against this lane's Postgres,
+        // which answered `(1 row)` with `n = 0` — so the `?? 0` beside it cannot fire.
+        // Three files, three engines' worth of the same guard, one pin each.
+        "services/api/src/db/usage-reads.ts": {
+          branches: 82,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        // `services/gateway/src/connections.ts` at 100 on all four,
-        // and it took three deletions to get there rather than three tests. The
-        // first measurement read **96.15 / 82.60 / 100 / 97.67** with four arms
-        // uncovered, and three of them were arms nothing could take:
+        // ── chapter 4.8's arithmetic, both files at 100 / 100 / 100 / 100, twice ──────
         //
-        //   two `failable` wrappers in the walk   the second "could not ask" arm
-        //                                         needs Redis to die BETWEEN two
-        //                                         commands — merged into one
-        //   `renew` re-wrapping the walk's        `full` and `unenforced` mean the
-        //   outcomes                              same here as there — returned whole
-        //   `instanceof Error ? … : String(…)`    `presence.ts:241` uses `String`
-        //                                         alone, and the other arm is
-        //                                         unreachable from any test
+        // PINNED AT 100 RATHER THAN AT WHAT WAS FIRST MEASURED, and the difference is two
+        // findings the branch report produced. `cursor.ts` read 89.47 / 83.33 on its first
+        // run with two lines uncovered, and they were uncovered for opposite reasons: one
+        // guard could NEVER fire — `Number.isSafeInteger` behind a `\d{1,15}` pattern that
+        // cannot produce an unsafe integer — and the other could and had never been asked.
+        // The dead one is deleted and the live one has a test. Chapter 4.6 reached
+        // 100/100/100/100 by deleting two arms and wrote down that the number was worth
+        // less for it; here one arm went each way, which is the outcome that makes the
+        // measurement worth taking.
         //
-        // The fourth was a real gap and got a real test: the `url` default and the
-        // `??` inside it, neither reachable while the lane sets `RELAY_REDIS_URL`.
-        // That is the ratchet removing code for the fourth time in this repository
-        // rather than covering it.
-        "services/gateway/src/connections.ts": {
+        // NOTHING IN EITHER FILE TOUCHES A STORE, A DATABASE OR A BROKER, so these two
+        // numbers are the same under the unit lane and under this one. That is the
+        // property the phase was separated for.
+        "services/api/src/request-log/cursor.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        "services/gateway/src/typing.ts": {
+        "services/api/src/request-log/request-log.schema.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        // FEATURE 043's THREE, ALL AT 100 ON EVERY METRIC.
+        // The reader. 100 / 86.79 / 100 / 100, twice.
         //
-        // `frames.ts` gained `MESSAGE_TEXT_MAX` and the bound on the socket door;
-        // `webhooks.service.ts` had all five bare 422s replaced and gained the event-type
-        // check; `event.ts` gained the declared-eight object and the compile-time
-        // assertion that every emitted type has a schema branch.
+        // 86.79 IS ELEVEN `??` DEFAULTS THAT `noUncheckedIndexedAccess` FORCES AND THE
+        // TRANSPORT CANNOT REACH. `AnalyticalStore.query` returns `string[][]` and the
+        // statement names ten columns, so `cells[7] ?? ""` has a right operand that never
+        // evaluates — the same trade `reconcile.ts` records at 96 and `metering/clickhouse.ts`
+        // at 93, a third time: an uncovered arm is cheaper than a lie about a type.
         //
-        // Pinned because they measured 100 and not because 100 was the target — the
-        // ratchet's job is to stop a later change lowering them silently.
-        "packages/protocol/src/frames.ts": {
-          branches: 100,
+        // IT WAS 79.24 AND THEN 83.01 BEFORE IT WAS THIS, and both steps were real gaps
+        // rather than rounding. The first: `refuse()`'s re-throw arm and the malformed
+        // cursor, two decisions this chapter argued for in a comment and never drove —
+        // `reader.test.ts` drives them now. The second: **`direction: newer` had never
+        // run**, in the contract and in the schema since phase 2, with every test using
+        // the default. Two expressions flip with it and a page that got one and not the
+        // other returns the right rows in the wrong order.
+        "services/api/src/request-log/reader.ts": {
+          branches: 86,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        "services/api/src/webhooks/webhooks.service.ts": {
+        // The route. 100 / 100 / 100 / 100, twice — and the 403 arm is at 100 because a
+        // unit test drives it, not because the route can reach it. `@Accepts("application")`
+        // refuses every other credential class at the door and an application credential
+        // always carries an environment, so FR-011's refusal is unreachable over HTTP
+        // today. Kept rather than deleted, which is where this differs from chapter 4.6's
+        // dead branches: a requirement asks for this one, and "the guard would have caught
+        // it" is an argument about today's decorator.
+        "services/api/src/request-log/request-log.controller.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        "services/api/src/outbox/event.ts": {
-          branches: 100,
-          functions: 100,
-          lines: 100,
-          statements: 100,
-        },
-        // NOT PINNED, AND NAMED RATHER THAN QUIETLY OMITTED (feature 043):
-        //
-        //   packages/protocol/src/internal.ts   92.68 lines · 85.71 branches · 60 funcs
-        //   packages/protocol/src/codes.ts      83.33 lines · 100 branches · 50 funcs
-        //
-        // Both were touched by this feature and neither was touched in a way that moved
-        // these numbers: `internal.ts` had one literal replaced with an import, and
-        // `codes.ts` gained six registry ENTRIES, which are data. Pinning a file at 85.71
-        // ratchets a number nobody chose, and the honest version is to say so here — the
-        // omission is a decision, not an oversight.
       },
     },
   },
   plugins: [
     swc.vite({
       module: { type: "es6" },
```

### `services/api/src/outbox/event.test.ts` — the outbox event test, introduced whole at 3.11 and amended by work after it.

406 differing lines, 3 hunks.

```diff title="services/api/src/outbox/event.test.ts"
@@ -1,21 +1,37 @@
 import { describe, expect, it } from "vitest";
 
-import { messageCreatedEvent, subjectFor } from "./event";
+import {
+  membershipEvent,
+  messageCreatedEvent,
+  messageDeletedEvent,
+  messageUpdatedEvent,
+  OUTBOX_EVENT_TYPES,
+  outboxEventSchema,
+  subjectFor,
+  WEBHOOK_EVENT_TYPES,
+} from "./event";
 
 // The envelope, Docker-free. What a consumer eventually receives
 // is decided here and nowhere else — the relay moves bytes, it does not author
 // them (ADR-04, research R7).
 
 const ENV = "3f2a0000-0000-0000-0000-000000000001";
 const MESSAGE = {
   id: "57d5cdf0-e145-4bca-b7fa-a7a43e8ffbb6",
   channel_id: "ce419dc5-b06e-441c-ab38-49451f87210e",
   seq: 1,
   user: "tuan",
   text: "B2, north ramp",
+  // TWO, because FR-006 says order holds on every path that returns a
+  // message and a consumer's webhook is one — a single-attachment fixture could not see
+  // an order at all.
+  attachments: [
+    { type: "url" as const, kind: "image" as const, url: "https://example.test/one.png" },
+    { type: "url" as const, kind: "audio" as const, url: "https://example.test/two.mp3" },
+  ],
   created_at: "2026-08-08T13:31:09.229Z",
 };
 
 describe("subjectFor", () => {
   it("puts the environment last, as SAD §6.1's example does", () => {
     expect(subjectFor("message.created", ENV)).toBe(
@@ -89,13 +105,13 @@
         message: MESSAGE,
       }),
     ).toThrow(/environment/i);
   });
 });
 
-describe("a legacy senderless message in the webhook payload (T054a)", () => {
+describe("a legacy senderless message in the webhook payload", () => {
   // THE ONE PATH THAT LEAVES THE PLATFORM. FR-WHK-02 delivers `message.created` to a
   // customer's own HTTPS endpoint and FR-WHK-03 retries a failed delivery for up to two
   // hours — so an event for a legacy senderless row can be delivered, and REdelivered,
   // after this chapter ships. A subscriber's parser meets it whatever the api now
   // refuses to create.
   //
@@ -117,6 +133,392 @@
     // `messageSchema.user` (`z.string().min(1)`) does not, so the two paths differ in
     // what they can express and agree on the decision: never invent a sender.
     expect(payload.user).toBeNull();
     expect(JSON.stringify(payload)).not.toContain("user_id");
   });
 });
+
+// The second and third event types FR-WHK-02 names, and the boundary
+// that decides what a customer's webhook can contain.
+
+const MEMBERSHIP = {
+  channel_id: "ce419dc5-b06e-441c-ab38-49451f87210e",
+  user: "tuan",
+};
+
+/** A tombstone as a consumer receives it. No `text` key — that is
+ * FR-020, and `strictObject` refuses one. */
+const DELETED = {
+  id: MESSAGE.id,
+  channel_id: MESSAGE.channel_id,
+  seq: MESSAGE.seq,
+  user: MESSAGE.user,
+  deleted_at: "2026-09-03T09:15:00.000Z",
+};
+
+describe("the outbox event type set", () => {
+  // ASSERTED AS A SET AND AS A COUNT, which is the presence chapter's `codes.test.ts`
+  // precedent: either alone lets a fourth type arrive unnoticed. FR-WHK-02 names
+  // eight and FIVE exist as of this chapter; the other three arrive with the features
+  // that can produce them.
+  //
+  // THE ORDER IS THE ARRAY'S, and the two new names sit beside `message.created`
+  // rather than at the end — they are the same domain, and `toEqual` on an array is
+  // order-sensitive, so this assertion is also a claim about how the source reads.
+  it("is exactly the five types that have producers", () => {
+    expect([...OUTBOX_EVENT_TYPES]).toEqual([
+      "message.created",
+      "message.updated",
+      "message.deleted",
+      "channel.member_added",
+      "channel.member_removed",
+    ]);
+    expect(OUTBOX_EVENT_TYPES).toHaveLength(5);
+  });
+
+  it("gives every type a subject without a mapping entry", () => {
+    // `subjectFor` abbreviates a domain only when DOMAIN_ABBREVIATION has it, so
+    // `channel` passes through unchanged. Checked rather than assumed: a type whose
+    // subject form is not its dotted name would need an entry, and the absence of a
+    // failure here is what says these two do not.
+    expect(subjectFor("channel.member_added", ENV)).toBe(
+      `events.channel.member_added.${ENV}`,
+    );
+    expect(subjectFor("channel.member_removed", ENV)).toBe(
+      `events.channel.member_removed.${ENV}`,
+    );
+  });
+});
+
+describe("messageUpdatedEvent and messageDeletedEvent", () => {
+  /** A creation built HERE, because `build` two describes up is out of scope — and the
+   * comparison below needs both events from one place to mean anything. */
+  const created = () =>
+    messageCreatedEvent({
+      eventId: "8f14e45f-ceea-4f6a-9b2c-1d2e3f4a5b6c",
+      environmentId: ENV,
+      message: MESSAGE,
+    });
+
+  const updated = () =>
+    messageUpdatedEvent({
+      eventId: "9c26f1a2-0000-4000-8000-000000000003",
+      environmentId: ENV,
+      occurredAt: "2026-09-03T09:15:00.000Z",
+      message: MESSAGE,
+    });
+  const deleted = () =>
+    messageDeletedEvent({
+      eventId: "9c26f1a2-0000-4000-8000-000000000004",
+      environmentId: ENV,
+      occurredAt: "2026-09-03T09:15:00.000Z",
+      message: DELETED,
+    });
+
+  it("spells both types as FR-WHK-02 spells them", () => {
+    expect(updated().payload.type).toBe("message.updated");
+    expect(deleted().payload.type).toBe("message.deleted");
+    expect(updated().subject).toBe(`events.msg.updated.${ENV}`);
+    expect(deleted().subject).toBe(`events.msg.deleted.${ENV}`);
+  });
+
+  it("leaves the edit's payload identical to a creation's (FR-008a, FR-015)", () => {
+    // FR-008a in one assertion: *"The message payload used by creation and edit events
+    // MUST be left unchanged."* Compared as SETS, so a field added to one and not the
+    // other fails here rather than in a customer's consumer.
+    //
+    // SEVEN SINCE THIS CHAPTER, and both events gained the field together because both
+    // are built from one `MessageCreatedData` — which is FR-015 as a type rather than a
+    // promise.
+    expect(Object.keys(updated().payload.data).sort()).toEqual([
+      "attachments",
+      "channel_id",
+      "created_at",
+      "id",
+      "seq",
+      "text",
+      "user",
+    ]);
+    // AND THE TWO SETS ARE THE SAME SET, which is what FR-015 actually asks. Comparing
+    // each against a literal leaves them free to drift together.
+    expect(Object.keys(updated().payload.data).sort()).toEqual(
+      Object.keys(created().payload.data).sort(),
+    );
+  });
+
+  it("carries the attachments themselves, in order, on both (FR-006)", () => {
+    // KEY SETS CANNOT SEE VALUES. Two payloads both carrying `[]` have identical key
+    // sets, so the set comparison above answers FR-015's "one shape" and says nothing
+    // about FR-006's "in the order they were submitted" — which holds on every path that
+    // returns a message, and a consumer's webhook is one.
+    const expected = ["https://example.test/one.png", "https://example.test/two.mp3"];
+    for (const [label, event] of [
+      ["created", created()],
+      ["updated", updated()],
+    ] as const) {
+      const data = event.payload.data as { attachments: Array<{ url: string }> };
+      expect(data.attachments.map((a) => a.url), label).toEqual(expected);
+    }
+  });
+
+  it("gives the deletion NO text key at all (FR-020)", () => {
+    // NOT `text: null` — a key that can hold the words somebody asked to have removed
+    // is a key somebody can forget to null. The exact set is the assertion.
+    const keys = Object.keys(deleted().payload.data).sort();
+    expect(keys).toEqual(["channel_id", "deleted_at", "id", "seq", "user"]);
+    expect(keys).not.toContain("text");
+  });
+
+  it("carries the edit's own instant, not the message's created_at", () => {
+    // The one place the edit event diverges from the creation event, and it has to: an
+    // event whose `occurred_at` predates the previous event about the same message
+    // cannot be ordered by a consumer.
+    expect(updated().payload.occurred_at).toBe("2026-09-03T09:15:00.000Z");
+    expect(updated().payload.occurred_at).not.toBe(MESSAGE.created_at);
+  });
+
+  it("refuses an event with no id and an event with no environment", () => {
+    // Refused rather than defaulted, like every other builder here: an event with no
+    // deduplication key looks deliverable and cannot be deduplicated.
+    for (const build of [messageUpdatedEvent, messageDeletedEvent]) {
+      expect(() =>
+        // @ts-expect-error the point of the test
+        build({ eventId: "", environmentId: ENV, occurredAt: "x", message: MESSAGE }),
+      ).toThrow("event id");
+      expect(() =>
+        // @ts-expect-error the point of the test
+        build({ eventId: "id", environmentId: "", occurredAt: "x", message: MESSAGE }),
+      ).toThrow("environment id");
+    }
+  });
+
+  it("round-trips both through the consumer's schema", () => {
+    // The producer and the consumer are two shapes of one contract. Without this, the
+    // union branches added in this chapter would be checked only against fixtures this
+    // file writes — and `consumer/runtime.ts` answers a failed parse with
+    // `message.term()`, which stops redelivery for good.
+    expect(outboxEventSchema.safeParse(updated().payload).success).toBe(true);
+    expect(outboxEventSchema.safeParse(deleted().payload).success).toBe(true);
+  });
+
+  it("refuses a deletion that carries a text, through the consumer's schema", () => {
+    const withText = {
+      ...deleted().payload,
+      data: { ...DELETED, text: "should not be here" },
+    };
+    expect(outboxEventSchema.safeParse(withText).success).toBe(false);
+  });
+});
+
+describe("membershipEvent", () => {
+  const build = (change: "added" | "removed") =>
+    membershipEvent({
+      eventId: "9c26f1a2-0000-4000-8000-000000000001",
+      environmentId: ENV,
+      change,
+      occurredAt: "2026-08-30T09:15:00.000Z",
+      membership: MEMBERSHIP,
+    });
+
+  it("spells the type as FR-WHK-02 spells it, per direction", () => {
+    expect(build("added").payload.type).toBe("channel.member_added");
+    expect(build("removed").payload.type).toBe("channel.member_removed");
+  });
+
+  it("puts the direction in the TYPE and not in a field", () => {
+    // The wire frame carries `change`; this does not. A customer subscribing to
+    // removals selects one type and receives nothing else, which is what FR-WHK-02
+    // spelling two names rather than one buys.
+    expect(Object.keys(build("added").payload.data).sort()).toEqual([
+      "channel_id",
+      "user",
+    ]);
+  });
+
+  it("carries the same five envelope fields the message event does", () => {
+    const { payload } = build("removed");
+    expect(Object.keys(payload).sort()).toEqual([
+      "data",
+      "environment_id",
+      "id",
+      "occurred_at",
+      "type",
+    ]);
+  });
+
+  it("takes occurred_at from the caller, never from the clock", () => {
+    // A republished event must be byte-identical to its first attempt: the
+    // deduplication key a consumer sees after a crash is the one it would have
+    // seen without one.
+    expect(build("added").payload.occurred_at).toBe("2026-08-30T09:15:00.000Z");
+  });
+
+  it("refuses a missing event id, environment id, or external id", () => {
+    const ok = {
+      eventId: "9c26f1a2-0000-4000-8000-000000000001",
+      environmentId: ENV,
+      change: "added" as const,
+      occurredAt: "2026-08-30T09:15:00.000Z",
+      membership: MEMBERSHIP,
+    };
+    expect(() => membershipEvent({ ...ok, eventId: "" })).toThrow(/event id/);
+    expect(() => membershipEvent({ ...ok, environmentId: "" })).toThrow(
+      /environment id/,
+    );
+    // THE THIRD REFUSAL IS THIS CHAPTER'S. An absent external id is refused for the
+    // reason the other two are — a defaulted one is undetectable — and for one more:
+    // the repository methods that build this event hold `users.id`, and a type alone
+    // cannot stop `String(user.id)` being handed over.
+    expect(() =>
+      membershipEvent({ ...ok, membership: { ...MEMBERSHIP, user: "" } }),
+    ).toThrow(/external id/);
+  });
+
+  it("carries an external id where a customer reads one, never a uuid", () => {
+    // `MessageCreatedData` fixes this boundary in its own comment and this event
+    // sits behind the same one. A uuid here is invisible until a customer opens
+    // their webhook payload, which is why the shape is asserted rather than trusted.
+    const { payload } = build("removed");
+    const data = payload.data as { user: string };
+    expect(data.user).toBe("tuan");
+    expect(data.user).not.toMatch(
+      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
+    );
+  });
+});
+
+describe("outboxEventSchema — what a CONSUMER will accept", () => {
+  const envelope = {
+    id: "9c26f1a2-0000-4000-8000-000000000001",
+    environment_id: ENV,
+    occurred_at: "2026-08-30T09:15:00.000Z",
+  };
+
+  // THE TEST THIS CHAPTER EXISTS TO HAVE WRITTEN. Until it was, the schema was
+  // `z.literal("message.created")` and the consumer answers a failed parse with
+  // `message.term()` — redelivery stopped for good. Every membership event would
+  // have been destroyed there, in a lane that runs the consumer switched off.
+  it("accepts every type the producer can build", () => {
+    // A LOOKUP RATHER THAN A TERNARY, because the revisions chapter made the shapes three: a
+    // creation and an edit carry a `Message` (FR-008a), a deletion carries an identity
+    // with no text (FR-020), and a membership change carries neither. The ternary's
+    // `else` branch would have handed the membership shape to `message.deleted` and
+    // reported a schema failure as though the schema were wrong.
+    const dataFor: Record<(typeof OUTBOX_EVENT_TYPES)[number], unknown> = {
+      "message.created": MESSAGE,
+      "message.updated": MESSAGE,
+      "message.deleted": DELETED,
+      "channel.member_added": { channel_id: MEMBERSHIP.channel_id, user: MEMBERSHIP.user },
+      "channel.member_removed": { channel_id: MEMBERSHIP.channel_id, user: MEMBERSHIP.user },
+    };
+    for (const type of OUTBOX_EVENT_TYPES) {
+      const result = outboxEventSchema.safeParse({
+        ...envelope,
+        type,
+        data: dataFor[type],
+      });
+      expect(result.success, `${type} must parse`).toBe(true);
+    }
+  });
+
+  it("round-trips what membershipEvent produces", () => {
+    // The producer and the consumer are two shapes of one contract, and only a
+    // test that hands one to the other checks that they agree.
+    for (const change of ["added", "removed"] as const) {
+      const { payload } = membershipEvent({
+        eventId: "9c26f1a2-0000-4000-8000-000000000002",
+        environmentId: ENV,
+        change,
+        occurredAt: "2026-08-30T09:15:00.000Z",
+        membership: MEMBERSHIP,
+      });
+      expect(outboxEventSchema.safeParse(payload).success).toBe(true);
+    }
+  });
+
+  it.each(["message.created", "message.updated"] as const)(
+    "reads a %s written before this chapter and yields an empty list (FR-007)",
+    (type) => {
+      // THE EVENT SPINE IS DURABLE, so on the deploy that ships this chapter the
+      // consumer reads bytes the previous binary wrote — and those have no
+      // `attachments` key at all. `consumer/runtime.ts` answers a failed parse with
+      // `message.term()`, which stops redelivery for good, so a required field here is
+      // not a stricter contract; it is every in-flight event of these two types
+      // destroyed. Six tests in `consumer.itest.ts` went red on exactly this, and the
+      // close-out coverage lane is what ran them.
+      // DELETED, NOT SET TO `undefined`. A key whose value is `undefined` survives
+      // `JSON.stringify` as no key at all, but it is not the same object here, and
+      // `.default([])` fires on an ABSENT key — which is the distinction this whole
+      // chapter is about. A rest-destructure would need a binding for the discarded
+      // half, and this repository's eslint has no ignore pattern for one.
+      const before: Record<string, unknown> = { ...MESSAGE };
+      delete before["attachments"];
+      const result = outboxEventSchema.safeParse({ ...envelope, type, data: before });
+      expect(result.success).toBe(true);
+      if (result.success) {
+        // Not absent, and not null. The same answer every read path in this chapter
+        // gives for a message with none.
+        expect(result.data.data).toHaveProperty("attachments", []);
+      }
+    },
+  );
+
+  it("still refuses an attachments value that is not a list", () => {
+    // `.default([])` tolerates an ABSENT key and nothing else. A producer that writes
+    // the field wrongly is still terminated, which is the half of the requirement the
+    // tolerance must not take with it.
+    const result = outboxEventSchema.safeParse({
+      ...envelope,
+      type: "message.created",
+      data: { ...MESSAGE, attachments: "none" },
+    });
+    expect(result.success).toBe(false);
+  });
+
+  it("still rejects an unknown type and a mismatched data shape", () => {
+    // The union widened; it did not become permissive. A type nothing produces is
+    // still terminated, which is the behaviour the consumer's comment describes.
+    expect(
+      outboxEventSchema.safeParse({ ...envelope, type: "user.connected", data: {} })
+        .success,
+    ).toBe(false);
+    // And a membership envelope carrying message data is refused, which is what
+    // `discriminatedUnion` buys over a loosened `type`.
+    expect(
+      outboxEventSchema.safeParse({
+        ...envelope,
+        type: "channel.member_added",
+        data: MESSAGE,
+      }).success,
+    ).toBe(false);
+  });
+});
+
+describe("the declared set and the emitted set", () => {
+  // TWO LISTS THAT MUST AGREE, AND THIS IS THE THING COMPARING THEM. FR-WHK-02 declares
+  // eight event types and this platform emits five; the only connection between
+  // `WEBHOOK_EVENT_TYPES` and `OUTBOX_EVENT_TYPES` was somebody remembering, which is
+  // the defect this repository has recorded more often than any other.
+  //
+  // BOTH DIRECTIONS, because each catches a different mistake. A type marked
+  // `emitted: true` and absent from the array is a producer that does not exist; an
+  // array member missing from the declared set is an event this platform sends and no
+  // subscription may name.
+  const emitted = Object.entries(WEBHOOK_EVENT_TYPES)
+    .filter(([, v]) => v.emitted)
+    .map(([k]) => k)
+    .sort();
+
+  it("declares every type it emits, and emits every type it declares as emitted", () => {
+    expect(emitted).toEqual([...OUTBOX_EVENT_TYPES].sort());
+  });
+
+  it("declares more than it emits, which is the whole reason the flag exists", () => {
+    // A POSITIVE CONTROL FOR THE ASSERTION ABOVE. If the two sets were identical the
+    // agreement test would pass against a `WEBHOOK_EVENT_TYPES` with no `emitted: false`
+    // member at all — and the flag it is built on would be dead weight nobody noticed.
+    const declared = Object.keys(WEBHOOK_EVENT_TYPES);
+    expect(declared.length).toBeGreaterThan(emitted.length);
+    expect(declared).toContain("channel.created");
+    expect(WEBHOOK_EVENT_TYPES["channel.created"].emitted).toBe(false);
+  });
+});
```

### `packages/protocol/src/codes.ts` — the error registry, fenced by twelve chapters — the deepest chain but one in the series.

145 differing lines, 4 hunks.

```diff title="packages/protocol/src/codes.ts"
@@ -203,30 +203,32 @@
    *
    * §4.14 REPLACES THE ARM RATHER THAN THIS CODE. When hosted media ships, the
    * `{ type: "media" }` arm starts accepting and this entry describes a state the
    * platform no longer has — at which point it is deleted, not repurposed. */
   media_not_available:
     "hosted media is not available yet; attach an http or https url instead",
-  not_found:
-    "no such resource for this tenant — and DELIBERATELY the same answer as for a resource in another tenant (FR-TEN-05)",
-  internal_error:
-    "the platform failed in a way it did not anticipate; the request_id is what a support ticket needs",
-
-  // FR-CHN-07's ceiling: a channel holds at most 1,000 members and an add that would
-  // cross it is refused with 422 and this code.
-  //
-  // The SRS names this code in its own worked example for EIR-API-04, which is why it is
-  // spelled this way rather than `member_limit_exceeded` — the document got there first
-  // and an integrating developer will have read it.
+  // ── THE WEBHOOK REFUSALS (THIS CHAPTER) ─────────────────────────────────────
   //
-  // NOT `quota_exceeded`. That is a monthly, billable, resets-on-a-date refusal whose
-  // message promises a resume date; this is a structural limit on one channel that no
-  // amount of waiting changes. Same status, different fact, and a client that retries on
-  // the wrong one waits for ever.
-  channel_member_limit_exceeded:
-    "this channel already holds the maximum number of members; remove one before adding another",
+  // FIVE CODES THE ERROR REFERENCE ALREADY PUBLISHED AND THIS REGISTRY DID NOT HAVE.
+  // `docs/08-error-reference.md` carries a section for each — status, retryability and
+  // the field — and `webhooks.service.ts` threw a bare `UnprocessableEntityException`
+  // for every one of them. `ProtocolErrorFilter` derives a code from the status for
+  // 400, 401, 403 and 404 only, so all five went out as:
+  //
+  //     {"code":"internal_error","docs_url":".../internal_error",
+  //      "message":"url must use https — a signature over a plaintext channel …"}
+  //
+  // Measured on this tree, not inferred: the status was right, the message was right,
+  // and the code told the client the server had broken. `webhooks.itest.ts` asserted
+  // the status and the message text and passed straight through it, which is why this
+  // survived — only the code could have caught it.
+  //
+  // THE VOCABULARY WAS NOT INVENTED HERE. The reference decided it; this is the
+  // registry catching up, which is the direction `check-error-codes` cannot check
+  // (it reads the built `dist` against the docs and counts, so a code documented and
+  // unregistered looks like a code nobody has written a section for).
   // THE CONNECTION-METERING CHAPTER'S. A connection belongs to one environment for
   // its lifetime, and a second report naming a different one is a bug in the reporter
   // rather than a state to reconcile — so it is refused rather than absorbed.
   //
   // IT ARRIVES WITH ITS THROWER, AND IN PUBLISHED IT DID NOT. There the error registry
   // came a chapter LATER and hardened this filter at the same time it added this code,
@@ -257,12 +259,45 @@
   // the dimension, the figures and the resume date, because a close reason is a short
   // string with nowhere to put them. ONE entry rather than two: the quota chapter
   // registered this and the metering chapter's port arrived registering it again, and
   // a duplicate key is a `codes.test.ts` failure rather than a second meaning.
   quota_exceeded:
     "a monthly quota is exhausted; the message names the dimension, the figures and the date it resumes",
+  webhook_endpoint_limit_reached:
+    "this environment already holds the maximum number of webhook endpoints; delete one, or use another environment",
+  webhook_url_invalid: "the url is not a valid absolute URL — send scheme, host and path",
+  webhook_url_insecure:
+    "the url must use https; a signature over a plaintext channel protects the body, not the reader",
+  webhook_url_private_address:
+    "the url points at a loopback, link-local or private address, which this platform will not deliver to",
+  // DOCUMENTED SINCE THIS CHAPTER'S OWN REFERENCE PAGE AND UNREGISTERED UNTIL NOW, which
+  // is the pair of defects one file held at once: five codes documented and unregistered,
+  // and this one documented with nothing to emit it. `check:errors` compares the registry
+  // with the sections and is satisfied by both being present — it cannot ask whether any
+  // code path constructs the refusal.
+  webhook_event_type_unknown:
+    "that event type is not one this platform declares; the message names the accepted set",
+  webhook_event_types_empty: "event_types must list at least one event type",
+  not_found:
+    "no such resource for this tenant — and DELIBERATELY the same answer as for a resource in another tenant (FR-TEN-05)",
+  internal_error:
+    "the platform failed in a way it did not anticipate; the request_id is what a support ticket needs",
+
+  // FR-CHN-07's ceiling: a channel holds at most 1,000 members and an add that would
+  // cross it is refused with 422 and this code.
+  //
+  // The SRS names this code in its own worked example for EIR-API-04, which is why it is
+  // spelled this way rather than `member_limit_exceeded` — the document got there first
+  // and an integrating developer will have read it.
+  //
+  // NOT `quota_exceeded`. That is a monthly, billable, resets-on-a-date refusal whose
+  // message promises a resume date; this is a structural limit on one channel that no
+  // amount of waiting changes. Same status, different fact, and a client that retries on
+  // the wrong one waits for ever.
+  channel_member_limit_exceeded:
+    "this channel already holds the maximum number of members; remove one before adding another",
     // FR-RTM-09, and the socket's half of the connection cap: an error frame carrying
     // the limit and the count, sent immediately before close 4004.
     //
     // THE FIGURES GO IN THE MESSAGE, not in payload fields. `errorFrameSchema` is a
     // `z.strictObject` of `code`, `message`, `docs_url` and an optional `field`, so two
     // new fields would mean widening a shape every error frame shares for one code's
@@ -281,12 +316,55 @@
   //
   // REGISTERED RATHER THAN WRITTEN INLINE, and the entry is above beside the REST
   // half. The frame schema types `code` as `z.string().min(1)`, so nothing forces it —
   // but the registry is the documented vocabulary and `codes.test.ts` enforces its
   // uniqueness, which is why the credentials chapter put `wrong_credential_type` in it
   // instead of inventing it at the call site.
+
+  // THE REFUSAL BESIDE `wrong_credential_type`, ONE DIMENSION OVER: the class
+  // presented is RIGHT and the service is not. Two platform credentials exist — the
+  // dispatcher's and the gateway's — and until this chapter a route could say which
+  // CLASS may call it and not which SERVICE, so the gateway's credential reached
+  // `POST /internal/dispatch/replay`.
+  //
+  // NOT `forbidden`. The credentials chapter made this argument when it added
+  // `wrong_credential_type` rather than answering a wrong-credential mistake with a
+  // generic 403: the response has to say what actually happened, and "you lack a
+  // permission" is a different fact from "that credential belongs to another
+  // service". The MESSAGE names the service and the permitted set and never the
+  // credential — a service name is a deployment label, a credential is a secret
+  // (NFR-SEC-06).
+  wrong_credential_service:
+    "the credential's service is not permitted on this route; the message names the service presented and the services allowed",
+
+  // THE FIRST 503 IN THIS REGISTRY, AND THE FIRST CODE THAT NAMES A SUBSYSTEM RATHER THAN
+  // A MISTAKE (chapter 4.8, FR-ANL-07, FR-025).
+  //
+  // The request log reads the analytical store, and constitution III's second clause is a
+  // MUST about exactly this: *"failure or backlog of the analytical pipeline MUST NOT
+  // affect message delivery, real-time fan-out, or API availability."* The api being up
+  // while this one surface is not is the distinction that clause turns on — so the refusal
+  // has to be explicit. An empty page would be a claim about the TENANT: that they made no
+  // requests. This is a claim about the PLATFORM.
+  //
+  // NAMED FOR WHAT A CLIENT DOES ABOUT IT, which is the test this registry sets on itself
+  // — its own note above argues three refusals apart because "a client acts on them
+  // differently". `analytics_unavailable` says which subsystem is out and that the request
+  // is worth retrying. `internal_error` would say neither, and `unauthorized` would say
+  // something false.
+  //
+  // AND THE MESSAGE NEVER CARRIES THE STORE'S ANSWER. `Code: 159. DB::Exception: Timeout
+  // exceeded: elapsed 1000.343075 ms, maximum: 1000 ms` is infrastructure detail, and a
+  // refusal that carries it puts a ClickHouse error string in a customer's support ticket
+  // — the argument this file already makes about credentials (NFR-SEC-06).
+  //
+  // ONLY FOR A STORE THAT DID NOT ANSWER. A 404 or a syntax error from ClickHouse means
+  // the PLATFORM's statement is wrong, and telling a customer to retry a query that will
+  // never work is worse than telling them nothing. Those stay `internal_error`.
+  analytics_unavailable:
+    "the analytics service did not answer in time; the rest of the API is unaffected and this request is worth retrying",
 } as const;
 
 export type ErrorCode = keyof typeof ERROR_CODES;
 
 /** Whether a string the api sent is a code this registry defines.
  *
@@ -313,12 +391,39 @@
  * THE CODE IS THE ANCHOR, VERBATIM. No slug transform, no case change, no separator
  * swap — the reference's headings ARE the codes. A transform here is a second
  * vocabulary to keep in step with the first, and the registry already IS the
  * vocabulary.
  *
  * The host stays a placeholder until the docs site exists. What stops being a
- * placeholder is the NUMBER OF PLACES that have to change when it does: one. */
-export const ERROR_DOCS_BASE = "https://relay.example/docs/errors";
+ * placeholder is the NUMBER OF PLACES that have to change when it does: one.
+ *
+ * ── AN ANCHOR, NOT A PATH, AND THE REFERENCE IS WHY ──────────────────────────────
+ *
+ * This was `${base}/${code}`, and `docs/08-error-reference.md` is ONE document with
+ * `## <code>` headings. So every `docs_url` this platform has ever sent named a page
+ * that does not exist — 27 codes, 27 dead links, and the error reference sitting there
+ * with an anchor for each one.
+ *
+ * NOTHING COULD CATCH IT, because the function and its test were written together. The
+ * error-registry chapter shipped `it("appends the code VERBATIM — no slug transform, no
+ * case change")` asserting the path form, so the test agreed with the defect and went
+ * green on it for twenty-two chapters. A test written beside the code it tests inherits
+ * the code's assumptions; the reference document is the only thing that could have
+ * disagreed, and no instrument reads it.
+ *
+ * PARTS 1 AND 2 STILL TEACH THE PATH FORM and are not renumbered by this work. That is
+ * deliberate rather than overlooked: they publish `docs/errors/not_found` at a point
+ * where there is no reference document to anchor into, and this chapter is where a
+ * reader sees it corrected — which is also where the platform stops sending it.
+ *
+ * ── AND THE BASE IS READ PER CALL ────────────────────────────────────────────────
+ *
+ * `RELAY_DOCS_BASE_URL` at call time, not at import. A `const` evaluated when the module
+ * is first loaded cannot be changed by a test that sets the variable in `beforeAll`, and
+ * a preview deployment cannot point its error links at its own docs. One env read per
+ * refusal is not a cost anything can measure. */
+export const DEFAULT_DOCS_BASE_URL = "https://relay.example/docs/error-reference";
 
 export function docsUrl(code: ErrorCode): string {
-  return `${ERROR_DOCS_BASE}/${code}`;
+  const base = process.env["RELAY_DOCS_BASE_URL"] ?? DEFAULT_DOCS_BASE_URL;
+  return `${base}#${code}`;
 }
```

### `services/api/src/isolation/targets.ts` — the gauntlet's derived target list, which grows with every route the platform adds.

118 differing lines, 4 hunks.

```diff title="services/api/src/isolation/targets.ts"
@@ -124,12 +124,17 @@
   {
     method: "GET",
     path: "/v1/users/:externalId/channels",
     accepts: "application",
     shape: "list",
   },
+  // THE ENDPOINT LISTING. A `list` for the same reason: its refusal is an
+  // EMPTY page, not an error. There is no identifier in the path at all — the tenant
+  // comes from the key — so what the attack shows is that a key for one environment
+  // sees none of another's endpoints in a 200.
+  { method: "GET", path: "/v1/webhooks", accepts: "application", shape: "list" },
 
   // The bulk upsert and the deletion. Both `write`: the upsert's attack is
   // an entry naming another tenant's user, which must create a NEW row in the caller's
   // environment rather than touch theirs; the deletion's is a foreign external id, which
   // must answer 404 and leave the other tenant's user alive.
   { method: "POST", path: "/v1/users", accepts: "application", shape: "write" },
@@ -191,12 +196,13 @@
   {
     method: "GET",
     path: "/v1/channels/:channelId/messages",
     accepts: "either",
     shape: "read",
   },
+  { method: "GET", path: "/v1/webhooks/:id", accepts: "application", shape: "read" },
   // THE REVISIONS CHAPTER'S EDIT HISTORY (T033h, FR-023, FR-023a). `accepts: "application"`
   // because the route carries a method-level `@Accepts("application")` that narrows the
   // controller's class-level `("application", "user")` — FR-MOD-01 names the audience,
   // and nothing in the SRS asks for an end-user surface on what a message used to say.
   //
   // THE TWO VALUES MUST AGREE AND NOTHING COMPARES THEM. This entry and the decorator
@@ -272,12 +278,33 @@
   { method: "POST", path: "/v1/channels/:channelId/join", accepts: "user", shape: "write" },
   { method: "POST", path: "/v1/channels/:channelId/members/remove", accepts: "application", shape: "write" },
   { method: "PATCH", path: "/v1/channels/:channelId/members/:userExternalId", accepts: "application", shape: "write" },
   { method: "POST", path: "/v1/channels/:channelId/archive", accepts: "application", shape: "write" },
   { method: "DELETE", path: "/v1/channels/:channelId/archive", accepts: "application", shape: "write" },
 
+  // ── the webhook surface (this chapter), and the derivation named all seven ─────
+  //
+  // ELEVEN ROUTES ARRIVED AND THE LEDGER SAID SIX. This chapter's rows were deferred
+  // from the harness chapter by a note that counted the `/v1/webhooks*` paths and not
+  // the internal seam beneath them; `targets.itest.ts` went red naming eleven, which is
+  // the third time a count in this feature's own records has been low and the first time
+  // the instrument corrected it rather than a reader.
+  //
+  // ALL `application` AND NONE `either`. A webhook endpoint is customer CONFIGURATION —
+  // FR-WHK-01 gives them to an environment, not to a person — and `WebhooksController`
+  // declares `@Accepts("application")` for the whole class. A `"user"` here would send
+  // the gauntlet at these routes with a token the guard refuses at the door.
+  { method: "POST", path: "/v1/webhooks", accepts: "application", shape: "write" },
+  { method: "POST", path: "/v1/webhooks/:id/rotate-secret", accepts: "application", shape: "write" },
+  { method: "POST", path: "/v1/webhooks/:id/enable", accepts: "application", shape: "write" },
+  { method: "POST", path: "/v1/webhooks/:id/disable", accepts: "application", shape: "write" },
+  // AND THE SYNTHETIC TEST EVENT, which the derivation named on the build that added
+  // it — the fifth time in this repository and the second in two chapters.
+  { method: "POST", path: "/v1/webhooks/:id/test", accepts: "application", shape: "write" },
+  { method: "DELETE", path: "/v1/webhooks/:id", accepts: "application", shape: "write" },
+
   // ── the internal surface: an end-user token, so a FOREIGN CREDENTIAL is the attack
   { method: "POST", path: "/internal/messages", accepts: "user", shape: "write" },
   { method: "POST", path: "/internal/backfill", accepts: "user", shape: "write" },
   {
     // NOT A `write`, AND THE DIFFERENCE IS THE WHOLE POINT OF HAVING SHAPES. This route
     // takes no body and no path parameter: there is no identifier to forge, so a
@@ -287,12 +314,103 @@
     method: "POST",
     path: "/internal/session",
     accepts: "user",
     shape: "credential",
   },
 
+  // ── write, internal, PLATFORM credential: it carries no environment ──────────
+  //
+  // THE FIRST ROUTES IN THIS LIST THAT TAKE `platform`, and the class exists for exactly
+  // this: one dispatcher serves every tenant, so its credential resolves to no
+  // environment and a FOREIGN CREDENTIAL cannot be forged for it. What the attack has to
+  // show instead is that a request naming one environment with an identifier from
+  // another is refused on the row rather than on the caller — the tenant comes from the
+  // delivery, and the delivery knows which environment it belongs to.
+  //
+  // A `write` SHAPE ALONE CANNOT TELL THOSE APART, which is the sentence at the top of
+  // this file, written before any route needed it.
+  { method: "POST", path: "/internal/dispatch/expand", accepts: "platform", shape: "write" },
+  //
+  // AND THREE OF THE FOUR ARE `exempt`, WHICH PUBLISHED PART 3 CLASSIFIED `write` AND
+  // NEVER ATTACKED. Only `expand` names an environment ALONGSIDE an identifier, so only
+  // `expand` can be told to act on one tenant while carrying something from another.
+  // `material`, `outcome` and `replay` take a single opaque delivery id and DERIVE the
+  // environment from the row they find: there is no cross-environment request to make,
+  // because the caller never says which environment it means.
+  //
+  // That is not an attack this suite declines to write. It is the absence of the
+  // parameter an attack would forge — and `exempt` with a reason is how this list says
+  // so, where `write` with no attack says nothing and reads as an oversight. The
+  // accounting test at the foot of `gauntlet.itest.ts` is what turned the difference
+  // into a failure.
+  //
+  // WHAT GUARDS THEM IS THE CREDENTIAL AND NOTHING ELSE, which is why `material` — the
+  // one response in this platform that returns a decrypted customer secret — is the
+  // route to read first if a platform credential ever leaks.
+  {
+    method: "POST",
+    path: "/internal/dispatch/material",
+    accepts: "platform",
+    shape: "exempt",
+    because:
+      "one opaque delivery id and no environment parameter: the tenant comes from the row, so a cross-environment request cannot be expressed. Returns a decrypted secret, and the credential is its only guard.",
+  },
+  {
+    method: "POST",
+    path: "/internal/dispatch/outcome",
+    accepts: "platform",
+    shape: "exempt",
+    because:
+      "one opaque delivery id and no environment parameter, as `material` above: there is no foreign identifier to pair with a named tenant.",
+  },
+  {
+    method: "POST",
+    path: "/internal/dispatch/replay",
+    accepts: "platform",
+    shape: "exempt",
+    because:
+      "one opaque delivery id and no environment parameter, as `material` above: there is no foreign identifier to pair with a named tenant.",
+  },
+
+  //
+  // AND THE METERING CHAPTER'S REPORT, `write` FOR `expand`'S REASON. It names an
+  // environment alongside a connection id, so a request can claim one tenant's
+  // connection for another's bill — and that is refused on the ROW, because the caller
+  // is the platform and reaching every tenant is what a platform credential is for.
+  //
+  // The derivation found this route unclassified on the build that added it. That is
+  // the sixth time in this repository, and the list has never once been ahead of it.
+  { method: "POST", path: "/internal/usage/connections", accepts: "platform", shape: "write" },
+
+  // ── THE REQUEST LOG (chapter 4.8, FR-ANL-07), AND THE DERIVATION FOUND IT FIRST ──
+  //
+  // Run before this entry existed: `43 derived, 36 attacked, 6 exempt` with
+  // `unclassified: ["GET /v1/request-log"]` and `CLASSIFICATIONS.length` 42 against 43.
+  // That is the seventh time in this repository, and the list has still never been ahead
+  // of the derivation. The classification is what changed in answer to it, never the
+  // derivation.
+  //
+  // `list` AND NOT `read`, AND `GET /v1/webhooks` IS THE PRECEDENT WORD FOR WORD: *"There
+  // is no identifier in the path at all — the tenant comes from the key — so what the
+  // attack shows is that a key for one environment sees none of another's endpoints in a
+  // 200."* Substitute "requests" for "endpoints" and the sentence is this route's. The
+  // refusal that matters here is an EMPTY PAGE rather than an error, because there is
+  // nothing in the path to forge a 404 out of.
+  //
+  // AND THE ISOLATION CLAIM IS STRONGER HERE THAN ON ANY OTHER `list`. 60.5% of this
+  // table has no tenant at all, so the attack has two things to show rather than one: no
+  // row from another environment appears in a 200, and no TENANTLESS row does either.
+  // They are unreachable from every tenant's query because they carry no tenant to match,
+  // which is chapter 4.4's reading of constitution I as a test rather than as an argument.
+  //
+  // `accepts: "application"` MATCHES THE DECORATOR AND THE TWO ARE NOT COMPARED BY
+  // ANYTHING. The controller declares `@Accepts("application")`; this field tells the
+  // gauntlet which credential to attack with, so a `"user"` here would send it at the
+  // route with a token the guard refuses at the door and the handler would never run.
+  { method: "GET", path: "/v1/request-log", accepts: "application", shape: "list" },
+
   // ── credential, internal, end-user token ─────────────────────────────────────
   //
   // `credential` AND NOT `read`, WHICH IS THE SIBLING ROUTE'S ARGUMENT VERBATIM. The
   // backstop asks what this connection may hear and changes nothing, so `read` is the
   // tempting shape — but a `read` attack forges an IDENTIFIER, and this route takes
   // none: no body, no path parameter, no query. Its only tenant-scoped input is the
```

### `services/api/src/auth/credential.guard.ts` — the credential guard, after the request-log stamp joined it in Part 4.

101 differing lines, 3 hunks.

```diff title="services/api/src/auth/credential.guard.ts"
@@ -6,32 +6,66 @@
   UnauthorizedException,
   type CanActivate,
   type ExecutionContext,
 } from "@nestjs/common";
 import { Reflector } from "@nestjs/core";
 
+import { REFUSED_AT } from "../request-log/event";
+
+import type { PlatformService } from "./authenticate.middleware";
 import {
   describePrincipalKind,
   OVER_AUTH_THRESHOLD,
-  type PrincipalKind,
   type RequestWithPrincipal,
 } from "./principal";
 
 const ACCEPTS = "relay:accepts";
 
-/** What a route accepts, declared on the route (research R6). The default is
- * "either class", so a handler only says something when it is narrower than
- * that — and the narrow cases are the interesting ones: FR-AUT-09's dev-token
- * endpoint and FR-AUT-10's administrative operations want an API key
- * specifically, not merely a valid credential. */
-export const Accepts = (...kinds: PrincipalKind[]) => SetMetadata(ACCEPTS, kinds);
-
-const EITHER: PrincipalKind[] = ["application", "user"];
+/** What a route accepts (research R6, narrowed by FR-044).
+ *
+ * A tenant class is named by its own name. A PLATFORM credential must additionally
+ * name the services allowed, because there are two of them and they are not equally
+ * exposed — the gateway terminates connections from the public internet and the
+ * dispatcher does not. The connection-metering chapter gave each its own secret and stopped there, so
+ * both still resolved to one class and the gateway's credential reached every
+ * dispatch route, including `replay`, whose handler takes a dead-letter id and no
+ * environment.
+ *
+ * `@Accepts("platform")` DOES NOT COMPILE, and that is the point. An authorization
+ * that can be omitted is one that will be, and the omission is invisible: the route
+ * works, the tests pass, and the blast radius is one leaked secret wide. */
+export type AcceptSpec =
+  | "application"
+  | "user"
+  | { readonly platform: readonly PlatformService[] };
+
+export const Accepts = (...specs: AcceptSpec[]) => SetMetadata(ACCEPTS, specs);
+
+const EITHER: AcceptSpec[] = ["application", "user"];
+
+function isPlatformSpec(
+  spec: AcceptSpec,
+): spec is { readonly platform: readonly PlatformService[] } {
+  return typeof spec === "object";
+}
 
-function expectation(kinds: PrincipalKind[]): string {
-  return kinds.map(describePrincipalKind).join(" or ");
+/** What the 401 and the 403 say a route wanted.
+ *
+ * `AcceptSpec` broke this and nothing in an earlier draft of this chapter fixed it:
+ * two client-visible strings are built from it, and widening the decorator's type
+ * without widening theirs leaves the part an integrator actually reads behind. The
+ * platform case names its services, because "an internal platform credential" is
+ * true of the one that was just refused. */
+function expectation(specs: readonly AcceptSpec[]): string {
+  return specs
+    .map((spec) =>
+      isPlatformSpec(spec)
+        ? `${describePrincipalKind("platform")} for ${spec.platform.join(" or ")}`
+        : describePrincipalKind(spec),
+    )
+    .join(" or ");
 }
 
 /** The guard that used to be `EnvironmentContextGuard` (2.2), doing a smaller
  * job. It no longer resolves anything — the middleware did that, from a
  * credential rather than from a header the caller asserted — so all that is left
  * is the question a guard can actually answer: may THIS class of credential use
@@ -49,20 +83,31 @@
 @Injectable()
 export class CredentialGuard implements CanActivate {
   constructor(private readonly reflector: Reflector) {}
 
   canActivate(context: ExecutionContext): boolean {
     const accepted =
-      this.reflector.getAllAndOverride<PrincipalKind[]>(ACCEPTS, [
+      this.reflector.getAllAndOverride<AcceptSpec[]>(ACCEPTS, [
         context.getHandler(),
         context.getClass(),
       ]) ?? EITHER;
 
     const req = context.switchToHttp().getRequest<RequestWithPrincipal>();
     const principal = req.principal;
 
+    // STAMP BEFORE ANY REFUSAL BELOW, because the request log cannot work this out for
+    // itself. A guard refusal and a handler response are identical at `res.on("finish")` --
+    // same status, same `req.route`, same request properties -- so `refused_at` reads
+    // `handler` unless the refusing layer says otherwise. This guard is the only class
+    // implementing `CanActivate` in this api and it throws both the 401 and the 429.
+    //
+    // ANY NEW GUARD MUST DO THIS. The `handler` arm is an inference from silence, so a guard
+    // that refuses without stamping is recorded as a plausible wrong value in a column
+    // nothing would flag.
+    (req as unknown as Record<symbol, unknown>)[REFUSED_AT] = "guard";
+
     // (FR-AUT-12, FR-RTL-02, research R18). The refusal for an
     // over-threshold address is thrown HERE and not in the middleware that
     // counted it, because `AuthenticateMiddleware` never throws by documented
     // design — pre-credential routes reach their handlers by having no principal.
     //
     // Three things fall out of putting it here. The invariant survives verbatim.
@@ -87,18 +132,48 @@
     if (!principal) {
       throw new UnauthorizedException(
         `this route requires a credential: ${expectation(accepted)}, presented as "Authorization: Bearer …"`,
       );
     }
 
-    if (!accepted.includes(principal.kind)) {
+    const matchingKind = accepted.filter((spec) =>
+      isPlatformSpec(spec) ? principal.kind === "platform" : spec === principal.kind,
+    );
+
+    if (matchingKind.length === 0) {
       throw new ForbiddenException({
         code: "wrong_credential_type",
         message: `this route expects ${expectation(accepted)}; ${describePrincipalKind(
           principal.kind,
         )} was presented`,
       });
     }
 
+    // FR-044. The class is right; the question left is whether THIS SERVICE may
+    // call this route. Two platform credentials exist and `service` says which one
+    // answered — a fact the connection-metering chapter recorded as being "for logs", which is where
+    // the gap was: a field nothing enforces is a field nothing protects.
+    //
+    // `principal.service` is a `string` and the permitted list is a union of the
+    // services that exist. The widening cast is here rather than on the principal
+    // because `principal.ts` must not import from the middleware that builds it —
+    // the dependency runs the other way — so the narrowing happens at the one place
+    // that compares them.
+    if (principal.kind === "platform") {
+      const permitted = matchingKind
+        .filter(isPlatformSpec)
+        .flatMap((spec) => spec.platform as readonly string[]);
+      if (!permitted.includes(principal.service)) {
+        throw new ForbiddenException({
+          code: "wrong_credential_service",
+          message:
+            `"${principal.service}" is not permitted on this route ` +
+            `(${permitted.join(" or ")})`,
+        });
+      }
+    }
+
+    // Allowed through: the handler decides from here, so the stamp comes back off.
+    delete (req as unknown as Record<symbol, unknown>)[REFUSED_AT];
     return true;
   }
 }
```

### `services/api/src/messages/idempotency.itest.ts` — the idempotency suite, introduced whole at 3.11.

80 differing lines, 1 hunk.

```diff title="services/api/src/messages/idempotency.itest.ts"
@@ -79,12 +79,92 @@
     // The retry got the ORIGINAL message back — same id, same seq.
     expect(retry.id).toBe(first.id);
     expect(retry.seq).toBe(first.seq);
     expect(retry.duplicate).toBe(true);
   });
 
+  it("a retry returns the original's attachments and writes no second row (FR-011)", async () => {
+    const channel = await repo.createChannel("idem-attachments", "public");
+    const key = randomUUID();
+    const attachments = [
+      { type: "url" as const, kind: "image" as const, url: "https://example.test/retry-a.png" },
+      { type: "url" as const, kind: "audio" as const, url: "https://example.test/retry-b.mp3" },
+    ];
+    const first = await repo.sendMessage(channel.id, {
+      userId: sender,
+      text: "sent once",
+      idempotencyKey: key,
+      attachments,
+    });
+    const retry = await repo.sendMessage(channel.id, {
+      userId: sender,
+      text: "sent once",
+      idempotencyKey: key,
+      attachments,
+    });
+
+    expect(retry.duplicate).toBe(true);
+    expect(retry.id).toBe(first.id);
+    // THE RETRY BRANCH IS A DIFFERENT READ. It spreads `getMessageByIdempotencyKey`'s row
+    // rather than returning the values the insert branch built, so a field carried on one
+    // is not carried on the other by construction — analysis pass 9 found exactly that
+    // asymmetry in the plan, and phase 3 fixed it by widening this read there.
+    expect(retry.attachments.map((a) => (a.type === "url" ? a.url : "media"))).toEqual([
+      "https://example.test/retry-a.png",
+      "https://example.test/retry-b.mp3",
+    ]);
+
+    // AND NO SECOND ROW, READ FROM THE DATABASE rather than inferred from `duplicate`.
+    // Two 201-equivalents prove nothing about what the second call DID; the row count is
+    // what carries it.
+    const rows = await repo.listMessagesRaw(channel.id);
+    expect(rows.filter((m) => m.text === "sent once")).toHaveLength(1);
+  });
+
+  it("recovers a TOMBSTONE with an empty list and nothing published (FR-011, FR-012)", async () => {
+    // THE CASE THE FAN-OUT CHAPTER GUARDED FOR TEXT, NOW WITH AN ATTACHMENT LIST. A message is
+    // sent with a key, deleted, and the same key is retried: the idempotency index still
+    // recognises it, so the retry returns the ORIGINAL row — which is now a tombstone.
+    //
+    // TWO THINGS FOLLOW, and both guards that carry them read `text !== null`:
+    // `messages.controller.ts:234` and `session.ts:1552`. A recovered tombstone is not a
+    // creation, so nothing is published; and FR-012 says its attachments are unlinked, so
+    // the list comes back empty rather than as what the message once carried.
+    const channel = await repo.createChannel("idem-tombstone", "public");
+    const key = randomUUID();
+    const first = await repo.sendMessage(channel.id, {
+      userId: sender,
+      text: "about to be deleted",
+      idempotencyKey: key,
+      attachments: [
+        { type: "url", kind: "image", url: "https://example.test/doomed.png" },
+      ],
+    });
+    await repo.deleteMessage(channel.id, first.id, { userId: sender });
+
+    const recovered = await repo.sendMessage(channel.id, {
+      userId: sender,
+      text: "about to be deleted",
+      idempotencyKey: key,
+      attachments: [
+        { type: "url", kind: "image", url: "https://example.test/doomed.png" },
+      ],
+    });
+
+    expect(recovered.duplicate).toBe(true);
+    expect(recovered.id).toBe(first.id);
+    // A TOMBSTONE, RECOVERED. `text` is null and the attachments are gone — the retry did
+    // not resurrect what the deletion unlinked.
+    expect(recovered.text).toBeNull();
+    expect(recovered).toHaveProperty("attachments", []);
+
+    // AND THE GUARD'S PREMISE HOLDS: `text !== null` is false here, so both publish sites
+    // skip. That is what stops a deleted message reappearing on every member's screen.
+    expect(recovered.text === null).toBe(true);
+  });
+
   it("five concurrent sends with the SAME key produce exactly one row", async () => {
     const channel = await repo.createChannel("idem-concurrent", "public");
     const key = randomUUID();
     const results = await Promise.all(
       Array.from({ length: 5 }, () =>
         repo.sendMessage(channel.id, { userId: sender,
```

### `packages/protocol/src/codes.test.ts` — the registry's own test, which follows the registry.

78 differing lines, 3 hunks.

```diff title="packages/protocol/src/codes.test.ts"
@@ -1,9 +1,15 @@
 import { describe, expect, it } from "vitest";
 
-import { CLOSE_CODES, docsUrl, ERROR_CODES, ERROR_DOCS_BASE, type ErrorCode } from "./codes.js";
+import {
+  CLOSE_CODES,
+  DEFAULT_DOCS_BASE_URL,
+  docsUrl,
+  ERROR_CODES,
+  type ErrorCode,
+} from "./codes.js";
 
 // The failure vocabulary stays coherent: EIR-WS-06's four classes are all
 // present, exactly once, with distinct meanings — and error codes never
 // collide or go blank as chapters add to the registry.
 
 describe("close codes cover EIR-WS-06's four classes", () => {
@@ -119,19 +125,42 @@
     // even when the status code is right.
     expect(ERROR_CODES.not_a_member).not.toMatch(/\bexists?\b/);
   });
 });
 
 describe("the docs URL is built in one place, with the code as the anchor", () => {
-  it("appends the code VERBATIM — no slug transform, no case change", () => {
+  it("appends the code VERBATIM as an ANCHOR — no slug transform, no case change", () => {
+    // THIS DESCRIBE SAID "ANCHOR" AND THIS ASSERTION CHECKED A PATH, for twenty-two
+    // chapters. `docs/08-error-reference.md` is one document with `## <code>` headings,
+    // so `…/errors/not_found` named a page that does not exist — 27 codes, 27 dead
+    // links — and the test agreed with the defect because it was written beside the
+    // function. The title and the assertion disagreed and nothing compared them.
     for (const code of Object.keys(ERROR_CODES) as ErrorCode[]) {
-      expect(docsUrl(code)).toBe(`${ERROR_DOCS_BASE}/${code}`);
-      expect(docsUrl(code).endsWith(`/${code}`)).toBe(true);
+      expect(docsUrl(code)).toBe(`${DEFAULT_DOCS_BASE_URL}#${code}`);
+      expect(docsUrl(code).endsWith(`#${code}`)).toBe(true);
     }
   });
 
+  it("reads the base URL per call, not at import", () => {
+    // A `const` evaluated at import cannot be changed by a test that sets the variable
+    // in `beforeAll`, and a preview deployment cannot point its error links at its own
+    // docs. The assertion is that the value MOVES — which a module-level constant makes
+    // impossible however the test is written.
+    const saved = process.env["RELAY_DOCS_BASE_URL"];
+    try {
+      process.env["RELAY_DOCS_BASE_URL"] = "https://preview.example/errors";
+      expect(docsUrl("not_found")).toBe("https://preview.example/errors#not_found");
+    } finally {
+      if (saved === undefined) delete process.env["RELAY_DOCS_BASE_URL"];
+      else process.env["RELAY_DOCS_BASE_URL"] = saved;
+    }
+    // And back to the default the moment it is unset, so one test cannot leak into
+    // another through the environment.
+    expect(docsUrl("not_found")).toBe(`${DEFAULT_DOCS_BASE_URL}#not_found`);
+  });
+
   it("gives every code a distinct URL", () => {
     const urls = (Object.keys(ERROR_CODES) as ErrorCode[]).map(docsUrl);
     expect(new Set(urls).size).toBe(urls.length);
   });
 });
 
@@ -214,6 +243,47 @@
   it("names the unhosted-media refusal apart from a malformed request", () => {
     expect(ERROR_CODES).toHaveProperty("media_not_available");
     expect(ERROR_CODES.media_not_available).not.toBe(ERROR_CODES.invalid_request);
     expect(ERROR_CODES.media_not_available).toMatch(/media/);
   });
 });
+
+describe("the five refusals this chapter's webhook surface adds", () => {
+  // NAMED, NOT COUNTED, for the reason the blocks above give — and here the names were
+  // decided somewhere else. `docs/08-error-reference.md` published a section for each of
+  // these five before the registry held any of them, so what this asserts is CLOSURE in
+  // the direction no gate covers: `check-error-codes` reads the built `dist` against the
+  // docs and counts, so a code documented and unregistered is indistinguishable from a
+  // section nobody has written.
+  const WEBHOOK_CODES = [
+    "webhook_endpoint_limit_reached",
+    "webhook_url_invalid",
+    "webhook_url_insecure",
+    "webhook_url_private_address",
+    "webhook_event_types_empty",
+  ] as const;
+
+  it.each(WEBHOOK_CODES)("registers %s with a description a client can act on", (code) => {
+    expect(ERROR_CODES).toHaveProperty(code);
+    expect(ERROR_CODES[code]).not.toBe("");
+  });
+
+  it("keeps all five distinct from internal_error, which is what they shipped as", () => {
+    // THE DEFECT, AS AN ASSERTION. Every one of these was an unnamed 422, and an unnamed
+    // 422 becomes `internal_error` in `ProtocolErrorFilter`'s ladder — a correct status
+    // and a correct message with a body telling the client the server had broken.
+    for (const code of WEBHOOK_CODES) {
+      expect(ERROR_CODES[code]).not.toBe(ERROR_CODES.internal_error);
+    }
+    // AND DISTINCT FROM EACH OTHER. Five copied lines would satisfy the loop above.
+    const meanings = WEBHOOK_CODES.map((c) => ERROR_CODES[c]);
+    expect(new Set(meanings).size).toBe(meanings.length);
+  });
+
+  it("says which of the two url refusals is about the scheme", () => {
+    // The pair a caller is most likely to confuse: an unparseable url and a parseable
+    // one this platform will not deliver to. The wording is the contract `docs_url`
+    // resolves to, and a developer reads it rather than the code.
+    expect(ERROR_CODES.webhook_url_insecure).toMatch(/https/);
+    expect(ERROR_CODES.webhook_url_invalid).toMatch(/absolute/);
+  });
+});
```

### `packages/test-harness/src/driver-exempt.test.ts` — the exemption test, introduced whole at 3.11.

74 differing lines, 2 hunks.

```diff title="packages/test-harness/src/driver-exempt.test.ts"
@@ -26,36 +26,52 @@
 const CONFIG = join(ROOT, "eslint.config.mjs");
 
 function config(): string {
   return readFileSync(CONFIG, "utf8");
 }
 
-/** The paths the config exempts from the driver rule, read off the `ignores` array
- * after the DRIVER_EXEMPT marker. Parsed, not restated. */
-function exemptPaths(): string[] {
+/** The paths the config exempts from the driver rule, read off the `DRIVER_EXEMPT`
+ * const. Parsed, not restated.
+ *
+ * BY NAMED CONST AND NOT BY POSITION, since the gauntlet chapter composed the rule
+ * sets. The list used to live inline in the all-TypeScript block's `ignores` and was read
+ * from a marker comment to the next `]`; it is hoisted now, because a second block
+ * has to reference the same list rather than repeat it. A position is a claim about
+ * layout, and this file has already been wrong about layout once. */
+function block(name: string): string {
   const text = config();
-  const marker = text.indexOf("// DRIVER_EXEMPT");
-  if (marker === -1) {
-    throw new Error(
-      "eslint.config.mjs has no DRIVER_EXEMPT marker — the shape this test reads changed",
-    );
+  const start = text.indexOf(`const ${name} = `);
+  if (start === -1) {
+    throw new Error(`eslint.config.mjs has no ${name} — the shape this test reads changed`);
   }
-  const end = text.indexOf("]", marker);
-  return [...text.slice(marker, end).matchAll(/"([^"]+\.ts)"/g)].map((m) => m[1]!);
+  const rest = text.slice(start);
+  // THE NEARER TERMINATOR, NOT A PREFERRED ONE. This asked for `\n};` first and fell
+  // back to `\n];`, which reads an ARRAY const to the end of the next OBJECT const —
+  // so `DRIVER_EXEMPT` swallowed `DRAIN_EXEMPT_TESTS` whole and this file reported
+  // `outbox.itest.ts` as driver-exempt and importing nothing restricted. It was right
+  // about the import and wrong about the list, which is the failure that sends somebody
+  // to the wrong file.
+  const ends = ["\n};", "\n];"].map((e) => rest.indexOf(e)).filter((i) => i !== -1);
+  if (ends.length === 0) throw new Error(`${name} is not terminated the way this test reads it`);
+  return rest.slice(0, Math.min(...ends));
+}
+
+function exemptPaths(): string[] {
+  return [...block("DRIVER_EXEMPT").matchAll(/"([^"]+\.ts)"/g)].map((m) => m[1]!);
 }
 
-/** The module names the rule restricts, read off its `paths` entries. */
+/** The module names the DRIVER rule restricts, read off `DRIVER_AND_ENGINE`.
+ *
+ * THIS USED TO SCAN FORWARD FROM THE FIRST `"no-restricted-imports"` to the next
+ * `paths: [ … ], patterns:`. After the hoisting the first occurrence is
+ * `["error", DRIVER_AND_ENGINE]`, and the next matching `paths:` belongs to the
+ * UNION block — whose entries are spreads, carrying no `name:` at all. The parse
+ * returned `[]` and every check reading it went vacuous, which the first assertion
+ * below catches and is the only reason this was a nuisance rather than a hole. */
 function restricted(): string[] {
-  const text = config();
-  const block = /"no-restricted-imports":[\s\S]*?paths:\s*\[([\s\S]*?)\],\s*patterns:/.exec(text);
-  if (block === null) {
-    throw new Error(
-      "eslint.config.mjs's no-restricted-imports rule is not shaped the way this test reads it",
-    );
-  }
-  return [...block[1]!.matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]!);
+  return [...block("DRIVER_AND_ENGINE").matchAll(/name:\s*"([^"]+)"/g)].map((m) => m[1]!);
 }
 
 describe("the driver exemption is checked in both directions", () => {
   it("parses a non-empty list of exempt paths and restricted modules", () => {
     // Both parses failing open would make every assertion below vacuous, which is
     // the way a check like this normally dies.
@@ -82,25 +98,19 @@
       expect(uses, `${path} is exempt from the driver rule and imports none of ${modules.join(", ")}`)
         .not.toEqual([]);
     }
   });
 
   it("exempts the two data-access layers as directories and everything else by path", () => {
-    const text = config();
-    // FOUND BY SCANNING BACK FROM THE RULE, NOT BY A WINDOW. This read `indexOf("ignores:
-    // [", indexOf("no-restricted-imports") - 2000)` and the 2000 was the whole check: the
-    // block grew by a comment, the real `ignores` fell 2,027 characters before the anchor
-    // — 27 outside the window — and the search silently found the NEXT one instead and
-    // reported `[]`. An empty list is a legitimate-looking answer, so nothing said broken.
-    const anchor = text.indexOf("no-restricted-imports");
-    expect(anchor, "the rule this test reads is not in the config").toBeGreaterThan(-1);
-    const start = text.lastIndexOf("ignores: [", anchor);
-    expect(start, "no ignores list precedes the rule").toBeGreaterThan(-1);
-    const entries = [...text.slice(start, text.indexOf("]", start)).matchAll(/"([^"]+)"/g)].map(
-      (m) => m[1]!,
-    );
+    // BY NAME, AND THE TWO EARLIER SHAPES ARE WHY. This read a window around the rule
+    // (`indexOf("ignores: [", indexOf("no-restricted-imports") - 2000)`) until a comment
+    // grew the block past 2,000 characters and the search silently found the NEXT
+    // `ignores` and reported `[]`. It then scanned backwards from the rule, until the
+    // list was hoisted out of the block entirely and there was no `ignores: [` to find.
+    // Both failures are the same one: a position is a claim about layout.
+    const entries = [...block("DRIVER_EXEMPT").matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
     // THE POSITIVE CONTROL. Every assertion below is about which of these are globs, and
     // a parse that found nothing would satisfy all of them.
     expect(entries.length, "parsed no entries at all — this test is broken, not passing")
       .toBeGreaterThan(0);
     // TWO directory patterns and they are the two data-access LAYERS: `db/**` for the
     // driver and the engine, `limits/**` for the counter store, each of them the thing
```

### `packages/protocol/src/internal.test.ts` — the internal-protocol test, introduced whole at 3.20.

67 differing lines, 3 hunks.

```diff title="packages/protocol/src/internal.test.ts"
@@ -1,12 +1,17 @@
 import { describe, expect, it } from "vitest";
 
 import {
   ALL_ANALYTICS_SUBJECT,
   ALL_EVENTS_SUBJECT,
+  NO_TENANT_TOKEN,
   analyticsSubjectFor,
+  apiRequestSubject,
+  apiRequestSubjectWithoutTenant,
+  connectionClosedSubject,
+  connectionOpenedSubject,
   internalUsageReportEntrySchema,
   internalUsageReportRequestSchema,
   internalUsageReportResponseSchema,
   subjectFor,
   webhookAttemptSubject,
 } from "./internal.js";
@@ -113,12 +118,48 @@
   it("throws on a missing domain or action rather than producing `analytics..`", () => {
     expect(() => analyticsSubjectFor("", "attempt", ENV)).toThrow(/domain is required/);
     expect(() => analyticsSubjectFor("webhook", "", ENV)).toThrow(/action is required/);
   });
 });
 
+// Connection open and close (FR-ANL-01, chapter 4.5).
+describe("the connection grammar takes two actions on one domain", () => {
+  const ENV = "9f3c1e7a-0b2d-4c8e-9a1f-6d5b4c3a2e10";
+
+  it("builds both through `analyticsSubjectFor`, unchanged", () => {
+    expect(connectionOpenedSubject(ENV)).toBe(`analytics.connection.opened.${ENV}`);
+    expect(connectionClosedSubject(ENV)).toBe(`analytics.connection.closed.${ENV}`);
+  });
+
+  it("produces subjects the ingester's wildcard matches", () => {
+    expect(matchesWildcard(connectionOpenedSubject(ENV), ALL_ANALYTICS_SUBJECT)).toBe(true);
+    expect(matchesWildcard(connectionClosedSubject(ENV), ALL_ANALYTICS_SUBJECT)).toBe(true);
+  });
+
+  it("does not collide with the events stream's wildcard", () => {
+    expect(matchesWildcard(connectionOpenedSubject(ENV), ALL_EVENTS_SUBJECT)).toBe(false);
+  });
+
+  it("separates an open from a close ON THE SUBJECT, not in the payload", () => {
+    // Which is what a subject grammar is for: a consumer that wants only closes filters
+    // `analytics.connection.closed.>` rather than shaping every open to discover it did
+    // not want it.
+    expect(connectionOpenedSubject(ENV)).not.toBe(connectionClosedSubject(ENV));
+  });
+
+  it("REFUSES an environment id that is not a uuid, on both actions", () => {
+    // Asserted rather than assumed, and on both: a validator applied to one of a pair
+    // is the hole this whole grammar exists to close. There is no `_none` arm here to
+    // relax it with -- a connection event only exists after a handshake.
+    for (const bad of ["", "not-a-uuid", `${ENV}.extra`, "*", ">"]) {
+      expect(() => connectionOpenedSubject(bad)).toThrow(/environment id must be a uuid/);
+      expect(() => connectionClosedSubject(bad)).toThrow(/environment id must be a uuid/);
+    }
+  });
+});
+
 describe("the usage report", () => {
   const entry = (over: Record<string, unknown> = {}) => ({
     connection_id: "0f9c8b7a-6d5e-4c3b-8a19-8f7e6d5c4b3a",
     environment_id: "8b21c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
     period: "2026-08-01",
     minutes: 17,
@@ -181,6 +222,32 @@
     expect(
       internalUsageReportResponseSchema.safeParse({ credited: 4, refused: 0 })
         .success,
     ).toBe(false);
   });
 });
+
+describe("the API request log's subjects (chapter 4.4)", () => {
+  const ENV = "9f3c1e7a-0b2d-4c8e-9a1f-6d5b4c3a2e10";
+  it("builds a tenant-scoped subject the stream's own filter matches", () => {
+    expect(apiRequestSubject(ENV)).toBe(`analytics.api.request.${ENV}`);
+    expect(matchesWildcard(apiRequestSubject(ENV), ALL_ANALYTICS_SUBJECT)).toBe(true);
+  });
+
+  // ASSERT THE REFUSAL, NOT ONLY THE SUCCESS. A validator tested on valid input is a
+  // validator untested, and this one is the reason a tenant's records cannot reach another
+  // tenant's filter.
+  it("refuses an environment that is not a uuid", () => {
+    expect(() => apiRequestSubject("no.tenant")).toThrow(/must be a uuid/);
+    expect(() => apiRequestSubject("*")).toThrow(/must be a uuid/);
+    expect(() => apiRequestSubject("")).toThrow(/must be a uuid/);
+  });
+
+  it("has a tenantless arm that no exact tenant filter can match", () => {
+    const subject = apiRequestSubjectWithoutTenant();
+    expect(subject).toBe("analytics.api.request._none");
+    expect(matchesWildcard(subject, ALL_ANALYTICS_SUBJECT)).toBe(true);
+    // and it is not, and cannot be, any tenant's subject
+    expect(subject).not.toBe(apiRequestSubject(ENV));
+    expect(() => apiRequestSubject(NO_TENANT_TOKEN)).toThrow(/must be a uuid/);
+  });
+});
```

### `packages/test-harness/src/bound-port.test.ts` — the bound-port test, which gained the ingester's BINDS_NOTHING entry in Part 4.

52 differing lines, 1 hunk.

```diff title="packages/test-harness/src/bound-port.test.ts"
@@ -30,24 +30,72 @@
   return readdirSync(join(ROOT, "services"), { withFileTypes: true })
     .filter((e) => e.isDirectory())
     .map((e) => join("services", e.name, "src", "main.ts"))
     .filter((p) => existsSync(join(ROOT, p)));
 }
 
+/** A SERVICE THAT BINDS NOTHING, DECLARED BY NAME.
+ *
+ * The derivation above found the dispatcher the moment it arrived, which is what it is
+ * for — and then asserted a property the dispatcher cannot have. It is not a server: no
+ * `listen`, no `createServer`, no `PORT`. It consumes a stream and posts to the api, and
+ * a test that spawns it probes nothing.
+ *
+ * DECLARED RATHER THAN FILTERED OUT BY A PATTERN, and asserted in BOTH directions
+ * below. A `.filter()` on the derivation would silently absorb the next service that
+ * forgets to read its address back; an entry here that starts listening fails too. That
+ * is the driver-exemption lesson this repository has already paid for once: a list
+ * checked one way can only grow, and a stale entry holds a standing exemption over a
+ * file that no longer needs one. */
+const BINDS_NOTHING: ReadonlyArray<readonly [string, string]> = [
+  [
+    "services/dispatcher/src/main.ts",
+    "a stream consumer with no inbound surface: it fetches from JetStream and posts to " +
+      "the api over the internal seam, so there is no port for a test to be handed",
+  ],
+  [
+    "services/ingester/src/main.ts",
+    "the same shape as the dispatcher and for the same reason: it fetches from JetStream " +
+      "and inserts into ClickHouse over HTTP, so it has no listener, no PORT and no " +
+      "address to read back. It arrived in chapter 4.3 and this entry did not, which is " +
+      "the half the derivation cannot supply on its own",
+  ],
+];
+
+const LISTENERS = serviceMains().filter(
+  (rel) => !BINDS_NOTHING.some(([name]) => name === rel),
+);
+
 describe("a spawned service reports the port it bound", () => {
   it("finds a main.ts for more than one service", () => {
     // A derivation that finds one file passes vacuously for the other.
     expect(serviceMains().length).toBeGreaterThan(1);
   });
 
-  it.each(serviceMains())("%s reads the bound address back", (rel) => {
+  it("declares every service that binds nothing, and no others", () => {
+    // BOTH DIRECTIONS. An exempted file that has started listening is the failure this
+    // half catches, and it is the half a `.filter()` cannot have: the entry would go on
+    // excusing a service that now needs the assertion.
+    for (const [rel, why] of BINDS_NOTHING) {
+      expect(serviceMains(), `${rel} is declared here and is not a service`).toContain(rel);
+      expect(why.length, `${rel} is exempted with no reason`).toBeGreaterThan(20);
+      const text = readFileSync(join(ROOT, rel), "utf8");
+      expect(text, `${rel} binds a port now and must not be exempt`).not.toMatch(
+        /\.listen\(|createServer\(|process\.env(?:\.PORT|\["PORT"\])/,
+      );
+    }
+    // And the exemption cannot swallow the suite: something still has to be asserted.
+    expect(LISTENERS.length, "every service is exempt").toBeGreaterThan(1);
+  });
+
+  it.each(LISTENERS)("%s reads the bound address back", (rel) => {
     const text = readFileSync(join(ROOT, rel), "utf8");
     expect(text, `${rel} never calls address()`).toMatch(/\.address\(\)/);
   });
 
-  it.each(serviceMains())("%s does not log the port it asked for", (rel) => {
+  it.each(LISTENERS)("%s does not log the port it asked for", (rel) => {
     const text = readFileSync(join(ROOT, rel), "utf8");
     // THE FAILURE THIS CATCHES, written as the pattern that caused it:
     //   const port = Number(process.env.PORT ?? 4001);
     //   ... logger.log("info", "listening", { port });
     // The name bound directly from the environment must not be the one logged. Both
     // services call it `requested` now, which is the convention this asserts.
```

### `services/api/src/app.module.ts` — the api's module list, which every new module joins.

42 differing lines, 2 hunks.

```diff title="services/api/src/app.module.ts"
@@ -14,21 +14,27 @@
 // Registered here for the reason `ChannelsModule` is: without this
 // line the module is compiled, exported, imported by nothing, and none of the user
 // routes exist. The file appeared in no task until an enumeration asked which
 // chapter fences it.
 import { UsersModule } from "./users/users.module";
 import { ConsumerModule } from "./consumer/consumer.module";
+import { NotificationsModule } from "./notifications/notifications.module";
 import { QuotasModule } from "./quotas/quotas.module";
 import { OutboxModule } from "./outbox/outbox.module";
 import { WebhooksModule } from "./webhooks/webhooks.module";
 import { TenancyModule } from "./tenancy/tenancy.module";
 import { LOGGER, apiLogger } from "./logger";
 import { ProtocolErrorFilter } from "./protocol-error.filter";
 import { LimitsModule } from "./limits/limits.module";
 import { RateLimitMiddleware } from "./limits/rate-limit.middleware";
 import { RequestContextMiddleware } from "./request-context.middleware";
+import { RequestLogMiddleware } from "./request-log/request-log.middleware";
+import { RequestLogModule } from "./request-log/request-log.module";
+import { ANALYTICS_PUBLISHER } from "./webhooks/analytics";
+import { createJetStreamPublisher, ensureAnalyticsStream } from "./outbox/jetstream.publisher";
+import type { Publisher } from "./outbox/publisher";
 
 // The application described as a module graph — ADR-15's convention for the
 // wide surface Phases 2-4 will grow. Registering the error filter as a
 // provider (APP_FILTER) instead of wiring it in main.ts means every entry
 // point — including tests — gets the same error envelope for free.
 @Module({
@@ -37,33 +43,67 @@
     MessagesModule,
     ChannelsModule,
     UsersModule,
     InternalModule,
     TenancyModule,
     OutboxModule,
+    NotificationsModule,
     QuotasModule,
     ConsumerModule,
     WebhooksModule,
     LimitsModule,
+    // Chapter 4.8's read surface. Registered here for the reason `ChannelsModule` and
+    // `UsersModule` are: without this line the module compiles, is imported by nothing,
+    // and the route does not exist — which `pnpm build` would not notice and the
+    // cross-tenant gauntlet would, because it derives its targets from the router.
+    RequestLogModule,
   ],
   controllers: [HealthController],
   providers: [
     { provide: LOGGER, useFactory: apiLogger },
     { provide: APP_FILTER, useClass: ProtocolErrorFilter },
     RequestContextMiddleware,
     RateLimitMiddleware,
+    RequestLogMiddleware,
+    // PROVIDED HERE TOO, AND THAT IS NOT A DUPLICATE BY ACCIDENT. `ANALYTICS_PUBLISHER` is
+    // declared in `webhooks/analytics.ts` and provided in `InternalModule`, which has NO
+    // `exports:` array -- and `internal.module.ts` states the rule twelve lines below that
+    // provider: "a provider is visible to the module that declares it and to nothing it
+    // imports". Middleware configured in `AppModule.configure()` resolves from AppModule's
+    // injector, so without this line Nest cannot construct `RequestLogMiddleware` and the
+    // process fails at boot.
+    //
+    // Same factory, provided twice, follows `LOGGER`'s precedent in that same file. The cost
+    // is a second publisher instance: a second NATS connection and a second idempotent
+    // `ensureAnalyticsStream` call at boot. The connection is lazy, so an unreachable broker
+    // still leaves the api serving requests.
+    {
+      provide: ANALYTICS_PUBLISHER,
+      useFactory: (): Publisher => createJetStreamPublisher({ ensure: ensureAnalyticsStream }),
+    },
   ],
 })
 export class AppModule implements NestModule {
   configure(consumer: MiddlewareConsumer): void {
     // Order is the chain: the request gets its id first, then its principal,
     // then its allowance. The limiter is LAST and that is forced:
     // it counts per environment and the environment comes from the credential,
     // so nothing earlier in the chain knows which tenant is asking.
     // The credentials chapter put authentication HERE rather than in a guard because Nest
     // constructs request-scoped providers before the enhancer chain runs — the
     // finding 2.6 paid for, measured again on this path in T004.
+    // REQUEST LOG IS SECOND, NOT LAST, AND THE POSITION IS LOAD-BEARING.
+    // `RateLimitMiddleware` refuses a 429 with `res.end(); return;` and never calls
+    // `next()`, so a producer registered after it never runs -- and a rate-limited request
+    // is exactly the one an operator opens a request log to find. Second, it attaches its
+    // `finish` listener before anything can short-circuit, and reads `req.principal` when
+    // the listener fires rather than when it is attached. Attach early, read late.
     consumer
-      .apply(RequestContextMiddleware, AuthenticateMiddleware, RateLimitMiddleware)
+      .apply(
+        RequestContextMiddleware,
+        RequestLogMiddleware,
+        AuthenticateMiddleware,
+        RateLimitMiddleware,
+      )
       .forRoutes("{*path}");
   }
 }
```

### `services/api/src/outbox/event.ts` — the outbox event union, which every new event type joins.

37 differing lines, 1 hunk.

```diff title="services/api/src/outbox/event.ts"
@@ -78,12 +78,49 @@
  * subscription filters on these strings, so the spelling is the requirement's and not
  * this chapter's.
  *
  * WIDENED FROM A LITERAL. `type` was `"message.created"` alone, which is the shape a
  * consumer narrows on: every `switch` and every `===` against it sees this change,
  * which is what a typecheck catches and an integration lane does not. */
+/** WHAT THIS PLATFORM DECLARES, AND WHICH OF IT IT ACTUALLY EMITS.
+ *
+ * TWO LISTS THAT MUST AGREE WITH NOTHING COMPARING THEM — this project's most-recorded
+ * defect, and here it is FR-WHK-02's eight against the array below's five. The only thing
+ * connecting them was somebody remembering.
+ *
+ * `emitted` IS NOT OPTIONAL, AND THAT IS THE POINT. `satisfies Record<string, { emitted:
+ * boolean }>` makes a type added without deciding a compile error. A type declared and
+ * not emitted is a subscription a customer can create and never hear from — survivable
+ * when it is written down, a silent trap when it is not.
+ *
+ * THE THREE FALSE ONES ARE NOT OVERSIGHTS. `channel.created`, `user.connected` and
+ * `user.disconnected` are declared by FR-WHK-02 and unbuilt. **Published measured 741
+ * stored subscriptions naming `channel.created`** — declared, published, not yet built —
+ * and validating against the EMITTED set would refuse every one of them. Those customers
+ * made no mistake: they subscribed to a published event type and are waiting for the
+ * feature. Refusing them is feature 044's FR-016 defect exactly, which had to be amended
+ * rather than shipped.
+ *
+ * SO THE VALIDATION USES THIS SET AND NOT THE ARRAY BELOW. A name outside the declared
+ * eight is a typo and is refused; a declared name this platform does not emit yet is
+ * accepted. `event.test.ts` asserts the two lists agree in the direction that matters —
+ * every `emitted: true` key is in the array, and every array member is an `emitted: true`
+ * key — so neither can drift without a red test. */
+export const WEBHOOK_EVENT_TYPES = {
+  "message.created": { emitted: true },
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
 /** THE ARRAY IS THE SOURCE AND THE TYPE IS DERIVED, so the set has a size a test can
  * read. A bare union has no runtime form: "the union has exactly three members" is
  * unassertable, and the presence chapter's `codes.test.ts` earned its keep precisely by
  * asserting an exact set and an exact count — which is what makes a new member a
  * decision rather than an accident. `as const` plus `(typeof …)[number]` costs one
  * line and buys that. */
```

### `services/gateway/src/main.test.ts` — the gateway's entry test, after the shutdown scope narrowed.

35 differing lines, 2 hunks.

```diff title="services/gateway/src/main.test.ts"
@@ -105,19 +105,35 @@
     // A POSITIVE CONTROL RATHER THAN A COUNT. The published version of this test
     // asserted `toHaveLength(6)`, which is a number every later chapter that adds a
     // module has to edit — and a number edited on every change is a number nobody
     // reads. The loop below is the assertion; this line only says the derivation
     // found something to loop over.
     expect(closeable.length, "no `const x = createY(` found in main.ts").toBeGreaterThan(1);
-    // DERIVED, NOT NAMED. The closing site is wherever this file registers one —
-    // `server.on("close", …)` here — and reading the whole source rather than a
-    // named function means a refactor that moves the calls cannot silently pass.
+    // SCOPED TO `shutdown()`, AND IT USED TO BE THE WHOLE SOURCE. The note here read
+    // "reading the whole source rather than a named function means a refactor that
+    // moves the calls cannot silently pass", which was right while every close was a
+    // `void x.close()` in the `server.on("close")` listener: any of them, anywhere,
+    // was as good as any other.
+    //
+    // The connection-metering chapter ends that. A signal handler now awaits
+    // `shutdown()`, because a final usage report that is not awaited is the same
+    // non-guarantee as no report — the process leaves before the request does. A
+    // fabric closed by a stray `void` somewhere else is closed on no path a deploy
+    // takes, and the wider check would have called that closed.
+    //
+    // So the scope narrows and the derivation does not: the list is still read out of
+    // `main.ts`, `NOT_CLOSEABLE` is still the only thing named, and a refactor that
+    // renames `shutdown` fails loudly on the line below rather than passing quietly.
+    const open = source.indexOf("async function shutdown(): Promise<void> {");
+    expect(open, "main.ts has no `shutdown()` — the shape this test reads changed")
+      .toBeGreaterThan(-1);
+    const body = source.slice(open, source.indexOf("\n  }", open));
     for (const name of closeable) {
       expect(
-        new RegExp(`(void |await )${String(name)}\\.close\\(\\)`).test(source),
-        `${String(name)} is built but never closed`,
+        body.includes(`await ${String(name)}.close()`),
+        `${String(name)} is built but never awaited in shutdown()`,
       ).toBe(true);
     }
   });
 });
 
 describe("every fabric createServer builds is injected", () => {
@@ -183,12 +199,21 @@
       "fanout",
       "presence",
       "membership",
       "typing",
       "connections",
       "limits",
+      // THE EIGHTH, AND THIS TEST PREDICTED IT: "the property that breaks when
+      // somebody adds an eighth". It broke, on all three assertions, which is the
+      // check working rather than the check being in the way.
+      //
+      // It is also the first name here that is not a Redis client. `connectionLog`
+      // owns a NATS connection through the publisher it is constructed with -- one
+      // fabric with one `close()`, rather than a second const this derivation would
+      // have found and neither half of the pair would have been satisfied by.
+      "connectionLog",
     ]);
     expect(injected(), "no attachSessions call found").toContain("server,");
   });
 
   it("passes each one into attachSessions", () => {
     const call = injected();
```

### `services/api/src/internal/dispatch.controller.ts` — the dispatch controller, after Part 4 narrowed which platform credentials reach it.

20 differing lines, 1 hunk.

```diff title="services/api/src/internal/dispatch.controller.ts"
@@ -38,20 +38,28 @@
 // "Only the API service writes to PostgreSQL… Other services obtain writes and
 // backfill reads via the API service's internal endpoints." The dispatcher owns
 // no database, so everything it needs is here — and that constraint is not a
 // workaround, it is the reason the broker chapter's claim-and-effect-in-one-transaction
 // pattern stops applying and the chapter has something to say.
 //
-// `@Accepts("platform")` and nothing else. These routes reach EVERY environment,
-// which is exactly why no tenant credential may use them: an API key is scoped to
-// one environment by construction, and a route that accepted one here would
-// either be useless to the dispatcher or would have to ignore the scope — and
-// ignoring a tenant scope is the shape a cross-tenant hole takes.
+// NO TENANT CREDENTIAL, AND THEN NOT EVERY PLATFORM ONE EITHER. These routes reach
+// EVERY environment, which is exactly why no tenant credential may use them: an API
+// key is scoped to one environment by construction, and a route that accepted one
+// here would either be useless to the dispatcher or would have to ignore the scope —
+// and ignoring a tenant scope is the shape a cross-tenant hole takes.
+//
+// This comment said `@Accepts("platform")` and nothing else, and the decorator below
+// no longer does. `replay` takes a dead-letter id and no environment, so the class
+// alone put every tenant's dead letters behind whichever platform secret leaked
+// first.
 @Controller("internal/dispatch")
 @UseGuards(CredentialGuard)
-@Accepts("platform")
+// FR-044: the CLASS was never enough. Two platform credentials
+// exist, `service` said which one answered, and nothing checked it — so the more
+// exposed service set the blast radius for both. Here: delivery is the dispatcher's; the gateway has no business replaying a dead letter.
+@Accepts({ platform: ["dispatcher"] })
 export class DispatchController {
   constructor(
     @Inject("DB") private readonly db: Db,
     @Inject(ANALYTICS_PUBLISHER) private readonly analytics: Publisher,
     @Inject(LOGGER) private readonly logger: Logger,
   ) {}
```

### `services/api/src/internal/usage.controller.ts` — the usage controller, the same narrowing.

19 differing lines, 1 hunk.

```diff title="services/api/src/internal/usage.controller.ts"
@@ -30,20 +30,27 @@
 // `/internal/backfill` and `/internal/messages` are all `@Accepts("user")` —
 // each is a user's action taken through a socket, and the gateway forwards the
 // token it was handed. A usage report is nobody's action. Mixing the two credential classes inside one
 // controller would make the class-level decorator stop being the answer to "who
 // may call this", which is what `dispatch.controller.ts` avoided the same way.
 //
-// `@Accepts("platform")` AND NOTHING ELSE. An `application` credential is scoped
-// to one environment by construction and a report names environments in its
-// body: a route that accepted one would either be useless to the gateway or
-// would have to ignore that scope, and ignoring a tenant scope is the shape a
-// cross-tenant hole takes.
+// NO TENANT CREDENTIAL, AND THEN NOT EVERY PLATFORM ONE EITHER. An `application`
+// credential is scoped to one environment by construction and a report names
+// environments in its body: a route that accepted one would either be useless to
+// the gateway or would have to ignore that scope, and ignoring a tenant scope is
+// the shape a cross-tenant hole takes.
+//
+// This comment said `@Accepts("platform")` and nothing else, which was true for one
+// chapter. The decorator below now names a SERVICE, because the class stopped being
+// enough the moment a second service held it.
 @Controller("internal/usage")
 @UseGuards(CredentialGuard)
-@Accepts("platform")
+// FR-044: the CLASS was never enough. Two platform credentials
+// exist, `service` said which one answered, and nothing checked it — so the more
+// exposed service set the blast radius for both. Here: metering is the gateway's, and the gateway's only.
+@Accepts({ platform: ["gateway"] })
 export class UsageController {
   constructor(@Inject("DB") private readonly db: Db) {}
 
   /** `POST /internal/usage/connections` — one request carries every connection
    * the reporting instance holds, open and just-closed alike.
    *
```

### `packages/test-harness/src/sentinel.ts` — the sentinel's TypeScript half, which follows the SQL.

17 differing lines, 4 hunks.

```diff title="packages/test-harness/src/sentinel.ts"
@@ -62,12 +62,16 @@
    * `quotaPeriod` is a FIXED month rather than the current one, because two of the
    * three tables are keyed on it and a bait row whose key moved at midnight on the
    * first would be a fixture that fails one day in thirty. It is far enough in the
    * past that no product code will ever write the same key. */
   quotaPeriod: string;
   quotaNotificationId: string;
+  /** The connection-metering chapter's, and the fifth guarded table's. Keyed
+   * `(connection_id, period)`, so the bait needs an id of its own rather than
+   * borrowing the sentinel's user or channel. */
+  usageConnectionId: string;
   /** `__sentinel__:<owner>`, on every row, so a failure says whose it is. */
   name: string;
 }
 
 /** A v4-shaped uuid derived from a string. Deterministic, so a file's sentinel is
  * the same on every run and the delete-then-insert in `plant` is exact. */
@@ -90,12 +94,13 @@
     applicationId: id("application"),
     environmentId: id("environment"),
     userId: id("user"),
     channelId: id("channel"),
     quotaPeriod: "1999-01-01",
     quotaNotificationId: id("quota-notification"),
+    usageConnectionId: id("usage-connection"),
     name: `__sentinel__:${owner}`,
   };
 }
 
 /** The shared sentinel this feature does NOT have, kept as a named export so a
  * reader looking for one finds this comment instead. */
@@ -145,12 +150,13 @@
   // The subject the plant below writes, not the one it used to: a cleanup keyed on
   // a stale subject leaves every row it was meant to remove.
   await q(`DELETE FROM outbox         WHERE subject = $1`, [`events.${s.name}.bait`]);
   await q(`DELETE FROM read_positions WHERE environment_id = $1`, [s.environmentId]);
   // The quota chapter's three, and they come before `users` for the reason the note
   // above gives: `usage_active_users` references it.
+  await q(`DELETE FROM usage_connections   WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM quota_notifications WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM usage_active_users  WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM usage_periods       WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM channels       WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM users          WHERE environment_id = $1`, [s.environmentId]);
 
@@ -269,12 +275,23 @@
         quota, usage_at_crossing, delivered_at)
      VALUES ($1, $2, $3, $4, 'messages', 50, 1, 1, now() - interval '2 hours')
      ON CONFLICT (id) DO UPDATE SET delivered_at = EXCLUDED.delivered_at`,
     [s.quotaNotificationId, s.environmentId, s.organisationId, s.quotaPeriod],
   );
 
+  // AND THE CONNECTION-METERING CHAPTER'S. `DO UPDATE` on `minutes` for the reason the
+  // notification's insert gives: a sentinel's ids are derived from its owner, so this
+  // row's key is the same on every run for ever, and a fixture that only guarantees
+  // EXISTENCE guarantees whatever the first run happened to write.
+  await q(
+    `INSERT INTO usage_connections (connection_id, period, environment_id, minutes)
+     VALUES ($1, $2, $3, 0)
+     ON CONFLICT (connection_id, period) DO UPDATE SET minutes = EXCLUDED.minutes`,
+    [s.usageConnectionId, s.quotaPeriod, s.environmentId],
+  );
+
   // DRAIN BAIT: unpublished events. `outbox` carries no environment_id — it is
   // platform bookkeeping — so the subject is what identifies these, and it is also
   // why the trigger cannot guard them (data-model.md). The count is `BAIT_ROWS` and
   // not one, because a single row cannot tell a batch that ignored its limit from
   // one that honoured it.
   //
```

### `services/api/src/isolation/fixtures.ts` — the gauntlet fixtures, after webhook signing secrets joined them.

17 differing lines, 3 hunks.

```diff title="services/api/src/isolation/fixtures.ts"
@@ -1,7 +1,8 @@
 import { createApiKey, createEnvironment, Repository } from "../db/repository";
+import { encryptSecret, mintSigningSecret } from "../webhooks/secret";
 
 import type { Db } from "../db/client";
 
 /** Two tenants, so every attack has a victim and an attacker.
  *
  * The gauntlet's unit of assertion is a PAIR of requests — another tenant's identifier
@@ -29,12 +30,18 @@
   userExternalId: string;
   channelId: string;
   /** The customer-supplied identifier, so an attack can present the other tenant's own
    * external id rather than only its uuid. */
   channelExternalId: string;
   messageId: string;
+  /** One webhook endpoint, because the webhook routes take an endpoint id and the
+   * gauntlet's unit of assertion is another tenant's identifier. Its secret is
+   * encrypted the way the product encrypts one — `mintSigningSecret` then
+   * `encryptSecret` — so a `material` response that leaked one would leak a real
+   * ciphertext rather than a fixture's placeholder. */
+  endpointId: string;
   repo: Repository;
 }
 
 export interface TwoTenants {
   /** The caller. Its credential is the one every attack presents. */
   attacker: Tenant;
@@ -62,17 +69,27 @@
   const channel = await repo.createChannel(channelExternalId, "public", label);
   await repo.addMember(channel.id, user.id);
   const message = await repo.sendMessage(channel.id, {
     text: `${label} says something`,
     userId: user.id,
   });
+  // SUBSCRIBED TO `message.created`, which is what makes the expand attack able to
+  // fail. An endpoint subscribed to nothing would make `created: 0` the answer for
+  // every environment, and the assertion that a named environment reached its OWN
+  // endpoints would pass on a no-op.
+  const endpoint = await repo.createEndpoint({
+    url: `https://${label}.example/hook`,
+    eventTypes: ["message.created"],
+    secretCiphertext: encryptSecret(mintSigningSecret()),
+  });
 
   return {
     environmentId: environment.id,
     credential: key.credential,
     botExternalId: bot.external_id,
+    endpointId: endpoint.id,
     userId: user.id,
     userExternalId,
     channelId: channel.id,
     channelExternalId,
     messageId: message.id,
     repo,
```

### `services/api/src/isolation/targets.itest.ts` — the target list's own test, which follows it.

17 differing lines, 1 hunk.

```diff title="services/api/src/isolation/targets.itest.ts"
@@ -155,12 +155,29 @@
       // ONCE. Both keys went into `targets.ts` before the second route was written, so
       // one run named `GET …/:messageId/edits` as an entry matching no derived target —
       // the direction a rename breaks — while the accounting test above named the other.
       "GET /v1/channels/:channelId/messages/:messageId/edits",
       "PATCH /v1/channels/:channelId/messages/:messageId",
       "DELETE /v1/channels/:channelId/messages/:messageId",
+      // ── THE `/internal` SURFACE, WHICH THIS LIST HAD NEVER NAMED ────────────
+      //
+      // The metering chapter added its usage report here and filed the rest. This is
+      // the rest: five routes on the router, classified in `targets.ts`, and absent
+      // from the one assertion that catches a route CLASSIFIED AND NEVER BUILT.
+      //
+      // The gap cost nothing — the accounting test above catches the other direction,
+      // and every one of these is on the router today. What it cost was the claim:
+      // "each chapter that adds a route adds its key here" was false of five routes,
+      // and a list that is quietly incomplete is weaker than the sentence describing
+      // it. This chapter is the gauntlet's, so it is the one that owes the sweep.
+      "POST /internal/usage/connections",
+      "GET /internal/memberships",
+      "POST /internal/dispatch/expand",
+      "POST /internal/dispatch/material",
+      "POST /internal/dispatch/outcome",
+      "POST /internal/dispatch/replay",
     ];
     const keys = derived.map(targetKey);
     const missing = ADDED.filter((k) => !keys.includes(k));
     expect(missing, `classified here and not on the router: ${missing.join(", ")}`)
       .toEqual([]);
   });
```

### `packages/test-harness/src/guard.itest.ts` — the guard suite, introduced whole at 3.23.

15 differing lines, 1 hunk.

```diff title="packages/test-harness/src/guard.itest.ts"
@@ -191,12 +191,27 @@
     values: (s) => [s.quotaNotificationId, s.environmentId, s.organisationId, s.quotaPeriod],
     touch: `last_error = last_error`,
     mark: `last_error = $1::text`,
     read: `SELECT last_error AS v FROM quota_notifications WHERE environment_id = $1`,
     marked: (n) => String(n),
   },
+  // The connection-metering chapter's, and the first guarded table whose key does not
+  // start with the environment. `minutes` is the mark for the same reason
+  // `usage_periods` uses its count: it is the column nothing else in this fixture
+  // writes, and a `bigint` comes back from `pg` as a string.
+  usage_connections: {
+    plant: `INSERT INTO usage_connections
+              (connection_id, period, environment_id, minutes)
+            VALUES ($1, $2, $3, 0)
+            ON CONFLICT (connection_id, period) DO NOTHING`,
+    values: (s) => [s.usageConnectionId, s.quotaPeriod, s.environmentId],
+    touch: `minutes = minutes`,
+    mark: `minutes = $1`,
+    read: `SELECT minutes AS v FROM usage_connections WHERE environment_id = $1`,
+    marked: (n) => String(n),
+  },
 };
 
 let admin: pg.Client;
 let plain: pg.Client;
 
 beforeAll(async () => {
```

### `services/api/src/auth/authenticate.middleware.ts` — the authenticate middleware, after the platform-services table was typed.

15 differing lines, 1 hunk.

```diff title="services/api/src/auth/authenticate.middleware.ts"
@@ -57,16 +57,27 @@
 export const PLATFORM_CREDENTIAL_ENV = "RELAY_INTERNAL_CREDENTIAL";
 export const GATEWAY_CREDENTIAL_ENV = "RELAY_INTERNAL_CREDENTIAL_GATEWAY";
 const PLATFORM_PREFIX = "rk_svc_";
 
 /** Which variable belongs to which service. The dispatcher's keeps its original
  * name: renaming it would be a deployment change this chapter has not earned. */
-const PLATFORM_SERVICES: ReadonlyArray<readonly [string, string]> = [
+const PLATFORM_SERVICES = [
   [PLATFORM_CREDENTIAL_ENV, "dispatcher"],
   [GATEWAY_CREDENTIAL_ENV, "gateway"],
-];
+] as const satisfies ReadonlyArray<readonly [string, string]>;
+
+/** The internal services that exist, DERIVED FROM THE LIST ABOVE rather than
+ * retyped beside it (FR-044).
+ *
+ * `as const` is doing the work: without it `(typeof PLATFORM_SERVICES)[number][1]`
+ * widens to `string` and a route could declare a service nobody deploys. With it,
+ * adding a third internal service widens this union on its own and every route
+ * that must now decide about it stops compiling — which is the connection-metering chapter's lesson
+ * from `Dimension`, where adding a config key widened a type and the two-way
+ * ternary underneath it was the thing the compiler could not see. */
+export type PlatformService = (typeof PLATFORM_SERVICES)[number][1];
 
 /** Constant-time-ish: compare lengths first, then every byte. A platform
  * credential is a shared secret, and an early-exit compare on a shared secret is
  * the one place a timing signal is worth the two lines to remove. */
 function secretMatches(presented: string, configured: string): boolean {
   if (presented.length !== configured.length) return false;
```

### `packages/e2e/src/harness.ts` — the e2e harness. Same story: the divergence was behind an APPLY failure.

7 differing lines, 1 hunk.

```diff title="packages/e2e/src/harness.ts"
@@ -399,19 +399,12 @@
       "RELAY_NATS_PORT",
       // The api decrypts webhook signing secrets and authenticates
       // the dispatcher. Both are configuration, and a child that invents either
       // would be a second source of truth for a credential.
       "RELAY_WEBHOOK_SECRET_KEY",
       "RELAY_INTERNAL_CREDENTIAL",
-      // The failed-authentication threshold and the counter's key
-      // prefix. Forwarded for the reason this list exists at all — turbo runs
-      // tasks in STRICT env mode, so an undeclared variable reaches a child as
-      // `undefined` and the `??` behind it silently wins. A suite that raised the
-      // threshold would raise it in the parent and not in the api the child runs.
-      "RELAY_AUTH_FAILURES_PER_MINUTE",
-      "RELAY_AUTH_KEY_PREFIX",
       // The rate-limit chapter's other half: where the notification relay posts its SMTP.
       // The lane runs Mailpit on 11025 and the default is 1025, so an
       // unforwarded variable is not a missing feature — it is a mailer talking
       // confidently to a port nothing is listening on.
       "RELAY_SMTP_URL",
       // The failed-authentication threshold and the counter's key
```

### `turbo.json` — the task graph's `globalEnv`, which every new environment variable joins. Its divergence was invisible until phase 4 made its hunks apply.

7 differing lines, 1 hunk.

```diff title="turbo.json"
@@ -47,29 +47,24 @@
         "RELAY_DELIVERY_RELAY",
         "RELAY_INTERNAL_CREDENTIAL",
         "RELAY_INTERNAL_CREDENTIAL_GATEWAY",
         "RELAY_METER_INTERVAL_MS",
         "RELAY_AUTH_FAILURES_PER_MINUTE",
         "RELAY_AUTH_KEY_PREFIX",
-        "RELAY_INTERNAL_CREDENTIAL_GATEWAY",
-        "RELAY_METER_INTERVAL_MS",
-        "RELAY_AUTH_FAILURES_PER_MINUTE",
-        "RELAY_AUTH_KEY_PREFIX",
         "RELAY_WEBHOOK_SECRET_KEY",
         "RELAY_EVENT_CONSUMER",
         "RELAY_NATS_REPLICAS",
         "RELAY_E2E_API_PORT",
         "RELAY_SMTP_URL",
         "RELAY_MAILPIT_URL",
         "RELAY_NOTIFICATION_RELAY",
         "RELAY_QUOTA_RELAY",
         "RELAY_DOCS_BASE_URL",
         "RELAY_API_URL",
         "RELAY_WS_URL",
-        "RELAY_DEMO_CREDENTIAL",
-        "RELAY_QUOTA_RELAY"
+        "RELAY_DEMO_CREDENTIAL"
       ]
     },
     "//#lint:root": {
       "inputs": [
         "**/*.{ts,mts,cts,mjs,js}",
         "eslint.config.mjs",
```

### `services/api/src/db/catalogue.ts` — the tenancy catalogue, after a comment named the test that drives it.

6 differing lines, 1 hunk.

```diff title="services/api/src/db/catalogue.ts"
@@ -179,14 +179,16 @@
 /** THE CLASSIFICATION, SEPARATED FROM THE QUERY, and separated for a reason worth
  * stating: the interesting arm is the one that returns `null`, and it cannot execute
  * against a real database that has no unclassified table — which is exactly the state
  * this check exists to keep. So the branch that fires only when somebody adds a table
  * is the one branch a live run can never reach.
  *
- * Pure, so a unit test can drive all four arms with rows it makes up. A file with
- * nothing to mock has no reason to be partially tested. */
+ * Pure, so `catalogue.test.ts` drives all four arms with rows it makes up — the same
+ * argument as `webhooks/disable.ts` and `webhooks/analytics.ts`, both pure and both
+ * pinned at 100 for it. A file with nothing to mock has no reason to be partially
+ * tested. */
 export function classifyRow(row: CatalogueRow): TableClassification {
   const via = row.fk_targets ?? [];
   // ORDER MATTERS, AND ONLY IN ONE PLACE: a spine table with no environment_id and no
   // foreign key classifies the same either way, but checking `direct` first means a
   // future spine table that GAINS the column reports as `direct` and its list entry
   // becomes visibly wrong rather than silently ignored.
```

### `services/gateway/src/typing.itest.ts` — the typing suite, after chapter 4.9 repaired the presence payload it publishes.

4 differing lines, 1 hunk.

```diff title="services/gateway/src/typing.itest.ts"
@@ -127,12 +127,16 @@
       }
       return (options.backfillFrames ?? {}) as never;
     },
     sendMessage: async () => {
       throw new Error("not used");
     },
+    // NULL, WHICH IS WHAT A GATEWAY WITH NO METERING CREDENTIAL GETS. This suite is
+    // about typing delivery and reports nothing; the api's side takes the same safe direction, so
+    // with nothing configured no report is sent and no route is reached.
+    reportUsage: async () => null,
   };
   const fanout = options.allFabrics ? createFanout({ url, logger: silent }) : undefined;
   const presence = options.allFabrics
     ? createPresence({ url, logger: silent })
     : undefined;
   const membership =
```

### `services/api/src/webhooks/test-event.itest.ts` — the webhook test-event suite.

2 differing lines, 1 hunk.

```diff title="services/api/src/webhooks/test-event.itest.ts"
@@ -15,13 +15,13 @@
   recordAttemptOutcome,
   Repository,
 } from "../db/repository";
 import { encryptSecret, mintSigningSecret } from "./secret";
 import { withoutRequestId } from "../isolation/compare";
 
-// Proving an endpoint works again (FR-013…FR-017, research R8).
+// Proving an endpoint works again (FR-WHK-09, research R8).
 //
 // THIS SUITE PLAYS THE DISPATCHER. `POST /test` creates a real delivery and then
 // watches the row, because the attempt happens in another process — so something
 // has to make that attempt, and importing the dispatcher's build into the api's
 // test lane would make this suite fail whenever the packages happened to build in
 // the other order.
```

### `.gitignore` — one line. `corpus.json` is written by the scale scripts and was added by feature 046 — the commit that took the chain from 109 problems to 110, nine chapters ago.

1 differing lines, 1 hunk.

```diff title=".gitignore"
@@ -2,6 +2,7 @@
 dist/
 coverage/
 .turbo/
 *.log
 .env*
 .DS_Store
+corpus.json
```

### `services/api/package.json` — the api's dependencies, after nodemailer arrived and drizzle-kit left.

1 differing lines, 1 hunk.

```diff title="services/api/package.json"
@@ -31,10 +31,9 @@
   "devDependencies": {
     "@nestjs/cli": "^11.0.24",
     "@nestjs/testing": "^11.1.28",
     "@swc/core": "^1.15.47",
     "@types/nodemailer": "^8.0.1",
     "@types/pg": "^8.20.3",
-    "drizzle-kit": "^0.31.10",
     "unplugin-swc": "^1.5.9"
   }
 }
```

### `packages/test-harness/src/sentinel.sql` — the sentinel guard's table list, which every guarded table joins.

19 differing lines, 1 hunk. The connection-metering chapter's table arrives here
because the chapter that added it changed no fence.

```diff title="packages/test-harness/src/sentinel.sql"
@@ -163,13 +163,30 @@
     -- `usage_active_users` on a triple. The message interpolates
     -- `coalesce(to_jsonb(OLD) ->> 'id', to_jsonb(OLD)::text)`, so both still name the
     -- row they refused. `quota_notifications` does have one, and it is listed beside
     -- them rather than apart, because the guard's rule has never been about the key.
     'usage_periods',
     'usage_active_users',
-    'quota_notifications'
+    'quota_notifications',
+    -- THE CONNECTION-METERING CHAPTER'S ONE, AND IT IS KEYED DIFFERENTLY FROM EVERY
+    -- NAME ABOVE IT. `usage_connections` is keyed `(connection_id, period)` — the
+    -- environment is a column it carries rather than the first thing it is keyed on,
+    -- because a connection's identity is the connection and its period is which month
+    -- the minutes fall in.
+    --
+    -- The rule this array follows is the COLUMN, not the key, and the column is there:
+    -- `environment_id uuid NOT NULL REFERENCES environments(id)`, written by the api
+    -- from the authenticated identity and never by the gateway. So the trigger's WHEN
+    -- clause compiles and a cross-environment delete meets it, exactly as for the four
+    -- above.
+    --
+    -- AND ITS BAIT NEEDS NO `delivered_at` CONCESSION. Nothing drains this table: the
+    -- credit path looks a row up by its own key and the reporting path reads one
+    -- environment. It is the first guarded table since `read_positions` whose bait can
+    -- sit there claimable because there is no claim to be made.
+    'usage_connections'
   ] LOOP
     EXECUTE format('DROP TRIGGER IF EXISTS __sentinel_guard_%1$s ON %1$I', t);
     EXECUTE format(
       'CREATE TRIGGER __sentinel_guard_%1$s
          BEFORE UPDATE OR DELETE ON %1$I FOR EACH ROW
          WHEN (__is_sentinel(OLD.environment_id))
```

---

## Nine files hosted media edits that no chapter can anchor (chapter 4.10)

Chapter 4.10 edits seventeen fenced files. It publishes eight of the hunks itself; these nine
are here, and the reason is the one thing this appendix makes visible.

A chapter's hunk is applied **at that chapter**, against the state the chain has reached by
then. This file is applied **after every chapter**. So a hunk whose anchor lines were added
HERE has no context a chapter can match — at any width. `turbo.json` reaches chapter 4.10 with
67 lines where this appendix leaves 75; `codes.ts` with 324 where it leaves 429;
`vitest.coverage.config.mts` with 567 where it leaves 1,182. In each of them the lines this
chapter's change sits between are this file's own.

**Two of the ten that did stay in the chapter needed a narrower window for the same reason.**
`-U6` reaches appendix-added lines and `-U2` or `-U3` does not, which is the documented repair:
keep the chapter's change and trim the context the chain does not carry. These seven have no
width that works, because the change is not *near* the appendix's lines — it is *between* them.

And two of the seven anchor in their first hunk and not their second, which would let half of
each file's change live in the chapter. Both go here whole: a file whose two edits are made in
one commit and shown in two places is worse for a reader than a file shown once in the wrong
place.

What they do, briefly, so the entry is readable without the chapter:

- **`codes.ts`** gains hosted media's four refusal codes and `service_unavailable`, the 503
  ladder's fallback.
- **`app.module.ts`** registers `MediaModule`. Without it the route does not exist and every
  test in the chapter gets a 404 that reads as a routing bug.
- **`targets.ts`** classifies `POST /v1/media` for the cross-tenant gauntlet, which found it
  unclassified on the build that registered the module.
- **`sentinel.ts`** and **`sentinel.sql`** add `media_objects` to the harness's
  global-operation guard: the table's name in the list, and the bait row that proves the guard
  is armed. The third edit of that set, the accounting case, is in the chapter.
- **`turbo.json`** adds the store's four environment variables to the `test:integration`
  task's key, which is what makes a media suite's result depend on the address it ran against.
- **`vitest.coverage.config.mts`** gets the same four variables and the chapter's five
  per-file coverage pins.
- **`gauntlet.itest.ts`** and **`guard.itest.ts`** are the last two, and they are here for a
  different reason worth separating from the other seven. Both anchor perfectly well at
  chapter 4.10 — and putting them there breaks this file's **own** older hunks for the same
  two paths, which were written against a state that no longer exists once the chapter's
  change lands first. A hunk that works and unanchors somebody else's is still a broken
  chain. They go last, after the hunks they would otherwise have invalidated.

```diff title="packages/protocol/src/codes.ts"
@@ -259,12 +259,35 @@
   // the dimension, the figures and the resume date, because a close reason is a short
   // string with nowhere to put them. ONE entry rather than two: the quota chapter
   // registered this and the metering chapter's port arrived registering it again, and
   // a duplicate key is a `codes.test.ts` failure rather than a second meaning.
   quota_exceeded:
     "a monthly quota is exhausted; the message names the dimension, the figures and the date it resumes",
+  // ── HOSTED MEDIA'S FOUR REFUSALS, AND THREE OF THEM ARE PERMANENT ──────────────
+  //
+  // FR-MED-02 names three conditions and the brief counted four. The fourth is the
+  // SAD's degradation row — *"Object storage lost … Upload slots return a specific
+  // error"* — which FR-MED-02 does not carry, and it is the only one of the four a
+  // client should retry. That asymmetry is the whole reason they are four codes and
+  // not one: transcode, compress and free space are all wasted advice for the store
+  // being briefly unreachable, and retrying is wasted advice for the other three.
+  //
+  // NONE OF THEM IS `quota_exceeded`, for the argument this file already makes twice.
+  // `channel_member_limit_exceeded` below says *"NOT `quota_exceeded`. That is a
+  // monthly, billable, resets-on-a-date refusal whose message promises a resume
+  // date"* — and a storage cap does not reset on a date. It is a LEVEL: the figure
+  // falls when objects are deleted and not when the month turns, which is why
+  // FR-RTL-05 had to be amended rather than stretched to cover it.
+  media_type_not_allowed:
+    "that media type is not accepted; the message names the type, and the accepted set is in the reference",
+  media_too_large:
+    "the declared size exceeds the limit for its kind; the message names both figures",
+  media_storage_exhausted:
+    "this environment's stored bytes would exceed its limit; delete media or raise the cap — waiting does not help",
+  media_storage_unavailable:
+    "the media store cannot be reached; nothing was reserved and the same request will succeed once it recovers",
   webhook_endpoint_limit_reached:
     "this environment already holds the maximum number of webhook endpoints; delete one, or use another environment",
   webhook_url_invalid: "the url is not a valid absolute URL — send scheme, host and path",
   webhook_url_insecure:
     "the url must use https; a signature over a plaintext channel protects the body, not the reader",
   webhook_url_private_address:
@@ -359,12 +382,33 @@
   //
   // ONLY FOR A STORE THAT DID NOT ANSWER. A 404 or a syntax error from ClickHouse means
   // the PLATFORM's statement is wrong, and telling a customer to retry a query that will
   // never work is worse than telling them nothing. Those stay `internal_error`.
   analytics_unavailable:
     "the analytics service did not answer in time; the rest of the API is unaffected and this request is worth retrying",
+
+  /** THE 503 LADDER'S FALLBACK, AND THE ONLY CODE HERE NOTHING THROWS (FR-018).
+   *
+   * `ProtocolErrorFilter` derives a code from the status when a thrower does not name
+   * one, and its own comment calls the `internal_error` fallback *"a lie the client
+   * cannot act on"* — twice, about the 400 chapter 2.2 fixed and the 403 the
+   * credentials chapter fixed. Hosted media adds 415, 413, 402 and 503 to the
+   * platform, and three of those four have a code the ladder can honestly use.
+   *
+   * 503 DOES NOT, AND THAT IS WHY THIS EXISTS. Both of the platform's 503s today name
+   * a specific store — `analytics_unavailable` and `media_storage_unavailable` — and
+   * neither generalises to a 503 from somewhere else. Mapping the ladder to either
+   * would tell a client that the store it names is down when it may be fine.
+   *
+   * SO IT SAYS LESS, ON PURPOSE. The two specific codes stay the right answer for the
+   * two throwers that know which dependency failed; this one carries the only two
+   * facts the status alone supports — something the request needed did not answer,
+   * and retrying is reasonable. A named code always wins over the ladder, so adding
+   * this takes nothing away from either. */
+  service_unavailable:
+    "a dependency this request needed did not answer; the rest of the API is unaffected and the request can be retried",
 } as const;
 
 export type ErrorCode = keyof typeof ERROR_CODES;
 
 /** Whether a string the api sent is a code this registry defines.
  *
```

```diff title="services/api/src/app.module.ts"
@@ -6,12 +6,13 @@
 import { APP_FILTER } from "@nestjs/core";
 
 import { AuthModule } from "./auth/auth.module";
 import { AuthenticateMiddleware } from "./auth/authenticate.middleware";
 import { HealthController } from "./health.controller";
 import { InternalModule } from "./internal/internal.module";
+import { MediaModule } from "./media/media.module";
 import { MessagesModule } from "./messages/messages.module";
 import { ChannelsModule } from "./channels/channels.module";
 // Registered here for the reason `ChannelsModule` is: without this
 // line the module is compiled, exported, imported by nothing, and none of the user
 // routes exist. The file appeared in no task until an enumeration asked which
 // chapter fences it.
@@ -24,13 +25,13 @@
 import { TenancyModule } from "./tenancy/tenancy.module";
 import { LOGGER, apiLogger } from "./logger";
 import { ProtocolErrorFilter } from "./protocol-error.filter";
 import { LimitsModule } from "./limits/limits.module";
 import { RateLimitMiddleware } from "./limits/rate-limit.middleware";
 import { RequestContextMiddleware } from "./request-context.middleware";
-import { RequestLogMiddleware } from "./request-log/request-log.middleware";
+import { RequestLogMiddleware, requestLogEnabled } from "./request-log/request-log.middleware";
 import { RequestLogModule } from "./request-log/request-log.module";
 import { ANALYTICS_PUBLISHER } from "./webhooks/analytics";
 import { createJetStreamPublisher, ensureAnalyticsStream } from "./outbox/jetstream.publisher";
 import type { Publisher } from "./outbox/publisher";
 
 // The application described as a module graph — ADR-15's convention for the
@@ -53,12 +54,17 @@
     LimitsModule,
     // Chapter 4.8's read surface. Registered here for the reason `ChannelsModule` and
     // `UsersModule` are: without this line the module compiles, is imported by nothing,
     // and the route does not exist — which `pnpm build` would not notice and the
     // cross-tenant gauntlet would, because it derives its targets from the router.
     RequestLogModule,
+    // HOSTED MEDIA, AND THIS LINE IS THE WHOLE OF WHETHER THE ROUTE EXISTS. A module
+    // written, tested and never registered gives a 404 that reads as a routing bug
+    // rather than as a missing import — chapter 4.6's `Unknown chapter id`, one
+    // repository over.
+    MediaModule,
   ],
   controllers: [HealthController],
   providers: [
     { provide: LOGGER, useFactory: apiLogger },
     { provide: APP_FILTER, useClass: ProtocolErrorFilter },
     RequestContextMiddleware,
@@ -94,16 +100,29 @@
     // REQUEST LOG IS SECOND, NOT LAST, AND THE POSITION IS LOAD-BEARING.
     // `RateLimitMiddleware` refuses a 429 with `res.end(); return;` and never calls
     // `next()`, so a producer registered after it never runs -- and a rate-limited request
     // is exactly the one an operator opens a request log to find. Second, it attaches its
     // `finish` listener before anything can short-circuit, and reads `req.principal` when
     // the listener fires rather than when it is attached. Attach early, read late.
+    //
+    // AND `RELAY_REQUEST_LOG=off` TAKES IT OUT OF THE CHAIN RATHER THAN SHORT-CIRCUITING
+    // INSIDE IT. The unit lane sets it: `pnpm test` is the Docker-free gate and this
+    // producer is the only thing in the chain that reaches a broker, so with it registered
+    // the gate has needed a running NATS since the chapter that added it.
     consumer
       .apply(
-        RequestContextMiddleware,
-        RequestLogMiddleware,
-        AuthenticateMiddleware,
-        RateLimitMiddleware,
+        ...(requestLogEnabled()
+          ? ([
+              RequestContextMiddleware,
+              RequestLogMiddleware,
+              AuthenticateMiddleware,
+              RateLimitMiddleware,
+            ] as const)
+          : ([
+              RequestContextMiddleware,
+              AuthenticateMiddleware,
+              RateLimitMiddleware,
+            ] as const)),
       )
       .forRoutes("{*path}");
   }
 }
```

```diff title="services/api/src/isolation/targets.ts"
@@ -405,12 +405,39 @@
   // `accepts: "application"` MATCHES THE DECORATOR AND THE TWO ARE NOT COMPARED BY
   // ANYTHING. The controller declares `@Accepts("application")`; this field tells the
   // gauntlet which credential to attack with, so a `"user"` here would send it at the
   // route with a token the guard refuses at the door and the handler would never run.
   { method: "GET", path: "/v1/request-log", accepts: "application", shape: "list" },
 
+  // ── THE UPLOAD SLOT (chapter 4.10, FR-MED-01), AND THE DERIVATION FOUND IT EIGHTH ──
+  //
+  // Run before this entry existed: `44 derived, 37 attacked, 6 exempt` with
+  // `unclassified: ["POST /v1/media"]`. Eight chapters, eight times, and the list has
+  // never once been ahead of the derivation.
+  //
+  // `credential` AND NOT `write`, WHICH IS THE ONE DECISION HERE THAT COULD GO EITHER
+  // WAY. It writes a row, so `write` is the tempting shape — but a `write` attack forges
+  // a tenant-owned identifier from another environment, and this request body is
+  // `{ filename, mime_type, bytes }`. **There is no identifier in it to forge.** That is
+  // `POST /auth/dev-token`'s sentence word for word, and the shape's own definition eight
+  // hundred lines up: *"the shape a foreign-identifier attack cannot express"*.
+  //
+  // AND WHAT THE ATTACK SHOWS INSTEAD IS THE OBJECT KEY. `media.service.ts:71` builds it
+  // as `${environment}/${id}`, from the repository's environment — which came off the
+  // principal the guard resolved, not off anything the caller sent. So the claim is that
+  // two tenants asking the identical question get keys under different prefixes, and
+  // neither can name the other's: the tenant is in the URL the client uploads to, chosen
+  // by the server, one layer below the request.
+  //
+  // `either`, BECAUSE THE CONTROLLER SAYS `@Accepts("application", "user")` and FR-MED-01
+  // says *"on request (user token or API key)"*. The read-position route is the precedent
+  // and it is attacked in both blocks; so is this one. A `"user"` here would understate
+  // which attacks apply, and this project has a record of a route that was named and not
+  // covered.
+  { method: "POST", path: "/v1/media", accepts: "either", shape: "credential" },
+
   // ── credential, internal, end-user token ─────────────────────────────────────
   //
   // `credential` AND NOT `read`, WHICH IS THE SIBLING ROUTE'S ARGUMENT VERBATIM. The
   // backstop asks what this connection may hear and changes nothing, so `read` is the
   // tempting shape — but a `read` attack forges an IDENTIFIER, and this route takes
   // none: no body, no path parameter, no query. Its only tenant-scoped input is the
```

```diff title="packages/test-harness/src/sentinel.ts"
@@ -66,12 +66,15 @@
   quotaPeriod: string;
   quotaNotificationId: string;
   /** The connection-metering chapter's, and the fifth guarded table's. Keyed
    * `(connection_id, period)`, so the bait needs an id of its own rather than
    * borrowing the sentinel's user or channel. */
   usageConnectionId: string;
+  /** Hosted media's, and the sixth guarded table's. Keyed on its own `id`, so the
+   * bait needs one rather than borrowing the sentinel's user or channel. */
+  mediaObjectId: string;
   /** `__sentinel__:<owner>`, on every row, so a failure says whose it is. */
   name: string;
 }
 
 /** A v4-shaped uuid derived from a string. Deterministic, so a file's sentinel is
  * the same on every run and the delete-then-insert in `plant` is exact. */
@@ -95,12 +98,13 @@
     environmentId: id("environment"),
     userId: id("user"),
     channelId: id("channel"),
     quotaPeriod: "1999-01-01",
     quotaNotificationId: id("quota-notification"),
     usageConnectionId: id("usage-connection"),
+    mediaObjectId: id("media-object"),
     name: `__sentinel__:${owner}`,
   };
 }
 
 /** The shared sentinel this feature does NOT have, kept as a named export so a
  * reader looking for one finds this comment instead. */
@@ -150,12 +154,13 @@
   // The subject the plant below writes, not the one it used to: a cleanup keyed on
   // a stale subject leaves every row it was meant to remove.
   await q(`DELETE FROM outbox         WHERE subject = $1`, [`events.${s.name}.bait`]);
   await q(`DELETE FROM read_positions WHERE environment_id = $1`, [s.environmentId]);
   // The quota chapter's three, and they come before `users` for the reason the note
   // above gives: `usage_active_users` references it.
+  await q(`DELETE FROM media_objects       WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM usage_connections   WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM quota_notifications WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM usage_active_users  WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM usage_periods       WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM channels       WHERE environment_id = $1`, [s.environmentId]);
   await q(`DELETE FROM users          WHERE environment_id = $1`, [s.environmentId]);
@@ -286,12 +291,34 @@
     `INSERT INTO usage_connections (connection_id, period, environment_id, minutes)
      VALUES ($1, $2, $3, 0)
      ON CONFLICT (connection_id, period) DO UPDATE SET minutes = EXCLUDED.minutes`,
     [s.usageConnectionId, s.quotaPeriod, s.environmentId],
   );
 
+  // AND HOSTED MEDIA'S. The sixth guarded table, and the first whose row describes
+  // something OUTSIDE the database: a slot the platform agreed to, for an object in a
+  // store Relay never touches (ADR-13).
+  //
+  // IT REUSES THE SENTINEL'S USER, which is the `read_positions` argument — the row
+  // only has to exist for the WHEN clause to have something to test — and it also
+  // exercises the nullable side by being the case where `user_id` is PRESENT. The
+  // absent case belongs to a test rather than to bait.
+  //
+  // `DO UPDATE` on `declared_bytes` for the reason the two rows above give: the id is
+  // derived from the owner, so the key is the same on every run for ever, and a
+  // fixture that guarantees only existence guarantees whatever the first run wrote.
+  // Here the VALUE matters: the storage quota is a `sum(declared_bytes)` over this
+  // table, so a bait row of an unknown size would move a figure a test asserts.
+  await q(
+    `INSERT INTO media_objects
+       (id, environment_id, user_id, filename, mime_type, declared_bytes, object_key)
+     VALUES ($1, $2, $3, 'bait.jpg', 'image/jpeg', 1, $4)
+     ON CONFLICT (id) DO UPDATE SET declared_bytes = EXCLUDED.declared_bytes`,
+    [s.mediaObjectId, s.environmentId, s.userId, `sentinel/${s.environmentId}/bait.jpg`],
+  );
+
   // DRAIN BAIT: unpublished events. `outbox` carries no environment_id — it is
   // platform bookkeeping — so the subject is what identifies these, and it is also
   // why the trigger cannot guard them (data-model.md). The count is `BAIT_ROWS` and
   // not one, because a single row cannot tell a batch that ignored its limit from
   // one that honoured it.
   //
```

```diff title="packages/test-harness/src/sentinel.sql"
@@ -180,13 +180,20 @@
     -- above.
     --
     -- AND ITS BAIT NEEDS NO `delivered_at` CONCESSION. Nothing drains this table: the
     -- credit path looks a row up by its own key and the reporting path reads one
     -- environment. It is the first guarded table since `read_positions` whose bait can
     -- sit there claimable because there is no claim to be made.
-    'usage_connections'
+    'usage_connections',
+    -- HOSTED MEDIA'S, AND IT IS THE FIRST GUARDED TABLE WHOSE ROWS DESCRIBE SOMETHING
+    -- OUTSIDE THE DATABASE. `media_objects` carries `environment_id` written by the api
+    -- from the authenticated identity, so the WHEN clause compiles like every name
+    -- above — but the row is a claim about an object in a store Relay never touches
+    -- (ADR-13). A cross-environment delete here would orphan bytes rather than lose
+    -- them, which is a different failure from the others and refused the same way.
+    'media_objects'
   ] LOOP
     EXECUTE format('DROP TRIGGER IF EXISTS __sentinel_guard_%1$s ON %1$I', t);
     EXECUTE format(
       'CREATE TRIGGER __sentinel_guard_%1$s
          BEFORE UPDATE OR DELETE ON %1$I FOR EACH ROW
          WHEN (__is_sentinel(OLD.environment_id))
```

```diff title="turbo.json"
@@ -58,13 +58,17 @@
         "RELAY_MAILPIT_URL",
         "RELAY_NOTIFICATION_RELAY",
         "RELAY_QUOTA_RELAY",
         "RELAY_DOCS_BASE_URL",
         "RELAY_API_URL",
         "RELAY_WS_URL",
-        "RELAY_DEMO_CREDENTIAL"
+        "RELAY_DEMO_CREDENTIAL",
+        "RELAY_MINIO_ENDPOINT",
+        "RELAY_MINIO_ACCESS_KEY",
+        "RELAY_MINIO_SECRET_KEY",
+        "RELAY_MINIO_BUCKET"
       ]
     },
     "//#lint:root": {
       "inputs": [
         "**/*.{ts,mts,cts,mjs,js}",
         "eslint.config.mjs",
```

```diff title="vitest.coverage.config.mts"
@@ -35,12 +35,23 @@
     // env; it did not look at the suites that boot the app in process.
     //
     // A relay catches and logs its own errors, so the guard's refusal inside one is
     // a log line and a green lane. Setting the flags here makes the quiet database
     // a property of the lane rather than a convention nobody applied.
     env: {
+      // THE OBJECT STORE, IN BOTH LANES THAT RUN `.itest.ts` FILES. Chapter 4.9 put a
+      // credential in one of these two configs and not the other, and `pnpm coverage`
+      // stayed red — keeping three cross-tenant attacks skipped in the run that measures
+      // constitution VI's own coverage bar — until eight minutes of a coverage run said
+      // so. The media suites reach a real store; without these they reach nothing and
+      // the refusal they get is `media_storage_unavailable`, which is a correct answer
+      // to the wrong question.
+      RELAY_MINIO_ENDPOINT: "http://localhost:9100",
+      RELAY_MINIO_ACCESS_KEY: "relay",
+      RELAY_MINIO_SECRET_KEY: "relay-secret",
+      RELAY_MINIO_BUCKET: "relay-media",
       RELAY_OUTBOX_RELAY: "off",
       RELAY_DELIVERY_RELAY: "off",
       RELAY_NOTIFICATION_RELAY: "off",
       RELAY_EVENT_CONSUMER: "off",
       // The quota relay, the fourth. Same reason as the other three.
       RELAY_QUOTA_RELAY: "off",
@@ -1167,12 +1178,88 @@
         "services/api/src/request-log/request-log.controller.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
+
+        // ── hosted media (chapter 4.10) ──────────────────────────────────────────
+        //
+        // AND THREE OF THESE FIVE FILES DO NOT APPEAR IN THE TEXT TABLE AT ALL. v8's
+        // text reporter omits a file at 100/100/100/100, so a sweep for "which new files
+        // is the report showing" finds `media.service.ts` and `store.ts` and concludes
+        // the other three were never measured. They were: `coverage-summary.json` lists
+        // all five. **Read the json summary when the question is which files were seen**
+        // — the table answers a different question, which is which files have a gap.
+        //
+        // The signer. 100/100/100/100, and it is a pure function over strings with no
+        // clock and no I/O — `presign.test.ts` drives every branch and `presign.itest.ts`
+        // asks the store whether the bytes are right, which is a different question that
+        // no coverage number can answer.
+        "services/api/src/media/presign.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The MIME table. 100/100/100/100, including the arm that only exists because
+        // `ALLOWED_TYPES[mimeType]` on a plain object literal answers for `constructor`:
+        // `kindOf("constructor")` returned a FUNCTION, which is truthy, so one declared
+        // type defeated the type refusal — and then `KIND_CAPS[thatFunction]` is
+        // `undefined`, `bytes > undefined` is false, and it defeated the size refusal
+        // too. `Object.hasOwn` is the fix and `kinds.test.ts` pins the case.
+        "services/api/src/media/kinds.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The route. 100/100/100/100, and its one branch is the tenancy one —
+        // `principal.kind === "user"` decides whether the row records an uploader.
+        // Constitution VI's 100%-branch clause names tenant isolation, and this is the
+        // second Part 4 chapter to MEET it rather than pin around it (049 was the first).
+        // Both arms are driven over HTTP by `media.itest.ts`: an API key's slot has no
+        // user and a user token's does, asserted as a pair so that neither passes against
+        // a column that is always the same.
+        "services/api/src/media/media.controller.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The slot service. 100 / 92.85 / 100 / 100, raised from 83.33 / 66.66 / 100 /
+        // 83.33 at the end of phase 3 — the three uncovered lines then were the three
+        // `throw`s, and phases 4 and 5 are the chapters that drive them.
+        //
+        // 92.85 IS 13 OF 14 AND THE FOURTEENTH IS ATTRIBUTED TO LINE 32, WHICH IS
+        // `@Injectable()`. Every branch this file writes has both arms driven over HTTP:
+        // the three refusals, the store probe, and the user resolution in each direction.
+        // v8 counts something in the decorator's own output and there is no source line
+        // to cover — the same shape as 045's note that a `binary-expr` arm counts as
+        // covered when the operand was merely evaluated. Pinned at 92 rather than
+        // measured down to nothing, and named rather than left as a mystery.
+        "services/api/src/media/media.service.ts": {
+          branches: 92,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // The store client. 100 / 100 / 100 / 100, from 77.77 / 53.84 / 100 / 85.71.
+        //
+        // WHAT CLOSED IT WAS A SERVER, NOT A MOCK. `ensureBucket`'s throw needs a store
+        // that answers something other than 200 or 409, and a running MinIO cannot be
+        // asked for that on demand — so `store.test.ts` stands up an HTTP server that
+        // answers to order and drives the 403, the 500, and the 409 that is NOT
+        // `BucketAlreadyOwnedByYou`. That last one is the case a status-only check reads
+        // as success: another tenant of the same store owning the bucket.
+        "services/api/src/media/store.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
       },
     },
   },
   plugins: [
     swc.vite({
       module: { type: "es6" },
```

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -360,12 +360,60 @@
     const serialised = JSON.stringify(body ?? "");
     expect(serialised).not.toContain(t.victim.channelId);
     expect(serialised).not.toContain(t.victim.userId);
     expect(serialised).not.toContain(t.victim.environmentId);
   });
 
+  // ── the upload slot (chapter 4.10, FR-MED-01) ──────────────────────────────────
+  //
+  // `credential` SHAPE, SO THE ATTACK IS THE OBJECT KEY. `{ filename, mime_type, bytes }`
+  // carries no tenant-owned identifier — there is nothing to forge — and the tenant
+  // reaches the key through the principal the guard resolved. What a leak would look
+  // like is one tenant's signed URL pointing inside another's prefix, because the URL is
+  // handed to a client that Relay does not control and the store enforces only the
+  // signature, never the tenancy.
+  //
+  // BOTH CREDENTIAL CLASSES, because `targets.ts` files this route as `accepts: "either"`
+  // and the controller declares `@Accepts("application", "user")`. Attacking with one
+  // would cover half the door.
+  it("POST /v1/media — two tenants get keys under their own prefixes, both credential classes", async () => {
+    attacked.add("POST /v1/media");
+    const ask = async (credential: string) => {
+      const res = await fetch(`${url}/v1/media`, {
+        method: "POST",
+        headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
+        body: JSON.stringify({ filename: "x.png", mime_type: "image/png", bytes: 32 }),
+      });
+      expect(res.status).toBe(201);
+      return (await res.json()) as { media_id: string; upload_url: string };
+    };
+
+    const byKey = await ask(t.attacker.credential);
+    const byToken = await ask(attackerToken);
+    const victim = await ask(t.victim.credential);
+
+    // THE ATTACKER'S TWO URLS NAME THE ATTACKER'S ENVIRONMENT AND NOTHING ELSE.
+    for (const slot of [byKey, byToken]) {
+      const key = decodeURIComponent(new URL(slot.upload_url).pathname);
+      expect(key).toContain(`/${t.attacker.environmentId}/`);
+      expect(key).not.toContain(t.victim.environmentId);
+      // and the whole URL, because a query parameter is part of what the store reads
+      expect(slot.upload_url).not.toContain(t.victim.environmentId);
+    }
+
+    // A NON-VACUOUS CONTROL: the victim's own slot really does sit under a different
+    // prefix, so "not the victim's" above is isolation rather than an empty string.
+    const victimKey = decodeURIComponent(new URL(victim.upload_url).pathname);
+    expect(victimKey).toContain(`/${t.victim.environmentId}/`);
+    expect(victimKey).not.toContain(t.attacker.environmentId);
+
+    // AND THE ROWS ARE THE ATTACKER'S. Three slots, three distinct ids, and the two
+    // credential classes wrote into the same environment as each other.
+    expect(new Set([byKey.media_id, byToken.media_id, victim.media_id]).size).toBe(3);
+  });
+
   // ── the two routes this chapter added ──────────────────────────────────────────
   //
   // A chapter that adds an endpoint attacks it in the same chapter. The derivation
   // found these before the classification did: `targets.itest.ts` went from 9 targets
   // to 11 and failed naming both as unclassified.
   it("POST /v1/channels/:channelId/members — refuses, and adds nobody", async () => {
```

```diff title="packages/test-harness/src/guard.itest.ts"
@@ -206,12 +206,32 @@
     values: (s) => [s.usageConnectionId, s.quotaPeriod, s.environmentId],
     touch: `minutes = minutes`,
     mark: `minutes = $1`,
     read: `SELECT minutes AS v FROM usage_connections WHERE environment_id = $1`,
     marked: (n) => String(n),
   },
+  // HOSTED MEDIA'S, AND ITS MARK IS THE COLUMN THE QUOTA READS. `declared_bytes` is
+  // what `sum()` runs over for the storage cap, so marking it is marking the figure
+  // the chapter is about — and `filename` would have done just as well for the
+  // mechanism while saying nothing about what the table is for.
+  media_objects: {
+    plant: `INSERT INTO media_objects
+              (id, environment_id, user_id, filename, mime_type, declared_bytes, object_key)
+            VALUES ($1, $2, $3, 'bait.jpg', 'image/jpeg', 1, $4)
+            ON CONFLICT (id) DO NOTHING`,
+    values: (s) => [
+      s.mediaObjectId,
+      s.environmentId,
+      s.userId,
+      `sentinel/${s.environmentId}/bait.jpg`,
+    ],
+    touch: `declared_bytes = declared_bytes`,
+    mark: `declared_bytes = $1`,
+    read: `SELECT declared_bytes AS v FROM media_objects WHERE environment_id = $1`,
+    marked: (n) => String(n),
+  },
 };
 
 let admin: pg.Client;
 let plain: pg.Client;
 
 beforeAll(async () => {
```

---

## Two files the chapter-4.10 follow-up touched (`gaps.md` 056-9, 056-10)

Neither belongs to a chapter. Both come from closing gaps that chapter opened and recorded,
in work that publishes no chapter of its own.

**`services/api/vitest.config.mts`** switches the request-log producer off for the unit
lane. `ci.yml` calls `pnpm test` *"the Docker-free gate, exactly as chapter 1.1 defined
it"*, and it had needed a running broker with the `ANALYTICS` stream since the chapter that
added that producer: point the api at a broker that is not there and
`main.test.ts > logs exactly one structured line per request` goes red, because the
producer's failure path logs a second line through the logger that test captures. Off in
the lane's own config rather than in CI, because the claim is about the lane and not about
one runner — **408 of 408 with every store pointed at a closed port.** The switch itself is
in `request-log.middleware.ts`, which carries no fence.

**`services/api/src/limits/auth-limiter.ts`** gains a clause. Its comment said *"this one
runs on every request that presents a credential"* — a claim about when a symbol runs, with
nothing named that runs it. It now names `AuthenticateMiddleware` and the `{*path}` that
`AppModule.configure()` applies it to, which one `grep` can check and which goes visibly
stale if the symbol moves. That is the convention `gaps.md` 056-10 exists for: the same
sentence shape, unverified, is how `ensureBucket` came to say *"on boot, every boot"* while
nothing called it at boot.

```diff title="services/api/vitest.config.mts"
@@ -8,12 +8,26 @@
 // node's). The config is .mts for the same reason: inside a
 // `"type": "commonjs"` package a .ts config would be loaded as CommonJS,
 // which vitest refuses.
 export default defineConfig({
   test: {
     include: ["src/**/*.test.ts"],
+    // THE DOCKER-FREE GATE, MADE DOCKER-FREE AGAIN.
+    //
+    // `ci.yml` calls `pnpm test` *"the Docker-free gate, exactly as chapter 1.1 defined
+    // it"* and it stopped being one when the request-log producer joined the middleware
+    // chain: every booted api opened a broker connection, and `main.test.ts > logs exactly
+    // one structured line per request` counted the producer's own failure line as a second
+    // line. Measured — `RELAY_NATS_URL=nats://127.0.0.1:1` turns it red locally, and in CI
+    // the broker is reachable while the stream is not, which is the same two lines with
+    // `NatsError: 503` in the second.
+    //
+    // SET HERE RATHER THAN IN CI, because the claim is about the lane and not about one
+    // runner. A variable in `ci.yml` would leave every developer's `pnpm test` depending on
+    // a broker they were told they did not need.
+    env: { RELAY_REQUEST_LOG: "off" },
   },
   plugins: [
     swc.vite({
       module: { type: "es6" },
       jsc: { transform: { legacyDecorator: true, decoratorMetadata: true } },
     }),
```

**`services/api/src/main.test.ts`** states its own precondition, because the lane flag above
does not reach it everywhere. `vitest.coverage.config.mts` runs the same `*.test.ts` files and
must NOT set `RELAY_REQUEST_LOG=off` — the integration suites in that same run assert on the
producer's rows — so the one test whose assertion counts **every** line the api emits switches
the producer off for itself. **A fix that went into one of those two configs and not the other
is what chapter 4.9 spent eight minutes of a coverage run finding, and this follow-up
reproduced it in the commit that closed 056-9.** The chapter-1.4 fence stays as chapter 1.4
wrote it: the flag it names belongs to a producer five chapters later, and a reader at 1.4 has
neither.

```diff title="services/api/src/main.test.ts"
@@ -1,13 +1,13 @@
 import "reflect-metadata";
 
 import { errorFrameSchema } from "@relay/protocol";
 import { createLogger } from "@relay/service-kit";
 import { Test } from "@nestjs/testing";
 import type { INestApplication } from "@nestjs/common";
-import { afterEach, describe, expect, it } from "vitest";
+import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
 
 import { AppModule } from "./app.module";
 import { LOGGER } from "./logger";
 
 const UUID_RE =
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
@@ -32,12 +32,37 @@
   await app.listen(0);
   return { app, url: await app.getUrl() };
 }
 
 describe("api skeleton", () => {
   let app: INestApplication | undefined;
+
+  // THE PRODUCER IS OFF FOR THIS FILE, AND THE REASON IS THE ASSERTION BELOW.
+  //
+  // `logs exactly one structured line per request` swaps the LOGGER provider for an array,
+  // so it counts EVERY line the api emits during the request — not just the access log. The
+  // request-log producer added five chapters later logs its own failure through that same
+  // logger, so with a broker it cannot reach there are two lines, and the test that has been
+  // green since this file was written goes red for a reason it is not about.
+  //
+  // SET HERE AS WELL AS IN `vitest.config.mts`, AND THE TWO SAY DIFFERENT THINGS. The lane's
+  // config makes the Docker-free gate Docker-free — a property of the lane, for whatever
+  // boots an app in it next. This one is this file's own precondition, and it is here because
+  // `vitest.coverage.config.mts` runs the same tests and does NOT set it: the coverage lane
+  // needs the producer ON for the integration suites that assert on its rows. A fix that went
+  // into one of those two configs and not the other is the shape chapter 4.9 paid eight
+  // minutes of a coverage run to find, and this file reproduced it.
+  const producer = process.env["RELAY_REQUEST_LOG"];
+  beforeAll(() => {
+    process.env["RELAY_REQUEST_LOG"] = "off";
+  });
+  afterAll(() => {
+    if (producer === undefined) delete process.env["RELAY_REQUEST_LOG"];
+    else process.env["RELAY_REQUEST_LOG"] = producer;
+  });
+
   afterEach(async () => {
     await app?.close();
     app = undefined;
   });
 
   it("answers /healthz with its shape and a fresh request id per response", async () => {
```

```diff title="services/api/src/limits/auth-limiter.ts"
@@ -57,14 +57,15 @@
     }
   }
 
   /** Has this address already spent its allowance?
    *
    * READS WITHOUT COUNTING. A check that also writes would refuse on its own
-   * questions, and this one runs on every request that presents a credential —
-   * including the valid ones.
+   * questions, and this one is called from `AuthenticateMiddleware`, which
+   * `AppModule.configure()` applies to `{*path}` — so it runs on every request that
+   * presents a credential, including the valid ones.
    *
    * When the shared store is unreachable it answers from the in-process count,
    * which is the whole point: the guarantee gets weaker, not absent. A key the
    * fallback could not admit answers `true` — refusing an address we cannot track
    * is the safe direction while degraded, and the cap makes that a bounded
    * population rather than everybody. */
```
