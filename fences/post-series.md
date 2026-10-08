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

### `services/api/src/internal/internal.module.ts` — the verification controller, registered.

4 differing lines, 2 hunks. A controller nobody registers is a route that does not exist — which an analysis pass has found in this repository once already.

```diff title="services/api/src/internal/internal.module.ts"
@@ -10,12 +10,13 @@
 } from "../outbox/jetstream.publisher";
 import type { Publisher } from "../outbox/publisher";
 import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
 import { BackfillController } from "./backfill.controller";
 import { InternalController } from "./internal.controller";
 import { DispatchController } from "./dispatch.controller";
+import { MediaVerificationController } from "./media.controller";
 import { MembershipsController } from "./memberships.controller";
 import { SessionController } from "./session.controller";
 import { UsageController } from "./usage.controller";
 
 // The internal routes reuse MessagesModule's providers wholesale — the
 // request-scoped Repository, the guard, the service. One write path, two
@@ -38,12 +39,15 @@
     // REGISTERED HERE, and a controller nobody registers is a route that does not
     // exist — which an analysis pass has found in this repository once already.
     MembershipsController,
     // And this chapter's, for the same reason and in the same place: `app.module.ts`
     // carries only `HealthController` and already imports this module.
     UsageController,
+    // The media worker's two routes. Fourth controller in a row registered here with
+    // the same note attached, which is how a convention earns the word.
+    MediaVerificationController,
   ],
   providers: [
     {
       provide: "DB",
       useFactory: (): Db => createDb(createPool()),
       scope: Scope.DEFAULT,
```

### `packages/config/src/infra.ts` — ClamAV joins the named infrastructure.

8 differing lines, 1 hunk. Seventh container, and the both-directions assertion in `infra.test.ts` is what makes this file impossible to forget.

```diff title="packages/config/src/infra.ts"
@@ -18,12 +18,20 @@
   // The sixth, and hosted media's (ADR-13, chapter 4.10). The api signs a URL and
   // the CLIENT uploads to it, so this container is reachable from outside the
   // network in a way the stores are not — and its host port is 9100, not MinIO's
   // conventional 9000, because ClickHouse's native port has published 9000 since
   // this file was written.
   "minio",
+  // The seventh, and the first that reads a customer's bytes (chapter 4.13).
+  // FR-MED-04's scanner: a signature engine is not a thing this workspace can write
+  // in TypeScript, and constitution VII's justification is the clause itself.
+  //
+  // IN THE DEFAULT PROFILE, unlike the media worker that talks to it. This container
+  // mutates nothing; the worker writes, and an unprofiled worker would rewrite every
+  // `pending` fixture in the lane during every suite.
+  "clamav",
 ] as const;
 
 export const DURABLE_VOLUMES = [
   "postgres-data",
   "nats-data",
   "clickhouse-data",
```

### `packages/config/src/infra.test.ts` — and the media worker joins the list of containers that are OURS.

6 differing lines, 1 hunk. The registry every artifact in feature 059 misidentified: `INFRA_SERVICES` names the *infrastructure*, and a container of Relay's own goes in `ours`. The assertion caught it on the first run.

```diff title="packages/config/src/infra.test.ts"
@@ -39,13 +39,17 @@
     // naming the local infrastructure while every test still passed. This chapter
     // added a fifth container and the gap is how it nearly went unnoticed.
     //
     // The services behind `--profile services` are Relay's own and are not
     // infrastructure, so they are excluded by name rather than by pattern: a
     // list is auditable and a pattern would silently absorb the next container.
-    const ours = new Set(["api", "gateway", "dispatcher"]);
+    // AND THE MEDIA WORKER IS THE FOURTH (4.13). This is the list T018 of that
+    // chapter's tasks said was `INFRA_SERVICES` — it is not: a new container of
+    // OURS goes here, and a new container of the INFRASTRUCTURE'S goes there. The
+    // task named the wrong file and the both-directions assertion said so in one run.
+    const ours = new Set(["api", "gateway", "dispatcher", "media-worker"]);
     // Only the `services:` block. Volume names sit at the same indentation one
     // block down, and a match that swept the whole file would report
     // `postgres-data` as an unregistered service.
     const services = compose.slice(0, compose.indexOf("\nvolumes:"));
     const declared = [...services.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)]
       .map((match) => match[1] as string)
```

### `packages/test-harness/src/bound-port.test.ts` — the media worker declares that it binds nothing.

7 differing lines, 1 hunk. Derived from the filesystem, so this entry becomes mandatory the moment `services/media-worker/src/main.ts` exists. The ingester's arrived two chapters late and turbo's cache hid the red.

```diff title="packages/test-harness/src/bound-port.test.ts"
@@ -56,12 +56,19 @@
     "services/ingester/src/main.ts",
     "the same shape as the dispatcher and for the same reason: it fetches from JetStream " +
       "and inserts into ClickHouse over HTTP, so it has no listener, no PORT and no " +
       "address to read back. It arrived in chapter 4.3 and this entry did not, which is " +
       "the half the derivation cannot supply on its own",
   ],
+  [
+    "services/media-worker/src/main.ts",
+    "a polling sweep with no inbound surface: it asks the api for a batch, reads the " +
+      "object store over HTTP and posts a verdict back, so nothing ever connects TO it. " +
+      "Written in the same commit as the file, because the ingester's entry was not and " +
+      "turbo's cache hid the red for two chapters",
+  ],
 ];
 
 const LISTENERS = serviceMains().filter(
   (rel) => !BINDS_NOTHING.some(([name]) => name === rel),
 );
 
```

### `services/api/src/isolation/targets.ts` — both seam routes classified, as `exempt` with reasons.

38 differing lines, 1 hunk. The derivation named them before the list did, which is the eleventh time.

```diff title="services/api/src/isolation/targets.ts"
@@ -378,12 +378,50 @@
   // is the platform and reaching every tenant is what a platform credential is for.
   //
   // The derivation found this route unclassified on the build that added it. That is
   // the sixth time in this repository, and the list has never once been ahead of it.
   { method: "POST", path: "/internal/usage/connections", accepts: "platform", shape: "write" },
 
+  // ── THE MEDIA WORKER'S SEAM (chapter 4.13), AND THE DERIVATION FOUND BOTH ────────
+  //
+  // Run before these two entries existed: `unclassified: ["GET /internal/media/pending",
+  // "POST /internal/media/:mediaId/verdict"]`. **The eleventh time in this repository,
+  // and the list has still never been ahead of the derivation.** The task that predicted
+  // this said so in advance for the first time — earlier versions of it hedged that the
+  // derivation *"may report nothing"* and called a green run the finding, which is
+  // backwards: a green run here would mean the derivation could not see `/internal`
+  // routes, and nine of them were already classified.
+  //
+  // BOTH ARE `exempt`, AND FOR A STRONGER REASON THAN `material`'s. Those three take one
+  // opaque id and derive the tenant from the row; these take **no tenant-shaped input at
+  // all**. `pending` has no parameters — the batch is the platform's oldest objects,
+  // whoever owns them — and `verdict` takes one object id and a finding about bytes. One
+  // worker serves every environment, so there is nothing for a forged request to widen.
+  //
+  // THAT IS THE ISOLATION PROPERTY STATED AS THE THING IT IS, and it is the reason the
+  // routes look alarming and are not: everywhere else in this platform a cross-tenant
+  // read is the defect, and here it is the contract. What makes it safe is not a
+  // predicate, it is the absence of a parameter — which `gauntlet.itest.ts` shows by
+  // presenting another tenant's object id to a route that cannot be told whose it is.
+  {
+    method: "GET",
+    path: "/internal/media/pending",
+    accepts: "platform",
+    shape: "exempt",
+    because:
+      "no parameters of any kind beyond a batch size: the route returns the platform's oldest unverified objects across every tenant by design (ADR-04, one worker serves all), so there is no foreign identifier to pair with a named tenant and nothing a forged request could widen.",
+  },
+  {
+    method: "POST",
+    path: "/internal/media/:mediaId/verdict",
+    accepts: "platform",
+    shape: "exempt",
+    because:
+      "one opaque object id and a finding about its bytes, as `material` above: the tenant comes from the row and the caller never says which environment it means. The credential is its only guard, and it is the worker's own rather than the dispatcher's.",
+  },
+
   // ── THE REQUEST LOG (chapter 4.8, FR-ANL-07), AND THE DERIVATION FOUND IT FIRST ──
   //
   // Run before this entry existed: `43 derived, 36 attacked, 6 exempt` with
   // `unclassified: ["GET /v1/request-log"]` and `CLASSIFICATIONS.length` 42 against 43.
   // That is the seventh time in this repository, and the list has still never been ahead
   // of the derivation. The classification is what changed in answer to it, never the
```

### `services/api/src/isolation/targets.itest.ts` — and named in the assertion that catches a route classified and never built.

4 differing lines, 1 hunk. The other direction: the accounting test catches a route added and never classified; this one catches the reverse.

```diff title="services/api/src/isolation/targets.itest.ts"
@@ -172,12 +172,16 @@
       "POST /internal/usage/connections",
       "GET /internal/memberships",
       "POST /internal/dispatch/expand",
       "POST /internal/dispatch/material",
       "POST /internal/dispatch/outcome",
       "POST /internal/dispatch/replay",
+      // And the media worker's seam (chapter 4.13). The derivation named both before
+      // the classification did, which is the eleventh time.
+      "GET /internal/media/pending",
+      "POST /internal/media/:mediaId/verdict",
     ];
     const keys = derived.map(targetKey);
     const missing = ADDED.filter((k) => !keys.includes(k));
     expect(missing, `classified here and not on the router: ${missing.join(", ")}`)
       .toEqual([]);
   });
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
+  // ── THE DELIVERY URL (chapter 4.12, FR-MED-08), AND THE DERIVATION FOUND IT NINTH ──
+  //
+  // Run before this entry existed: `45 derived, 38 attacked, 6 exempt` with
+  // `unclassified: ["GET /v1/media/:mediaId"]`. Nine chapters, nine times. 4.11 was the
+  // one chapter that added no route and so broke no streak; this one resumes it.
+  //
+  // `read` AND NOT `credential`, WHICH IS THE OPPOSITE CALL FROM ITS SIBLING ONE ENTRY
+  // UP AND FOR THE SAME REASON. `POST /v1/media` is `credential` because its body carries
+  // no identifier a foreign tenant could forge. This route's whole input IS an
+  // identifier: a `media_id` in the path, minted by the platform for one environment.
+  // That is `read`'s definition — a foreign identifier presented by a caller who should
+  // not be able to name it.
+  //
+  // `either`, matching `@Accepts("application", "user")` on the class, and both arms are
+  // attacked: an application credential of the wrong tenant and a user token of the wrong
+  // tenant reach the same predicate by different paths.
+  { method: "GET", path: "/v1/media/:mediaId", accepts: "either", shape: "read" },
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

---

## The dispatcher's two streams, and a `ready()` that never forced anything (`gaps.md` 056-9)

Splitting the CI job made `pnpm test:integration` run there for the first time since
2026-09-13, and **`dispatcher.itest.ts` failed all sixteen of its tests** with
`NatsError: consumer not found`. Neither belongs to a chapter: the chapters are right, and
what was wrong is a precondition every local run inherited from the run before it.

`main.ts` declines to define `EVENTS` and `DELIVERIES`, for a reason worth keeping — *"two
definitions of one stream is a drift waiting for the day they disagree"* — so its
`consumers.add` carries a `.catch(() => undefined)` and the poll loop retries. That is right
in production and not enough in a test: `DeliverPolicy.New` means a consumer created after
the publish never sees it. And a healthy api is not the same as the streams existing, because
the api creates them from publishers whose connections are **lazy**, and this lane runs with
`RELAY_OUTBOX_RELAY=off` and `RELAY_EVENT_CONSUMER=off`.

So the suite calls the api's own two creators, out of the `dist` it already loads — not a
second definition, which is what the objection is actually about. Reproduced both ways
against a broker with both streams deleted: **16 failed without it, 16 passed with it.**

And `ready()`'s own comment said *"force the consumers into existence"*, which
`connection_()` cannot promise. It says what it does now. **A comment that describes
behaviour no code performs** is the defect chapter 4.10 filed as `gaps.md` 056-10, found the
same way — by a broker that had never run this project.

```diff title="services/dispatcher/src/main.ts"
@@ -280,16 +280,30 @@
       }
       await new Promise((resolve) => setTimeout(resolve, 200));
     }
   }
 
   return {
-    /** Force the consumers into existence without processing anything. A suite
-     * using `DeliverPolicy.New` must create its position BEFORE it publishes, or
-     * the message it is about to send lands before the consumer exists and is
-     * never seen. */
+    /** Connect, and ATTEMPT the consumers, without processing anything. A caller
+     * using `DeliverPolicy.New` needs its position to exist before it publishes,
+     * or the message it is about to send lands before the consumer does and is
+     * never seen.
+     *
+     * IT ATTEMPTS RATHER THAN FORCES, AND THE DIFFERENCE COST SIXTEEN TESTS. This
+     * comment used to say *"force the consumers into existence"*, which
+     * `connection_()` cannot promise: its `consumers.add` carries
+     * `.catch(() => undefined)` because neither stream is this service's to
+     * define, so on a broker where the api has not yet published there is nothing
+     * to add a consumer to and this returns having created none. Production is
+     * fine — the poll loop retries and nothing is due yet — and a test that
+     * publishes on the next line is not. `dispatcher.itest.ts` ensures both
+     * streams itself, out of the api's own `dist`, for exactly that reason.
+     *
+     * A comment that describes behaviour no code performs is the defect chapter
+     * 4.10 filed as `gaps.md` 056-10; this is the same sentence shape, and it was
+     * found the same way — by a broker that had never run this project. */
     async ready(): Promise<void> {
       await connection_();
     },
     start() {
       if (running) return;
       running = true;
```

```diff title="services/dispatcher/src/dispatcher.itest.ts"
@@ -366,12 +366,45 @@
     secondUrl = await second.listen();
 
     apiPort = Number(process.env["RELAY_DISPATCHER_ITEST_API_PORT"] ?? 4131);
     child = spawnApi(apiPort, CREDENTIAL);
     apiUrl = `http://127.0.0.1:${apiPort}`;
     await waitForHealth(`${apiUrl}/healthz`);
+
+    // THE TWO STREAMS, FORCED INTO EXISTENCE BEFORE ANY CONSUMER IS ASKED FOR — AND THIS
+    // SUITE FAILED SIXTEEN WAYS WITHOUT IT ON A BROKER THAT HAD NEVER SEEN THEM.
+    //
+    // `main.ts` declines to define them, for a reason worth keeping: *"The DELIVERIES
+    // stream is created by the API SERVICE, which publishes to it. The dispatcher only
+    // consumes, so it does not define the stream — two definitions of one stream is a
+    // drift waiting for the day they disagree."* Its `consumers.add` therefore carries a
+    // `.catch(() => undefined)` and the poll loop retries, which is right in production
+    // and not enough here: `DeliverPolicy.New` means a consumer created after the publish
+    // never sees it, so `dispatcher.ready()` returning without a consumer is a suite that
+    // publishes into nothing and then reads `NatsError: consumer not found`.
+    //
+    // AND THE API BEING HEALTHY IS NOT THE SAME AS THE STREAMS EXISTING. The api creates
+    // them from its own publishers, whose connections are LAZY — and this lane runs with
+    // `RELAY_OUTBOX_RELAY=off` and `RELAY_EVENT_CONSUMER=off`, so nothing in a healthy api
+    // has published yet. Every local run passed because a broker that has run this project
+    // once already has both streams; CI's fresh JetStream is what said so.
+    //
+    // SO THE SUITE CALLS THE API'S OWN CREATORS, out of the `dist` it already loads. Not a
+    // second definition — the same two functions the api runs — which is what `main.ts`'s
+    // objection is actually about. `ingest.itest.ts`, `attempts.itest.ts` and
+    // `connection-log.itest.ts` each ensure their own stream in `beforeAll` for the same
+    // reason; this one had been relying on a neighbour having done it.
+    const publisher = require_(join(API_DIST, "outbox", "jetstream.publisher.js")) as {
+      ensureStream: (nc: NatsConnection) => Promise<void>;
+    };
+    const deliveries = require_(join(API_DIST, "webhooks", "delivery-relay.js")) as {
+      ensureDeliveriesStream: (nc: NatsConnection) => Promise<void>;
+    };
+    nats ??= await connect({ servers: NATS_URL });
+    await publisher.ensureStream(nats);
+    await deliveries.ensureDeliveriesStream(nats);
     // A per-run position, and only messages published after it exists. Sharing
     // the production durable would hand this suite every delivery every earlier
     // run left behind — and a batch of twenty-five is quickly all backlog, which
     // is exactly how this suite first failed. Chapter 2.1 did the same for
     // environments, 2.6 for subjects, the broker chapter for its own durables.
     const run = randomUUID().slice(0, 8);
```


## Chapter 4.11 — the half of the union that was refused

Fourteen files this chapter edited and does not publish. The eight it does publish carry
the argument; these carry the rest of the same change, and a chapter that printed all
twenty-two would have shown a reader 1,576 diff lines to make one point about a predicate.

**Seven of the fourteen are test files.** The chapter quotes the assertions that matter in
prose, which is the form a reader can follow; the hunks are here because the chain still has
to replay them byte for byte.

**And three are relays the compiler named rather than the author.** `session.ts`,
`resume.ts` and `zod-validation.pipe.ts` changed because a forwarded value met a strict
type, not because this chapter had anything to teach about them.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -373,12 +373,108 @@
       "https://example.test/outside-first.png",
       "https://example.test/outside-second.mp4",
     ]);
     socket.close();
   });
 
+  /** T032e. **HOSTED MEDIA, FROM OUTSIDE, WITH NOTHING BUT A PUBLISHED CREDENTIAL.**
+   *
+   * The test above delivers two attachments and types its frames
+   * `attachments?: { url?: string }[]` — the old assumption written into a type, on the
+   * one instrument in this repository that boots what customers run. A chapter whose
+   * headline claim is that a second arm now works end to end, and which left this suite
+   * url-only, would have proven the claim everywhere except where it is worth proving.
+   *
+   * THE WHOLE SEQUENCE IS PUBLISHED SURFACE: `POST /v1/media` for a slot, a `PUT` to the
+   * URL that comes back, `POST …/messages` naming the id, and a socket that was open
+   * before any of it. No workspace import, no internal route, no fixture reaching into
+   * Postgres — the same constraint every other test in this file holds itself to.
+   *
+   * AND THE PUT GOES WHERE THE API SIGNED. The upload URL names an origin this process
+   * must be able to reach, which is a property of the deployment and not of the client:
+   * the host is inside the SigV4 signature, so a URL signed for the compose network
+   * would be unusable from here. That is what `RELAY_MINIO_INTERNAL_ENDPOINT` exists to
+   * keep apart, and this test is the only thing outside the api that would notice. */
+  it("uploads a file and attaches it, from outside, in order beside a url (FR-021, SC-002d)", async () => {
+    const socket = new WebSocket(`${ws}/v1/ws?token=${token}`);
+    const frames: { type: string; payload?: { text?: string; attachments?: unknown[] } }[] = [];
+    socket.addEventListener("message", (event) => {
+      frames.push(JSON.parse(String(event.data)) as { type: string });
+    });
+    socket.addEventListener("error", () => undefined);
+    await new Promise<void>((resolve, reject) => {
+      socket.addEventListener("open", () => resolve());
+      socket.addEventListener("close", (event) =>
+        reject(new Error(`closed ${(event as CloseEvent).code}`)),
+      );
+      setTimeout(() => reject(new Error(`no socket at ${ws} within 10s`)), 10_000);
+    });
+
+    const waitFor = async (
+      predicate: (f: { type: string }) => boolean,
+      what: string,
+    ): Promise<{ type: string; payload?: { attachments?: unknown[] } }> => {
+      const deadline = Date.now() + 10_000;
+      for (;;) {
+        const found = frames.find(predicate);
+        if (found) return found;
+        if (Date.now() > deadline) {
+          throw new Error(`no ${what}; saw ${frames.map((f) => f.type).join(", ") || "nothing"}`);
+        }
+        await new Promise((r) => setTimeout(r, 50));
+      }
+    };
+
+    const slot = await post(
+      "/v1/media",
+      { filename: "outside.png", mime_type: "image/png", bytes: 11 },
+      credential,
+    );
+    expect(slot.status, "the platform refused a slot to a published credential").toBe(201);
+    const mediaId = slot.body["media_id"] as string;
+
+    // THE BYTES GO STRAIGHT TO THE STORE AND NOT THROUGH RELAY, which is ADR-13's whole
+    // claim and is invisible from in-workspace tests that never leave the process.
+    const uploaded = await fetch(slot.body["upload_url"] as string, {
+      method: "PUT",
+      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]),
+    });
+    expect(uploaded.status, "the presigned URL was not usable from outside").toBe(200);
+
+    const text = `outside media ${randomUUID()}`;
+    const posted = await post(
+      `/v1/channels/${channelId}/messages`,
+      {
+        text,
+        user: "outside-bot",
+        idempotency_key: randomUUID(),
+        attachments: [
+          { type: "url", kind: "image", url: "https://example.test/outside-url.png" },
+          { type: "media", media_id: mediaId },
+        ],
+      },
+      credential,
+    );
+    expect(posted.status).toBe(201);
+
+    const delivered = (await waitFor(
+      (f) =>
+        f.type === "message.created" &&
+        (f as { payload?: { text?: string } }).payload?.text === text,
+      "message.created carrying a hosted attachment",
+    )) as { payload: { attachments: unknown[] } };
+
+    // BOTH ARMS, IN ORDER, ON THE SOCKET. The url arm proves nothing new; what it does is
+    // hold the order claim, which one attachment cannot show.
+    expect(delivered.payload.attachments).toEqual([
+      { type: "url", kind: "image", url: "https://example.test/outside-url.png" },
+      { type: "media", media_id: mediaId },
+    ]);
+    socket.close();
+  });
+
   /** T100a — **the first `socket.send` in this file's history.**
    *
    * `grep -c "\.send(" packages/outsider/src/integrate.itest.ts` read **0** across
    * eleven tests before this one: ten REST, and one socket test whose title says
    * "sent over REST" because the fan-out chapter corrected it. This file is the only
    * check in the repository that uses the public surface as a customer does —
```

```diff title="packages/protocol/src/codes.test.ts"
@@ -237,16 +237,34 @@
   // answer of its own.
   //
   // `invalid_request` IS THE WRONG ANSWER FOR `media_id`, and that is the whole
   // argument. Every other refusal in this pipe is about a body the contract does not
   // allow; `media_id` is in FR-MSG-11 and the caller made no mistake. A 400 saying
   // "invalid" tells them to fix a request that is already correct.
-  it("names the unhosted-media refusal apart from a malformed request", () => {
-    expect(ERROR_CODES).toHaveProperty("media_not_available");
-    expect(ERROR_CODES.media_not_available).not.toBe(ERROR_CODES.invalid_request);
-    expect(ERROR_CODES.media_not_available).toMatch(/media/);
+  it("names the unattachable-media refusal apart from a malformed request", () => {
+    expect(ERROR_CODES).toHaveProperty("media_not_attachable");
+    expect(ERROR_CODES.media_not_attachable).not.toBe(ERROR_CODES.invalid_request);
+    expect(ERROR_CODES.media_not_attachable).toMatch(/media/);
+  });
+
+  // THE CODE THIS ONE REPLACED IS GONE, ASSERTED RATHER THAN ASSUMED. `codes.ts`
+  // instructed its own deletion — *"at which point it is deleted, not repurposed"* — and
+  // "we removed it" is not a property anything checks. `check:errors` compares the
+  // registry against the reference in both directions and would catch a leftover
+  // section; nothing but this catches a leftover ENTRY that no section documents.
+  it("has deleted `media_not_available` rather than repurposing it", () => {
+    expect(ERROR_CODES).not.toHaveProperty("media_not_available");
+  });
+
+  // A FALLBACK STILL NEEDS A SENTENCE A CLIENT CAN ACT ON. Nothing throws an unnamed
+  // 422 today; this exists for the next thrower that forgets, and a code whose message
+  // said only "unprocessable" would restate the status and tell them nothing.
+  it("gives the 422 rung a message that says what to do", () => {
+    expect(ERROR_CODES).toHaveProperty("unprocessable_request");
+    expect(ERROR_CODES.unprocessable_request).not.toBe(ERROR_CODES.internal_error);
+    expect(ERROR_CODES.unprocessable_request).toMatch(/understood/);
   });
 });
 
 describe("the five refusals this chapter's webhook surface adds", () => {
   // NAMED, NOT COUNTED, for the reason the blocks above give — and here the names were
   // decided somewhere else. `docs/08-error-reference.md` published a section for each of
```

```diff title="packages/protocol/src/internal.ts"
@@ -1,15 +1,16 @@
 import { z } from "zod";
 
 import {
   attachmentSchema,
+  forwardedAttachmentSchema,
   MAX_ATTACHMENTS,
   refineTextAndAttachments,
 } from "./attachments.js";
 
-import { messageSchema } from "./frames.js";
+import { forwardedMessageSchema } from "./frames.js";
 
 // The INTERNAL service contract (chapter 2.5) — distinct from the wire
 // contract above it. `frames.ts` is what a customer's client speaks;
 // this is what the gateway and the API service speak to each other over
 // the internal HTTP hop (ADR-05).
 //
@@ -64,13 +65,21 @@
    *     schema without the field   value carries the key   refused
    *     field REQUIRED             key absent              refused
    *     field optional             key absent              accepted, FR-022 broken
    *
    * Only the required field and `sendMessage`'s return landing together is honest,
    * which is why they are one phase. */
-  attachments: z.array(attachmentSchema),
+  // AND PERMISSIVE ELEMENTS ON THE RESPONSE, WHERE THE REQUEST ABOVE STAYS STRICT
+  // (FR-018b). The asymmetry is the point. `:34` is the api judging a gateway's request
+  // and refuses an arm it does not know — an old api answering a new gateway's media arm
+  // with a 422 loses nothing. This is the GATEWAY parsing the api's answer
+  // (`api-client.ts:247`), and its own comment says what a refusal costs: *"every socket
+  // send would close 1011."* The message is already committed by then, so the client
+  // loses its acknowledgement and its connection, and an idempotent retry fails the same
+  // way.
+  attachments: z.array(forwardedAttachmentSchema),
   created_at: z.iso.datetime(),
   /** True when 2.3's idempotency index recognised a retry. The PUBLIC api
    * still hides this (a client cannot tell a retry from a first send);
    * an internal caller needs it, because storage being idempotent does
    * not make delivery idempotent — chapter 2.6's trap. */
   duplicate: z.boolean().optional(),
@@ -109,13 +118,17 @@
  * `truncated` is per channel, because the ceiling is per channel: one
  * flooded channel must not force the others onto the history endpoint. */
 export const internalBackfillResponseSchema = z.strictObject({
   channels: z.record(
     z.string().min(1),
     z.strictObject({
-      messages: z.array(messageSchema),
+      // FORWARDED, NOT JUDGED (FR-018d). The gateway parses this page at
+      // `api-client.ts:218` and hands every message straight to a socket; a refusal
+      // reaches `session.ts:1361` as `degrade("backfill_failed")`, which loses the
+      // resume for every client whose cursor precedes the media message.
+      messages: z.array(forwardedMessageSchema),
       truncated: z.boolean(),
     }),
   ),
 });
 
 // ---------------------------------------------------------------------------
```

```diff title="packages/protocol/src/revision.ts"
@@ -1,9 +1,9 @@
 import { z } from "zod";
 
-import { messageDeletedPayloadSchema, messageSchema } from "./frames.js";
+import { forwardedMessageSchema, messageDeletedPayloadSchema } from "./frames.js";
 
 /** THE FIFTH SUBJECT GRAMMAR, and the argument for it is ADR-24.
  *
  * `chan:{channel_id}` carries a wire frame's payload — `fanout.ts:18` says so in its own
  * words — and that payload is a `Message`. Two things follow, and the second is fatal:
  *
@@ -56,11 +56,16 @@
  * loudly on the other instead of being dropped.
  *
  * THE WIRE FRAMES ARE NOT EDITED BY THIS FILE. `message.updated` carries a `Message` and
  * `message.deleted` carries an identity with no text; this schema is what gets them from
  * the api to a gateway that holds the socket. */
 export const revisionFabricSchema = z.discriminatedUnion("kind", [
-  z.strictObject({ kind: z.literal("updated"), message: messageSchema }),
+  // `forwardedMessageSchema` AND NOT `messageSchema` (FR-018d). The arm above says a
+  // field added on one side of a rolling deploy must fail loudly on the other, and that
+  // is right about this schema's OWN fields — `kind` and `message` are the contract.
+  // It is wrong about an attachment, which `fanout.ts:98` never reads and hands to a
+  // socket untouched: a refusal there is `fanout.invalid_payload` and a dropped edit.
+  z.strictObject({ kind: z.literal("updated"), message: forwardedMessageSchema }),
   z.strictObject({ kind: z.literal("deleted"), message: messageDeletedPayloadSchema }),
 ]);
 
 export type RevisionFabric = z.infer<typeof revisionFabricSchema>;
```

```diff title="services/api/src/consumer/consumer.itest.ts"
@@ -292,12 +292,64 @@
     await runtime.stop();
 
     expect(seen.filter((id) => id === eventId)).toHaveLength(1);
     expect(await timesHandled(db, durable, eventId)).toBe(1);
   }, 120_000);
 
+  it("invariant 3a: an envelope carrying an attachment arm this binary does not know is HANDLED, not terminated (FR-018, SC-002b)", async () => {
+    // WHAT A REFUSAL COSTS HERE, WHICH IS WHY THIS TEST EXISTS. `runtime.ts:163` parses
+    // with `safeParse` and `:204` answers a failure with `message.term()` — redelivery
+    // stops for good. So an envelope a NEWER instance committed and acknowledged is
+    // DESTROYED by an older one during a rolling deploy, over a field the consumer never
+    // reads: `grep -c attachments services/api/src/consumer/` is 0.
+    //
+    // THE ARM IS AN UNKNOWN ONE AND NOT THE MEDIA ARM, AND THAT IS A CORRECTION TO THIS
+    // TASK'S OWN PREMISE. It was written as *"an envelope carrying { type: 'media' }
+    // parses rather than being terminated"*, and that was the right probe while the media
+    // arm refused. This chapter made the media arm ACCEPT — so a media attachment now
+    // parses under the strict union too, and a test using one would pass with or without
+    // the permissive reader. It would assert nothing. What discriminates the two is an
+    // arm from a writer newer than this binary, which is the case the reader exists for.
+    const environmentId = ENV();
+    const durable = `${RUN}-future-arm-${Date.now()}`;
+    const seen: string[] = [];
+    const eventId = await publish(environmentId, {
+      data: {
+        id: randomUUID(),
+        channel_id: randomUUID(),
+        seq: 1,
+        user: "tuan",
+        text: "a photo and something this binary has never heard of",
+        created_at: new Date().toISOString(),
+        attachments: [
+          { type: "media", media_id: randomUUID() },
+          { type: "audio_clip", clip_id: randomUUID(), duration_ms: 1200 },
+        ],
+      },
+    });
+
+    const runtime = runtimeFor(
+      db,
+      durable,
+      async (event) => {
+        seen.push(event.id);
+      },
+      silent,
+      environmentId,
+    );
+    for (let i = 0; i < 20 && !seen.includes(eventId); i++) {
+      await runtime.pollOnce();
+    }
+    await runtime.stop();
+
+    // HANDLED, which is the whole claim. A terminated message is never handled and never
+    // comes back, so `seen` staying empty is exactly what the defect looks like.
+    expect(seen).toContain(eventId);
+    expect(await timesHandled(db, durable, eventId)).toBe(1);
+  }, 120_000);
+
   it("invariant 4: a kill between handling and acknowledgement is redelivered — and handled once (SC-003)", async () => {
     // The chapter's centrepiece. The walk claims the event (which commits the
     // effect), prints its marker, and is SIGKILLed before it acknowledges.
     // The broker is entitled to redeliver — it never heard an acknowledgement —
     // and the ledger is what makes the redelivery safe.
     //
```

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -148,12 +148,87 @@
     expect(verdict.foreign.status).toBe(404);
     // THE STATE READ IS THE POINT: a 404 that completed the write is the case no
     // status code reveals.
     expect(verdict.stateChanged, "the victim's messages moved").toBe(false);
   });
 
+  // A FORGED `media_id` ON THE SAME ROUTE, WHICH IS A SECOND BOUNDARY ON ONE PATH.
+  //
+  // The attack above forges a CHANNEL id; this forges a MEDIA id and leaves the channel
+  // honest. They are different walls: the first is `channels.environment_id` and the
+  // second is `media_objects.environment_id`, checked in a different query by different
+  // code, and a platform could hold one and not the other. Naming the route is not
+  // covering it — and neither is attacking it once.
+  //
+  // AND THE ATTACK PLANTS A ROW FOR EACH TENANT, WHICH NO OTHER ONE IN THIS FILE HAS TO.
+  // Both tenants' `media_objects` are otherwise empty, and **an empty table passes a leak
+  // check for the same reason an empty page does** — 4.8's finding, which cost that
+  // chapter a real hole. The victim's row is what the attacker must not reach; the
+  // attacker's own is the control that says the send path works at all when the id is
+  // theirs, so a refusal here cannot be the media feature simply being broken.
+  it("POST /v1/channels/:channelId/messages — a forged media_id is refused, and writes nothing", async () => {
+    attacked.add("POST /v1/channels/:channelId/messages");
+
+    const plant = async (t: { environmentId: string }): Promise<string> => {
+      const id = randomUUID();
+      await db.execute(
+        `INSERT INTO media_objects
+           (id, environment_id, filename, mime_type, declared_bytes, object_key, state)
+         VALUES ('${id}', '${t.environmentId}', 'g.png', 'image/png', 1, 'g/${id}', 'pending')`,
+      );
+      return id;
+    };
+    const victims = await plant(t.victim);
+    const attackers = await plant(t.attacker);
+
+    // THE CONTROL FIRST. If the attacker cannot attach its OWN object, the refusal below
+    // says nothing about tenancy — it says the feature is broken, and the pair would
+    // agree on that just as happily.
+    const control = await fetch(`${url}/v1/channels/${t.attacker.channelId}/messages`, {
+      method: "POST",
+      headers: {
+        authorization: `Bearer ${t.attacker.credential}`,
+        "content-type": "application/json",
+      },
+      body: JSON.stringify({
+        text: "my own object",
+        user: t.attacker.botExternalId,
+        attachments: [{ type: "media", media_id: attackers }],
+      }),
+    });
+    expect(control.status, "the attacker could not attach its own object").toBe(201);
+
+    const from = (mediaId: string) => ({
+      text: "from the attacker",
+      user: t.attacker.botExternalId,
+      attachments: [{ type: "media", media_id: mediaId }],
+    });
+    const verdict = await writeAttack(
+      url,
+      t.attacker.credential,
+      {
+        method: "POST",
+        path: `/v1/channels/${t.attacker.channelId}/messages`,
+        body: from(victims),
+      },
+      {
+        method: "POST",
+        path: `/v1/channels/${t.attacker.channelId}/messages`,
+        body: from(randomUUID()),
+      },
+      () => t.victim.repo.listMessages(t.victim.channelId, { limit: 50 }),
+    );
+
+    // THE VICTIM'S OBJECT AND AN INVENTED ONE ANSWER IDENTICALLY. That is the property:
+    // an attacker holding a real id it does not own learns nothing that distinguishes it
+    // from an id nobody has, so the route cannot be used to test whether an object exists.
+    expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+    expect(verdict.foreign.status).toBe(422);
+    expect(verdict.stateChanged, "the victim's messages moved").toBe(false);
+  });
+
   // ── the revisions chapter's three routes ────────────────────────────────────────
   //
   // WRITTEN BECAUSE THE ACCOUNTING TEST AT THE BOTTOM OF THIS FILE ASKED FOR THEM. The
   // classification went in with the routes; the attacks did not, and the run that
   // followed named all three by path. That is the direction published Part 3 never
   // checked — a `write` classification with no attack written for it is the same hole as
```

```diff title="services/api/src/messages/messages.itest.ts"
@@ -205,25 +205,23 @@
         attachments: [{ ...png(0), url: bad }],
       });
       expect(res.status, bad).toBe(400);
       expect(((await res.json()) as { field: string }).field, bad).toBe("attachments.0.url");
     });
 
-    // FR-016, AND CHAPTER 4.10 IS WHY THIS TEST NOW EXISTS SEPARATELY. Hosted media
-    // makes a `media_id` a real thing: `POST /v1/media` issues one, a row carries it,
-    // and a client can upload against the URL it comes with. So the obvious next move
-    // is to make this arm accept — and it would ship FR-MED-06's surface with none of
-    // FR-MED-06's checks. Nothing here verifies that the id belongs to this environment,
-    // that the uploader is the sender, or that the object is `ready` rather than
-    // `pending`, and an attachment that names a `pending` slot would render as a broken
-    // image in every client that received it.
+    // FR-001 AND FR-008a, AND BOTH OF THESE WERE REFUSAL TESTS UNTIL THIS CHAPTER.
+    // They are CONVERTED rather than deleted, which is the rule 4.10's FR-016 test
+    // earned: *"we did not add it" is not a property anything checks*, and the mirror
+    // of that is that "we did add it" needs the test that used to prove the opposite.
+    // Each one keeps its subject and changes its expectation.
     //
-    // `codes.ts:207` already decided this: *"§4.14 replaces the ARM rather than this
-    // code"*. The replacement is the next chapter's, and until then the honest answer to
-    // a real id is the same as the answer to a made-up one.
-    it("refuses a media_id that really exists, which is FR-016's whole point", async () => {
+    // THE FIRST ASSERTED THAT A REAL ID IS REFUSED, and a real id is now the accept
+    // path. Its old comment argued the refusal from what 4.10 had not built —
+    // *"nothing here verifies that the id belongs to this environment, that the
+    // uploader is the sender"* — and this chapter is what built those.
+    it("accepts a media_id that really exists, which is FR-001's whole point", async () => {
       const slot = await fetch(`${url}/v1/media`, {
         method: "POST",
         headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
         body: JSON.stringify({ filename: "real.png", mime_type: "image/png", bytes: 64 }),
       });
       expect(slot.status, "the slot route did not issue an id to test with").toBe(201);
@@ -231,51 +229,53 @@
 
       const res = await send({
         text: "hosted media, with an id this platform really minted",
         user: "courier",
         attachments: [{ type: "media", media_id }],
       });
-      expect(res.status).toBe(422);
-      const body = (await res.json()) as Record<string, unknown>;
-      expect(body.code).toBe("media_not_available");
-      // AND THE ID IS NOT ECHOED BACK AS IF IT WERE THE PROBLEM. The refusal is about
-      // the arm, not about this id — a message naming the id would read as "that one is
-      // wrong, try another", which is the opposite of what FR-016 says.
-      expect(String(body.message)).not.toContain(media_id);
+      expect(res.status).toBe(201);
+      // AND IT COMES BACK AS SENT. `state` is not on the wire — FR-013 — so what a
+      // reader gets is the two keys the client wrote and nothing the platform knows
+      // about the object. The slot is `pending` and will stay `pending` until movement
+      // VI, and a client cannot tell from this payload.
+      const body = (await res.json()) as { attachments: unknown[] };
+      expect(body.attachments).toEqual([{ type: "media", media_id }]);
     });
 
-    it("answers a media_id with its own code and a 422 (FR-003a)", async () => {
+    // THE SECOND SENT `"m_1"`, WHICH IS NOW A 400 AT THE SCHEMA AND WAS A 422 AT THE
+    // ARM. Same input, different layer: the arm used to refuse every `media_id` with
+    // its own code, and now the only thing wrong with `"m_1"` is that it is not a UUID.
+    //
+    // THIS IS THE TEST THAT WOULD HAVE BEEN A 500 (research R3, FR-008a). With the old
+    // `z.string().min(1)` and an accepting arm, `"m_1"` reaches the lookup, Postgres
+    // answers `invalid input syntax for type uuid`, and the filter calls it
+    // `internal_error` — a 500 any caller could produce with one request. The UUID at
+    // the door is what makes it a 400, and this test is why the tightening is not
+    // merely tidy.
+    it("answers a malformed media_id with a 400 naming the field (FR-008a)", async () => {
       const res = await send({
         text: "hosted media",
         user: "courier",
         attachments: [{ type: "media", media_id: "m_1" }],
       });
-      // 422 AND NOT 400: the request is understood and well-formed, and what cannot be
-      // done is the thing it asks for.
-      expect(res.status).toBe(422);
+      // 400 AND NOT 422: the id is malformed, so the caller really did send something
+      // the contract does not allow — which is the one thing `invalid_request` is for.
+      // The 422 next door is for an id that is well-formed and not attachable.
+      expect(res.status).toBe(400);
       const body = (await res.json()) as Record<string, unknown>;
-      // THE BODY, NOT ONLY THE STATUS. A 422 is the easy half: `ProtocolErrorFilter`
-      // derives a code from the status for 400, 401, 403 and 404 only, so every OTHER
-      // status ships a body calling itself `internal_error` while the status line reads
-      // correctly. A test that asserts the status and the message text passes through
-      // exactly that — which is a finding the webhook chapter owns, on a suite this tree
-      // does not have yet. What is asserted here instead is the code itself.
-      expect(body.code).toBe("media_not_available");
-      // DERIVED, NOT SPELLED. `codes.test.ts` owns the URL RULE — one assertion, in the
-      // package that builds the URL — and restating its shape here would be a second
-      // copy of it in a route test, which is how the two drift. What this test is about
-      // is that the envelope names THIS code: a 422 whose `docs_url` points at
-      // `invalid_request` is the failure, not the separator.
-      expect(body.docs_url).toBe(docsUrl("media_not_available"));
-      expect(String(body.message)).toMatch(/hosted media is not available/i);
-      // `attachments.0` AND NOT `attachments.0.type`. The refinement refuses the ARM, so
-      // zod's path stops at the object — and that is the honest field: nothing is wrong
-      // with the `type` key, the whole attachment names a transport the platform cannot
-      // serve yet. A caller with ten links is told which one, which is what the path is
-      // for.
-      expect(body.field).toBe("attachments.0");
+      expect(body.code).toBe("invalid_request");
+      expect(body.docs_url).toBe(docsUrl("invalid_request"));
+      // `attachments.0.media_id` AND NOT `attachments.0`. The old refusal was the ARM's
+      // — a `.refine` over the whole object, so zod's path stopped at the attachment.
+      // This one is the FIELD's, and the path says which key of which attachment. A
+      // caller with ten of them is told exactly where to look.
+      expect(body.field).toBe("attachments.0.media_id");
+      // AND NOT A 500. The assertion is worth stating separately because the failure
+      // this replaces was not "the wrong status" — it was a body calling itself an
+      // internal error for a request the caller got wrong.
+      expect(body.code).not.toBe("internal_error");
     });
   });
 
   // T029, T031 and T032a. THE REST DOOR, END TO END.
   describe("attachments through the send and history routes (SC-001)", () => {
     const png = (n: string) => ({
```

```diff title="services/api/src/messages/zod-validation.pipe.ts"
@@ -6,17 +6,39 @@
 // Boundary validation (chapter 2.2). safeParse, never parse: a throw
 // from deep inside a library is not an error shape anyone can rely on.
 //
 // THROUGH `protocolError` AND NOT `BadRequestException`, and that switch is owed to the
 // errors chapter rather than to this one. That chapter built the typed thrower and
 // rewired `session.ts` and the filter to it; this pipe kept the untyped exception, and
-// nothing noticed because both produce the same 400 envelope. What forced it here is a
-// code that is NOT 400: `media_not_available` cannot travel as a `BadRequestException`
-// at all, so the one call site that never needed typing is the one that now proves it.
-// 1.4's ProtocolErrorFilter still turns the throw into the EIR-API-04 envelope on the
-// way out — one error shape, one home, unchanged since the skeleton.
+// nothing noticed because both produce the same 400 envelope. What forced it here was a
+// schema that needed a status other than 400 — the media arm, which refused with its own
+// 422 from 3.24 until §4.14 made it accept. 1.4's ProtocolErrorFilter still turns the
+// throw into the EIR-API-04 envelope on the way out — one error shape, one home,
+// unchanged since the skeleton.
+//
+// WHAT THE MECHANISM IS FOR, WHICH IS NOT THE SAME AS WHO USED IT. The `protocolCode`
+// branch below lets a SCHEMA name a refusal the pipe would otherwise call
+// `invalid_request` with a 400. That is the right answer whenever a field is published
+// in the contract and the caller made no mistake, and it is the only way to say so from
+// a schema: `@Body(new ZodValidationPipe(...))` runs before the handler, so a controller
+// check cannot reach the decision.
+//
+// NOTHING USES IT TODAY, SAID PLAINLY RATHER THAN LEFT TO BE DISCOVERED. Its one
+// producer was `attachments.ts`'s `params: { protocolCode: "media_not_available" }`,
+// removed by the chapter that made the arm accept. `grep -rn protocolCode` across
+// `packages/` and `services/` finds this file and nothing else.
+//
+// KEPT, AND THE PRECEDENT CUTS BOTH WAYS. 4.10 added a `service_unavailable` rung to the
+// error filter with nothing throwing it, on the grounds that a general extension point
+// with a stated role outlives its last caller. 4.6 went the other way and reached
+// 100/100/100/100 on `metering.ts` by DELETING two arms — and 044's rule is that a design
+// in which a case cannot arise beats a branch that handles it, *because the branch is the
+// thing that rots*. What decides it here is that this arm is one `params:` key from
+// reachable, where `metering.ts`'s were unreachable by construction. The cost of keeping
+// it is stated too: this file carries no coverage pin, so nothing reports the arm as
+// uncovered either way.
 export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
   constructor(private readonly schema: ZodType<T>) {}
 
   transform(value: unknown): T {
     const result = this.schema.safeParse(value);
     if (!result.success) {
@@ -32,22 +54,24 @@
       //
       // Named here rather than in the filter because only the pipe knows the
       // path. Zod's `path` is an array — `["metadata", "blob"]` — and it joins
       // with dots, which is what a developer reading their own request body sees.
       // An empty path means the whole body failed (a non-object, say), and then
       // there is no field to name and the key is omitted rather than sent empty.
-      /** A SCHEMA MAY NAME ITS OWN REFUSAL (FR-003a).
+      /** A SCHEMA MAY NAME ITS OWN REFUSAL — the mechanism, with no current user.
+       *
+       * Everything else here is `invalid_request` and 400, which is right for a body the
+       * contract does not allow. It is wrong for a field the contract DOES publish, where
+       * the caller made no mistake and the honest answer is a code of its own.
        *
-       * Everything here is `invalid_request` and 400, which is right for a body the
-       * contract does not allow. It is wrong for a field the contract DOES publish and
-       * the platform cannot serve yet — `media_id` in FR-MSG-11 — where the caller made
-       * no mistake and the honest answer is a code of its own.
+       * The alternative is a check in the controller and it cannot work: this pipe runs
+       * before the handler, so a schema refusal has already become a 400 by the time any
+       * handler code could look. Whichever layer refuses first has to carry the code.
        *
-       * The alternative was a check in the controller, and it cannot work: this pipe runs
-       * before the handler, so a media arm is already refused with a 400 by the time any
-       * handler code could look. Whichever layer refuses first has to carry the code. */
+       * The header of this file records who used it, why nothing does now, and the two
+       * precedents that disagree about whether it should still be here. */
       // `params` IS ON THE ISSUE AT RUNTIME AND NOT ON ITS TYPE. Measured against the
       // pinned zod 4.4.3: a `refine` with `params` produces an issue whose keys are
       // `code, path, params, message`, and `$ZodIssue` declares only the first, third
       // and fourth. Narrowed through `unknown` rather than asserted, so a zod upgrade
       // that drops the field is a silent no-op here rather than a runtime throw.
       const named =
```

```diff title="services/api/src/outbox/event.ts"
@@ -1,7 +1,7 @@
-import { attachmentSchema, type Attachment } from "@relay/protocol";
+import { forwardedAttachmentSchema, type ForwardedAttachment } from "@relay/protocol";
 
 import { subjectFor } from "@relay/protocol";
 import { z } from "zod";
 
 // The event envelope. Built in ONE place, complete, inside the
 // transaction that caused it — so the relay is a mover of bytes and never an
@@ -29,14 +29,26 @@
    * below carries no `text` because a payload with a text field can carry the words
    * somebody asked to have removed; an attachment URL is exactly as recoverable, so the
    * absence there is the same decision and not an omission.
    *
    * NOT OPTIONAL. `consumer/runtime.ts` answers a failed parse with `message.term()`,
    * which stops redelivery for good — so a branch that has not been widened is a row
-   * destroyed rather than retried, and an optional field hides the day that happens. */
-  attachments: Attachment[];
+   * destroyed rather than retried, and an optional field hides the day that happens.
+   *
+   * AND THE ELEMENT IS WIDER THAN `Attachment`, WHICH THE COMPILER ASKED FOR RATHER THAN
+   * BEING TOLD (FR-018). Making the schema permissive left this hand-written interface
+   * narrow, and `runtime.ts:166` stopped compiling: *"Type '{ [x: string]: unknown; type:
+   * string; }' is missing the following properties … kind, url."* The honest fix is the
+   * type, not a cast. A consumer reading a durable queue really can be handed an arm its
+   * binary does not know — that is the whole reason the schema accepts one — and a type
+   * that denies it would put the lie one layer further in.
+   *
+   * IT COSTS NOTHING HERE BECAUSE NOTHING READS AN ATTACHMENT. `grep -c attachments
+   * services/api/src/consumer/` is 0. The day something does, this type is what makes the
+   * compiler ask which arm it is holding. */
+  attachments: ForwardedAttachment[];
   created_at: string;
 }
 
 /** A DELETION as a consumer receives it (FR-019, FR-020).
  *
  * NO `text`, AND NO `text: null` EITHER. The frame `packages/protocol/src/frames.ts`
@@ -367,13 +379,19 @@
       //
       // FOUND BY THE CLOSE-OUT COVERAGE LANE, six red tests in `consumer.itest.ts`, after
       // eleven analysis passes and eleven phases. The comment above argues NOT OPTIONAL
       // from `message.term()`, and that argument is correct about the producer and
       // inverts about the reader: the same sentence that makes a missing branch loud at
       // compile time makes a missing key fatal at runtime.
-      attachments: z.array(attachmentSchema).default([]),
+      // AND PERMISSIVE ELEMENTS, BECAUSE THIS READER FORWARDS THEM (FR-018). The
+      // consumer never looks at an attachment — `grep -c attachments
+      // services/api/src/consumer/` is 0 — and `runtime.ts:204` answers a failed parse
+      // with `message.term()`, which stops redelivery for good. So a new arm the current
+      // binary does not know would destroy a message that a NEWER instance committed and
+      // acknowledged, during a rolling deploy, by validating a field it ignores.
+      attachments: z.array(forwardedAttachmentSchema).default([]),
       created_at: z.iso.datetime(),
     }),
   }),
   // The union is exhaustive over `OUTBOX_EVENT_TYPES`, and this file's own
   // comment above says why that matters: `consumer/runtime.ts:163` answers a failed
   // parse with `message.term()`, which stops redelivery for good. A type added to the
@@ -406,13 +424,19 @@
       //
       // FOUND BY THE CLOSE-OUT COVERAGE LANE, six red tests in `consumer.itest.ts`, after
       // eleven analysis passes and eleven phases. The comment above argues NOT OPTIONAL
       // from `message.term()`, and that argument is correct about the producer and
       // inverts about the reader: the same sentence that makes a missing branch loud at
       // compile time makes a missing key fatal at runtime.
-      attachments: z.array(attachmentSchema).default([]),
+      // AND PERMISSIVE ELEMENTS, BECAUSE THIS READER FORWARDS THEM (FR-018). The
+      // consumer never looks at an attachment — `grep -c attachments
+      // services/api/src/consumer/` is 0 — and `runtime.ts:204` answers a failed parse
+      // with `message.term()`, which stops redelivery for good. So a new arm the current
+      // binary does not know would destroy a message that a NEWER instance committed and
+      // acknowledged, during a rolling deploy, by validating a field it ignores.
+      attachments: z.array(forwardedAttachmentSchema).default([]),
       created_at: z.iso.datetime(),
     }),
   }),
   z.strictObject({
     ...envelope,
     type: z.literal("message.deleted"),
```

```diff title="services/gateway/src/fanout.itest.ts"
@@ -153,12 +153,59 @@
     // The last holder leaving DOES close it.
     await g2.fanout.unsubscribe(CHANNEL);
     await g1.fanout.publish(messageOn(CHANNEL, 5));
     await expect(nextDelivery(g2, 300)).rejects.toThrow("deadline");
   });
 
+  // ── THE DELIVERY PATH IS A FORWARDING READER, AND A REFUSAL HERE IS A LOST MESSAGE ──
+  //
+  // These two are the complement of the test directly below, and the pair is the whole
+  // design: an attachment ARM this binary does not know is forwarded, and a payload that
+  // is not a message is still dropped. One test alone would be satisfied by a reader that
+  // accepts everything.
+  //
+  // WHAT A REFUSAL COSTS, WHICH IS WHY THESE ARE NOT THEORETICAL. `fanout.ts`'s failure
+  // arm is `logger.log("error", "fanout.invalid_payload"); return` — no retry, no dead
+  // letter. The api has already committed the message and answered the sender 201, so an
+  // old gateway meeting a new api's arm during a rolling deploy delivers nothing to any
+  // socket it holds and says so only in a log line that names the subject, not the reason.
+  //
+  // AN UNKNOWN ARM AND NOT THE MEDIA ARM. The media arm accepts as of this chapter, so it
+  // no longer tells a strict reader from a permissive one.
+  it("forwards a message carrying an attachment arm it does not know (FR-018d, SC-002e)", async () => {
+    await g2.fanout.subscribe(CHANNEL);
+    const future = { type: "audio_clip", clip_id: "c", duration_ms: 1200 };
+    await g1.fanout.publish({
+      ...messageOn(CHANNEL, 11),
+      attachments: [{ type: "media", media_id: "3f7c1a2e-0b5d-4c8a-9e61-7a0d2b4f6c81" }, future],
+    });
+
+    const [channelId, message] = await nextDelivery(g2);
+    expect(channelId).toBe(CHANNEL);
+    expect(message.seq).toBe(11);
+    // FORWARDED WHOLE, not stripped. The reader does not read an attachment, so it must
+    // not edit one either — a gateway that dropped the unknown arm would hand the client
+    // a message that is missing something, which is worse than the message not arriving
+    // because nothing reports it.
+    expect(message.attachments).toHaveLength(2);
+    expect(message.attachments[1]).toEqual(future);
+  });
+
+  it("forwards an EDIT carrying an arm it does not know (FR-018d)", async () => {
+    await g2.fanout.subscribe(CHANNEL);
+    const future = { type: "audio_clip", clip_id: "c", duration_ms: 1200 };
+    await g1.fanout.publishRevision({
+      kind: "updated",
+      message: { ...messageOn(CHANNEL, 12), attachments: [future] },
+    });
+
+    const [channelId, revision] = await nextRevision(g2);
+    expect(channelId).toBe(CHANNEL);
+    expect(revision.kind).toBe("updated");
+  });
+
   it("drops a payload the contract does not allow instead of forwarding it", async () => {
     await g2.fanout.subscribe(CHANNEL);
     // Something else — an older instance, a stray script, a compromised
     // dependency — puts junk on the subject. It must not reach a client.
     const raw = instance();
     await raw.fanout.publish(messageOn(CHANNEL, 6));
```

```diff title="services/gateway/src/fanout.ts"
@@ -1,13 +1,14 @@
 import {
-  messageCreatedSchema,
+  forwardedMessageSchema,
   subjectForChannel,
   subjectForChannelRevision,
   isChannelRevisionSubject,
   revisionFabricSchema,
   type RevisionFabric,
+  type ForwardedMessage,
   type Message,
 } from "@relay/protocol";
 import type { Logger } from "@relay/service-kit";
 // A NAMED import, not a default: ioredis is CommonJS, the gateway is ESM,
 // and without esModuleInterop a default import of a CJS module hands you
 // the module.exports namespace — which is not constructable. TypeScript
@@ -45,13 +46,17 @@
   /** Register the delivery callback. Set by the session layer at wiring
    * time — the fabric knows how to receive, the sessions know who to
    * hand it to. */
   onDelivery(handler: (channelId: string, message: Message) => void): void;
   /** Publish a committed message to its channel's subject. A failure here
    * costs delivery latency, never durability. */
-  publish(message: Message): Promise<void>;
+  /** `ForwardedMessage`, BECAUSE A PUBLISHER SERIALISES AND DOES NOT INTERPRET. The
+   * gateway builds this payload from the api's send response, which may carry an
+   * attachment arm this binary does not know during a rolling deploy. Nothing here
+   * reads one — `publish` stringifies and hands it to Redis. */
+  publish(message: ForwardedMessage): Promise<void>;
   /** ADR-24. Register the revision callback — an edit or a deletion of a
    * message that already exists.
    *
    * A SECOND CALLBACK ON THE SAME MODULE, not a second module. The revision subject's
    * subscription lifetime is IDENTICAL to the message subject's: the same channels, the
    * same reference counts, subscribed and dropped at the same moments. A module of its own
@@ -103,18 +108,31 @@
       deliverRevision(revision.data.message.channel, revision.data);
       return;
     }
     // The fabric is inside the trust boundary, and frames are STILL
     // validated: "inside" is one compromised dependency away from
     // "outside", and a malformed payload must not reach a client.
-    const message = messageCreatedSchema.shape.payload.safeParse(parsed);
+    // `forwardedMessageSchema` AND NOT `messageCreatedSchema.shape.payload` (FR-018d).
+    //
+    // THIS IS THE LINE THAT DROPS A COMMITTED MESSAGE. The failure arm below is a log
+    // line and a `return`: no retry, no dead letter, and the sender already holds its
+    // 201. An old gateway meeting a new api's media arm would deliver nothing to any
+    // socket on this instance and say so only in a log that names the subject, not the
+    // reason.
+    //
+    // THE VALIDATION IS KEPT, and the comment above says why: "inside" is one
+    // compromised dependency away from "outside". What loosens is the attachment
+    // ELEMENT, which this function never reads — it passes `message.data` whole to
+    // `deliver`. Every other field stays strict, so a malformed payload is still
+    // refused here rather than at a client.
+    const message = forwardedMessageSchema.safeParse(parsed);
     if (!message.success) {
       logger.log("error", "fanout.invalid_payload", { subject });
       return;
     }
-    deliver(message.data.channel, message.data);
+    deliver(message.data.channel, message.data as Message);
   });
 
   return {
     onDelivery(handler) {
       deliver = handler;
     },
```

```diff title="services/gateway/src/resume.ts"
@@ -82,15 +82,19 @@
 }
 
 /** The backfill's high-water mark per channel: the last sequence the
  * client is about to have. Channels absent from the backfill keep their
  * presented cursor as the mark — nothing new arrived, so anything buffered
  * is genuinely new. */
+// TYPED BY WHAT IT READS, WHICH IS ONE FIELD. This took `Message[]` and touches only
+// `seq`; when the backfill page became `ForwardedMessage[]` — a relay may be handed an
+// attachment arm it does not know — the narrower type was the honest fix rather than
+// widening this to a second concrete message type it also does not read.
 export function highWaterMarks(
   cursors: Record<string, number>,
-  backfilled: Record<string, { messages: Message[] }>,
+  backfilled: Record<string, { messages: { seq: number }[] }>,
 ): Record<string, number> {
   const marks: Record<string, number> = { ...cursors };
   for (const [channelId, page] of Object.entries(backfilled)) {
     const last = page.messages[page.messages.length - 1];
     if (last) marks[channelId] = last.seq;
   }
```

```diff title="services/gateway/src/session.itest.ts"
@@ -410,17 +410,93 @@
     expect(refusal.payload.code).toBe("invalid_frame");
     // T041a: the frame contract has published `field` since chapter 1.3 and the gateway
     // had never set it. The joined path is what a developer reading their own frame sees.
     expect(refusal.payload.field).toBe("payload.attachments");
   }, 20_000);
 
-  it("refuses a media_id and SAYS hosted media is unavailable (FR-003a)", async () => {
-    // THE MESSAGE, BECAUSE THE CODE IS THE SAME ONE EVERY MALFORMED FRAME GETS. A one-arm
-    // union would also refuse this — with "Invalid discriminator value. Expected 'url'",
-    // which is the sentence FR-003a forbids by name. This assertion is the only thing
-    // that can tell the two-arm schema from a one-arm one on this door.
+  // CONVERTED, NOT DELETED (FR-001b). This asserted *"refuses a media_id and SAYS hosted
+  // media is unavailable"* from 3.24 until this chapter, and its subject — what the
+  // SOCKET door does with a media attachment — is the same subject now that the arm
+  // accepts. A deleted test takes its question with it; this one keeps the question and
+  // changes the answer.
+  //
+  // THE FRAME IS STILL REFUSED AND THE REASON HAS MOVED ONE LAYER. `m_1` used to fail the
+  // arm's unconditional refinement; it now fails `z.uuid()`. Both are the gateway's own
+  // schema rather than the api's, so the code is still `invalid_frame` — `sendError`
+  // fixes it at the call site — and what changed is the sentence. Asserting the sentence
+  // is the only thing that can tell a schema that refuses for the right reason from one
+  // that refuses for any reason at all.
+  // ── THE SOCKET DOOR ACCEPTS, AND IT IS A DIFFERENT DOOR (FR-001a, SC-002a) ──────────
+  //
+  // ONE UNION, THREE DOORS, AND NO ARTIFACT MENTIONED THIS ONE UNTIL ANALYSIS PASS 2.
+  // `messageSendSchema` embeds `attachmentSchema` in the gateway and
+  // `internalSendRequestSchema` embeds it again in the api, so a socket send crosses the
+  // union twice and neither crossing is the REST route the rest of this chapter tests.
+  // The arm accepting at the REST door says nothing about this one.
+  it("commits a media attachment sent over the socket (FR-001a, SC-002a)", async () => {
+    // THE SLOT COMES FROM THE API, over its own route and with the same credential the
+    // harness holds. The gateway has no media surface at all — it forwards.
+    const slot = await fetch(`${api.url}/v1/media`, {
+      method: "POST",
+      headers: {
+        authorization: `Bearer ${api.credential}`,
+        "content-type": "application/json",
+      },
+      body: JSON.stringify({ filename: "s.png", mime_type: "image/png", bytes: 512 }),
+    });
+    expect(slot.status, "the api did not issue a slot to attach").toBe(201);
+    const { media_id } = (await slot.json()) as { media_id: string };
+
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "a photo, over the socket",
+          attachments: [{ type: "media", media_id }],
+        },
+      }),
+    );
+
+    // THE ACK IS THE CLAIM. A frame that the gateway's schema refused would answer
+    // `error` instead, and a frame the api refused would too — so an ack means the union
+    // accepted at both crossings and the row committed.
+    const ack = (await firstFrame(socket, "message.ack")) as { payload: { seq: number } };
+    expect(ack.payload.seq).toBeGreaterThan(0);
+  }, 20_000);
+
+  // AND A FOREIGN ID GETS THE API'S OWN CODE, NOT `invalid_frame`. The split matters: the
+  // gateway's schema refuses SHAPES and the api refuses FACTS, and a socket client that
+  // saw `invalid_frame` for a well-formed id it simply does not own would be told to fix
+  // its JSON. `session.ts`'s send catch forwards any 4xx whose `code` passes
+  // `isErrorCode`, which is what makes the api's vocabulary reach this door at all.
+  it("forwards the api's own refusal for a foreign media_id (T032c)", async () => {
+    const socket = connect(await mintToken("tuan", 3600));
+    await firstFrame(socket, "connection.ack");
+    socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: api.channelId,
+          text: "somebody else's object",
+          attachments: [{ type: "media", media_id: randomUUID() }],
+        },
+      }),
+    );
+    const refusal = (await firstFrame(socket, "error")) as {
+      payload: { code: string };
+    };
+    expect(refusal.payload.code).toBe("media_not_attachable");
+    expect(refusal.payload.code).not.toBe("invalid_frame");
+  }, 20_000);
+
+  it("refuses a malformed media_id at the frame, and says which field (FR-008a)", async () => {
     const socket = connect(await mintToken("tuan", 3600));
     await firstFrame(socket, "connection.ack");
     socket.send(
       JSON.stringify({
         type: "message.send",
         payload: {
@@ -431,17 +507,18 @@
         },
       }),
     );
     const refusal = (await firstFrame(socket, "error")) as {
       payload: { code: string; message: string };
     };
-    // `invalid_frame` AND NOT `media_not_available`: `sendError` fixes its code at the
-    // call site, so the REST door answers with the code and the socket answers with the
-    // sentence. T039 records that split.
     expect(refusal.payload.code).toBe("invalid_frame");
-    expect(refusal.payload.message).toMatch(/hosted media is not available/i);
+    // AND NOT THE OLD SENTENCE. A gateway still carrying 3.24's schema would answer
+    // "hosted media is not available yet" here and pass every other assertion in this
+    // file, which is exactly the regression this line exists to catch.
+    expect(refusal.payload.message).not.toMatch(/hosted media is not available/i);
+    expect(refusal.payload.message).toMatch(/uuid/i);
   }, 20_000);
 
   it("commits TWO attachments sent over the socket, in order (FR-001, FR-006)", async () => {
     const socket = connect(await mintToken("tuan", 3600));
     await firstFrame(socket, "connection.ack");
     socket.send(
```

```diff title="services/gateway/src/session.ts"
@@ -6,12 +6,13 @@
   ALL_CHANNELS,
   CLOSE_CODES,
   docsUrl,
   frameSchema,
   type ErrorCode,
   type Frame,
+  type RelayedFrame,
   type Message,
   type RevisionFabric,
   type TypingFabric,
   isErrorCode,
   type MembershipFabric,
   type PresenceFabric,
@@ -112,13 +113,13 @@
  * code the coverage ratchet would have to be told to ignore — and this chapter's
  * pins are 100/100/100/100. */
 function isInboundFrame(frame: Frame): frame is Extract<Frame, { type: InboundFrameType }> {
   return INBOUND_FRAME_TYPES.has(frame.type as InboundFrameType);
 }
 
-function send(socket: WebSocket, frame: Frame): void {
+function send(socket: WebSocket, frame: RelayedFrame): void {
   socket.send(JSON.stringify(frame));
 }
 
 /** EIR-API-04's envelope, wearing its WebSocket clothes.
  *
  * `request_id` ARRIVED IN THE RATE-LIMIT CHAPTER, and the gateway had none to give — it
```

**And `codes.ts` is here rather than in the chapter**, placed after the two hunks above that
already amend it. The chapter’s own hunk applied cleanly to the chain’s END state and failed at
chapter 4.11, because that is a different state: the appendix runs after every chapter, so a file
it touches has one shape a reader sees and another the chain replays. Chapter 4.8 paid for this
exact sentence with a hunk that was right about a state that was wrong.

```diff title="packages/protocol/src/codes.ts"
@@ -178,37 +178,54 @@
   // ONLY THE AUTHOR EVER SEES IT. `editMessage` checks authorship first, so a stranger
   // is refused for not having written the message whether or not it still says
   // anything — this code cannot tell anybody that a message they could not otherwise
   // see exists.
   message_deleted:
     "this message has been deleted; its text cannot be changed, and its history is unaffected",
-  /** MEDIA THAT DOES NOT EXIST YET, AND ITS OWN CODE (FR-003, FR-003a).
+  /** A MEDIA OBJECT THIS SENDER CANNOT ATTACH, AND ONE ANSWER FOR THREE REASONS.
    *
-   * FR-MSG-11 publishes two ways to attach: an external URL and a `media_id` naming
-   * something the platform hosts. This chapter builds the first. **A customer reading
-   * that clause will send the second**, and the refusal they get decides whether they
-   * conclude they made a mistake or that the feature is not here yet.
-   *
-   * `invalid_request` WOULD SAY THE WRONG THING. It means the caller sent something the
-   * contract does not allow, and `media_id` is in the published contract — so the honest
-   * answer is that the platform cannot serve it, not that the field is wrong. That is
-   * the same distinction chapter 2.8 drew between a 404 and a 403.
-   *
-   * 422 AND NOT 400. The body is well-formed and the request is understood; what cannot
-   * be done is the thing it asks for. `ProtocolErrorFilter` derives a code from the
-   * status for 400/401/403/404 and answers `internal_error` for everything else, so a
-   * 422 MUST supply this code explicitly through `protocolError` — an unnamed 422 ships
-   * a body calling itself an internal error. The webhook chapter has five of those still
-   * open, on a service this tree has not built yet; this is the first 422 in the platform
-   * that names its own code, and it names it because the schema raises it.
-   *
-   * §4.14 REPLACES THE ARM RATHER THAN THIS CODE. When hosted media ships, the
-   * `{ type: "media" }` arm starts accepting and this entry describes a state the
-   * platform no longer has — at which point it is deleted, not repurposed. */
-  media_not_available:
-    "hosted media is not available yet; attach an http or https url instead",
+   * `media_not_available` STOOD HERE AND IS GONE, on its own entry's instruction —
+   * *"§4.14 replaces the arm rather than this code … at which point it is deleted, not
+   * repurposed."* The arm accepts now, so the state that code described does not exist,
+   * and a code kept past its condition is a vocabulary the platform has to keep meaning.
+   *
+   * THE NAME IS THE OPERATION, NOT THE CAUSE. Three conditions land here — the object
+   * belongs to another environment, it belongs to another user of this one, or no object
+   * has that id — and **a client does the same thing about all three**: stop using that
+   * id and upload one of its own. A code that named the cause would be an existence
+   * oracle, telling a caller which of the three it hit and therefore whether somebody
+   * else's object exists (FR-005).
+   *
+   * ITS NEAR-NEIGHBOURS, AND WHY IT IS NONE OF THEM. Not `not_found` — that is a route
+   * this api does not serve, and the route here is fine. Not `forbidden` — that is a
+   * permission a caller could be granted, and no grant makes another tenant's object
+   * attachable. Not `invalid_request` — the id is well-formed, which is exactly what
+   * makes this a 422 and not a 400.
+   *
+   * 422, AND THE THROWER NAMES IT. The body is understood and what it asks for cannot be
+   * done. `ProtocolErrorFilter` now has a 422 rung (`unprocessable_request`), so an
+   * unnamed one is no longer `internal_error` — but a fallback says only what the status
+   * supports, and this code says which id the caller should stop using. */
+  media_not_attachable:
+    "this media object cannot be attached by this sender; upload your own and attach that id",
+  /** THE 422 RUNG'S FALLBACK, WITH NO THROWER — AND THAT IS THE POINT.
+   *
+   * `ProtocolErrorFilter`'s ladder carried 400, 401, 402, 403, 404, 413, 415 and 503, so
+   * **any 422 that forgot to name itself answered `internal_error`** — the filter's own
+   * *"lie the client cannot act on"*, the third time that comment has been earned.
+   * Nothing throws an unnamed 422 today: `channel_member_limit_exceeded` names itself and
+   * `media_not_attachable` above names itself. This is for the next thrower that does
+   * not, which is the shape `service_unavailable` took at 4.10 with nothing throwing it
+   * either.
+   *
+   * IT CARRIES ONLY WHAT THE STATUS SUPPORTS, because a fallback cannot know why. Two
+   * facts: the request was understood, and the thing it asked for cannot be done. A
+   * client's action is to stop repeating it unchanged — which is the honest instruction
+   * when the server has not said more. */
+  unprocessable_request:
+    "the request was understood but cannot be carried out; repeating it unchanged will not help",
   // ── THE WEBHOOK REFUSALS (THIS CHAPTER) ─────────────────────────────────────
   //
   // FIVE CODES THE ERROR REFERENCE ALREADY PUBLISHED AND THIS REGISTRY DID NOT HAVE.
   // `docs/08-error-reference.md` carries a section for each — status, retryability and
   // the field — and `webhooks.service.ts` threw a bare `UnprocessableEntityException`
   // for every one of them. `ProtocolErrorFilter` derives a code from the status for
```

### `services/api/src/isolation/gauntlet.itest.ts` — the cross-tenant gauntlet, after chapter 4.12 attacked the delivery route.

Placed **last**, and anchored on the state this file itself produces. Chapter 4.12 adds a
forged-`media_id` READ beside 4.11's forged-`media_id` write — the same identifier against a
different verb, refused by three predicates the write path does not use. The attack plants a
*referenced* object for each tenant rather than a bare row, because an object nothing
references is refused to everybody and a bare plant would fail the attacker's own control for
this chapter's reason instead of for tenancy.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -483,12 +483,83 @@
 
     // AND THE ROWS ARE THE ATTACKER'S. Three slots, three distinct ids, and the two
     // credential classes wrote into the same environment as each other.
     expect(new Set([byKey.media_id, byToken.media_id, victim.media_id]).size).toBe(3);
   });
 
+  // A FORGED `media_id` IN A READ (chapter 4.12, FR-MED-08). The same id against a
+  // different verb, and a platform could hold one and not the other: the write path
+  // refuses through `assertAttachableMedia` inside `sendMessage`'s transaction, and this
+  // path refuses through three predicates none of which that one uses.
+  //
+  // AND IT PLANTS A REFERENCED OBJECT FOR EACH TENANT, WHICH IS TWO STEPS RATHER THAN
+  // ONE. A planted `media_objects` row is not enough here: an object with no referencing
+  // message is refused to everybody, so a bare plant would make the attacker's control
+  // fail for this chapter's own reason rather than for tenancy. Each tenant's object is
+  // uploaded and attached through its own routes, which is also what makes the control
+  // meaningful.
+  it("GET /v1/media/:mediaId — a foreign object reads as an absent one", async () => {
+    attacked.add("GET /v1/media/:mediaId");
+
+    const referenced = async (tenant: {
+      credential: string;
+      channelId: string;
+      botExternalId: string;
+    }): Promise<string> => {
+      const slot = await fetch(`${url}/v1/media`, {
+        method: "POST",
+        headers: {
+          authorization: `Bearer ${tenant.credential}`,
+          "content-type": "application/json",
+        },
+        body: JSON.stringify({ filename: "g.png", mime_type: "image/png", bytes: 16 }),
+      });
+      expect(slot.status, "the fixture could not get a slot").toBe(201);
+      const { media_id } = (await slot.json()) as { media_id: string };
+      const sent = await fetch(`${url}/v1/channels/${tenant.channelId}/messages`, {
+        method: "POST",
+        headers: {
+          authorization: `Bearer ${tenant.credential}`,
+          "content-type": "application/json",
+        },
+        body: JSON.stringify({
+          text: "an object worth reading",
+          user: tenant.botExternalId,
+          attachments: [{ type: "media", media_id }],
+        }),
+      });
+      expect(sent.status, "the fixture could not attach its own object").toBe(201);
+      return media_id;
+    };
+
+    const victims = await referenced(t.victim);
+    const mine = await referenced(t.attacker);
+
+    // THE CONTROL FIRST, AND BOTH CREDENTIAL CLASSES. If the attacker cannot read its
+    // OWN object the refusal below says the feature is broken, not that the boundary
+    // holds — and an empty `media_objects` passes a leak check for the same reason an
+    // empty page does.
+    for (const credential of [t.attacker.credential, attackerToken]) {
+      const control = await fetch(`${url}/v1/media/${mine}`, {
+        headers: { authorization: `Bearer ${credential}` },
+      });
+      expect(control.status, "the attacker could not read its own object").toBe(200);
+    }
+
+    for (const credential of [t.attacker.credential, attackerToken]) {
+      const verdict = await readAttack(
+        url,
+        credential,
+        { method: "GET", path: `/v1/media/${victims}` },
+        { method: "GET", path: `/v1/media/${randomUUID()}` },
+      );
+      expect(verdict.differences, JSON.stringify(verdict, null, 2)).toEqual([]);
+      expect(verdict.foreign.status).toBe(404);
+    }
+  });
+
   // ── the two routes this chapter added ──────────────────────────────────────────
   //
   // A chapter that adds an endpoint attacks it in the same chapter. The derivation
   // found these before the classification did: `targets.itest.ts` went from 9 targets
   // to 11 and failed naming both as unclassified.
   it("POST /v1/channels/:channelId/members — refuses, and adds nobody", async () => {
```

### `vitest.coverage.config.mts` — the ratchet, after chapter 4.12 raised the media service's branch pin.

92 to 94 against a measured 95. The gap is 045's: `session.ts` measured 87.80 and 85.36 on
identical code twenty minutes apart, so a pin set at the observation is a pin that will go red
for no change and teach the next person to lower it. Both numbers are in the comment, which is
the convention that makes the headroom auditable rather than arbitrary.

```diff title="vitest.coverage.config.mts"
@@ -1223,25 +1223,31 @@
         "services/api/src/media/media.controller.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
-        // The slot service. 100 / 92.85 / 100 / 100, raised from 83.33 / 66.66 / 100 /
-        // 83.33 at the end of phase 3 — the three uncovered lines then were the three
-        // `throw`s, and phases 4 and 5 are the chapters that drive them.
+        // The slot service AND the delivery route. 100 / 95 / 100 / 100, from 92.85 when
+        // it held the slot alone — chapter 4.12 added `deliver`, whose every branch has
+        // both arms driven over HTTP, and the file's proportion of covered arms rose with
+        // it. Raised from 92 to 94 rather than to the measured 95: `session.ts` measured
+        // 87.80 and 85.36 on identical code twenty minutes apart, about one function of
+        // forty, and a ratchet pinned at the observation is a ratchet that teaches people
+        // to lower ratchets. Both numbers are here, which is the convention 045 wrote.
         //
-        // 92.85 IS 13 OF 14 AND THE FOURTEENTH IS ATTRIBUTED TO LINE 32, WHICH IS
-        // `@Injectable()`. Every branch this file writes has both arms driven over HTTP:
-        // the three refusals, the store probe, and the user resolution in each direction.
-        // v8 counts something in the decorator's own output and there is no source line
-        // to cover — the same shape as 045's note that a `binary-expr` arm counts as
-        // covered when the operand was merely evaluated. Pinned at 92 rather than
-        // measured down to nothing, and named rather than left as a mystery.
+        // THE FOURTEENTH ARM IS ATTRIBUTED TO LINE 32, WHICH IS `@Injectable()`. v8 counts
+        // something in the decorator's own output and there is no source line to cover —
+        // the same shape as 045's note that a `binary-expr` arm counts as covered when the
+        // operand was merely evaluated.
+        //
+        // AND THE KEY WAS PROBED IN BOTH DIRECTIONS (T039). Demanding an impossible 101
+        // produced `ERROR: Coverage for branches (95%) does not meet
+        // "services/api/src/media/media.service.ts" threshold (101%)`, which is how this
+        // config says the key binds to a file. A pin whose key matches nothing is silent.
         "services/api/src/media/media.service.ts": {
-          branches: 92,
+          branches: 94,
           functions: 100,
           lines: 100,
           statements: 100,
         },
         // The store client. 100 / 100 / 100 / 100, from 77.77 / 53.84 / 100 / 85.71.
         //
```

### `packages/outsider/src/integrate.itest.ts` — the sealed suite, after chapter 4.12 fetched a media object's bytes from outside.

Three hunks: a `get` helper (eleven tests reached the api through `post` alone), the delivery
fetch itself, and a correction. **The correction is the interesting one.** The request-log test
asserted `typeof row["endpoint"] === "string"`, and chapter 4.8 had already measured the
opposite on this platform: NULL on 31 real rows, 23 rate-limited and 8 unmatched, because a
request the router never matched has no route to name. The seal survived because its own rows
all match a route; what exposed it was 4.12 measuring the malformed-path-param class against
the same tenant, which put an unmatched-route row in that log.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -86,12 +86,23 @@
       headers: { "content-type": "application/json", authorization: `Bearer ${auth}` },
       body: JSON.stringify(body),
     });
     return { status: res.status, body: (await res.json()) as Record<string, unknown> };
   };
 
+  /** The read twin of `post`, added by chapter 4.12 for the delivery route. Eleven
+   *  tests reached the api through `post` alone and the two that needed a GET built
+   *  their own `fetch`; a third would have been the point at which the shape was a
+   *  convention nobody had written down. */
+  const get = async (path: string, auth: string) => {
+    const res = await fetch(`${api}${path}`, {
+      headers: { authorization: `Bearer ${auth}` },
+    });
+    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
+  };
+
   beforeAll(() => {
     ({ api, ws, credential } = required());
   });
 
   it("reaches the platform at all", async () => {
     // Before anything else, and separately, so a platform that is not there says
@@ -467,12 +478,33 @@
     // hold the order claim, which one attachment cannot show.
     expect(delivered.payload.attachments).toEqual([
       { type: "url", kind: "image", url: "https://example.test/outside-url.png" },
       { type: "media", media_id: mediaId },
     ]);
     socket.close();
+
+    // AND THE BYTES COME BACK, FROM OUTSIDE (chapter 4.12, SC-010). The frame above
+    // carries an id and nothing else; a client holding it has to ask for a URL, and
+    // this is the only test in the repository that asks as a customer does — over the
+    // published surface, from a process that started nothing, through a URL whose host
+    // was chosen by the api and has to be reachable from here.
+    //
+    // THAT LAST PART IS THE PROPERTY WORTH HAVING. `RELAY_MINIO_INTERNAL_ENDPOINT`
+    // exists because the host is inside the SigV4 signature, so the address the api
+    // probes the store on and the address it signs for a client cannot be one field. A
+    // delivery URL signed with the internal one is refused rather than slow, and nothing
+    // inside the workspace would notice.
+    const link = await get(`/v1/media/${mediaId}`, credential);
+    expect(link.status, "the platform refused a delivery URL for its own attachment").toBe(200);
+    expect(typeof link.body["expires_at"]).toBe("string");
+
+    const bytes = await fetch(link.body["url"] as string);
+    expect(bytes.status, "the delivery URL was not usable from outside").toBe(200);
+    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(
+      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]),
+    );
   });
 
   /** T100a — **the first `socket.send` in this file's history.**
    *
    * `grep -c "\.send(" packages/outsider/src/integrate.itest.ts` read **0** across
    * eleven tests before this one: ten REST, and one socket test whose title says
@@ -792,15 +824,29 @@
     // on the stream since 4.4 — this tenant's rows among them. So the log is no longer empty
     // on a lane where that suite has run, and it still is on one where it has not.
     //
     // **The assertion is now about the property the clause actually asks for**: whatever is
     // in this page belongs to the tenant whose credential fetched it (FR-ANL-07, and
     // constitution I). That holds in both states, which is what makes it worth asserting.
+    //
+    // AND `endpoint` IS NULLABLE, WHICH THIS ASSERTION DENIED UNTIL CHAPTER 4.12. It read
+    // `typeof row["endpoint"]` must be `"string"`, and chapter 4.8 had already measured
+    // the opposite on the platform's own data: NULL on 31 real rows — 23 rate-limited and
+    // 8 unmatched — because a request the router never matched has no route to name. That
+    // chapter built the reader to answer `null` rather than the `\N` ClickHouse writes,
+    // and wrote two tests for it. The seal here went on asserting a string.
+    //
+    // It survived because this suite's rows are the ones this suite made, and every one of
+    // them matches a route. What exposed it was 4.12 measuring the malformed-path-param
+    // class against this same tenant: `GET /v1/channels/not-a-uuid/members` is an
+    // unmatched route, so the demo tenant's log gained a row with no endpoint and the seal
+    // went red for a fact the platform publishes.
     const requests = body["requests"] as Array<Record<string, unknown>>;
     for (const row of requests) {
-      expect(typeof row["endpoint"]).toBe("string");
+      expect(["string", "object"]).toContain(typeof row["endpoint"]);
+      if (row["endpoint"] !== null) expect(typeof row["endpoint"]).toBe("string");
       expect(typeof row["status"]).toBe("number");
       expect(typeof row["request_id"]).toBe("string");
     }
     // AND THE PAGE FLAG AGREES WITH THE PAGE. `has_more` is false for a page below the
     // limit, whatever the count — which is the half a bare `toEqual([])` could never check.
     if (requests.length < 50) expect(body["has_more"]).toBe(false);
```

## Placed last, because they would otherwise unanchor the appendix's own older hunks

Chapter 4.13's changes to these two files anchor perfectly well where the other
appendix entries sit, and applying them there breaks hunks written earlier in this
same document for the same files. **A hunk that works and unanchors somebody else's is
still a broken chain** — chapter 4.10 found the shape and paid it twice.

### `services/api/src/isolation/gauntlet.itest.ts` — the seam's credential guard, and one fixture that now needs `ready`.

67 differing lines, 2 hunks. The new test is deliberately not an attack — both routes are `exempt`, so it shows the guard the exemption rests on instead. The fixture change is ADR-14's gate reaching a file that never mentions verification.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -525,12 +525,23 @@
           text: "an object worth reading",
           user: tenant.botExternalId,
           attachments: [{ type: "media", media_id }],
         }),
       });
       expect(sent.status, "the fixture could not attach its own object").toBe(201);
+      // AND `ready`, BECAUSE ADR-14's GATE ARRIVED WITH THE VERIFICATION CHAPTER. Its
+      // own `research.md` R4 measured this clause before the state machine existed and
+      // named **this control** among the ten it turned red — the object was `pending`,
+      // the gate refused it, and the attacker could not read its own object. The
+      // fixture states the precondition rather than spawning a worker to produce it:
+      // a tenancy attack that fails when the scanner is down is reporting somebody
+      // else's outage.
+      await db.execute(
+        `UPDATE media_objects SET state = 'ready', verified_bytes = 16, ` +
+          `verified_type = 'image/png' WHERE id = '${media_id}'`,
+      );
       return media_id;
     };
 
     const victims = await referenced(t.victim);
     const mine = await referenced(t.attacker);
 
@@ -554,12 +565,68 @@
       );
       expect(verdict.differences, JSON.stringify(verdict, null, 2)).toEqual([]);
       expect(verdict.foreign.status).toBe(404);
     }
   });
 
+  // THE MEDIA WORKER'S SEAM (chapter 4.13), AND IT IS NOT AN ATTACK ON THE ROUTE.
+  //
+  // `targets.ts` classifies both seam routes `exempt`, so nothing here calls
+  // `attacked.add` — an exempt route that this file attacked would be counted twice by
+  // the accounting test and would also be a claim the classification does not make.
+  //
+  // WHAT IT SHOWS INSTEAD IS THE GUARD THAT MAKES THE EXEMPTION TRUE. The verdict route
+  // is deliberately cross-tenant: one worker serves every environment, the tenant comes
+  // from the row, and there is no parameter a forged request could widen. **So the thing
+  // that must hold is that no tenant credential reaches it at all** — and that is
+  // testable with exactly the credentials this file already holds. A route whose safety
+  // rests entirely on its credential is a route whose credential check is worth
+  // asserting where the attacks live, not only in the suite that owns the feature.
+  it("the media seam refuses every TENANT credential, and changes nothing", async () => {
+    const slot = await fetch(`${url}/v1/media`, {
+      method: "POST",
+      headers: {
+        authorization: `Bearer ${t.victim.credential}`,
+        "content-type": "application/json",
+      },
+      body: JSON.stringify({ filename: "v.png", mime_type: "image/png", bytes: 16 }),
+    });
+    expect(slot.status, "the fixture could not get the victim a slot").toBe(201);
+    const { media_id } = (await slot.json()) as { media_id: string };
+
+    for (const credential of [t.attacker.credential, attackerToken]) {
+      const read = await fetch(`${url}/internal/media/pending`, {
+        headers: { authorization: `Bearer ${credential}` },
+      });
+      expect(read.status).toBe(403);
+
+      const write = await fetch(`${url}/internal/media/${media_id}/verdict`, {
+        method: "POST",
+        headers: {
+          authorization: `Bearer ${credential}`,
+          "content-type": "application/json",
+        },
+        body: JSON.stringify({
+          verdict: "rejected",
+          reason: "scan_failed",
+        }),
+      });
+      expect(write.status).toBe(403);
+    }
+
+    // AND THE VICTIM'S OBJECT IS UNTOUCHED. A 403 that had already destroyed the bytes
+    // would be a refusal after the fact, which is the shape `writeAttack` exists to
+    // catch everywhere else in this file.
+    const [row] = (
+      (await db.execute(
+        `SELECT state FROM media_objects WHERE id = '${media_id}'`,
+      )) as unknown as { rows: { state: string }[] }
+    ).rows;
+    expect(row!.state).toBe("pending");
+  });
+
   // ── the two routes this chapter added ──────────────────────────────────────────
   //
   // A chapter that adds an endpoint attacks it in the same chapter. The derivation
   // found these before the classification did: `targets.itest.ts` went from 9 targets
   // to 11 and failed naming both as unclassified.
   it("POST /v1/channels/:channelId/members — refuses, and adds nobody", async () => {
```

### `packages/outsider/src/integrate.itest.ts` — the sealed suite uploads a real PNG, and SC-010 becomes a poll.

45 differing lines, 2 hunks. Its old fixture declared eleven bytes and uploaded eleven — the PNG signature plus three zeros, with no `IHDR`. Size right, bytes not a PNG. And the delivery assertion now waits for the worker, which is the cost of the gate.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -432,25 +432,47 @@
           throw new Error(`no ${what}; saw ${frames.map((f) => f.type).join(", ") || "nothing"}`);
         }
         await new Promise((r) => setTimeout(r, 50));
       }
     };
 
+    // A REAL PNG, AND THE OLD FIXTURE IS WHY IT HAD TO BECOME ONE.
+    //
+    // This uploaded `[137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]` — the PNG signature plus
+    // three zeros, with no `IHDR` — and declared 11 bytes for it. **The size was right
+    // and the bytes were not a PNG**, which was invisible until the platform grew
+    // something that reads them: the slot route records *"what the caller said, not what
+    // arrived"*. Under FR-MED-03 that object is `rejected` and never delivers.
+    //
+    // BUILT FROM BYTES RATHER THAN IMPORTED. This package declares no `@relay/*`
+    // dependency and no workspace path may be reached from here, so the fixture is a
+    // literal — which is also the honest shape for a suite claiming to know nothing
+    // about how the platform is built. A 1×1 greyscale PNG with a stored (uncompressed)
+    // deflate block, 67 bytes.
+    const png = new Uint8Array([
+      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
+      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
+      0x08, 0x00, 0x00, 0x00, 0x00, 0x3a, 0x7e, 0x9b, 0x55, 0x00, 0x00, 0x00,
+      0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00,
+      0x02, 0x00, 0x01, 0x48, 0xaf, 0xa4, 0x71, 0x00, 0x00, 0x00, 0x00, 0x49,
+      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
+    ]);
+
     const slot = await post(
       "/v1/media",
-      { filename: "outside.png", mime_type: "image/png", bytes: 11 },
+      { filename: "outside.png", mime_type: "image/png", bytes: png.length },
       credential,
     );
     expect(slot.status, "the platform refused a slot to a published credential").toBe(201);
     const mediaId = slot.body["media_id"] as string;
 
     // THE BYTES GO STRAIGHT TO THE STORE AND NOT THROUGH RELAY, which is ADR-13's whole
     // claim and is invisible from in-workspace tests that never leave the process.
     const uploaded = await fetch(slot.body["upload_url"] as string, {
       method: "PUT",
-      body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]),
+      body: png,
     });
     expect(uploaded.status, "the presigned URL was not usable from outside").toBe(200);
 
     const text = `outside media ${randomUUID()}`;
     const posted = await post(
       `/v1/channels/${channelId}/messages`,
@@ -490,21 +512,40 @@
     //
     // THAT LAST PART IS THE PROPERTY WORTH HAVING. `RELAY_MINIO_INTERNAL_ENDPOINT`
     // exists because the host is inside the SigV4 signature, so the address the api
     // probes the store on and the address it signs for a client cannot be one field. A
     // delivery URL signed with the internal one is refused rather than slow, and nothing
     // inside the workspace would notice.
-    const link = await get(`/v1/media/${mediaId}`, credential);
+    // AND IT IS A POLL NOW, BECAUSE ADR-14's GATE PUT A PROCESS BETWEEN THE UPLOAD AND
+    // THE LINK. *"No signed URL until `ready`"*, and the only thing that produces `ready`
+    // is the media worker — so this assertion stopped being about the delivery route
+    // alone and became the one test in the repository that exercises upload, sweep,
+    // scan, verdict and delivery end to end, from outside. **That is a real cost of the
+    // gate** and it is the one the packaging decision was made with in front of it: the
+    // unpackaged shape the ingester has would have made this unsatisfiable.
+    //
+    // THE DEADLINE IS THE SWEEP INTERVAL PLUS THE WORK. Measured at five-second polling:
+    // p50 5,080 ms from upload to `ready`, of which 7 ms is the work. Thirty seconds is
+    // six intervals, so a failure here means the worker is not running rather than that
+    // it was slow.
+    const deadline = Date.now() + 30_000;
+    let link = await get(`/v1/media/${mediaId}`, credential);
+    while (link.status === 404 && Date.now() < deadline) {
+      await new Promise((r) => setTimeout(r, 500));
+      link = await get(`/v1/media/${mediaId}`, credential);
+    }
     expect(link.status, "the platform refused a delivery URL for its own attachment").toBe(200);
     expect(typeof link.body["expires_at"]).toBe("string");
 
     const bytes = await fetch(link.body["url"] as string);
     expect(bytes.status, "the delivery URL was not usable from outside").toBe(200);
-    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(
-      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0]),
-    );
+    // AGAINST THE SAME ARRAY THAT WAS UPLOADED, not a second copy of it. This read
+    // `new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0])` — the old fixture,
+    // written out twice — and when the upload became a real PNG the assertion kept
+    // comparing against eleven bytes that were no longer sent anywhere.
+    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(png);
   });
 
   /** T100a — **the first `socket.send` in this file's history.**
    *
    * `grep -c "\.send(" packages/outsider/src/integrate.itest.ts` read **0** across
    * eleven tests before this one: ten REST, and one socket test whose title says
```

### `packages/protocol/src/internal.ts` — the media worker's seam, in the shared protocol.

6 differing lines, 1 hunk. The five schemas chapter 4.13's two internal routes speak, **and this block moved here from its place in chapter order**. An earlier entry in this document amends the same file, and a hunk for it written against the end state cannot also apply before that entry runs — the same rule the two blocks above are here for.

```diff title="packages/protocol/src/internal.ts"
@@ -530,6 +530,102 @@
 export type InternalUsageReportRequest = z.infer<
   typeof internalUsageReportRequestSchema
 >;
 export type InternalUsageReportResponse = z.infer<
   typeof internalUsageReportResponseSchema
 >;
+
+// ---------------------------------------------------------------------------
+// The media worker's seam (4.13)
+// ---------------------------------------------------------------------------
+
+/** One object the worker has not reached a verdict on yet.
+ *
+ * NO `environment_id`, AND THAT IS THE POINT. The route it comes from takes no
+ * tenant parameter either — a worker that could ask for one tenant's objects
+ * would be a route worth forging. The worker never needs the tenant, because
+ * everything it does is addressed by object key and reported back by id. */
+export const internalMediaPendingItemSchema = z.strictObject({
+  id: z.string().uuid(),
+  object_key: z.string().min(1),
+  /** What the CLIENT said this is, which is the whole subject of FR-MED-03. The
+   * worker's job is to find out whether it is true. */
+  mime_type: z.string().min(1),
+  declared_bytes: z.number().int().nonnegative(),
+  /** The ordering column, returned so the worker can ask for the next page.
+   *
+   * A KEYSET CURSOR AND NOT AN OFFSET. The batch is ordered by `created_at` over a
+   * partial index keyed on it, so `after` is a range scan; an offset would make the
+   * database walk past everything already seen, on every page. */
+  created_at: z.string(),
+});
+
+export const internalMediaPendingResponseSchema = z.strictObject({
+  objects: z.array(internalMediaPendingItemSchema),
+});
+
+/** Why an object was refused, to the platform.
+ *
+ * TWO VALUES, AND THE CUSTOMER SEES NEITHER. FR-005 requires a scan failure and
+ * a declaration mismatch to be distinguishable; the API's own refusal says only
+ * that the object is not attachable, because telling a caller which of the two
+ * happened tells an attacker whether their payload was recognised. */
+export const mediaRejectionReasonSchema = z.enum([
+  "declaration_mismatch",
+  "scan_failed",
+]);
+
+/** THERE IS NO `retry` ARM, AND ITS ABSENCE IS A DECISION. A transient failure —
+ * the store unreachable, the scanner down — sends nothing at all, so the object
+ * stays `pending` and the next sweep finds it. A verdict meaning "we could not
+ * tell" is a row somebody later reads as a fact. */
+export const internalMediaVerdictRequestSchema = z.discriminatedUnion(
+  "verdict",
+  [
+    z.strictObject({
+      verdict: z.literal("ready"),
+      /** The STORE's count, not the client's. `content-length` on a signed
+       * `HEAD` is the number the store will serve, which is what makes it
+       * worth recording beside `declared_bytes` rather than instead of it. */
+      verified_bytes: z.number().int().nonnegative(),
+      /** Read from the bytes. The store's `content-type` is the client's own
+       * claim echoed back, so it is not evidence of anything. */
+      verified_type: z.string().min(1),
+      /** Present for the kinds a 64 KiB prefix answers for, absent for the
+       * rest — FR-MED-04 is recorded PARTLY MET rather than pretended. */
+      width: z.number().int().positive().optional(),
+      height: z.number().int().positive().optional(),
+      duration_ms: z.number().int().nonnegative().optional(),
+    }),
+    z.strictObject({
+      verdict: z.literal("rejected"),
+      reason: mediaRejectionReasonSchema,
+      /** Optional on this arm: a scan failure knows nothing about the type,
+       * and a mismatch that failed on size alone knows no type either. */
+      verified_bytes: z.number().int().nonnegative().optional(),
+      verified_type: z.string().min(1).optional(),
+    }),
+  ],
+);
+
+/** `applied` false means the row was not `pending` any more and this verdict
+ * changed nothing — a second worker got there first, which is an ordinary
+ * outcome rather than an error. `state` is what the row holds now, so a worker
+ * that lost the race can log what won. */
+export const internalMediaVerdictResponseSchema = z.strictObject({
+  applied: z.boolean(),
+  state: z.enum(["pending", "ready", "rejected"]),
+});
+
+export type InternalMediaPendingItem = z.infer<
+  typeof internalMediaPendingItemSchema
+>;
+export type InternalMediaPendingResponse = z.infer<
+  typeof internalMediaPendingResponseSchema
+>;
+export type MediaRejectionReason = z.infer<typeof mediaRejectionReasonSchema>;
+export type InternalMediaVerdictRequest = z.infer<
+  typeof internalMediaVerdictRequestSchema
+>;
+export type InternalMediaVerdictResponse = z.infer<
+  typeof internalMediaVerdictResponseSchema
+>;
```

### `vitest.coverage.config.mts` — the media worker's nine coverage pins.

76 differing lines, 1 hunk. Last, because this document carries twelve earlier hunks for this file and a change placed among them unanchors the ones after it.

```diff title="vitest.coverage.config.mts"
@@ -420,12 +420,88 @@
           branches: 71,
           functions: 100,
           lines: 71,
           statements: 72,
         },
 
+        // ── THE MEDIA WORKER (chapter 4.13) ──────────────────────────────────
+        //
+        // PINNED BELOW THE MEASURED FIGURE, not at it. `session.ts` measured 87.80 and
+        // 85.36 functions on identical code twenty minutes apart, so a floor at the
+        // observation goes red for no change to the code — and the fix is then to lower
+        // it, which is a ratchet that teaches people to lower ratchets.
+        //
+        // AND EVERY KEY HERE WAS PROBED BOTH WAYS. A per-file threshold whose key
+        // matches no file is SILENT: no error, no warning, nothing. Each of these was
+        // set to an impossible figure once and confirmed to fire.
+        "services/media-worker/src/sniff.ts": {
+          // Ten magic numbers, every arm deleted in turn and every one turning at
+          // least one test red. Nothing here is unreachable.
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/media-worker/src/fixtures.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/media-worker/src/dimensions.ts": {
+          // The four readers' unreachable arms are the width/height bounds on formats
+          // whose fixtures cannot express them — a GIF's size field is 16 bits, so
+          // `> MAX_DIMENSION` is dead for that format and live for PNG.
+          branches: 86,
+          functions: 100,
+          lines: 83,
+          statements: 84,
+        },
+        "services/media-worker/src/sweep.ts": {
+          branches: 90,
+          functions: 100,
+          lines: 96,
+          statements: 96,
+        },
+        "services/media-worker/src/verify.ts": {
+          branches: 86,
+          functions: 100,
+          lines: 100,
+          statements: 95,
+        },
+        "services/media-worker/src/store.ts": {
+          branches: 86,
+          functions: 100,
+          lines: 100,
+          statements: 90,
+        },
+        "services/media-worker/src/scan.ts": {
+          // The lowest of the six, and the reason is socket error handling: a
+          // connection that times out mid-conversation needs a scanner that accepts
+          // and then stops answering, which no fixture in this repository provides.
+          //
+          // AND THE SECOND OF NINE PINS THAT WAS A CLAIM ABOUT ONE MACHINE. Set from a
+          // single local run, then measured in CI:
+          //
+          //     local   88.23 / 85.71 / 82.35 / 87.30      s / b / f / l
+          //     CI      86.76 / 80.95 / 82.35 / 85.71
+          //
+          // Lower in CI on three of four, by up to **4.76 points of branches** — and
+          // the arms that move are exactly the ones a real scanner's timing decides:
+          // a socket that refuses, a reply that never comes. `functions` is identical
+          // in both, which is the tell that the file is fully reached and only its
+          // error arms vary.
+          //
+          // Pinned below the lower of the two. The seven siblings were checked in the
+          // same run rather than assumed: `dimensions.ts` and `sniff.ts` are identical
+          // across environments, `sweep.ts` and `api-client.ts` measure HIGHER in CI,
+          // and only this file and `media.controller.ts` needed moving. `gaps.md`
+          // 059-20.
+          branches: 79,
+          functions: 81,
+          lines: 84,
+          statements: 85,
+        },
+        "services/media-worker/src/api-client.ts": {
+          // 50% branches, and it is the honest figure. Every `if` in this file is a
+          // status check, and the suites reach 200, 404 and 422 but not the 5xx arms —
+          // which are covered in `sweep.test.ts` against a fake client rather than here.
+          branches: 49,
+          functions: 100,
+          lines: 100,
+          statements: 77,
+        },
+        "services/api/src/internal/media.controller.ts": {
+          // 83, FROM TWO ENVIRONMENTS THAT DISAGREE, AND THE DISAGREEMENT IS NOT A
+          // SWING. This was pinned at 89 from a single local observation of 90.90 —
+          // the mistake 045 names in as many words, *"pin below the lower observation
+          // by the observed swing and put both numbers in the config"*, with only one
+          // observation to go on. CI then reported **84.61 on three consecutive runs**.
+          //
+          // AND IT IS A DIFFERENT MEASUREMENT, NOT A NOISIER ONE. The denominator
+          // moves: v8 sees **33 branch points here locally and 13 in CI**, same commit,
+          // same Node 22.23.2, all 136 test files green on both. 90.90 is 30/33 and
+          // 84.61 is 11/13. **A percentage whose denominator changes with the machine
+          // is a claim about the machine**, and no number pinned here can mean what the
+          // ratchet wants it to mean until that is understood. `gaps.md` 059-20.
+          //
+          // The eight sibling pins this feature added on the same day are stable across
+          // both environments, which is what localises it to this file — the only one
+          // of the nine that is a decorated NestJS class reached through DI.
+          //
+          // 83 is below the lower of the two and still catches a real regression: the
+          // arms this file has are the 404, the 422, the byte deletion and its log.
+          branches: 83,
+          functions: 100,
+          lines: 93,
+          statements: 93,
+        },
+
         "services/dispatcher/src/expand.ts": {
           branches: 92,
           functions: 100,
           lines: 100,
           statements: 92,
         },
@@ -1211,12 +1211,23 @@
         // an else the runtime never takes: `fetch` rejects with an `Error`. Driving it
         // would mean mocking `fetch`, which buys a green number by testing a stub.
         //
         // **TWO UNREACHABLE ARMS, BOTH NAMED, BOTH TYPE-MANDATED**, and the file is at
         // 100 on every other measure. An uncovered arm is cheaper than a lie about a
         // type — 4.7's sentence, now applying twice in the same file.
+        //
+        // AND A THIRD ARM THAT WAS CI's DOING, NOT THIS FILE'S. This pin was red on
+        // every CI run from the day it was written: `ci.yml` set
+        // `RELAY_CLICKHOUSE_HOST: localhost` for the lanes job — **the value line 58
+        // already defaults to** — so `process.env[…] ?? "localhost"` never evaluated its
+        // right-hand side there and the run measured **86.95, uncovered 58, 108, 115**.
+        // Reproduced locally by setting the variable, byte for byte, and fixed by
+        // deleting it: five readers all default to `localhost`, so it changed nothing
+        // else. **The pin was right and the environment was wrong**, which is the
+        // opposite of the two pins 4.13 had to lower — and worth telling apart before
+        // reaching for the ratchet. `gaps.md` 059-22.
         "services/api/src/metering/clickhouse.ts": {
           branches: 91,
           functions: 100,
           lines: 100,
           statements: 100,
         },
```

### `services/gateway/src/limits.itest.ts` — the window instant, pinned.

43 differing lines, 2 hunks. **The appendix and not chapter 3.22, because no chapter owns
this.** The suite's own comment already records the boundary — `windowsSince` sums across it
so a straddling test still counts ten sends as ten — and that fix reached the half the test
READS. It could not reach the half the platform DOES: the limiter keys on the same wall-clock
minute, so three sends against a limit of two with a boundary between the second and the third
make the third the first request of a new window, and it is allowed. **No sum recovers a 429
that never happened.**

Two of the five tests read a count and were already safe. The three that read the platform's
own answer — a 429, and an `x-ratelimit-remaining` of exactly `14` — were not, and CI produced
`expected 201 to be 429` on 2026-09-27, absent from the next run on identical code.

**It does not sleep to the next boundary**, which that same comment records as a fix whose
failure mode was worse than the fault. It waits only when the window is nearly over and only
for the sliver that is left, so the wait is bounded by the headroom rather than by the window.
Run red with the boundary forced — `expected 201 to be 429` with the pin off, green with it on.

```diff title="services/gateway/src/limits.itest.ts"
@@ -256,12 +256,44 @@
     const last = Math.floor(Date.now() / 60_000) * 60_000;
     const out: number[] = [];
     for (let w = first; w <= last; w += 60_000) out.push(w);
     return out;
   };
 
+  /** THE OTHER HALF OF THE BOUNDARY, AND `windowsSince` CANNOT REACH IT.
+   *
+   * That helper made COUNTING boundary-proof: ten sends are ten sends however the minute
+   * falls across them, because the test sums both keys. **What it cannot make
+   * boundary-proof is the PLATFORM.** The limiter keys on the same wall-clock minute, so
+   * three sends against a limit of two with a boundary between the second and the third
+   * make the third the FIRST request of a new window — and it is allowed. No sum fixes
+   * that: the 429 the test is about never happened.
+   *
+   * Two of the five tests here read a COUNT and were already safe. The other three read
+   * the platform's own answer — a 429, and an `x-ratelimit-remaining` header — and none
+   * of them was. **The earlier fix closed the half it could see**, which is why the
+   * comment above reads as complete.
+   *
+   * MEASURED: CI, 2026-09-27, `expected 201 to be 429` on the refusal test, absent from
+   * the next run on identical code.
+   *
+   * AND IT DOES NOT SLEEP TO THE NEXT BOUNDARY, which the comment above records as a fix
+   * whose failure mode was worse than the fault — a 5-second timeout that said nothing
+   * about what it was waiting for. **This waits only when the window is nearly over, and
+   * then only for the sliver that is left**: the wait is bounded by `needMs` rather than
+   * by the window. At 3 s that is 5% of runs waiting at most 3 s, against a longest
+   * measured test of **143 ms** — twenty times the burst it has to cover.
+   *
+   * In `beforeEach` rather than in the three tests that need it, so a sixth test cannot
+   * bring the class back by being written without it. */
+  const pinWindow = async (needMs = 3_000): Promise<void> => {
+    const leftInWindow = 60_000 - (Date.now() % 60_000);
+    if (leftInWindow >= needMs) return;
+    await new Promise((resolve) => setTimeout(resolve, leftInWindow + 20));
+  };
+
   let testStartedAt = Date.now();
 
   const count = async (operation: string): Promise<number> => {
     let total = 0;
     for (const w of windowsSince(testStartedAt)) {
       total += Number((await redis.get(key(operation, w))) ?? 0);
@@ -329,18 +361,17 @@
       limits,
     });
     await new Promise<void>((resolve) => server.listen(0, resolve));
     url = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
   }, 60_000);
 
-  beforeEach(() => {
-    // Where `count()` starts summing, and where `afterEach` starts deleting.
-    testStartedAt = Date.now();
-  });
-
-  beforeEach(() => {
+  beforeEach(async () => {
+    // THE PIN COMES FIRST, so `testStartedAt` is the instant the traffic actually
+    // starts rather than the instant before a wait — `count()` sums from it, and a
+    // window it names but never wrote to would be a wasted `GET` on every read.
+    await pinWindow();
     // Where `count()` starts summing, and where `afterEach` starts deleting.
     testStartedAt = Date.now();
   });
 
   afterEach(async () => {
     for (const socket of sockets.splice(0)) socket.close();
```

## Chapter 4.14 — the attachment's state, and the frame that announces it

**Fifteen files, placed last for the reason this section exists.** Seven of them already carry
appendix hunks from earlier chapters, and a hunk written at chapter 4.14's own state would be
written against a state no reader sees — the appendix applies after every chapter, so a file it
touches has one shape at chapter N and another at the end (4.8's finding, paid again by 4.11 and
4.12). Generating all fifteen against the END state is one rule rather than two, and it is why
these are here rather than in the chapter.

### `packages/protocol/src/attachments.ts` — the delivered shape, and the three roles one schema was serving.

```diff title="packages/protocol/src/attachments.ts"
@@ -103,6 +103,43 @@
  * vanishing. */
 export const attachmentSchema = z.discriminatedUnion("type", [urlArm, mediaArm]);
 
+/** FR-MED-07's first sentence: the three states a media object can be in, as the wire
+ * spells them. One declaration, because `0018`'s CHECK constraint and this enum are the
+ * same closed set seen from two sides and two spellings would be the `idem_key` against
+ * `idempotency_key` defect this file's own header names. */
+export const MEDIA_STATES = ["pending", "ready", "rejected"] as const;
+
+/** WHAT THE PLATFORM BUILDS, WHICH IS NOT WHAT A SENDER DECLARES (FR-MED-07).
+ *
+ * **One schema was serving both, and that is what made this chapter's first plan
+ * impossible.** `attachmentSchema` above is embedded by four things: three request doors
+ * — `messages.schema.ts:40`, `frames.ts:94` and `internal.ts:35` — and **`messageSchema`
+ * at `frames.ts:46`, which is the payload the api BUILDS**. A sender must not be able to
+ * declare a state; a delivered attachment must always carry one. Those are opposite
+ * requirements on one shape.
+ *
+ * **REQUIRED, NOT OPTIONAL, and `frames.ts:89` already wrote the argument for a
+ * different field**: *"a caller may send none, and a payload the platform BUILDS must
+ * always say."* Required is what makes the compiler name every construction site — which
+ * is how the set of doors was derived rather than listed, after a hand list of three
+ * turned out to be six.
+ *
+ * THE URL ARM IS UNCHANGED AND SHARED. A `url` attachment has no state to carry: nothing
+ * uploaded it, nothing scanned it, and FR-MED-03's verification never touches it. Giving
+ * it one for symmetry would be a field that is always the same value, which is a field
+ * a reader has to learn and can never use. */
+const deliveredMediaArm = mediaArm.extend({
+  state: z.enum(MEDIA_STATES),
+});
+
+export const deliveredAttachmentSchema = z.discriminatedUnion("type", [
+  urlArm,
+  deliveredMediaArm,
+]);
+
+export type DeliveredAttachment = z.infer<typeof deliveredAttachmentSchema>;
+export type MediaState = (typeof MEDIA_STATES)[number];
+
 /** THE SAME UNION FOR A READER THAT FORWARDS RATHER THAN JUDGES, and it is one export
  * because there were nearly four copies of it.
  *
@@ -136,6 +173,17 @@
  * with no `type` is still a refusal, so the reader can still tell an attachment from
  * garbage. */
 export const forwardedAttachmentSchema = z.union([
+  // DELIVERED FIRST, AND THE ORDER IS THE WHOLE OF THIS CHANGE. A delivered media
+  // attachment already parsed before this line existed — it fails `attachmentSchema`'s
+  // strict arm on the unknown `state` key and falls through to the loose one — so
+  // nothing was broken and nothing is fixed. What changes is the TYPE: matched by the
+  // loose arm a delivered value degrades to `{ type: string }`, and the escape hatch
+  // FR-018d put there for an arm nobody has written yet starts absorbing one we did.
+  deliveredAttachmentSchema,
+  // STILL SECOND, AND REMOVING IT WOULD BE THE EXPENSIVE MISTAKE. An envelope written
+  // by the binary that ran before this deploy carries a media attachment with no
+  // `state`, and this is the only arm that accepts it. The cost of getting that wrong
+  // is `message.term()` — destroyed after the send was acknowledged, never redelivered.
   attachmentSchema,
   z.looseObject({ type: z.string() }),
 ]);
```

### `packages/protocol/src/frames.ts` — `messageSchema` points at what the platform builds, and the new frame.

```diff title="packages/protocol/src/frames.ts"
@@ -2,6 +2,7 @@
 
 import {
   attachmentSchema,
+  deliveredAttachmentSchema,
   forwardedAttachmentSchema,
   MAX_ATTACHMENTS,
   refineTextAndAttachments,
@@ -43,7 +44,14 @@
    *
    * FR-007: a message with none carries `[]` rather than an absent key,
    * so a reader needs no special case. `?? []` at the read sites, never `?? null`. */
-  attachments: z.array(attachmentSchema),
+  // DELIVERED, NOT DECLARED (FR-MED-07). This is the payload the api BUILDS, and it was
+  // sharing `attachmentSchema` with three request doors — `messages.schema.ts:40`,
+  // `messageSendSchema` below, and `internal.ts:35`. A sender must not be able to say
+  // what state an object is in; a delivered attachment must always say. One schema
+  // cannot hold both rules, and the state is read when the message is SERVED rather
+  // than stored on the row, so a message sent before a verdict reflects it afterwards
+  // without being rewritten (constitution IV: one home for one fact).
+  attachments: z.array(deliveredAttachmentSchema),
   created_at: z.iso.datetime(), // UTC, RFC 3339 (constitution: timestamps)
 });
 
@@ -192,6 +200,40 @@
   payload: messageDeletedPayloadSchema,
 });
 
+/** FR-MED-07's second sentence: a placeholder resolves without polling.
+ *
+ * **THE NAME IS `media.updated` AND THE COLLISION WAS WEIGHED, NOT MISSED.** It sits one
+ * letter from `message.updated`, and both can describe the same message: an edited
+ * message carrying a media attachment produces `message.updated` when its text changes
+ * and this frame when its object is verified. Three names were considered —
+ * `media.updated`, `attachment.updated` and `media.state_changed`. The clause says
+ * *"a `media.updated` event"* in as many words, and a frame named differently from the
+ * requirement that mandates it costs every future reader a lookup. The collision is
+ * mitigated where it actually bites, which is the `switch` in `session.ts`: the two
+ * arms sit adjacent with this sentence between them.
+ *
+ * **IT CARRIES NO MESSAGE ID, AND THAT IS NOT AN OMISSION.** One object can be attached
+ * by several messages in one channel — 44 objects on the development lane are referenced
+ * from two channels, and FR-MSG-11 has allowed the same id twice since chapter 3.24. The
+ * frame answers *this object changed*, and a client rendering per message finds its own
+ * by media id. Naming one message would be picking one of several and calling it the
+ * one.
+ *
+ * **AND IT IS AN OPTIMISATION OVER A FLOOR THAT DOES NOT NEED IT.** Every door already
+ * serves the attachment's state, read when the message is served. A client that never
+ * receives this frame — because it attached an object that was already terminal, because
+ * it was disconnected, or because an un-upgraded gateway dropped it during a deploy —
+ * reads the right state from history. The frame removes polling; it is not how the
+ * answer is known. */
+export const mediaUpdatedSchema = z.strictObject({
+  type: z.literal("media.updated"),
+  payload: z.strictObject({
+    media_id: z.uuid(),
+    channel: z.string().min(1),
+    state: z.enum(["ready", "rejected"]),
+  }),
+});
+
 export const membershipChangedSchema = z.strictObject({
   type: z.literal("membership.changed"),
   payload: z.strictObject({
@@ -277,6 +319,9 @@
   messageCreatedSchema,
   messageUpdatedSchema,
   messageDeletedSchema,
+  // FR-MED-07. Adjacent to `messageUpdatedSchema` on purpose: the two are one letter
+  // apart and can describe the same message, so a reader meets them together.
+  mediaUpdatedSchema,
   membershipChangedSchema,
   presenceChangedSchema,
   typingSchema,
@@ -291,6 +336,7 @@
  * needs a name of its own — otherwise every producer re-declares the shape inline and the
  * schema stops being the single statement of it. */
 export type MessageDeleted = z.infer<typeof messageDeletedPayloadSchema>;
+export type MediaUpdated = z.infer<typeof mediaUpdatedSchema>;
 export type ConnectionAck = z.infer<typeof connectionAckSchema>;
 export type MessageSend = z.infer<typeof messageSendSchema>;
 export type MessageAck = z.infer<typeof messageAckSchema>;
```

### `packages/protocol/src/revision.ts` — the third arm, and the module that owns which field holds a channel.

```diff title="packages/protocol/src/revision.ts"
@@ -50,6 +50,23 @@
 /** What crosses `revision:{channel_id}` between gateway instances. Consumed only by
  * gateways; each arm becomes the wire frame `frames.ts` already published.
  *
+ * **THE SUBJECT IS NAMED `revision:` AND CARRIES MORE THAN MESSAGE REVISIONS** (chapter
+ * 4.14). Its contract is *something changed about what this channel's messages show* —
+ * an edit, a deletion, or an attachment's media object reaching a terminal state. The
+ * name is narrower than the contents and it stays: renaming a subject is a wire change
+ * and a fence-chain change across every chapter that publishes this file. **A name that
+ * has quietly widened is worse than one that has widened on the record**, so this is the
+ * record.
+ *
+ * WHY THIS SUBJECT RATHER THAN A SIXTH GRAMMAR (ADR-33). ADR-19's rule is that a kind
+ * which cannot share a payload type cannot share a subject, and ADR-20 admitted two
+ * payload types onto one subject under a test this arm also passes: *a receiver
+ * subscribes to both or neither*. `fanout.ts` already subscribes `chan:` and `revision:`
+ * together under one reference count, calling them co-extensive by construction. And
+ * ADR-25's threshold is per-channel SUBSCRIBEs exceeding six: a sixth grammar would have
+ * sat exactly on the bound and spent the last of the headroom on a kind whose subscriber
+ * set is identical to one that already exists.
+ *
  * `discriminatedUnion`, so the two arms cannot be confused and an unknown `kind` is a
  * rejection rather than a silent pass. `strictObject` inside each arm for the reason
  * `membershipFabricSchema` gives: a field added on one side of a rolling deploy fails
@@ -66,6 +83,60 @@
   // socket untouched: a refusal there is `fanout.invalid_payload` and a dropped edit.
   z.strictObject({ kind: z.literal("updated"), message: forwardedMessageSchema }),
   z.strictObject({ kind: z.literal("deleted"), message: messageDeletedPayloadSchema }),
+  // THE THIRD ARM CARRIES NO MESSAGE, WHICH IS THE PART EVERY READER HAS TO LEARN
+  // (FR-MED-07). The other two are about a message; this one is about an OBJECT a
+  // message references, so its channel is a field rather than `message.channel`. Eight
+  // sites in production reached through `.message` for the subject, the routing key or
+  // a log field before this arm existed.
+  //
+  // `state` IS TWO VALUES AND NOT THREE. The frame announces a transition OUT of
+  // `pending`, so `pending` is a value the producer cannot emit; admitting it would be
+  // a state nothing can reach, which is the argument `0018` made for refusing a fourth
+  // value in the column.
+  //
+  // NO `reason`. A rejection's cause is a closed set of two and broadcasting it would
+  // tell every subscriber that a member's upload failed a virus scan. FR-MED-06's three
+  // refusals are already byte-identical for the same reason: a refusal that names its
+  // cause reports a fact about somebody else.
+  z.strictObject({
+    kind: z.literal("media"),
+    media_id: z.uuid(),
+    channel: z.string().min(1),
+    state: z.enum(["ready", "rejected"]),
+  }),
 ]);
 
 export type RevisionFabric = z.infer<typeof revisionFabricSchema>;
+
+/** THE CHANNEL A REVISION IS ABOUT, ASKED OF THE MODULE THAT OWNS THE GRAMMAR.
+ *
+ * Before chapter 4.14 every arm carried a `message` and eight sites in two services
+ * reached through `revision.message.channel` for the subject, the routing key or a log
+ * field. The media arm has no message, so each of those was a place that had to learn a
+ * third shape — and `REVISION_SUBJECT_PREFIX` is exported for exactly the reason this
+ * function now exists: *a literal there would be a second place that knows this
+ * grammar.* A per-arm `switch` repeated eight times is eight places that know it.
+ *
+ * The compiler keeps this honest: the `switch` is exhaustive over the union, so a fourth
+ * arm is a type error here rather than a subject somebody forgot to derive. */
+export function channelOfRevision(revision: RevisionFabric): string {
+  switch (revision.kind) {
+    case "updated":
+    case "deleted":
+      return revision.message.channel;
+    case "media":
+      return revision.channel;
+  }
+}
+
+/** What a log line can say about any arm, since only two of the three have a message id.
+ * `message_id` is absent rather than `undefined` for the media arm: a field that reads
+ * `undefined` looks like a value the code failed to compute, and one that is missing
+ * looks like what it is — inapplicable. */
+export function logFieldsOfRevision(
+  revision: RevisionFabric,
+): { channel: string; kind: string; message_id?: string } {
+  return revision.kind === "media"
+    ? { channel: revision.channel, kind: revision.kind }
+    : { channel: revision.message.channel, kind: revision.kind, message_id: revision.message.id };
+}
```

### `services/api/src/fanout/publisher.ts` — a publisher that no longer assumes every arm carries a message.

```diff title="services/api/src/fanout/publisher.ts"
@@ -1,4 +1,6 @@
 import {
+  channelOfRevision,
+  logFieldsOfRevision,
   subjectForChannel,
   subjectForChannelRevision,
   type Message,
@@ -132,16 +134,17 @@
       if (now() < downUntil) return;
       try {
         await redis.publish(
-          subjectForChannelRevision(revision.message.channel),
+          // `channelOfRevision` AND NOT `revision.message.channel` (chapter 4.14). The
+          // media arm has no message, and the module that owns the grammar is the one
+          // that should answer which channel an arm is about.
+          subjectForChannelRevision(channelOfRevision(revision)),
           JSON.stringify(revision),
         );
         downUntil = 0;
       } catch (error) {
         downUntil = now() + DOWN_WINDOW_MS;
         logger.log("error", "fanout.publish_failed", {
-          channel: revision.message.channel,
-          message_id: revision.message.id,
-          kind: revision.kind,
+          ...logFieldsOfRevision(revision),
           request_id: context.requestId,
           environment_id: context.environmentId,
           error: String(error),
```

### `services/gateway/src/fanout.ts` — the same assumption, on the routing key and the gateway's own publisher.

```diff title="services/gateway/src/fanout.ts"
@@ -1,4 +1,6 @@
 import {
+  channelOfRevision,
+  logFieldsOfRevision,
   forwardedMessageSchema,
   subjectForChannel,
   subjectForChannelRevision,
@@ -105,7 +107,7 @@
         logger.log("error", "fanout.invalid_payload", { subject });
         return;
       }
-      deliverRevision(revision.data.message.channel, revision.data);
+      deliverRevision(channelOfRevision(revision.data), revision.data);
       return;
     }
     // The fabric is inside the trust boundary, and frames are STILL
@@ -142,7 +144,7 @@
     async publishRevision(revision) {
       try {
         await publisher.publish(
-          subjectForChannelRevision(revision.message.channel),
+          subjectForChannelRevision(channelOfRevision(revision)),
           JSON.stringify(revision),
         );
       } catch (error) {
@@ -150,7 +152,7 @@
         // committed, and a client that missed the frame repairs by re-reading history —
         // which is what the revisions chapter's resume decision rests on.
         logger.log("error", "fanout.publish_failed", {
-          channel: revision.message.channel,
+          ...logFieldsOfRevision(revision),
           error: String(error),
         });
       }
```

### `services/gateway/src/session.ts` — the two-way ternary becomes an exhaustive switch.

```diff title="services/gateway/src/session.ts"
@@ -395,12 +395,38 @@
   function deliverRevision(channelId: string, revision: RevisionFabric): void {
     for (const connection of registry.subscribersOf(channelId)) {
       if (connection.phase === "buffering") continue;
-      send(
-        connection.socket,
-        revision.kind === "updated"
-          ? { type: "message.updated", payload: revision.message }
-          : { type: "message.deleted", payload: revision.message },
-      );
+      // A SWITCH AND NOT A TERNARY, because there are three arms now and the third is
+      // not a variant of the other two (chapter 4.14). A two-way conditional would have
+      // sent a media transition as `message.deleted`; the compiler stopped that only
+      // because the media arm has no `message` to read. The `never` below is what makes
+      // a FOURTH arm a type error here rather than a frame silently taking the last
+      // branch.
+      //
+      // `media.updated` IS ONE LETTER FROM `message.updated` AND THEY SIT ADJACENT ON
+      // PURPOSE. Both can describe the same message: an edit changes its text, this
+      // changes what one of its attachments resolves to.
+      switch (revision.kind) {
+        case "updated":
+          send(connection.socket, { type: "message.updated", payload: revision.message });
+          break;
+        case "deleted":
+          send(connection.socket, { type: "message.deleted", payload: revision.message });
+          break;
+        case "media":
+          send(connection.socket, {
+            type: "media.updated",
+            payload: {
+              media_id: revision.media_id,
+              channel: revision.channel,
+              state: revision.state,
+            },
+          });
+          break;
+        default: {
+          const unreachable: never = revision;
+          return unreachable;
+        }
+      }
     }
   }
   fanout?.onRevision(deliverRevision);
```

### `services/api/src/db/repository.ts` — the tenant out of the verdict, and the state into every read.

```diff title="services/api/src/db/repository.ts"
@@ -15,7 +15,11 @@
   type SQL,
 } from "drizzle-orm";
 
-import type { Attachment } from "@relay/protocol";
+import type {
+  Attachment,
+  DeliveredAttachment,
+  MediaState,
+} from "@relay/protocol";
 
 import {
   DEFAULT_LIMITS,
@@ -550,6 +554,7 @@
     .select({
       id: mediaObjects.id,
       objectKey: mediaObjects.objectKey,
+      environmentId: mediaObjects.environmentId,
       mimeType: mediaObjects.mimeType,
       declaredBytes: mediaObjects.declaredBytes,
       createdAt: mediaObjects.createdAt,
@@ -600,6 +605,44 @@
  *
  * AND THE WORKER NEVER TOUCHES POSTGRES (ADR-04) — this runs inside the api, called by a
  * route on the internal seam, exactly as `creditConnectionMinutes` is. */
+/** THE CHANNELS A MEDIA OBJECT IS REFERENCED FROM, for a caller that has no repository.
+ *
+ * **A MODULE-LEVEL SIBLING OF `recordMediaVerdict`, AND THE SCOPE IS AN ARGUMENT RATHER
+ * THAN A CONSTRUCTOR.** `Repository.channelsReferencingMedia` is the delivery gate's,
+ * and it takes its tenant from `this.environmentId` — which the verdict seam does not
+ * have, because its caller is a worker. The query body is the same one, deliberately:
+ * 4.12 built and tested it, and a second lookup written for this path would drift from
+ * the one that decides who may read the bytes.
+ *
+ * **THE PREDICATE IS NOT OPTIONAL EVEN THOUGH THE LOOKUP WOULD WORK WITHOUT IT.**
+ * `media_id` is a primary key, so an unscoped query returns exactly these rows. It would
+ * also be a read of a shared table with no tenant predicate, which constitution I
+ * forbids in the data-access layer and which `check-lane-scope.py` exists to find. The
+ * environment travels out of the verdict's own `RETURNING` list so this can be asked
+ * properly.
+ *
+ * The containment operand is built here as a bound value rather than in SQL from a
+ * joined column — 4.12 measured the difference at 1,042 buffers against 84. */
+export async function channelsReferencingMediaIn(
+  db: Db,
+  environmentId: string,
+  mediaId: string,
+): Promise<string[]> {
+  const rows = await db
+    .selectDistinct({ id: channels.id })
+    .from(messages)
+    .innerJoin(channels, eq(channels.id, messages.channelId))
+    .where(
+      and(
+        sql`${messages.attachments} @> ${JSON.stringify([
+          { type: "media", media_id: mediaId },
+        ])}::jsonb`,
+        eq(channels.environmentId, environmentId),
+      ),
+    );
+  return rows.map((row) => row.id);
+}
+
 export async function recordMediaVerdict(
   db: Db,
   input: {
@@ -612,7 +655,23 @@
     durationMs?: number;
     reason?: "declaration_mismatch" | "scan_failed";
   },
-): Promise<{ applied: boolean; state: string | null; objectKey: string | null }> {
+): Promise<{
+  applied: boolean;
+  state: string | null;
+  objectKey: string | null;
+  /** THE TENANT, BECAUSE THIS FUNCTION IS THE ONLY PLACE THAT KNOWS IT (chapter 4.14).
+   *
+   * This is a module-level function on a raw `Db`, deliberately outside the
+   * tenant-scoped repository, because its caller is a worker rather than a tenant — and
+   * the worker's principal carries `environmentId: undefined` by design (4.4). FR-MED-07
+   * needs the transition announced on every channel referencing the object, and that
+   * lookup is scoped by environment. Without this value the caller's only options are a
+   * second read that can disagree with the compare-and-set, or an unscoped query, which
+   * is constitution I in the data-access layer.
+   *
+   * `null` only when no such object exists, which the caller answers with a 404. */
+  environmentId: string | null;
+}> {
   const [updated] = await db
     .update(mediaObjects)
     .set({
@@ -632,22 +691,35 @@
       // separately would open a window in which the row moved between the two
       // statements and the delete addressed somebody else's object.
       objectKey: mediaObjects.objectKey,
+      // AND THE TENANT, for the same reason: the fan-out FR-MED-07 needs is scoped by
+      // environment, and this statement is the only one that knows which.
+      environmentId: mediaObjects.environmentId,
     });
 
   if (updated)
-    return { applied: true, state: updated.state, objectKey: updated.objectKey };
+    return {
+      applied: true,
+      state: updated.state,
+      objectKey: updated.objectKey,
+      environmentId: updated.environmentId,
+    };
 
   // NOT `pending`: either somebody got there first, or the object does not exist. The
   // caller needs to tell those apart, so the current state comes back rather than a
   // bare false.
   const [row] = await db
-    .select({ state: mediaObjects.state, objectKey: mediaObjects.objectKey })
+    .select({
+      state: mediaObjects.state,
+      objectKey: mediaObjects.objectKey,
+      environmentId: mediaObjects.environmentId,
+    })
     .from(mediaObjects)
     .where(eq(mediaObjects.id, input.id));
   return {
     applied: false,
     state: row?.state ?? null,
     objectKey: row?.objectKey ?? null,
+    environmentId: row?.environmentId ?? null,
   };
 }
 
@@ -2414,10 +2486,17 @@
    * parse refuses at runtime, with no compiler anywhere in between. Required here means
    * every path that builds a row is named by `tsc` instead.
    *
-   * `Attachment[]` AND NOT `Attachment[] | null`, so the null lives only in the column.
-   * FR-007: a message with none is returned with an empty list rather than an absent or
-   * null field, and the `?? []` that makes that true belongs at the read, once. */
-  attachments: Attachment[];
+   * `DeliveredAttachment[]` AND NOT `Attachment[] | null`, so the null lives only in
+   * the column. FR-007: a message with none is returned with an empty list rather than
+   * an absent or null field, and the `?? []` that makes that true belongs at the read,
+   * once.
+   *
+   * **DELIVERED SINCE CHAPTER 4.14.** This interface is what a READ returns, and every
+   * read runs `withMediaStates` over it, so a media attachment on a row that reaches a
+   * caller always carries the state its object is in. A write path that builds one of
+   * these has to say the state too — which is the compiler naming the sites rather than
+   * a convention somebody has to remember. */
+  attachments: DeliveredAttachment[];
   created_at: string;
   /** When it was last edited, or `null` (FR-003). Optional on this
    * interface rather than required, because the WRITE paths build a row that has never
@@ -4301,7 +4380,11 @@
       idempotencyKey?: string;
     },
   ): Promise<MessageRow> {
-    return this.db.transaction(async (tx) => {
+    // FR-MED-07: decorated AFTER the transaction commits. The media state is not
+    // part of this write and reading it on the transaction's own connection would
+    // tie one fact's freshness to another's commit. One extra statement.
+    return this.withMediaState(
+      await this.db.transaction(async (tx) => {
       // ONE PERIOD FOR THE WHOLE TRANSACTION, taken before anything is checked.
       // The cap check and the increment must agree about which month this is; a
       // send that checked August and incremented September would be refused
@@ -4757,7 +4840,8 @@
         attachments: attachments ?? [],
         created_at: createdAt,
       };
-    });
+    }),
+    );
   }
 
   /** Change what a message says (FR-001, FR-002, FR-003, FR-004).
@@ -4796,7 +4880,11 @@
       userId,
     }: { text: string; userId: string },
   ): Promise<EditedMessageRow> {
-    return this.db.transaction(async (tx) => {
+    // FR-MED-07: decorated AFTER the transaction commits. The media state is not
+    // part of this write and reading it on the transaction's own connection would
+    // tie one fact's freshness to another's commit. One extra statement.
+    return this.withMediaState(
+      await this.db.transaction(async (tx) => {
       // THE ROW AND ITS CHANNEL IN ONE READ, joined so the tenant scope and the
       // channel-membership of the message are the same question. `messageId` alone
       // would edit a message of any channel of any tenant that guessed a uuid.
@@ -4963,7 +5051,8 @@
         edited_at: toIso(editedAt),
         prior_text: row.text,
       };
-    });
+    }),
+    );
   }
 
   /** Turn a message into a tombstone (FR-006, FR-006a, FR-009).
@@ -5626,7 +5715,10 @@
         `idempotency key ${idempotencyKey} conflicted but its message is missing — index inconsistency`,
       );
     }
-    return {
+    // FR-MED-07: the same decoration every other read does. An idempotent retry gets
+    // the state the object is in NOW, not the state it was in when the first send
+    // committed — which is the point of reading it at serve time.
+    return this.withMediaState({
       ...row,
       // FR-007's `?? []`, AT THE READ. The column holds NULL for a message with no
       // attachments and `[]` is what a client gets, so exactly one place converts.
@@ -5634,7 +5726,7 @@
       // `||` here is how a `0` or a `""` becomes a default somewhere else.
       attachments: row.attachments ?? [],
       created_at: toIso(row.created_at),
-    };
+    });
   }
 
   /** Does this channel resolve IN THIS TENANT? (chapter 2.8.)
@@ -5817,23 +5909,75 @@
    * channel afterwards, so the predicate below is redundant for correctness — and without
    * it this is the only read in this file that would scan every tenant's rows. A query
    * whose safety depends on a later call is a query somebody will reuse without it. */
-  private async channelsReferencingMedia(mediaId: string): Promise<string[]> {
-    const rows = await this.db
-      .selectDistinct({ id: channels.id })
-      .from(messages)
-      .innerJoin(channels, eq(channels.id, messages.channelId))
-      .where(
-        and(
-          // THE OPERAND IS A BOUND VALUE, WHICH IS WHAT THE INDEX NEEDS. Built here
-          // rather than in SQL from a joined column: `jsonb_build_array(...)` over
-          // `o.id` is an expression the planner cannot look up.
-          sql`${messages.attachments} @> ${JSON.stringify([
-            { type: "media", media_id: mediaId },
-          ])}::jsonb`,
-          eq(channels.environmentId, this.environmentId),
+  /** FR-MED-07's first sentence: an attachment is served with the state its object is
+   * in **right now**, not the state it was in when the message was sent.
+   *
+   * **TWO QUERIES PER PAGE AND NOT ONE PER ROW.** The obvious shape is a correlated
+   * subquery that decorates each row's jsonb, which is one lookup per message per
+   * attachment; 4.12 measured what that costs on the read path — 1,042 buffers against
+   * 84 — and the repair was to make the operand a value the planner already has. Here
+   * the whole page's media ids are collected first and fetched with one `= any(...)`
+   * against the primary key, scoped by environment. A fifty-message page costs one extra
+   * statement, whatever it attaches.
+   *
+   * **THE STATE IS NOT STORED ON THE MESSAGE, AND THAT IS FR-002 RATHER THAN A
+   * SHORTCUT.** `messages.attachments` holds what the sender declared. Writing a state
+   * into it would make every verdict a write across every referencing message and give
+   * one fact two homes, which is constitution IV.
+   *
+   * An id with no row — an object erased between the message being read and this
+   * query — is served as `pending`, because the alternative is dropping the attachment
+   * and a reader would see a message that never had it. FR-MED-10 destroys unreferenced
+   * objects, and a referenced one is not among them. */
+  private async withMediaStates<T extends { attachments: Attachment[] }>(
+    rows: T[],
+  ): Promise<(Omit<T, "attachments"> & { attachments: DeliveredAttachment[] })[]> {
+    const ids = [
+      ...new Set(
+        rows.flatMap((row) =>
+          row.attachments.filter((a) => a.type === "media").map((a) => a.media_id),
         ),
-      );
-    return rows.map((row) => row.id);
+      ),
+    ];
+    const states = new Map<string, MediaState>();
+    if (ids.length > 0) {
+      const found = await this.db
+        .select({ id: mediaObjects.id, state: mediaObjects.state })
+        .from(mediaObjects)
+        .where(
+          and(
+            inArray(mediaObjects.id, ids),
+            // THE TENANT PREDICATE, on a lookup by primary key that does not need it to
+            // return the right rows — and constitution I is about the layer, not about
+            // whether a given query could get away without it.
+            eq(mediaObjects.environmentId, this.environmentId),
+          ),
+        );
+      for (const row of found) states.set(row.id, row.state as MediaState);
+    }
+    return rows.map((row) => ({
+      ...row,
+      attachments: row.attachments.map((a) =>
+        a.type === "media" ? { ...a, state: states.get(a.media_id) ?? "pending" } : a,
+      ),
+    }));
+  }
+
+  /** One row, same query, same rule. Named separately so a caller reads as what it is
+   * rather than as an array of one. */
+  private async withMediaState<T extends { attachments: Attachment[] }>(
+    row: T,
+  ): Promise<Omit<T, "attachments"> & { attachments: DeliveredAttachment[] }> {
+    const [decorated] = await this.withMediaStates([row]);
+    return decorated!;
+  }
+
+  private async channelsReferencingMedia(mediaId: string): Promise<string[]> {
+    // ONE QUERY BODY, TWO CALLERS (chapter 4.14). The verdict seam has no repository to
+    // call this on, so the statement moved to a module-level function that takes the
+    // scope as an argument. Delegating rather than repeating is what keeps the delivery
+    // gate and the fan-out asking the same question of the same predicate.
+    return channelsReferencingMediaIn(this.db, this.environmentId, mediaId);
   }
 
   async channelExists(channelId: string): Promise<boolean> {
@@ -5972,7 +6116,12 @@
           .where(scoped(gt(messages.sequence, afterSeq)))
           .orderBy(asc(messages.sequence))
           .limit(limit));
-    return rows.map((row) => ({
+    // FR-MED-07: the state each media attachment's object is in NOW, added after the
+    // page is read and in one query for the whole page (see `withMediaStates`). It is
+    // read here rather than stored on the message, so a message sent before a verdict
+    // reflects the verdict the next time anybody reads it.
+    return this.withMediaStates(
+      rows.map((row) => ({
       ...row,
       /** FR-007's `?? []`, IN THE MAP AND NOT IN THE CALLER.
        *
@@ -5987,7 +6136,8 @@
       // key and a null one are the same value through `??` — the control test for this
       // field was green before the field existed because its first draft used `??`.
       edited_at: row.edited_at === null ? null : toIso(row.edited_at),
-    }));
+      })),
+    );
   }
 
   /** Resume backfill (chapter 2.7, FR-RTM-03): for each cursor, everything
```

### `services/api/src/internal/internal.module.ts` — the publisher `MessagesModule` withholds.

```diff title="services/api/src/internal/internal.module.ts"
@@ -1,9 +1,21 @@
-import { Module, Scope } from "@nestjs/common";
+import {
+  Inject,
+  Injectable,
+  Module,
+  type OnModuleDestroy,
+  Scope,
+} from "@nestjs/common";
 
 import { MessagesModule } from "../messages/messages.module";
 import { AuthModule } from "../auth/auth.module";
 import { createDb, createPool, type Db } from "../db/client";
+import {
+  createMessagePublisher,
+  MESSAGE_PUBLISHER,
+  type MessagePublisher,
+} from "../fanout/publisher";
 import { LOGGER, apiLogger } from "../logger";
+import type { Logger } from "@relay/service-kit";
 import {
   createJetStreamPublisher,
   ensureAnalyticsStream,
@@ -29,6 +41,22 @@
 // so this module declares its own — the same DEFAULT-scoped factory every other
 // module here uses, and a smaller change than widening 2.2's exports for a
 // reason 2.2 has nothing to do with.
+/** Closes the publisher this module declares. `MessagesModule` has its twin, and the
+ * two are separate clients on purpose: sharing one would mean exporting a token that
+ * module withholds, and `ANALYTICS_PUBLISHER` already set the precedent for a second
+ * client in this process — argued rather than assumed. The cost is one more Redis
+ * connection per api instance. */
+@Injectable()
+export class InternalMessagePublisherLifecycle implements OnModuleDestroy {
+  constructor(
+    @Inject(MESSAGE_PUBLISHER) private readonly publisher: MessagePublisher,
+  ) {}
+
+  async onModuleDestroy(): Promise<void> {
+    await this.publisher.close();
+  }
+}
+
 @Module({
   imports: [MessagesModule, AuthModule],
   controllers: [
@@ -75,6 +103,30 @@
       useFactory: apiLogger,
       scope: Scope.DEFAULT,
     },
+    // FR-MED-07's producer needs a fabric, and this module had no way to reach one.
+    //
+    // `MessagesModule` declares `MESSAGE_PUBLISHER` and **deliberately does not export
+    // it** — its own comment says so — so importing that module gives the controllers
+    // here nothing to inject. Same reason `LOGGER` and `ANALYTICS_PUBLISHER` are
+    // redeclared above: a provider is visible to the module that declares it and to
+    // nothing it imports.
+    //
+    // **WITHOUT THIS THE FAILURE IS A RUNTIME ONE.** `Nest can't resolve dependencies of
+    // the MediaVerificationController` on the first request, after lint, typecheck and
+    // every unit test pass — which is exactly what chapter 4.10 recorded when
+    // `MediaModule` declared a service it did not provide: *"Only a running app asks
+    // that question."* `media-verdict.itest.ts` is the test that asks it.
+    {
+      provide: MESSAGE_PUBLISHER,
+      inject: [LOGGER],
+      useFactory: (logger: Logger): MessagePublisher =>
+        createMessagePublisher({ logger }),
+      scope: Scope.DEFAULT,
+    },
+    // AND SOMETHING HAS TO CLOSE IT. `MessagesModule` pairs its publisher with a
+    // lifecycle for the same reason; a second client with no `OnModuleDestroy` leaks its
+    // connection on shutdown, and the api is a process that gets restarted.
+    InternalMessagePublisherLifecycle,
   ],
 })
 export class InternalModule {}
```

### `packages/protocol/src/frames.test.ts` — what the built shape must say and the forwarding shape must not insist on.

```diff title="packages/protocol/src/frames.test.ts"
@@ -1,13 +1,20 @@
 import { describe, expect, it } from "vitest";
 
-import { frameSchema, messageDeletedSchema, messageSchema, parseFrame } from "./frames.js";
+import {
+  forwardedMessageSchema,
+  frameSchema,
+  mediaUpdatedSchema,
+  messageDeletedSchema,
+  messageSchema,
+  parseFrame,
+} from "./frames.js";
 
 // The contract must bite: for every frame, one specimen that parses and a
 // table of malformed near-misses that MUST reject. A schema that accepts
 // garbage is worse than no schema — it certifies garbage.
 
 const message = {
   id: "m1",
   channel: "c1",
   seq: 42,
   user: "u1",
@@ -257,22 +264,26 @@
         type: "message.deleted",
         payload: tombstone,
       }).success,
     ).toBe(true);
   });
 });
 
 describe("the frame union's membership", () => {
   const members = frameSchema.options.map((o) => o.shape.type.value);
 
-  it("has eleven members", () => {
-    expect(members).toHaveLength(11);
+  // TWELVE SINCE CHAPTER 4.14, AND THIS TEST IS WHY THE COUNT IS WRITTEN DOWN. It went
+  // red on `media.updated` the moment the frame joined the union, which is the whole
+  // job of an accounting assertion: a frame added and not announced is a contract
+  // change nobody reviewed.
+  it("has twelve members", () => {
+    expect(members).toHaveLength(12);
   });
 
   it("names exactly two inbound frames, and both end in `.send`", () => {
     // The direction is not derivable from the schema — `isolation.itest.ts`'s
     // DIRECTIONS table is where it lives, and this asserts the naming rule that
     // makes the table's inbound rows predictable rather than remembered.
     expect(members.filter((m) => m.endsWith(".send")).sort()).toEqual([
       "message.send",
       "typing.send",
     ]);
@@ -282,10 +293,96 @@
     // FR-008: `typingSchema` is not edited by this chapter. The pair is the
     // proof — same subject, two frames, and only the server's has a `user`.
     expect(parseFrame({ type: "typing", payload: { channel: "c1" } }).success).toBe(
       false,
     );
     expect(
       parseFrame({ type: "typing.send", payload: { channel: "c1" } }).success,
     ).toBe(true);
   });
 });
+
+describe("media.updated, the frame that lets a placeholder resolve (4.14)", () => {
+  const MEDIA = "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21";
+  const CHANNEL = "6f1d2e3a-4b5c-4d6e-8f90-a1b2c3d4e5f6";
+  const frame = {
+    type: "media.updated",
+    payload: { media_id: MEDIA, channel: CHANNEL, state: "ready" },
+  } as const;
+
+  it("parses through the union every frame must belong to", () => {
+    expect(frameSchema.parse(frame)).toEqual(frame);
+  });
+
+  // NO `reason`. The cause of a rejection is a closed set of two, and putting it on a
+  // channel fabric tells every subscriber that a member's upload failed a virus scan.
+  // FR-MED-06's three refusals are byte-identical for the same reason.
+  it("refuses a rejection reason, which would be a fact about somebody else", () => {
+    expect(
+      mediaUpdatedSchema.safeParse({
+        type: "media.updated",
+        payload: { ...frame.payload, state: "rejected", reason: "scan_failed" },
+      }).success,
+    ).toBe(false);
+  });
+
+  // NO message id. One object can be attached by several messages in one channel, so
+  // naming one would be picking one of several and calling it the one.
+  it("refuses a message id", () => {
+    expect(
+      mediaUpdatedSchema.safeParse({
+        type: "media.updated",
+        payload: { ...frame.payload, message_id: MEDIA },
+      }).success,
+    ).toBe(false);
+  });
+
+  it("refuses state pending, which is not a transition out of pending", () => {
+    expect(
+      mediaUpdatedSchema.safeParse({
+        type: "media.updated",
+        payload: { ...frame.payload, state: "pending" },
+      }).success,
+    ).toBe(false);
+  });
+});
+
+describe("the live delivery reader and the binary that ran before this deploy (4.14)", () => {
+  const ID = "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21";
+  const base = {
+    id: "m1",
+    channel: "c1",
+    seq: 1,
+    user: "u1",
+    text: "hello",
+    created_at: "2026-09-28T00:00:00.000Z",
+  };
+
+  // T028. `gateway/src/fanout.ts` parses every frame off the fabric with
+  // `forwardedMessageSchema` and answers a failure with a log line and a `return` — the
+  // frame is dropped, the sender already holds its 201, and no socket on that instance
+  // sees it. An envelope written before this chapter carries a media attachment with no
+  // `state`; if this reader required one, a rolling deploy would drop every message
+  // carrying a photo.
+  it("parses a forwarded message whose media attachment has no state", () => {
+    const envelope = { ...base, attachments: [{ type: "media", media_id: ID }] };
+    expect(forwardedMessageSchema.parse(envelope)).toEqual(envelope);
+  });
+
+  it("parses one written after, and keeps the state", () => {
+    const envelope = {
+      ...base,
+      attachments: [{ type: "media", media_id: ID, state: "rejected" }],
+    };
+    expect(forwardedMessageSchema.parse(envelope)).toEqual(envelope);
+  });
+
+  // AND THE STRICT SHAPE REFUSES THE OLD ONE, which is what makes the pair meaningful:
+  // `messageSchema` is what the api BUILDS and must always say, `forwardedMessageSchema`
+  // is what a relay READS and must never insist.
+  it("and the built shape refuses a media attachment with no state", () => {
+    expect(
+      messageSchema.safeParse({ ...base, attachments: [{ type: "media", media_id: ID }] })
+        .success,
+    ).toBe(false);
+  });
+});
```

### `packages/protocol/src/revision.test.ts` — the third arm, and `channelOfRevision` for every arm.

```diff title="packages/protocol/src/revision.test.ts"
@@ -2,6 +2,8 @@
 
 import {
   isChannelRevisionSubject,
+  channelOfRevision,
+  logFieldsOfRevision,
   revisionFabricSchema,
   subjectForChannelRevision,
 } from "./revision.js";
@@ -113,3 +115,58 @@
     ).toBe(false);
   });
 });
+
+describe("the third arm: a transition of an object a message references (4.14)", () => {
+  const MEDIA = "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21";
+  const CHANNEL = "6f1d2e3a-4b5c-4d6e-8f90-a1b2c3d4e5f6";
+  const arm = { kind: "media", media_id: MEDIA, channel: CHANNEL, state: "ready" } as const;
+
+  it("parses, and its channel is a field rather than a message's", () => {
+    expect(revisionFabricSchema.parse(arm)).toEqual(arm);
+  });
+
+  // `pending` IS A STATE THE PRODUCER CANNOT EMIT. The frame announces a transition out
+  // of it, so admitting it would be a value nothing can reach — `0018`'s argument for
+  // refusing a fourth value in the column, applied to the wire.
+  it("refuses state pending, which no transition can announce", () => {
+    expect(revisionFabricSchema.safeParse({ ...arm, state: "pending" }).success).toBe(false);
+  });
+
+  it("refuses an unknown key, like both older arms", () => {
+    expect(
+      revisionFabricSchema.safeParse({ ...arm, reason: "scan_failed" }).success,
+    ).toBe(false);
+  });
+
+  it("refuses an unknown kind rather than guessing", () => {
+    expect(revisionFabricSchema.safeParse({ ...arm, kind: "media.v2" }).success).toBe(false);
+  });
+});
+
+describe("channelOfRevision answers for every arm (4.14)", () => {
+  const CHANNEL = "6f1d2e3a-4b5c-4d6e-8f90-a1b2c3d4e5f6";
+
+  // Eight production sites reached through `revision.message.channel` before the media
+  // arm existed. This is the one place that knows which field each arm keeps it in.
+  it("reads a media arm's own channel field", () => {
+    expect(
+      channelOfRevision({
+        kind: "media",
+        media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+        channel: CHANNEL,
+        state: "rejected",
+      }),
+    ).toBe(CHANNEL);
+  });
+
+  it("omits message_id for a media arm rather than logging undefined", () => {
+    const fields = logFieldsOfRevision({
+      kind: "media",
+      media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+      channel: CHANNEL,
+      state: "ready",
+    });
+    expect(fields).toEqual({ channel: CHANNEL, kind: "media" });
+    expect("message_id" in fields).toBe(false);
+  });
+});
```

### `services/api/src/fanout/publisher.test.ts` — the media arm publishes to its own channel, and logs no message id.

```diff title="services/api/src/fanout/publisher.test.ts"
@@ -254,3 +254,39 @@
     expect(publishes).toHaveLength(1);
   });
 });
+
+describe("the media arm, which carries no message (4.14)", () => {
+  const mediaRevision = {
+    kind: "media",
+    media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+    channel: "c1",
+    state: "ready",
+  } as const;
+
+  // THE SUBJECT COMES FROM THE ARM'S OWN CHANNEL FIELD. Before this chapter the
+  // publisher read `revision.message.channel`, which the media arm does not have —
+  // it would have published to `revision:undefined`, a subject nobody subscribes to,
+  // and `publishRevision` never rejects, so nothing would have said so.
+  it("publishes to the channel named on the arm itself", async () => {
+    const { logger } = sink();
+    await createMessagePublisher({ logger }).publishRevision(mediaRevision, context);
+    expect(publishes).toHaveLength(1);
+    expect(publishes[0]?.[0]).toBe("revision:c1");
+  });
+
+  // `publishRevision` NEVER REJECTS by contract, so a test that only checks the happy
+  // path cannot tell a published frame from a swallowed one. This asserts what the log
+  // says, and that a media arm logs no `message_id` rather than logging `undefined`.
+  it("logs without throwing when the broker is down, and omits message_id", async () => {
+    throwing = true;
+    const { lines, logger } = sink();
+    await expect(
+      createMessagePublisher({ logger }).publishRevision(mediaRevision, context),
+    ).resolves.toBeUndefined();
+    const failure = lines.find((l) => l["msg"] === "fanout.publish_failed");
+    expect(failure).toBeDefined();
+    expect(failure?.["channel"]).toBe("c1");
+    expect(failure?.["kind"]).toBe("media");
+    expect("message_id" in (failure ?? {})).toBe(false);
+  });
+});
```

### `services/gateway/src/session.test.ts` — a media transition is not a deletion, and who is not told.

```diff title="services/gateway/src/session.test.ts"
@@ -6,7 +6,12 @@
 
 import { createLogger, type Logger } from "@relay/service-kit";
 import { serve } from "@relay/service-kit";
-import { CLOSE_CODES, type Frame, type RevisionFabric } from "@relay/protocol";
+import {
+  channelOfRevision,
+  CLOSE_CODES,
+  type Frame,
+  type RevisionFabric,
+} from "@relay/protocol";
 
 import type { InternalSendResponse, Message } from "@relay/protocol";
 
@@ -160,8 +165,13 @@
     // The same rule the message emitter honours: a revision published to a subject this
     // instance has not subscribed to does not arrive.
     emitRevision: (revision: RevisionFabric) => {
-      if (subjects.includes(revision.message.channel)) {
-        deliverRevision(revision.message.channel, revision);
+      // `channelOfRevision` FOR THE REASON PRODUCTION USES IT: not every arm carries a
+      // message. A harness that cannot route the media arm would leave every test
+      // downstream of it unable to exercise that path — and it would do so while
+      // staying green, which is worse than a red test.
+      const channel = channelOfRevision(revision);
+      if (subjects.includes(channel)) {
+        deliverRevision(channel, revision);
       }
     },
     subscribe: async (channelId) => {
@@ -669,6 +679,84 @@
     socket.close();
   });
 
+  it("a media transition arrives as media.updated, not as a revision of a message", async () => {
+    const fanout = stubFanout();
+    harness = await boot(stubApi({}), undefined, fanout);
+    const socket = new WebSocket(`${harness.url}?token=${await token()}`);
+    const frames = record(socket);
+    await nextFrame(socket, "connection.ack");
+    await settle();
+
+    fanout.emitRevision({
+      kind: "media",
+      media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+      channel: CHANNEL,
+      state: "ready",
+    });
+    await settle();
+
+    const updates = frames.filter((f) => f.type === "media.updated");
+    expect(updates).toHaveLength(1);
+    expect(updates[0]).toMatchObject({
+      payload: { media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21", state: "ready" },
+    });
+    // THE FALSIFYING HALF, AND IT IS WHY THE TERNARY BECAME A SWITCH. A two-way
+    // conditional on `kind === "updated"` sends everything else down the `deleted`
+    // branch, so a media transition would have arrived as `message.deleted` — a frame
+    // telling a client its message is gone. The compiler stopped that shape because the
+    // media arm has no `message`; this is the assertion that would have caught it if the
+    // arm had carried one.
+    expect(frames.filter((f) => f.type === "message.deleted")).toEqual([]);
+    expect(frames.filter((f) => f.type === "message.updated")).toEqual([]);
+    socket.close();
+  });
+
+  // T042/T043 — CONSTITUTION I ON THE DELIVERY SIDE. A transition is addressed to a
+  // CHANNEL, and a connection receives it only if it is subscribed to that channel.
+  // Subscription follows membership (`session.ts:593`), so a non-member receives
+  // nothing without this path needing an access rule of its own.
+  it("a media transition for a channel this connection is not in reaches nobody", async () => {
+    const fanout = stubFanout();
+    harness = await boot(stubApi({}), undefined, fanout);
+    const socket = new WebSocket(`${harness.url}?token=${await token()}`);
+    const frames = record(socket);
+    await nextFrame(socket, "connection.ack");
+    await settle();
+
+    // A POSITIVE CONTROL FIRST, so the silence below is evidence rather than a bet that
+    // nothing was delivered for an unrelated reason.
+    fanout.emitRevision({
+      kind: "media",
+      media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+      channel: CHANNEL,
+      state: "ready",
+    });
+    await settle();
+    expect(frames.filter((f) => f.type === "media.updated")).toHaveLength(1);
+
+    fanout.emitRevision({
+      kind: "media",
+      media_id: "c72cfefc-c53f-4fa6-b2be-3cfee4b5fe32",
+      channel: "99999999-9999-9999-9999-999999999999",
+      state: "rejected",
+    });
+    await settle();
+
+    // STILL ONE. The second transition names a channel this connection never joined,
+    // and the stub fabric routes on the subject exactly as Redis does.
+    //
+    // **AND THIS IS ALSO THE UNDER-DELIVERY CASE, WHICH IS THE SAFE DIRECTION.**
+    // FR-MED-08 authorises by channel VISIBILITY — a user may read a public channel's
+    // messages without being a member — while a connection subscribes by MEMBERSHIP.
+    // So subscribers are a subset of authorised readers: a non-member of a PUBLIC
+    // channel is entitled to the photo and will not get this frame. The set is
+    // narrower, never wider, so FR-007 holds by construction and history is the repair.
+    // Recorded here so nobody later "fixes" it by broadcasting wider, which is the
+    // direction that would leak.
+    expect(frames.filter((f) => f.type === "media.updated")).toHaveLength(1);
+    socket.close();
+  });
+
   it("a deletion arrives as message.deleted, with no text on it", async () => {
     const fanout = stubFanout();
     harness = await boot(stubApi({}), undefined, fanout);
```

### `services/gateway/src/fanout.itest.ts` — three assertions that needed a `kind` guard once a third arm existed.

```diff title="services/gateway/src/fanout.itest.ts"
@@ -318,6 +318,33 @@
     await g2.fanout.unsubscribe(CHANNEL);
   });
 
+  // CHAPTER 4.14, AND THE ONE THING NEITHER OTHER SUITE CAN SHOW. The api's
+  // `media-updated.itest.ts` proves the producer publishes; `session.test.ts` proves a
+  // gateway routes the arm to a subscribed socket, against a STUB fabric. Only two real
+  // clients over real Redis prove the arm survives the wire — and this is the arm that
+  // carries no `message`, so every site deriving a subject or a routing key from
+  // `revision.message.channel` had to learn a third shape.
+  it("carries a media transition to the other instance, routed by its own channel", async () => {
+    await g1.fanout.publishRevision({
+      kind: "media",
+      media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+      channel: CHANNEL,
+      state: "ready",
+    });
+
+    const [channelId, revision] = await nextRevision(g2);
+    // THE CHANNEL THE ROUTER CHOSE. Before this arm existed the router read
+    // `revision.data.message.channel` — a field this arm does not have, and the
+    // failure would have been a subject of `revision:undefined` that nobody subscribes
+    // to, published by a function whose contract is never to reject.
+    expect(channelId).toBe(CHANNEL);
+    expect(revision.kind).toBe("media");
+    expect(revision.kind === "media" && revision.media_id).toBe(
+      "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+    );
+    expect(revision.kind === "media" && revision.state).toBe("ready");
+  });
+
   // THE SUBJECT GRAMMAR'S TEST MOVED IN THE FAN-OUT CHAPTER, to
   // `packages/protocol/src/fanout.test.ts`, along with `subjectFor` itself. It
   // was a pure string assertion sitting in a suite that needs a running Redis;
```

### `services/gateway/src/main.test.ts` — the second hard-coded frame count, which also fired.

```diff title="services/gateway/src/main.test.ts"
@@ -39,12 +39,18 @@
       const expectedFrames = frameSchema.options.map((o) => o.shape.type.value);
       expect(body.protocol.frames).toEqual(expectedFrames);
       expect(body.protocol.frames).toContain("connection.ack");
-      // ELEVEN from the typing chapter's `typing.send`. The `toEqual` above is derived
-      // on both sides and needed nothing; this line is the second of the two
-      // hard-coded frame counts in the repository, and the only one no task
-      // owned until analysis pass 17. It failed here in the UNIT lane, which
-      // `test:integration` does not run and no phase gate ran until pass 18.
-      expect(body.protocol.frames).toHaveLength(11);
+      // TWELVE since chapter 4.14's `media.updated`. Eleven came from the typing
+      // chapter's `typing.send`. The `toEqual` above is derived on both sides and
+      // needed nothing; this line is the second of the two hard-coded frame counts in
+      // the repository, and the only one no task owned until analysis pass 17. It
+      // failed here in the UNIT lane, which `test:integration` does not run and no
+      // phase gate ran until pass 18.
+      //
+      // BOTH HARD-CODED COUNTS FIRED ON 4.14, WHICH IS WHY THERE ARE TWO. The protocol
+      // package asserts the union's own length; this asserts what the gateway
+      // ADVERTISES over HTTP. A frame added to the union and not served would pass the
+      // first and fail this one.
+      expect(body.protocol.frames).toHaveLength(12);
       expect(body.protocol.close_codes).toEqual(
         Object.keys(CLOSE_CODES).map(Number),
       );
```

### `services/api/src/messages/messages.itest.ts` — the fourth assertion that predicted movement VI.

```diff title="services/api/src/messages/messages.itest.ts"
@@ -233,12 +233,17 @@
         attachments: [{ type: "media", media_id }],
       });
       expect(res.status).toBe(201);
-      // AND IT COMES BACK AS SENT. `state` is not on the wire — FR-013 — so what a
-      // reader gets is the two keys the client wrote and nothing the platform knows
-      // about the object. The slot is `pending` and will stay `pending` until movement
-      // VI, and a client cannot tell from this payload.
+      // AND IT COMES BACK AS SENT, PLUS THE ONE FIELD MOVEMENT VI ADDS. This read
+      // `[{ type, media_id }]` under a comment saying the slot *"will stay `pending`
+      // until movement VI, and a client cannot tell from this payload"*. Chapter 4.14
+      // is movement VI and a client can tell. **The fourth assertion of this shape** —
+      // three are in `media/attach.itest.ts` and this one lives a directory away, which
+      // is why running the media suite alone did not find it.
+      //
+      // Still `toEqual` on the whole array: FR-013's claim is about what is ABSENT, and
+      // a property check would pass against a payload that had grown a filename too.
       const body = (await res.json()) as { attachments: unknown[] };
-      expect(body.attachments).toEqual([{ type: "media", media_id }]);
+      expect(body.attachments).toEqual([{ type: "media", media_id, state: "pending" }]);
     });
 
     // THE SECOND SENT `"m_1"`, WHICH IS NOW A 400 AT THE SCHEMA AND WAS A 422 AT THE
```

### `services/gateway/src/isolation.itest.ts` — the directions table, and a well-formed forged sample.

```diff title="services/gateway/src/isolation.itest.ts"
@@ -767,6 +767,16 @@
   // an inbound frame's sample and the case would be dead code a task required.
   // Said here because the next reader adding an inbound type will wonder.
   ["typing.send", "inbound", "this chapter: a client may say it is typing (session.ts)"],
+  // CHAPTER 4.14, AND THE FOURTH PLACE THIS REPOSITORY COUNTS FRAMES. The other three
+  // are the protocol union's own length, the gateway's advertised vocabulary, and the
+  // "classified exactly once" check below. All four fired on `media.updated`, which is
+  // what an accounting assertion is for: a frame added and not announced is a contract
+  // change nobody reviewed.
+  //
+  // OUTBOUND, and the reason is the same one `message.created` has: the server decides
+  // that an object's state changed, and it decides who is told. A client uttering this
+  // would be claiming a verdict it did not reach about bytes it never read.
+  ["media.updated", "outbound", "a verdict the server reached; a client claiming one would forge it"],
   ["error", "outbound", "the server's refusal shape"],
 ];
 
@@ -787,6 +797,14 @@
     created_at: new Date().toISOString(),
   };
   switch (type) {
+    // 4.14. A forged `media.updated` must be WELL-FORMED so its refusal is
+    // `unknown_frame_type` and not `invalid_frame` — the loop above exists to test the
+    // direction check, and a malformed sample would be refused a phase earlier.
+    case "media.updated":
+      return {
+        type,
+        payload: { media_id: randomUUID(), channel, state: "ready" },
+      };
     case "connection.ack":
       // AND `revisions` FOR THE SAME REASON, ONE FIELD LATER. This chapter made it
       // required on the ack, so this sample stopped satisfying `connectionAckSchema`
@@ -856,11 +874,12 @@
     (option) => (option.shape.type as { value: string }).value,
   );
 
-  it("derives all eleven members from the union itself", () => {
-    // ELEVEN with this chapter's `typing.send`. **The title carries the number
-    // too**, and updating the assertion without the title is how the presence
-    // chapter shipped a good test under a false name.
-    expect(members.length).toBe(11);
+  it("derives all twelve members from the union itself", () => {
+    // TWELVE with chapter 4.14's `media.updated`; eleven with the typing chapter's
+    // `typing.send`. **The title carries the number too**, and updating the assertion
+    // without the title is how the presence chapter shipped a good test under a false
+    // name — so both moved here.
+    expect(members.length).toBe(12);
   });
 
   it("classifies every member exactly once", () => {
```

### `services/gateway/src/session.itest.ts` — the fifth frame count, and its own sample builder.

```diff title="services/gateway/src/session.itest.ts"
@@ -1290,6 +1290,20 @@
       created_at: new Date().toISOString(),
     };
     switch (type) {
+      // 4.14, AND THE THIRD TIME THIS FILE HAS PAID THE SAME BILL. The comment on
+      // `connection.ack` below records the second: a field added to a frame makes the
+      // forged sample malformed, and the loop then asserts `invalid_frame` — the
+      // refusal a phase BEFORE the direction check it exists for. A new frame does it
+      // too, by having no case at all.
+      case "media.updated":
+        return {
+          type,
+          payload: {
+            media_id: "b61bfdfb-b42e-4e95-a1ed-2bedd3a4ed21",
+            channel,
+            state: "ready",
+          },
+        };
       case "connection.ack":
       // AND `revisions` FOR THE SAME REASON, ONE FIELD LATER. This chapter made it
       // required on the ack, so the sample above stopped satisfying
@@ -1421,7 +1435,13 @@
       .map((option) => (option.shape.type as { value: string }).value)
       .filter((type) => type !== "message.send" && type !== "typing.send");
 
-    expect(outbound).toHaveLength(9);
+    // TEN SINCE CHAPTER 4.14's `media.updated`. **The FIFTH place this repository
+    // counts frames**, after the protocol union's own length, the gateway's advertised
+    // vocabulary, `isolation.itest.ts`'s derived count and its classified-exactly-once
+    // check. Every one of the five fired on this chapter, which is the argument for
+    // having them: a server-to-client frame added without a direction is one a client
+    // could forge.
+    expect(outbound).toHaveLength(10);
 
     for (const type of outbound) {
       const socket = connect(await mintToken());
```

### `vitest.coverage.config.mts` — a statement no test can reach.

```diff title="vitest.coverage.config.mts"
@@ -532,8 +532,21 @@
           // arms this file has are the 404, the 422, the byte deletion and its log.
           branches: 83,
           functions: 100,
-          lines: 93,
-          statements: 93,
+          // 92 AND 92, FROM 93 AND 93, AND THE REASON IS A STATEMENT NO TEST CAN REACH
+          // (chapter 4.14). The file gained `announce`, and one of its statements is a
+          // `ready`/`rejected` guard that is unreachable: it runs only when the
+          // compare-and-set applied, and one that applied set the state to the verdict.
+          // The per-arm probe established that by deleting it and watching nothing turn
+          // red; it stays because it is what narrows `string | null` for the compiler.
+          //
+          // **This is not the branch pin's problem two lines up.** That one is a
+          // denominator that differs between this machine and CI (059-20) — two
+          // figures that are not samples of one quantity. This is one figure, measured
+          // the same everywhere, with an uncoverable statement in it. 059-22's rule:
+          // ask what the number is measuring before you move it, because both present
+          // as a red pin.
+          lines: 92,
+          statements: 92,
         },
 
         "services/dispatcher/src/expand.ts": {
```

### `eslint.config.mjs` — the fabric oracle's exemption, under reason (4).

```diff title="eslint.config.mjs"
@@ -173,6 +173,12 @@
     // that is JSON and not a transition) that no module-level API can produce,
     // because each only ever publishes payloads its own schema built.
     "services/api/src/fanout/fanout.itest.ts",
+    // Chapter 4.14, and reason (4) exactly. This suite drives the verdict ROUTE and
+    // asserts a frame reached `revision:{channel}` — the subject, not the call. A spy
+    // on the publisher would prove the controller asked; only a subscriber proves the
+    // fan-out chose the right channels, published once per channel, and published
+    // nothing at all for an object nobody attached.
+    "services/api/src/media/media-updated.itest.ts",
     "services/gateway/src/presence.itest.ts",
     "services/gateway/src/membership.itest.ts",
     "services/gateway/src/typing.itest.ts",
```

### `services/gateway/src/fanout.itest.ts` — and the three assertions that needed a `kind` guard.

```diff title="services/gateway/src/fanout.itest.ts"
@@ -260,7 +260,10 @@
 
     const [, revision] = await nextRevision(g2);
     expect(revision.kind).toBe("deleted");
-    expect(revision.message.seq).toBe(9);
+    // GUARDED, like the `updated` assertion above it. Before the media arm existed
+    // every arm had a message and the guard was optional; now it is what makes the
+    // assertion type-check, and asserting the kind first is what makes it meaningful.
+    expect(revision.kind === "deleted" && revision.message.seq).toBe(9);
     expect(g2.deliveries).toEqual([]);
     await g2.fanout.unsubscribe(CHANNEL);
   });
@@ -276,7 +279,7 @@
     await g2.fanout.subscribe(own);
     await g1.fanout.publishRevision({ kind: "updated", message: messageOn(own, 10) });
     const [, revision] = await nextRevision(g2);
-    expect(revision.message.seq).toBe(10);
+    expect(revision.kind === "updated" && revision.message.seq).toBe(10);
 
     await g2.fanout.unsubscribe(own);
     await g1.fanout.publishRevision({ kind: "updated", message: messageOn(own, 11) });
@@ -310,7 +313,7 @@
     // the schema and not a dead subscription.
     await raw.fanout.publishRevision({ kind: "updated", message: messageOn(CHANNEL, 14) });
     const [, good] = await nextRevision(g2);
-    expect(good.message.seq).toBe(14);
+    expect(good.kind === "updated" && good.message.seq).toBe(14);
     await raw.fanout.close();
     await g2.fanout.unsubscribe(CHANNEL);
   });
```

### `packages/protocol/src/revision.test.ts` — narrowed before reading a union arm, which only `pnpm typecheck` reaches.

```diff title="packages/protocol/src/revision.test.ts"
@@ -70,7 +70,11 @@
 describe("the revision fabric payload", () => {
   it("takes an edit as a whole message", () => {
     const parsed = revisionFabricSchema.parse({ kind: "updated", message });
-    expect(parsed.kind).toBe("updated");
+    // NARROWED BEFORE READING `message`, because chapter 4.14's third arm does not have
+    // one. `expect(parsed.kind)` alone does not narrow for the compiler, and `pnpm
+    // build` never said so: `tsconfig.build.json` excludes tests, so only
+    // `pnpm typecheck` reaches this file.
+    if (parsed.kind !== "updated") throw new Error("expected the updated arm");
     expect(Object.keys(parsed.message).sort()).toEqual([
       "attachments",
       "channel",
@@ -84,7 +88,7 @@
 
   it("takes a deletion as an identity with no text", () => {
     const parsed = revisionFabricSchema.parse({ kind: "deleted", message: tombstone });
-    expect(parsed.kind).toBe("deleted");
+    if (parsed.kind !== "deleted") throw new Error("expected the deleted arm");
     expect(Object.keys(parsed.message).sort()).toEqual([
       "channel",
       "deleted_at",
```

### `packages/outsider/src/integrate.itest.ts` — the fifth assertion, in the suite no local lane runs.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -498,9 +498,20 @@
 
     // BOTH ARMS, IN ORDER, ON THE SOCKET. The url arm proves nothing new; what it does is
     // hold the order claim, which one attachment cannot show.
+    //
+    // AND THE MEDIA ARM CARRIES ITS STATE SINCE CHAPTER 4.14 — **the fifth assertion of
+    // this shape and the only one no local lane reaches.** `pnpm test`,
+    // `pnpm test:integration` and `pnpm coverage` all skip this suite: it needs a
+    // composed stack and three environment variables, so CI's sealed job and a
+    // hand-run are the only things that execute it. The other four were found by the
+    // api lane and the coverage lane; this one was found by CI.
+    //
+    // `pending` is right and is not a race. The object was uploaded but nothing has
+    // verified it — this suite runs no media worker, which is what makes the value
+    // stable rather than timing-dependent.
     expect(delivered.payload.attachments).toEqual([
       { type: "url", kind: "image", url: "https://example.test/outside-url.png" },
-      { type: "media", media_id: mediaId },
+      { type: "media", media_id: mediaId, state: "pending" },
     ]);
     socket.close();
 
```

```diff title="packages/protocol/src/attachments.ts"
@@ -106,12 +106,40 @@
 /** FR-MED-07's first sentence: the three states a media object can be in, as the wire
  * spells them. One declaration, because `0018`'s CHECK constraint and this enum are the
  * same closed set seen from two sides and two spellings would be the `idem_key` against
  * `idempotency_key` defect this file's own header names. */
 export const MEDIA_STATES = ["pending", "ready", "rejected"] as const;
 
+/** FR-MED-05's derived objects, as the wire and the column spell them (chapter 4.15).
+ *
+ * A CLOSED SET HERE AND NOT A CHECK CONSTRAINT, which is migration `0018`'s argument for
+ * `rejected_reason`: a CHECK is a fourth thing to widen every time a kind arrives, and
+ * `0020` deliberately leaves the column unconstrained for that reason.
+ *
+ * ONE MEMBER, AND THE SET IS STILL A SET. `poster` is FR-MED-05's video half and is not
+ * built — a poster frame needs a video decoder, and ffmpeg measured 113,994,336 B against
+ * the image half's 30,380,799 B, for the harder half of a clause whose easier half
+ * (duration) chapter 4.13 already declined. SRS 1.22 and ADR-34 carry the reasoning and
+ * the reversal condition. Being a set rather than a boolean is what makes that a future
+ * insert instead of a future migration. */
+export const RENDITIONS = ["thumbnail"] as const;
+export type Rendition = (typeof RENDITIONS)[number];
+
+/** WHY A PARENT HAS NO RENDITION, WHICH FR-007 REQUIRES TO BE A VALUE AND NOT AN ABSENCE.
+ *
+ * Recorded on the parent, because a rendition that was never made has no row to carry it.
+ * `unsupported_source` is an allowed type this platform cannot decode — derived from what
+ * the decoder reports rather than listed, so the set of types that get a rendition is a
+ * measurement and not a second hand-maintained table. */
+export const RENDITION_FAILED = [
+  "unsupported_source",
+  "decode_failed",
+  "store_write_failed",
+] as const;
+export type RenditionFailure = (typeof RENDITION_FAILED)[number];
+
 /** WHAT THE PLATFORM BUILDS, WHICH IS NOT WHAT A SENDER DECLARES (FR-MED-07).
  *
  * **One schema was serving both, and that is what made this chapter's first plan
  * impossible.** `attachmentSchema` above is embedded by four things: three request doors
  * — `messages.schema.ts:40`, `frames.ts:94` and `internal.ts:35` — and **`messageSchema`
  * at `frames.ts:46`, which is the payload the api BUILDS**. A sender must not be able to
@@ -125,14 +153,39 @@
  * turned out to be six.
  *
  * THE URL ARM IS UNCHANGED AND SHARED. A `url` attachment has no state to carry: nothing
  * uploaded it, nothing scanned it, and FR-MED-03's verification never touches it. Giving
  * it one for symmetry would be a field that is always the same value, which is a field
  * a reader has to learn and can never use. */
+/** FR-MED-05 ON THE WIRE. Absent when there is no rendition, and never `null`.
+ *
+ * **OPTIONAL, AND THAT IS WEAKER THAN `state` IN A WAY WORTH NAMING.** `state` above is
+ * required precisely so the compiler lists every place a message is built; an optional
+ * property is silently correct everywhere, so the door set for this field had to be
+ * derived by asserting on delivered payloads instead of by reading a build error. The
+ * derivation is in `specs/061-chapter-4-15/doors.txt`.
+ *
+ * **ABSENT RATHER THAN `null` WITH A REASON.** Three cases produce no rendition and only
+ * one is a failure: the attachment is not an image, the image was already inside the
+ * bound (`research.md` R2 — the output would be 97.3% of the parent and the same
+ * pixels), or generation failed. A client's question is only *"is there a smaller one"*;
+ * the reason lives on the row, where an operator can read it, rather than in every
+ * delivered message.
+ *
+ * **THE DIMENSIONS ARE THE RENDITION'S OWN**, not the parent's. Sending them is the
+ * whole reason a thumbnail helps before its bytes arrive: without a box to reserve, the
+ * page jumps when the image lands. */
+const thumbnailRef = z.strictObject({
+  media_id: z.uuid(),
+  width: z.number().int().positive(),
+  height: z.number().int().positive(),
+});
+
 const deliveredMediaArm = mediaArm.extend({
   state: z.enum(MEDIA_STATES),
+  thumbnail: thumbnailRef.optional(),
 });
 
 export const deliveredAttachmentSchema = z.discriminatedUnion("type", [
   urlArm,
   deliveredMediaArm,
 ]);
```

```diff title="packages/protocol/src/internal.ts"
@@ -2,12 +2,14 @@
 
 import {
   attachmentSchema,
   forwardedAttachmentSchema,
   MAX_ATTACHMENTS,
   refineTextAndAttachments,
+  RENDITIONS,
+  RENDITION_FAILED,
 } from "./attachments.js";
 
 import { forwardedMessageSchema } from "./frames.js";
 
 // The INTERNAL service contract (chapter 2.5) — distinct from the wire
 // contract above it. `frames.ts` is what a customer's client speaks;
@@ -544,12 +546,25 @@
  * tenant parameter either — a worker that could ask for one tenant's objects
  * would be a route worth forging. The worker never needs the tenant, because
  * everything it does is addressed by object key and reported back by id. */
 export const internalMediaPendingItemSchema = z.strictObject({
   id: z.string().uuid(),
   object_key: z.string().min(1),
+  /** THE TENANT, SO THE WORKER CAN NAME A RENDITION'S KEY IN THE PLATFORM'S OWN LAYOUT
+   * (chapter 4.15). Object keys are `${environment_id}/${id}` — `media.service.ts:108`
+   * — and FR-MED-05's derived objects use the same shape, so the worker has to know the
+   * first half to write the second.
+   *
+   * NOT A TENANCY LEAK, AND WORTH SAYING WHY. This service already holds the object's id
+   * and its key; the environment is the one whose object it was handed, and it reaches
+   * no database with it (ADR-04 — the worker holds no Postgres credential). The
+   * alternative was deriving the rendition's key from the parent's, which `schema.ts`
+   * forbids in its own words: `object_key` is *"OPAQUE, AND NOT A PATH INTO THE STORE …
+   * keeping them separate is what lets the storage layout change without breaking a
+   * published contract."* */
+  environment_id: z.string().uuid(),
   /** What the CLIENT said this is, which is the whole subject of FR-MED-03. The
    * worker's job is to find out whether it is true. */
   mime_type: z.string().min(1),
   declared_bytes: z.number().int().nonnegative(),
   /** The ordering column, returned so the worker can ask for the next page.
    *
@@ -592,12 +607,33 @@
       verified_type: z.string().min(1),
       /** Present for the kinds a 64 KiB prefix answers for, absent for the
        * rest — FR-MED-04 is recorded PARTLY MET rather than pretended. */
       width: z.number().int().positive().optional(),
       height: z.number().int().positive().optional(),
       duration_ms: z.number().int().nonnegative().optional(),
+      /** FR-MED-05. What the worker produced and already wrote to the store, or nothing.
+       *
+       * ABSENT IS NOT A FAILURE. Three cases reach here with no rendition and only one
+       * of them is wrong: the object is not an image, the image is already inside the
+       * bound (`research.md` R2 — the output would be 97.3% of the parent and the same
+       * pixels), or generation failed. The third sets `rendition_failed_reason` and the
+       * first two set neither, which is why this is not a nullable field with a reason
+       * beside it. */
+      rendition: z
+        .strictObject({
+          id: z.string().uuid(),
+          kind: z.enum(RENDITIONS),
+          object_key: z.string().min(1),
+          bytes: z.number().int().positive(),
+          width: z.number().int().positive(),
+          height: z.number().int().positive(),
+        })
+        .optional(),
+      /** FR-007's *"a value, not an absence"*. Recorded on the PARENT, because a
+       * rendition that was never made has no row to carry it. */
+      rendition_failed_reason: z.enum(RENDITION_FAILED).optional(),
     }),
     z.strictObject({
       verdict: z.literal("rejected"),
       reason: mediaRejectionReasonSchema,
       /** Optional on this arm: a scan failure knows nothing about the type,
        * and a mismatch that failed on size alone knows no type either. */
```

```diff title="services/api/src/db/repository.ts"
@@ -542,12 +542,13 @@
    * something the code did not do. */
   after?: Date,
 ): Promise<
   Array<{
     id: string;
     objectKey: string;
+    environmentId: string;
     mimeType: string;
     declaredBytes: number;
     createdAt: Date;
   }>
 > {
   return db
@@ -640,23 +641,110 @@
         eq(channels.environmentId, environmentId),
       ),
     );
   return rows.map((row) => row.id);
 }
 
+/** WHICH OF A TENANT'S MEDIA OBJECTS NOTHING REFERENCES ANY MORE — FR-MED-10's predicate.
+ *
+ * **CALLED BY NOTHING YET, AND THAT IS NOT AN OVERSIGHT.** FR-MED-10's reaper does not
+ * exist; `docs/12` row 22, the erasure chapter, is where it gets a caller. Chapter 4.15
+ * writes the predicate here anyway because the alternative is what happened to
+ * FR-MED-07's first sentence — three chapters cited the clause, every one of them
+ * implemented the half it needed, and nobody noticed the other half was unmet. A
+ * predicate with a test and no caller is weaker than one with both, and much stronger
+ * than a sentence in a specification. Its test drives it directly.
+ *
+ * **A RENDITION IS NEVER RETURNED, WHICH IS THE WHOLE OF FR-002.** The obvious reading —
+ * *"a rendition is unreferenced when its parent is"* — would have the reaper delete
+ * parent and rendition separately and depend on the order. It does not need to: a
+ * rendition cannot outlive its parent, because `media_objects_parent_fk` is
+ * `ON DELETE CASCADE`. So this asks only about uploads, and the renditions follow. The
+ * clause *"its reachability is its parent's"* is discharged by the foreign key rather
+ * than by a second arm of a predicate somebody has to keep in step.
+ *
+ * **TWO QUERIES, NOT ONE, AND 4.12 MEASURED WHY.** The natural single statement puts
+ * `NOT EXISTS (… attachments @> … m.id …)` against each candidate, which builds the
+ * containment operand from a column on the other side of the join — a GIN index cannot
+ * be looked up with a value the planner does not have yet, and that chapter measured the
+ * difference at **1,042 buffers against 84**, with the index present and idle. Here the
+ * candidates come back first and their ids go into the second query as bound values.
+ *
+ * The scope is an argument rather than a constructor, for `channelsReferencingMediaIn`'s
+ * reason: the caller will be a job, not a request. */
+export async function unreferencedMediaIn(
+  db: Db,
+  environmentId: string,
+  olderThan: Date,
+  limit = 100,
+): Promise<string[]> {
+  const candidates = await db
+    .select({ id: mediaObjects.id })
+    .from(mediaObjects)
+    .where(
+      and(
+        eq(mediaObjects.environmentId, environmentId),
+        isNull(mediaObjects.parentId),
+        lt(mediaObjects.createdAt, olderThan),
+      ),
+    )
+    .orderBy(mediaObjects.createdAt)
+    .limit(limit);
+  if (candidates.length === 0) return [];
+
+  // ONE QUERY FOR THE WHOLE BATCH: the messages that reference AT LEAST ONE candidate,
+  // each containment operand a bound value so the GIN index on `messages.attachments`
+  // can be looked up rather than scanned. What comes back is the attachment arrays, and
+  // the intersection is arithmetic in Node — cheaper than asking Postgres to unnest and
+  // far easier to read than a lateral join nobody will revisit.
+  const rows = await db
+    .select({ attachments: sql<Attachment[] | null>`${messages.attachments}` })
+    .from(messages)
+    .innerJoin(channels, eq(channels.id, messages.channelId))
+    .where(
+      and(
+        eq(channels.environmentId, environmentId),
+        or(
+          ...candidates.map(
+            (row) =>
+              sql`${messages.attachments} @> ${JSON.stringify([
+                { type: "media", media_id: row.id },
+              ])}::jsonb`,
+          ),
+        ),
+      ),
+    );
+  const referencedIds = new Set<string>();
+  for (const row of rows)
+    for (const attachment of row.attachments ?? [])
+      if (attachment.type === "media") referencedIds.add(attachment.media_id);
+
+  return candidates.map((row) => row.id).filter((id) => !referencedIds.has(id));
+}
+
 export async function recordMediaVerdict(
   db: Db,
   input: {
     id: string;
     verdict: "ready" | "rejected";
     verifiedBytes?: number;
     verifiedType?: string;
     width?: number;
     height?: number;
     durationMs?: number;
     reason?: "declaration_mismatch" | "scan_failed";
+    /** FR-MED-05. Already written to the store by the worker; this records the row. */
+    rendition?: {
+      id: string;
+      kind: string;
+      objectKey: string;
+      bytes: number;
+      width: number;
+      height: number;
+    };
+    renditionFailedReason?: string;
   },
 ): Promise<{
   applied: boolean;
   state: string | null;
   objectKey: string | null;
   /** THE TENANT, BECAUSE THIS FUNCTION IS THE ONLY PLACE THAT KNOWS IT (chapter 4.14).
@@ -669,48 +757,94 @@
    * second read that can disagree with the compare-and-set, or an unscoped query, which
    * is constitution I in the data-access layer.
    *
    * `null` only when no such object exists, which the caller answers with a 404. */
   environmentId: string | null;
 }> {
-  const [updated] = await db
+  return db.transaction(async (tx) => {
+  const [updated] = await tx
     .update(mediaObjects)
     .set({
       state: input.verdict,
       verifiedBytes: input.verifiedBytes ?? null,
       verifiedType: input.verifiedType ?? null,
       width: input.width ?? null,
       height: input.height ?? null,
       durationMs: input.durationMs ?? null,
       rejectedReason: input.reason ?? null,
+      renditionFailedReason: input.renditionFailedReason ?? null,
     })
     .where(and(eq(mediaObjects.id, input.id), eq(mediaObjects.state, "pending")))
     .returning({
       state: mediaObjects.state,
       // THE KEY COMES BACK FROM THE UPDATE, not from a read before it. A rejection
       // deletes the bytes and the caller needs the key to do that; fetching it
       // separately would open a window in which the row moved between the two
       // statements and the delete addressed somebody else's object.
       objectKey: mediaObjects.objectKey,
       // AND THE TENANT, for the same reason: the fan-out FR-MED-07 needs is scoped by
       // environment, and this statement is the only one that knows which.
       environmentId: mediaObjects.environmentId,
+      // AND THE UPLOADER (4.15), so a rendition inserted below carries the same
+      // `user_id` as its parent. FR-MED-10's second sentence makes compliance erasure
+      // delete *"a user's media objects and derived objects"*, and it will find both on
+      // one predicate only if the rendition was written with the parent's user. Reading
+      // it from the same statement rather than a second SELECT is this list's whole
+      // argument, applied once more.
+      userId: mediaObjects.userId,
     });
 
-  if (updated)
+  if (updated) {
+    // FR-MED-05's ROW, IN THE SAME TRANSACTION AS THE TRANSITION THAT EARNED IT.
+    //
+    // **THERE WAS NO TRANSACTION HERE UNTIL CHAPTER 4.15, AND THE PLAN SAID THERE WAS.**
+    // An analysis pass found it by opening this function rather than by reading the
+    // plan, which had written "insert the rendition row in the same transaction as the
+    // verdict" about a bare `UPDATE`. Without one, an UPDATE that lands and an INSERT
+    // that fails leaves the parent `ready` with no rendition AND no recorded reason —
+    // the absence FR-007 forbids and the silence FR-008 was written against.
+    //
+    // **TWO MECHANISMS, TWO DIFFERENT WINDOWS, AND NEITHER IS REDUNDANT.** `RETURNING`
+    // above is still how the key and the tenant come back, because a separate SELECT
+    // could read a row that moved between the two statements. The transaction is what
+    // makes the verdict and the rendition one fact. A reader who sees both should not
+    // conclude that one of them is belt-and-braces.
+    if (input.rendition) {
+      await tx.insert(mediaObjects).values({
+        id: input.rendition.id,
+        environmentId: updated.environmentId,
+        // THE PARENT'S UPLOADER, so erasure by user finds the rendition on the same
+        // predicate that finds the object it came from (FR-MED-10's second sentence).
+        userId: updated.userId,
+        filename: `${input.rendition.kind}.webp`,
+        mimeType: "image/webp",
+        // NOBODY DECLARED THIS. The column's comment says so; the quota sums it, and
+        // FR-012 wants derived bytes counted on the same basis as uploaded ones.
+        declaredBytes: input.rendition.bytes,
+        state: "ready",
+        objectKey: input.rendition.objectKey,
+        width: input.rendition.width,
+        height: input.rendition.height,
+        verifiedBytes: input.rendition.bytes,
+        verifiedType: "image/webp",
+        parentId: input.id,
+        rendition: input.rendition.kind,
+      });
+    }
     return {
       applied: true,
       state: updated.state,
       objectKey: updated.objectKey,
       environmentId: updated.environmentId,
     };
+  }
 
   // NOT `pending`: either somebody got there first, or the object does not exist. The
   // caller needs to tell those apart, so the current state comes back rather than a
   // bare false.
-  const [row] = await db
+  const [row] = await tx
     .select({
       state: mediaObjects.state,
       objectKey: mediaObjects.objectKey,
       environmentId: mediaObjects.environmentId,
     })
     .from(mediaObjects)
@@ -718,12 +852,13 @@
   return {
     applied: false,
     state: row?.state ?? null,
     objectKey: row?.objectKey ?? null,
     environmentId: row?.environmentId ?? null,
   };
+  });
 }
 
 export async function creditConnectionMinutes(
   db: Db,
   entries: ReadonlyArray<{
     connectionId: string;
@@ -5470,12 +5605,24 @@
             ? undefined
             : or(
                 isNull(mediaObjects.userId),
                 eq(mediaObjects.userId, senderUserId),
               ),
           inArray(mediaObjects.state, ["pending", "ready"]),
+          // 4.15: A RENDITION IS NOT ATTACHABLE (FR-004), AND IT WOULD HAVE BEEN.
+          //
+          // A thumbnail is `ready` and belongs to the environment, so it satisfies every
+          // condition above and a sender who learned its id could attach it. It is not a
+          // thing a client uploaded and it is not a thing a message should name: the
+          // message names the parent, and the rendition rides along on delivery.
+          //
+          // IN THIS PREDICATE RATHER THAN BESIDE IT, so the refusal is the one arm this
+          // function already produces. A separate check with its own error code would
+          // tell a caller that somebody else's rendition exists, which is precisely what
+          // FR-MED-06's three-conditions-one-answer rule forbids.
+          isNull(mediaObjects.parentId),
         ),
       );
 
     const passed = new Set(attachable.map((row) => row.id));
     // IN ORDER, so ten attachments with the third one foreign name the third. `find`
     // walks `wanted`, which was built by walking the array the caller sent.
@@ -5857,13 +6004,19 @@
    * can read. 11,557 public channels against 1,016 private on this lane. */
   async readableMediaObjectKey(
     mediaId: string,
     userId?: string,
   ): Promise<string | undefined> {
     const [object] = await this.db
-      .select({ objectKey: mediaObjects.objectKey })
+      .select({
+        objectKey: mediaObjects.objectKey,
+        // 4.15: null for an upload, the parent for a rendition. Fetched in the statement
+        // that already reads this row rather than by a second lookup, for the reason the
+        // verdict's own `RETURNING` list gives — a second read can disagree with the first.
+        parentId: mediaObjects.parentId,
+      })
       .from(mediaObjects)
       .where(
         and(
           eq(mediaObjects.id, mediaId),
           eq(mediaObjects.environmentId, this.environmentId),
           // ADR-14's DELIVERY GATE: NO SIGNED URL UNTIL `ready` (FR-012).
@@ -5883,13 +6036,32 @@
           // the one that built the route.
           eq(mediaObjects.state, "ready"),
         ),
       );
     if (!object) return undefined;
 
-    for (const channelId of await this.channelsReferencingMedia(mediaId)) {
+    // FR-MED-05: A RENDITION IS AUTHORISED THROUGH ITS PARENT, BY THE SAME PREDICATE.
+    //
+    // A thumbnail is named by no message — the message names the parent — so
+    // `channelsReferencingMedia` returns nothing for it and the loop below refuses it.
+    // **That is FR-MED-08 working exactly as written**, not a bug: an object with no
+    // referencing message is readable by nobody, including whoever uploaded it. What
+    // FR-MED-05's "sharing the parent's lifecycle" adds is that a rendition's
+    // reachability IS the parent's, so the question is asked about the parent instead.
+    //
+    // **ONE SUBSTITUTION, NOT A SECOND PREDICATE.** FR-005 requires the authorisation to
+    // be the same predicate rather than a copy of it, so this changes which id the
+    // existing loop asks about and changes nothing else. A copy would be the third
+    // tenancy scope 4.12 found whose individual removal turned nothing red.
+    //
+    // The state condition above already applied to the row that was fetched: a rendition
+    // is `ready` by `media_objects_rendition_state_check`, and a rendition of a parent
+    // that never reached `ready` cannot exist, because generation runs after the verdict
+    // that would refuse it.
+    const authorisingId = object.parentId ?? mediaId;
+    for (const channelId of await this.channelsReferencingMedia(authorisingId)) {
       if (await this.channelVisibleTo(channelId, userId)) return object.objectKey;
     }
     return undefined;
   }
 
   /** Every channel of this environment holding a message that references this object.
@@ -5937,12 +6109,17 @@
         rows.flatMap((row) =>
           row.attachments.filter((a) => a.type === "media").map((a) => a.media_id),
         ),
       ),
     ];
     const states = new Map<string, MediaState>();
+    /** FR-MED-05: the parent's rendition, if it has one. */
+    const thumbnails = new Map<
+      string,
+      { media_id: string; width: number; height: number }
+    >();
     if (ids.length > 0) {
       const found = await this.db
         .select({ id: mediaObjects.id, state: mediaObjects.state })
         .from(mediaObjects)
         .where(
           and(
@@ -5951,18 +6128,69 @@
             // return the right rows — and constitution I is about the layer, not about
             // whether a given query could get away without it.
             eq(mediaObjects.environmentId, this.environmentId),
           ),
         );
       for (const row of found) states.set(row.id, row.state as MediaState);
+
+      // THE RENDITIONS OF THIS PAGE'S OBJECTS — a THIRD query per page, not a second
+      // per row, and not a join.
+      //
+      // **WHY NOT A JOIN ON THE QUERY ABOVE.** A left join to the same table on
+      // `parent_id` would return one row per (object, rendition) pair and make the
+      // `states` map above a group-by in Node. One more `= any(...)` over the partial
+      // index `media_objects_parent_idx` is cheaper to read and, measured on this
+      // lane, indistinguishable to run. 4.12's rule is about the OPERAND being a bound
+      // value, which both shapes satisfy; the cost it warned about was a correlated
+      // subquery per row, which neither is.
+      //
+      // SAME TENANT PREDICATE, FOR THE SAME REASON. `parent_id` is already constrained
+      // to this environment by `media_objects_parent_fk`, so this clause cannot change
+      // the result — and 4.12 found three tenancy scopes whose individual removal
+      // turned nothing red, which is exactly what a clause that cannot change a result
+      // looks like from a test suite.
+      const derived = await this.db
+        .select({
+          id: mediaObjects.id,
+          parentId: mediaObjects.parentId,
+          width: mediaObjects.width,
+          height: mediaObjects.height,
+        })
+        .from(mediaObjects)
+        .where(
+          and(
+            inArray(mediaObjects.parentId, ids),
+            eq(mediaObjects.rendition, "thumbnail"),
+            eq(mediaObjects.environmentId, this.environmentId),
+          ),
+        );
+      for (const row of derived) {
+        // A rendition without dimensions cannot be offered: the whole point of sending
+        // it is a box the client can reserve, and `{media_id}` alone would make a
+        // caller fetch the bytes to find out how big they are.
+        if (row.parentId && row.width !== null && row.height !== null) {
+          thumbnails.set(row.parentId, {
+            media_id: row.id,
+            width: row.width,
+            height: row.height,
+          });
+        }
+      }
     }
     return rows.map((row) => ({
       ...row,
-      attachments: row.attachments.map((a) =>
-        a.type === "media" ? { ...a, state: states.get(a.media_id) ?? "pending" } : a,
-      ),
+      attachments: row.attachments.map((a) => {
+        if (a.type !== "media") return a;
+        const thumbnail = thumbnails.get(a.media_id);
+        return {
+          ...a,
+          state: states.get(a.media_id) ?? "pending",
+          // ABSENT, NEVER NULL. A spread of `undefined` would still create the key.
+          ...(thumbnail ? { thumbnail } : {}),
+        };
+      }),
     }));
   }
 
   /** One row, same query, same rule. Named separately so a caller reads as what it is
    * rather than as an array of one. */
   private async withMediaState<T extends { attachments: Attachment[] }>(
```

```diff title="services/api/src/db/schema.ts"
@@ -2,12 +2,13 @@
 import {
   bigserial,
   bigint,
   boolean,
   check,
   date,
+  foreignKey,
   index,
   integer,
   jsonb,
   pgTable,
   primaryKey,
   text,
@@ -1137,14 +1138,19 @@
     // NULLABLE, BECAUSE AN API KEY HAS NO USER. FR-MED-06's chapter distinguishes
     // the two cases — a user token's media belongs to that user — and it cannot
     // make that distinction if the absence is written as something else.
     userId: uuid("user_id").references(() => users.id),
     filename: text("filename").notNull(),
     mimeType: text("mime_type").notNull(),
-    // WHAT THE CALLER SAID, NOT WHAT ARRIVED. FR-MED-03 verifies the object and is
-    // a later chapter, so every quota sum in this one is over declarations.
+    // WHAT THE CALLER SAID, NOT WHAT ARRIVED — for an UPLOAD. FR-MED-03 verifies the
+    // object and is a later chapter, so every quota sum in that one is over declarations.
+    //
+    // AND FOR A RENDITION NOBODY SAID ANYTHING, so it holds the actual length (4.15).
+    // The quota sums this column over every non-`rejected` row, and FR-012 wants derived
+    // bytes accounted on the same basis as uploaded ones; a second column summed alongside
+    // would make all three readers of the total learn about it.
     declaredBytes: bigint("declared_bytes", { mode: "number" }).notNull(),
     state: text("state").notNull().default("pending"),
     objectKey: text("object_key").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
@@ -1172,12 +1178,29 @@
     verifiedBytes: bigint("verified_bytes", { mode: "number" }),
     verifiedType: text("verified_type"),
     // A CLOSED SET OF TWO AND NOT A CHECK CONSTRAINT: `declaration_mismatch` and
     // `scan_failed`. A CHECK would be a fourth thing to widen every time a reason
     // arrives; the set lives in the protocol package where a reader can see it.
     rejectedReason: text("rejected_reason"),
+    // CHAPTER 4.15 — FR-MED-05's "sharing the parent's lifecycle", which is the only
+    // part of that clause that needed a migration (0020). A rendition is referenced by
+    // no message, so FR-MED-08's gate refuses it and FR-MED-10's reap would collect it;
+    // both are correct, and both are why the relationship has to be expressible at all.
+    //
+    // NULL FOR EVERYTHING A CLIENT UPLOADED, and non-null exactly when this row exists
+    // because another one does. The pair is a CHECK, so the discriminator cannot
+    // disagree with itself.
+    parentId: uuid("parent_id"),
+    // THE CLOSED SET LIVES IN `@relay/protocol`, NOT IN A CHECK — 0018's argument for
+    // `rejected_reason`, and the same reason: a CHECK is a fourth thing to widen. One
+    // member today, `thumbnail`. `poster` is the video half and is not built (ADR-34).
+    rendition: text("rendition"),
+    // ON THE PARENT, NOT ON THE RENDITION. FR-007 wants an allowed type that produced no
+    // rendition recorded as a value rather than as an absence, and the row left to ask is
+    // the parent's. Null when nothing was attempted and null when it worked.
+    renditionFailedReason: text("rendition_failed_reason"),
   },
   (t) => [
     // THREE VALUES SINCE CHAPTER 4.13, AND `pending` ALONE BEFORE IT. 4.10 wrote the
     // one-value version deliberately — "a CHECK that accepted them now would be a schema
     // claiming a state nothing can reach" — and the verification chapter is what makes
     // the claim keepable. The constraint's job is unchanged: a fourth value still fails,
@@ -1198,8 +1221,47 @@
     // top-N heapsort against 4 buffers and an index scan, measured for a 50-row batch.
     // Partial, so it shrinks to the size of the backlog as objects resolve rather than
     // staying the size of the table.
     index("media_objects_pending_age")
       .on(t.createdAt)
       .where(sql`${t.state} = 'pending'`),
+    // CHAPTER 4.15 (migration 0020). A row is an upload or a rendition and there is no
+    // third thing for a reader to guess at.
+    check(
+      "media_objects_rendition_pairing_check",
+      sql`(${t.parentId} IS NULL) = (${t.rendition} IS NULL)`,
+    ),
+    // A RENDITION HAS NO LIFECYCLE OF ITS OWN AND THIS IS WHAT KEEPS IT THAT WAY.
+    // `state` is NOT NULL DEFAULT 'pending', so a rendition row carries something; it
+    // carries `ready`. Without this the column quietly becomes a second state machine
+    // that only ever holds one value — what 0018 argued `scanning` out of being.
+    check(
+      "media_objects_rendition_state_check",
+      sql`${t.rendition} IS NULL OR ${t.state} = 'ready'`,
+    ),
+    // CONSTITUTION I, GIVEN TO THE DATABASE RATHER THAN TO A PREDICATE SOMEBODY KEEPS.
+    // A single-column `REFERENCES media_objects(id)` would let a rendition name a row in
+    // another environment, because the environment is a second column and a one-column
+    // foreign key never looks at it. This unique exists only so the composite key below
+    // has something to point at — it adds no uniqueness the primary key lacks, and that
+    // is its whole cost: 344 kB against a 1,504 kB heap, measured at 6,646 rows.
+    unique("media_objects_id_environment_key").on(t.id, t.environmentId),
+    foreignKey({
+      columns: [t.parentId, t.environmentId],
+      foreignColumns: [t.id, t.environmentId],
+      name: "media_objects_parent_fk",
+    }).onDelete("cascade"),
+    // ONE RENDITION OF EACH KIND PER PARENT (FR-010), AND PARTIAL BECAUSE IT WAS MEASURED.
+    // As a plain table constraint a btree indexes NULLs too, so it covered all 6,646 rows
+    // at 168 kB to police the zero rows that had a parent. Restricted to those rows it is
+    // 8,192 bytes and refuses the same duplicates — re-run to check that making it partial
+    // had not made it decorative.
+    uniqueIndex("media_objects_parent_rendition_key")
+      .on(t.parentId, t.rendition)
+      .where(sql`${t.parentId} IS NOT NULL`),
+    // The delivery join's read, and the unreferenced predicate's. Partial on 0019's
+    // precedent: it stays the size of the rendition population, not of the table.
+    index("media_objects_parent_idx")
+      .on(t.parentId)
+      .where(sql`${t.parentId} IS NOT NULL`),
   ],
 );
```

```diff title="services/api/src/media/store.ts"
@@ -170,6 +170,40 @@
     });
     return res.ok;
   } catch {
     return false;
   }
 }
+
+/** DELETE A MEDIA OBJECT'S BYTES AND ITS RENDITIONS' BYTES TOGETHER — FR-003's store half.
+ *
+ * **CALLED BY NOTHING YET, AND THE REASON IS WORTH READING BEFORE WRITING A CALLER.**
+ * Nothing in this platform deletes a `media_objects` ROW. The one live deletion is the
+ * rejection path above, which removes bytes and keeps the row on purpose — migration
+ * `0018` says *"a rejected object's row is all that survives it"*, because a refusal has
+ * to stay auditable after the object is gone. `media_objects_parent_fk` is
+ * `ON DELETE CASCADE`, so the database half of FR-003 is already correct for every
+ * present and future path; **the store has no cascade and this is the whole of what
+ * stands in for one.** The caller arrives with FR-MED-10's reaper — `docs/12` row 22,
+ * the erasure chapter.
+ *
+ * The convention this comment follows is `CLAUDE.md`'s: a claim about when a symbol runs
+ * names the thing that runs it, so that the claim rots visibly. *"On boot, every boot"*
+ * was false for `ensureBucket` for two chapters because nothing named its caller.
+ *
+ * **A REJECTED PARENT NEVER HAS RENDITIONS**, so the rejection path needs no change:
+ * generation runs after the scan and the declaration check, which is the ordering that
+ * makes FR-009 free rather than a cleanup.
+ *
+ * Every delete is attempted even if an earlier one fails, and the result says whether
+ * ALL of them succeeded. A partial failure leaves bytes nobody can reach through this
+ * platform — the same condition the rejection path already tolerates and logs. */
+export async function deleteObjectWithRenditions(
+  config: StoreConfig,
+  parentKey: string,
+  renditionKeys: readonly string[],
+): Promise<boolean> {
+  const results = await Promise.all(
+    [parentKey, ...renditionKeys].map((key) => deleteObject(config, key)),
+  );
+  return results.every(Boolean);
+}
```

<!-- CHAPTER 4.16 — storage on the bill (feature 062). -->
<!-- Ten files, twenty-two hunks, all at -U6 and every pre-image verified to match the
     dumped chain state exactly once before it was pasted. Three of the ten are files this
     appendix already amends, so their hunks go AFTER the existing ones; the other seven are
     here for 4.15's reason — one rule for ten files beats a judgement per file, and a
     2,795-word chapter cannot carry 765 diff lines. -->

```diff title="packages/protocol/src/internal.ts"
@@ -320,12 +320,63 @@
     API_REQUEST_ACTION.domain,
     API_REQUEST_ACTION.action,
     environmentId,
   );
 }
 
+/** Storage metering's action (FR-MED-12, DR-17, chapter 4.16). */
+export const MEDIA_STORED_ACTION = { domain: "media", action: "stored" };
+
+export function mediaStoredSubject(environmentId: string): string {
+  return analyticsSubjectFor(
+    MEDIA_STORED_ACTION.domain,
+    MEDIA_STORED_ACTION.action,
+    environmentId,
+  );
+}
+
+/** THE DISCRIMINATOR, SHARED — which the three record types before this one are not.
+ *
+ * `"api.request"` is written as a literal in `services/api/src/request-log/event.ts`
+ * twice and again as `API_REQUEST_TYPE` in `services/ingester/src/shape.ts`: three
+ * copies of one string across two services that cannot import each other's code. Nothing
+ * has drifted yet, and the only thing standing between them is that nobody has retyped
+ * it. **This one is shared from the start** — both services already depend on
+ * `@relay/protocol`, so the cost is nothing and the failure it prevents is a producer
+ * publishing a type the consumer will not claim, which `ingest.ts` answers by
+ * redelivering the record for seven days while the `unclaimed` counter is the only
+ * signal (049). Not a refactor of the existing three; a choice not to add a fourth. */
+export const MEDIA_STORED_TYPE = "media.stored";
+
+/** What the api publishes when a tenant's stored bytes change (FR-001).
+ *
+ * **THE SIGN IS CARRIED, NEVER INFERRED FROM `event`.** `reserved` and `rendition` are
+ * positive and `rejected` and `deleted` negative, and a reader that derives that from
+ * the name puts the rule in a second place. `daily_usage_billing.stored_delta` is the
+ * counter-example living one table over: its sign comes from
+ * `multiIf(event = 'created', 1, …)` and its name has since read to a planner as though
+ * it counted bytes.
+ *
+ * **`bytes_delta` IS THE QUOTA'S QUANTITY** (FR-002). `reserveMediaSlot` sums
+ * `declared_bytes` where `state <> 'rejected'`, so a `pending` object is already charged
+ * and the meter agrees by construction rather than by reconciliation.
+ *
+ * **`kind` IS PRESENT ON EVERY RECORD INCLUDING `deleted`**, so the view that builds
+ * FR-009's per-kind counts can reverse them with the same expression. */
+export const mediaStoredRecordSchema = z.strictObject({
+  type: z.literal(MEDIA_STORED_TYPE),
+  environment_id: z.uuid(),
+  media_id: z.uuid(),
+  event: z.enum(["reserved", "rejected", "rendition", "deleted"]),
+  kind: z.enum(["image", "audio", "video"]),
+  bytes_delta: z.number().int(),
+  occurred_at: z.string().min(1),
+});
+
+export type MediaStoredRecord = z.infer<typeof mediaStoredRecordSchema>;
+
 /** The token for a request that resolved to no tenant.
  *
  * A SEPARATE FUNCTION, NOT A RELAXED ARGUMENT TO `analyticsSubjectFor`. That validator
  * refuses a non-UUID because an environment id becomes a dot-delimited subject token, and
  * the refusal is what keeps one tenant's records out of another tenant's filter. A validator
  * with an escape hatch is a validator with a hole, and the hole is measurable: publishing a
```

```diff title="services/ingester/src/shape.ts"
@@ -9,12 +9,14 @@
 //
 // So the ingester SHAPES AND RENAMES rather than forwarding what it was given. Two server
 // settings and one table constraint stand behind this function, each catching a different
 // way of getting it wrong -- but the function is the thing that has to be right.
 
 /** The publisher's record, as it arrives on `analytics.webhook.attempt.{env}`. */
+import { MEDIA_STORED_TYPE } from "@relay/protocol";
+
 export interface AttemptEvent {
   delivery_id: string;
   endpoint_id: string;
   environment_id: string;
   event_id: string;
   attempt: number;
@@ -184,12 +186,17 @@
 // ---------------------------------------------------------------------------
 
 /** The wire's own discriminator. R11: the PAYLOAD says what the payload is, not the subject —
  *  a router that parses subjects has to be right about tokens too, and a malformed token
  *  publishes a subject one level deeper that no intended filter matches. */
 export const API_REQUEST_TYPE = "api.request";
+/** 4.16's discriminator is IMPORTED, not retyped. `"api.request"` above is the third copy
+ * of one string across two services that cannot import each other's code; both already
+ * depend on `@relay/protocol`, so a fourth copy would have been a choice. Re-exported as
+ * well as imported, so a reader of this file finds all four types in one place. */
+export { MEDIA_STORED_TYPE };
 export const CONNECTION_OPENED_TYPE = "connection.opened";
 export const CONNECTION_CLOSED_TYPE = "connection.closed";
 
 /** The gateway's record, as it arrives on `analytics.connection.{opened|closed}.{env}`. */
 export interface ConnectionEvent {
   type: string;
@@ -264,16 +271,79 @@
     close_code: isNumber(e.close_code) ? e.close_code : null,
     duration_ms: isNumber(e.duration_ms) ? e.duration_ms : null,
     user_external_id: e.user_external_id,
   };
 }
 
+/** The api's storage record, as it arrives on `analytics.media.stored.{env}` (4.16). */
+export interface MediaStoredEvent {
+  type: string;
+  environment_id: string;
+  media_id: string;
+  event: string;
+  kind: string;
+  bytes_delta: number;
+  occurred_at: string;
+}
+
+/** One row of `relay_analytics.media_events`, keyed by column name. */
+export interface MediaStoredRow {
+  environment_id: string;
+  media_id: string;
+  event: string;
+  kind: string;
+  bytes_delta: number;
+  ts: string;
+}
+
+/** THE SIGN IS CARRIED AND THIS READER DOES NOT SECOND-GUESS IT. `bytes_delta` arrives
+ * signed; deriving it here from `event` would put the rule in a second place, and
+ * `stored_delta` one table over is what that looks like after two chapters — a column
+ * whose sign comes from `multiIf(event = 'created', 1, …)` and whose name reads as bytes.
+ *
+ * A CLOSED SET FOR BOTH LABELS, not a substring of anything. `shapeConnection` records
+ * why: `e.type.split(".")[1]` would turn any `media.*` record into a row carrying whatever
+ * word followed the dot.
+ *
+ * AND `occurred_at` BECOMES `ts`, matching every other table's column. The wire says when
+ * it happened; the column says the same thing in the name the schema uses. */
+export function shapeMediaStored(raw: unknown): MediaStoredRow | null {
+  if (typeof raw !== "object" || raw === null) return null;
+  const e = raw as Partial<MediaStoredEvent>;
+
+  if (
+    !isString(e.environment_id) ||
+    !isString(e.media_id) ||
+    !isString(e.occurred_at) ||
+    !isString(e.event) ||
+    !isString(e.kind) ||
+    !isNumber(e.bytes_delta)
+  ) {
+    return null;
+  }
+  if (!MEDIA_EVENTS.includes(e.event)) return null;
+  if (!MEDIA_KINDS.includes(e.kind)) return null;
+
+  return {
+    environment_id: e.environment_id,
+    media_id: e.media_id,
+    event: e.event,
+    kind: e.kind,
+    bytes_delta: e.bytes_delta,
+    ts: e.occurred_at,
+  };
+}
+
+const MEDIA_EVENTS: readonly string[] = ["reserved", "rejected", "rendition", "deleted"];
+const MEDIA_KINDS: readonly string[] = ["image", "audio", "video"];
+
 export type Shaped =
   | { kind: "attempt"; row: AttemptRow }
   | { kind: "request"; row: RequestRow }
   | { kind: "connection"; row: ConnectionRow }
+  | { kind: "media"; row: MediaStoredRow }
   | { kind: "malformed" }
   | { kind: "unclaimed"; type: string };
 
 /** Decide what a record is.
  *
  * AN ABSENT `type` MEANS ATTEMPT, AND THAT IS A COMPATIBILITY RULE RATHER THAN A DEFAULT.
@@ -302,11 +372,18 @@
   // consumer wants both.
   if (type === CONNECTION_OPENED_TYPE || type === CONNECTION_CLOSED_TYPE) {
     const row = shapeConnection(raw);
     return row === null ? { kind: "malformed" } : { kind: "connection", row };
   }
 
+  // The fourth arm (chapter 4.16). ONE TYPE, ONE TABLE — unlike the connection arm, which
+  // folds two because they are one table.
+  if (type === MEDIA_STORED_TYPE) {
+    const row = shapeMediaStored(raw);
+    return row === null ? { kind: "malformed" } : { kind: "media", row };
+  }
+
   // Anything else is somebody's record and not this consumer's. Leaving it costs the stream's
   // retention window; terminating it costs the record. Those are not comparable, and a
   // consumer that does not recognise a type is the party with the least information.
   return { kind: "unclaimed", type: typeof type === "string" ? type : String(type) };
 }
```

```diff title="services/ingester/src/clickhouse.ts"
@@ -1,14 +1,20 @@
 // The write side. Node's own `fetch` against the HTTP interface -- no client package, which
 // is what keeps `grep -c clickhouse pnpm-lock.yaml` at 0 by design rather than by luck.
-import type { AttemptRow, ConnectionRow, RequestRow } from "./shape.js";
+import type {
+  AttemptRow,
+  ConnectionRow,
+  MediaStoredRow,
+  RequestRow,
+} from "./shape.js";
 
 const DB = "relay_analytics";
 const ATTEMPTS = "webhook_attempts";
 const REQUESTS = "api_requests";
 const CONNECTIONS = "connection_events";
+const MEDIA_EVENTS = "media_events";
 
 // TWO SETTINGS, TWO DIFFERENT FAILURES, AND NEITHER IS OPTIONAL.
 //
 // `input_format_skip_unknown_fields=0` turns a RENAMED field into `Code: 117` instead of a
 // silent default. Its server default is 1, which is exactly why the failure it prevents was
 // invisible: the insert succeeds and the column takes the epoch.
@@ -26,12 +32,15 @@
    *  row shapes are different types and the compiler should say so at the call site. */
   insertRequests(rows: RequestRow[]): Promise<void>;
   /** The third table (chapter 4.5). A third call for the reason there is a second: three row
    *  shapes are three types, and a `table` parameter would let the compiler watch a
    *  `ConnectionRow` go into `api_requests` without a word. */
   insertConnections(rows: ConnectionRow[]): Promise<void>;
+  /** The fourth table (chapter 4.16). A fourth call for the reason there is a third —
+   *  and the name says what it inserts, which `insert` above does not. */
+  insertMediaEvents(rows: MediaStoredRow[]): Promise<void>;
   count(): Promise<number>;
   countRequests(): Promise<number>;
   countConnections(): Promise<number>;
   /** A READ, AND THE FIRST ONE THIS INTERFACE HAS HAD (chapter 4.6).
    *
    * Everything above writes or counts. Chapter 4.6 needs to ASK the store a question --
@@ -102,12 +111,22 @@
       if (rows.length === 0) return;
       await post(
         `INSERT INTO ${DB}.${CONNECTIONS} FORMAT JSONEachRow`,
         rows.map((r) => JSON.stringify(r)).join("\n"),
       );
     },
+    // THE EMPTY GUARD IS LOAD-BEARING HERE MORE THAN ANYWHERE. Storage records arrive on
+    // slot requests and verdicts, which the lane produces in ones and twos against
+    // 118,238 api requests — so nearly every batch carries none of these at all.
+    async insertMediaEvents(rows: MediaStoredRow[]): Promise<void> {
+      if (rows.length === 0) return;
+      await post(
+        `INSERT INTO ${DB}.${MEDIA_EVENTS} FORMAT JSONEachRow`,
+        rows.map((r) => JSON.stringify(r)).join("\n"),
+      );
+    },
     // Reads take FINAL. The duplicate is physically present until a merge collapses it, so a
     // bare count over-counts every redelivery -- by a plausible number.
     async count(): Promise<number> {
       return Number(await post(`SELECT count() FROM ${DB}.${ATTEMPTS} FINAL`, ""));
     },
     async countRequests(): Promise<number> {
```

```diff title="services/ingester/src/main.ts"
@@ -47,19 +47,21 @@
   const logger = createLogger("ingester");
   const url = process.env["RELAY_NATS_URL"] ?? DEFAULT_NATS_URL;
   const once = process.argv.includes("--once");
 
   const nc = await connect({ servers: url });
   const jsm = await nc.jetstreamManager();
-  await jsm.consumers.add(ANALYTICS_STREAM, {
-    durable_name: DURABLE,
-    ack_policy: AckPolicy.Explicit,
-    ack_wait: ACK_WAIT_NS,
-    max_deliver: MAX_DELIVER,
-    filter_subject: ALL_ANALYTICS_SUBJECT,
-  }).catch(() => undefined); // already there; leave it alone
+  await jsm.consumers
+    .add(ANALYTICS_STREAM, {
+      durable_name: DURABLE,
+      ack_policy: AckPolicy.Explicit,
+      ack_wait: ACK_WAIT_NS,
+      max_deliver: MAX_DELIVER,
+      filter_subject: ALL_ANALYTICS_SUBJECT,
+    })
+    .catch(() => undefined); // already there; leave it alone
 
   const store = createClickHouse();
   let running = true;
   const stop = (): void => {
     running = false;
   };
@@ -84,12 +86,20 @@
       if (r.written > 0 || r.malformed > 0 || r.unclaimed > 0) {
         logger.log("info", "ingester.batch", {
           written: r.written,
           attempts: r.writtenAttempts,
           requests: r.writtenRequests,
           connections: r.writtenConnections,
+          // THE FIFTH RECORD TYPE, AND IT WAS MISSING FROM THIS LINE FOR A WHOLE
+          // CHAPTER. `IngestResult` has carried `writtenMediaEvents` since 4.16's
+          // phase 2 and nothing printed it, so a media delta showed up only inside
+          // `written` — a total that moved by one with no field saying which arm moved
+          // it. Found while watching this log through a ClickHouse outage (T050), which
+          // is the exact situation where an operator has nothing else to read. 4.13:
+          // *"the boot line is the only thing that said so."*
+          media: r.writtenMediaEvents,
           malformed: r.malformed,
           unclaimed: r.unclaimed,
         });
       }
     } catch (error) {
       // The store is unreachable, or the insert was refused. Nothing was acknowledged, so
```

```diff title="services/ingester/src/metering.ts"
@@ -97,6 +97,100 @@
   //
   // `flat()[0]` rather than `rows[0]?.[0]`: the optional chain is a branch too, and the
   // same one. A tenant with no rows would give NaN here if the server could produce one,
   // and it cannot.
   return Number(rows.flat()[0]);
 }
+
+/** FR-MED-12's level: the bytes a tenant is storing as of a day (chapter 4.16).
+ *
+ * **DR-17's TECHNIQUE, AND `storedMessages` ABOVE IS THE SHAPE.** *"A daily rollup
+ * summing `media_events` deltas (uploaded/deleted)"* — the same accumulation one table
+ * over, with two of that function's details copied deliberately: no empty-result guard,
+ * because a bare aggregate with no `GROUP BY` always returns exactly one row, and
+ * `flat()[0]` rather than `rows[0]?.[0]`, because the optional chain is a branch too.
+ *
+ * **AND THE ANSWER IS SHORT BY WHATEVER THE TTL REMOVED.** This sums from the beginning
+ * of time, and `daily_usage_billing` carries `TTL toDateTime(day) + toIntervalMonth(25)`
+ * — so a level older than the retention horizon is understated by exactly the deltas
+ * that were deleted, permanently, with nothing in the system able to notice.
+ *
+ * `storedMessages` has the same defect and has never shown it, because `message_events`
+ * holds 0 rows and has no producer. **This is the first reader of this shape that will
+ * carry live data**, which is why SRS 1.23 bounds FR-MED-12 at the horizon and names
+ * DR-17's inventory as what re-bases a truncated sum: the object store holds the level
+ * directly, so the reconciliation can restate it. */
+export async function storedBytes(
+  store: ClickHouse,
+  environmentId: string,
+  asOf: string,
+): Promise<number> {
+  const rows = await store.query(
+    `SELECT sum(stored_bytes_delta) FROM ${DB}.daily_usage_billing
+      WHERE environment_id = toUUID('${environmentId}') AND day <= '${asOf}'
+      FORMAT TSV`,
+  );
+  return Number(rows.flat()[0]);
+}
+
+/** FR-009's counts: how many objects a tenant uploaded on a day, by kind (chapter 4.16).
+ *
+ * **THIS EXISTS BECAUSE 4.6's FINDING WOULD OTHERWISE HAVE HAPPENED AGAIN, ONE MOVEMENT
+ * LATER.** That chapter is called *"the rollup nobody read"*: it found a rollup that had
+ * existed for two chapters, satisfied its clause, and was read by nothing — `grep` gave a
+ * comment and a file referenced by no script, service or config. `uploads_by_kind` was in
+ * exactly that state when this function was written: one writer (`0018`), no reader
+ * outside a test. A clause that says the platform MUST count something is not discharged
+ * by a column that holds the count.
+ *
+ * A DAY RATHER THAN A BALANCE, WHICH IS THE OPPOSITE OF `storedBytes` ABOVE AND ON
+ * PURPOSE. Uploads are a FLOW — *"per tenant per day"* — so the window is closed at both
+ * ends, where a stored level is a stock and has no lower bound. The two live in the same
+ * `SELECT` in `0018` and the mistake of reading one the other's way is the specific thing
+ * FR-010 exists to prevent.
+ *
+ * `sumMap` AND NOT A BARE `SELECT`, for `dailyUsage`'s reason at one more remove. The
+ * column is `SimpleAggregateFunction(sumMap, …)` on a `SummingMergeTree`, so an unmerged
+ * table answers one map per insert; measured in phase 2, a plain `Map` in this position
+ * does not merge at all and keeps the first row's value.
+ *
+ * A KIND WITH NO UPLOADS IS ABSENT FROM THE MAP, NOT PRESENT AS ZERO — `dailyUsage`'s
+ * *"a day with no activity is a missing row, never a row of zeros"*, one level down. The
+ * caller fills the vocabulary if it needs a dense record, and this does not pretend to. */
+export async function uploadsByKind(
+  store: ClickHouse,
+  environmentId: string,
+  from: string,
+  to: string,
+): Promise<Record<string, number>> {
+  const rows = await store.query(
+    `SELECT sumMap(uploads_by_kind) FROM ${DB}.daily_usage_billing
+      WHERE environment_id = toUUID('${environmentId}') AND day BETWEEN '${from}' AND '${to}'
+      FORMAT TSV`,
+  );
+  return parseKindMap(rows.flat()[0]);
+}
+
+/** ClickHouse's TSV form for a `Map`, measured: `{'audio':14,'image':155,'video':2}` —
+ *  one line, single-quoted keys, unquoted values. **Not JSON**, and the difference is not
+ *  cosmetic: the first version of this read asked for `FORMAT JSONCompact`, whose keys are
+ *  double-quoted and whose body is a multi-line envelope this client's tab-splitter would
+ *  shred. The regex below would have matched nothing in it and returned **`{}`** — a
+ *  silently empty answer from a tenant with uploads, which is the shape of wrong this
+ *  project files against itself. The format was then asked of the server rather than
+ *  assumed.
+ *
+ *  PARSED RATHER THAN RE-SHAPED IN SQL, because the alternative — `arrayJoin` into rows —
+ *  turns one read into a shape every caller has to reassemble. */
+function parseKindMap(value: string | undefined): Record<string, number> {
+  const out: Record<string, number> = {};
+  // `String(value)` AND NOT `value ?? ""`, WHICH WAS AN UNREACHABLE BRANCH AND MEASURED
+  // AS HALF THIS FILE'S. A bare aggregate with no `GROUP BY` always returns exactly one
+  // row (4.6, asked of the server), so the absent arm cannot arise through the running
+  // query — the same fact `storedMessages` above cites for carrying no empty-result
+  // guard, and the same repair 4.6 made when it reached 100% by deleting branches rather
+  // than by writing a test that could not fail. On the impossible value the regex matches
+  // nothing and the answer is `{}`, which is exactly what the guard produced.
+  for (const m of String(value).matchAll(/'([^']+)':(\d+)/g))
+    out[m[1]!] = Number(m[2]);
+  return out;
+}
```

```diff title="services/api/src/db/repository.ts"
@@ -743,12 +743,16 @@
     };
     renditionFailedReason?: string;
   },
 ): Promise<{
   applied: boolean;
   state: string | null;
+  /** 4.16: the quota's quantity, so a `rejected` delta can negate it. `null` only when
+   * no such object exists, like the fields beside it. */
+  declaredBytes: number | null;
+  mimeType: string | null;
   objectKey: string | null;
   /** THE TENANT, BECAUSE THIS FUNCTION IS THE ONLY PLACE THAT KNOWS IT (chapter 4.14).
    *
    * This is a module-level function on a raw `Db`, deliberately outside the
    * tenant-scoped repository, because its caller is a worker rather than a tenant — and
    * the worker's principal carries `environmentId: undefined` by design (4.4). FR-MED-07
@@ -781,12 +785,22 @@
       // separately would open a window in which the row moved between the two
       // statements and the delete addressed somebody else's object.
       objectKey: mediaObjects.objectKey,
       // AND THE TENANT, for the same reason: the fan-out FR-MED-07 needs is scoped by
       // environment, and this statement is the only one that knows which.
       environmentId: mediaObjects.environmentId,
+      // AND THE BYTES AND THE MIME TYPE (4.16), which the verdict seam needs and did not
+      // have. A `rejected` delta has to negate the quota's own quantity —
+      // `declared_bytes`, which `reserveMediaSlot` sums — and FR-009's per-kind count
+      // needs the type. The input carries a field called `kind` and it is the
+      // RENDITION's (`"thumbnail"`), which is the near-miss a reader would use by
+      // accident. **Third chapter running that this list was short**: 4.14 added
+      // `environmentId`, 4.15 added `userId`, and each time the repair was the same —
+      // the statement that already reads the row is the one that should say.
+      declaredBytes: mediaObjects.declaredBytes,
+      mimeType: mediaObjects.mimeType,
       // AND THE UPLOADER (4.15), so a rendition inserted below carries the same
       // `user_id` as its parent. FR-MED-10's second sentence makes compliance erasure
       // delete *"a user's media objects and derived objects"*, and it will find both on
       // one predicate only if the rendition was written with the parent's user. Reading
       // it from the same statement rather than a second SELECT is this list's whole
       // argument, applied once more.
@@ -830,31 +844,37 @@
         rendition: input.rendition.kind,
       });
     }
     return {
       applied: true,
       state: updated.state,
+      declaredBytes: updated.declaredBytes,
+      mimeType: updated.mimeType,
       objectKey: updated.objectKey,
       environmentId: updated.environmentId,
     };
   }
 
   // NOT `pending`: either somebody got there first, or the object does not exist. The
   // caller needs to tell those apart, so the current state comes back rather than a
   // bare false.
   const [row] = await tx
     .select({
       state: mediaObjects.state,
+      declaredBytes: mediaObjects.declaredBytes,
+      mimeType: mediaObjects.mimeType,
       objectKey: mediaObjects.objectKey,
       environmentId: mediaObjects.environmentId,
     })
     .from(mediaObjects)
     .where(eq(mediaObjects.id, input.id));
   return {
     applied: false,
     state: row?.state ?? null,
+    declaredBytes: row?.declaredBytes ?? null,
+    mimeType: row?.mimeType ?? null,
     objectKey: row?.objectKey ?? null,
     environmentId: row?.environmentId ?? null,
   };
   });
 }
 
```

```diff title="services/api/src/media/presign.ts"
@@ -38,12 +38,16 @@
    * with no key segment and no trailing slash. The first probe of this chapter
    * created its bucket with `mkdir` and so never exercised this path. */
   key?: string;
   accessKey: string;
   secretKey: string;
   region?: string;
+  /** Extra query parameters, signed with the rest (4.16). A bucket listing pages with
+   *  `marker`, and a parameter outside the signature is a 403 rather than an ignored
+   *  hint. Empty for every caller that predates the inventory. */
+  params?: Record<string, string>;
   /** Seconds. FR-003 says 15 minutes for an upload slot, and the STORE enforces it —
    * a URL past its expiry is refused with `AccessDenied · Request has expired` from
    * the store's own clock, with nothing asked of us. */
   expiresIn?: number;
   /** Injectable for the tests; the signature is a function of this instant. */
   now?: Date;
@@ -57,28 +61,41 @@
     key = "",
     accessKey,
     secretKey,
     region = "us-east-1",
     expiresIn = 900,
     now = new Date(),
+    params = {},
   } = options;
 
   const host = new URL(endpoint).host;
   const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
   const date = amzDate.slice(0, 8);
   const scope = `${date}/${region}/s3/aws4_request`;
 
-  // ORDER MATTERS AND `URLSearchParams` PRESERVES INSERTION ORDER. The canonical query
-  // string is the signed parameters sorted by name, and these five already are.
-  const query = new URLSearchParams({
-    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
-    "X-Amz-Credential": `${accessKey}/${scope}`,
-    "X-Amz-Date": amzDate,
-    "X-Amz-Expires": String(expiresIn),
-    "X-Amz-SignedHeaders": "host",
-  });
+  // ORDER MATTERS, AND SINCE 4.16 IT IS SORTED RATHER THAN ARRANGED. The canonical query
+  // string is every signed parameter ordered by name, and the five below were written in
+  // that order by hand — which was true and stopped being a safe thing to rely on the
+  // moment a caller could add its own. `marker` and `max-keys` happen to sort after
+  // `X-Amz-*` because uppercase precedes lowercase in ASCII; a parameter beginning with a
+  // digit would not, and the failure is a `SignatureDoesNotMatch` with nothing to read.
+  //
+  // **EVERY PARAMETER MUST BE INSIDE THE SIGNATURE.** Measured before this was written:
+  // appending `&list-type=2` to an already-signed URL answers
+  // `SignatureDoesNotMatch` — which is how a bucket listing that needs pagination
+  // discovered it needed this argument at all.
+  const signed: [string, string][] = [
+    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
+    ["X-Amz-Credential", `${accessKey}/${scope}`],
+    ["X-Amz-Date", amzDate],
+    ["X-Amz-Expires", String(expiresIn)],
+    ["X-Amz-SignedHeaders", "host"],
+    ...Object.entries(params),
+  ];
+  signed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
+  const query = new URLSearchParams(signed);
 
   // SEGMENT BY SEGMENT. `encodeURIComponent` on the whole path would escape the
   // separators too, and a key with a slash in it is the normal case here.
   const uri = key
     ? `/${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`
     : `/${bucket}`;
```

```diff title="services/api/src/media/store.ts"
@@ -204,6 +204,75 @@
 ): Promise<boolean> {
   const results = await Promise.all(
     [parentKey, ...renditionKeys].map((key) => deleteObject(config, key)),
   );
   return results.every(Boolean);
 }
+
+/** One entry of the object store's own inventory (DR-17, chapter 4.16). */
+export interface StoredObject {
+  key: string;
+  bytes: number;
+}
+
+/** WHAT THE STORE SAYS IT HOLDS — the only thing that can contradict the meter.
+ *
+ * DR-17 asks for the rollup to be *"reconciled weekly against an object-storage inventory
+ * listing"*, and nothing in this platform could list a bucket. It turned out to be nearly
+ * free: `presign` with no key signs `/{bucket}`, which is a listing, and it already
+ * documented that case at 4.10.
+ *
+ * **IT PAGES, AND THAT IS NOT OPTIONAL.** One response carries 1,000 keys with
+ * `IsTruncated: true` against a bucket holding 8,120 objects. **4.13's sweep read one page
+ * and an object nobody uploaded to stayed `pending` for ever**; a reconciliation that
+ * read one page would report agreement for the 7,000 it never looked at. V1 pages with
+ * `marker` — V2's `continuation-token` belongs to `list-type=2`, which is not what was
+ * measured.
+ *
+ * **NO `HEAD` PER OBJECT.** Each entry carries its own `<Size>`, so the inventory costs
+ * nine requests rather than 8,120: **430 ms against 11.5 s** at this lane's size.
+ *
+ * XML BY REGULAR EXPRESSION, DELIBERATELY. The response is a fixed S3 shape with two
+ * elements this needs; a parser would be a dependency (ADR-30's ratio) and this platform
+ * has hand-written a SigV4 signer rather than take one. */
+export async function listObjects(
+  config: StoreConfig,
+  opts: { maxPages?: number } = {},
+): Promise<{ objects: StoredObject[]; pages: number; truncated: boolean }> {
+  const maxPages = opts.maxPages ?? 100;
+  const objects: StoredObject[] = [];
+  let marker: string | undefined;
+  let pages = 0;
+
+  for (; pages < maxPages; ) {
+    const url = presign({
+      method: "GET",
+      ...config,
+      endpoint: config.internalEndpoint,
+      expiresIn: 300,
+      ...(marker === undefined ? {} : { params: { marker } }),
+    });
+    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
+    if (!res.ok) throw new Error(`LIST ${config.bucket}: ${res.status}`);
+    const xml = await res.text();
+    pages += 1;
+
+    // `[\s\S]` rather than the `s` flag, to match the file's target without a lib bump.
+    const entries = xml.matchAll(
+      /<Contents>[\s\S]*?<Key>([^<]+)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g,
+    );
+    let last: string | undefined;
+    for (const m of entries) {
+      objects.push({ key: m[1]!, bytes: Number(m[2]) });
+      last = m[1]!;
+    }
+
+    if (!/<IsTruncated>true<\/IsTruncated>/.test(xml) || last === undefined) {
+      return { objects, pages, truncated: false };
+    }
+    marker = last;
+  }
+  // THE PAGE CAP IS REPORTED, NOT SWALLOWED. A caller that stops early must be able to
+  // say its answer is partial — the alternative is a reconciliation reporting agreement
+  // about a bucket it did not finish reading.
+  return { objects, pages, truncated: true };
+}
```

```diff title="services/api/src/media/media.service.ts"
@@ -1,13 +1,19 @@
 import { randomUUID } from "node:crypto";
 
-import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
+import { BadRequestException, HttpStatus, Inject, Injectable } from "@nestjs/common";
+
+import type { Logger } from "@relay/service-kit";
 
 import { Repository } from "../db/repository";
 import { protocolError } from "../protocol-error";
 import { KIND_CAPS, kindOf } from "./kinds";
+import { LOGGER } from "../logger";
+import { publishStorageDelta } from "../metering/storage-event";
+import type { Publisher } from "../outbox/publisher";
+import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
 import { presign } from "./presign";
 import { storeConfig, storeReady, type StoreConfig } from "./store";
 
 /** What a caller declares. Nothing here is verified — FR-MED-03 is a later chapter,
  * and the quota arithmetic below is over these numbers rather than over bytes. */
 export interface SlotRequest {
@@ -46,13 +52,17 @@
 const SLOT_SECONDS = 900;
 
 @Injectable()
 export class MediaService {
   private readonly store: StoreConfig = storeConfig();
 
-  constructor(private readonly repo: Repository) {}
+  constructor(
+    private readonly repo: Repository,
+    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: Publisher,
+    @Inject(LOGGER) private readonly logger: Logger,
+  ) {}
 
   async createSlot(input: SlotRequest, userExternalId?: string): Promise<Slot> {
     // ORDER MATTERS AND IT IS THE CLAUSE'S. Type, then size, then quota: the first two
     // are facts about the request and the third needs a read, so refusing in this order
     // means a request that was never going to be accepted does not touch the database.
     const kind = kindOf(input.mime_type);
@@ -136,12 +146,32 @@
       method: "PUT",
       ...this.store,
       key: objectKey,
       expiresIn: SLOT_SECONDS,
     });
 
+    // FR-MED-12's `reserved` DELTA — **AFTER THE COMMIT, OUTSIDE THE TRANSACTION, AND NOT
+    // AWAITED.** `webhooks/analytics.ts` records the decision: *"guarantee independence →
+    // the publish happens after the commit, outside it, and a crash in that gap loses the
+    // record"*, because a blocked outcome transaction is what constitution III names as a
+    // design failure. And a publish INSIDE a transaction that rolls back would emit a
+    // delta for a slot that was never created — a permanent overcount, which is the whole
+    // thing this chapter argues nothing corrects.
+    //
+    // THE BYTES ARE THE QUOTA'S (FR-002). `reserveMediaSlot` sums `declared_bytes` where
+    // `state <> 'rejected'`, so a `pending` object is already charged and the meter says
+    // the same number for the same reason rather than by agreement.
+    void publishStorageDelta(this.analytics, this.logger, {
+      environmentId: this.repo.environment,
+      mediaId: id,
+      cause: "reserved",
+      kind,
+      bytesDelta: input.bytes,
+      occurredAt: new Date(),
+    });
+
     return {
       media_id: id,
       state: "pending",
       upload_url,
       expires_at: new Date(Date.now() + SLOT_SECONDS * 1000).toISOString(),
     };
```

```diff title="services/api/src/media/media.module.ts"
@@ -1,10 +1,15 @@
 import { Module, Scope } from "@nestjs/common";
 import { REQUEST } from "@nestjs/core";
 
 import { AuthModule } from "../auth/auth.module";
+import { LOGGER, apiLogger } from "../logger";
+import { ensureAnalyticsStream } from "../outbox/jetstream.publisher";
+import { createJetStreamPublisher } from "../outbox/jetstream.publisher";
+import type { Publisher } from "../outbox/publisher";
+import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
 import { createDb, createPool, type Db } from "../db/client";
 import { Repository } from "../db/repository";
 import { MediaController } from "./media.controller";
 import { MediaService } from "./media.service";
 import type { RequestWithTenant } from "../messages/request-with-tenant";
 
@@ -38,10 +43,25 @@
       provide: Repository,
       scope: Scope.REQUEST,
       inject: ["DB", REQUEST],
       useFactory: (db: Db, req: RequestWithTenant) =>
         new Repository(db, req.principal?.environmentId ?? ""),
     },
+    // A THIRD COPY OF THE SAME FACTORY, AND THE RULE THAT FORCES IT IS WRITTEN IN
+    // `internal.module.ts`: *"a provider is visible to the module that declares it and to
+    // nothing it imports"* — and `InternalModule` has no `exports:` array. `AppModule`
+    // already provides `ANALYTICS_PUBLISHER` for its middleware and `InternalModule` for
+    // the dispatcher; this module needs it for FR-MED-12's storage deltas (4.16).
+    //
+    // The cost is the one `app.module.ts` states: another lazy NATS connection and another
+    // idempotent `ensureAnalyticsStream` at boot. **And declaring a service without its
+    // providers compiles, typechecks and lints**, then fails at the first request with
+    // `Nest can't resolve dependencies` — 4.10's finding, in this very file's header.
+    {
+      provide: ANALYTICS_PUBLISHER,
+      useFactory: (): Publisher => createJetStreamPublisher({ ensure: ensureAnalyticsStream }),
+    },
+    { provide: LOGGER, useFactory: () => apiLogger() },
     MediaService,
   ],
 })
 export class MediaModule {}
```

<!-- AND AN ELEVENTH FILE, WHICH CI FOUND AND THE LOCAL RUN COULD NOT HAVE.
     `check:fences` was taken to zero in phase 8 and the coverage pins for this chapter's
     three new files were added in phase 9, AFTER it. `CLAUDE.md`'s rule is "run
     `check:fences` after ANY source edit", and 4.14 recorded the same sequence from the
     other side: a platform edit made to turn CI green invalidates the hunks that publish
     it. Here the edit was not even a repair — it was the ratchet being tightened. -->

```diff title="vitest.coverage.config.mts"
@@ -507,12 +507,58 @@
           // which are covered in `sweep.test.ts` against a fake client rather than here.
           branches: 49,
           functions: 100,
           lines: 100,
           statements: 77,
         },
+        // ── CHAPTER 4.16's OWN THREE FILES ──────────────────────────────────
+        //
+        // **THIS CHAPTER SHIPPED THREE SOURCE FILES AND ALMOST PINNED NONE OF
+        // THEM**, which is the defect the quota chapter's note further down
+        // already records: *"this one shipped seven and left the ratchet nothing
+        // to hold, which is visible only by comparing two chapters."* The global
+        // floor is an aggregate, so an unpinned file at 20% passes as long as the
+        // rest carry it — 68 of the 139 files this run sees are unpinned, and the
+        // lowest is at 20.00.
+        //
+        // ONE OBSERVATION EACH, SO THE PINS SIT BELOW IT BY A MARGIN. 045's rule
+        // is *pin below the lower observation by the observed swing and put both
+        // numbers in the config*, and there is only one observation here — so the
+        // margin is a guess rather than a measurement, and it is written down as
+        // one. Measured 2026-09-30, full run, 145 files, 2,113 tests:
+        //
+        //   storage-reconcile.ts   st 100.00  br  90.38  fn 100  ln 100.00
+        //   storage-reads.ts       st 100.00  br 100.00  fn 100  ln 100.00
+        //   storage-event.ts       st 100.00  br 100.00  fn 100  ln 100.00
+        //
+        // `storage-reconcile.ts`'s branches are the composed half's — the
+        // truncated-listing arm and the `?? null` defaults, which a live store
+        // will not produce on demand. The pure half is exercised to the letter.
+        "services/api/src/metering/storage-reconcile.ts": {
+          statements: 95,
+          branches: 85,
+          functions: 100,
+          lines: 95,
+        },
+        "services/api/src/db/storage-reads.ts": {
+          statements: 95,
+          branches: 95,
+          functions: 100,
+          lines: 95,
+        },
+        // **PINNED AT 100 RATHER THAN AT WHAT IT MEASURED FIRST.** This file read
+        // 66.66% statements with no pin to notice, and the missing third was the
+        // `catch` — which is not a defensive branch but the whole of what *"a lost
+        // record is the accepted cost"* means in code. A test drives it now, so
+        // the pin is what the file achieves rather than what it achieved.
+        "services/api/src/metering/storage-event.ts": {
+          statements: 100,
+          branches: 100,
+          functions: 100,
+          lines: 100,
+        },
         "services/api/src/internal/media.controller.ts": {
           // 83, FROM TWO ENVIRONMENTS THAT DISAGREE, AND THE DISAGREEMENT IS NOT A
           // SWING. This was pinned at 89 from a single local observation of 90.90 —
           // the mistake 045 names in as many words, *"pin below the lower observation
           // by the observed swing and put both numbers in the config"*, with only one
           // observation to go on. CI then reported **84.61 on three consecutive runs**.
```

---

### `packages/outsider/src/integrate.itest.ts` — the sealed suite carries one image end to end, and the comment that said no worker runs is replaced by the measurement.

Chapter 4.17 adds two journeys to this file and corrects two sentences in it. The hunks are
here rather than in the chapter for the reason the appendix exists: four earlier sections of
this document already amend this file, and a chapter hunk anchored between them would be
written against a state no reader of that chapter ever sees.

**The bill was 23 hunks before it was 6.** The first version of this work ran
`prettier --write` over the whole file — which had never been Prettier-clean, through chapters
4.13, 4.14 and 4.16 — and the reformatting touched **221 lines nobody had asked about**, every
one of them a hunk this appendix would have carried for ever. The edits were re-applied to the
original formatting instead. A formatter is free on a file you own and is not free on a file the
fence chain publishes.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -1,7 +1,8 @@
 import { randomUUID } from "node:crypto";
+import { crc32, deflateSync } from "node:zlib";
 import { beforeAll, describe, expect, it } from "vitest";
 
 // AN INTEGRATION BUILT FROM PUBLISHED DOCUMENTATION ALONE (FR-031, SC-009,
 // SC-030).
 //
 // This file is the SRS Phase 2 exit criterion as a test: "an external developer
@@ -29,13 +30,24 @@
 //
 // WHAT NONE OF THE THREE CLOSES: reading the repository's source with human eyes.
 // The seals make it impossible to IMPORT workspace code; they cannot make it
 // impossible to look. That is a discipline, and the chapter says so rather than
 // letting three rules imply a fourth (FR-034).
 //
-// AND IT IMPORTS NOTHING AT ALL BEYOND VITEST. The socket uses Node's GLOBAL
+// AND IT REACHES NO WORKSPACE PATH — WHICH IS THE RULE, AND IS NOT THE SAME AS
+// IMPORTING NOTHING. This sentence read *"AND IT IMPORTS NOTHING AT ALL BEYOND
+// VITEST"* and was already false when it was written: line 1 is
+// `import { randomUUID } from "node:crypto"`. Chapter 4.17 added `node:zlib` and made
+// it falser, which is how it was noticed. **A Node builtin is not a workspace path**,
+// and the three seals below say so precisely — they refuse `@relay/*`, a specifier
+// that climbs out of this package, and the `".."` literal. None of them has anything
+// to say about `node:`. A sentence nobody can trust is worse than no sentence, and an
+// overclaiming one invites the first person who checks it to assume the seals are
+// decorative too.
+//
+// THE SOCKET USES NODE'S GLOBAL
 // `WebSocket`, not the `ws` package every suite in this workspace uses — which
 // was not the plan and is the better answer. `ws` resolves from the workspace root
 // by the ordinary parent walk, so the suite could have used it while declaring
 // nothing; its TYPES do not, and the choice was between borrowing `@types/ws`
 // through a parent walk, writing a local ambient declaration, or using the
 // platform's own client. Node 22 has had a standards-compliant `WebSocket` since
@@ -70,12 +82,90 @@
         `  export RELAY_API_URL=http://localhost:4000 RELAY_WS_URL=ws://localhost:4001`,
     );
   }
   return { api: API!, ws: WS!, credential: CREDENTIAL! };
 }
 
+/** An 800 × 600 greyscale PNG, built here because it cannot be a literal (chapter 4.17).
+ *
+ * **IT HAS TO EXCEED 320 px ON ITS LONG EDGE OR THERE IS NO THUMBNAIL TO FETCH.** The
+ * worker's `thumbnailOf` answers `within-bound` at or below the bound and writes no
+ * rendition at all (chapter 4.15), so the 1×1 literal this file already carries would
+ * make the journey assert a rendition id the history payload never contains — and the
+ * assertion would fail naming the id rather than the bound.
+ *
+ * AND AT THAT SIZE A LITERAL IS NOT AVAILABLE: the pixels deflate to 480,756 bytes.
+ * `node:zlib` is a Node builtin, not a workspace path, so building it here breaks no
+ * seal — see the header, whose claim to import nothing was corrected in the same
+ * chapter.
+ *
+ * NOISE FROM A FIXED SEED, WHICH IS TWO PROPERTIES AND BOTH ARE WANTED. Deterministic,
+ * so the file is the same 480,813 bytes on every machine and `bytes` can be declared
+ * against it — FR-MED-03 refuses a declaration that is one byte out, in either
+ * direction (chapter 4.13). And incompressible, so the size is a fact about the
+ * dimensions rather than about the picture, which is what keeps the thumbnail
+ * comparison meaningful: a photograph of a white wall would thumbnail LARGER than the
+ * parent and the assertion would read as a defect.
+ *
+ * GREYSCALE RATHER THAN RGB for the reason a fixture should be cheap: one byte a pixel
+ * is a third of the store, a third of the quota the slot reserves and a third of the
+ * PUT. */
+const journeyPng = (): Uint8Array<ArrayBuffer> => {
+  const width = 800;
+  const height = 600;
+
+  const chunk = (type: string, data: Buffer): Buffer => {
+    const out = Buffer.alloc(data.length + 12);
+    out.writeUInt32BE(data.length, 0);
+    out.write(type, 4, "ascii");
+    data.copy(out, 8);
+    // THE CRC COVERS THE TYPE AND THE DATA, NOT THE LENGTH. A PNG with the length
+    // included decodes in nothing, and `sharp` would answer `rendition_failed` — which
+    // the journey would read as the worker being broken.
+    const crc = crc32(Buffer.concat([Buffer.from(type, "ascii"), data]));
+    out.writeUInt32BE(crc >>> 0, data.length + 8);
+    return out;
+  };
+
+  const ihdr = Buffer.alloc(13);
+  ihdr.writeUInt32BE(width, 0);
+  ihdr.writeUInt32BE(height, 4);
+  ihdr[8] = 8; // bit depth
+  ihdr[9] = 0; // colour type 0, greyscale
+
+  // XORSHIFT32, NOT A LINEAR CONGRUENTIAL GENERATOR. The obvious
+  // `seed = (seed * 1103515245 + 12345) >>> 0` loses its low bits to floating point —
+  // the product passes 2^53 — and the sequence degenerates: the same 800 × 600 image
+  // built that way deflated to **23,284 bytes**, a 62× ratio that says the "noise" was
+  // structure. The byte count is the tell, and it is the reason this fixture is
+  // measured rather than assumed.
+  const raw = Buffer.alloc(height * (1 + width));
+  let seed = 1;
+  for (let y = 0; y < height; y++) {
+    const row = y * (1 + width);
+    raw[row] = 0; // filter type 0, None — one byte before every scanline
+    for (let x = 0; x < width; x++) {
+      seed ^= seed << 13;
+      seed >>>= 0;
+      seed ^= seed >>> 17;
+      seed ^= seed << 5;
+      seed >>>= 0;
+      raw[row + 1 + x] = seed & 0xff;
+    }
+  }
+
+  return new Uint8Array(
+    Buffer.concat([
+      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
+      chunk("IHDR", ihdr),
+      chunk("IDAT", deflateSync(raw)),
+      chunk("IEND", Buffer.alloc(0)),
+    ]),
+  );
+};
+
 describe("integrating with Relay from the outside", () => {
   let api: string;
   let ws: string;
   let credential: string;
   let channelId: string;
   let token: string;
@@ -97,12 +187,68 @@
     const res = await fetch(`${api}${path}`, {
       headers: { authorization: `Bearer ${auth}` },
     });
     return { status: res.status, body: (await res.json()) as Record<string, unknown> };
   };
 
+  /** Wait for a media attachment to leave `pending`, by reading the channel the way a
+   *  client would (chapter 4.17).
+   *
+   *  **THERE IS NO SURFACE THAT ANSWERS "HAS THE WORKER RUN YET".** The client PUTs
+   *  straight to the store (ADR-13), so nothing tells the platform the upload finished
+   *  and chapter 4.13 built a sweep on a 5,000 ms timer instead. A client learns the
+   *  verdict by reading the message again, which is what this does.
+   *
+   *  A CONDITION WITH A DEADLINE, NEVER AN ELAPSED TIME. The wait is uniform over the
+   *  interval — measured at min 1,861, p50 3,993, max 5,568 ms over ten independent
+   *  trials — so an assertion on duration would be tuned to whichever point in the cycle
+   *  the test happened to start at. An earlier measurement of this platform reported
+   *  `p50 5,693 ms` from five runs taken in a loop, each beginning just after the sweep
+   *  that ended the one before: **a loop that waits for the thing it is timing
+   *  synchronises with it.**
+   *
+   *  AND THE FAILURE NAMES THE WORKER, because from out here it has to. With the worker
+   *  stopped an uploaded object stays `pending` for ever and `GET /v1/media/{id}` answers
+   *  the same 404 as an id nobody has — chapter 4.12 built that indistinguishability
+   *  deliberately — so a deadline that reported only "still pending" would describe a
+   *  legitimate state and say nothing about why. */
+  const waitForAttachmentState = async (
+    channelId: string,
+    mediaId: string,
+    auth: string,
+    deadlineMs = 25_000,
+  ): Promise<string> => {
+    // NO `let seen = "pending"` BEFORE THE LOOP — the initialiser is never read, and
+    // `no-useless-assignment` says so. Chapter 4.16 hit the identical rule on a
+    // `let seen = 0`; this is the second time, which makes it a habit rather than a slip.
+    const started = Date.now();
+    for (;;) {
+      const res = await get(
+        `/v1/channels/${channelId}/messages?limit=10`,
+        auth,
+      );
+      const messages = (res.body["messages"] ?? []) as {
+        attachments?: { media_id?: string; state?: string }[];
+      }[];
+      const attachment = messages
+        .flatMap((m) => m.attachments ?? [])
+        .find((a) => a.media_id === mediaId);
+      const seen = attachment?.state ?? "absent";
+      if (seen !== "pending") return seen;
+      if (Date.now() - started > deadlineMs) {
+        throw new Error(
+          `media ${mediaId} is still '${seen}' after ${Date.now() - started} ms. ` +
+            `The sweep runs every 5,000 ms, so this is not the timer — the media worker ` +
+            `is not producing verdicts. Check that it is running and that its boot line ` +
+            `names a reachable scanner: 'docker compose logs media-worker | tail -2'.`,
+        );
+      }
+      await new Promise((r) => setTimeout(r, 200));
+    }
+  };
+
   beforeAll(() => {
     ({ api, ws, credential } = required());
   });
 
   it("reaches the platform at all", async () => {
     // Before anything else, and separately, so a platform that is not there says
@@ -503,21 +649,43 @@
     // this shape and the only one no local lane reaches.** `pnpm test`,
     // `pnpm test:integration` and `pnpm coverage` all skip this suite: it needs a
     // composed stack and three environment variables, so CI's sealed job and a
     // hand-run are the only things that execute it. The other four were found by the
     // api lane and the coverage lane; this one was found by CI.
     //
-    // `pending` is right and is not a race. The object was uploaded but nothing has
-    // verified it — this suite runs no media worker, which is what makes the value
-    // stable rather than timing-dependent.
+    // `pending` IS RIGHT, AND THE REASON WRITTEN HERE WAS FALSE FOR TWO CHAPTERS.
+    //
+    // It read: *"this suite runs no media worker, which is what makes the value stable
+    // rather than timing-dependent."* **CI's sealed job runs
+    // `docker compose --profile services up -d --wait`, and `media-worker` is in that
+    // profile** — so a worker has been running every time this assertion passed.
+    //
+    // It is timing-dependent AND it is stable, which are two different claims. The sweep
+    // runs every 5,000 ms and the three steps between the PUT and this line take
+    // milliseconds, so the margin is most of an interval: measured at min 1,861, p50
+    // 3,993, max 5,568 ms from PUT to verdict over ten independent trials. **A race with
+    // a four-second margin is the kind nothing ever catches**, and the sentence that
+    // would have explained it away is the one chapter 4.17 went looking for.
     expect(delivered.payload.attachments).toEqual([
       { type: "url", kind: "image", url: "https://example.test/outside-url.png" },
       { type: "media", media_id: mediaId, state: "pending" },
     ]);
     socket.close();
 
+    // AND THE REASON IS NOW CHECKED RATHER THAN ASSERTED IN PROSE (chapter 4.17). A
+    // comment is not a test: if the state above is `pending` because the read is inside
+    // the window, then waiting past the window must produce a verdict. If a future
+    // change stops a worker running in this lane, the line above keeps passing and this
+    // one goes red naming the worker.
+    const settled = await waitForAttachmentState(
+      channelId,
+      mediaId,
+      credential,
+    );
+    expect(settled, "the deployed worker produced no verdict").toBe("ready");
+
     // AND THE BYTES COME BACK, FROM OUTSIDE (chapter 4.12, SC-010). The frame above
     // carries an id and nothing else; a client holding it has to ask for a URL, and
     // this is the only test in the repository that asks as a customer does — over the
     // published surface, from a process that started nothing, through a URL whose host
     // was chosen by the api and has to be reachable from here.
     //
@@ -553,12 +721,569 @@
     // `new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0])` — the old fixture,
     // written out twice — and when the upload became a real PNG the assertion kept
     // comparing against eleven bytes that were no longer sent anywhere.
     expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(png);
   });
 
+  /** **★ THE MILESTONE: ONE IMAGE, END TO END, THROUGH THE WORKER A DEPLOYMENT RUNS**
+   *  (chapter 4.17 — FR-001, FR-002, FR-004a, FR-006a, SC-001, SC-002, SC-003, SC-003a).
+   *
+   *  Seven chapters built this path one piece at a time and **no test joined them.** The
+   *  pieces each have a suite: 4.13's worker verifies in process, 4.14's state machine is
+   *  driven by SQL, 4.15's thumbnail is a unit test over a buffer, 4.12's delivery gate
+   *  sets its states by hand. Every one of them stands in for the step beside it. This is
+   *  the only check in the repository where **nothing stands in for anything** — the
+   *  verdict is made by the container `docker compose --profile services` starts, and the
+   *  suite learns it the way a customer would, by reading the message again.
+   *
+   *  EACH STEP NAMES THE CHAPTER THAT MADE IT POSSIBLE (FR-002). That is not decoration:
+   *  this test crosses seven chapters and three services, so a failure here is a question
+   *  about which of them moved. A bare `expected 404 to be 200` at step eight sends a
+   *  reader to the delivery route, which is the one part of the path that is almost never
+   *  the cause.
+   *
+   *  ITS OWN CHANNEL, AND NOT THE SHARED ONE. `channelId` has collected messages from
+   *  eleven tests by the time this runs, so a history read against it would have to
+   *  search rather than assert — and a journey that searches cannot claim the recipient
+   *  sees one message with one attachment.
+   *
+   *  AND IT CALLS NO INTERNAL ROUTE. `POST /internal/media/{id}/verdict` would make every
+   *  assertion below pass in forty milliseconds, and it is the thing this chapter exists
+   *  to stop doing: a test that calls the verdict route is a test of the api's reaction
+   *  to a verdict, which 4.14 already has. */
+  it("carries one image from slot to delivered bytes, with the deployed worker making the verdict (4.17, SC-001)", async () => {
+    // STEP 1 — A CHANNEL OF ITS OWN, AND A MEMBER IN IT (chapters 2.2 and 3.8).
+    //
+    // THE MEMBERSHIP IS NOT OPTIONAL AND ITS ABSENCE IS SILENT. Measured while this was
+    // being written: a socket opened with a valid token for a non-member received
+    // `connection.ack` and `presence.changed` and **no `message.created` and no
+    // `media.updated`** — on a PUBLIC channel. The absence of every frame looks exactly
+    // like the absence of the one you came for, which is how an earlier probe read as
+    // `media.updated` not existing at all.
+    const journeyChannel = await post(
+      "/v1/channels",
+      { external_id: `journey-${Date.now()}`, type: "public" },
+      credential,
+    );
+    expect(
+      journeyChannel.status,
+      "the journey could not create its own channel",
+    ).toBe(201);
+    const journeyId = journeyChannel.body["id"] as string;
+
+    const member = await post(
+      `/v1/channels/${journeyId}/members`,
+      { user_ids: ["ana"] },
+      credential,
+    );
+    expect(
+      member.status,
+      "chapter 3.8's members route refused ana, so her socket will hear nothing",
+    ).toBe(200);
+
+    // STEP 2 — A SOCKET OPEN BEFORE ANY OF IT (chapter 3.4).
+    //
+    // Before the send, deliberately. A subscriber who connects afterwards learns the
+    // state from history and tells us nothing about the frame; the claim FR-006a makes
+    // is that a client holding a placeholder is TOLD when it becomes a picture.
+    const socket = new WebSocket(`${ws}/v1/ws?token=${token}`);
+    const frames: { type: string; payload?: Record<string, unknown> }[] = [];
+    socket.addEventListener("message", (event) => {
+      frames.push(JSON.parse(String(event.data)) as { type: string });
+    });
+    socket.addEventListener("error", () => undefined);
+    await new Promise<void>((resolve, reject) => {
+      socket.addEventListener("open", () => resolve());
+      socket.addEventListener("close", (event) =>
+        reject(new Error(`closed ${(event as CloseEvent).code}`)),
+      );
+      setTimeout(
+        () => reject(new Error(`no socket at ${ws} within 10s`)),
+        10_000,
+      );
+    });
+
+    const until = async (
+      predicate: (f: {
+        type: string;
+        payload?: Record<string, unknown>;
+      }) => boolean,
+      what: string,
+    ): Promise<{ type: string; payload?: Record<string, unknown> }> => {
+      const deadline = Date.now() + 15_000;
+      for (;;) {
+        const found = frames.find(predicate);
+        if (found) return found;
+        if (Date.now() > deadline) {
+          throw new Error(
+            `no ${what}; saw ${frames.map((f) => f.type).join(", ") || "nothing"}`,
+          );
+        }
+        await new Promise((r) => setTimeout(r, 50));
+      }
+    };
+    await until((f) => f.type === "connection.ack", "ana's connection.ack");
+
+    // STEP 3 — A SLOT FOR A REAL IMAGE (chapter 4.10).
+    //
+    // `bytes` is DECLARED and the store counts what arrives. FR-MED-03 refuses a
+    // mismatch of one byte in either direction (chapter 4.13), which is why the fixture
+    // is deterministic and its length is read rather than written down.
+    const image = journeyPng();
+    expect(
+      image.length,
+      "the fixture moved; the figures in the chapter are measured",
+    ).toBe(480_813);
+
+    const slot = await post(
+      "/v1/media",
+      { filename: "journey.png", mime_type: "image/png", bytes: image.length },
+      credential,
+    );
+    expect(
+      slot.status,
+      "chapter 4.10's slot route refused a published credential",
+    ).toBe(201);
+    expect(
+      slot.body["state"],
+      "a slot is pending before anything is uploaded",
+    ).toBe("pending");
+    const journeyMediaId = slot.body["media_id"] as string;
+
+    // STEP 4 — THE BYTES GO TO THE STORE, NOT THROUGH RELAY (ADR-13, chapter 4.10).
+    const put = await fetch(slot.body["upload_url"] as string, {
+      method: "PUT",
+      body: image,
+    });
+    expect(put.status, "the presigned URL was not usable from outside").toBe(
+      200,
+    );
+
+    // STEP 5 — THE SEND HAPPENS BEFORE THE VERDICT, ON PURPOSE (chapter 4.11).
+    //
+    // FR-MED-06's decision: a photo may be attached the moment the upload completes,
+    // because the alternative is a client that has to wait on a timer it cannot see.
+    // So the recipient's first sight of this message is a placeholder, and that is the
+    // state being asserted — not a race this test happens to win.
+    const journeyText = `journey ${randomUUID()}`;
+    const sent = await post(
+      `/v1/channels/${journeyId}/messages`,
+      {
+        text: journeyText,
+        user: "outside-bot",
+        idempotency_key: randomUUID(),
+        attachments: [{ type: "media", media_id: journeyMediaId }],
+      },
+      credential,
+    );
+    expect(
+      sent.status,
+      "chapter 4.11's reference check refused an object this tenant owns",
+    ).toBe(201);
+    expect(sent.body["attachments"]).toEqual([
+      { type: "media", media_id: journeyMediaId, state: "pending" },
+    ]);
+
+    // And the recipient sees the placeholder too (chapter 3.4, chapter 4.14).
+    const created = await until(
+      (f) =>
+        f.type === "message.created" && f.payload?.["text"] === journeyText,
+      "message.created for the journey's message",
+    );
+    expect(created.payload?.["attachments"]).toEqual([
+      { type: "media", media_id: journeyMediaId, state: "pending" },
+    ]);
+
+    // STEP 6 — THE DEPLOYED WORKER DECIDES (chapters 4.13 and 4.14).
+    //
+    // Nothing is called here. The sweep runs on its own 5,000 ms timer inside a
+    // container this process did not start, HEADs the object, scans the bytes, checks
+    // them against what was declared, and writes a verdict. A condition with a
+    // deadline, never an elapsed time.
+    const state = await waitForAttachmentState(
+      journeyId,
+      journeyMediaId,
+      credential,
+    );
+    expect(
+      state,
+      "the deployed worker produced no verdict for a valid PNG",
+    ).toBe("ready");
+
+    // STEP 7 — AND THE CLIENT IS TOLD (chapter 4.14, FR-006a, SC-003a).
+    //
+    // The frame carries `{media_id, channel, state}` and no thumbnail, so a client
+    // learns THAT the placeholder resolved from the socket and WHAT it resolved to from
+    // history. That split is the gateway's: `announce` returns early unless the state is
+    // `ready` or `rejected`, so the two terminal states travel the same way.
+    const updated = await until(
+      (f) =>
+        f.type === "media.updated" &&
+        f.payload?.["media_id"] === journeyMediaId,
+      "media.updated for the journey's attachment",
+    );
+    //
+    // THE WHOLE PAYLOAD, NOT THE STATE ALONE. `{media_id, channel, state}` and nothing
+    // else — asserting only the state would pass for a frame announcing somebody else's
+    // object in somebody else's channel, which is the shape a fan-out bug takes. The
+    // channel is the id rather than the external id, which is worth pinning from out
+    // here because it is the field a client routes on.
+    expect(updated.payload).toEqual({
+      media_id: journeyMediaId,
+      channel: journeyId,
+      state: "ready",
+    });
+
+    // STEP 8 — WHAT A RECIPIENT ACTUALLY READS (chapters 4.14 and 4.15).
+    //
+    // The whole payload, not the state alone: the rendition's id and its dimensions
+    // travel beside it, so a client never has to guess what to ask for. 320 × 240 is
+    // 4.15's bound applied to an 800 × 600 parent — the long edge lands ON the bound and
+    // the aspect ratio is kept.
+    //
+    // `messages`, NOT `data`. A defaulting accessor over the wrong key turned this into
+    // what looked like history dropping the attachment (research R7).
+    const history = await get(
+      `/v1/channels/${journeyId}/messages?limit=10`,
+      credential,
+    );
+    expect(history.status).toBe(200);
+    const read = (
+      history.body["messages"] as { text?: string; attachments?: unknown[] }[]
+    ).find((m) => m.text === journeyText);
+    expect(read?.attachments).toEqual([
+      {
+        type: "media",
+        media_id: journeyMediaId,
+        state: "ready",
+        thumbnail: { media_id: expect.any(String), width: 320, height: 240 },
+      },
+    ]);
+    const thumbnailId = (
+      read?.attachments as { thumbnail: { media_id: string } }[]
+    )[0]!.thumbnail.media_id;
+
+    // STEP 9 — THE BYTES COME BACK, AND THEY ARE THE BYTES (chapter 4.12).
+    //
+    // BYTE-IDENTICAL, NOT THE SAME LENGTH. A length check passes for a file the store
+    // truncated, for a file served from the wrong key at the same size, and for a
+    // thumbnail that happens to match.
+    const parentLink = await get(`/v1/media/${journeyMediaId}`, credential);
+    expect(
+      parentLink.status,
+      "chapter 4.12's gate refused a ready object in a visible channel",
+    ).toBe(200);
+    const parentBytes = await fetch(parentLink.body["url"] as string);
+    expect(
+      parentBytes.status,
+      "the delivery URL was not usable from outside",
+    ).toBe(200);
+    expect(new Uint8Array(await parentBytes.arrayBuffer())).toEqual(image);
+
+    // STEP 10 — AND THE THUMBNAIL, WHICH NO MESSAGE NAMES (chapter 4.15).
+    //
+    // **THE ONLY MEDIA ID THE PLATFORM HANDS OUT THAT NO MESSAGE REFERENCES.** 4.12's
+    // authorisation asks which channels reference the object, and the answer for a
+    // rendition is none — so it would be readable by nobody if the rule were applied to
+    // it directly. `readableMediaObjectKey` resolves `parentId ?? mediaId`, which is
+    // what makes this request answerable at all, and this is the first time anything
+    // outside the platform has asked it.
+    const thumbLink = await get(`/v1/media/${thumbnailId}`, credential);
+    expect(
+      thumbLink.status,
+      "a rendition inherits its parent's reachability (4.15)",
+    ).toBe(200);
+    const thumbBytes = await fetch(thumbLink.body["url"] as string);
+    expect(thumbBytes.status).toBe(200);
+    const thumb = new Uint8Array(await thumbBytes.arrayBuffer());
+
+    // TWO SIGNED URLS THAT BOTH ANSWER 200 PROVE NOTHING IF THEY SERVE THE SAME OBJECT,
+    // and `parentId ?? mediaId` is exactly the shape that would quietly return the
+    // parent for both. Smaller AND different, because either alone can be satisfied by
+    // the wrong answer: a truncated parent is smaller, and a second copy of the parent
+    // is different from nothing at all.
+    expect(
+      thumb.length,
+      "the thumbnail is not smaller than its parent",
+    ).toBeLessThan(image.length);
+    expect(thumb).not.toEqual(image);
+
+    socket.close();
+
+    // WHAT THIS TEST DOES NOT ASSERT, AND WHY IT IS NOT AN OVERSIGHT: how long any of it
+    // took. The verdict arrives somewhere inside a 5,000 ms window whose phase this
+    // process does not control, so an elapsed-time assertion would be tuned to whichever
+    // point in the sweep the run happened to start at — which is how an earlier
+    // measurement of this platform came back with a p50 of 5,693 ms, a figure that was
+    // the worst case wearing a median's name. **The lane checks the condition and the
+    // chapter publishes the distribution.**
+  });
+
+  /** **THE OTHER HALF: A REFUSAL ARRIVES AS A MARKER, NOT A GAP** (chapter 4.17 —
+   *  FR-003, FR-006a, SC-004, SC-003a).
+   *
+   *  FR-MED-09's reason is a person: a recipient must be able to tell *"somebody sent me
+   *  a file and the platform refused it"* from *"somebody deleted a message"* and from
+   *  *"somebody sent text"*. Those are three different things to say back, and before
+   *  this test nothing checked they are three different things to READ.
+   *
+   *  THE BYTES CONTRADICT THE DECLARATION, WHICH IS FR-MED-03 AND NOT THE SCANNER. A
+   *  43-byte GIF89a declared as `image/png`: the slot route records what the caller said
+   *  and the worker reads what arrived (chapter 4.13). **No object can both satisfy
+   *  `ALLOWED_TYPES` and trip the virus scanner** — there is no text type in the table,
+   *  so EICAR cannot be uploaded as anything — which is why the refusal this journey can
+   *  actually produce is the type one.
+   *
+   *  AND THE DECLARED SIZE IS HONEST. 43 bytes declared, 43 uploaded; a mismatch of one
+   *  byte in either direction is a different refusal, and a test that got both wrong at
+   *  once would pass for the wrong reason. */
+  it("delivers a refused upload as a rejected marker a recipient can tell apart (4.17, SC-004)", async () => {
+    const rejectChannel = await post(
+      "/v1/channels",
+      { external_id: `reject-${Date.now()}`, type: "public" },
+      credential,
+    );
+    expect(rejectChannel.status).toBe(201);
+    const rejectId = rejectChannel.body["id"] as string;
+    expect(
+      (
+        await post(
+          `/v1/channels/${rejectId}/members`,
+          { user_ids: ["ana"] },
+          credential,
+        )
+      ).status,
+      "ana was not added, so her socket will hear nothing",
+    ).toBe(200);
+
+    const socket = new WebSocket(`${ws}/v1/ws?token=${token}`);
+    const frames: { type: string; payload?: Record<string, unknown> }[] = [];
+    socket.addEventListener("message", (event) => {
+      frames.push(JSON.parse(String(event.data)) as { type: string });
+    });
+    // NOTHING IS SWALLOWED IN THIS TEST. An earlier probe of this path wrapped its setup
+    // in `.catch(() => {})`, so a members call with the wrong body failed silently and
+    // the subscriber stayed outside the channel — it then saw NO frames at all, and
+    // "no `media.updated`" read exactly like the feature not existing. Three of four
+    // attempts at this probe failed that way.
+    socket.addEventListener("error", () => undefined);
+    await new Promise<void>((resolve, reject) => {
+      socket.addEventListener("open", () => resolve());
+      socket.addEventListener("close", (event) =>
+        reject(new Error(`closed ${(event as CloseEvent).code}`)),
+      );
+      setTimeout(
+        () => reject(new Error(`no socket at ${ws} within 10s`)),
+        10_000,
+      );
+    });
+
+    // A REAL GIF89a, 1 × 1, 43 bytes — a file that is valid and is not what was claimed.
+    // Random bytes would be refused too, by `rendition_failed` or by the sniff finding
+    // nothing; a well-formed file of the wrong type is the case the clause describes.
+    const gif = new Uint8Array([
+      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
+      0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
+      0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
+      0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
+    ]);
+
+    const slot = await post(
+      "/v1/media",
+      { filename: "liar.png", mime_type: "image/png", bytes: gif.length },
+      credential,
+    );
+    // Chapter 4.10's slot route judges the DECLARATION; chapter 4.13's worker judges the
+    // bytes. That split is why a lying upload is accepted here and refused later.
+    expect(
+      slot.status,
+      "chapter 4.10's slot route judges the declaration, not the bytes",
+    ).toBe(201);
+    const rejectedId = slot.body["media_id"] as string;
+    expect(
+      (
+        await fetch(slot.body["upload_url"] as string, {
+          method: "PUT",
+          body: gif,
+        })
+      ).status,
+      "chapter 4.10's presigned PUT refused bytes the store should have taken",
+    ).toBe(200);
+
+    const rejectText = `rejected journey ${randomUUID()}`;
+    const sent = await post(
+      `/v1/channels/${rejectId}/messages`,
+      {
+        text: rejectText,
+        user: "outside-bot",
+        idempotency_key: randomUUID(),
+        attachments: [{ type: "media", media_id: rejectedId }],
+      },
+      credential,
+    );
+    expect(
+      sent.status,
+      "chapter 4.11's reference check refused a send that happens before the verdict",
+    ).toBe(201);
+
+    const state = await waitForAttachmentState(
+      rejectId,
+      rejectedId,
+      credential,
+    );
+    expect(
+      state,
+      "chapter 4.13's worker accepted a GIF declared as a PNG (FR-MED-03)",
+    ).toBe("rejected");
+
+    // THE FRAME CARRIES THE REFUSAL TOO (FR-006a, SC-003a). `announce` returns early
+    // unless the state is `ready` or `rejected`, so both terminal states travel the same
+    // way — and until this test the rejection half had only ever been watched with
+    // `recordMediaVerdict` called directly by a test (chapter 4.14).
+    const deadline = Date.now() + 15_000;
+    for (;;) {
+      if (frames.some((f) => f.type === "media.updated")) break;
+      if (Date.now() > deadline) {
+        throw new Error(
+          `no media.updated after a rejection; saw ${frames.map((f) => f.type).join(", ")}`,
+        );
+      }
+      await new Promise((r) => setTimeout(r, 50));
+    }
+    expect(frames.find((f) => f.type === "media.updated")?.payload).toEqual({
+      media_id: rejectedId,
+      channel: rejectId,
+      state: "rejected",
+    });
+    socket.close();
+
+    // FR-MED-09's TESTABLE HALF: THE MESSAGE SURVIVES THE REFUSAL. Checked as a premise
+    // before it was asserted — a history route that filtered a message whose only
+    // attachment was refused would make this whole user story unbuildable, and the
+    // chapter would have had to record that rather than work round it. It does not
+    // filter.
+    const history = await get(
+      `/v1/channels/${rejectId}/messages?limit=10`,
+      credential,
+    );
+    const read = (
+      history.body["messages"] as {
+        text?: string | null;
+        attachments?: unknown[];
+      }[]
+    ).find((m) => m.text === rejectText);
+    expect(
+      read,
+      "the message vanished from history when its attachment was refused",
+    ).toBeDefined();
+    expect(read?.attachments).toEqual([
+      { type: "media", media_id: rejectedId, state: "rejected" },
+    ]);
+
+    // AND THREE CASES A RECIPIENT MUST TELL APART, FROM PUBLISHED FIELDS ALONE. This is
+    // the clause's own reason rather than a shape test:
+    //
+    //   a refused upload      text: the sender's   attachments: [{… state:"rejected"}]
+    //   a message with none   text: the sender's   attachments: []
+    //   a deleted message     text: NULL           attachments: []
+    //
+    // The tombstone is what makes the third distinguishable, and it is a different field
+    // from the one carrying the second — so a client that reads only `attachments`
+    // cannot tell a deletion from a plain message, and one that reads only `text` cannot
+    // tell a refusal from a delivery.
+    const plain = await post(
+      `/v1/channels/${rejectId}/messages`,
+      {
+        text: `plain ${randomUUID()}`,
+        user: "outside-bot",
+        idempotency_key: randomUUID(),
+      },
+      credential,
+    );
+    // Chapter 3.18 is where a message gained an `attachments` array at all, so an empty
+    // one is that chapter's answer for "nothing attached" rather than an absent field.
+    expect(plain.status).toBe(201);
+    expect(
+      plain.body["attachments"],
+      "chapter 3.18's empty array became something else",
+    ).toEqual([]);
+
+    const doomed = await post(
+      `/v1/channels/${rejectId}/messages`,
+      {
+        text: `doomed ${randomUUID()}`,
+        user: "outside-bot",
+        idempotency_key: randomUUID(),
+      },
+      credential,
+    );
+    expect(doomed.status, "chapter 3.18's send refused a plain message").toBe(
+      201,
+    );
+    const removed = await fetch(
+      `${api}/v1/channels/${rejectId}/messages/${doomed.body["id"] as string}`,
+      { method: "DELETE", headers: { authorization: `Bearer ${credential}` } },
+    );
+    expect(
+      removed.status,
+      "chapter 3.17's delete refused its own message",
+    ).toBe(204);
+
+    const after = await get(
+      `/v1/channels/${rejectId}/messages?limit=10`,
+      credential,
+    );
+    const tombstone = (
+      after.body["messages"] as {
+        id: string;
+        text?: string | null;
+        attachments?: unknown[];
+      }[]
+    ).find((m) => m.id === (doomed.body["id"] as string));
+    expect(
+      tombstone?.text,
+      "chapter 3.17's tombstone keeps the row and loses the text, and this did not",
+    ).toBeNull();
+    expect(
+      tombstone?.attachments,
+      "chapter 3.17's tombstone left attachments behind",
+    ).toEqual([]);
+
+    // AND THE LINK IS REFUSED, INDISTINGUISHABLY FROM AN ID NOBODY HAS (chapter 4.12).
+    //
+    // Byte-identical apart from `request_id`, which is the property 4.12 built on
+    // purpose: a refusal naming the cause would report whether somebody else's object
+    // exists. **This is the first time it has been checked from outside with a real
+    // refusal behind it** — every earlier check set the state with SQL, so the two sides
+    // of the comparison were both fixtures.
+    const refused = await get(`/v1/media/${rejectedId}`, credential);
+    const ghost = await get(`/v1/media/${randomUUID()}`, credential);
+    expect(refused.status).toBe(404);
+    expect(ghost.status).toBe(404);
+    // FILTERED RATHER THAN DESTRUCTURED. `const { request_id: _ignored, ...rest }` is
+    // the idiomatic spelling and `no-unused-vars` refuses it here, underscore and all.
+    const withoutRequestId = (body: Record<string, unknown>) =>
+      Object.fromEntries(
+        Object.entries(body).filter(([key]) => key !== "request_id"),
+      );
+    expect(withoutRequestId(refused.body)).toEqual(
+      withoutRequestId(ghost.body),
+    );
+    // AND THE CONTROL, BECAUSE TWO EMPTY OBJECTS ARE ALSO EQUAL. The comparison above is
+    // worth nothing unless the bodies have content, and a refusal that dropped its code
+    // would satisfy it. Both fields are chapter 3.26's envelope.
+    expect(
+      refused.body["code"],
+      "chapter 3.26's error envelope lost its code",
+    ).toBe("not_found");
+    expect(
+      refused.body["request_id"],
+      "chapter 3.26's request_id is the one field that must differ",
+    ).not.toBe(ghost.body["request_id"]);
+  });
+
   /** T100a — **the first `socket.send` in this file's history.**
    *
    * `grep -c "\.send(" packages/outsider/src/integrate.itest.ts` read **0** across
    * eleven tests before this one: ten REST, and one socket test whose title says
    * "sent over REST" because the fan-out chapter corrected it. This file is the only
    * check in the repository that uses the public surface as a customer does —
```

## Chapter 4.18 — the audit log

### `eslint.config.mjs` — the audit suite's exemption, and it is the list's purest case — FR-004 needs two statements the repository cannot make.

```diff title="eslint.config.mjs"
@@ -98,12 +98,24 @@
     // AND THE QUOTA SUITE ITSELF, for a different reason from its sibling above.
     // `period.itest.ts` writes a row the repository cannot; this one READS the two
     // roll-up tables directly to check what a send left behind. Going through
     // `usageFor` would mean asserting the roll-up against the function that reads
     // it — the same circularity, one table over.
     "services/api/src/quotas/quotas.itest.ts",
+    // AND THE AUDIT LOG'S, WHICH IS THE EXEMPTION'S HONEST CASE IN ITS PUREST FORM: the
+    // state under test is one the repository CANNOT reach, and could not be made to.
+    // FR-004 says an entry must not be modifiable or removable by any path the platform
+    // exposes, and that the refusal must be DEMONSTRATED rather than asserted — so the
+    // test has to attempt an `UPDATE` and a `DELETE` on `audit_log`. There is no
+    // repository method for either and there must never be one; a route that does not
+    // exist proves nothing about a table. The attempt has to go through the driver or
+    // the requirement has no test at all.
+    //
+    // The suite's READS go through `db/audit-reads.ts` like the route's, so this
+    // exemption buys exactly the two statements it exists for.
+    "services/api/src/audit/audit.itest.ts",
     // AND THE CONNECTION-METERING CHAPTER'S, WHICH MAKES THE SAME CLAIM ONE
     // DIMENSION OVER: a credited minute survives a `FLUSHALL` of the counter store,
     // because a quota is about THIS MONTH and the rate limiter's store is allowed to
     // lose things. Proving that needs the flush, and the flush needs a raw client.
     //
     // LISTED RATHER THAN DODGED. Published's version reached for
```

### `services/api/src/app.module.ts` — `AuditModule` registered, because only a running app asks whether a module provides what it declares.

```diff title="services/api/src/app.module.ts"
@@ -26,12 +26,13 @@
 import { LOGGER, apiLogger } from "./logger";
 import { ProtocolErrorFilter } from "./protocol-error.filter";
 import { LimitsModule } from "./limits/limits.module";
 import { RateLimitMiddleware } from "./limits/rate-limit.middleware";
 import { RequestContextMiddleware } from "./request-context.middleware";
 import { RequestLogMiddleware, requestLogEnabled } from "./request-log/request-log.middleware";
+import { AuditModule } from "./audit/audit.module";
 import { RequestLogModule } from "./request-log/request-log.module";
 import { ANALYTICS_PUBLISHER } from "./webhooks/analytics";
 import { createJetStreamPublisher, ensureAnalyticsStream } from "./outbox/jetstream.publisher";
 import type { Publisher } from "./outbox/publisher";
 
 // The application described as a module graph — ADR-15's convention for the
@@ -53,12 +54,13 @@
     WebhooksModule,
     LimitsModule,
     // Chapter 4.8's read surface. Registered here for the reason `ChannelsModule` and
     // `UsersModule` are: without this line the module compiles, is imported by nothing,
     // and the route does not exist — which `pnpm build` would not notice and the
     // cross-tenant gauntlet would, because it derives its targets from the router.
+    AuditModule,
     RequestLogModule,
     // HOSTED MEDIA, AND THIS LINE IS THE WHOLE OF WHETHER THE ROUTE EXISTS. A module
     // written, tested and never registered gives a 404 that reads as a routing bug
     // rather than as a missing import — chapter 4.6's `Unknown chapter id`, one
     // repository over.
     MediaModule,
```

### `services/api/src/db/schema.ts` — the `audit_log` table, and the half of it drizzle cannot express.

```diff title="services/api/src/db/schema.ts"
@@ -1262,6 +1262,76 @@
     // precedent: it stays the size of the rendition population, not of the table.
     index("media_objects_parent_idx")
       .on(t.parentId)
       .where(sql`${t.parentId} IS NOT NULL`),
   ],
 );
+
+// THE AUDIT LOG (FR-MOD-03), AND THE ONLY TABLE HERE NOTHING CAN UPDATE OR DELETE.
+//
+// The immutability is a `BEFORE UPDATE OR DELETE` trigger in `0021_audit_log.sql` and it
+// cannot be expressed here — drizzle has no trigger vocabulary — so this declaration is
+// the half of the table a reader of this file sees, and the other half is the half that
+// matters. `REVOKE UPDATE, DELETE` would have been expressible and does nothing: the api
+// connects as a superuser, measured, which is why the mechanism is a trigger.
+export const auditLog = pgTable(
+  "audit_log",
+  {
+    id: uuid("id").primaryKey(),
+    environmentId: uuid("environment_id")
+      .notNull()
+      .references(() => environments.id),
+    // MILLISECOND, AND NOT THE DEFAULT MICROSECOND. The one place in this file where a
+    // precision is declared, because this is the platform's first keyset cursor over a
+    // Postgres timestamp. `toIso` emits `…083Z` and an undeclared column stores
+    // `…083489`, so a cursor minted from the transmitted value and compared against the
+    // column skips every row inside the lost fraction, at every page boundary. The other
+    // 40 `timestamptz` columns are precision 6 and the constitution asks for
+    // millisecond; that deviation is not this chapter's to repair, and this column is
+    // the one place it would cost a reader rows.
+    //
+    // AND IT IS `occurred_at`, NOT `created_at`, WHICH EVERY OTHER TABLE HERE USES.
+    // The two instants are identical by construction — the row is written inside the
+    // action's transaction — and that is exactly why the familiar name would mislead. A
+    // reader who sees `created_at` reasonably wonders whether the row could have been
+    // written after the action; it cannot. If a later chapter ever writes an entry
+    // outside the action's transaction, this name is what has to change, and that is the
+    // right place for the friction.
+    occurredAt: timestamp("occurred_at", {
+      withTimezone: true,
+      precision: 3,
+    }).notNull(),
+    actorKind: text("actor_kind").notNull(),
+    // NULL FOR A PLATFORM PRINCIPAL, which carries no tenant and so no identifier a
+    // tenant could read. A key id for an application credential, an external id for a
+    // user.
+    actorId: text("actor_id"),
+    // `METHOD /path`, the derived route's own key. One name for this column, the read
+    // route's filter and `audit/moderation-routes.ts`'s both-directions check.
+    action: text("action").notNull(),
+    targetKind: text("target_kind").notNull(),
+    // THE IDENTIFIER A CUSTOMER USES: an external id for a user, a uuid for a channel or
+    // a message, because those are what the routes take.
+    targetId: text("target_id").notNull(),
+    requestId: uuid("request_id").notNull(),
+  },
+  (t) => [
+    check(
+      "audit_log_actor_kind_check",
+      sql`${t.actorKind} IN ('application', 'user', 'platform')`,
+    ),
+    check(
+      "audit_log_target_kind_check",
+      sql`${t.targetKind} IN ('user', 'message', 'membership', 'channel')`,
+    ),
+    // THE READ ROUTE'S ONLY ACCESS PATH, AND THE TENANCY PREDICATE'S. The third column is
+    // the cursor's tiebreaker and it is not optional: `occurred_at` is not unique, and
+    // `request-log/reader.ts` already measured what a single-column keyset costs — "42
+    // `(environment_id, ts)` pairs in this lane hold more than one row; a `ts`-only
+    // comparison skips or repeats all 89 of them."
+    index("audit_log_read_idx").on(
+      t.environmentId,
+      t.occurredAt.desc(),
+      t.id.desc(),
+    ),
+  ],
+);
```

### `services/api/src/db/repository.ts` — the actor context, the private insert, and the eight actions that record — one of which gained a transaction, a guard and a `RETURNING` in the same change.

```diff title="services/api/src/db/repository.ts"
@@ -4,12 +4,13 @@
   and,
   asc,
   desc,
   eq,
   gt,
   inArray,
+  isNotNull,
   isNull,
   lt,
   ne,
   or,
   sql,
   type SQL,
@@ -22,16 +23,19 @@
 } from "@relay/protocol";
 
 import {
   DEFAULT_LIMITS,
   type LimitedOperation,
 } from "../limits/policy";
+import { RECORDS_NOTHING, type ActorContext } from "../audit/actor";
+import { ACTION } from "../audit/moderation-routes";
 import type { Db } from "./client";
 import {
   apiKeys,
   applications,
+  auditLog,
   channels,
   consumedEvents,
   environments,
   humans,
   members,
   mediaObjects,
@@ -2876,15 +2880,24 @@
 }
 
 export class Repository {
   // Constructor parameter properties — the shorthand chapter 1.4 released
   // for this service when ADR-15 spent erasableSyntaxOnly on decorator
   // metadata. The guarantee still holds in the gateway and every package.
+  //
+  // THE THIRD ARGUMENT IS OPTIONAL, AND THAT IS A MEASUREMENT RATHER THAN A PREFERENCE.
+  // Required, the compiler names every construction site — which is the property chapter
+  // 4.14 wanted and got — and here that is **110 sites across 32 test files**, 17 of them
+  // fenced across 131 pages, to give an actor to repositories that will never record
+  // anything. Optional, the compiler names none, so the check moves to a test that reads
+  // the source: an optional parameter is a check the compiler stopped doing, and
+  // `repository.itest.ts` is what replaces it.
   constructor(
     private readonly db: Db,
     private readonly environmentId: string,
+    private readonly actor?: ActorContext | typeof RECORDS_NOTHING,
   ) {}
 
   /** The environment this repository is scoped to, readable.
    *
    * EXPOSED SO A CALLER NEED NOT REACH FOR THE PRINCIPAL'S OPTIONAL CHAIN.
    * `req.principal?.environmentId ?? "unknown"` reads the same id and carries a branch
@@ -2907,12 +2920,77 @@
    * it five chapters earlier for the first. A deferral justified by a comment is a
    * deferral justified by one caller's opinion of why the code exists. */
   get environment(): string {
     return this.environmentId;
   }
 
+  /** Write one audit entry, inside the caller's transaction (FR-MOD-03, FR-005).
+   *
+   * Called by every recording method in this class — `banUser`, `unbanUser`,
+   * `deleteUser`, `removeMembers`, `setMemberRole`, `archiveChannel`,
+   * `unarchiveChannel` and `deleteMessage` — after each has established that its action
+   * changed something.
+   *
+   * `tx` IS THE ACTION'S OWN TRANSACTION AND THAT IS THE WHOLE OF FR-005. An entry
+   * committed separately from the action it describes is a log that can disagree with
+   * the platform, in both directions: an action with no entry if the second write fails,
+   * and an entry for an action that rolled back.
+   *
+   * IT WRITES NOTHING WHEN THERE IS NO ACTOR, AND THAT IS NOT A SILENT FAILURE — it is
+   * two things a check covers. A production `Repository` is built with an actor or with
+   * `RECORDS_NOTHING`, and `db/repository.itest.ts` reads the source of every
+   * construction site to say so, because the parameter is optional and the compiler
+   * stopped asking. A repository built with neither is a test's, and a test that means
+   * to exercise the log supplies one — `audit.itest.ts` asserts the entries appear, and
+   * asserts that a `RECORDS_NOTHING` repository writes none.
+   *
+   * The alternative was throwing, and it was costed rather than dismissed: 30 `new
+   * Repository(` sites across the eight test files that call a recording method would
+   * have to supply an actor to go on testing something else. That buys a second guard
+   * over the same property `repository.itest.ts` already guards, at four times the
+   * price, and every one of those sites is a file the fence chain publishes. */
+  /** The actor's kind, or `undefined` when this repository records nothing.
+   *
+   * Read by `deleteMessage` alone, which is the one action whose classification depends
+   * on the credential (FR-002a): a tenant key deleting somebody else's message is
+   * FR-MOD-02, a user deleting their own is chapter 3.23's FR-013, and a compliance log
+   * that recorded the second would fill with ordinary user activity. */
+  private get actorKind(): ActorContext["kind"] | undefined {
+    const actor = this.actor;
+    return actor === undefined || actor === RECORDS_NOTHING
+      ? undefined
+      : actor.kind;
+  }
+
+  private async recordAction(
+    tx: Pick<Db, "insert">,
+    entry: {
+      action: string;
+      targetKind: "user" | "message" | "membership" | "channel";
+      targetId: string;
+    },
+  ): Promise<void> {
+    const actor = this.actor;
+    if (actor === undefined || actor === RECORDS_NOTHING) return;
+    await tx.insert(auditLog).values({
+      id: randomUUID(),
+      environmentId: this.environmentId,
+      // `new Date()` AND NOT `sql`now()``, which every other write in this class uses
+      // for a timestamp. `now()` is the transaction's start instant, so a long
+      // transaction would date the entry before the action it records — and the column
+      // is millisecond-precision expressly so the read route's cursor can trust it.
+      occurredAt: new Date(),
+      actorKind: actor.kind,
+      actorId: actor.id,
+      action: entry.action,
+      targetKind: entry.targetKind,
+      targetId: entry.targetId,
+      requestId: actor.requestId,
+    });
+  }
+
   // ---------------------------------------------------------------------
   // Hosted media. The slot's whole database half, in one method, because the
   // check reads what the insert writes.
   // ---------------------------------------------------------------------
 
   /** Reserve a slot, or report why not.
@@ -3547,37 +3625,75 @@
    * `now()` FROM THE DATABASE rather than the app clock, because nothing compares
    * this timestamp against another statement's value. `sendMessage` takes its period
    * from the app clock for the opposite reason: two statements there need the same
    * value and only one of them can be `now()`.
    */
   async archiveChannel(channelId: string): Promise<boolean> {
-    const updated = await this.db
-      .update(channels)
-      .set({ archivedAt: sql`now()` })
-      .where(
-        and(
-          eq(channels.id, channelId),
-          eq(channels.environmentId, this.environmentId),
-        ),
-      )
-      .returning({ id: channels.id });
-    return updated.length > 0;
+    // FR-005a's EXCEPTION, THE THIRD AND FOURTH TIME. Neither of this pair had a
+    // transaction and neither needed one for itself; both need one so the entry commits
+    // with the change. The answers are unchanged.
+    return this.db.transaction(async (tx) => {
+      const updated = await tx
+        .update(channels)
+        .set({ archivedAt: sql`now()` })
+        .where(
+          and(
+            eq(channels.id, channelId),
+            eq(channels.environmentId, this.environmentId),
+          ),
+        )
+        .returning({ id: channels.id });
+      if (updated.length === 0) return false;
+
+      // FR-MOD-03. The target is the channel's uuid, which is what the route takes and
+      // therefore what a customer already has — no threading, unlike the user cases.
+      //
+      // ARCHIVING AN ARCHIVED CHANNEL WRITES AN ENTRY, for the reason the comment above
+      // gives for the boolean: this write is idempotent BY THE WRITE, so the statement
+      // really did affect a row. The mechanical rule is uniform across the eight actions
+      // and this is the case where it is most visibly a choice.
+      await this.recordAction(tx, {
+        action: ACTION.archiveChannel,
+        targetKind: "channel",
+        targetId: channelId,
+      });
+      return true;
+    });
   }
 
   async unarchiveChannel(channelId: string): Promise<boolean> {
-    const updated = await this.db
-      .update(channels)
-      .set({ archivedAt: null })
-      .where(
-        and(
-          eq(channels.id, channelId),
-          eq(channels.environmentId, this.environmentId),
-        ),
-      )
-      .returning({ id: channels.id });
-    return updated.length > 0;
+    // FR-005a's EXCEPTION, THE THIRD AND FOURTH TIME. Neither of this pair had a
+    // transaction and neither needed one for itself; both need one so the entry commits
+    // with the change. The answers are unchanged.
+    return this.db.transaction(async (tx) => {
+      const updated = await tx
+        .update(channels)
+        .set({ archivedAt: null })
+        .where(
+          and(
+            eq(channels.id, channelId),
+            eq(channels.environmentId, this.environmentId),
+          ),
+        )
+        .returning({ id: channels.id });
+      if (updated.length === 0) return false;
+
+      // FR-MOD-03. The target is the channel's uuid, which is what the route takes and
+      // therefore what a customer already has — no threading, unlike the user cases.
+      //
+      // ARCHIVING AN ARCHIVED CHANNEL WRITES AN ENTRY, for the reason the comment above
+      // gives for the boolean: this write is idempotent BY THE WRITE, so the statement
+      // really did affect a row. The mechanical rule is uniform across the eight actions
+      // and this is the case where it is most visibly a choice.
+      await this.recordAction(tx, {
+        action: ACTION.unarchiveChannel,
+        targetKind: "channel",
+        targetId: channelId,
+      });
+      return true;
+    });
   }
 
   /** Set a member's role (FR-011).
    *
    * SCOPED THROUGH THE CHANNEL, like every other write to `members`: that table
    * carries no `environment_id`, so the `EXISTS` is what keeps another tenant's rows
@@ -3598,26 +3714,49 @@
    * where somebody will look for it: a reader who sees add and remove producing
    * events will otherwise assume a `PATCH` does too, and find silence. */
   async setMemberRole(
     channelId: string,
     userId: string,
     role: string,
+    userExternalId: string,
   ): Promise<"set" | "not_a_member"> {
-    const updated = await this.db
-      .update(members)
-      .set({ role })
-      .where(
-        and(
-          eq(members.channelId, channelId),
-          eq(members.userId, userId),
-          sql`EXISTS (SELECT 1 FROM channels c WHERE c.id = ${channelId}
+    // THE TRANSACTION IS FR-005a's EXCEPTION, TAKEN A SECOND TIME. This method had none
+    // and did not need one for its own sake; it needs one so the entry and the role
+    // change commit together. The answer it returns is unchanged.
+    return this.db.transaction(async (tx) => {
+      const updated = await tx
+        .update(members)
+        .set({ role })
+        .where(
+          and(
+            eq(members.channelId, channelId),
+            eq(members.userId, userId),
+            sql`EXISTS (SELECT 1 FROM channels c WHERE c.id = ${channelId}
                        AND c.environment_id = ${this.environmentId})`,
-        ),
-      )
-      .returning({ userId: members.userId });
-    return updated.length > 0 ? "set" : "not_a_member";
+          ),
+        )
+        .returning({ userId: members.userId });
+      if (updated.length === 0) return "not_a_member";
+
+      // FR-MOD-03. THE EXTERNAL ID IS THREADED HERE AND IT IS THE ONLY PLACE IT HAD TO
+      // BE: this `RETURNING` carries a uuid, because unlike the ban and the removal this
+      // method emits no customer-facing event and never needed the other identifier.
+      //
+      // AND SETTING THE ROLE A MEMBER ALREADY HOLDS WRITES AN ENTRY. The no-op rule in
+      // this chapter is mechanical — did the write statement affect a row — and here it
+      // did. Knowing whether the VALUE changed would need a SELECT inside the write
+      // transaction, which is the query `deleteMessage` argues against paying on every
+      // call, and the softer reading is defensible anyway: the moderator performed the
+      // action and the platform carried it out.
+      await this.recordAction(tx, {
+        action: ACTION.setMemberRole,
+        targetKind: "membership",
+        targetId: `${channelId}/${userExternalId}`,
+      });
+      return "set";
+    });
   }
 
   /** One member's role, or null when there is no membership. Used by the tests that
    * assert the default rather than reading it out of the DDL. */
   async memberRole(channelId: string, userId: string): Promise<string | null> {
     const rows = await this.db
@@ -3730,12 +3869,34 @@
         membership: { channel_id: channelId, user: row.userExternalId },
       });
       await tx.insert(outbox).values({
         subject: event.subject,
         payload: event.payload,
       });
+
+      // FR-MOD-03, IN THE SAME LOOP AND FOR THE SAME REASON. One entry per member the
+      // `RETURNING` gave back, so a bulk call naming five of which two were not members
+      // writes three — the no-op rule applied per member rather than per request.
+      //
+      // AND THE EXTERNAL ID WAS ALREADY HERE, which is the second time in this chapter.
+      // The plan had it threaded in from `channels.service.ts`, which does hold it; this
+      // method's `RETURNING` has carried a `external_id` subquery since the membership
+      // chapter, because the event one line up publishes the member as a customer sees
+      // them. **A method that already emits a customer-visible event already holds
+      // customer-visible identifiers**, and that is what the threading survey should
+      // have asked.
+      //
+      // THE TARGET IS THE MEMBERSHIP, WHICH IS A PAIR, so the id is the two identifiers
+      // the route carries with a slash between them. Unambiguous whatever the external
+      // id contains — a uuid is 36 characters and cannot hold a slash, so the first one
+      // is always the separator.
+      await this.recordAction(tx, {
+        action: ACTION.removeMember,
+        targetKind: "membership",
+        targetId: `${channelId}/${row.userExternalId}`,
+      });
     }
 
     await tx
       .delete(readPositions)
       .where(
         and(
@@ -4051,12 +4212,28 @@
       // ONLY WHEN A ROW WAS UPDATED. `isNull(users.bannedAt)` already makes a re-ban
       // touch nothing, so without this guard every repeated ban would emit a full set
       // of events for a state that did not change (FR-005).
       if (banned.length === 0) return [];
       const externalId = banned[0]!.externalId;
 
+      // FR-MOD-03, AFTER THE GUARD AND INSIDE THE SAME TRANSACTION. After, because an
+      // action that changed nothing earns no entry and `isNull(users.bannedAt)` above is
+      // what makes a re-ban change nothing — the same guard that already stops the
+      // events. Inside, because FR-005 wants the entry and the ban to commit or roll
+      // back together.
+      //
+      // AND THE EXTERNAL ID WAS ALREADY HERE. The chapter's plan said this method would
+      // have to be given it, on the reasoning that `setBanned` resolves the user and
+      // hands over a uuid. It does — and the `RETURNING` three lines up reads the
+      // external id back out, for the membership events. Nothing was threaded.
+      await this.recordAction(tx, {
+        action: ACTION.ban,
+        targetKind: "user",
+        targetId: externalId,
+      });
+
       const channelRows = await tx
         .select({ channelId: members.channelId })
         .from(members)
         .where(eq(members.userId, userId));
 
       const occurredAt = new Date().toISOString();
@@ -4074,19 +4251,55 @@
         });
       }
       return channelRows.map((r) => r.channelId);
     });
   }
 
+  /** Lift a ban (FR-032), and record it (FR-MOD-03).
+   *
+   * THREE THINGS CHANGED HERE AND THEY ARE ONE CHANGE. Before this chapter the method
+   * was a bare `update` with no transaction, no `RETURNING` and no `isNull` guard — so
+   * lifting a real ban and unbanning somebody who was never banned were the same call
+   * with the same answer, `void`. It could not tell whether it had done anything, which
+   * is the one question FR-008 asks of every recording action.
+   *
+   * `isNotNull(bannedAt)` IS THE GUARD, and it is `banUser`'s in the mirror: that method
+   * has had `isNull(bannedAt)` since the ban chapter, for exactly this reason, and the
+   * pair was asymmetric for no recorded reason. The entry now follows the same rule as
+   * the ban's — an unban that lifted nothing writes nothing.
+   *
+   * THE TRANSACTION IS FR-005a's EXCEPTION, TAKEN DELIBERATELY. FR-012 says this chapter
+   * adds no transaction to an action that lacked one; four actions could not satisfy
+   * both clauses and this is the first. What it buys is the entry committing with the
+   * action. What it costs is a new way to fail, and the answer this method returns is
+   * unchanged — `void` then, `void` now — so no caller sees a difference.
+   *
+   * THE EXTERNAL ID COMES FROM THE `RETURNING`, not from a threaded parameter. The
+   * chapter's plan had it threaded from `users.service.ts`; once the method needed a
+   * `RETURNING` anyway, the column was already coming back. */
   async unbanUser(userId: string): Promise<void> {
-    await this.db
-      .update(users)
-      .set({ bannedAt: null })
-      .where(
-        and(eq(users.id, userId), eq(users.environmentId, this.environmentId)),
-      );
+    await this.db.transaction(async (tx) => {
+      const lifted = await tx
+        .update(users)
+        .set({ bannedAt: null })
+        .where(
+          and(
+            eq(users.id, userId),
+            eq(users.environmentId, this.environmentId),
+            isNotNull(users.bannedAt),
+          ),
+        )
+        .returning({ externalId: users.externalId });
+
+      if (lifted.length === 0) return;
+      await this.recordAction(tx, {
+        action: ACTION.unban,
+        targetKind: "user",
+        targetId: lifted[0]!.externalId,
+      });
+    });
   }
 
   /** Delete a user, keeping the row (FR-027, FR-028, FR-029).
    *
    * WHAT GOES: the profile fields, the memberships, the read positions.
    * WHAT STAYS: the row, the messages, and every `usage_active_users` row.
@@ -4105,13 +4318,13 @@
    * membership does: a position is per-member state keyed by channel and user, so keeping
    * it would leave a row pointing at a membership that no longer exists. It is the same
    * deletion the member-removal path already performs.
    *
    * IDEMPOTENT, and it reports which happened, so the route can answer 200 twice while a
    * user who never existed still gets 404. */
-  async deleteUser(userId: string): Promise<boolean> {
+  async deleteUser(userId: string, userExternalId: string): Promise<boolean> {
     return this.db.transaction(async (tx) => {
       const [alive] = await tx
         .select({ id: users.id, deletedAt: users.deletedAt })
         .from(users)
         .where(
           and(eq(users.id, userId), eq(users.environmentId, this.environmentId)),
@@ -4145,12 +4358,31 @@
           displayName: null,
           avatarUrl: null,
           metadata: {},
           deletedAt: alive.deletedAt ?? new Date(),
         })
         .where(eq(users.id, userId));
+
+      // FR-MOD-03, AND THE NO-OP TEST IS NOT THIS METHOD'S RETURN VALUE.
+      //
+      // `deleteUser` answers `true` for a user it just deleted AND for one already
+      // deleted — the `?? new Date()` above keeps the original instant, so the second
+      // call changes nothing and still reports `true`. The boolean means "a row
+      // existed", which is what the route needs to tell 200 from 404; it does not mean
+      // "something changed". Chapter 4.18's own phase-2 survey read it as the no-op
+      // discriminator and was wrong.
+      //
+      // `alive.deletedAt` is the discriminator. A second deletion writes no entry, for
+      // the same reason a re-ban writes none.
+      if (alive.deletedAt === null) {
+        await this.recordAction(tx, {
+          action: ACTION.deleteUser,
+          targetKind: "user",
+          targetId: userExternalId,
+        });
+      }
       return true;
     });
   }
 
   /** Write a user's profile (FR-023, FR-024).
    *
@@ -5406,12 +5638,31 @@
       });
       await tx.insert(outbox).values({
         subject: event.subject,
         payload: event.payload,
       });
 
+      // FR-MOD-03, AND ONLY WHEN A TENANT KEY DID IT (FR-002a). This is the one route
+      // whose classification the credential decides: `moderation-when-application`.
+      //
+      // THE CONDITION IS THE ACTOR'S KIND, NOT `userId === undefined`. The two agree
+      // today — the controller passes the user only for a user token — but they are
+      // different claims, and the one the audit log is entitled to is who authenticated
+      // the request. Reading the parameter would make the entry depend on a calling
+      // convention rather than on a credential.
+      //
+      // On this branch only, like the event above: a repeated deletion returned before
+      // reaching here, so a client retrying a 204 writes no second entry.
+      if (this.actorKind === "application") {
+        await this.recordAction(tx, {
+          action: ACTION.deleteMessage,
+          targetKind: "message",
+          targetId: messageId,
+        });
+      }
+
       return {
         deleted: {
           id: row.id,
           channel_id: channelId,
           seq: row.seq,
           text: null,
```

### `services/api/src/db/repository.itest.ts` — the source walk that replaces a check the compiler stopped doing, and the two defects it found in itself.

```diff title="services/api/src/db/repository.itest.ts"
@@ -1,7 +1,9 @@
 import { randomUUID } from "node:crypto";
+import { readdirSync, readFileSync } from "node:fs";
+import { join } from "node:path";
 
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 import { sql } from "drizzle-orm";
 
 import { createDb, createPool, DEFAULT_DATABASE_URL, type Db } from "./client";
 import { migrate } from "./migrate";
@@ -303,13 +305,13 @@
 
     // The constraint name is in the CAUSE, not the message: drizzle's top-level
     // text is "Failed query: update …" and the driver's error underneath it carries
     // `constraint`. Asserting on the wrapper's message would have passed for any
     // failed update at all — including one that failed for the wrong reason.
     const error = await repoA
-      .setMemberRole(channel.id, user.id, "admin")
+      .setMemberRole(channel.id, user.id, "admin", user.external_id)
       .then(() => null)
       .catch((e: unknown) => e);
     expect(error).toBeInstanceOf(Error);
     const chain = JSON.stringify({
       message: (error as Error).message,
       cause: String((error as { cause?: unknown }).cause ?? ""),
@@ -324,13 +326,18 @@
     // something: a constraint that refused BOTH words would pass the assertion
     // above while being just as wrong.
     const channel = await repoA.createChannel("role-check-ok", "public");
     const user = await repoA.createUser("role-check-ok-user");
     await repoA.addMember(channel.id, user.id);
 
-    expect(await repoA.setMemberRole(channel.id, user.id, "moderator")).toBe("set");
+    expect(await repoA.setMemberRole(
+        channel.id,
+        user.id,
+        "moderator",
+        user.external_id,
+      )).toBe("set");
     expect(await repoA.memberRole(channel.id, user.id)).toBe("moderator");
   });
 
   it("gives a member created without a role the column's default", async () => {
     const channel = await repoA.createChannel("role-default", "public");
     const user = await repoA.createUser("role-default-user");
@@ -582,18 +589,18 @@
 // IN-PROCESS ON PURPOSE (T174b). Five of this feature's tests drive new repository code
 // through the gateway's api CHILD PROCESS, whose coverage is not attributable. The webhook dispatcher chapter
 // added six operations to this file the same way and branches went 85.91% → 78.22% on the
 // next run: the instrument was right and the code was untested.
 describe("the repository's own refusals", () => {
   it("returns false when deleting a user that does not exist", async () => {
-    expect(await repoA.deleteUser("00000000-0000-4000-8000-000000000000")).toBe(false);
+    expect(await repoA.deleteUser("00000000-0000-4000-8000-000000000000", "nobody")).toBe(false);
   });
 
   it("returns null when patching a deleted user's profile", async () => {
     const doomed = await repoA.createUser("arm-patch-deleted", "Doomed");
-    await repoA.deleteUser(doomed.id);
+    await repoA.deleteUser(doomed.id, "arm-patch-deleted");
     // The route answers 404 before reaching this, because `requireUser` reads the marker.
     // One layer down, the `isNull(deletedAt)` in the WHERE is what refuses.
     expect(await repoA.updateUserProfile(doomed.id, { display_name: "nope" })).toBeNull();
     // And the same for an empty patch, which takes the other branch entirely — no UPDATE
     // is issued, so the refusal comes from the SELECT.
     expect(await repoA.updateUserProfile(doomed.id, {})).toBeNull();
@@ -849,13 +856,13 @@
     const channel = await repoA.createChannel("t036b", "public");
     await repoA.addMember(channel.id, author.id);
     const sent = await repoA.sendMessage(channel.id, { text: "before", userId: author.id });
     await repoA.editMessage(channel.id, sent.id, { text: "after", userId: author.id });
 
     await repoA.archiveChannel(channel.id);
-    await repoA.deleteUser(author.id);
+    await repoA.deleteUser(author.id, author.external_id);
 
     // `message_edits` references the MESSAGE, and both of those operations keep their
     // rows — the archive sets a timestamp (FR-020) and a user deletion is a
     // tombstone too (FR-USR-05). A cascade on either would take the history with it.
     const edits = await repoA.listMessageEdits(channel.id, sent.id);
     expect(edits.map((e) => e.prior_text)).toEqual(["before"]);
@@ -1671,6 +1678,137 @@
     // A TEST-ONLY HELPER WITH FIVE CALL SITES, all in `idempotency.itest.ts`, which count
     // rows and read text. An exact key set rather than a negative check: this is what
     // stops the helper growing a column nobody asked for.
     expect(Object.keys(rows[0]!).sort()).toEqual(["id", "seq", "text"]);
   });
 });
+
+// ---------------------------------------------------------------------------
+// FR-MOD-03 — what the compiler stopped checking when the actor became optional.
+//
+// `Repository`'s third argument is optional and chapter 4.18 measured why: required, the
+// compiler names every construction site, and here that is 110 of them across 32 test
+// files, 17 fenced across 131 pages, to hand an actor to repositories that will never
+// record anything. The cost of optional is that a production site can forget, and a
+// repository built without an actor writes entries with no actor and nothing says so.
+//
+// So the check moves here, and it is structural for the reason 4.4's guard walker is:
+// a behavioural test cannot catch a construction site that does not exist yet.
+//
+// THE ASSERTION READS "OR" BECAUSE ONE SITE LEGITIMATELY RECORDS NOTHING.
+// `auth/dev-token.controller.ts` mints a credential and performs no moderation action.
+// Demanding context from all of them would be satisfied only by an exemption list, which
+// is what `RECORDS_NOTHING` exists to avoid — the absence is a value a check can read.
+// ---------------------------------------------------------------------------
+describe("every production Repository is built with an actor", () => {
+  // ASK THE TREE, DO NOT RESTATE IT. A list of construction sites written here goes
+  // stale the day somebody adds one, and the test keeps passing — which is the failure
+  // this block exists to prevent, reproduced inside its own assertion. 4.4's precedent.
+  const walk = (dir: string): string[] =>
+    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
+      e.isDirectory()
+        ? walk(join(dir, e.name))
+        : e.name.endsWith(".ts") &&
+            !e.name.includes(".test.") &&
+            !e.name.includes(".itest.")
+          ? [join(dir, e.name)]
+          : [],
+    );
+
+  /** Every `new Repository(` outside a test file, with the argument list that follows
+   * it — to the closing paren of the call, across however many lines prettier wrapped
+   * it onto. Chapter 4.16 found that matching a formatter-owned file by the text you
+   * last wrote matches nothing; this reads the call, not a line. */
+  /** A file with its comments blanked, same length, so offsets still line up.
+   *
+   * BECAUSE THE SCAN MATCHED ITS OWN DOCUMENTATION. `audit/actor.ts` has a comment
+   * saying that this test "reads every production `new Repository(`", and the first
+   * version of this scan found that sentence and demanded three arguments of it. An
+   * instrument that reads prose as code reports a defect in the paragraph describing
+   * itself. Blanked rather than deleted so a future failure's offsets are still the
+   * file's. */
+  const decommented = (src: string): string =>
+    src
+      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
+      .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
+
+  const sites = (): { file: string; call: string }[] => {
+    const out: { file: string; call: string }[] = [];
+    for (const file of walk(join(__dirname, ".."))) {
+      const src = decommented(readFileSync(file, "utf8"));
+      for (let i = src.indexOf("new Repository("); i !== -1; i = src.indexOf("new Repository(", i + 1)) {
+        let depth = 0;
+        let end = i + "new Repository".length;
+        for (; end < src.length; end++) {
+          if (src[end] === "(") depth++;
+          else if (src[end] === ")" && --depth === 0) break;
+        }
+        out.push({ file, call: src.slice(i, end + 1) });
+      }
+    }
+    return out;
+  };
+
+  it("finds the construction sites it claims to police", () => {
+    // A scan that finds nothing passes vacuously, and five gate scripts in this project
+    // have exited 0 on an absent corpus. Assert the count, not the loop.
+    expect(sites().length).toBeGreaterThan(3);
+  });
+
+  /** The call's top-level arguments, with comments removed first.
+   *
+   * COUNTING ARGUMENTS, NOT MATCHING A WORD. The first version of this test asked
+   * whether the call text mentioned `actor` or `RECORDS_NOTHING`, and it was wrong in
+   * both directions: `actorFrom(req)` has no word boundary after `actor`, so every
+   * module failed, and a comment inside the call saying the word would have satisfied it
+   * — which `isolation/fixtures.ts` actually contains. A third argument is a structural
+   * fact and a comment cannot be one. */
+  const args = (call: string): string[] => {
+    const body = call
+      .slice(call.indexOf("(") + 1, call.lastIndexOf(")"))
+      .replace(/\/\*[\s\S]*?\*\//g, "")
+      .replace(/\/\/[^\n]*/g, "");
+    const out: string[] = [];
+    let depth = 0;
+    let cur = "";
+    for (const ch of body) {
+      if ("([{".includes(ch)) depth++;
+      else if (")]}".includes(ch)) depth--;
+      if (ch === "," && depth === 0) {
+        out.push(cur);
+        cur = "";
+      } else cur += ch;
+    }
+    if (cur.trim() !== "") out.push(cur);
+    return out.map((a) => a.trim()).filter((a) => a !== "");
+  };
+
+  it("gives each one an actor or the named absence", () => {
+    for (const { file, call } of sites()) {
+      expect(
+        args(call).length,
+        `${file} builds a Repository with no actor context`,
+      ).toBe(3);
+    }
+  });
+
+  it("does not read its own documentation as a construction site", () => {
+    // The control for the blanking above. Both halves: a call inside a comment is not a
+    // site, and a real call still is.
+    expect(decommented('// see `new Repository(db, env)`')).not.toContain(
+      "new Repository(",
+    );
+    expect(decommented("const r = new Repository(db, env, a);")).toContain(
+      "new Repository(",
+    );
+    // and the line structure survives, so a reported offset is still the file's
+    expect(decommented("a\n/* x */\nb").split("\n")).toHaveLength(3);
+  });
+
+  it("can tell a comment from an argument", () => {
+    // The control for the paragraph above: the shape that fooled the first version must
+    // not fool this one.
+    expect(args('new Repository(db, env, /* actor */)')).toHaveLength(2);
+    expect(args('new Repository(db, env, actorFrom(req))')).toHaveLength(3);
+    expect(args('new Repository(\n  db,\n  env,\n  // RECORDS_NOTHING\n)')).toHaveLength(2);
+  });
+});
```

### `services/api/src/isolation/targets.ts` — `GET /v1/audit-log`, and the derivation found it before the list did — the eighth time.

```diff title="services/api/src/isolation/targets.ts"
@@ -443,12 +443,31 @@
   // `accepts: "application"` MATCHES THE DECORATOR AND THE TWO ARE NOT COMPARED BY
   // ANYTHING. The controller declares `@Accepts("application")`; this field tells the
   // gauntlet which credential to attack with, so a `"user"` here would send it at the
   // route with a token the guard refuses at the door and the handler would never run.
   { method: "GET", path: "/v1/request-log", accepts: "application", shape: "list" },
 
+  // ── THE AUDIT LOG (chapter 4.18, FR-MOD-03), AND THE DERIVATION FOUND IT FIRST AGAIN ──
+  //
+  // Run before this entry existed: `47 derived, 39 attacked, 8 exempt` with
+  // `unclassified: ["GET /v1/audit-log"]`. Eighth time, and the list has still never been
+  // ahead of the derivation.
+  //
+  // `list`, AND `application` FOR THE REQUEST LOG'S REASON. The controller declares
+  // `@Accepts("application")`; this field tells the gauntlet which credential to attack
+  // with, so `"user"` here would send it at the route with a token the guard refuses at
+  // the door and the handler would never run.
+  //
+  // AND THE ATTACK HAS TO PLANT ITS OWN ROWS, like the request log's and for a sharper
+  // version of the same reason: an audit log is empty until somebody moderates, so on a
+  // fresh lane both tenants' logs hold nothing and an empty page passes a leak check
+  // without the route having been asked anything. The attack bans a throwaway user in
+  // each environment over HTTP first, which exercises the write path rather than planting
+  // rows behind it.
+  { method: "GET", path: "/v1/audit-log", accepts: "application", shape: "list" },
+
   // ── THE UPLOAD SLOT (chapter 4.10, FR-MED-01), AND THE DERIVATION FOUND IT EIGHTH ──
   //
   // Run before this entry existed: `44 derived, 37 attacked, 6 exempt` with
   // `unclassified: ["POST /v1/media"]`. Eight chapters, eight times, and the list has
   // never once been ahead of the derivation.
   //
```

### `services/api/src/isolation/fixtures.ts` — test support that lives in `src/`, so the source walk reads it as production — correctly.

```diff title="services/api/src/isolation/fixtures.ts"
@@ -1,6 +1,7 @@
+import { RECORDS_NOTHING } from "../audit/actor";
 import { createApiKey, createEnvironment, Repository } from "../db/repository";
 import { encryptSecret, mintSigningSecret } from "../webhooks/secret";
 
 import type { Db } from "../db/client";
 
 /** Two tenants, so every attack has a victim and an attacker.
@@ -49,13 +50,23 @@
   victim: Tenant;
 }
 
 async function seedTenant(db: Db, label: string): Promise<Tenant> {
   const environment = await createEnvironment(db, { name: `isolation-${label}` });
   const key = await createApiKey(db, { environmentId: environment.id });
-  const repo = new Repository(db, environment.id);
+  const repo = new Repository(
+    db,
+    environment.id,
+    // `RECORDS_NOTHING` (FR-MOD-03). This file is test support that lives in `src/`
+    // rather than in a `.itest.ts`, so the source walk in `db/repository.itest.ts`
+    // reads it as a production site — correctly, because a check that trusted a
+    // filename would be an exemption list with extra steps. These fixtures plant
+    // rows and perform no moderation action, so there is no actor to supply and the
+    // absence is stated rather than left to be inferred.
+    RECORDS_NOTHING,
+  );
 
   const userExternalId = `${label}-user`;
   const user = await repo.createUser(userExternalId, `${label} user`);
   const channelExternalId = `${label}-channel`;
   // A BOT PER TENANT. Every attack in the gauntlet presents a KEY, and a
   // key send names a bot — so each tenant needs one of its own, or an attack would be
@@ -143,13 +154,13 @@
 }
 
 export async function seedSameTenant(db: Db, mintToken: MintToken): Promise<SameTenant> {
   const stamp = Math.random().toString(36).slice(2, 8);
   const environment = await createEnvironment(db, { name: `iso-same-${stamp}` });
   const key = await createApiKey(db, { environmentId: environment.id });
-  const repo = new Repository(db, environment.id);
+  const repo = new Repository(db, environment.id, RECORDS_NOTHING);
 
   const member = await repo.createUser(`same-${stamp}-member`, "A Member");
   const stranger = await repo.createUser(`same-${stamp}-stranger`, "A Stranger");
   const privateChannel = await repo.createChannel(`same-${stamp}-private`, "private");
   const publicChannel = await repo.createChannel(`same-${stamp}-public`, "public");
   await repo.addMember(privateChannel.id, member.id);
@@ -219,13 +230,13 @@
   const stamp = Math.random().toString(36).slice(2, 8);
   const sharedExternalId = `collide-${stamp}`;
 
   const seed = async (label: string, type: "public" | "private") => {
     const environment = await createEnvironment(db, { name: `iso-collide-${label}-${stamp}` });
     const key = await createApiKey(db, { environmentId: environment.id });
-    const repo = new Repository(db, environment.id);
+    const repo = new Repository(db, environment.id, RECORDS_NOTHING);
     const userExternalId = `collide-${label}-${stamp}-user`;
     const user = await repo.createUser(userExternalId);
     // THE SAME external id in both environments. `DR-02` makes it unique per
     // environment, which is exactly the property under test.
     const channel = await repo.createChannel(sharedExternalId, type);
     // The `public` tenant's user is deliberately NOT a member either: this fixture
```

### `services/api/src/isolation/attack.ts` — `rowsOf` meets its third envelope, which is the whole cost of keeping the table rather than deriving it.

```diff title="services/api/src/isolation/attack.ts"
@@ -148,17 +148,25 @@
  *
  * WHAT THE FAILURE READS LIKE IS THE ONE REAL COST. An unrecognised shape fails as *"the
  * attacker's own listing came back empty"*, which names a symptom and not the cause. The
  * test below is what turns that into a sentence about the recogniser. */
 export function rowsOf(body: unknown): unknown[] {
   if (Array.isArray(body)) return body;
-  const shaped = body as { data?: unknown; requests?: unknown } | null;
+  const shaped = body as {
+    data?: unknown;
+    requests?: unknown;
+    entries?: unknown;
+  } | null;
   if (Array.isArray(shaped?.data)) return shaped.data;
   // Chapter 4.8's envelope: the array is named for the resource, as
   // `messages.service.ts` names its own. R23 refused `rows` for being a storage word.
   if (Array.isArray(shaped?.requests)) return shaped.requests;
+  // AND CHAPTER 4.18's, WHICH IS THE THIRD TIME THIS FUNCTION HAS MET A NEW ONE. Adding
+  // the name is the whole cost of keeping the table rather than deriving it, and 4.8
+  // measured what deriving it costs instead — a false pass on any array in the body.
+  if (Array.isArray(shaped?.entries)) return shaped.entries;
   return [];
 }
 
 export async function listAttack(
   baseUrl: string,
   credential: string,
```

### `services/api/src/isolation/attack.test.ts` — and the `requests` arm had no test at all, found while adding one for `entries`.

```diff title="services/api/src/isolation/attack.test.ts"
@@ -59,12 +59,20 @@
   });
 
   it("reads a paginated envelope", () => {
     expect(rowsOf({ data: [1, 2], next_cursor: "x" })).toEqual([1, 2]);
   });
 
+  it("reads each envelope the platform actually serves, by name", () => {
+    // ONE PER NAMED ARM, AND THE `requests` ARM HAD NO TEST AT ALL until chapter 4.18
+    // came to add a third. Every arm here is one a `list` attack depends on, and an arm
+    // nothing drives is an arm that can be deleted or mistyped without a word.
+    expect(rowsOf({ requests: [1, 2], has_more: false })).toEqual([1, 2]);
+    expect(rowsOf({ entries: [1], has_more: false })).toEqual([1]);
+  });
+
   it("returns nothing for a shape it does not recognise", () => {
     // The arm that matters. Zero rows from an unknown shape looks exactly like
     // zero rows from a correctly-scoped list, and only one of those is a pass.
     expect(rowsOf({ code: "not_found" })).toEqual([]);
     expect(rowsOf(null)).toEqual([]);
     expect(rowsOf("an html error page")).toEqual([]);
```

### `services/api/src/isolation/gauntlet.itest.ts` — the attack that plants its rows through the product rather than behind it.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -24,12 +24,13 @@
   nowhereId,
   seedCollidingTenants,
   seedSameTenant,
   seedTwoTenants,
   type CollidingTenants,
   type SameTenant,
+  type Tenant,
   type TwoTenants,
 } from "./fixtures";
 import { periodOf } from "../quotas/period";
 import { CLASSIFICATIONS, targetKey } from "./targets";
 
 import type { Db } from "../db/client";
@@ -1356,12 +1357,67 @@
       // AND ITS OWN ROW IS THERE. A listing that returned nothing at all would pass the
       // leak check while being broken, which is the `list` shape's own trap — and here it
       // is not hypothetical, because a log with no ingester behind it really is empty.
       expect(verdict.count, "the attacker's own log came back empty").toBeGreaterThan(0);
     });
 
+    /** GET /v1/audit-log (chapter 4.18, FR-MOD-03, FR-006).
+     *
+     * AND THIS ONE PLANTS ITS ROWS THROUGH THE PRODUCT, not behind it. The request log's
+     * attack has to `INSERT` because nothing in the composed stack writes to that table
+     * (no ingester runs, `gaps.md` 050-8). An audit entry has a writer right here: a ban
+     * over HTTP produces one, so the plant exercises the whole path the leak check is
+     * about — credential to principal to actor to row — instead of asserting isolation
+     * over rows the api never wrote.
+     *
+     * A THROWAWAY USER IN EACH ENVIRONMENT, not the fixture's own. Banning
+     * `t.attacker.userExternalId` would leave a banned user behind for whatever attack
+     * runs next, which is the shape 045 found eight times: an action scoped wider than
+     * the thing it tests.
+     *
+     * THE FORBIDDEN VALUES ARE THE VICTIM's TARGET AND ITS ENVIRONMENT ID. `listAttack`
+     * searches the serialised body, so a victim identifier reaching a cursor or an echo
+     * counts as a leak exactly as a row would. */
+    it("GET /v1/audit-log — a tenant's moderation history holds its own entries and none of the victim's", async () => {
+      attacked.add("GET /v1/audit-log");
+      const stamp = randomUUID().slice(0, 8);
+      const banned = async (who: Tenant): Promise<string> => {
+        const externalId = `audit-${stamp}-${who === t.victim ? "victim" : "attacker"}`;
+        const created = await send(url, who.credential, {
+          method: "POST",
+          path: "/v1/users",
+          // THE BATCH SHAPE, which is what this route takes — `{ users: [...] }`, 200
+          // and not 201 because the array reports created, updated and revived per
+          // entry. The single-entry guess answered 400.
+          body: { users: [{ external_id: externalId, display_name: "Audit probe" }] },
+        });
+        expect(created.status, `could not create ${externalId}`).toBe(200);
+        const ban = await send(url, who.credential, {
+          method: "POST",
+          path: `/v1/users/${externalId}/ban`,
+        });
+        expect(ban.status, `could not ban ${externalId}`).toBe(200);
+        return externalId;
+      };
+      await banned(t.attacker);
+      const victimTarget = await banned(t.victim);
+
+      const verdict = await listAttack(
+        url,
+        t.attacker.credential,
+        { method: "GET", path: "/v1/audit-log" },
+        [t.victim.environmentId, victimTarget],
+      );
+      expect(verdict.status).toBe(200);
+      expect(verdict.leaked, `leaked: ${verdict.leaked.join(", ")}`).toEqual([]);
+      // AND ITS OWN ENTRY IS THERE. A page that returned nothing passes the leak check
+      // while being broken — the `list` shape's own trap, and on a log that is empty
+      // until somebody moderates it is not hypothetical.
+      expect(verdict.count, "the attacker's own audit log came back empty").toBeGreaterThan(0);
+    });
+
     it("POST /v1/webhooks — a create by one tenant cannot appear in another's list", async () => {
       attacked.add("POST /v1/webhooks");
       // NO IDENTIFIER TO FORGE on this route: the tenant comes from the key. So the
       // pair is two legitimate creates and the assertion is about the VICTIM's state —
       // this is the one webhook write whose attack is entirely the state read.
       const body = (n: string) => ({
```

### `services/api/src/auth/dev-token.controller.ts` — the one production site that records nothing, saying so in a way a check can read.

```diff title="services/api/src/auth/dev-token.controller.ts"
@@ -15,12 +15,13 @@
 import { environmentSigningSecret, Repository } from "../db/repository";
 import { AUTH_DB } from "./authenticate.middleware";
 import { Accepts, CredentialGuard } from "./credential.guard";
 import type { RequestWithPrincipal } from "./principal";
 import { MAX_TOKEN_LIFETIME_SECONDS, mintUserToken } from "./user-token";
 import { ZodValidationPipe } from "../messages/zod-validation.pipe";
+import { RECORDS_NOTHING } from "../audit/actor";
 
 // FR-AUT-09: the development-only endpoint that turns an API key into an
 // end-user token. It exists so a developer reaches a first authenticated
 // message before writing any token-signing code of their own — the alternative
 // being a quickstart that starts with "implement JWT minting".
 //
@@ -113,13 +114,23 @@
     // identifier that exists nowhere — but on this route an unknown identifier answers
     // **200 with a token**, because the user-surface chapter made the mint create the row. So there
     // is nothing for a refusal to be identical to: any refusal at all says "this
     // identifier exists and is not a person". That is a leak this route cannot close,
     // and 404 is chosen because it is the answer this route already gives for an
     // environment it cannot resolve — one shape rather than a new one (FR-005).
-    const repo = new Repository(this.db, principal.environmentId);
+    // `RECORDS_NOTHING`, AND IT IS A VALUE RATHER THAN AN OMISSION (FR-MOD-03).
+    // Minting a credential is not a moderation action — `POST /auth/dev-token` is
+    // classified `not-moderation` — so this repository will never write an audit entry
+    // and has no actor to write one with. Leaving the argument off would make this site
+    // indistinguishable from one that forgot, which is what `repository.itest.ts` reads
+    // the source to prevent.
+    const repo = new Repository(
+      this.db,
+      principal.environmentId,
+      RECORDS_NOTHING,
+    );
     const existing = await repo.getUserByExternalId(body.user);
     if (existing?.kind === "bot") {
       throw new NotFoundException({
         code: "not_found",
         message: "no such user",
       });
```

### `services/api/src/auth/credentials.itest.ts` — a call site the compiler named.

```diff title="services/api/src/auth/credentials.itest.ts"
@@ -591,13 +591,13 @@
     });
 
     it("reuses a deleted user's row without reviving them (FR-030)", async () => {
       const repo = new Repository(db, env.id);
       const gone = `deleted-${Math.random().toString(36).slice(2, 8)}`;
       const row = await repo.createUser(gone, "Deleted");
-      await repo.deleteUser(row.id);
+      await repo.deleteUser(row.id, gone);
 
       const minted = await devToken(key.credential, { user: gone });
       expect(minted.status).toBe(200);
 
       const after = await repo.getUserByExternalId(gone);
       // THE SAME ROW, and still deleted. FR-030 says presenting the id again reuses the
```

### `services/api/src/messages/messages.module.ts` — one of the five request-scoped factories that now build an actor.

```diff title="services/api/src/messages/messages.module.ts"
@@ -17,12 +17,13 @@
 import { apiLogger, LOGGER } from "../logger";
 import { createDb, createPool, type Db } from "../db/client";
 import type { RequestWithTenant } from "./request-with-tenant";
 import { Repository } from "../db/repository";
 import { MessagesController } from "./messages.controller";
 import { MessagesService } from "./messages.service";
+import { actorFrom } from "../audit/actor";
 
 /** The api publishes to the live fan-out from the send path, so
  * the module that owns that path owns the client.
  *
  * PROVIDED AND NOT EXPORTED, and that is the point. `internal.module.ts` imports
  * this module and, in its own words, "reuse[s] MessagesModule's providers
@@ -80,13 +81,17 @@
         // else about this line. It used to be an environment header — a
         // header any caller could type. It is now the environment resolved
         // from a verified credential, so a request cannot name a tenant it
         // has not proved it may act for. The empty-string fallback is the
         // same as 2.2's: no principal means no scope, and the guard below
         // turns that into a 401 before any handler runs.
-        new Repository(db, req.principal?.environmentId ?? ""),
+        new Repository(
+          db,
+          req.principal?.environmentId ?? "",
+          actorFrom(req),
+        ),
     },
     MessagesService,
     { provide: LOGGER, useFactory: apiLogger },
     {
       provide: MESSAGE_PUBLISHER,
       inject: [LOGGER],
```

### `services/api/src/channels/channels.module.ts` — one of the five.

```diff title="services/api/src/channels/channels.module.ts"
@@ -5,12 +5,13 @@
 import { MembershipModule } from "../membership/membership.module";
 import { createDb, createPool, type Db } from "../db/client";
 import { Repository } from "../db/repository";
 import { ChannelsController } from "./channels.controller";
 import { ChannelsService } from "./channels.service";
 import type { RequestWithTenant } from "../messages/request-with-tenant";
+import { actorFrom } from "../audit/actor";
 
 // The messages module's shape, for the messages module's reasons: the repository
 // is the plain 2.1 class, constructed per request with the tenant the middleware
 // already resolved from a verified credential (ADR-15).
 @Module({
   imports: [AuthModule, MembershipModule],
@@ -23,12 +24,16 @@
     },
     {
       provide: Repository,
       scope: Scope.REQUEST,
       inject: ["DB", REQUEST],
       useFactory: (db: Db, req: RequestWithTenant) =>
-        new Repository(db, req.principal?.environmentId ?? ""),
+        new Repository(
+          db,
+          req.principal?.environmentId ?? "",
+          actorFrom(req),
+        ),
     },
     ChannelsService,
   ],
 })
 export class ChannelsModule {}
```

### `services/api/src/users/users.module.ts` — one of the five.

```diff title="services/api/src/users/users.module.ts"
@@ -5,12 +5,13 @@
 import { MembershipModule } from "../membership/membership.module";
 import { createDb, createPool, type Db } from "../db/client";
 import { Repository } from "../db/repository";
 import { UsersController } from "./users.controller";
 import { UsersService } from "./users.service";
 import type { RequestWithTenant } from "../messages/request-with-tenant";
+import { actorFrom } from "../audit/actor";
 
 // The channels module's shape, for the channels module's reasons.
 //
 // A SEPARATE MODULE AND NOT A ROUTE ON `ChannelsController`. Five SRS clauses need
 // routes whose subject is a user — the listing, the profile read, the upsert, the
 // deletion, the ban — and hanging them off the channels controller would put user
@@ -27,12 +28,16 @@
     },
     {
       provide: Repository,
       scope: Scope.REQUEST,
       inject: ["DB", REQUEST],
       useFactory: (db: Db, req: RequestWithTenant) =>
-        new Repository(db, req.principal?.environmentId ?? ""),
+        new Repository(
+          db,
+          req.principal?.environmentId ?? "",
+          actorFrom(req),
+        ),
     },
     UsersService,
   ],
 })
 export class UsersModule {}
```

### `services/api/src/webhooks/webhooks.module.ts` — one of the five.

```diff title="services/api/src/webhooks/webhooks.module.ts"
@@ -18,12 +18,13 @@
   createDeliveryRelay,
   ensureDeliveriesStream,
   type DeliveryRelay,
 } from "./delivery-relay";
 import { WebhooksController } from "./webhooks.controller";
 import { WebhooksService } from "./webhooks.service";
+import { actorFrom } from "../audit/actor";
 
 export const DELIVERY_RELAY = "DELIVERY_RELAY";
 
 /** The api's SECOND relay (research R13), started with the service
  * exactly as the outbox chapter's is. An event spine that only runs when someone remembers is
  * not a spine, and the same is true of a retry schedule.
@@ -66,13 +67,17 @@
     },
     {
       provide: Repository,
       scope: Scope.REQUEST,
       inject: ["DB", REQUEST],
       useFactory: (db: Db, req: RequestWithTenant) =>
-        new Repository(db, req.principal?.environmentId ?? ""),
+        new Repository(
+          db,
+          req.principal?.environmentId ?? "",
+          actorFrom(req),
+        ),
     },
     WebhooksService,
     {
       provide: DELIVERY_RELAY,
       useFactory: (): DeliveryRelay =>
         createDeliveryRelay({
```

### `services/api/src/media/media.module.ts` — one of the five.

```diff title="services/api/src/media/media.module.ts"
@@ -9,12 +9,13 @@
 import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
 import { createDb, createPool, type Db } from "../db/client";
 import { Repository } from "../db/repository";
 import { MediaController } from "./media.controller";
 import { MediaService } from "./media.service";
 import type { RequestWithTenant } from "../messages/request-with-tenant";
+import { actorFrom } from "../audit/actor";
 
 // Hosted media's module (FR-MED-01, FR-MED-02).
 //
 // REGISTERED IN `app.module.ts`, WHICH IS A TASK NO REQUIREMENT NAMES. Without that
 // line the route does not exist and every test in this chapter gets a 404 that reads
 // as a routing bug. Chapter 4.6 shipped the same omission in the tutorial's manifest
@@ -41,13 +42,17 @@
     },
     {
       provide: Repository,
       scope: Scope.REQUEST,
       inject: ["DB", REQUEST],
       useFactory: (db: Db, req: RequestWithTenant) =>
-        new Repository(db, req.principal?.environmentId ?? ""),
+        new Repository(
+          db,
+          req.principal?.environmentId ?? "",
+          actorFrom(req),
+        ),
     },
     // A THIRD COPY OF THE SAME FACTORY, AND THE RULE THAT FORCES IT IS WRITTEN IN
     // `internal.module.ts`: *"a provider is visible to the module that declares it and to
     // nothing it imports"* — and `InternalModule` has no `exports:` array. `AppModule`
     // already provides `ANALYTICS_PUBLISHER` for its middleware and `InternalModule` for
     // the dispatcher; this module needs it for FR-MED-12's storage deltas (4.16).
```

### `services/api/src/channels/channels.service.ts` — the external id threaded where the `RETURNING` does not carry it.

```diff title="services/api/src/channels/channels.service.ts"
@@ -168,13 +168,18 @@
     userExternalId: string,
     role: ChannelRole,
   ): Promise<{ external_id: string; role: ChannelRole }> {
     if (!(await this.repo.channelExists(channelId))) throw this.notFound();
     const user = await this.repo.getUserByExternalId(userExternalId);
     if (!user) throw this.notFound();
-    const outcome = await this.repo.setMemberRole(channelId, user.id, role);
+    const outcome = await this.repo.setMemberRole(
+      channelId,
+      user.id,
+      role,
+      userExternalId,
+    );
     if (outcome === "not_a_member") throw this.notFound();
     return { external_id: userExternalId, role };
   }
 
   /** A user joining a channel themselves (FR-CHN-03).
    *
```

### `services/api/src/users/users.service.ts` — the second of the two places that needed it.

```diff title="services/api/src/users/users.service.ts"
@@ -224,13 +224,13 @@
    * here — it 404s a user who is already deleted, and deleting twice is the ordinary
    * outcome of a customer's retry after a timeout. So the row is read without the
    * liveness filter, and only "no row at all" is a 404. */
   async deleteUser(externalId: string): Promise<{ external_id: string; deleted: true }> {
     const user = await this.repo.getUserByExternalId(externalId);
     if (!user) throw new NotFoundException("user not found");
-    await this.repo.deleteUser(user.id);
+    await this.repo.deleteUser(user.id, externalId);
     return { external_id: externalId, deleted: true };
   }
 
   /** Ban and unban, tenant-wide (FR-031, FR-032).
    *
    * BOTH IDEMPOTENT AND BOTH 200. Banning a banned user and unbanning an unbanned one
```

### `services/api/src/users/users.itest.ts` — call sites the compiler named.

```diff title="services/api/src/users/users.itest.ts"
@@ -175,19 +175,19 @@
     );
     await repo.unarchiveChannel(middle);
   });
 
   // ── T116b: the role is in the projection ────────────────────────────────────
   it("returns each channel's role for the user the path names", async () => {
-    await repo.setMemberRole(newest, member.id, "moderator");
+    await repo.setMemberRole(newest, member.id, "moderator", "lister");
     const body = (await (await list("lister")).json()) as {
       data: Array<{ external_id: string; role: string }>;
     };
     expect(body.data.find((c) => c.external_id === "newest")?.role).toBe("moderator");
     expect(body.data.find((c) => c.external_id === "oldest")?.role).toBe("member");
-    await repo.setMemberRole(newest, member.id, "member");
+    await repo.setMemberRole(newest, member.id, "member", "lister");
   });
 
   // ── T113: the cursor ────────────────────────────────────────────────────────
   //
   // THE TIE IS TESTED IN `repository.itest.ts` AND NOT HERE. Two channels sharing a
   // `last_activity_at` cannot be produced through the API: `now()` is the
@@ -1153,13 +1153,13 @@
     expect((await unban("twice-banned")).status).toBe(200);
   });
 
   it("answers 404 for a user this tenant does not have, and for a deleted one", async () => {
     expect((await ban("never-heard-of")).status).toBe(404);
     const gone = await repo.createUser("ban-then-delete", "Gone");
-    await repo.deleteUser(gone.id);
+    await repo.deleteUser(gone.id, "ban-then-delete");
     // A DELETED USER CANNOT BE BANNED, and does not need to be: every route naming them
     // answers 404 and their session carries no channels. Banning one would be a state
     // with no observable difference.
     expect((await ban("ban-then-delete")).status).toBe(404);
   });
 
```

### `services/api/src/outbox/outbox.itest.ts` — a call site the compiler named.

```diff title="services/api/src/outbox/outbox.itest.ts"
@@ -641,13 +641,13 @@
     const removed = (await rowsFor("channel.member_removed")).length;
 
     // `moderator`, not `admin`. `members_role_check` is ('owner','moderator','member')
     // and `memberships_role_check` — the ORGANISATION one — is ('owner','admin',
     // 'member'). The schema comment predicts this confusion in as many words and the
     // first draft of this test made it anyway.
-    expect(await repo.setMemberRole(channelId, mai.id, "moderator")).toBe("set");
+    expect(await repo.setMemberRole(channelId, mai.id, "moderator", "mai")).toBe("set");
 
     // `membership.changed`'s enum has two members and neither means "role".
     // A reader who sees add and remove producing events will assume a PATCH does
     // too; this is where they find out it does not.
     expect(await rowsFor("channel.member_added")).toHaveLength(added);
     expect(await rowsFor("channel.member_removed")).toHaveLength(removed);
```

### `vitest.coverage.config.mts` — seven pins for eight new files, and the one left out on purpose.

```diff title="vitest.coverage.config.mts"
@@ -1443,12 +1443,93 @@
         "services/api/src/media/store.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
+
+        // ── Chapter 4.18, FR-MOD-03's audit log ──────────────────────────────────
+        //
+        // SEVEN PINS FOR EIGHT NEW FILES, and `audit.module.ts` is the one left out
+        // ON PURPOSE: `**/*.module.ts` is excluded above, so a pin on it would match
+        // no file and be SILENT. That is chapter 4.4's finding in this very file —
+        // it excluded `**/main.ts` and also pinned `services/ingester/src/main.ts`,
+        // one unbindable pin among 45. Both halves of that probe were run again here.
+        //
+        // SIX OF THE SEVEN ARE AT 100 AND MEASURED THERE, not aspired to. The v8 text
+        // reporter omits a file at 100/100/100/100, so the table showed two of these
+        // eight and `coverage-summary.json` showed all eight — the table answers which
+        // files have a gap, the JSON answers which were seen (chapter 4.10).
+        "services/api/src/audit/actor.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/audit/audit.port.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/audit/audit.reader.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/audit/audit.schema.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/audit/moderation-routes.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        "services/api/src/db/audit-reads.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // THE CURSOR WAS RAISED, NOT PINNED WHERE IT LANDED. It measured 88.23 / 80 on
+        // the first run, with lines 70-72 uncovered: a token whose instant is outside
+        // anything the column can hold, and one whose id is 36 characters and not a
+        // uuid. Both arms are reachable and neither had a test. `cursor.test.ts` drives
+        // them — chapter 4.13's `shape.ts`, raised rather than lowered, and it runs in
+        // the Docker-free lane because a cursor is arithmetic.
+        "services/api/src/audit/cursor.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // AND THE CONTROLLER IS PINNED BELOW WHAT IT MEASURES, WITH THE REASON NAMED.
+        // 92.85 / 83.33 / 100 / 92.30, and the uncovered line is the 403 for a principal
+        // with no environment — **which T046 proved cannot fire**. `@Accepts("application")`
+        // makes the credential guard refuse a platform principal before the handler runs,
+        // and an application principal always resolves to an environment.
+        //
+        // The branch stays: it is the contract's, it matches the request log's route, and
+        // deleting it would leave the next reader to rediscover why it is absent. What
+        // keeps this route safe is the decorator, and `route.itest.ts` tests THAT — run
+        // red by deleting it, which answers a user token 200 with the tenant's history.
+        //
+        // 90 / 80 against 92.85 / 83.33: below the observation by about the swing
+        // `session.ts` showed across two identical runs, with both numbers here so the
+        // next reader does not have to re-measure to know which is which.
+        "services/api/src/audit/audit.controller.ts": {
+          branches: 80,
+          functions: 100,
+          lines: 90,
+          statements: 90,
+        },
       },
     },
   },
   plugins: [
     swc.vite({
       module: { type: "es6" },
```

## Chapter 4.19 — everything, including what was deleted

Five files, eleven hunks, all at `-U6` with every pre-image verified to match exactly
once in the chain's own replay before any of this was pasted. They are here rather than
in the chapter because every one of these files is published by pages chapter 4.19 does
not own — `repository.ts` by 52, `schema.ts` by 34, `messages.itest.ts` and
`messages.controller.ts` by 18 each — and one rule for five files beats a judgement per
file.

**Placed last**, after every other amendment in this appendix, because the appendix
applies after every chapter and a hunk anchored on a state an earlier amendment changes
is a broken chain even when the hunk itself is right.

```diff title="services/api/src/db/schema.ts"
@@ -439,18 +439,36 @@
 // first draft of this chapter's data model gave the table a surrogate
 // `id UUID PRIMARY KEY` and stated that it was quoting the SAD. It was not.
 // Three columns and a composite key:
 //
 //     PRIMARY KEY (message_id, edited_at)
 //
-// The key is a constraint with a cost the SAD does not spell out: two edits to
+// The key is a constraint with a cost the SAD does not spell out: two writes to
 // one message at the same timestamp collide rather than both being kept.
-// Postgres holds microseconds, so that needs two edits inside one microsecond
-// on one message. A surrogate id would take both rows and leave a history with
-// two entries claiming the same instant, which is a silent wrong answer where
-// this is a loud refusal. The published constraint stands (Constitution VII).
+//
+// THE WINDOW IS A MILLISECOND, NOT A MICROSECOND, and this comment said the
+// latter until chapter 4.19 measured it. The column is `timestamptz` at
+// precision 6 and `now()` does produce microseconds — but every value ever
+// written here arrives through the driver as a JavaScript `Date`, which holds
+// milliseconds, so the stored instant is always truncated. The table says so:
+// **5,149 of 5,149 rows land exactly on a millisecond boundary.** The collision
+// window was a thousand times wider than the sentence claimed, for as long as
+// this table has existed.
+//
+// It became reachable when 4.19 gave the table a second writer: a concurrent
+// edit and deletion of one message collided on attempt 1 of 10 in
+// `repository.itest.ts`'s race, and the deletion's transaction rolled back —
+// leaving the message un-tombstoned, which is FR-007's property. The deletion
+// path writes `sql`now()`` for that reason and keeps full precision. **The edit
+// path still writes a `Date`**, so two concurrent edits of one message inside
+// one millisecond would still collide; that is pre-existing, out of this
+// chapter's scope under FR-008, and recorded in its `gaps.md`.
+//
+// A surrogate id would take both rows and leave a history with two entries
+// claiming the same instant, which is a silent wrong answer where this is a
+// loud refusal. The published constraint stands (Constitution VII).
 //
 // APPEND ONLY (FR-004). Nothing updates or deletes a row here. A
 // second edit appends a second row; the current text lives on `messages`.
 //
 // NO `environment_id`, exactly like `messages` above. The tenant is reached
 // through `message_id -> messages -> channels`, which is how every read below
@@ -459,18 +477,36 @@
   "message_edits",
   {
     messageId: uuid("message_id")
       .notNull()
       .references(() => messages.id),
     editedAt: timestamp("edited_at", { withTimezone: true }).notNull(),
-    // FR-MSG-07: what the message said before this edit. NOT NULL, and that
-    // has a consequence the chapter meets rather than works around: a deletion
-    // writes no row here, because a tombstone has no text to preserve. FR-010
-    // refuses an edit on a tombstone instead of defining what its history
-    // would say.
+    // FR-MSG-07: what the message said before this edit. NOT NULL.
+    //
+    // THIS COMMENT USED TO EXPLAIN AN ABSENCE AS A NECESSITY, and four chapters
+    // read past the gap because of it. It said: "a deletion writes no row here,
+    // because a tombstone has no text to preserve". That is true of the row
+    // AFTER the deletion and false at the moment before it — `deleteMessage`
+    // holds the text it is about to destroy. The sentence described the
+    // behaviour correctly and gave a reason that was not the reason, which is
+    // the most expensive kind of comment to get wrong.
+    //
+    // Chapter 4.19 writes a row here on deletion too, carrying that last text.
     priorText: text("prior_text").notNull(),
+    // WHY THIS VERSION STOPPED BEING CURRENT (chapter 4.19) — `'edit'` or
+    // `'deletion'`, bounded by `message_edits_ended_by_check` in `0022`.
+    //
+    // REQUIRED, so the compiler names both insert sites. There are two: the
+    // edit path's, which has been here since 3.23, and the deletion's, which is
+    // this chapter's. The count was read rather than grepped (T014a) — the
+    // grep's estimate was three times too large.
+    //
+    // No default, because a default lets a writer stay silent and the one rule
+    // this column exists for is that a row cannot be silent about which
+    // happened.
+    endedBy: text("ended_by").notNull(),
   },
   (t) => [primaryKey({ columns: [t.messageId, t.editedAt] })],
 );
 
 // DECISION (chapter 2.1): the docs/07 row and SAD §6.3's hot-path index
 // both reference a members table that §6.1 never defines. This shape is
```

```diff title="services/api/src/db/repository.ts"
@@ -2689,12 +2689,35 @@
  * honest reasons: the column has been nullable since 2.1 (system messages
  * have no author), and every row written through the socket before 2.6's
  * fix has no author recorded. A caller that needs to build a wire frame
  * has to decide what to do with those; the layer does not decide for it. */
 export interface MessageWithSender extends MessageRow {
   user: string | null;
+  /** When it was removed, or `null` (chapter 4.19, FR-007).
+   *
+   * **REQUIRED AND NULLABLE, UNLIKE `edited_at?` DIRECTLY ABOVE**, and the contrast is
+   * the decision rather than an inconsistency. Three precedents were read before it was
+   * taken. `edited_at?` is optional for write-path convenience — which its own comment
+   * calls "exactly what made the attachments chapter's `internalSendResponseSchema` a
+   * break waiting to happen". The USER row's `deleted_at: string | null` is required and
+   * nullable, and its comment is this argument already written down: *"selected here
+   * rather than filtered in the query so a caller can tell the two apart: a repository
+   * that hid deleted rows would make the marker unobservable and the deletion
+   * untestable."* And `text: string | null` on this very interface is the same shape for
+   * the same class of value — null on most rows, load-bearing when it is not.
+   *
+   * The bill was counted before it was chosen: FIVE construction sites, read rather than
+   * grepped, four of which must now spell `deleted_at: null`. A grep over the type's name
+   * said fourteen and that figure was three times too large.
+   *
+   * WHY A CLIENT NEEDS IT. Three things describe one removal — the real-time
+   * `message.deleted` frame, the webhook built from the outbox row, and this. The first
+   * two carry the instant and history did not, so a client that was offline when the
+   * message went learned that it is gone and not when. (The `DELETE` itself answers 204
+   * with an empty body and carries nothing at all.) */
+  deleted_at: string | null;
 }
 
 /** Thrown when a channel id resolves to nothing IN THIS TENANT — which,
  * from the caller's side, is indistinguishable from "does not exist"
  * (FR-TEN-05: no data, and no reveal that the foreign id exists). The
  * layer stays framework-free; the service turns this into the wire's
@@ -5384,12 +5407,17 @@
       // is the right answer to a state this table cannot represent — SAD §6.1 published
       // the key and `baseline.txt` records what it costs.
       await tx.insert(messageEdits).values({
         messageId,
         editedAt,
         priorText: row.text,
+        // CHAPTER 4.19. This row's text stopped being current because a later edit
+        // replaced it — which was the only way a row got here until this chapter, and
+        // is now one of two. The backfill in `0022` wrote `'edit'` on all 4,863
+        // existing rows for the same reason.
+        endedBy: "edit",
       });
 
       // THE EVENT COMMITS WITH THE EDIT (FR-019, ADR-06). Same argument
       // as the send path's and the deletion's: publishing after the commit leaves a
       // window where the row changed and the event never existed, silently, with
       // nothing to reconcile against.
@@ -5606,12 +5634,67 @@
         .where(eq(messages.id, messageId))
         .returning({ deletedAt: messages.deletedAt });
       // Read back rather than recomputed: the row carries the instant the database
       // assigned, and the event and the frame must both quote that one.
       const deletedAt = toIso(updated!.deletedAt!);
 
+      // CHAPTER 4.19, FR-001. THE TEXT THE MESSAGE HELD WHEN IT WAS REMOVED.
+      //
+      // Until this line a deletion wrote nothing here, so a message deleted after N
+      // edits left N recoverable texts out of the N+1 that existed and a message
+      // deleted with no edits left zero of one. FR-MOD-01 asks for a complete history
+      // and FR-MSG-08 reserves hard deletion for the compliance endpoint; losing the
+      // last version at a moderation delete was a hard deletion on the wrong path.
+      //
+      // ON THIS BRANCH ONLY, which is FR-004 and the same half of FR-009 the event
+      // insert below turns on: a repeated deletion returned above without writing, so
+      // it records no second final version. The count is what proves it — three rows
+      // after the first delete and three after the second, not a delta of zero, which
+      // nothing happening also satisfies.
+      //
+      // THE INSTANT IS THE ROW'S, NOT A SECOND READING. `updated!.deletedAt!` is the
+      // value the database assigned and the `.returning()` handed back, and the
+      // tombstone, the frame, the outbox event and this row therefore all quote one
+      // timestamp. `editMessage` states the same rule 280 lines up and gives the
+      // reason: the history row's own primary key is `(message_id, edited_at)`, so a
+      // caller matching an entry to the message state that produced it needs the two
+      // to be equal. A fresh `now()` here would be a different microsecond and the
+      // match would fail silently.
+      //
+      // `row.text` IS NARROWED TO A STRING by the early return above — the branch that
+      // sends an already-deleted message back tests `row.text === null` — so
+      // `prior_text NOT NULL` is never offered a null, including for the system
+      // messages with no text that `deleteMessage`'s own comment contemplates.
+      // `sql`now()`` AND NOT `updated!.deletedAt!`, AND A TEST FOUND THE DIFFERENCE.
+      //
+      // Both express the same instant — `now()` is `transaction_timestamp()` and is
+      // stable across this transaction, so this row and the tombstone's `deleted_at`
+      // are the same value by construction. What differs is PRECISION. The column is
+      // `timestamptz` at precision 6 and the value that came back through the driver
+      // is a JavaScript `Date`, which holds MILLISECONDS — so writing it back
+      // truncates, and the primary key `(message_id, edited_at)` gets a collision
+      // window a thousand times wider than the column can represent.
+      //
+      // Measured: `repository.itest.ts`'s concurrent edit-and-deletion race failed on
+      // attempt 1 of 10 with `23505 … Key (message_id, edited_at)=(…, 11:10:28.806+00)
+      // already exists`, and the deletion's whole transaction rolled back — the
+      // message was left un-tombstoned by a concurrent edit, which is FR-007's
+      // property broken by this chapter's own insert.
+      //
+      // AND THE TABLE SAYS HOW LONG THAT HAS BEEN TRUE OF THE EDIT PATH: 5,149 of
+      // 5,149 existing rows are millisecond-exact on a microsecond column, because
+      // every value ever written here came from JavaScript. `schema.ts` claimed the
+      // key needed "two edits inside one microsecond"; it needed two inside one
+      // millisecond, and that comment is corrected.
+      await tx.insert(messageEdits).values({
+        messageId,
+        editedAt: sql`now()`,
+        priorText: row.text,
+        endedBy: "deletion",
+      });
+
       // FEATURE 044, FR-002/FR-003. A DELETION IS A REVISION and raises the count exactly as
       // an edit does — US1's third acceptance scenario fails if only edits are counted. Same
       // transaction, same argument as the edit path.
       await tx
         .update(channels)
         .set({ revisionSequence: sql`${channels.revisionSequence} + 1` })
@@ -5693,32 +5776,54 @@
    * `asc(editedAt)` AND NOT AN `id`. The table has no surrogate key, so insertion order
    * is not available to order by; `edited_at` is the ordering FR-023 asks for and the
    * primary key already indexes it. */
   async listMessageEdits(
     channelId: string,
     messageId: string,
-  ): Promise<Array<{ prior_text: string; edited_at: string }>> {
+  ): Promise<
+    Array<{
+      prior_text: string;
+      edited_at: string;
+      ended_at: string;
+      ended_by: string;
+    }>
+  > {
     const rows = await this.db
       .select({
         priorText: messageEdits.priorText,
         editedAt: messageEdits.editedAt,
+        endedBy: messageEdits.endedBy,
       })
       .from(messageEdits)
       .innerJoin(messages, eq(messages.id, messageEdits.messageId))
       .innerJoin(channels, eq(channels.id, messages.channelId))
       .where(
         and(
           eq(messageEdits.messageId, messageId),
           eq(messages.channelId, channelId),
           eq(channels.environmentId, this.environmentId),
         ),
       )
       .orderBy(asc(messageEdits.editedAt));
+    // `edited_at` AND `ended_at` CARRY THE SAME VALUE, DELIBERATELY (chapter 4.19).
+    //
+    // One column, two names, because `edited_at` is published and cannot be removed
+    // without a breaking change under CON-05 — and it is the wrong word for a row whose
+    // text ended in a deletion. `ended_at` is the right word and is additive. The
+    // duplication is one field wide, it is the price of not versioning a route over a
+    // noun, and it is stated in `contracts/message-versions.md` so nobody has to work
+    // out which of two names to trust. A client should read `ended_at` and `ended_by`;
+    // `edited_at` is kept for callers written before this chapter.
+    //
+    // The array key stays `edits` where `versions` would read better, for the same
+    // reason and at the same price.
     return rows.map((r) => ({
       prior_text: r.priorText,
       edited_at: toIso(r.editedAt),
+      ended_at: toIso(r.editedAt),
+      ended_by: r.endedBy,
     }));
   }
 
   /** Does this message exist in this channel of this tenant?
    *
    * THE EDIT-HISTORY ROUTE NEEDS IT and `listMessageEdits` cannot supply it: an empty
@@ -6576,12 +6681,13 @@
       // diff the text to notice, and FR-021 says the platform does not compare texts.
       //
       // WHAT THIS IS *NOT*: the superseded text. That is `message_edits`, readable
       // only by a tenant key (FR-023a), and this column says an edit happened without
       // saying what it replaced.
       edited_at: messages.editedAt,
+      deleted_at: messages.deletedAt,
     };
     const scoped = (extra?: SQL) =>
       and(
         eq(messages.channelId, channelId),
         eq(channels.environmentId, this.environmentId),
         ...(extra ? [extra] : []),
@@ -6632,12 +6738,19 @@
       attachments: row.attachments ?? [],
       created_at: toIso(row.created_at),
       // `null`, NOT `undefined`, and the difference is what a test can see. An absent
       // key and a null one are the same value through `??` — the control test for this
       // field was green before the field existed because its first draft used `??`.
       edited_at: row.edited_at === null ? null : toIso(row.edited_at),
+      // CHAPTER 4.19, FR-007. `null`, NOT `undefined`, for the reason the line above
+      // states: an absent key and a null one are the same value through `??` and
+      // different to a contract. This is the field that lets a client catching up
+      // through history tell a removal from a message that never had text, and say
+      // when — the `message.deleted` frame and the webhook have carried the instant
+      // since 3.23 and this surface did not.
+      deleted_at: row.deleted_at === null ? null : toIso(row.deleted_at),
       })),
     );
   }
 
   /** Resume backfill (chapter 2.7, FR-RTM-03): for each cursor, everything
    * the client has not applied yet — capped, with an honest truncation
```

```diff title="services/api/src/db/repository.itest.ts"
@@ -848,12 +848,51 @@
     ).rejects.toThrow(MessageDeletedError);
     // AND NO HISTORY ROW WAS WRITTEN. A refusal that had already inserted would leave
     // the table holding an entry for an edit that never happened.
     expect(await repoA.listMessageEdits(channel.id, sent.id)).toEqual([]);
   });
 
+  it("an edit and a deletion on one message never collide on (message_id, edited_at)", async () => {
+    // ASSERTED RATHER THAN ASSUMED (chapter 4.19, T020). The primary key is
+    // `(message_id, edited_at)` and this chapter gives the table a second writer, so
+    // the two could in principle land on one instant and the second insert would be a
+    // loud failure in the middle of a deletion. *Cannot collide by construction* is
+    // the kind of claim this project has had to withdraw, so here is the measurement.
+    //
+    // The construction argument, for the record: FR-010 of chapter 3.23 refuses an
+    // edit on a tombstone, so every edit strictly precedes the deletion, and `now()`
+    // is the transaction timestamp — two transactions, two instants. The test exists
+    // because that paragraph is an argument and this is evidence.
+    const author = await repoA.createUser("t020-order", "Author");
+    const channel = await repoA.createChannel("t020-order", "public");
+    await repoA.addMember(channel.id, author.id);
+    const sent = await repoA.sendMessage(channel.id, { text: "first", userId: author.id });
+    await repoA.editMessage(channel.id, sent.id, { text: "second", userId: author.id });
+    await repoA.deleteMessage(channel.id, sent.id, {});
+
+    const edits = await repoA.listMessageEdits(channel.id, sent.id);
+    expect(edits.map((e) => e.prior_text)).toEqual(["first", "second"]);
+    expect(edits.map((e) => e.ended_by)).toEqual(["edit", "deletion"]);
+
+    // DISTINCT AND ORDERED, which is the property the key needs and the ordering the
+    // route promises. Equal instants would mean the insert had already thrown.
+    const instants = edits.map((e) => e.ended_at);
+    expect(new Set(instants).size).toBe(2);
+    expect(instants[0]! < instants[1]!).toBe(true);
+
+    // AND THE DELETION'S INSTANT IS THE TOMBSTONE'S, not a second clock reading. The
+    // row, the frame, the outbox event and this version all quote one timestamp, so a
+    // caller can match a version to the message state that produced it.
+    const [row] = (
+      await db.execute<{ deleted_at: Date }>(
+        sql`SELECT deleted_at FROM messages WHERE id = ${sent.id}`,
+      )
+    ).rows;
+    expect(new Date(instants[1]!).getTime()).toBe(new Date(row!.deleted_at).getTime());
+  });
+
   it("the history survives its channel being archived and its author deleted", async () => {
     const author = await repoA.createUser("t036b-author", "Author");
     const channel = await repoA.createChannel("t036b", "public");
     await repoA.addMember(channel.id, author.id);
     const sent = await repoA.sendMessage(channel.id, { text: "before", userId: author.id });
     await repoA.editMessage(channel.id, sent.id, { text: "after", userId: author.id });
```

```diff title="services/api/src/messages/messages.controller.ts"
@@ -495,13 +495,25 @@
    * question separately — `listMessageEdits` returning `[]` cannot tell them apart. */
   @Get(":messageId/edits")
   @Accepts("application")
   async edits(
     @Param("channelId") channelId: string,
     @Param("messageId") messageId: string,
-  ): Promise<{ edits: Array<{ prior_text: string; edited_at: string }> }> {
+  ): Promise<{
+    edits: Array<{
+      prior_text: string;
+      edited_at: string;
+      // CHAPTER 4.19. Widened here as well as in the repository, and the compiler
+      // would not have asked: the returned literal's `edits` value is a call result
+      // rather than an object literal, so no excess-property check fires, and the two
+      // new fields would have reached the client at runtime while this signature said
+      // there were two. A type that is wrong and silent.
+      ended_at: string;
+      ended_by: string;
+    }>;
+  }> {
     // NO `userId`, AND THAT IS THE DECLARATION SPEAKING. Only an application credential
     // reaches this handler, so there is no member to resolve and no membership to
     // check; `channelVisibleTo(channelId, undefined)` is the tenant reading, which sees
     // everything it owns. Passing a user here would be inventing a caller.
     if (!(await this.repo.channelVisibleTo(channelId))) {
       throw new NotFoundException("channel not found");
```

```diff title="services/api/src/messages/messages.itest.ts"
@@ -1410,13 +1410,24 @@
       const { edits } = (await res.json()) as {
         edits: Array<Record<string, unknown>>;
       };
       expect(edits).toHaveLength(1);
       // AN EXACT KEY SET, not `attachments === undefined`: an absent key and an
       // undefined value are the same to a truthiness check and different to a contract.
-      expect(Object.keys(edits[0]!).sort()).toEqual(["edited_at", "prior_text"]);
+      //
+      // FOUR KEYS SINCE CHAPTER 4.19, and this assertion moving is the contract test
+      // doing its job rather than FR-008 being broken: `ended_at` and `ended_by` are
+      // added to every row. It was the ONE assertion the chapter predicted would move,
+      // and running the file unedited found exactly it — 67 of 68 otherwise green.
+      // `attachments` is still absent, which is what this test is about.
+      expect(Object.keys(edits[0]!).sort()).toEqual([
+        "edited_at",
+        "ended_at",
+        "ended_by",
+        "prior_text",
+      ]);
     });
 
     it("returns a tombstone as an empty list through the history route (FR-012, SC-003)", async () => {
       // THE SIX READ SHAPES `data-model.md` NAMES, and the assertion differs by shape
       // because the shapes do. Two carry the field and get `[]`; four never carried it
       // and the field stays ABSENT — which is the stronger answer, not a weaker one.
```

## Chapter 4.20 — the messages that expire


Five files, eleven hunks, and the bill was counted at analysis rather than
discovered here: `repository.ts` is titled on 52 pages, `schema.ts` 34,
`app.module.ts` 23, `targets.ts` 13 and `gauntlet.itest.ts` 13. The last of
those was missing from the first count and found by asking what a new route
costs — **a gauntlet attack is written inside that file, not beside it**, so
classifying a route and covering it are two edits to two expensive files.

`moderation-routes.ts` is titled on no page at all, which is why the route's
third classification costs nothing here and still had to be made.

### `services/api/src/db/repository.ts` — the paged read, the destroy, the extracted containment check and five test helpers.

```diff title="services/api/src/db/repository.ts"
@@ -648,13 +648,23 @@
   return rows.map((row) => row.id);
 }
 
 /** WHICH OF A TENANT'S MEDIA OBJECTS NOTHING REFERENCES ANY MORE — FR-MED-10's predicate.
  *
  * **CALLED BY NOTHING YET, AND THAT IS NOT AN OVERSIGHT.** FR-MED-10's reaper does not
- * exist; `docs/12` row 22, the erasure chapter, is where it gets a caller. Chapter 4.15
+ * exist; `docs/12` row 22, the erasure chapter, is where it gets a caller.
+ *
+ * **CHAPTER 4.20 CAME CLOSE AND DID NOT TAKE IT, WHICH IS WORTH RECORDING HERE BECAUSE
+ * THE NEXT READER WILL HAVE THE SAME IDEA.** The retention sweep needs a reference
+ * check and this function is one, so reusing it looked free. It asks a different
+ * question: *which objects in this environment older than X does no message reference*
+ * — a superset that includes objects **never attached to anything**, 48 of them in one
+ * environment on the development lane. Those are this function's own population,
+ * FR-MED-10's orphans, and a retention policy has nothing to do with them. The sweep
+ * brings the `media_id` values of the messages it just destroyed instead, to
+ * `unreferencedAmong` below, which is the half the two callers share. Chapter 4.15
  * writes the predicate here anyway because the alternative is what happened to
  * FR-MED-07's first sentence — three chapters cited the clause, every one of them
  * implemented the half it needed, and nobody noticed the other half was unmet. A
  * predicate with a test and no caller is weaker than one with both, and much stronger
  * than a sentence in a specification. Its test drives it directly.
  *
@@ -697,35 +707,72 @@
 
   // ONE QUERY FOR THE WHOLE BATCH: the messages that reference AT LEAST ONE candidate,
   // each containment operand a bound value so the GIN index on `messages.attachments`
   // can be looked up rather than scanned. What comes back is the attachment arrays, and
   // the intersection is arithmetic in Node — cheaper than asking Postgres to unnest and
   // far easier to read than a lateral join nobody will revisit.
+  return unreferencedAmong(
+    db,
+    environmentId,
+    candidates.map((row) => row.id),
+  );
+}
+
+/** OF THESE OBJECT IDS, WHICH DOES NO SURVIVING MESSAGE REFERENCE?
+ *
+ * Called by `unreferencedMediaIn` above, which brings every old object in an
+ * environment, and by `sweepRetention` in `../retention/sweep.ts`, which brings the
+ * `media_id` values of the messages it has just destroyed. **The two populations are
+ * different and only the caller knows which one it means** — the sweep must not be
+ * handed the first, because it contains objects that were never attached to anything,
+ * and those are FR-MED-10's orphans rather than FR-MED-11's. On this lane that is 48
+ * objects in one environment: a sweep destroying them would be enforcing the wrong
+ * clause under a retention policy.
+ *
+ * ONE QUERY FOR THE WHOLE BATCH, AND IT REACHES THE INDEX. The operand of each
+ * containment test is a bound value rather than a column from the other side of a
+ * join, which is what chapter 4.12 measured the difference of: bound, the planner uses
+ * `messages_attachments_gin`; set-wise it cannot, and the same index sits idle under a
+ * parallel sequential scan. Measured here at 100 candidates — a `BitmapOr` over 100
+ * `Bitmap Index Scan`s, 976 buffers and 15.2 ms, about 9.8 buffers an object against
+ * 107 for a single one issued alone.
+ *
+ * **AN `OR` IS NOT ALWAYS A `Filter:`**, which is worth saying because chapter 4.18
+ * found the opposite for a keyset cursor written as one. A cursor's range predicates
+ * cannot be ORed into an index scan; containment predicates can, and this was checked
+ * rather than assumed. */
+export async function unreferencedAmong(
+  db: Db,
+  environmentId: string,
+  candidateIds: readonly string[],
+): Promise<string[]> {
+  if (candidateIds.length === 0) return [];
+
   const rows = await db
     .select({ attachments: sql<Attachment[] | null>`${messages.attachments}` })
     .from(messages)
     .innerJoin(channels, eq(channels.id, messages.channelId))
     .where(
       and(
         eq(channels.environmentId, environmentId),
         or(
-          ...candidates.map(
-            (row) =>
+          ...candidateIds.map(
+            (id) =>
               sql`${messages.attachments} @> ${JSON.stringify([
-                { type: "media", media_id: row.id },
+                { type: "media", media_id: id },
               ])}::jsonb`,
           ),
         ),
       ),
     );
   const referencedIds = new Set<string>();
   for (const row of rows)
     for (const attachment of row.attachments ?? [])
       if (attachment.type === "media") referencedIds.add(attachment.media_id);
 
-  return candidates.map((row) => row.id).filter((id) => !referencedIds.has(id));
+  return candidateIds.filter((id) => !referencedIds.has(id));
 }
 
 export async function recordMediaVerdict(
   db: Db,
   input: {
     id: string;
@@ -6827,7 +6874,281 @@
           eq(messages.channelId, channelId),
           eq(channels.environmentId, this.environmentId),
         ),
       )
       .orderBy(asc(messages.sequence));
   }
+
+  /** ONE PAGE OF THIS ENVIRONMENT'S EXPIRED MESSAGES — FR-MOD-06's predicate.
+   *
+   * Called by `sweepRetention` in `../retention/sweep.ts`, once per page per
+   * environment with a policy. The convention `CLAUDE.md` sets: a claim about when a
+   * symbol runs names the thing that runs it.
+   *
+   * THE BOUND IS A CONSTANT COMPUTED BY THE CALLER, which is the whole reason this is
+   * one query per environment rather than one join across all of them. Written as a
+   * join over every environment the age lands in a `Join Filter` — measured, 617
+   * buffers with `Rows Removed by Join Filter: 1018`. Per environment with the bound
+   * bound it is 73 and the planner reaches `channels_environment_last_activity`.
+   * **Neither is a speedup over the other**: 546 of that 617 is the scan of all 33,051
+   * environments, which the per-environment form pays too as its first step. What this
+   * shape buys is pageability and a predicate the planner can push into an index.
+   *
+   * KEYSET ON `(channel_id, created_at)`, which is what `messages_channel_created`
+   * exists for. Chapter 4.13's sweep read one page with an offset and the head never
+   * moved, so an object nobody uploaded to stayed `pending` for ever. And the cursor is
+   * a SQL row value rather than an `OR` chain: chapter 4.18 measured that an `OR`
+   * cursor lands in a `Filter:` and re-walks every earlier page. */
+  async expiredMessageIds(
+    olderThan: Date,
+    limit: number,
+    after?: { channelId: string; createdAt: Date },
+  ): Promise<
+    {
+      id: string;
+      channelId: string;
+      createdAt: Date;
+      attachments: Attachment[] | null;
+    }[]
+  > {
+    return this.db
+      .select({
+        id: messages.id,
+        channelId: messages.channelId,
+        createdAt: messages.createdAt,
+        // THE FORWARD HALF OF FR-MED-11, AND IT IS FREE. `attachments` is a jsonb
+        // column on the row the sweep already has in hand, so collecting the
+        // `media_id` values costs no second query. The expensive half is the reverse
+        // question — *is this object still referenced?* — which `unreferencedAmong`
+        // answers for the whole batch at once.
+        //
+        // AND IT MUST BE READ BEFORE THE DELETE, which is the one ordering constraint
+        // in this pair that is not obvious: after `destroyMessages` the rows are gone
+        // and so is every id they named.
+        attachments: sql<Attachment[] | null>`${messages.attachments}`,
+      })
+      .from(messages)
+      .innerJoin(channels, eq(channels.id, messages.channelId))
+      .where(
+        and(
+          eq(channels.environmentId, this.environmentId),
+          lt(messages.createdAt, olderThan),
+          after
+            ? sql`(${messages.channelId}, ${messages.createdAt}) > (${after.channelId}::uuid, ${after.createdAt})`
+            : undefined,
+        ),
+      )
+      .orderBy(asc(messages.channelId), asc(messages.createdAt))
+      .limit(limit);
+  }
+
+  /** DESTROY A PAGE OF EXPIRED MESSAGES, AND THE VERSION ROWS THEY OWN.
+   *
+   * Called by `sweepRetention` in `../retention/sweep.ts` and by nothing else. This is
+   * the one legitimate hard deletion outside FR-MOD-04's compliance endpoint, which
+   * ADR-36's first decision licenses by reading the constitution's *compliance path* as
+   * admitting a retention sweep.
+   *
+   * THE `SET LOCAL` IS THE MECHANISM AND THE WORD `LOCAL` IS THE GUARANTEE. Without it
+   * the flag outlives this transaction on a pooled connection and every later request
+   * can delete version rows — measured. And `SET LOCAL` outside a transaction block is
+   * a WARNING, not an error, which leaves the flag unset and every cascade refused in a
+   * way that looks exactly like the trigger working. Both failures are silent and they
+   * point in opposite directions, so the delete runs inside this explicit transaction
+   * and `retention.itest.ts` asserts the flag's VALUE at the moment of the delete.
+   *
+   * The version rows go by `ON DELETE CASCADE` rather than by a second statement here:
+   * a cascade keeps *a version cannot outlive its message* in the schema instead of in
+   * a procedure somebody maintains. `0025` records why that needed a trigger exception
+   * at all — a cascade issues an ordinary `DELETE` and a row trigger fires on it. */
+  /** DESTROY MEDIA OBJECTS AND THE RENDITIONS THAT HANG OFF THEM, returning what the
+   * caller needs to finish the job outside the database.
+   *
+   * Called by `sweepRetention` in `../retention/sweep.ts`, after the messages that
+   * referenced them are gone and after `unreferencedAmong` has confirmed no surviving
+   * message still names them. Nothing else deletes a `media_objects` row: chapter 4.15
+   * established that the rejection path removes bytes and keeps the row on purpose, so
+   * before this chapter the table only ever grew.
+   *
+   * **THE RENDITIONS GO BY CASCADE**, `media_objects_parent_fk`, which chapter 4.15
+   * chose precisely so a rendition's reachability is its parent's and no caller has to
+   * keep two deletes in step. The keys come back anyway, because the STORE has no
+   * foreign keys and the bytes have to be removed one request at a time.
+   *
+   * RETURNS THE ROWS RATHER THAN A COUNT because the caller owes two more things per
+   * object: a `deleteObjectWithRenditions` against the store, and a `deleted` storage
+   * event whose `bytesDelta` is negative (FR-013). Neither can be reconstructed from a
+   * number. */
+  async destroyMediaObjects(ids: readonly string[]): Promise<
+    {
+      id: string;
+      objectKey: string;
+      declaredBytes: number;
+      mimeType: string;
+      renditionKeys: string[];
+    }[]
+  > {
+    if (ids.length === 0) return [];
+
+    const scoped = and(
+      inArray(mediaObjects.id, [...ids]),
+      // THE TENANCY PREDICATE, AND HERE A MISS IS A LOSS RATHER THAN A LEAK.
+      eq(mediaObjects.environmentId, this.environmentId),
+      isNull(mediaObjects.parentId),
+    );
+
+    const parents = await this.db
+      .select({
+        id: mediaObjects.id,
+        objectKey: mediaObjects.objectKey,
+        declaredBytes: mediaObjects.declaredBytes,
+        // THE MIME TYPE RATHER THAN THE KIND. The storage event wants a `kind`, and
+        // `kindOf` is the one function that maps between them — it lives in `media/`
+        // and this file does not reach into a feature directory. The caller converts.
+        mimeType: mediaObjects.mimeType,
+      })
+      .from(mediaObjects)
+      .where(scoped);
+    if (parents.length === 0) return [];
+
+    const parentIds = parents.map((p) => p.id);
+    const renditions = await this.db
+      .select({ parentId: mediaObjects.parentId, objectKey: mediaObjects.objectKey })
+      .from(mediaObjects)
+      .where(inArray(mediaObjects.parentId, parentIds));
+
+    await this.db.delete(mediaObjects).where(scoped);
+
+    return parents.map((p) => ({
+      ...p,
+      renditionKeys: renditions
+        .filter((r) => r.parentId === p.id)
+        .map((r) => r.objectKey),
+    }));
+  }
+
+  /** Whether a media object row is still there. Called by `retention.itest.ts` only —
+   * `listMessagesRaw`'s convention, because lint keeps SQL in this directory. */
+  async mediaObjectExistsRaw(id: string): Promise<boolean> {
+    const rows = await this.db
+      .select({ id: mediaObjects.id })
+      .from(mediaObjects)
+      .where(
+        and(eq(mediaObjects.id, id), eq(mediaObjects.environmentId, this.environmentId)),
+      );
+    return rows.length > 0;
+  }
+
+  /** How many renditions hang off a parent object. Called by `retention.itest.ts`. */
+  async renditionCountRaw(parentId: string): Promise<number> {
+    const rows = await this.db
+      .select({ id: mediaObjects.id })
+      .from(mediaObjects)
+      .where(eq(mediaObjects.parentId, parentId));
+    return rows.length;
+  }
+
+  /** HOW MANY VERSION ROWS A MESSAGE OWNS. Called by `retention.itest.ts` only, which
+   * is `listMessagesRaw`'s convention: a test that needs SQL cannot write it, because
+   * `eslint.config.mjs` restricts `drizzle-orm` and `pg` to this directory. */
+  async versionRowCountRaw(messageId: string): Promise<number> {
+    const rows = await this.db
+      .select({ id: messageEdits.messageId })
+      .from(messageEdits)
+      .where(eq(messageEdits.messageId, messageId));
+    return rows.length;
+  }
+
+  /** Move a message's `created_at` back by whole days, each fixture to its own instant.
+   *
+   * Called by `retention.itest.ts` only. **Nothing on this lane is thirty days old** —
+   * the oldest message is 2026-09-14 and FR-MOD-06's shortest policy is thirty days —
+   * so every retention fixture is backdated and the chapter says so rather than
+   * implying it measured real traffic. */
+  async backdateMessageRaw(messageId: string, days: number): Promise<void> {
+    await this.db
+      .update(messages)
+      .set({ createdAt: sql`now() - make_interval(days => ${days})` })
+      .where(eq(messages.id, messageId));
+  }
+
+  /** An UPDATE the append-only trigger must refuse, flag or no flag.
+   *
+   * Called by `retention.itest.ts` only. It exists to be rejected: `TG_OP = 'DELETE'`
+   * is part of `0025`'s condition precisely so that expiry destroys rows and never
+   * rewrites one, and reading that condition is not testing it. */
+  async tamperVersionRowRaw(messageId: string): Promise<void> {
+    await this.db
+      .update(messageEdits)
+      .set({ priorText: "tampered" })
+      .where(eq(messageEdits.messageId, messageId));
+  }
+
+  /** A DELETE of the children with no flag set, which the trigger must still refuse.
+   *
+   * Called by `retention.itest.ts` only. The exception `0025` opens is one verb on one
+   * table reached one way; this is the same verb reached the other way. */
+  async deleteVersionRowsRaw(messageId: string): Promise<void> {
+    await this.db.delete(messageEdits).where(eq(messageEdits.messageId, messageId));
+  }
+
+  async destroyMessages(ids: string[]): Promise<number> {
+    if (ids.length === 0) return 0;
+    return this.db.transaction(async (tx) => {
+      await tx.execute(sql`SET LOCAL relay.expiring = 'on'`);
+      const destroyed = await tx
+        .delete(messages)
+        .where(
+          and(
+            inArray(messages.id, ids),
+            // THE TENANCY PREDICATE, AND IT IS NOT DECORATION. `ids` arrives from
+            // `expiredMessageIds`, which is already scoped — but this is a bulk DELETE,
+            // and constitution I's usual failure is a leak where this one is a loss.
+            // An id from another tenant reaching this list destroys that tenant's data.
+            inArray(
+              messages.channelId,
+              this.db
+                .select({ id: channels.id })
+                .from(channels)
+                .where(eq(channels.environmentId, this.environmentId)),
+            ),
+          ),
+        )
+        .returning({ id: messages.id });
+      return destroyed.length;
+    });
+  }
+}
+
+/** SET OR CLEAR AN ENVIRONMENT'S RETENTION POLICY — FR-MOD-06's only write.
+ *
+ * Called by `EnvironmentsController.patch` and by `retention.itest.ts`. Standalone
+ * rather than a `Repository` method because the caller already holds the environment
+ * id as the thing it is addressing, not as a scope it is reading within — and the
+ * controller resolves tenancy before it gets here.
+ *
+ * **`null` IS INDEFINITE AND IS NOT A MISSING FIELD.** FR-MOD-06's fourth option is
+ * *indefinite*, and the absence of a value is how this schema has spelled that since
+ * chapter 2.1. A client clearing a policy sends `null` explicitly; a client omitting
+ * the field changes nothing, and the two are different requests all the way down — the
+ * route's schema distinguishes them and so does this signature, which is why it takes
+ * `number | null` rather than `number | undefined`.
+ *
+ * The three legal values are enforced by `environments_retention_days_check` rather
+ * than here: the clause enumerates them, and a constraint is how an enumeration
+ * survives a caller nobody anticipated. */
+export async function setRetentionPolicy(
+  db: Db,
+  environmentId: string,
+  retentionDays: number | null,
+): Promise<{ id: string; name: string; retentionDays: number | null } | undefined> {
+  const [row] = await db
+    .update(environments)
+    .set({ retentionDays })
+    .where(eq(environments.id, environmentId))
+    .returning({
+      id: environments.id,
+      name: environments.kind,
+      retentionDays: environments.retentionDays,
+    });
+  return row;
 }
```

### `services/api/src/db/schema.ts` — the CHECK, the cascade, and the comment that said nothing read the column.

```diff title="services/api/src/db/schema.ts"
@@ -132,14 +132,17 @@
       .notNull()
       .references(() => applications.id),
     kind: text("kind").notNull(),
     // envelope-encrypted (NFR-SEC-02)
     signingSecret: text("signing_secret").notNull(),
     retentionDays: integer("retention_days"),
-    // DECLARED IN 2.1 AND STILL EMPTY. Named in SRS §6.1's Environment entity
-    // and SAD §338, read by nothing in seventeen chapters. THIS chapter
+    // DECLARED IN 2.1 AND READ BY NOTHING FOR SEVENTEEN CHAPTERS. Named in SRS
+    // §6.1's Environment entity and SAD §338, and set on 0 of 33,051 rows at
+    // the open of the chapter that finally reads it — `retention-reads.ts`
+    // enumerates the environments holding one and `sweep.ts` acts on them
+    // (FR-MOD-06). Bounded to the clause's three values below. THE chapter
     // deliberately did NOT put rate-limit policy here: the column is named for
     // quotas, quotas are a later chapter, and the distinction between a limit
     // that may be lost and a quota that is money is the thing this chapter is
     // about.
     // (Deliberately not a chapter NUMBER: the deduplication chapter renumbered
     // quotas once already, and a comment in a file fenced byte-exact into a
@@ -175,12 +178,23 @@
     // No trigger, no counting query, nothing to lose a race to.
     unique("environments_application_kind_unique").on(t.applicationId, t.kind),
     check(
       "environments_rest_limit_non_negative",
       sql`${t.restLimitPerMinute} IS NULL OR ${t.restLimitPerMinute} >= 0`,
     ),
+    // CHAPTER 4.20. FR-MOD-06 enumerates 30 / 90 / 365 days / indefinite rather
+    // than describing a range, so `45` is not a stricter policy a customer
+    // chose — it is a value nothing in the specification licenses, and a sweep
+    // acting on it would enforce a promise nobody made. NULL is indefinite,
+    // which is this column's own existing spelling for it rather than a fourth
+    // sentinel value. Added by `0024` against 0 of 33,051 rows, so it validated
+    // against an empty set.
+    check(
+      "environments_retention_days_check",
+      sql`${t.retentionDays} IS NULL OR ${t.retentionDays} IN (30, 90, 365)`,
+    ),
     check(
       "environments_send_limit_non_negative",
       sql`${t.sendLimitPerMinute} IS NULL OR ${t.sendLimitPerMinute} >= 0`,
     ),
     check(
       "environments_connect_limit_non_negative",
@@ -473,15 +487,28 @@
 // NO `environment_id`, exactly like `messages` above. The tenant is reached
 // through `message_id -> messages -> channels`, which is how every read below
 // the boundary already scopes (constitution I).
 export const messageEdits = pgTable(
   "message_edits",
   {
+    // CHAPTER 4.20 MADE THIS A CASCADE, and by itself that changed nothing —
+    // which is the measurement that shaped the design. A cascade issues an
+    // ordinary `DELETE` against this table and `message_edits_append_only` is a
+    // ROW trigger, so it fires on the generated statement and refuses it; the
+    // error even names it, `DELETE FROM ONLY "public"."message_edits"`. The
+    // cascade needs `0025`'s named exception to work at all.
+    //
+    // IT IS STILL RIGHT FOR A REASON INDEPENDENT OF EXPIRY: a version row must
+    // not outlive its message. Without the cascade the sweep would carry an
+    // ordered two-step delete in application code and that invariant would live
+    // in a procedure somebody maintains rather than in the schema — which is
+    // the distinction chapter 4.15 drew when it gave a rendition's reachability
+    // to a composite foreign key rather than to a predicate.
     messageId: uuid("message_id")
       .notNull()
-      .references(() => messages.id),
+      .references(() => messages.id, { onDelete: "cascade" }),
     editedAt: timestamp("edited_at", { withTimezone: true }).notNull(),
     // FR-MSG-07: what the message said before this edit. NOT NULL.
     //
     // THIS COMMENT USED TO EXPLAIN AN ABSENCE AS A NECESSITY, and four chapters
     // read past the gap because of it. It said: "a deletion writes no row here,
     // because a tombstone has no text to preserve". That is true of the row
```

### `services/api/src/app.module.ts` — the first environments module this platform has had.

```diff title="services/api/src/app.module.ts"
@@ -27,12 +27,13 @@
 import { ProtocolErrorFilter } from "./protocol-error.filter";
 import { LimitsModule } from "./limits/limits.module";
 import { RateLimitMiddleware } from "./limits/rate-limit.middleware";
 import { RequestContextMiddleware } from "./request-context.middleware";
 import { RequestLogMiddleware, requestLogEnabled } from "./request-log/request-log.middleware";
 import { AuditModule } from "./audit/audit.module";
+import { EnvironmentsModule } from "./environments/environments.module";
 import { RequestLogModule } from "./request-log/request-log.module";
 import { ANALYTICS_PUBLISHER } from "./webhooks/analytics";
 import { createJetStreamPublisher, ensureAnalyticsStream } from "./outbox/jetstream.publisher";
 import type { Publisher } from "./outbox/publisher";
 
 // The application described as a module graph — ADR-15's convention for the
@@ -55,12 +56,13 @@
     LimitsModule,
     // Chapter 4.8's read surface. Registered here for the reason `ChannelsModule` and
     // `UsersModule` are: without this line the module compiles, is imported by nothing,
     // and the route does not exist — which `pnpm build` would not notice and the
     // cross-tenant gauntlet would, because it derives its targets from the router.
     AuditModule,
+    EnvironmentsModule,
     RequestLogModule,
     // HOSTED MEDIA, AND THIS LINE IS THE WHOLE OF WHETHER THE ROUTE EXISTS. A module
     // written, tested and never registered gives a 404 that reads as a routing bug
     // rather than as a missing import — chapter 4.6's `Unknown chapter id`, one
     // repository over.
     MediaModule,
```

### `services/api/src/isolation/targets.ts` — one more route to classify, and the id in the path is the tenant's own.

```diff title="services/api/src/isolation/targets.ts"
@@ -278,12 +278,19 @@
   { method: "POST", path: "/v1/channels/:channelId/join", accepts: "user", shape: "write" },
   { method: "POST", path: "/v1/channels/:channelId/members/remove", accepts: "application", shape: "write" },
   { method: "PATCH", path: "/v1/channels/:channelId/members/:userExternalId", accepts: "application", shape: "write" },
   { method: "POST", path: "/v1/channels/:channelId/archive", accepts: "application", shape: "write" },
   { method: "DELETE", path: "/v1/channels/:channelId/archive", accepts: "application", shape: "write" },
 
+  // ── the retention policy (chapter 4.20) ────────────────────────────────────────
+  // THE FIRST ENVIRONMENT-LEVEL ROUTE THIS PLATFORM HAS HAD, and the id in the path is
+  // the tenant's own environment — so a forged one is the attack, and the controller
+  // answers 404 rather than 403 because a refusal naming the cause reports whether
+  // somebody else's environment exists.
+  { method: "PATCH", path: "/v1/environments/:environmentId", accepts: "application", shape: "write" },
+
   // ── the webhook surface (this chapter), and the derivation named all seven ─────
   //
   // ELEVEN ROUTES ARRIVED AND THE LEDGER SAID SIX. This chapter's rows were deferred
   // from the harness chapter by a note that counted the `/v1/webhooks*` paths and not
   // the internal seam beneath them; `targets.itest.ts` went red naming eleven, which is
   // the third time a count in this feature's own records has been low and the first time
```

### `services/api/src/isolation/gauntlet.itest.ts` — the attack, which reads the policy column because a message listing cannot see it.

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -8,12 +8,13 @@
 
 import { AppModule } from "../app.module";
 import { createAnalyticalStore } from "../metering/clickhouse";
 import { mintUserToken } from "../auth/user-token";
 import { environmentSigningSecret, Repository, usageFor } from "../db/repository";
 import { createDb, createPool } from "../db/client";
+import { retentionDaysOf } from "../db/retention-reads";
 import {
   credentialAttack,
   listAttack,
   readAttack,
   rowsOf,
   send,
@@ -288,12 +289,45 @@
     expect(verdict.foreign.status).toBe(404);
     // THE STATE READ IS WHAT A STATUS CANNOT SAY. The listing carries `text` and
     // `edited_at`, so a 404 that completed the edit shows up here and nowhere else.
     expect(verdict.stateChanged, "the victim's message text or edited_at moved").toBe(false);
   });
 
+  it("PATCH /v1/environments/:id — a foreign environment's retention policy is not set", async () => {
+    attacked.add("PATCH /v1/environments/:environmentId");
+    // THE WORST THING AN ATTACKER CAN DO TO ANOTHER TENANT ON THIS SURFACE IS NOT A
+    // READ. Setting a thirty-day policy on somebody else's environment arms a sweep to
+    // destroy their history, and `reset-lane.mjs` does not restore lane data by design.
+    // So constitution I's usual failure — a leak — is not the one to probe here; the
+    // failure is a LOSS, and the state read below is what would catch it.
+    const verdict = await writeAttack(
+      url,
+      t.attacker.credential,
+      {
+        method: "PATCH",
+        path: `/v1/environments/${t.victim.environmentId}`,
+        body: { retention_days: 30 },
+      },
+      {
+        method: "PATCH",
+        path: `/v1/environments/${ABSENT_UUID}`,
+        body: { retention_days: 30 },
+      },
+      () => t.victim.repo.listMessages(t.victim.channelId, { limit: 50 }),
+    );
+    expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+    // 404 AND NOT 403, because a refusal naming the cause reports whether somebody
+    // else's environment exists — chapter 4.11's rule for media objects, and the same
+    // argument applies to an id a caller can guess.
+    expect(verdict.foreign.status).toBe(404);
+    expect(verdict.stateChanged, "the victim's messages moved").toBe(false);
+    // AND THE POLICY ITSELF, which the message listing cannot see. A 404 that wrote the
+    // column anyway leaves no trace in any other assertion in this suite.
+    expect(await retentionDaysOf(db, t.victim.environmentId)).toBeNull();
+  });
+
   it("DELETE .../messages/:messageId — a foreign message is not tombstoned", async () => {
     attacked.add("DELETE /v1/channels/:channelId/messages/:messageId");
     const verdict = await writeAttack(
       url,
       // A KEY, and this route inherits `@Accepts("application", "user")` from the class
       // rather than narrowing it, so the application half is the one attacked here — a
```

### `vitest.coverage.config.mts` — four pins, and the one the dry-run test raised.

The sixth billed file, and the one that cannot be hunked with the other five:
the pins are measured after the chain is already at zero, so this edit lands
after the appendix was last correct. Chapter 4.18's first red CI run was exactly
this file touched after the last `check:fences`.

```diff title="vitest.coverage.config.mts"
@@ -1492,12 +1492,51 @@
         "services/api/src/db/audit-reads.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
         },
+        // CHAPTER 4.20. Four new files, pinned BELOW the measured value by the swing
+        // `session.ts` demonstrated — 87.80% and 85.36% on identical code twenty
+        // minutes apart — because a floor at the measurement goes red for no change to
+        // the code, and the fix is then to lower it: a ratchet that teaches people to
+        // lower ratchets.
+        "services/api/src/db/retention-reads.ts": {
+          // 100 / 75 / 100 measured. The branch arm is the `retentionDays!` narrowing
+          // of a column the WHERE has already excluded nulls from, and `?? null` in
+          // `expiringFlag` for a row that is always present.
+          branches: 70,
+          functions: 100,
+          lines: 95,
+          statements: 95,
+        },
+        "services/api/src/environments/environments.controller.ts": {
+          // 90 / 87.5 / 100 measured.
+          branches: 80,
+          functions: 100,
+          lines: 85,
+          statements: 85,
+        },
+        "services/api/src/environments/environments.schema.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // `sweep.ts` MEASURED 63.79 / 47.82 / 60 AND THE ANSWER WAS A TEST, NOT A LOW
+        // PIN. The dry run was the largest uncovered arm and the quickstart tells an
+        // operator to run it first — after 2026-10-14 it is the only thing between a
+        // thirty-day policy and real lane data, so a dry run that quietly destroyed
+        // would be the worst defect this chapter could ship. What remains uncovered is
+        // the `require.main` CLI block, which no test can enter.
+        "services/api/src/retention/sweep.ts": {
+          branches: 55,
+          functions: 60,
+          lines: 65,
+          statements: 65,
+        },
         // THE CURSOR WAS RAISED, NOT PINNED WHERE IT LANDED. It measured 88.23 / 80 on
         // the first run, with lines 70-72 uncovered: a token whose instant is outside
         // anything the column can hold, and one whose id is 36 characters and not a
         // uuid. Both arms are reachable and neither had a test. `cursor.test.ts` drives
         // them — chapter 4.13's `shape.ts`, raised rather than lowered, and it runs in
         // the Docker-free lane because a cursor is arithmetic.
```

## Chapter 4.21 — erasure

Ten hunks across six files, placed last because the appendix applies after every
chapter and these are the newest. Generated from `check:fences --dump`, the
checker's own replay, and every pre-image verified to match exactly once at `-U6`
before anything was pasted.

**The bill said six files and the chain charged six, and they are not the same
six.** `users.service.ts` is charged and `research.md`'s table has no row for it;
`schema.ts` is not charged, because this chapter adds no column. And
`clickhouse.ts` took the most consequential change in the chapter — bound
parameters on a shared client — and is titled on **0 pages**, so it costs the
chain nothing.

```diff title="services/api/src/db/repository.ts"
@@ -4451,12 +4451,159 @@
         });
       }
       return true;
     });
   }
 
+  /** Erase an end user — FR-MOD-04's traversal through every Postgres store that
+   * names them. The analytical half is `users/erasure.ts`; constitution III keeps the
+   * two apart and the receipt reports them separately.
+   *
+   * **THIS IS NOT `deleteUser`, AND THE DIFFERENCE IS THE POINT.** That method is
+   * FR-USR-05's and keeps the row, the messages and the `usage_active_users` rows ON
+   * PURPOSE. This one keeps the messages and the billing rows for the same two clauses
+   * and destroys everything that identifies the person, `external_id` included.
+   * `erasure.itest.ts` asserts the two side by side so they cannot drift together.
+   *
+   * ## WHY THE ROW SURVIVES, WHICH IS THE WHOLE STRUCTURE IN ONE PARAGRAPH
+   *
+   * FR-USR-05 keeps the messages — *"preserving their messages as authored by a
+   * deleted user"* — so `messages.user_id` stays. All five foreign keys to
+   * `users` are `NO ACTION`, so the row is then unreachable: there is no "delete the
+   * row last", because there is no deleting it at all. `erasure.itest.ts`'s first test
+   * is that refusal, with a control.
+   *
+   * And that is what makes the rest legal. The row becomes a tombstone holding nothing,
+   * so every other store that references the user BY KEY — `usage_active_users`, the
+   * `uniq` sketches — stops naming anybody without being touched. One decision, three
+   * consequences, and `baseline.txt`'s T010 and T011 carry the argument.
+   *
+   * ## `external_id` IS REPLACED, NOT CLEARED, AND THE COLUMN IS WHY
+   *
+   * It is `NOT NULL` under `users_environment_id_external_id_unique`, so there is no
+   * null to write. The replacement is `erased:<users.id>` — unique by construction
+   * because the uuid is the primary key, and non-identifying for exactly the reason
+   * T011 established. **The two decisions hold each other up**: without the key
+   * argument there would be no safe value to put here.
+   *
+   * A SECOND ERASURE THEREFORE ANSWERS 404, not a 200 with an empty receipt, because
+   * no user has that external id any more. `contracts/erasure.md` carries the cost and
+   * why a hash is refused.
+   *
+   * `description` IS NOT CLEARED, for FR-004a's reason one method down: it says what a
+   * bot IS, and clearing it violates `users_bot_description_check`, which would make a
+   * bot the one kind of user that cannot be erased.
+   *
+   * RETURNS THE MEDIA ROWS rather than a count, because the caller owes a
+   * `deleteObjectWithRenditions` and a negative `deleted` storage event per object —
+   * `destroyMediaObjects`' convention, and neither is reconstructable from a number. */
+  async eraseUser(
+    userId: string,
+    userExternalId: string,
+  ): Promise<{
+    profile: number;
+    readPositions: number;
+    memberships: number;
+    messagesRetained: number;
+    activeUserRowsRetained: number;
+    media: Awaited<ReturnType<Repository["destroyMediaObjects"]>>;
+  }> {
+    // THE MEDIA IDS COME OUT BEFORE THE TRANSACTION, because `destroyMediaObjects`
+    // opens one of its own. Collecting them first is also the ordering rule
+    // `data-model.md` states: a value that lives on a row the traversal destroys has
+    // to be read before the row goes. Chapter 4.20 paid this with `media_id`.
+    const owned = await this.db
+      .select({ id: mediaObjects.id })
+      .from(mediaObjects)
+      .where(
+        and(
+          eq(mediaObjects.userId, userId),
+          eq(mediaObjects.environmentId, this.environmentId),
+          isNull(mediaObjects.parentId),
+        ),
+      );
+
+    const media = await this.destroyMediaObjects(owned.map((o) => o.id));
+
+    return this.db.transaction(async (tx) => {
+      const [alive] = await tx
+        .select({ id: users.id, deletedAt: users.deletedAt })
+        .from(users)
+        .where(and(eq(users.id, userId), eq(users.environmentId, this.environmentId)))
+        .limit(1);
+      if (alive === undefined) {
+        throw new Error(`eraseUser: no user ${userId} in this environment`);
+      }
+
+      const positions = await tx
+        .delete(readPositions)
+        .where(eq(readPositions.userId, userId))
+        .returning({ userId: readPositions.userId });
+      const memberships = await tx
+        .delete(members)
+        .where(eq(members.userId, userId))
+        .returning({ userId: members.userId });
+
+      // COUNTED, NOT DELETED. Both are `retained_anonymous` on the receipt: the rows
+      // stay under a named clause and the key they carry now resolves to a tombstone.
+      // The counts are what let the receipt say so with a number instead of a promise.
+      const retainedMessages = await tx
+        .select({ id: messages.id })
+        .from(messages)
+        .where(eq(messages.userId, userId));
+      const retainedActive = await tx
+        .select({ userId: usageActiveUsers.userId })
+        .from(usageActiveUsers)
+        .where(
+          and(
+            eq(usageActiveUsers.userId, userId),
+            eq(usageActiveUsers.environmentId, this.environmentId),
+          ),
+        );
+
+      await tx
+        .update(users)
+        .set({
+          displayName: null,
+          avatarUrl: null,
+          metadata: {},
+          externalId: `erased:${userId}`,
+          deletedAt: alive.deletedAt ?? new Date(),
+        })
+        .where(eq(users.id, userId));
+
+      // FR-013, AND THE ENTRY CARRIES THE NAME IT JUST ERASED.
+      //
+      // `targetId` is the EXTERNAL id, as every other user-target entry in this log
+      // is — 1,357 of 1,357, not one of them a uuid. Writing the uuid instead was
+      // considered and refused: this entry is the operator's only proof the erasure
+      // happened, and FR-MOD-03's log exists to demonstrate exactly that. The log is
+      // append-only (ADR-35), so the receipt reports it as `cannot_erase` and the
+      // chapter says plainly that the one place the name survives is the record that
+      // the name was erased.
+      //
+      // UNCONDITIONAL, unlike `deleteUser`'s. That method skips the entry on a second
+      // call because the user was already deleted; a second erasure cannot reach this
+      // line at all, because the external id it would be called with no longer exists.
+      await this.recordAction(tx, {
+        action: ACTION.eraseUser,
+        targetKind: "user",
+        targetId: userExternalId,
+      });
+
+      return {
+        profile: 1,
+        readPositions: positions.length,
+        memberships: memberships.length,
+        messagesRetained: retainedMessages.length,
+        activeUserRowsRetained: retainedActive.length,
+        media,
+      };
+    });
+  }
+
   /** Write a user's profile (FR-023, FR-024).
    *
    * THE FIRST WRITER `users.avatar_url` AND `users.metadata` HAVE EVER HAD. Both columns
    * have been in the schema since chapter 2.1 with zero references outside tests — two of
    * the four columns this feature was specified to give readers, and giving them a reader
    * meant giving them a writer first.
@@ -7088,12 +7235,32 @@
    * Called by `retention.itest.ts` only. The exception `0025` opens is one verb on one
    * table reached one way; this is the same verb reached the other way. */
   async deleteVersionRowsRaw(messageId: string): Promise<void> {
     await this.db.delete(messageEdits).where(eq(messageEdits.messageId, messageId));
   }
 
+  /** Delete the `users` row itself, with nothing cleared first.
+   *
+   * Called by `erasure.itest.ts` only — `listMessagesRaw`'s convention, because
+   * `eslint.config.mjs` keeps `drizzle-orm` inside this directory.
+   *
+   * IT EXISTS TO BE REFUSED. All five foreign keys to `users` are `NO ACTION`, so a
+   * row with any child anywhere is unreachable and the error names the key that
+   * stopped it. That refusal is why `eraseUser` traverses children first and the row
+   * last: the order is a correctness property rather than a preference, and the only
+   * way to show it is to try the row on its own and be told no. The control — the
+   * same statement against a user with no children — is what makes the refusal mean
+   * the keys rather than a broken call. */
+  async deleteUserRowRaw(userId: string): Promise<number> {
+    const gone = await this.db
+      .delete(users)
+      .where(and(eq(users.id, userId), eq(users.environmentId, this.environmentId)))
+      .returning({ id: users.id });
+    return gone.length;
+  }
+
   async destroyMessages(ids: string[]): Promise<number> {
     if (ids.length === 0) return 0;
     return this.db.transaction(async (tx) => {
       await tx.execute(sql`SET LOCAL relay.expiring = 'on'`);
       const destroyed = await tx
         .delete(messages)
```

```diff title="services/api/src/isolation/targets.ts"
@@ -142,12 +142,24 @@
     method: "DELETE",
     path: "/v1/users/:externalId",
     accepts: "application",
     shape: "write",
   },
 
+  // FR-MOD-04's erasure, and `write` for a reason the other entries here do not have.
+  // Constitution I's usual failure is a LEAK — a tenant reads what is not theirs — and
+  // this one is a LOSS. A forged erasure that answers 404 and destroys the rows anyway
+  // leaves nothing for a read-shaped assertion to find, so the attack in
+  // `gauntlet.itest.ts` asks what SURVIVED rather than what came back.
+  {
+    method: "DELETE",
+    path: "/v1/users/:externalId/data",
+    accepts: "application",
+    shape: "write",
+  },
+
   // The ban pair, both `write`. The attack is a foreign external id: a
   // tenant must not be able to ban another tenant's user, and the refusal is the 404 a
   // user who does not exist in THIS environment gets — which is what they are.
   {
     method: "POST",
     path: "/v1/users/:externalId/ban",
```

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -1164,12 +1164,56 @@
     // And the attacker's own row IS deleted, which is what makes the assertion above
     // about scoping rather than about the delete failing altogether.
     const mine = await t.attacker.repo.getUserByExternalId(shared);
     expect(mine?.deleted_at ?? null, "the caller's own user was not deleted").not.toBeNull();
   });
 
+  it("DELETE /v1/users/:externalId/data — the erasure takes one tenant's user", async () => {
+    attacked.add("DELETE /v1/users/:externalId/data");
+    // THE SAME COLLISION AS THE DELETE ABOVE, AND A HARDER ASSERTION, because
+    // constitution I's usual failure here is a LOSS rather than a leak. An erasure
+    // that answers 404 and destroys the rows anyway leaves nothing for a read-shaped
+    // assertion to find, so this one asks what SURVIVED.
+    const shared = `gauntlet-erase-${randomUUID().slice(0, 8)}`;
+    const victim = await t.victim.repo.createUser(shared, "the victim's own");
+    await t.attacker.repo.createUser(shared, "the attacker's own");
+
+    const channel = await t.victim.repo.createChannel(shared, "public");
+    await t.victim.repo.addMember(channel.id, victim.id);
+
+    const res = await fetch(`${url}/v1/users/${shared}/data`, {
+      method: "DELETE",
+      headers: { authorization: `Bearer ${t.attacker.credential}` },
+    });
+    // 200, because the attacker genuinely has a user with that id and erasing their
+    // own is the correct outcome. A 404 here would make the test pass for the wrong
+    // reason — a scoping bug and a correct refusal are the same status code.
+    expect(res.status).toBe(200);
+
+    // THE VICTIM'S USER IS STILL THERE, STILL NAMED, STILL A MEMBER. Erasure replaces
+    // `external_id`, so the victim's row is unreachable by that id if it leaked —
+    // which is why the lookup itself is the assertion.
+    const after = await t.victim.repo.getUserByExternalId(shared);
+    expect(after, "the victim's user was erased by the attacker").not.toBeNull();
+    expect(after?.display_name, "the victim's profile was cleared").toBe(
+      "the victim's own",
+    );
+    // `listMembers` returns user ids, so the membership is checked by the victim's
+    // own uuid rather than by a shape the method does not return.
+    const stillAMember = await t.victim.repo.listMembers(channel.id);
+    expect(
+      stillAMember,
+      "the victim's membership was deleted by the attacker",
+    ).toContain(victim.id);
+
+    // And the attacker's own IS gone, which is what makes the above about scoping
+    // rather than about the erasure failing altogether.
+    const mine = await t.attacker.repo.getUserByExternalId(shared);
+    expect(mine, "the caller's own user was not erased").toBeNull();
+  });
+
   // ── the profile: a read pair and a write pair over the same path ────────────────
   //
   // Two routes on one path, and they take different attacks: `GET` is a read pair —
   // the foreign external id and one that exists nowhere must be indistinguishable —
   // and `PATCH` is a write, so the victim's own row has to be read back afterwards.
   //
```

```diff title="services/api/src/users/users.module.ts"
@@ -6,12 +6,19 @@
 import { createDb, createPool, type Db } from "../db/client";
 import { Repository } from "../db/repository";
 import { UsersController } from "./users.controller";
 import { UsersService } from "./users.service";
 import type { RequestWithTenant } from "../messages/request-with-tenant";
 import { actorFrom } from "../audit/actor";
+import { LOGGER, apiLogger } from "../logger";
+import {
+  createJetStreamPublisher,
+  ensureAnalyticsStream,
+} from "../outbox/jetstream.publisher";
+import type { Publisher } from "../outbox/publisher";
+import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
 
 // The channels module's shape, for the channels module's reasons.
 //
 // A SEPARATE MODULE AND NOT A ROUTE ON `ChannelsController`. Five SRS clauses need
 // routes whose subject is a user — the listing, the profile read, the upsert, the
 // deletion, the ban — and hanging them off the channels controller would put user
@@ -34,10 +41,25 @@
         new Repository(
           db,
           req.principal?.environmentId ?? "",
           actorFrom(req),
         ),
     },
+    // A FOURTH COPY OF THIS FACTORY, and `internal.module.ts` states the rule that
+    // forces it: *"a provider is visible to the module that declares it and to nothing
+    // it imports"*. 4.21's erasure destroys a user's uploads and owes a negative
+    // `deleted` storage delta for each — the operational quota recomputes from the rows
+    // and the analytical meter does not, so a skipped delta is a permanent overcount.
+    //
+    // AND DECLARING A SERVICE WITHOUT ITS PROVIDERS COMPILES, TYPECHECKS AND LINTS,
+    // then fails at the first request with `Nest can't resolve dependencies` — 4.10's
+    // finding, and the reason this module is edited at all.
+    {
+      provide: ANALYTICS_PUBLISHER,
+      useFactory: (): Publisher =>
+        createJetStreamPublisher({ ensure: ensureAnalyticsStream }),
+    },
+    { provide: LOGGER, useFactory: () => apiLogger() },
     UsersService,
   ],
 })
 export class UsersModule {}
```

```diff title="services/api/src/users/users.service.ts"
@@ -1,10 +1,19 @@
-import { HttpStatus, Injectable, NotFoundException } from "@nestjs/common";
+import { HttpStatus, Inject, Injectable, NotFoundException } from "@nestjs/common";
+
+import type { Logger } from "@relay/service-kit";
 
 import { protocolError } from "../protocol-error";
 import { Repository, type UserRow } from "../db/repository";
+import { LOGGER } from "../logger";
+import { deleteObjectWithRenditions, storeConfig } from "../media/store";
+import { kindOf } from "../media/kinds";
+import { publishStorageDelta } from "../metering/storage-event";
+import { ANALYTICS_PUBLISHER } from "../webhooks/analytics";
+import type { Publisher } from "../outbox/publisher";
+import { eraseFromAnalyticalStore, type StoreResult } from "./erasure";
 import {
   encodeCursor,
   type ListingQuery,
   type UpsertUsersBody,
   type UserProfileBody,
 } from "./users.schema";
@@ -16,13 +25,17 @@
  * distinction four documents got wrong for twelve analysis passes, because FR-015's
  * "a channel the caller is not a member of MUST NOT appear in their listing" is
  * vacuous when the caller is an application key: a key is a member of nothing and an
  * empty list satisfied it. The requirement is about the user the PATH names. */
 @Injectable()
 export class UsersService {
-  constructor(private readonly repo: Repository) {}
+  constructor(
+    private readonly repo: Repository,
+    @Inject(ANALYTICS_PUBLISHER) private readonly analytics: Publisher,
+    @Inject(LOGGER) private readonly logger: Logger,
+  ) {}
 
   /** A deleted user is a 404 on every route that names them (FR-017).
    *
    * The row survives deletion — a message keeps its author, and `toFrame` drops a
    * senderless row, so "authored by a deleted user" and "authored by nobody" are
    * different states and only one of them is the clause. The marker is what makes the
@@ -228,12 +241,110 @@
     const user = await this.repo.getUserByExternalId(externalId);
     if (!user) throw new NotFoundException("user not found");
     await this.repo.deleteUser(user.id, externalId);
     return { external_id: externalId, deleted: true };
   }
 
+  /** Erase an end user from every store that can remove them (FR-MOD-04).
+   *
+   * NOT `deleteUser`, which is the method directly above and keeps the row, the
+   * messages and the billing rows on purpose. The two verbs sit next to each other
+   * here for the same reason their routes do: `contracts/erasure.md` argues that two
+   * operations differing only in what they preserve must not differ only in a flag,
+   * and side by side they are harder to confuse than in two files.
+   *
+   * A SECOND ERASURE IS A 404 AND THAT INVERTS THE OBVIOUS ANSWER. The traversal
+   * replaces `external_id`, so after the first call no user has the one in the path.
+   * `deleteUser` above goes to some trouble to answer 200 twice; this cannot, and a
+   * hash kept on the tombstone to make it possible is refused — `u-4821` and an email
+   * address are both brute-forceable, so a hash is the identity wearing a disguise.
+   * **The operator's proof is the audit entry**, which is append-only by design. */
+  async eraseUser(externalId: string): Promise<{
+    user_external_id: string;
+    requested_at: string;
+    completed_at: string;
+    stores: StoreResult[];
+  }> {
+    const requestedAt = new Date();
+    const user = await this.repo.getUserByExternalId(externalId);
+    if (!user) throw new NotFoundException("user not found");
+
+    const erased = await this.repo.eraseUser(user.id, externalId);
+
+    // THE BYTES AND THE DELTAS, OUTSIDE THE TRANSACTION AND ONE REQUEST PER OBJECT.
+    // The store has no foreign keys and nothing cascades there, and a publish inside a
+    // transaction that rolled back would emit a delta for an object that still exists
+    // — `storage-event.ts` makes both arguments. The operational quota recomputes from
+    // the rows and the analytical meter does not, which is what makes a skipped delta
+    // a permanent overcount rather than a blip.
+    for (const row of erased.media) {
+      await deleteObjectWithRenditions(
+        storeConfig(),
+        row.objectKey,
+        row.renditionKeys,
+      );
+      void publishStorageDelta(this.analytics, this.logger, {
+        environmentId: this.repo.environment,
+        mediaId: row.id,
+        cause: "deleted",
+        kind: kindOf(row.mimeType) ?? "image",
+        // NEGATIVE, AND CARRIED RATHER THAN DERIVED FROM `cause`: a reader that infers
+        // the sign puts the rule in a second place.
+        bytesDelta: -row.declaredBytes,
+        occurredAt: new Date(),
+      });
+    }
+
+    // THE ANALYTICAL HALF RUNS AFTER THE OPERATIONAL ONE HAS COMMITTED, and its
+    // failure is a receipt line rather than an exception. Constitution III: a
+    // ClickHouse outage must not roll back an erasure that has already destroyed a
+    // person's profile, their external id and their uploads.
+    const analytical = await eraseFromAnalyticalStore(
+      this.repo.environment,
+      externalId,
+    );
+
+    return {
+      user_external_id: externalId,
+      requested_at: requestedAt.toISOString(),
+      completed_at: new Date().toISOString(),
+      stores: [
+        { store: "profile", outcome: "erased", rows: erased.profile,
+          note: "display_name, avatar_url, metadata AND external_id" },
+        { store: "memberships", outcome: "erased", rows: erased.memberships },
+        { store: "read_positions", outcome: "erased", rows: erased.readPositions },
+        // THE NOTE IS THE POINT, NOT THE COUNT. `media_objects.user_id` is nullable
+        // and 73.6% of objects on this platform record no uploader — 11,173 of
+        // 15,189 — so an erasure that takes the attributed ones is correct AND
+        // incomplete. The receipt is where that gets said; a comment in the source
+        // would be true and unread by the person who needs it.
+        { store: "media_objects", outcome: "erased", rows: erased.media.length,
+          note: "attributed uploads only; 73.6% of objects platform-wide record no uploader" },
+        // NO CLAUSE IDS IN A NOTE, AND IT IS NOT A STYLE RULE. This body is read by a
+        // compliance officer at a CUSTOMER, who has no access to this platform's
+        // specification — `FR-028` in a receipt is a string they cannot resolve by
+        // any means available to them. The reason goes in words or it does not go.
+        //
+        // (And the two ids the first draft used were feature-local to the chapter
+        // that built `deleteUser`, so they do not resolve inside this repository
+        // either: there is no FR-028 in `docs/04-srs.md`. The messages clause is
+        // FR-USR-05; the billing one is an argument in `deleteUser`'s own comment
+        // and no clause at all.)
+        { store: "messages", outcome: "retained_anonymous",
+          rows: erased.messagesRetained,
+          note: "kept: a channel's history must not lose one participant's half of every conversation. The author is erased and the text is not" },
+        { store: "usage_active_users", outcome: "retained_anonymous",
+          rows: erased.activeUserRowsRetained,
+          note: "kept: usage already invoiced. The rows count a user per period and name nobody once the profile is erased" },
+        ...analytical,
+        { store: "audit_log", outcome: "cannot_erase",
+          note: "target_id holds the external id and the log is append-only (ADR-35)" },
+      ],
+    };
+  }
+
   /** Ban and unban, tenant-wide (FR-031, FR-032).
    *
    * BOTH IDEMPOTENT AND BOTH 200. Banning a banned user and unbanning an unbanned one
    * are the ordinary outcomes of a retry, and the caller's intent is satisfied either
    * way. A 409 here would make a customer's reconciliation loop — "ensure these users
    * are banned" — have to distinguish success from success.
```

```diff title="services/api/src/users/users.controller.ts"
@@ -138,12 +138,33 @@
   /** Delete a user, keeping their row and their messages (FR-027). */
   @Delete(":externalId")
   async deleteUser(@Param("externalId") externalId: string) {
     return this.users.deleteUser(externalId);
   }
 
+  /** Erase a user — everything about them that any store can remove (FR-MOD-04).
+   *
+   * `/data` ON THE END, AND NOT A FLAG ON THE ROUTE ABOVE. That one is FR-USR-05's
+   * deletion and keeps the row, the messages and the billing rows on purpose. Two
+   * verbs that differ only in what they preserve must not differ only in a query
+   * parameter: a mistyped flag would be an irreversible erasure, and the path is the
+   * thing a reader of the call site sees. `contracts/erasure.md` carries it.
+   *
+   * NO `@Body()`, AND THAT IS WHY CONSTITUTION VI's FIFTH BULLET IS NOT ENGAGED rather
+   * than unmet. The bullet governs endpoints that take input; this one takes a path
+   * parameter. Measured against the bodyless `DELETE` above: `{"totally":"unknown"}`
+   * and `{}` answer identically, because no decorator exists to parse either.
+   *
+   * THE CREDENTIAL IS THE CLASS'S DECISION, not a branch in here. `@Accepts(
+   * "application")` at the top of this file refuses a user token before the handler
+   * runs — which chapter 4.18 found is the arm nothing had tested, one route over. */
+  @Delete(":externalId/data")
+  async eraseUser(@Param("externalId") externalId: string) {
+    return this.users.eraseUser(externalId);
+  }
+
   /** The ban pair (FR-031).
    *
    * TWO ROUTES ON ONE PATH RATHER THAN A `PATCH` WITH A BOOLEAN. `POST …/ban` and
    * `DELETE …/ban` say what they do in the method, and a customer's reconciliation loop
    * can issue either without reading the current state first. A `{"banned": false}` body
    * would be a second way to spell the same thing.
```

**AND A SEVENTH FILE, ADDED AFTER THE OTHER SIX WERE PLACED.** The coverage ratchet
gained three pins for `services/api/src/users/`, which held **zero** before this
chapter — and `vitest.coverage.config.mts` is titled on 23 pages, so the chain went
from 0 to 1 the moment the pins landed. **This is the file the task predicted would
do it**, and it is why `check:fences` runs again after the ratchet and not only
after the source.

```diff title="vitest.coverage.config.mts"
@@ -1281,12 +1281,56 @@
         // right-hand side there and the run measured **86.95, uncovered 58, 108, 115**.
         // Reproduced locally by setting the variable, byte for byte, and fixed by
         // deleting it: five readers all default to `localhost`, so it changed nothing
         // else. **The pin was right and the environment was wrong**, which is the
         // opposite of the two pins 4.13 had to lower — and worth telling apart before
         // reaching for the ratchet. `gaps.md` 059-22.
+        // Chapter 4.21's two new files, pinned BELOW the measured value. `session.ts`
+        // has read 87.80 and 85.36 on identical code twenty minutes apart, so a floor
+        // at the measurement is a ratchet that teaches its next reader to lower it.
+        //
+        // `erasure.ts` MEASURED 100 / 63.63 / 100 / 100 BEFORE TWO TESTS WERE WRITTEN
+        // FOR IT, which is the order the task demands: when a new file measures thin
+        // the answer is a test, not a lower number. What was uncovered was the arm
+        // where the delete returns and the rows are still there — the arm that makes
+        // the choice of ClickHouse verb matter — and the arm that names an HTTP status
+        // rather than reporting the sentinel 0 as one. Both are now driven by injected
+        // stores. A THIRD TEST FOLLOWED, AND ONLY THE PIN PROBE ASKED FOR IT: the
+        // first two took the file from 63.63% to **81.81%**, not to 100, and a pin of
+        // 90 written on the assumption of 100 would have been silently wrong in the
+        // same way a pin on an absent file is. The remaining pair were the `?? 0`
+        // fallbacks on a `SELECT count()` that always answers with a row — defensive,
+        // and covered with an injected empty store rather than pinned around, because
+        // the alternative is a lower floor justified by a sentence nobody can check.
+        "services/api/src/users/erasure.ts": {
+          branches: 90,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // 100 / 100 / 100 / 100 measured. A controller that is six one-line
+        // delegations has no arm to miss, and pinning it is worth more than the
+        // number: `services/api/src/users/` held ZERO per-file pins before this
+        // chapter, which is 062-12's population and the reason a file can sit at
+        // 66.66% with nothing to notice.
+        "services/api/src/users/users.controller.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // 94.44 / 88.46 / 100 / 96 measured, pinned below each. The uncovered lines
+        // are the media loop's body — this lane's fixtures reserve slots without
+        // uploading bytes, so `deleteObjectWithRenditions` never runs here and the
+        // store round trip is measured in `baseline.txt` by hand instead.
+        "services/api/src/users/users.service.ts": {
+          branches: 85,
+          functions: 100,
+          lines: 93,
+          statements: 92,
+        },
         "services/api/src/metering/clickhouse.ts": {
           branches: 91,
           functions: 100,
           lines: 100,
           statements: 100,
         },
```

<!-- CHAPTER 4.22 — the identifier the customer gave it. Nine files, 23 hunks.
     Three of them (`channels.controller.ts`, `media/media.controller.ts`,
     `compose.yaml`) had no appendix block at all before this chapter: they are
     fenced in chapter pages and nothing had changed them since, so these are the
     first. Generated from `check:fences --dump` rather than from the working
     tree, which is fence-chain rule 1a. -->

```diff title="services/api/src/db/repository.ts"
@@ -1451,12 +1451,27 @@
  * the one the chapter shows going up while the broker is down. */
 /** The name this consumer claims events under. One name, because the ledger is
  * keyed per consumer and the dispatcher is one consumer however many processes
  * run it (the broker chapter's data model). */
 export const DISPATCHER_CONSUMER = "dispatcher";
 
+/** Whether a path segment could be a uuid at all (FR-CHN-11).
+ *
+ * A SHAPE TEST AND NOT A VALIDATION. Nothing here asks whether the uuid names a
+ * row — only whether handing it to a `uuid` column can raise `22P02`, which is
+ * the question `resolveChannelId` has to answer before it writes a predicate.
+ * The 500 this chapter opens on is that cast, so the one branch that matters is
+ * the negative one: a value failing this test is never compared to `channels.id`.
+ *
+ * Deliberately not `z.uuid()`. The repository layer takes no schema dependency
+ * (the lint rule keeps the query engine here and the schemas out), and the
+ * question is narrower than zod's: Postgres accepts any of the eight canonical
+ * hex-and-dash forms and this is the one it will not raise on. */
+const UUID_SHAPE =
+  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
+
 /** Turn one event into one delivery per matching endpoint — **in one
  * transaction** (research R2).
  *
  * Admin surface, like `drainOutbox`: one dispatcher serves every environment, so
  * this cannot go through the scoped Repository. It is still safe, because the
  * environment comes from the EVENT rather than from a caller's parameter.
@@ -3549,12 +3564,68 @@
           eq(channels.externalId, externalId),
         ),
       );
     return rows[0] ?? null;
   }
 
+  /** Turn whatever arrived in a path segment into this channel's key (FR-CHN-11).
+   *
+   * THE SHAPE TEST IS WHAT REMOVES THE 500, and it is not an optimisation. A path
+   * segment that cannot parse as a uuid is handed to the identity query alone, so
+   * `'order-88412'::uuid` never happens — and that cast is the whole of the defect
+   * this chapter opens on. Postgres raises it before the `OR` beside it can
+   * short-circuit, so a single `external_id = $2 OR id = $2::uuid` is not a
+   * resolution that sometimes fails: it is one that always fails for every value
+   * a customer is likely to send.
+   *
+   * THE IDENTITY WINS A TRUE TIE. An `external_id` is `z.string().min(1).max(255)`
+   * and may itself be a uuid — legal, and 0 of 41,772 channels have one. When a
+   * value could name both spaces, `order by (external_id = $2) desc` prefers the
+   * channel the customer NAMED; the other stays reachable by its uuid from any
+   * caller holding it. Key-first would strand a customer permanently with no error
+   * they could act on, which is the only argument that decides this: the two
+   * lookups cost the same, measured twice a day apart with the ordering reversing
+   * between runs.
+   *
+   * ONE QUERY, AND BOTH ARMS ARE INDEX SCANS. 4.18 found a keyset cursor written
+   * as an `OR` landing in a `Filter:` and re-walking every page, so this plan was
+   * read before the form was chosen, not after:
+   *
+   *     Limit -> Sort -> Bitmap Heap Scan              shared hit=11   0.068 ms
+   *       BitmapOr
+   *         Bitmap Index Scan …_environment_id_external_id_unique   Index Cond
+   *         Bitmap Index Scan channels_pkey                         Index Cond
+   *
+   * The key arm's tenancy lands on the heap recheck rather than in its index
+   * condition — a foreign tenant's row enters the bitmap and is filtered out. That
+   * reads as a leak and is not: the plain `channels_pkey` lookup every route runs
+   * today does exactly the same thing.
+   *
+   * SCOPED BY CONSTRUCTION. `this.environmentId` comes from the constructor, which
+   * is 4.21's mechanism: there is no predicate here for a later chapter to forget.
+   * Delete it and `gauntlet.itest.ts` turns red.
+   *
+   * Called by `ChannelIdPipe.transform`, which is the only caller. */
+  async resolveChannelId(segment: string): Promise<string | null> {
+    const looksLikeUuid = UUID_SHAPE.test(segment);
+    const rows = await this.db
+      .select({ id: channels.id })
+      .from(channels)
+      .where(
+        and(
+          eq(channels.environmentId, this.environmentId),
+          looksLikeUuid
+            ? or(eq(channels.externalId, segment), eq(channels.id, segment))
+            : eq(channels.externalId, segment),
+        ),
+      )
+      .orderBy(sql`(${channels.externalId} = ${segment}) desc`)
+      .limit(1);
+    return rows[0]?.id ?? null;
+  }
+
   async listChannels(): Promise<ChannelRow[]> {
     return this.db
       .select({
         id: channels.id,
         external_id: channels.externalId,
         type: sql<ChannelRow["type"]>`${channels.type}`,
```

```diff title="services/api/src/messages/messages.controller.ts"
@@ -13,12 +13,13 @@
   Query,
   Req,
   UseGuards,
 } from "@nestjs/common";
 
 import { Accepts, CredentialGuard } from "../auth/credential.guard";
+import { ChannelIdPipe } from "../channels/channel-id.pipe";
 import { Repository } from "../db/repository";
 import { MessagesService } from "./messages.service";
 import {
   MESSAGE_PUBLISHER,
   type MessagePublisher,
 } from "../fanout/publisher";
@@ -30,12 +31,13 @@
 // `import type` is required, not stylistic: with isolatedModules and
 // emitDecoratorMetadata on (ADR-15's trade-off, chapter 1.4), a type used
 // in a decorated signature must be imported as a type or TS1272 refuses
 // to compile it.
 import type { EditMessageBody, HistoryQuery, SendMessageBody } from "./messages.schema";
 import type { RequestWithPrincipal } from "../auth/principal";
+import { UuidParamPipe } from "./uuid-param.pipe";
 import { ZodValidationPipe } from "./zod-validation.pipe";
 
 /** The end user this request acts for, or `undefined` when the tenant is acting.
  *
  * SOFT, unlike `internal.controller.ts`'s `principalUser`, which throws. These two
  * routes accept both credential classes — declared as `@Accepts("application", "user")`
@@ -111,13 +113,13 @@
     // every member's screen twice (FR-006).
     @Inject(MESSAGE_PUBLISHER) private readonly fanout: MessagePublisher,
   ) {}
 
   @Post()
   async send(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Body(new ZodValidationPipe(sendMessageBodySchema)) body: SendMessageBody,
     @Req() req: RequestWithPrincipal,
   ) {
     // WHO IS SENDING, resolved here (FR-001, T031a).
     //
     // This route called `this.messages.send(channelId, body)` with no user for
@@ -295,14 +297,14 @@
    * `dev-token.controller.ts:51` is the precedent for a method-level narrowing, and
    * `credential.guard.ts:31` argues why the class is DECLARED while the authorship is
    * CHECKED: authorship cannot be declared, because it is a fact about a row. */
   @Patch(":messageId")
   @Accepts("user")
   async edit(
-    @Param("channelId") channelId: string,
-    @Param("messageId") messageId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
+    @Param("messageId", new UuidParamPipe("messageId")) messageId: string,
     @Body(new ZodValidationPipe(editMessageBodySchema)) body: EditMessageBody,
     @Req() req: RequestWithPrincipal,
   ) {
     // THE GUARD ALREADY REFUSED ANYTHING BUT A USER TOKEN, so `actingUser` cannot be
     // undefined here — and the narrowing is a throw rather than a `!`, on
     // `messages.service.ts`'s precedent for the same shape. A `!` would put the
@@ -403,14 +405,14 @@
    * body; there is no body, and idempotence means the second call is
    * indistinguishable from the first on the wire. What differs is the fan-out, and
    * `alreadyDeleted` is how this handler knows. */
   @Delete(":messageId")
   @HttpCode(204)
   async remove(
-    @Param("channelId") channelId: string,
-    @Param("messageId") messageId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
+    @Param("messageId", new UuidParamPipe("messageId")) messageId: string,
     @Req() req: RequestWithPrincipal,
   ): Promise<void> {
     // THE DELETER, PER CREDENTIAL CLASS. A user token names its subject; an application
     // credential names nobody, and unlike the send path it does not have to — FR-006a
     // records the KIND of principal, and `{ kind: "application" }` is a complete
     // answer. There is no body on a DELETE to name a `user` in, and inventing one
@@ -493,14 +495,14 @@
    * absence of edits is a fact about the message rather than the absence of a resource,
    * and the two are distinguishable here because `messageExistsIn` answers the second
    * question separately — `listMessageEdits` returning `[]` cannot tell them apart. */
   @Get(":messageId/edits")
   @Accepts("application")
   async edits(
-    @Param("channelId") channelId: string,
-    @Param("messageId") messageId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
+    @Param("messageId", new UuidParamPipe("messageId")) messageId: string,
   ): Promise<{
     edits: Array<{
       prior_text: string;
       edited_at: string;
       // CHAPTER 4.19. Widened here as well as in the repository, and the compiler
       // would not have asked: the returned literal's `edits` value is a call result
@@ -523,13 +525,13 @@
     }
     return { edits: await this.repo.listMessageEdits(channelId, messageId) };
   }
 
   @Get()
   async history(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Query(new ZodValidationPipe(historyQuerySchema)) query: HistoryQuery,
     @Req() req: RequestWithPrincipal,
   ) {
     // The same resolution the send handler above does, on the other route of this
     // controller (T041a). Both dropped the caller; the send path was
     // found in one analysis pass and this one in the next, because finding the first
```

```diff title="services/api/src/channels/channels.controller.ts"
@@ -21,12 +21,13 @@
 import { Repository } from "../db/repository";
 import {
   MEMBERSHIP_PUBLISHER,
   type MembershipPublisher,
 } from "../membership/publisher";
 import { ZodValidationPipe } from "../messages/zod-validation.pipe";
+import { ChannelIdPipe } from "./channel-id.pipe";
 import { ChannelsService } from "./channels.service";
 import {
   addMembersBodySchema,
   createChannelBodySchema,
   removeMembersBodySchema,
   setMemberRoleBodySchema,
@@ -109,13 +110,13 @@
    * tenant reads any of its channels (FR-005), and a user reads the ones they may
    * see, which is what makes `channels.type` decide something.
    */
   @Get(":channelId")
   @Accepts("application", "user")
   async read(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Req() req: RequestWithPrincipal,
   ) {
     const actingExternalId =
       req.principal?.kind === "user" ? req.principal.userExternalId : undefined;
     let userId: string | undefined;
     if (actingExternalId !== undefined) {
@@ -148,31 +149,31 @@
    * action. `POST …/ban` and `POST …/members/remove` take the same shape.
    *
    * The tenant's routes. A member does not archive the channel they are in.
    */
   @Post(":channelId/archive")
   @HttpCode(HttpStatus.OK)
-  async archive(@Param("channelId") channelId: string) {
+  async archive(@Param("channelId", ChannelIdPipe) channelId: string) {
     return this.channels.setArchived(channelId, true);
   }
 
   @Delete(":channelId/archive")
   @HttpCode(HttpStatus.OK)
-  async unarchive(@Param("channelId") channelId: string) {
+  async unarchive(@Param("channelId", ChannelIdPipe) channelId: string) {
     return this.channels.setArchived(channelId, false);
   }
 
   /** One member's role (FR-011, FR-011a).
    *
    * The tenant's route: an application credential decides who moderates. A member
    * cannot promote themselves, which is why this is not `@Accepts("user")` like
    * join.
    */
   @Patch(":channelId/members/:userExternalId")
   async setMemberRole(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Param("userExternalId") userExternalId: string,
     @Body(new ZodValidationPipe(setMemberRoleBodySchema)) body: SetMemberRoleBody,
   ) {
     return this.channels.setMemberRole(channelId, userExternalId, body.role);
   }
 
@@ -186,13 +187,13 @@
    * and two routes for one job is two classification entries, two tests and two
    * chances to disagree.
    */
   @Post(":channelId/members/remove")
   @HttpCode(HttpStatus.OK)
   async removeMembers(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Body(new ZodValidationPipe(removeMembersBodySchema)) body: RemoveMembersBody,
   ) {
     const results = await this.channels.removeMembers(channelId, body);
 
     // ONLY THE ONES THAT CHANGED SOMETHING (FR-005). The route reports per entry and
     // `not_a_member` is a legitimate outcome, so publishing the whole list would tell
@@ -251,13 +252,13 @@
    * chapter and then turned nine of fifteen tests red.
    */
   @Post(":channelId/join")
   @HttpCode(HttpStatus.OK)
   @Accepts("user")
   async join(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Req() req: RequestWithPrincipal,
   ) {
     // The guard has already refused anything that is not a user principal, so this
     // is narrowing for the type system rather than for trust.
     if (req.principal?.kind !== "user") {
       throw new BadRequestException("joining is an end user's action");
@@ -279,13 +280,13 @@
    * 200 and not 201: this is idempotent in a way creation is not — a member list
    * sent twice is the same list, and the per-user `status` says which ones were
    * already there. */
   @Post(":channelId/members")
   @HttpCode(200)
   async addMembers(
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Body(new ZodValidationPipe(addMembersBodySchema)) body: AddMembersBody,
   ) {
     const members = await this.channels.addMembers(channelId, body);
     // `added` only. `already_a_member` is the idempotent repeat and changed nothing.
     for (const member of members) {
       if (member.status !== "added") continue;
```

```diff title="services/api/src/channels/channels.service.ts"
@@ -36,13 +36,28 @@
   /** `removed` if a membership row went away, `not_a_member` otherwise — including
    * when the external id belongs to no user this tenant knows. */
   result: "removed" | "not_a_member";
 }
 
 export interface MemberResult {
-  user_id: string;
+  /** THE IDENTITY, AND NOTHING ELSE (FR-006, FR-CHN-11).
+   *
+   * This shape carried `user_id: string` — the row's `users.id` — on every member
+   * added, for every user, erased or not. **No route accepts that value**:
+   * `GET /v1/users/{a users.id}` is 404 while `GET /v1/users/{external_id}` is
+   * 200, so a caller who stored it held a key to nothing. No test asserted it, no
+   * clause documented it, no tutorial page showed it, and ADR-37's opening
+   * sentence said it could not happen — *"`users.id` is an internal uuid that the
+   * platform exposes nowhere a caller can act on."*
+   *
+   * Found by FR-006's sweep rather than by reading: the chapter went looking for
+   * the listing cursor ADR-37 names, found that route does not exist, and swept
+   * every v1 response shape instead. Three siblings turned up and are kept with
+   * their reasons — `audit_log[].id` and `actor.id` are record references a
+   * customer quotes back, and `request_id` is constitution V's requirement. This
+   * one had no reason. */
   external_id: string;
   status: "added" | "already_a_member";
   /** What role the member holds AFTER the call — read back, not
    * echoed, so an `already_a_member` reports the role they already had rather than
    * the one the request asked for. Adding is not changing. */
   role: string;
@@ -275,13 +290,12 @@
         // The channel was read above and both ids are this environment's, so this
         // is not reachable by a foreign request — it means the channel was deleted
         // between the read and here. Answer as the read would have.
         throw new NotFoundException("channel not found");
       }
       results.push({
-        user_id: user.id,
         external_id: externalId,
         status: outcome,
         // The role the member ends up with, read back rather than echoed: on an
         // `already_a_member` the request's role is NOT applied, because adding is
         // not changing. `PATCH` is the route that changes one.
         role: (await this.repo.memberRole(channelId, user.id)) ?? "member",
```

```diff title="services/api/src/users/users.controller.ts"
@@ -16,12 +16,13 @@
 
 import { ALL_CHANNELS } from "@relay/protocol";
 
 import { Repository } from "../db/repository";
 
 import { Accepts, CredentialGuard } from "../auth/credential.guard";
+import { ChannelIdPipe } from "../channels/channel-id.pipe";
 import {
   MEMBERSHIP_PUBLISHER,
   type MembershipPublisher,
 } from "../membership/publisher";
 import { ZodValidationPipe } from "../messages/zod-validation.pipe";
 import {
@@ -86,13 +87,13 @@
    * names channel parameters `:channelId` — a classification entry copied from it
    * verbatim will not match a derived target. */
   @Put(":externalId/channels/:channelId/read")
   @Accepts("application", "user")
   async setReadPosition(
     @Param("externalId") externalId: string,
-    @Param("channelId") channelId: string,
+    @Param("channelId", ChannelIdPipe) channelId: string,
     @Body(new ZodValidationPipe(readPositionBodySchema)) body: ReadPositionBody,
   ): Promise<{ sequence: number }> {
     return this.users.setReadPosition(externalId, channelId, body.sequence);
   }
 
   /** The profile, read and written (FR-023, FR-024).
```

```diff title="services/api/src/isolation/gauntlet.itest.ts"
@@ -682,12 +682,72 @@
       () => t.victim.repo.listMembers(t.victim.channelId),
     );
     expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
     expect(verdict.stateChanged, "the victim gained a member").toBe(false);
   });
 
+  // THE NEW WAY TO NAME SOMEBODY ELSE'S CHANNEL (FR-CHN-11, constitution I).
+  //
+  // Until chapter 4.22 there was one forgeable channel identifier and it was a uuid,
+  // which an attacker has to be GIVEN. Now there are two, and the second is one they
+  // can GUESS: `support-ticket-1`, `order-88412`, the customer's own naming scheme.
+  // The resolution is scoped by the request-scoped `Repository`'s constructor, so a
+  // foreign identifier resolves to nothing — and this is the test that says so.
+  //
+  // THE PAIR IS FOREIGN-VERSUS-ABSENT, as everywhere else here: the victim's real
+  // external id against one nobody has used. Indistinguishable, or the answer tells
+  // the attacker the victim's channel exists.
+  it("GET /v1/channels/:channelId — a foreign EXTERNAL id reads as an absent one", async () => {
+    attacked.add("GET /v1/channels/:channelId");
+    const foreign = await fetch(`${url}/v1/channels/${t.victim.channelExternalId}`, {
+      headers: { authorization: `Bearer ${t.attacker.credential}` },
+    });
+    const absent = await fetch(`${url}/v1/channels/nobody-has-named-this`, {
+      headers: { authorization: `Bearer ${t.attacker.credential}` },
+    });
+    expect(foreign.status).toBe(absent.status);
+    expect(withoutRequestId(await foreign.json())).toEqual(
+      withoutRequestId(await absent.json()),
+    );
+  });
+
+  it("POST /v1/channels/:channelId/messages — a foreign EXTERNAL id writes nothing", async () => {
+    attacked.add("POST /v1/channels/:channelId/messages");
+    const verdict = await writeAttack(
+      url,
+      t.attacker.credential,
+      {
+        method: "POST",
+        path: `/v1/channels/${t.victim.channelExternalId}/messages`,
+        body: { user: "intruder", text: "by the name you gave it" },
+      },
+      {
+        method: "POST",
+        path: `/v1/channels/nobody-has-named-this/messages`,
+        body: { user: "intruder", text: "by a name nobody gave" },
+      },
+      () => t.victim.repo.listMessagesRaw(t.victim.channelId),
+    );
+    expect(verdict.differences, verdict.differences.join("; ")).toEqual([]);
+    expect(verdict.stateChanged, "the victim's channel took a message").toBe(false);
+  });
+
+  // AND THE CONTROL THAT MAKES BOTH OF THOSE MEAN SOMETHING: the same external id,
+  // from the tenant that owns it, must WORK. A resolution that refused everyone
+  // would pass the two attacks above perfectly.
+  it("the control: the victim's own credential reaches it by the same name", async () => {
+    const res = await fetch(`${url}/v1/channels/${t.victim.channelExternalId}`, {
+      headers: { authorization: `Bearer ${t.victim.credential}` },
+    });
+    expect(res.status).toBe(200);
+    expect(await res.json()).toMatchObject({
+      external_id: t.victim.channelExternalId,
+      id: t.victim.channelId,
+    });
+  });
+
   it("POST /v1/channels — the other tenant's external_id is not interference", async () => {
     attacked.add("POST /v1/channels");
     // THIS ROUTE CARRIES NO IDENTIFIER TO FORGE, so the pair is not foreign-versus-
     // absent. What a caller can present is the other tenant's own `external_id`, and
     // the property is NON-INTERFERENCE rather than indistinguishability: the call must
     // SUCCEED. Two tenants may use the same customer-supplied id — that is the whole
```

```diff title="services/api/src/media/media.controller.ts"
@@ -45,16 +45,20 @@
    *     500 {"code":"internal_error","message":"unexpected internal error"}
    *
    * A malformed uuid reaches the driver, Postgres answers `invalid input syntax for type
    * uuid`, and the filter has no rung for it — a caller-triggered 500 on sixteen shipped
    * routes, thirteen taking `channelId` and three taking `messageId`. It is chapter
    * 4.11's research R3 exactly, which found the same defect in a request BODY, measured
-   * it, and fixed it with `z.uuid()` — while nobody looked at the path. The other sixteen
-   * are recorded in `gaps.md` with their measurement rather than repaired here, because a
-   * chapter about signed delivery that rewrites three controllers is teaching two things
-   * badly.
+   * it, and fixed it with `z.uuid()` — while nobody looked at the path.
+   *
+   * THE OTHER SIXTEEN ARE CLOSED, and this sentence used to say they were recorded in
+   * `gaps.md` rather than repaired, because a chapter about signed delivery that
+   * rewrites three controllers teaches two things badly. The identifier chapter
+   * (FR-CHN-11) repaired them: `ChannelIdPipe` closes the thirteen `channelId` routes
+   * as a side effect of never casting a value that cannot be a uuid, and
+   * `UuidParamPipe` closes the three `messageId` ones. 058-3 is 16 to 0.
    *
    * NOT THROUGH `ZodValidationPipe`, AND THE REASON IS ITS `field`. That pipe names the
    * field from the zod issue's `path`, which is empty for a scalar and then omitted — so
    * the reuse would answer 400 without saying which parameter was wrong. The check is
    * three lines here and names `mediaId`. */
   @Get(":mediaId")
```

```diff title="vitest.coverage.config.mts"
@@ -691,12 +691,67 @@
         "services/api/src/channels/channels.service.ts": {
           branches: 75,
           functions: 100,
           lines: 94,
           statements: 94,
         },
+        // CHAPTER 4.22. The resolution is one line and v8 counts four branches in
+        // the file; three run. Measured rather than assumed, because T033a said a
+        // figure below 100 on a tenant-isolation file means a missing test:
+        //
+        //     branch 0  binary-expr  line 84  [97, 56]   the `??`, both arms
+        //     branch 1  cond-expr    line 79  [ 0,  1]   `@Injectable()`
+        //
+        // **LINE 79 IS THE DECORATOR AND THERE IS NO TERNARY ON IT.** Both arms
+        // carry an identical location with a null end column, which is what the
+        // compiler's own emitted code looks like after source-mapping. No test can
+        // reach an arm that is not in the file, so this is 75 and the clause is met
+        // by the three that are.
+        //
+        // I WAS WRONG TWICE GETTING HERE AND THE SECOND ONE IS WORTH THE LINES.
+        // `media/media.service.ts` is also `@Injectable()`, also takes `Repository`
+        // by class type, and measures 18/18 — which looked like a refutation. Its
+        // one null-end-column `cond-expr` is at line 113 and is a REAL ternary
+        // spanning four lines: `userExternalId === undefined ? null : await …`,
+        // counts [1, 5]. **A null end column means a multi-line expression, not an
+        // emitted one**; what distinguishes the shim is two arms at the SAME
+        // location. Comparing the percentages said one thing and comparing the
+        // branch maps said another.
+        "services/api/src/channels/channel-id.pipe.ts": {
+          branches: 75,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // 058-3's last three. Four statements, one `safeParse`, both arms run.
+        "services/api/src/messages/uuid-param.pipe.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
+        // CHAPTER 4.22 EDITED THESE TWO AND NEITHER HAD A PIN, which a re-measure
+        // of existing pins cannot see — 062-12's finding, where 68 of 139 files
+        // were unpinned and a human found it by comparing one chapter to another.
+        // 92.50 / 85.00 / 100 / 97.22 measured; pinned under it by the usual
+        // margin, because this file is a controller with forty-odd branch points
+        // and a moving denominator is exactly what that margin is for.
+        "services/api/src/channels/channels.controller.ts": {
+          branches: 83,
+          functions: 100,
+          lines: 95,
+          statements: 90,
+        },
+        // 100 / 100 / 100 / 100 measured, and pinned there: it is a schema file of
+        // pure declarations, so there is no denominator to move.
+        "services/api/src/users/users.schema.ts": {
+          branches: 100,
+          functions: 100,
+          lines: 100,
+          statements: 100,
+        },
 
         "services/api/src/webhooks/disable.ts": {
           branches: 100,
           functions: 100,
           lines: 100,
           statements: 100,
```

```diff title="compose.yaml"
@@ -227,25 +227,81 @@
       # hypothesis. `clamdscan -V` asks the DAEMON, so it reports the database the
       # daemon has loaded rather than what is on disk.
       #
       # SEVEN DAYS. ClamAV publishes daily; a bound of one would go red on any
       # machine that starts the stack before freshclam's first run of the day, and
       # a bound of thirty would pass the window this check exists to catch.
+      # AND IT ASKS THE DAEMON TO RELOAD WHEN THE ANSWER IS STALE (feature 068).
+      #
+      # `freshclam` downloads the database and then cannot tell `clamd` about it:
+      #
+      #     daily.cld updated (version: 28145, sigs: 355726, ...)
+      #     WARNING: Clamd was NOT notified: Can't connect to clamd through
+      #              /tmp/clamd.sock: No such file or directory
+      #
+      # The two race at startup. When the download wins, clamd loads the fresh
+      # database and this check passes at once; when clamd wins, it loads the one
+      # the IMAGE bundles and freshclam's daemon then sleeps for hours before it
+      # would try again. So without the reload below, what this check measures is
+      # the age of the database clamd happened to load at container start.
+      #
+      # THE CHECK RUNS FIRST AND THE RELOAD ONLY ON FAILURE, which matters: a
+      # reload re-reads 3,628,118 signatures, and doing that every five seconds on
+      # a healthy container would be a steady background cost for nothing. On the
+      # failing path it is asked once per interval until it lands.
+      #
+      # MEASURED, both arms. A daemon reporting `28143` with `28145` on disk was
+      # reloaded and answered `28144` — `Database correctly reloaded (3628118
+      # signatures)` in clamd's own log, about eight seconds, which is two
+      # intervals. A simulated stale version takes the `||` branch, triggers the
+      # reload and returns 1.
+      #
+      # WHAT COULD NOT BE REPRODUCED HERE: CI's losing side of the race. On this
+      # machine a container with an empty volume had today's database 45 seconds
+      # in, because the download beats clamd's startup on a fast link. The fix is
+      # reasoned from the measured mechanism rather than from a local reproduction
+      # of the failure, and CI is what confirms it.
       test:
         - CMD-SHELL
         - >-
           V=$$(clamdscan -V) &&
           D=$$(echo "$$V" | cut -d/ -f3) &&
           B=$$(date -D "%a %b %d %H:%M:%S %Y" -d "$$D" +%s) &&
-          [ $$(( ($$(date +%s) - $$B) / 86400 )) -le 7 ]
+          [ $$(( ($$(date +%s) - $$B) / 86400 )) -le 7 ] ||
+          { clamdscan --reload >/dev/null 2>&1; false; }
       interval: 5s
       timeout: 10s
       # LONGER THAN THE OTHERS, because this is not "is it up" — it is "has
       # freshclam finished", and the answer is a 355,678-signature download that is
       # bandwidth-bound and unbounded on a slow link. Twenty retries at five
       # seconds is 100 s of grace after the start period.
+      #
+      # AND ON A FRESH VOLUME NO NUMBER OF RETRIES PASSES THIS CHECK (feature 068).
+      # freshclam downloads the database and cannot tell the daemon, every time, on
+      # every machine:
+      #
+      #     daily.cld updated (version: 28145, sigs: 355726, ...)
+      #     WARNING: Clamd was NOT notified: Can't connect to clamd through
+      #              /tmp/clamd.sock: No such file or directory
+      #
+      # freshclam finishes before clamd has opened its socket, and the freshclam
+      # DAEMON then sleeps for hours before it would try again. `clamdscan -V` asks
+      # the daemon, so what this check measures is **the age of the database clamd
+      # loaded at container start** — not the age of the database.
+      #
+      # ON A WARM VOLUME that is a recent database and the check passes in
+      # milliseconds; this host answers `28143/Sun Oct 4` from the daemon while the
+      # disk holds `28145` written the same morning, and is green. ON AN EMPTY
+      # VOLUME it is whatever the pinned image bundles, which ages one day per day:
+      # on 2026-10-06 that was 28136 against a remote 28145, past the seven days
+      # this check allows, so CI could not pass at all.
+      #
+      # RETRIES WERE RAISED TO 40 AND PUT BACK, because the first reading of the CI
+      # log was "the download finished as the budget ran out" — true, and not the
+      # cause. The next line said the daemon was never told. **A number that cannot
+      # fix a fault should not be left looking as though it did.**
       retries: 20
       start_period: 30s
 
 
   # --- the services (the webhook dispatcher chapter) -----------------------
   # Behind `--profile services`, for the reason above.
@@ -255,12 +311,21 @@
     build:
       context: .
       dockerfile: services/api/Dockerfile
     environment:
       DATABASE_URL: postgres://relay:relay@postgres:5432/relay
       RELAY_NATS_URL: nats://nats:4222
+      # ONE REPLICA, BECAUSE THIS BROKER IS ONE NODE. The Dockerfile sets
+      # `NODE_ENV=production`, so `replicaCount()` returns ADR-02's R3 and every
+      # `streams.add` answers `replicas > 1 not supported in non-clustered mode`
+      # — the composed api cannot create a stream it does not have (049-2). The
+      # escape hatch has existed since chapter 4.4 and nothing set it: the
+      # streams were created from OUTSIDE the container once, and survived on
+      # the volume for nineteen features, which is why the defect stayed hidden
+      # until feature 068 recreated the volume.
+      RELAY_NATS_REPLICAS: "1"
       # Container names, not localhost — the api's own default is
       # `redis://localhost:6379`, which inside this container is not the Redis
       # service. And the tenant limiter FAILS OPEN by design (SAD §6.3), so a
       # missing address would not crash anything: the composed stack would serve
       # every request unlimited while reporting a limit. The constitution
       # requires the full stack to start with one command, and this is what makes
```

## Chapter 4.23 — the channel a socket names

**TWENTY FILES AGAINST A BILL OF TWELVE, AND THE EIGHT IT MISSED ARE TESTS.** The bill
counted the files the subject touches. Changing `channel_ids` to pairs is a TYPE change,
so the compiler named every stub that constructs a session response — and eight of those
stubs live in files the fence chain publishes. 4.15's rule a fifth time, from a direction
it had not come from before: the estimate was of source files and the charge is for
everything the compiler reached.

### `packages/protocol/src/frames.ts` — the comment that says what a `channel` carries, since the type does not.
```diff title="packages/protocol/src/frames.ts"
@@ -12,12 +12,29 @@
 // `type` discriminator and a `payload` (EIR-WS-02). Schemas are the single
 // source of truth: every exported static type is inferred from its schema,
 // so the types and the validation cannot drift — there is no second
 // definition. Payloads are strict: unknown fields are rejected.
 
 /** Per-channel resume cursor: { channel_id: highest seq seen } (ADR-03). */
+/** WHAT A `channel` IS CALLED ON THIS CONTRACT (FR-RTM-11, chapter 4.23).
+ *
+ * Every `channel` field below, and every key of `cursorSchema` and of the ack's
+ * `revisions`, and every member of the ack's `truncated`, carries the identifier the
+ * CUSTOMER gave the channel — not the uuid Relay minted. **The type did not change
+ * and that is why this comment exists**: `z.string().min(1)` admitted both before
+ * and after, so nothing in the toolchain can tell a reader which one arrives.
+ *
+ * AND SEVEN IS A COUNT OF DECLARATIONS, NOT OF SCHEMAS. `forwardedMessageSchema`
+ * extends `messageSchema`, and `messageCreatedSchema`, `messageUpdatedSchema` and
+ * `messageDeletedSchema` wrap payloads that carry the field — four more places the
+ * rule holds and is not written.
+ *
+ * INBOUND, BOTH FORMS ARE ACCEPTED. A client published before this chapter holds a
+ * uuid-keyed cursor and a uuid in its sends, and 19 of 44,574 channels carry an
+ * identifier that is itself another channel's uuid — so no shape test separates
+ * them and the gateway tries the identity first, as REST does. */
 export const cursorSchema = z.record(z.string(), z.number().int().positive());
 
 /** The message on the wire — derived from the SAD §6.1 `messages` columns.
  * Wire spellings follow SAD §5.1's own frame line (`channel`, `seq`).
  *
  * `metadata` is the one column of §6.1 this payload still does not carry.
```

### `packages/protocol/src/internal.ts` — the session and memberships responses carry pairs.
```diff title="packages/protocol/src/internal.ts"
@@ -165,15 +165,28 @@
   if (!environmentId) throw new Error("an environment id is required");
   const [domain, ...rest] = type.split(".");
   const abbreviated = DOMAIN_ABBREVIATION[domain!] ?? domain!;
   return [EVENT_SUBJECT_PREFIX, abbreviated, ...rest, environmentId].join(".");
 }
 
-/** api → gateway: the channels this user may hear (FR-RTM-01). */
+/** api → gateway: the channels this user may hear (FR-RTM-01).
+ *
+ * PAIRS, FOR THE SAME REASON THE SESSION RESPONSE CARRIES THEM (FR-RTM-11, chapter
+ * 4.23). This route is the revocation backstop's: it re-reads the truth on a timer
+ * and the gateway applies the difference through the same `deliverMembership` the
+ * fast path takes. An ADDITION found that way announces a channel the connection
+ * has never heard of, so without the identity here the one frame telling a client
+ * about the channel is the one frame that cannot name it — and the gateway, which
+ * has no database, has nothing to look it up with. */
 export const internalMembershipsResponseSchema = z.strictObject({
-  channel_ids: z.array(z.string().min(1)),
+  channels: z.array(
+    z.strictObject({
+      id: z.string().min(1),
+      external_id: z.string().min(1),
+    }),
+  ),
 });
 
 /** api → gateway: who the presented token belongs to, and what it
  * may hear — in ONE answer.
  *
  * This replaces the memberships response above rather than joining it. The
@@ -184,14 +197,32 @@
  *
  * `user` is the EXTERNAL id, as everywhere else on this contract: internal uuids
  * are the api's business. */
 export const internalSessionResponseSchema = z.strictObject({
   environment_id: z.string().min(1),
   user: z.string().min(1),
-  channel_ids: z.array(z.string().min(1)),
-  /** Per channel, how many revisions it has seen — the same keys as `channel_ids`.
+  /** The channels this user may hear, each as the pair the gateway needs: the key
+   * everything behind the client edge routes on, and the identifier the customer
+   * gave it (FR-RTM-11, chapter 4.23).
+   *
+   * PAIRS RATHER THAN A SECOND FIELD, because two parallel arrays are two lists
+   * that must agree with nothing comparing them — the defect `gaps.md` 3.23-4
+   * records about `targets.ts`, and the reason `channelsForUser` carries its
+   * revision count on the same row rather than in a second call. */
+  channels: z.array(
+    z.strictObject({
+      id: z.string().min(1),
+      external_id: z.string().min(1),
+    }),
+  ),
+  /** Per channel, how many revisions it has seen — the same keys as `channels[].id`.
+   *
+   * KEYED BY THE KEY, AND DELIBERATELY. The gateway re-keys this map to identities
+   * at the ack, because that is the edge where a client is; this contract is the
+   * api talking to the gateway, where the sentence two paragraphs up still holds —
+   * internal uuids are the api's business.
    *
    * ONE QUERY, TWO FIELDS. The membership read already joins `channels` to answer
    * `channel_ids`, so the counter comes back on rows the api was fetching anyway: no
    * second round trip, and no possibility of the two disagreeing about which channels
    * the user belongs to. */
   revisions: z.record(z.string().min(1), z.number().int().nonnegative()),
```

### `packages/protocol/src/membership.ts` — the fabric change carries the channel's identity.
```diff title="packages/protocol/src/membership.ts"
@@ -61,12 +61,24 @@
  * rather than one, and the sentinel is documented here rather than inferred from a
  * log line. `channel` stays `z.string().min(1)`, so `"*"` is a value the schema admits
  * and this comment is what makes it mean something. */
 export const membershipFabricSchema = z.strictObject({
   environment: z.string().min(1),
   channel: z.string().min(1),
+  /** What the customer calls this channel (FR-RTM-11, chapter 4.23).
+   *
+   * IT RIDES THE CHANGE BECAUSE THE GATEWAY CANNOT LOOK IT UP. A user added
+   * mid-session learns of the channel from this frame, and until it arrives the
+   * connection's map has no entry for it — so the identity has to come WITH the
+   * change or the first frame for a new channel cannot be named. The backstop that
+   * re-reads memberships is a sixty-second timer (`DEFAULT_REREAD_INTERVAL_MS`) and
+   * this frame goes out immediately; it cannot stand in.
+   *
+   * ABSENT FOR `ALL_CHANNELS`, which is not a channel and is expanded into one
+   * change per real channel before anything is sent. */
+  channel_identity: z.string().min(1).optional(),
   user: z.string().min(1),
   change: z.enum(["added", "removed"]),
 });
 
 export type MembershipFabric = z.infer<typeof membershipFabricSchema>;
 
```

### `services/api/src/db/repository.ts` — `channelsForUser` returns the identity beside the key.
```diff title="services/api/src/db/repository.ts"
@@ -4097,16 +4097,23 @@
    * TWO CALLERS, AND BOTH ARE REPAIRED IN THE SAME CHANGE. `session.controller.ts` wants
    * the counts; `memberships.controller.ts` wants ids alone and maps them. Widening the
    * return without fixing both leaves the second assigning objects to a `string[]`, which
    * is a typecheck failure at exactly the boundary this project commits at. */
   async channelsForUser(
     userId: string,
-  ): Promise<{ channel_id: string; revision_sequence: number }[]> {
+  ): Promise<
+    { channel_id: string; external_id: string; revision_sequence: number }[]
+  > {
     return await this.db
       .select({
         channel_id: members.channelId,
+        // THE IDENTITY COSTS A COLUMN AND NOT A JOIN (FR-RTM-11, chapter 4.23).
+        // `channels` is already reached for the revision count, so the name the
+        // customer gave this channel rides a row the query was fetching anyway —
+        // the same argument the count itself made one feature earlier.
+        external_id: channels.externalId,
         revision_sequence: channels.revisionSequence,
       })
       .from(members)
       .innerJoin(users, eq(users.id, members.userId))
       .innerJoin(channels, eq(channels.id, members.channelId))
       .where(
```

### `services/api/src/internal/session.controller.ts` — pairs, not strings.
```diff title="services/api/src/internal/session.controller.ts"
@@ -126,13 +126,19 @@
       // with no channels rather than an error — and a user with no row has no ban either.
       banned: user?.banned_at != null,
       // IDS AND COUNTS OFF ONE READ. `channelsForUser` returns a row per channel, so
       // the two fields cannot disagree about which channels this user belongs to — and
       // the counter costs no extra query, because the membership join already touches
       // `channels` to answer the ids.
-      channel_ids: channels.map((c) => c.channel_id),
+      // THE PAIR, NOT THE KEY (FR-RTM-11). `channelsForUser` returns both off one
+      // row, so the gateway is told what the customer calls each channel at the
+      // same instant it is told which channels there are.
+      channels: channels.map((c) => ({
+        id: c.channel_id,
+        external_id: c.external_id,
+      })),
       revisions: Object.fromEntries(
         channels.map((c) => [c.channel_id, c.revision_sequence]),
       ),
       limits: {
         connect: policy.limits.connect,
         send: policy.limits.send,
```

### `services/api/src/internal/memberships.controller.ts` — the backstop's route needs the name too.
```diff title="services/api/src/internal/memberships.controller.ts"
@@ -65,12 +65,15 @@
       req.principal.userExternalId,
     );
     return {
       // Ids alone: this route answers what a user may hear, not what has changed in it.
       // `channelsForUser` carries revision counts for the session route (feature 044);
       // mapping them off here keeps one query behind both.
-      channel_ids: user
-        ? (await this.repo.channelsForUser(user.id)).map((c) => c.channel_id)
+      channels: user
+        ? (await this.repo.channelsForUser(user.id)).map((c) => ({
+            id: c.channel_id,
+            external_id: c.external_id,
+          }))
         : [],
     };
   }
 }
```

### `services/api/src/channels/channels.controller.ts` — the announcement reads the name back.
```diff title="services/api/src/channels/channels.controller.ts"
@@ -225,19 +225,27 @@
    * The environment is the PRINCIPAL's, established by the guard, never a body's. */
   private async announce(
     channelId: string,
     user: string,
     change: "added" | "removed",
   ): Promise<void> {
+    // ONE READ, ON A LOW-RATE PATH, AND 4.22 IS WHY IT IS NEEDED AT ALL
+    // (FR-RTM-11, chapter 4.23). A gateway cannot name a channel a connection has
+    // just joined — its map was built at connect — so the identity rides the
+    // change. `ChannelIdPipe` resolved the caller's identifier to a key before this
+    // handler ran, so the name has to be read back; a membership change is rare
+    // enough to pay for it, which a delivered message would not be.
+    const channel = await this.repo.getChannelById(channelId);
     await this.membership.publish({
       // THE REPOSITORY'S SCOPE, NOT AN OPTIONAL CHAIN OFF THE PRINCIPAL. Both read
       // the same id from the same verified credential, and `?? "unknown"` carries a
       // branch the guard makes unreachable — the coverage ratchet found the identical
       // arm in `users.controller.ts` at 75% against a pin of 100.
       environment: this.repo.environment,
       channel: channelId,
+      ...(channel !== null && { channel_identity: channel.external_id }),
       user,
       change,
     });
   }
 
   /** The user-initiated half of FR-CHN-03.
```

### `services/api/src/internal/internal.itest.ts` — and a hand-written cast is a hole in the instrument.
```diff title="services/api/src/internal/internal.itest.ts"
@@ -140,26 +140,32 @@
     const res = await fetch(`${url}/internal/session`, {
       method: "POST",
       headers: await headers(),
     });
     const parsed = internalSessionResponseSchema.safeParse(await res.json());
     expect(parsed.error?.issues ?? []).toEqual([]);
-    expect(parsed.data?.channel_ids).toContain(channelId);
+    expect(parsed.data?.channels.map((c) => c.id)).toContain(channelId);
+    // AND THE NAME THE CUSTOMER GAVE IT, BESIDE THE KEY (FR-RTM-11). The gateway
+    // cannot translate what it was never told, and this is the only place it is
+    // told — one row per channel, so the two cannot disagree.
+    expect(
+      parsed.data?.channels.find((c) => c.id === channelId)?.external_id,
+    ).toBeTypeOf("string");
     // The half that is new: the api says who the token belongs to.
     expect(parsed.data?.user).toBe("tuan");
     expect(parsed.data?.environment_id).toBe(env.id);
   });
 
   it("answers for an unknown user with no channels rather than an error", async () => {
     const res = await fetch(`${url}/internal/session`, {
       method: "POST",
       headers: await headers("nobody-here"),
     });
     expect(res.status).toBe(200);
     expect(
-      internalSessionResponseSchema.parse(await res.json()).channel_ids,
+      internalSessionResponseSchema.parse(await res.json()).channels,
     ).toEqual([]);
   });
 
   it("refuses an unverifiable token instead of answering for it", async () => {
     // The refusal the gateway turns into a 4001. It exists here because the
     // route that verifies is the route that must refuse — the gateway holds no
@@ -182,26 +188,26 @@
     const res = await fetch(`${url}/internal/memberships`, {
       headers: await headers(),
     });
     expect(res.status).toBe(200);
     const parsed = internalMembershipsResponseSchema.safeParse(await res.json());
     expect(parsed.error?.issues ?? []).toEqual([]);
-    expect(parsed.data?.channel_ids).toContain(channelId);
+    expect(parsed.data?.channels.map((c) => c.id)).toContain(channelId);
   });
 
   it("answers a user with no row as a user with no channels", async () => {
     // The branch the backstop depends on. A re-read that threw for a deleted user
     // would turn a routine refresh into a failure the gateway has to interpret, and
     // 2.5's rule already says a token for an unseen user is a user with no channels
     // rather than an error.
     const res = await fetch(`${url}/internal/memberships`, {
       headers: await headers("nobody-here"),
     });
     expect(res.status).toBe(200);
     expect(
-      internalMembershipsResponseSchema.parse(await res.json()).channel_ids,
+      internalMembershipsResponseSchema.parse(await res.json()).channels,
     ).toEqual([]);
   });
 
   it("refuses an unverifiable token", async () => {
     const res = await fetch(`${url}/internal/memberships`, {
       headers: { authorization: "Bearer not-a-token" },
@@ -264,25 +270,33 @@
   it("names neither a private nor a public channel the user is not a member of", async () => {
     const res = await fetch(`${url}/internal/session`, {
       method: "POST",
       headers: await headers("stranger"),
     });
     expect(res.status).toBe(200);
-    const body = (await res.json()) as { channel_ids: string[] };
-    expect(body.channel_ids).not.toContain(privateChannelId);
+    // A HAND-WRITTEN CAST IS A HOLE IN THE INSTRUMENT. The session response became
+    // pairs in chapter 4.23 and the compiler named thirteen construction sites — not
+    // this one, because `as { … }` asserts a shape rather than reading it. Typed off
+    // the schema now, so the next change to that contract names this line too.
+    const body = internalSessionResponseSchema.parse(await res.json());
+    expect(body.channels.map((c) => c.id)).not.toContain(privateChannelId);
     // `channelId` is the PUBLIC channel this suite's other user belongs to. The
     // stranger can read it by id and send to it, and it is still not in their
     // session: membership decides subscription, visibility decides reads.
-    expect(body.channel_ids).not.toContain(channelId);
+    expect(body.channels.map((c) => c.id)).not.toContain(channelId);
   });
 
   it("names a channel the user IS a member of", async () => {
     // The control. An empty list would satisfy the assertions above while proving
     // that the session is broken rather than that it is scoped.
     const res = await fetch(`${url}/internal/session`, {
       method: "POST",
       headers: await headers("tuan"),
     });
-    const body = (await res.json()) as { channel_ids: string[] };
-    expect(body.channel_ids).toContain(privateChannelId);
+    // A HAND-WRITTEN CAST IS A HOLE IN THE INSTRUMENT. The session response became
+    // pairs in chapter 4.23 and the compiler named thirteen construction sites — not
+    // this one, because `as { … }` asserts a shape rather than reading it. Typed off
+    // the schema now, so the next change to that contract names this line too.
+    const body = internalSessionResponseSchema.parse(await res.json());
+    expect(body.channels.map((c) => c.id)).toContain(privateChannelId);
   });
 });
```

### `services/gateway/src/auth.ts` — the pairs carried one hop.
```diff title="services/gateway/src/auth.ts"
@@ -36,13 +36,17 @@
  * `refused` instead would close 4001, "your credential is bad", which a client
  * acts on by re-authenticating for ever. */
 export type Authentication =
   | {
       outcome: "ok";
       identity: Identity;
-      channelIds: string[];
+      /** The channels this user may hear, as pairs (FR-RTM-11, chapter 4.23): the
+       * key everything behind the client edge routes on, and the identifier the
+       * customer gave it. The connection derives both a key set and a translation
+       * from this one list, so the two cannot disagree. */
+      channels: { id: string; external_id: string }[];
       /** Per channel, how many revisions it has seen. Reported to the client on the
        * ack and never compared here: the gateway has no opinion about staleness, and
        * no database to form one with. */
       revisions: Record<string, number>;
       /** The environment's two socket allowances, read from
        * Postgres by the api and carried on the same response — the gateway has
@@ -97,13 +101,13 @@
         environmentId: session.environment_id,
         userExternalId: session.user,
         // Carried, not trusted: the internal hop forwards this instead of
         // asserting an identity the gateway invented.
         token,
       },
-      channelIds: session.channel_ids,
+      channels: session.channels,
       revisions: session.revisions,
       limits: session.limits,
     };
   } catch (error) {
     return { outcome: "unavailable", error: String(error) };
   }
```

### `services/gateway/src/registry.ts` — the connection holds both directions.
```diff title="services/gateway/src/registry.ts"
@@ -20,12 +20,29 @@
    * reconnects, which is the only moment the number is useful to it. */
   revisions: Record<string, number>;
   readonly id: string;
   readonly identity: Identity;
   readonly socket: WebSocket;
   channelIds: Set<string>;
+  /** What the customer calls each of those channels, and the way back
+   * (FR-RTM-11, chapter 4.23).
+   *
+   * BOTH DIRECTIONS, BECAUSE THE EDGE HAS TWO. `identities` names a channel on the
+   * way out — every frame, and the three structures on the ack that carry no
+   * `channel` field. `keys` turns what a client SAYS back into the key the api, the
+   * subjects and the cursor filter all speak, because a client may now say either.
+   *
+   * DERIVED FROM ONE LIST, so they cannot disagree, and safe to invert because
+   * `unique("channels_environment_id_external_id_unique")` makes an identity unique
+   * inside the environment this connection belongs to.
+   *
+   * AND `channelIds` STAYS KEYS. Three membership tests read it — signalTyping's
+   * guard, the revocation backstop's set difference, and the resume cursor's filter
+   * — and all three invert silently if it ever holds an identity. */
+  identities: Map<string, string>;
+  keys: Map<string, string>;
   missedPings: number;
   /** Chapter 2.7. A connection resuming through the tunnel spends its first
    * milliseconds holding live frames back so the backfill can go first; a
    * fresh connect is born "live" and never buffers. Delivery reads this
    * field and nothing else — the resume machinery is invisible to it. */
   phase: ResumePhase;
```

### `services/gateway/src/session.ts` — one place a frame leaves, and therefore one place a channel is renamed.
```diff title="services/gateway/src/session.ts"
@@ -113,14 +113,101 @@
  * code the coverage ratchet would have to be told to ignore — and this chapter's
  * pins are 100/100/100/100. */
 function isInboundFrame(frame: Frame): frame is Extract<Frame, { type: InboundFrameType }> {
   return INBOUND_FRAME_TYPES.has(frame.type as InboundFrameType);
 }
 
-function send(socket: WebSocket, frame: RelayedFrame): void {
-  socket.send(JSON.stringify(frame));
+/** THE ONE PLACE A FRAME LEAVES, AND THEREFORE THE ONE PLACE A CHANNEL IS RENAMED
+ * (FR-RTM-11, chapter 4.23).
+ *
+ * WHY HERE AND NOT AT THE SITES THAT BUILD FRAMES. Of the twenty-one places this
+ * service writes `channel:`, three build a client frame, eleven are LOG LINES an
+ * operator reads against the subjects, six are internal publishes and one is a
+ * comment — and `message.created`, the commonest frame on the socket, arrives as a
+ * payload FORWARDED from the api and is written by no expression here at all. A
+ * per-site translation would rename eleven log lines, rename two publishes, and
+ * miss the frame clients see most.
+ *
+ * AND EVERYTHING BEHIND THIS LINE STAYS KEYED, which is the other half of the
+ * argument: `connection.buffer` holds frames that `flushable` indexes by
+ * `marks[frame.channel]` and that the revocation filter compares with
+ * `change.channel`. Translating where a frame is BUILT would put an identity into
+ * the buffer and leave both comparisons looking at keys — a resuming client re-sent
+ * its whole backlog, and a revoked channel's backlog flushed anyway (FR-029). Both
+ * failures are silent. Translating on the way out cannot reach them.
+ *
+ * A MISS DROPS THE FRAME AND SAYS SO. After the membership frame carries its own
+ * identity and `ALL_CHANNELS` is handled before the map, a miss is a bug. The
+ * alternative — emit the key — hands a client the uuid this chapter removes, on
+ * exactly the channel it just failed to name, and a client cannot recover from that;
+ * a dropped frame is recoverable, because the message is durable and the resume
+ * cursor carries it on the next connect. */
+function send(
+  connection: Pick<Connection, "socket" | "identities" | "id">,
+  frame: RelayedFrame,
+  logger?: Logger,
+): void {
+  const named = nameForClient(connection, frame, logger);
+  if (named === undefined) return;
+  connection.socket.send(JSON.stringify(named));
+}
+
+/** The translation itself, separated so the refusal has one place to live. */
+function nameForClient(
+  connection: Pick<Connection, "identities" | "id">,
+  frame: RelayedFrame,
+  logger?: Logger,
+): RelayedFrame | undefined {
+  const payload = (frame as { payload?: Record<string, unknown> }).payload;
+  if (payload === undefined) return frame;
+
+  const rename = (key: unknown): string | undefined => {
+    if (typeof key !== "string") return undefined;
+    const identity = connection.identities.get(key);
+    if (identity === undefined) {
+      logger?.log("error", "frame.unnamed_channel", {
+        connection_id: connection.id,
+        type: frame.type,
+        channel: key,
+      });
+    }
+    return identity;
+  };
+
+  if (typeof payload["channel"] === "string") {
+    const identity = rename(payload["channel"]);
+    if (identity === undefined) return undefined;
+    return { ...frame, payload: { ...payload, channel: identity } } as RelayedFrame;
+  }
+
+  // THE ACK, WHICH NAMES CHANNELS THREE TIMES WITHOUT THE WORD: `revisions` and
+  // `cursor` are keyed by channel and `truncated` is a list of them. A count of
+  // `channel` fields cannot see any of the three.
+  if (frame.type !== "connection.ack") return frame;
+  const rekey = (map: unknown): Record<string, number> | undefined => {
+    const out: Record<string, number> = {};
+    for (const [key, value] of Object.entries(map as Record<string, number>)) {
+      const identity = rename(key);
+      if (identity === undefined) return undefined;
+      out[identity] = value;
+    }
+    return out;
+  };
+  const revisions = rekey(payload["revisions"]);
+  const cursor = rekey(payload["cursor"]);
+  const truncated: string[] = [];
+  for (const key of (payload["truncated"] ?? []) as string[]) {
+    const identity = rename(key);
+    if (identity === undefined) return undefined;
+    truncated.push(identity);
+  }
+  if (revisions === undefined || cursor === undefined) return undefined;
+  return {
+    ...frame,
+    payload: { ...payload, revisions, cursor, truncated },
+  } as RelayedFrame;
 }
 
 /** EIR-API-04's envelope, wearing its WebSocket clothes.
  *
  * `request_id` ARRIVED IN THE RATE-LIMIT CHAPTER, and the gateway had none to give — it
  * minted no ids at all. The field is required on the frame rather than optional,
@@ -180,22 +267,25 @@
    * side.
    *
    * Omitted when there is no path, exactly as the pipe does: an empty path means the
    * whole frame failed and there is no field to name. */
   field?: string,
 ): void {
-  send(socket, {
+  // DIRECT, AND NOT THROUGH `send` ABOVE. An error frame names no channel, so there
+  // is nothing to translate — and this refusal has to work at the upgrade, before a
+  // `Connection` and therefore before any map exists (FR-RTM-11, chapter 4.23).
+  socket.send(JSON.stringify({
     type: "error",
     payload: {
       code,
       message,
       docs_url: docsUrl(code),
       request_id: requestId,
       ...(field !== undefined && field.length > 0 ? { field } : {}),
     },
-  });
+  }));
 }
 
 export interface SessionServerOptions {
   server: Server;
   api: ApiClient;
   logger: Logger;
@@ -365,13 +455,13 @@
       // nothing to remember: a frame at or below what its backfill already
       // delivered is one it has, however long ago the resume finished. Before
       // this, delivery consulted `phase` and nothing else, and the marks were
       // discarded the moment the connection went live — which is precisely when
       // the fabric could still be catching up.
       if (suppressed(connection.marks, message)) continue;
-      send(connection.socket, { type: "message.created", payload: message });
+      send(connection, { type: "message.created", payload: message });
     }
   }
   fanout?.onDelivery(deliver);
 
   /** An edit or a deletion arriving from the revision fabric (ADR-24).
    *
@@ -404,19 +494,19 @@
       //
       // `media.updated` IS ONE LETTER FROM `message.updated` AND THEY SIT ADJACENT ON
       // PURPOSE. Both can describe the same message: an edit changes its text, this
       // changes what one of its attachments resolves to.
       switch (revision.kind) {
         case "updated":
-          send(connection.socket, { type: "message.updated", payload: revision.message });
+          send(connection, { type: "message.updated", payload: revision.message });
           break;
         case "deleted":
-          send(connection.socket, { type: "message.deleted", payload: revision.message });
+          send(connection, { type: "message.deleted", payload: revision.message });
           break;
         case "media":
-          send(connection.socket, {
+          send(connection, {
             type: "media.updated",
             payload: {
               media_id: revision.media_id,
               channel: revision.channel,
               state: revision.state,
             },
@@ -466,13 +556,13 @@
           connection_id: connection.id,
           channel: signal.channel,
         });
         continue;
       }
       if (connection.identity.userExternalId === signal.user) continue;
-      send(connection.socket, {
+      send(connection, {
         type: "typing",
         payload: { channel: signal.channel, user: signal.user },
       });
     }
   }
   typing?.onSignal(deliverTyping);
@@ -490,13 +580,13 @@
    * published and `frames.test.ts` asserts. */
   function deliverPresence(channelId: string, payload: PresenceFabric): void {
     for (const connection of registry.subscribersOf(channelId)) {
       // One frame per transition per connection, however many channels this
       // connection shares with the subject (FR-012).
       if (!presence?.claim(payload.transition, connection.id)) continue;
-      send(connection.socket, {
+      send(connection, {
         type: "presence.changed",
         payload: { user: payload.user, state: payload.state },
       });
     }
   }
   presence?.onTransition(deliverPresence);
@@ -600,13 +690,13 @@
     }
 
     const frame = {
       type: "membership.changed" as const,
       payload: { channel: change.channel, user: change.user, change: change.change },
     };
-    for (const connection of others) send(connection.socket, frame);
+    for (const connection of others) send(connection, frame);
 
     for (const connection of subject) {
       // SEND, THEN CUT. Reversing these two statements is the whole of FR-008, and
       // T065 proves the ordering test bites by removing this line and watching it
       // fail.
       if (change.change === "added") {
@@ -625,13 +715,23 @@
           // analysis pass 2 reading this function rather than the feature's own
           // documents, every one of which was internally consistent and wrong.
           typing?.subscribe(change.channel),
         ]).then(
           () => {
             connection.channelIds.add(change.channel);
-            send(connection.socket, frame);
+            // THE MAP BEFORE THE SEND, AND THAT ORDERING IS THE WHOLE OF FR-RTM-11
+            // HERE. This frame is the first thing a client hears about a channel it
+            // has just joined; `send` names a channel from `identities`, so an entry
+            // added after the send would make the one frame announcing the channel
+            // the only frame that cannot name it. The identity rides the change for
+            // exactly this reason — the gateway has nothing to look it up with.
+            if (change.channel_identity !== undefined) {
+              connection.identities.set(change.channel, change.channel_identity);
+              connection.keys.set(change.channel_identity, change.channel);
+            }
+            send(connection, frame, logger);
             logger.log("info", "membership.applied", {
               change: "added",
               connection_id: connection.id,
               channel: change.channel,
               user: change.user,
             });
@@ -646,18 +746,24 @@
               error: String(error),
             });
           },
         );
         continue;
       }
-      send(connection.socket, frame);
+      send(connection, frame, logger);
       if (change.change !== "removed") continue;
 
       // THE FIRST MUTATION OF THIS SET AFTER THE CONNECTION EXISTS. Every reader of
       // `channelIds` has assumed it immutable since chapter 2.5.
       connection.channelIds.delete(change.channel);
+      // AFTER THE SEND ABOVE, NOT BEFORE IT. The frame that tells a client it has
+      // been removed still has to name the channel it is about, so the entry
+      // outlives the membership by exactly one frame (FR-RTM-11).
+      const removedIdentity = connection.identities.get(change.channel);
+      connection.identities.delete(change.channel);
+      if (removedIdentity !== undefined) connection.keys.delete(removedIdentity);
       // AND THE BUFFER IS ONE OF THOSE READERS (FR-029). `flushable(buffer, marks)`
       // filters on `frame.seq` and on nothing else, so a removal landing mid-resume
       // would unsubscribe the channel and then flush its buffered messages anyway —
       // access revoked and the backlog delivered in the same act.
       connection.buffer = connection.buffer.filter(
         (message) => message.channel !== change.channel,
@@ -723,13 +829,14 @@
    * the fast path — a second application path would be a second set of rules about
    * buffers, reference counts and frame ordering, kept in step by hope.
    *
    * The client cannot tell which trigger fired, and that is correct: a
    * `membership.changed` frame means the same thing either way. */
   async function reread(connection: Connection): Promise<void> {
-    const actual = new Set(await api.memberships(connection.identity));
+    const truth = await api.memberships(connection.identity);
+    const actual = new Set(truth.map((c) => c.id));
     const held = new Set(connection.channelIds);
 
     for (const channelId of held) {
       if (actual.has(channelId)) continue;
       deliverMembership({
         environment: connection.identity.environmentId,
@@ -740,12 +847,20 @@
     }
     for (const channelId of actual) {
       if (held.has(channelId)) continue;
       deliverMembership({
         environment: connection.identity.environmentId,
         channel: channelId,
+        // THE BACKSTOP CARRIES THE NAME TOO (FR-RTM-11). An addition found on the
+        // timer announces a channel this connection has never heard of, exactly as
+        // a published change does — and the gateway has no database to ask. Without
+        // this the one frame that tells a client about the channel would be the one
+        // frame unable to name it, and `send` would drop it.
+        ...(truth.find((c) => c.id === channelId) !== undefined && {
+          channel_identity: truth.find((c) => c.id === channelId)!.external_id,
+        }),
         user: connection.identity.userExternalId,
         change: "added",
       });
     }
   }
   // noServer: the upgrade is handled by hand so the token can be checked
@@ -927,13 +1042,13 @@
           logger.log("info", "connection.rejected", { reason: "quota_exceeded" });
           return;
         }
         void open(
           ws,
           result.identity,
-          result.channelIds,
+          result.channels,
           result.revisions,
           req.url ?? "/",
           // REQUIRED, SO IT COMES BEFORE THE TWO OPTIONAL ONES. `sendLimit` is a
           // number and `claimedId` a string, so a wrong order here is a type error
           // rather than a silent swap — unlike `sendError`'s two `string`s in this
           // same file, where the compiler had nothing to say.
@@ -945,13 +1060,15 @@
     })();
   });
 
   async function open(
     socket: WebSocket,
     identity: Identity,
-    channelIds: string[],
+    /** Pairs, not keys (FR-RTM-11): the connection derives its key set AND both
+     * directions of the translation from this one list, so they cannot disagree. */
+    channels: { id: string; external_id: string }[],
     /** BESIDE `channelIds` AND NOT AFTER `url`, because it arrives with them from one
      * session answer — and because `claimedId` below is optional: gaps.md 045-18 records
      * a parameter inserted ahead of an optional one silently renaming every later
      * argument. A required parameter here makes the compiler name every call site. */
     revisions: Record<string, number>,
     url: string,
@@ -971,13 +1088,16 @@
       identity,
       socket,
       // Memberships arrived with the identity, from the session
       // call at the door. There is no second lookup to fail here — the api is
       // still the only source of membership (ADR-05), it just answers both
       // questions at once, and a failure now closes the socket before it opens.
-      channelIds: new Set(channelIds),
+      channelIds: new Set(channels.map((c) => c.id)),
+      // ONE LIST, TWO MAPS, AND `channelIds` STAYS KEYS (FR-RTM-11).
+      identities: new Map(channels.map((c) => [c.id, c.external_id])),
+      keys: new Map(channels.map((c) => [c.external_id, c.id])),
       // Reported on the ack and never read again by this service.
       revisions,
       missedPings: 0,
       phase: presented === undefined ? "live" : "buffering",
       buffer: [],
       overflowed: false,
@@ -1309,13 +1429,13 @@
     payload: {
       cursor: Record<string, number>;
       resume_ok: boolean;
       truncated: string[];
     },
   ): void {
-    send(connection.socket, {
+    send(connection, {
       type: "connection.ack",
       payload: {
         user: connection.identity.userExternalId,
         // EVERY CHANNEL THIS USER BELONGS TO, ZEROS INCLUDED, on every ack — a resume
         // and a fresh connect report the same way, because a client cannot act on a
         // number it only sometimes receives.
@@ -1331,13 +1451,15 @@
   async function resume(
     connection: Connection,
     presented: Record<string, number> | null,
     subscribing: Promise<unknown>,
   ): Promise<void> {
     const cursors =
-      presented === null ? {} : scopeCursors(presented, connection.channelIds);
+      presented === null
+        ? {}
+        : scopeCursors(presented, connection.channelIds, connection.keys);
 
     /** Everything that cannot promise completeness ends up here: the client
      * is told resume did not happen and which channels to page instead. The
      * frames held so far are dropped on purpose — they would be an arbitrary
      * fragment of a stream the client is about to refetch in full. */
     const degrade = (reason: string): void => {
@@ -1398,13 +1520,13 @@
     if (connection.overflowed) return degrade("buffer_overflow");
 
     ack(connection, { cursor: cursors, resume_ok: true, truncated });
 
     for (const [, page] of Object.entries(backfilled)) {
       for (const message of page.messages) {
-        send(connection.socket, {
+        send(connection, {
           type: "message.created",
           payload: message,
         });
       }
     }
 
@@ -1415,13 +1537,13 @@
     // measured rather than guessed.)
     if (connection.overflowed) {
       connection.socket.close(1011, "resume buffer overflow");
       return;
     }
     for (const message of flushable(connection.buffer, marks)) {
-      send(connection.socket, { type: "message.created", payload: message });
+      send(connection, { type: "message.created", payload: message });
     }
     connection.buffer = [];
     // KEPT, where chapter 2.7 discarded them. Scoped to the cursors this
     // connection actually presented, so the bound is this service's rather than
     // one inherited from the shape of the api's response.
     connection.marks = scopeMarks(marks, cursors);
@@ -1565,13 +1687,24 @@
 
     // THE SECOND INBOUND FRAME, and it leaves before the send
     // limiter below: a typing signal is not a send and must not spend a send's
     // budget (FR-014). It also never reaches the api — the whole path is this
     // gateway, Redis, and whoever is subscribed.
     if (frame.data.type === "typing.send") {
-      await signalTyping(connection, frame.data.payload.channel);
+      // TRANSLATED BEFORE `signalTyping`, WHICH IS WHERE FR-003 IS LOST IF IT IS
+      // LOST (FR-RTM-11). That function opens with a membership test against
+      // `channelIds` — a KEY set — and drops a miss "with no frame, no close code
+      // and no log line" (FR-013). Past it the string becomes a NATS subject. So an
+      // untranslated identifier here is indistinguishable from a client typing into
+      // a channel it has left, and unlike a send there is no api round trip to
+      // refuse it.
+      const typingChannel = frame.data.payload.channel;
+      await signalTyping(
+        connection,
+        connection.keys.get(typingChannel) ?? typingChannel,
+      );
       return;
     }
 
     // THE SEND LIMIT IS SPENT ON THE FRAME, not on the api call
     // it becomes — a socket send and a REST send count against one budget
     // (FR-RTL-01), or a client could double its allowance by opening a socket.
@@ -1614,24 +1747,31 @@
 
     // A NAMED DESTRUCTURE, AND THAT IS THE POINT (FR-001). Widening
     // `messageSendSchema` puts `attachments` on the wire; without naming it here nothing
     // carries it further, the message commits without attachments, and the client is
     // acked as though it worked. There is no error anywhere in that sequence.
     const { channel, text, idem_key, attachments } = frame.data.payload;
+    // THE GATEWAY TRANSLATES BEFORE IT KNOCKS (FR-RTM-11, chapter 4.23). The api's
+    // internal door is typed `z.string().uuid()` and stays that way — `internal.ts`
+    // says internal uuids are the api's business — so an identifier has to become a
+    // key on this side. A value the map does not hold is passed through unchanged
+    // and refused by the api exactly as an unknown channel is refused today, which
+    // is the point: this line adds a name, not a new way to be told no.
+    const channelKey = connection.keys.get(channel) ?? channel;
     try {
       const committed = await api.sendMessage(connection.identity, {
-        channel_id: channel,
+        channel_id: channelKey,
         text,
         ...(attachments !== undefined && { attachments }),
         idempotency_key: idem_key,
       });
       const { seq } = committed;
       // The ack carries the sequence the API committed — after the commit,
       // never before (FR-MSG-05, unchanged since 2.2; the socket is a new
       // door onto the same write path).
-      send(connection.socket, { type: "message.ack", payload: { seq } });
+      send(connection, { type: "message.ack", payload: { seq } });
       // …and only THEN does anyone else hear about it. Durability, then the
       // sender's confirmation, then everybody's copy: no step overtakes the
       // one before it (§5.1's ordering, now spanning machines).
       //
       // A RECOGNISED RETRY IS NOT REPUBLISHED. 2.3 made the retry safe for
       // storage; that did not make it safe for delivery, and a client that
```

### `services/gateway/src/resume.ts` — `scopeCursors` takes either form.
```diff title="services/gateway/src/resume.ts"
@@ -72,16 +72,34 @@
  * is asked. Membership is the api's truth (ADR-05) and it re-checks; this
  * is about not turning one connect into a thousand index scans, and about
  * a foreign channel id being a no-op rather than a question. */
 export function scopeCursors(
   cursors: Record<string, number>,
   channelIds: Set<string>,
+  /** Identity to key, for a client that presents the name it was given
+   * (FR-RTM-11, chapter 4.23). Optional so every caller that holds no map — the
+   * unit tests of this function among them — keeps the behaviour it had. */
+  keys?: Map<string, string>,
 ): Record<string, number> {
-  return Object.fromEntries(
-    Object.entries(cursors).filter(([channelId]) => channelIds.has(channelId)),
-  );
+  // BOTH FORMS, AND THE FILTER IS WHY THIS MATTERS. A key this set does not hold is
+  // DROPPED here — silently, with no error and no log — so a client presenting the
+  // identifiers this chapter started handing out would have resumed NOTHING and
+  // been told nothing, which is FR-003's one forbidden outcome reached by a filter
+  // rather than by a refusal. Every client connected before the chapter still
+  // presents uuids, so both have to work.
+  //
+  // THE IDENTITY IS TRIED FIRST, AS IT IS ON REST. 19 of 44,574 channels carry an
+  // identifier that is itself another channel's uuid, so no shape test separates
+  // the two and the order is a correctness choice: under key-first a customer who
+  // named a channel with another channel's uuid could never resume their own.
+  const resolved: Record<string, number> = {};
+  for (const [presented, seq] of Object.entries(cursors)) {
+    const key = keys?.get(presented) ?? presented;
+    if (channelIds.has(key)) resolved[key] = seq;
+  }
+  return resolved;
 }
 
 /** The backfill's high-water mark per channel: the last sequence the
  * client is about to have. Channels absent from the backfill keep their
  * presented cursor as the mark — nothing new arrived, so anything buffered
  * is genuinely new. */
```

### `services/gateway/src/api-client.ts` — the memberships call returns pairs.
```diff title="services/gateway/src/api-client.ts"
@@ -82,13 +82,15 @@
     token: string,
   ): Promise<InternalSessionResponse | { quotaExceeded: string } | null>;
   /** The backstop: what this connection may hear, now.
    *
    * The one question a periodic re-read has, asked of the route that answers only
    * it. `session()` would answer this too and three other things. */
-  memberships(identity: Identity): Promise<string[]>;
+  memberships(
+    identity: Identity,
+  ): Promise<{ id: string; external_id: string }[]>;
   /** Resume backfill (chapter 2.7): everything past the cursors, per
    * channel, already shaped as wire frames. */
   backfill(
     identity: Identity,
     cursors: Record<string, number>,
   ): Promise<InternalBackfillResponse["channels"]>;
@@ -204,13 +206,13 @@
       });
       const body = await parse(
         res,
         internalMembershipsResponseSchema,
         "memberships",
       );
-      return body.channel_ids;
+      return body.channels;
     },
     async backfill(identity, cursors) {
       const res = await fetch(`${baseUrl}/internal/backfill`, {
         method: "POST",
         headers: headers(identity),
         body: JSON.stringify({ cursors } satisfies InternalBackfillRequest),
```

### `services/gateway/src/isolation-fixtures.ts` — the gauntlet's tenants know what they called their channel.
```diff title="services/gateway/src/isolation-fixtures.ts"
@@ -67,12 +67,17 @@
 export interface SocketTenant {
   environmentId: string;
   credential: string;
   userExternalId: string;
   userId: string;
   channelId: string;
+  /** What the customer called that channel — `${label}-channel` — which is what a
+   * client now sees in every frame and in the ack's three structures (FR-RTM-11,
+   * chapter 4.23). The gauntlet asserts the identity because that is what the
+   * socket emits; asserting the key would be asserting the defect. */
+  channelIdentity: string;
   /** A private channel in the same environment that this tenant's user is NOT a
    * member of. */
   privateChannelId: string;
   /** That private channel's history, read with the APPLICATION key — which sees
    * private channels (FR-005) — so a refused send can be checked against the
    * rows rather than against its own error frame. */
@@ -102,12 +107,13 @@
    * (T153). */
   banSelf: () => Promise<void>;
   unbanSelf: () => Promise<void>;
   seedDeletable: () => Promise<{
     userExternalId: string;
     channelId: string;
+    channelIdentity: string;
     seq: number;
     witnessToken: string;
   }>;
   /** A token for `userExternalId`, minted through the api's own dev-token route so
    * the signing secret never leaves the api — research R1's rule, and the reason
    * the gateway asks rather than verifies. */
@@ -213,12 +219,13 @@
     return {
       environmentId: environment.id,
       credential: key.credential,
       userExternalId,
       userId: user.id,
       channelId: channel.id,
+      channelIdentity: `${label}-channel`,
       privateChannelId: privateChannel.id,
       // Minted through the api rather than signed here: the signing secret never
       // leaves the api (research R1), which is also why the gateway asks the api to
       // verify rather than verifying itself.
       token: await mintToken(api.url, key.credential, userExternalId),
       say: (text: string) =>
@@ -311,12 +318,13 @@
           userId: doomed.id,
           userExternalId: `${label2}-doomed`,
         });
         return {
           userExternalId: `${label2}-doomed`,
           channelId: room.id,
+          channelIdentity: `${label2}-room`,
           seq: sent.seq,
           witnessToken: await mintToken(api.url, key.credential, `${label2}-witness`),
         };
       },
       unarchiveOwnChannel: async () => {
         const res = await fetch(`${api.url}/v1/channels/${channel.id}/archive`, {
```

### `services/gateway/src/isolation.itest.ts` — three attacks a derived target list cannot find.
```diff title="services/gateway/src/isolation.itest.ts"
@@ -261,12 +261,81 @@
     // proves is absent on every route — the socket does not get an exemption.
     expect(JSON.stringify(payload)).not.toContain(t.victim.channelId);
     expect(payload.code).toBeTruthy();
     socket.socket.close();
   }, 20_000);
 
+  it("message.send naming the other tenant's channel by its IDENTITY is refused", async () => {
+    // THE SUITE DERIVES ITS TARGETS FROM `frameSchema`'S MEMBERS, so it catches a
+    // frame type added and forgotten — and chapter 4.23 adds no frame type. It
+    // changes what a field CARRIES, and three of the structures it changes are not
+    // frame types at all. **A derived-target suite is green by construction against
+    // a value change**, which is why these cases are written by hand.
+    //
+    // AND THE IDENTITY IS THE SHARPER ATTACK. The uuid above is a value the attacker
+    // had to be given; `victim-channel` is a name they can GUESS, and after this
+    // chapter it is a name the platform accepts.
+    const socket = connect(url, t.attacker.token);
+    await socket.waitFor("connection.ack");
+    socket.socket.send(
+      JSON.stringify({
+        type: "message.send",
+        payload: {
+          idem_key: randomUUID(),
+          channel: t.victim.channelIdentity,
+          text: "from the attacker, by name",
+        },
+      }),
+    );
+    const error = await socket.waitFor("error");
+    const payload = error.payload as { code?: string; message?: string };
+    expect(JSON.stringify(payload)).not.toContain(t.victim.channelIdentity);
+    expect(JSON.stringify(payload)).not.toContain(t.victim.channelId);
+    expect(payload.code).toBeTruthy();
+    socket.socket.close();
+  }, 20_000);
+
+  it("a typing frame for the other tenant's channel reaches nobody, by key or by identity", async () => {
+    // THE ONE INBOUND PATH WITH NO REFUSAL BEHIND IT. `signalTyping` drops a channel
+    // the connection does not hold with no frame, no close code and no log line
+    // (FR-013) — so the assertion is that nothing comes back and the socket stays
+    // open, which is what "dropped" looks like from outside. A refusal here would
+    // be the leak: it would tell the attacker the channel exists.
+    const socket = connect(url, t.attacker.token);
+    await socket.waitFor("connection.ack");
+    const seen: unknown[] = [];
+    socket.socket.on("message", (raw: Buffer) => seen.push(JSON.parse(raw.toString())));
+    for (const channel of [t.victim.channelId, t.victim.channelIdentity]) {
+      socket.socket.send(JSON.stringify({ type: "typing.send", payload: { channel } }));
+    }
+    await new Promise((r) => setTimeout(r, 600));
+    expect(JSON.stringify(seen)).not.toContain(t.victim.channelId);
+    expect(JSON.stringify(seen)).not.toContain(t.victim.channelIdentity);
+    expect(socket.socket.readyState).toBe(WebSocket.OPEN);
+    socket.socket.close();
+  }, 20_000);
+
+  it("a cursor naming the other tenant's channel by IDENTITY backfills nothing", async () => {
+    // The uuid half of this is asserted below and has been since the previous
+    // chapter. This is the half the identity opens: `scopeCursors` now resolves an
+    // identity before filtering, so the question is whether that resolution can
+    // reach outside the connection's own map. It cannot — the map is built from the
+    // session response, which is scoped by `users.environmentId` — and this is the
+    // test that says so from outside.
+    const socket = connect(
+      url,
+      t.attacker.token,
+      `&cursor=${t.victim.channelIdentity}:0`,
+    );
+    const ack = await socket.waitFor("connection.ack");
+    const payload = ack.payload as { cursor?: Record<string, number> };
+    expect(Object.keys(payload.cursor ?? {})).not.toContain(t.victim.channelIdentity);
+    expect(Object.keys(payload.cursor ?? {})).not.toContain(t.victim.channelId);
+    socket.socket.close();
+  }, 20_000);
+
   it("every declared frame type that is not message.send is refused inbound", async () => {
     // SCHEMA VALIDATION RUNS BEFORE THE TYPE CHECK, and that shapes what this can
     // claim. A frame whose payload does not match its own schema is answered
     // `invalid_frame` and never reaches the rule that says clients may not utter a
     // server frame — so a loop sending `{}` for every type would pass while testing
     // the parser, not the rule. The first draft of this test did exactly that.
@@ -386,13 +455,13 @@
     // difference between the two acks is the whole assertion.
     await t.attacker.say(`before removal ${randomUUID()}`);
 
     const asMember = connect(url, t.attacker.token, `&cursor=${t.attacker.channelId}:0`);
     const first = await asMember.waitFor("connection.ack");
     const beforeCursor = (first.payload as { cursor?: Record<string, number> }).cursor ?? {};
-    expect(Object.keys(beforeCursor)).toContain(t.attacker.channelId);
+    expect(Object.keys(beforeCursor)).toContain(t.attacker.channelIdentity);
     asMember.socket.close();
 
     // Through the PUBLIC ROUTE, so the test asserts the consequence of the API rather
     // than of a direct write — a repository call would prove the session reads
     // `members` and nothing about whether the endpoint gets there.
     await t.attacker.removeSelf();
@@ -432,13 +501,13 @@
   it("keeps an archived channel in the session and its cursor accepted", async () => {
     await t.attacker.archiveOwnChannel();
     try {
       const socket = connect(url, t.attacker.token, `&cursor=${t.attacker.channelId}:0`);
       const ack = await socket.waitFor("connection.ack");
       const cursor = (ack.payload as { cursor?: Record<string, number> }).cursor ?? {};
-      expect(Object.keys(cursor)).toContain(t.attacker.channelId);
+      expect(Object.keys(cursor)).toContain(t.attacker.channelIdentity);
       socket.socket.close();
     } finally {
       // IN A `finally`, BECAUSE THE TEST ABOVE LEARNED THIS THE OTHER WAY. It left a
       // removed membership behind and the next test failed on its control rather
       // than on its subject. An assertion that throws must still put the state back,
       // or the diagnosis lands in a file that did nothing wrong.
@@ -581,13 +650,13 @@
   // client's cursor, which is the only place in this suite where a stored message becomes
   // a frame — the live fan-out does not reach this suite at all (see T134).
   it("delivers a deleted user's message on resume, still attributed to them", async () => {
     // ITS OWN FIXTURE. The first version deleted the shared `victim`, which took that
     // tenant's membership with it and made the next test's profile PATCH answer 404 —
     // the same shared-fixture mutation the removal test hit.
-    const { userExternalId, channelId, seq, witnessToken } =
+    const { userExternalId, channelId, channelIdentity, seq, witnessToken } =
       await t.victim.seedDeletable();
 
     const deleted = await fetch(`${t.apiUrl}/v1/users/${userExternalId}`, {
       method: "DELETE",
       headers: { authorization: `Bearer ${t.victim.credential}` },
     });
@@ -596,13 +665,13 @@
     // A REMAINING MEMBER RESUMES. The deletion took the doomed user's own membership, so
     // their session no longer carries the channel — and the case that matters is that the
     // message survives for everybody else.
     const socket = connect(url, witnessToken, `&cursor=${channelId}:0`);
     const ack = await socket.waitFor("connection.ack");
     const cursor = (ack.payload as { cursor?: Record<string, number> }).cursor ?? {};
-    expect(Object.keys(cursor)).toContain(channelId);
+    expect(Object.keys(cursor)).toContain(channelIdentity);
 
     const mine = await socket.waitFor("message.created");
     // THE FRAME ARRIVED, and its `user` is the deleted user's external id. Both halves
     // matter: absent means `toFrame` dropped the row, and a null `user` means
     // `messageSchema` would have refused it.
     expect((mine.payload as Record<string, unknown>)["seq"]).toBe(seq);
```

### `services/gateway/src/session.test.ts` — the stubs the compiler named.
```diff title="services/gateway/src/session.test.ts"
@@ -54,13 +54,13 @@
         ? {
             environment_id: "env-1",
             user: "tuan",
             // The api now reports whether the user is banned, and a stub
             // that does not say is a stub that has not thought about it.
             banned: false,
-            channel_ids: [CHANNEL],
+            channels: [{ id: CHANNEL, external_id: CHANNEL }],
             revisions: {},
             // The limits ride the session response because the
             // gateway has no database to read them from — so the stub supplies
             // them, exactly as the api would. Generous by default: every test
             // in this file is about something else.
             limits: { connect: 3_000, send: 600 },
@@ -69,13 +69,13 @@
     backfill: async () => ({}),
     sendMessage: async () => committed(42),
         // The backstop reads this. The default answers what the session above says,
         // so a stub that never overrides it is a stub whose re-read agrees with its
         // own connect — which is the state every test in this file that is not about
         // membership wants.
-        memberships: async () => [CHANNEL],
+        memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
         // Null is what a gateway with no metering credential gets, and it is the right
         // default here: every test in this file is about the socket, and a meter that
         // reported would only add a call nobody asserts on.
         reportUsage: async () => null,
     ...overrides,
   };
@@ -1147,13 +1147,13 @@
         session: async () => ({
           environment_id: "env-1",
           user: "tuan",
           // The ban flag, which is upstream of this chapter in this order — a stub
           // that does not say is a stub that has not thought about it.
           banned: false,
-          channel_ids: [CHANNEL],
+          channels: [{ id: CHANNEL, external_id: CHANNEL }],
           revisions: {},
           limits: { connect: 2, send: 600 },
         }),
       }),
       undefined,
       undefined,
@@ -1184,13 +1184,13 @@
         session: async () => ({
           environment_id: "env-1",
           user: "tuan",
           // The ban flag, which is upstream of this chapter in this order — a stub
           // that does not say is a stub that has not thought about it.
           banned: false,
-          channel_ids: [CHANNEL],
+          channels: [{ id: CHANNEL, external_id: CHANNEL }],
           revisions: {},
           limits: { connect: 3_000, send: configured },
         }),
       }),
       undefined,
       undefined,
```

### `services/gateway/src/resume.itest.ts` — the stubs the compiler named.
```diff title="services/gateway/src/resume.itest.ts"
@@ -123,40 +123,40 @@
     // The backfill leg is deliberately slow, and a DIFFERENT process — a
     // different fanout client on the same subject — publishes into the
     // window. Neither side coordinates; only the buffer saves this.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         await publishFromElsewhere(frame(43));
         await settle(150); // give Redis time to actually deliver it
         return {
           [CHANNEL]: { messages: [frame(42), frame(43)], truncated: false },
         };
       },
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(700);
     const seqs = created(frames);
     expect(seqs).toEqual([42, 43]);
     expect(new Set(seqs).size).toBe(seqs.length);
     socket.close();
@@ -165,72 +165,72 @@
   it("delivers a mid-backfill frame that the backfill did not contain", async () => {
     // Committed after the backfill's snapshot: it exists ONLY in the buffer,
     // and the flush is the only reason the client ever sees it.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         await publishFromElsewhere(frame(43));
         await settle(150);
         return { [CHANNEL]: { messages: [frame(42)], truncated: false } };
       },
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(700);
     expect(created(frames)).toEqual([42, 43]);
     socket.close();
   });
 
   it("goes live after the flush, with no buffering left behind", async () => {
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(400);
     // A frame published AFTER the resume finished must arrive immediately —
     // the phase went back to normal 2.6 delivery.
     await publishFromElsewhere(frame(44));
     await settle(300);
@@ -255,36 +255,36 @@
     // closed, because `marks` was a local variable that `resume()` discarded.
     //
     // One number different from the test above it. That is the whole bug.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(400);
     // The resume has completed. NOW the fabric catches up with a message the
     // backfill already delivered — the publish that was still in flight while the
     // backfill query ran.
     await publishFromElsewhere(frame(42));
@@ -302,36 +302,36 @@
     // This is the case that made the spec's first design unsafe. It proposed
     // retiring the mark once a higher sequence arrived — which would see the 43,
     // drop the mark, and then deliver the 42 (research R3).
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => ({
         [CHANNEL]: { messages: [frame(42)], truncated: false },
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(400);
     // 43 is ABOVE the mark and must be delivered. A rule that retired the mark on
     // seeing it would then have nothing left to compare the delayed 42 against.
     await publishFromElsewhere(frame(43));
     await settle(150);
@@ -362,37 +362,37 @@
    *
    * **THE ABSENCE IS THE ASSERTION.** A resume that carried `message.updated` for a
    * message the client is receiving for the first time would be telling it that
    * something it has never seen has changed. */
   it("replays an edited message as message.created with its current text, and no message.updated", async () => {
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
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
       }),
       sendMessage: async () => {
         throw new Error("not used");
       },
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(400);
 
     expect(created(frames)).toEqual([42]);
     const replayed = frames.find((f) => f.type === "message.created") as {
       payload: Message;
@@ -409,36 +409,36 @@
     // backfill it received is a fragment or nothing at all. A mark taken from it
     // would suppress messages the client never got — turning this chapter's
     // duplicate into a gap, which constitution II ranks worse.
     harness = await boot({
       session: async () => ({
         environment_id: "env-1",
         user: "tuan",
         // The api now reports whether the user is banned, and a stub
         // that does not say is a stub that has not thought about it.
         banned: false,
-        channel_ids: [CHANNEL],
+        channels: [{ id: CHANNEL, external_id: CHANNEL }],
         revisions: {},
         // The limits ride the session response now. Generous, and
         // beside the point of every test in this file.
         limits: { connect: 3_000, send: 600 },
       }),
       backfill: async () => {
         throw new Error("backfill unavailable");
       },
       sendMessage: async () => {
         throw new Error("not used");
       },
       // Agrees with `session` above: this file is about the resume,
       // and a backstop that disagreed with the connect would be a second subject
       // under test.
-      memberships: async () => [CHANNEL],
+      memberships: async () => ([CHANNEL]).map((c: string) => ({ id: c, external_id: c })),
     });
     const socket = new WebSocket(
       `${harness.url}?token=${await token()}&cursor=${CHANNEL}:41`,
     );
     const frames = record(socket);
     await settle(400);
     // A sequence at or below the presented cursor. With no mark retained it must
     // still arrive: the client was told to page history, not to expect silence.
     await publishFromElsewhere(frame(41));
     await settle(300);
@@ -477,31 +477,31 @@
     const socket = new WebSocket(`${harness.url}?token=${await token()}`);
     sockets.push(socket);
     return record(socket);
   };
 
   const stub = (channels: string[]) => ({
     session: async () => ({
       environment_id: "env-1",
       user: "tuan",
       banned: false,
-      channel_ids: channels,
+      channels: channels.map((c) => ({ id: c, external_id: c })),
       revisions: {},
       limits: { connect: 3_000, send: 600 },
     }),
     backfill: async () => ({}),
     sendMessage: async () => {
       throw new Error("not used");
     },
     // The same list `session` answers with, so the backstop confirms
     // what the connect already established and changes nothing.
-    memberships: async () => channels,
+    memberships: async () => channels.map((c) => ({ id: c, external_id: c })),
   });
 
   afterEach(async () => {
     for (const socket of sockets.splice(0)) socket.close();
     await member?.close();
     await bystander?.close();
     member = undefined;
     bystander = undefined;
   });
 
```

### `services/gateway/src/typing.itest.ts` — a fixture that pre-dated the contract.
```diff title="services/gateway/src/typing.itest.ts"
@@ -110,20 +110,20 @@
   });
   const api: ApiClient = {
     session: async () => ({
       environment_id: environment,
       user: options.user,
       banned: false,
-      channel_ids: options.channels,
+      channels: options.channels.map((c: string) => ({ id: c, external_id: c })),
       revisions: {},
       // The limits ride this response as of the limits chapter, and this fixture is
       // generous on purpose: T048b below asserts that a typing signal spends NO send
       // budget, and a tight number here would make that pass for the wrong reason.
       limits: { connect: 3_000, send: 600 },
     }),
-    memberships: async () => options.channels,
+    memberships: async () => options.channels.map((c: string) => ({ id: c, external_id: c })),
     backfill: async () => {
       if (options.backfillDelayMs !== undefined) {
         await new Promise((r) => setTimeout(r, options.backfillDelayMs));
       }
       return (options.backfillFrames ?? {}) as never;
     },
@@ -799,12 +799,19 @@
     });
     await announcer.publish(
       subjectForUserMembership("env-1", "mai"),
       JSON.stringify({
         environment: "env-1",
         channel,
+        // THE IDENTITY RIDES THE CHANGE NOW (FR-RTM-11, chapter 4.23), and a fixture
+        // imitating the api has to carry it: without this the gateway's map has no
+        // entry for a channel joined mid-connection, so the typing frame announcing
+        // it is DROPPED and logged — which is the designed behaviour, and this test
+        // is how it was observed. This suite's stubs name a channel by its key, so
+        // the identity here is the key.
+        channel_identity: channel,
         user: "mai",
         change: "added",
       }),
     );
     await settle();
 
```

### `services/gateway/src/connections.itest.ts` — the stubs the compiler named.
```diff title="services/gateway/src/connections.itest.ts"
@@ -134,17 +134,17 @@
   });
   const api: ApiClient = {
     session: async () => ({
       environment_id: environment,
       user: options.user,
       banned: false,
-      channel_ids: options.channels,
+      channels: options.channels.map((c: string) => ({ id: c, external_id: c })),
       revisions: {},
       limits: { connect: 3_000, send: 600 },
     }),
-    memberships: async () => options.channels,
+    memberships: async () => options.channels.map((c: string) => ({ id: c, external_id: c })),
     backfill: async () => ({}) as never,
     sendMessage: async () => {
       throw new Error("not used");
     },
     // NULL, WHICH IS WHAT A GATEWAY WITH NO METERING CREDENTIAL GETS. This suite is
     // about the connection cap and reports nothing; the api's side takes the same safe direction, so
```

### `services/gateway/src/public-surface.itest.ts` — the public surface keeps both names.
```diff title="services/gateway/src/public-surface.itest.ts"
@@ -158,40 +158,47 @@
       }
     };
     return { socket, frames, opened, waitForText };
   }
 
   /** A channel and two members, all over public HTTP. Returns the channel id. */
-  async function seedOverTheWire(label: string, users: string[]): Promise<string> {
+  async function seedOverTheWire(
+    label: string,
+    users: string[],
+  ): Promise<{ id: string; external_id: string }> {
+    // THE NAME IS KEPT, NOT JUST THE KEY. A client sees the identifier in every
+    // frame and in the ack's cursor now (FR-RTM-11, chapter 4.23), so a suite about
+    // the public surface has to hold both to assert either.
+    const externalId = `${label}-${randomUUID().slice(0, 8)}`;
     const created = await post(
       "/v1/channels",
-      { external_id: `${label}-${randomUUID().slice(0, 8)}`, type: "public" },
+      { external_id: externalId, type: "public" },
       api.credential,
     );
     expect(created.status).toBe(201);
     const channelId = ((await created.json()) as { id: string }).id;
     const members = await post(
       `/v1/channels/${channelId}/members`,
       { user_ids: users },
       api.credential,
     );
     expect(members.status).toBe(200);
     const body = (await members.json()) as { members: { status: string }[] };
     expect(body.members.every((m) => m.status === "added")).toBe(true);
-    return channelId;
+    return { id: channelId, external_id: externalId };
   }
 
   const mint = async (user: string): Promise<string> => {
     // 200, not 201: minting a token creates nothing that has a URL.
     const res = await post("/auth/dev-token", { user, ttl_seconds: 3600 }, api.credential);
     expect(res.status).toBe(200);
     return ((await res.json()) as { token: string }).token;
   };
 
   it("delivers a message between two members added over the wire", async () => {
-    const channelId = await seedOverTheWire("live", ["tuan", "mai"]);
+    const { id: channelId } = await seedOverTheWire("live", ["tuan", "mai"]);
 
     const tuan = reader(`${wsUrl}/v1/ws?token=${await mint("tuan")}`);
     const mai = reader(`${wsUrl}/v1/ws?token=${await mint("mai")}`);
     await Promise.all([tuan.opened, mai.opened]);
 
     const text = `over the wire ${randomUUID().slice(0, 8)}`;
@@ -245,13 +252,14 @@
   // harness's `gaps.md` G1 listed exactly those two mechanisms; neither remains.
   //
   // THE SENDER IS A BOT, because the caller is a key. A key may not name "tuan" — that
   // is a person and `sender_not_permitted` is the refusal — so the send that this test
   // needs to succeed must name software.
   it("delivers a REST-sent message, live and on resume", async () => {
-    const channelId = await seedOverTheWire("rest", ["tuan"]);
+    const { id: channelId, external_id: channelExternalId } =
+      await seedOverTheWire("rest", ["tuan"]);
     const token = await mint("tuan");
     // Created over the public route, because this suite has no database handle by
     // design — it is the one that tests what a customer can reach.
     await post(
       "/v1/users",
       {
@@ -342,13 +350,13 @@
     await resumed.opened;
     await new Promise((resolve) => setTimeout(resolve, 1_500));
     const ack = resumed.frames.find((f) => f.type === "connection.ack") as
       | { payload: { cursor: Record<string, number>; resume_ok: boolean } }
       | undefined;
     expect(ack?.payload.resume_ok).toBe(true);
-    expect(Object.keys(ack?.payload.cursor ?? {})).toContain(channelId);
+    expect(Object.keys(ack?.payload.cursor ?? {})).toContain(channelExternalId);
     // ONE FRAME, NOT TWO, AND THE CURSOR IS WHY. `cursor=${channelId}:1` says "I have
     // seen through sequence 1", so the backfill replays what came after it — the second
     // message only. Asserting two was an assumption about the fixture rather than a
     // reading of the cursor.
     const onResume = resumed.frames.filter((f) => f.type === "message.created");
     expect(onResume).toHaveLength(1);
```

### `packages/e2e/src/harness.ts` — the journey's clients read the name they are given.

```diff title="packages/e2e/src/harness.ts"
@@ -548,13 +548,17 @@
       await repo.addMember(channel.id, tuanUser.id);
       say(`seeded one channel with two members in ${primaryEnvironment}`);
       return {
         environmentId: primaryEnvironment,
         // The REST assertions present a credential, not a header.
         credential: await keyFor(primaryEnvironment),
-        channel: channel.id,
+        // THE NAME, NOT THE KEY (FR-RTM-11, chapter 4.23). A socket client sees
+        // `fleet` in every frame now, so a journey test that filters its timeline
+        // by the uuid matches nothing — which is how this lane found the change.
+        // Sending still accepts either form; reading only ever sees one.
+        channel: "fleet",
         dispatcher: new Client(
           "dispatcher",
           await token(primaryEnvironment, "dispatcher"),
           say,
         ),
         tuan: new Client("tuan", await token(primaryEnvironment, "tuan"), say),
```

### `packages/outsider/src/integrate.itest.ts` — the sealed suite stops pinning the key.

```diff title="packages/outsider/src/integrate.itest.ts"
@@ -165,12 +165,16 @@
 
 describe("integrating with Relay from the outside", () => {
   let api: string;
   let ws: string;
   let credential: string;
   let channelId: string;
+  /** What the customer called the channel. A socket client sees THIS in every frame
+   * from chapter 4.23 on, so a suite that holds a socket has to hold both names:
+   * REST routes take either, and frames only ever carry one. */
+  let channelExternalId: string;
   let token: string;
 
   const post = async (path: string, body: unknown, auth: string) => {
     const res = await fetch(`${api}${path}`, {
       method: "POST",
       headers: { "content-type": "application/json", authorization: `Bearer ${auth}` },
@@ -260,12 +264,13 @@
   it("creates a channel, and creating it twice is not an error", async () => {
     const external = `outsider-${Date.now()}`;
     const first = await post("/v1/channels", { external_id: external, type: "public" }, credential);
     expect(first.status).toBe(201);
     expect(first.body["external_id"]).toBe(external);
     channelId = first.body["id"] as string;
+    channelExternalId = external;
 
     // The documentation says a repeat returns the existing channel. 200 rather
     // than 201 is how a client tells which happened without reading the body.
     const again = await post("/v1/channels", { external_id: external, type: "public" }, credential);
     expect(again.status).toBe(200);
     expect(again.body["id"]).toBe(channelId);
@@ -756,15 +761,16 @@
     // THE MEMBERSHIP IS NOT OPTIONAL AND ITS ABSENCE IS SILENT. Measured while this was
     // being written: a socket opened with a valid token for a non-member received
     // `connection.ack` and `presence.changed` and **no `message.created` and no
     // `media.updated`** — on a PUBLIC channel. The absence of every frame looks exactly
     // like the absence of the one you came for, which is how an earlier probe read as
     // `media.updated` not existing at all.
+    const journeyExternal = `journey-${Date.now()}`;
     const journeyChannel = await post(
       "/v1/channels",
-      { external_id: `journey-${Date.now()}`, type: "public" },
+      { external_id: journeyExternal, type: "public" },
       credential,
     );
     expect(
       journeyChannel.status,
       "the journey could not create its own channel",
     ).toBe(201);
@@ -921,18 +927,22 @@
         f.payload?.["media_id"] === journeyMediaId,
       "media.updated for the journey's attachment",
     );
     //
     // THE WHOLE PAYLOAD, NOT THE STATE ALONE. `{media_id, channel, state}` and nothing
     // else — asserting only the state would pass for a frame announcing somebody else's
-    // object in somebody else's channel, which is the shape a fan-out bug takes. The
-    // channel is the id rather than the external id, which is worth pinning from out
-    // here because it is the field a client routes on.
+    // object in somebody else's channel, which is the shape a fan-out bug takes.
+    //
+    // **THE CHANNEL IS THE EXTERNAL ID SINCE CHAPTER 4.23, AND THIS COMMENT USED TO SAY
+    // THE OPPOSITE** — "the id rather than the external id… because it is the field a
+    // client routes on". That reasoning was right and its conclusion is now inverted:
+    // what a client routes on is the name the customer gave the channel, which is what
+    // the frame carries. A test pinning the uuid from out here was pinning the defect.
     expect(updated.payload).toEqual({
       media_id: journeyMediaId,
-      channel: journeyId,
+      channel: journeyExternal,
       state: "ready",
     });
 
     // STEP 8 — WHAT A RECIPIENT ACTUALLY READS (chapters 4.14 and 4.15).
     //
     // The whole payload, not the state alone: the rendition's id and its dimensions
@@ -1034,15 +1044,16 @@
    *  actually produce is the type one.
    *
    *  AND THE DECLARED SIZE IS HONEST. 43 bytes declared, 43 uploaded; a mismatch of one
    *  byte in either direction is a different refusal, and a test that got both wrong at
    *  once would pass for the wrong reason. */
   it("delivers a refused upload as a rejected marker a recipient can tell apart (4.17, SC-004)", async () => {
+    const rejectExternal = `reject-${Date.now()}`;
     const rejectChannel = await post(
       "/v1/channels",
-      { external_id: `reject-${Date.now()}`, type: "public" },
+      { external_id: rejectExternal, type: "public" },
       credential,
     );
     expect(rejectChannel.status).toBe(201);
     const rejectId = rejectChannel.body["id"] as string;
     expect(
       (
@@ -1148,13 +1159,15 @@
         );
       }
       await new Promise((r) => setTimeout(r, 50));
     }
     expect(frames.find((f) => f.type === "media.updated")?.payload).toEqual({
       media_id: rejectedId,
-      channel: rejectId,
+      // The name, not the key — a frame carries what the customer called the
+      // channel since chapter 4.23 (FR-RTM-11).
+      channel: rejectExternal,
       state: "rejected",
     });
     socket.close();
 
     // FR-MED-09's TESTABLE HALF: THE MESSAGE SURVIVES THE REFUSAL. Checked as a premise
     // before it was asserted — a history route that filtered a message whose only
@@ -1339,13 +1352,16 @@
     await until(ben.frames, (f) => f.type === "connection.ack", "ben's ack");
 
     ana.socket.send(JSON.stringify({ type: "typing.send", payload: { channel: channelId } }));
 
     await until(
       ben.frames,
-      (f) => f.type === "typing" && f.payload?.channel === channelId && f.payload?.user === "ana",
+      (f) =>
+        f.type === "typing" &&
+        f.payload?.channel === channelExternalId &&
+        f.payload?.user === "ana",
       "a typing frame naming ana",
     );
     // And the signaller hears nothing of their own — checked here rather than only
     // in-workspace, because it is the half a customer would notice.
     expect(ana.frames.filter((f) => f.type === "typing")).toEqual([]);
 
```
