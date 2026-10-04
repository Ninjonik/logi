# Game servers UI: synthetic screenshots

Captured on 2026-10-04 from `src/components/app/game-data-sources.tsx` at the
commit that adds encrypted game-server keys. The component was bundled with
esbuild, styled with the application's Tailwind stylesheet and rendered in
headless Chromium. The browser `fetch` was replaced with fixed synthetic
responses. No Logi deployment, Convex backend, Discord workspace, provider or
real key was involved; hosts use `example.test` and the typed key was a
synthetic placeholder. The capture script failed if that placeholder appeared
anywhere in the page's HTML, and it checked that the key field is a masked
password input that is cleared after saving.

| File                              | Shows                                                                                                                                                          |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-server-list.png`              | A workspace server with a verified stored key, an operator server using its operator key, and a pre-change registration that needs its key again; the add form |
| `02-add-server-tested.png`        | Add form after a passing connection test; the key field is masked                                                                                              |
| `03-server-saved.png`             | Confirmation after saving with collection enabled; the key field is empty                                                                                      |
| `04-change-key-refused.png`       | A key change whose test failed: nothing is stored, the key field is cleared, the unverified option is offered                                                  |
| `05-encryption-not-activated.png` | Notice shown while the operator has not activated encryption; saving is disabled                                                                               |
| `06-server-list-cs.png`           | Czech copy                                                                                                                                                     |

These images prove layout and copy only. Behaviour is proven by the tests listed
in [game-server credentials](../../game-server-credentials.md#evidence); live
acceptance against real servers is still pending.
