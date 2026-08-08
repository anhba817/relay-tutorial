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
