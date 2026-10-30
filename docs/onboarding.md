# Dashboard tours

The account introduction and role-specific clan tours navigate actual dashboard
routes. `src/domain/onboarding/walkthrough.ts` defines each route, spotlight target
and expected click. NextStep.js renders the dimmed overlay and guide card; the
controller waits for the new route and target before opening the spotlight.
Back, Next, arrow keys, Skip and footer replay remain available.

## Examples and interaction boundaries

`OnboardingPage` replaces the page slot throughout every active tour, including route
transitions. Every section uses the same fictional NOVA clan and relative dates. The surrounding sidebar and header remain real. Players reuse
`PlayersTable`, including `PlayerTrendIndicators`; the example profile reuses
`PerformanceHistoryChart`. Match creation mounts the production `NewMatchFlow`
with controlled fixture values, metadata and wizard stage. Its demo adapter
bypasses autosave, draft writes, publishing and redirects. Fictional IDs never
reach product persistence. The reserved authenticated `users/onboarding-example`
route is a read-only example, not a player record.

A capture-phase interaction guard permits the guide controls and intercepts
highlighted actions to advance the tour. Other dashboard clicks and mutation
keystrokes are blocked while the guide is active. Server routes may still load in the background, but their content is never
shown during the tour. Live bot warnings are hidden. Discord metadata is supplied
locally to the native settings forms, so their previews also use fictional
channels and roles. Calendar, sign-ups, rosters, results, training, league entries,
settings and integrations are populated even when the real clan is empty. Exiting unmounts fixtures and restores the starting route. The match
animation supports pause, replay and reduced motion.

[Nielsen Norman Group](https://www.nngroup.com/articles/mobile-app-onboarding/)
recommends optional, focused instructions and low-stakes examples. The tour
follows task order, provides direct click instructions and can be skipped at any
point. Full managers see the feature catalogue; limited-mode and member tours
include only the pages appropriate to their access.

## Progress and API boundary

The existing personal-session `/api/user/onboarding` endpoint records completion
through `players:markOnboardingSeen`. The existing `workspaceTourCompletedAt`
string-keyed metadata map also stores versioned tour scopes:
`tour-v3:<kind>:<workspaceId>` and `tour-v3:welcome:account`. Legacy keys are
retained. Role and mode have distinct kinds, so member completion never consumes
an admin introduction. These are guidance preferences, not authorization grants.
Current admin visibility comes from the shared `canAdminWorkspace` helper,
including explicit deny overrides.

Local bookmarks use `logi:onboarding:<userId>:<tourKey>`, contain only a known
step and active/done status, and are validated against the current catalogue.
No route is read from storage. Completed scopes are saved to the account;
uncompleted chapters resume in the same browser. A failed account save is
reported with retry and does not trap the user in the guide. Skipping exits the
sequence for the current scope; finishing the account introduction may continue
to the clan introduction. Replay remains available from the footer.

Onboarding remains a first-party personal UI preference. It is deliberately not
available to clan-scoped `/api/v1` integration keys: a clan website must not mark
another person's account guidance as seen. This change adds no product-data
writes or new Convex schema/function contract.

Example routes and simulated actions have no `/api/v1` counterpart: they do not
create or change product resources.
