// Chapter 4.9 figures. Mermaid sources live here, never in page.mdx.
// Every number is from specs/054-chapter-4-9/baseline.txt.

export const figTheSignalWasIndistinguishable = `flowchart TB
    suite["the planted-drift suite<br/>reconcile.itest.ts — written at 4.7<br/>16 tests, runs on every push, PASSES"]
    gate["pnpm test:integration"]
    suite --> gate
    reds["six failures, none of them metering<br/>5 × request-log.itest.ts — no ingester<br/>1 × limits.itest.ts — no platform credential"]
    reds --> gate
    before["EXIT 1, every run since chapter 4.4"]
    gate --> before
    drift["plant a drift in the meter"]
    after["EXIT 1"]
    drift --> after
    note["The signal was not ABSENT. It was INDISTINGUISHABLE:<br/>the run was already the colour a failure would turn it."]
    before ~~~ note
    after ~~~ note
    stopped["and --concurrency=1 stopped scheduling at the first failure<br/>gateway 12 suites · e2e 4 · ingester 2 · dispatcher 1 · harness 2<br/>= 21 suites that had not run since chapter 4.4"]
    before --> stopped`;

export const figWhatZeroPointOnePercentCanExpress = `flowchart LR
    q["0.1% of what?"]
    nine["9 connection-minutes<br/>smallest drift 1 = 11.111%<br/>every drift breaches"]
    lane["1,017 messages — the lane's largest<br/>smallest drift 2 = 0.197%<br/>twice the bound"]
    ten["10,000<br/>smallest drift 11 = 0.110%<br/>the bound first resolves"]
    corpus["121,057 — the corpus's largest<br/>smallest drift 122 = 0.1008%<br/>121 passes, 122 breaches"]
    q --> nine --> lane --> ten --> corpus
    verdict["A green 0.1% assertion below 10,000<br/>claims that nothing drifted at all."]
    lane ~~~ verdict`;

export const figThreeObligationsOneMechanism = `flowchart TB
    clause["'…reconcile to within 0.1%,<br/>verified by a DAILY JOB<br/>that ALERTS ON BREACH'"]
    one["the comparison<br/>reconcile.ts, chapter 4.7<br/>exercised on every push"]
    two["the daily job<br/>NO RUNNER OF ANY KIND"]
    three["the alert<br/>NO MECHANISM"]
    clause --> one
    clause --> two
    clause --> three
    evidence1["measured: 121,057 vs 121,057, 0.0000%"]
    one --> evidence1
    evidence2["0 hits for reconcile-usage in package.json,<br/>turbo.json, ci.yml, the tutorial's package.json,<br/>any *.sh — and ci.yml has no schedule:"]
    two --> evidence2
    evidence3["the job exits non-zero; both mail paths<br/>share a transport defaulting to a local catcher"]
    three --> evidence3
    recorded["Recorded where: SRS 1.14 recorded the alert.<br/>The daily job was recorded NOWHERE until this chapter."]
    evidence2 --> recorded`;
