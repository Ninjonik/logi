# API Cleanup — Active Work

This is the active handoff checklist for making the authenticated `/api/v1`
implementation DRY without changing its public behavior. Work on one complete
package at a time.

## Rules for every package

1. Read `AGENTS.md`, `README.md`, `ARCHITECTURE.md`, and `CONTRIBUTING.md`
   before changing behavior. Inspect the implementation and nearby tests first.
2. Preserve existing uncommitted work. Do not edit generated files, run Convex
   deploy/codegen, or create new Convex actions without explicit authorization.
3. Keep every existing API path, request shape, response shape, status code,
   authorization rule, webhook event, and idempotency behavior compatible.
4. Reuse existing application use-cases, repositories, Convex functions, and
   domain helpers. New internal TypeScript helpers are allowed only when they
   remove demonstrated duplication without creating a parallel abstraction.
5. For every API behavior or contract change, update the OpenAPI document and
   the relevant `content/` wiki page in the same package.
6. Before handoff, run the package validation and `git diff --check`.
7. When a package is genuinely complete, **remove its entire section from this
   file**. Do not replace it with a completion note. Leave only real blockers.

## Known design constraint

The resource write and its idempotency record must remain in one Convex
transaction. Reusing existing functions is preferred, but a separately invoked
reservation/completion pair must not be wired into the HTTP route if it breaks
that guarantee.
