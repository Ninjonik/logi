# Local acceptance evidence

The 2026-10-02 paired Logi/Valkyria implementation was tested with isolated local
databases and synthetic identities. No production Convex, real Discord role writes,
hosted OAuth probes or deployment were used for this qualification.

| Check | Result |
| --- | --- |
| Logi complete unit/infrastructure/bot suite | 696/696 passed |
| Logi TypeScript | Passed |
| Logi production build (`next build --webpack`) | Passed; webpack used because the isolated checkout shares installed dependencies through a junction |
| Scoped lint | No errors; one existing unused `_genericSuccessResponse` OpenAPI warning |
| Actual maintained Better Auth <-> Logi HTTP flow | 33/33 passed |
| Native command HTTP/Convex path | 22/22 passed |
| Website unit/PostgreSQL integration | 875/875 and 440/440 passed |
| Website optimized build, lint, typecheck | Passed |
| Actual browser login/create/read/update/role-loss/cancel/logout | 19/19 passed, plus two English/mobile visual checks |
| Existing website database upgrade | 6/6 passed; additive and repeatable |

See [check metadata](checks.json), [SSO assertions](sso-interop.json),
[native command assertions](native-event-commands.json), and the paired
[changed-source manifest](source-manifest.json). The manifest records both normalized
file digests and actual tested working-copy byte digests; its base commit IDs do not
by themselves identify the changed source.

The website owns the screenshot bundle and browser/migration reports under
`docs/evidence/logi-integration-2026-10-02/` in `ValkyriaWDG/www`. The PR discussion
links the commit-pinned bundle and selected images. These are actual application
captures of an optimized build using isolated local test configuration, not hosted
or production-cookie acceptance.

Protocol checks use real local HTTP and databases. Website journal regression tests
also use controlled remote responses to exercise unknown outcomes, retries and
late replies. Those stubs are distinct from the actual native command run. Synthetic
observations do not establish live Discord gateway delivery.

Activation still requires configured signing keys/client callback, explicit role
and command policies, coordinated backend rollout, website migration, pull timer,
and hosted/domain verification. No merge or deployment is implied by these results.
