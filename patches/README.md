# Discord gateway lifecycle patch

`@discordjs/ws` is pinned to **1.2.3**, the dependency used by Discord.js 14.27.
`npm install`, `npm ci` and `bun install --frozen-lockfile` apply the checked-in
patch through `patch-package --error-on-fail`. Production installations need
`patch-package`, so it is a production dependency. An install that skips lifecycle
scripts must explicitly run `npm run postinstall` before starting the bot.

## Why the patch exists

Destroying a shard while its WebSocket is still connecting previously detached
the raw socket error handler without closing the pending upgrade. A reset then
raised an unhandled `ECONNRESET` and terminated the process. An application-level
`Client`/`ShardError` listener could not catch that detached socket event.

The patch closes every non-closed connection and keeps the error listener until
closure completes. It also guards re-entrant destruction: aborting a pending
handshake can request destruction again, which otherwise replaces the close
callback or reconnects twice. The guard is released before recovery connects.
Both CommonJS/ESM exports and both default worker bundles are patched. The
generated bundle indentation is retained to keep the patch small.

## Regression and removal

Run from the repository root, without Discord credentials:

```sh
node --import tsx --test discord-bot/src/gateway-lifecycle.test.ts
```

Six child-process tests use the actual installed SDK against a loopback WebSocket
gateway: interrupted connection cancellation, interruption followed by a READY
reconnect, and ordinary open-connection closure, through CJS and ESM. They assert
the process survives, there is no duplicate connection, and all owned sockets
close. Before this patch the four interrupted-handshake cases fail. The worker
bundles receive the equivalent patch but are not exercised as worker threads.

When moving to an upstream version with an equivalent fix, remove the override
and patch together, refresh `bun.lock`, and rerun these tests plus authorized live
gateway/restart acceptance. Do not silently carry a patch across SDK versions or
use a process-wide uncaught-exception handler to suppress the failure.

See the [runtime review](../docs/integrations/website/v0.10/runtime-review.md)
for clean-install evidence and the limits of live acceptance.
