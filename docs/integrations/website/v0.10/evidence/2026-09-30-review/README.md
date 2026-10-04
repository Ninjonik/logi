# Runtime review evidence — 2026-09-30

Final automated-check runtime source: `ba845b38703d7ab053bd4f6897c002fbf6268f9f`.
The final suite/typecheck/build ran before committing these same source changes;
`checks.json` preserves their original HEAD and dirty-file metadata.
`source-manifest.json` binds the resulting commit and normalized source hashes.
Live local acceptance ran incrementally during review; per-result times are
preserved. Not every live case was rerun after the last source edit.

- `tests.txt`: 564 passing tests, no failures or skips.
- `typecheck.txt`, `build.txt`, `convex-local-push.txt`, `openapi.txt`: successful checks; OpenAPI output remained unchanged.
- `eslint-changed.json`: 192 files, zero errors and 17 warnings; `eslint-files.txt` lists them.
- `eslint-repository-summary.json`: repository lint remains non-green (140 errors / 142 warnings).
- `*-regression-red.txt`: expected pre-fix failures, retained separately from final passing output.
- `clean-install*`: clean minimal npm install/ci and six gateway tests; `bun-clean-install*`: successful full-project frozen Bun install and patch application, without a second test run in that install.
- `runtime-collectors.json`: actual TLS/HTTP and native local database, synthetic provider responses.
- `runtime-membership.json`, `runtime-discord.json`: real authorized test Discord calls; the slash interaction is explicitly labeled as manual user confirmation.
- `runtime-extra.json`, `ui-readback.json`: actual local HTTP persistence and browser changes. The malformed-URL framework 500 remains a known limitation.
- `cleanup.json`: stopped local services, restored 19 command definitions and preserved member roles. Test channel/roles and private local database remain available for inspection.

Six actual dashboard captures are under `../../screenshots/runtime-review/` and
included in the artifact hashes. They show synthetic data and a synthetic signed
session, not completed Discord OAuth/Steam sign-in. No raw bot/provider logs,
environment files, cookies, full API keys or real member directories are exported.

Verify committed artifacts from the repository root:

```sh
node docs/integrations/website/v0.10/evidence/2026-09-30-review/verify-proof.mjs
```

This command checks hashes, counts and source equivalence; it does not rerun
acceptance. Follow [the report](../../runtime-review.md) and
[verification instructions](../../verification-evidence.md#reproduce) to rerun
tests with synthetic values or a separately authorized local environment.
Node used for the checks: v24.21.0 on Windows.
Text exports normalize line endings, remove ANSI color/trailing whitespace and
replace private paths/credential values; failures and diagnostics are retained.
