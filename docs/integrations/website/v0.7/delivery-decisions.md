# W2 and I1 delivery decisions

These decisions bound the reviewed producer milestone. Each records the trade-off
and the remaining acceptance cost; implementation and evidence are linked from
[validation](./validation.md). Website and deployment work remain with their owners.

## Producer synchronization

- execute W2 and I1 inline on the existing clean feature branch — current user continuation and original contribution instructions authorize implementation and feature-branch push — cost if wrong: a larger reviewable milestone, no deployment.
- use a mutation-local database decorator for the enumerated event/collector writers, with an explicit coverage manifest and entrypoint tests — tracking final transaction state covers nested repositories without duplicating invalidation logic — cost if wrong: unregistered writers can be caught only by coverage review/tests.
- feed supports only registered safe projections, not arbitrary raw resources — the design requires complete producer coverage before advertisement — cost if wrong: consumers must continue existing raw-resource polling.
- keep numeric revision strings within 128 decimal digits and index their zero-padded ordering key — lossless beyond Number and practical bounded cursor/schema size — cost if wrong: exhausting that range fails a mutation rather than wrapping.
- lettered W2/I1 headings are read directly; numeric task-start helper cannot extract them — preserve accepted task IDs — cost if wrong: manual ledger bookkeeping.
- use the existing minute recovery cron plus paged startup queue migration and per-guild wake ordering — bounds both migration work and tenant head-of-line blocking — cost if wrong: a very fast run can process fewer than 25 messages and schedules another run.
- HMAC-sign cursors in the trusted Next.js gateway, then recheck stored key scope in the same Convex read as data/revision — no query-runtime Node crypto dependency — cost if wrong: internal-secret compromise remains outside the service-key trust boundary.
- no visual changes in W2; the new invalidation event is explicit through the existing administrator-session webhook endpoint, and polling works without it — preserve existing subscriptions — cost if wrong: administrators need the documented endpoint until a UI chooser exists.

## Membership and acceptance

- preserve existing Discord OAuth and separate private provider qualification — identity is not membership authority — cost if wrong: optional SSO activation remains deferred.
- per-key explicit membership grant plus enabled role allowlist, exact subject only — minimizes authority/data exposure — cost if wrong: consumers must configure both gates.
- membership change cursors bind one Discord subject; policy/epoch changes reset scope; separate opt-in membership.changed webhook — existing integration.changed subscriptions must not receive member IDs — cost if wrong: consumers poll/reset each subject independently.
- REST has durable 15-second reservation, 30-second subject cooldown, 30 refreshes/guild/minute and shared Retry-After — bound Discord demand — cost if wrong: brief unavailable responses deny protected actions.
- new bot full sync uses fenced 100-member batches with verified fetch completeness; old full-sync endpoint only retains legacy cache compatibility — stale snapshots must not resurrect departed members — cost if wrong: bot restart required during activation.
- policy writes require same-origin administrator session, rechecked after bounded request-body read; no bearer-key management API — avoid widening key authority — cost if wrong: server-to-server policy provisioning remains unavailable.
- preserve legacy formatting in userAssignments (import-only change) — avoid unrelated file churn — cost if wrong: file keeps existing formatting debt.
- original contribution instructions explicitly request reporting pre-existing failures and avoiding unrelated changes; retain the unchanged embed-order failure and three baseline competition lint errors instead of blocking publication under the finishing skill's generic all-green condition — cost if wrong: upstream CI remains non-green for existing reasons, clearly disclosed.
- follow already authorized feature-branch push/PR update instead of presenting another branch-choice menu — exact original authorization was re-read — cost if wrong: review branch updates, no merge or deployment.
- website bootstrap/inbox/duplicate ACK/publication/consent W1/W3/W4 remain consumer-owned — Logi supplies reviewed producer contracts and fixtures, website writes are explicitly out of scope — cost if wrong: website synchronization is not complete until its owner implements acceptance.
- website OAuth/session/callback replay/logout I2/I4 deferred — preserve the existing provider boundary and separate private acceptance — cost if wrong: no production SSO readiness claim.
- role-operation authorization/convergence I3 deferred — I1 exposes observations without adding live role writes — cost if wrong: managed-role reliability still needs a dedicated milestone.
- verified Steam linking I5 deferred — never infer identity from nickname or an unverified identifier — cost if wrong: player-to-website linking remains unavailable until verified.
- hosted/private SSO/provider connectivity/deployment readiness excluded — fixtures do not establish real credentials or live permissions; user deferred setup — cost if wrong: activation can still fail and needs deployment acceptance.
- real Convex execution limits/distributed scheduling/load unverified — source and transaction-double evidence are disclosed as offline — cost if wrong: deployment testing may require sizing or scheduling changes.
- reviewer did not repeat browser accessibility/screenshot checks — root ran actual synthetic CS/EN/DE, retry, workspace-switch and 390px component checks; screenshots committed — cost if wrong: hosted accessibility/integration defects can remain.
- reviewer did not rerun full-suite/lint/build baselines — root reran them, retained the unchanged embed-order failure and existing lint/toolchain/prerender limitations — cost if wrong: these existing checks keep upstream CI non-green.
