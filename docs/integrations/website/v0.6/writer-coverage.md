# Producer writer coverage

`integrationMutation.ts` captures the first/final row inside each registered
Convex mutation, including nested repositories. Change records, revisions and
scheduled work share the authoritative transaction. Multiple writes coalesce;
throws commit nothing. Tests simulate rollback; Convex supplies the real guarantee.

| Producer           | Registered entrypoints                                                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard and bot  | All `events` mutations: upsert, toggleSignUp, reconcileStatuses, applyEventScore, conclude, completeTraining, appendAttendanceReminderLog, upsertNotice, setDiscordEventRoles, setResult |
| API                | `publicApi.mutateClanEvent`, `mutateClanEventSignup`; every mutation in that module uses the decorator, preserving existing idempotency                                                  |
| Discord resync     | `discordSync.requestForumTopicResync` changes event updatedAt; message sync metadata is not projected                                                                                    |
| User merge         | `players.mergeUsers` rewrites event participants/signups and updatedAt; all mutations in `players` use the decorator                                                                     |
| Result import      | `matchStats.upsertForEvent` updates event timestamp/linkage; `events.setResult` changes the provisional result                                                                           |
| Migration          | `migrations.migrateEventResults`; old result shapes are compared without DTO parsing so migration remains possible                                                                       |
| Helper setup       | `serverSetup.resetHelperDataForGuild`, `initializeDefaultHelperDataForGuild`; projected timestamps if modified                                                                           |
| Competition        | `competitions.linkEvent`; nonprojected linkage today, tracked for future projected changes                                                                                               |
| Snapshot collector | `gameData.configure`, `claimNext`, `finishSnapshot`                                                                                                                                      |
| History collector  | `gameDataHistory.claimNext`, `commit`, `fail`; connection health only, never private sessions                                                                                            |

Event fields: name, kind, status, gameStart, gameEnd, updatedAt, eventResult,
guildId and resolved gameId. Collector fields: provider, enabled, observation,
errorCategory, historyCount, historyErrorCategory and scope. The bookkeeping
times (lastAttemptAt, nextAttemptAt, historyLastSuccessAt, updatedAt) advance
on every collector run and are not a change; the served `integration-health`
record carries the current values. Likewise a session (`player-stat-summaries`)
seen again with the same content (fetchedAt, updatedAt only) is not a change.
Kind/scope changes remove the old projection (e.g. match to training). Extra
invalidations are harmless; private fields never enter the stream.

Handler tests exercise dashboard upsert, API create, bot role update, result
import, migration and user merge; collector tests exercise decorated configure/claim/finish
and history paths. Static tests protect the registered entrypoint imports.
New writers/fields require manifest and handler-test updates; this is not an
automatic proof of future code. Scope, retention and rollback tests are separate.

Membership tracking in v0.7 also covers assignment rekey/deletion during user
merge: both affected subjects are invalidated on rekey, and the removed subject
is invalidated when a duplicate assignment is deleted.

The standalone legacy HLL scope repository currently has no production caller;
any future caller must use the decorator. Scheduled jobs call covered event
handlers. Public previews, raw stats and recap bodies are not summary dependencies.
