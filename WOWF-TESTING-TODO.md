# WoW:F manual test follow-ups

Tested on 2026-10-09 in the `tset server teset` workspace only.

- [x] **Starter preset had the wrong name.** Verified fixed: the imported 20-player raid preset is now named `WoW:F 20-player raid`.
- [x] **WoW:F Tactical Maps were exposed by direct route.** Verified fixed: `/stratmaps?game=world_of_warcraft_forever` now returns the dashboard 404 and the create page is guarded too.
- [x] **The WoW:F event form rendered HLL map controls.** Verified fixed: its first step now contains only Activity, optional Target, and Name.
- [x] **Unsupported game-specific navigation/settings audit.** WoW:F is defined as capability-free in the global catalogue; map/stratmap page access is now enforced from the server, and specialized server-data/stat/result/competition features remain off in its definition.
- [x] **Barebones event signup incorrectly required a squad.** An explicit empty squad list now creates the ordinary ungrouped signup option, and the live Discord flow completed successfully.
- [x] **WoW:F squad presets could not be saved.** The dashboard request validator still used a fixed three-game enum; it now accepts catalogue-owned game IDs. A 20-player WoW:F raid preset saved, created a roster, accepted an imported signup, and published to Discord.
- [x] **Closed application card claimed role changes were still pending forever.** The decision card is a snapshot, so it now displays the closed outcome only instead of a progress chip and a time-based role-sync promise.
