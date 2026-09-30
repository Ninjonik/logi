import assert from 'node:assert/strict';
import http from 'node:http';
import {createRequire} from 'node:module';
import {setTimeout as delay} from 'node:timers/promises';

const require = createRequire(import.meta.url);
const {WebSocketServer} = require('ws');
const [loader, scenario] = process.argv.slice(2);
assert.ok(['require', 'import'].includes(loader));
assert.ok(['cancel', 'recover', 'open'].includes(scenario));
const {WebSocketShard, WebSocketShardDestroyRecovery} = loader === 'require'
    ? require('@discordjs/ws') : await import('@discordjs/ws');
const deadline = setTimeout(() => { console.error('Gateway lifecycle timed out'); process.exit(2); }, 8000);
const server = http.createServer();
const gateway = new WebSocketServer({noServer: true});
const sockets = new Set();
let connections = 0, ready = false, session = null, shard;
let finishHandshake;
const heldHandshake = new Promise(resolve => { finishHandshake = resolve; });
server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
});
server.on('upgrade', (request, socket, head) => {
    connections++;
    if (connections === 1 && scenario !== 'open') {
        finishHandshake(socket);
        return;
    }
    gateway.handleUpgrade(request, socket, head, ws => {
        ws.on('message', raw => {
            const packet = JSON.parse(raw.toString());
            if (packet.op === 1) ws.send(JSON.stringify({op: 11, d: null}));
            if (packet.op === 2) ws.send(JSON.stringify({op: 0, t: 'READY', s: 1, d: {
                v: 10, user: {id: '900000000000000001', username: 'offline-fixture'},
                guilds: [], session_id: 'offline-session', resume_gateway_url: origin,
                application: {id: '900000000000000002', flags: 0},
            }}));
        });
        ws.send(JSON.stringify({op: 10, d: {heartbeat_interval: 1000}}));
    });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `ws://127.0.0.1:${server.address().port}`;
const strategy = {
    options: {
        gatewayInformation: {url: origin}, version: '10', encoding: 'json',
        compression: null, helloTimeout: 3000, readyTimeout: 3000, handshakeTimeout: 3000,
        shardCount: 1, token: 'offline-placeholder', intents: 0,
        identifyProperties: {os: 'test', browser: 'test', device: 'test'},
    },
    retrieveSessionInfo: async () => session,
    updateSessionInfo: async (_id, value) => { session = value; },
    waitForIdentify: async () => {},
};
shard = new WebSocketShard(strategy, 0);
// A normal application shard error handler must not be enough to mask a raw
// WebSocket 'error' event after the SDK detaches that socket's handler.
shard.on('error', () => {});
const becameReady = new Promise(resolve => shard.on('ready', () => { ready = true; resolve(); }));
void shard.connect().catch(() => {});
if (scenario !== 'open') {
    const pendingSocket = await heldHandshake;
    const teardown = shard.destroy(scenario === 'recover'
        ? {recover: WebSocketShardDestroyRecovery.Reconnect}
        : {});
    if (scenario === 'cancel') void shard.destroy();
    // The remote side resets while teardown owns the pending upgrade.
    setImmediate(() => pendingSocket.destroy());
    await teardown;
}
if (scenario !== 'cancel') {
    await becameReady;
    await shard.send({op: 1, d: 1});
    await shard.destroy();
}
// Longer than the SDK's 500ms recovery delay: detect unintended reconnects.
await delay(700);
assert.equal(connections, scenario === 'recover' ? 2 : 1);
assert.equal(sockets.size, 0, 'all connection resources must be closed');
await new Promise(resolve => gateway.close(resolve));
await new Promise(resolve => server.close(resolve));
clearTimeout(deadline);
console.log(JSON.stringify({connections, ready, openSockets: sockets.size}));
