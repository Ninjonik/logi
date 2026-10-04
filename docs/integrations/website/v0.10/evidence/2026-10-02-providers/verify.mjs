// Offline evidence integrity check; this does not call providers or rerun acceptance.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=import.meta.dirname;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const [file,hash]of Object.entries(manifest.artifacts))assert.equal(createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replaceAll('\r\n','\n')).digest('hex'),hash,file);
const result=JSON.parse(fs.readFileSync(path.join(root,'results.json'),'utf8'));
assert.ok(result.requests.every(request=>request.method==='GET'));
assert.ok(result.compatibility.every(check=>check.status==='pass'));
assert.equal(result.scope.productionConvexUsed,false);
assert.equal(result.warcon.logiPanelAdapterImplemented,false);
execFileSync('git',['diff','--exit-code',result.logiSource,'--','src','convex','discord-bot','package.json','bun.lock','patches'],{cwd:path.resolve(root,'../../../../../..'),stdio:'pipe'});
console.log(JSON.stringify({hashes:'pass',runtimeSource:'unchanged',recordedRequests:result.requests.length,additionalLiveTransportRequests:1,compatibilityChecks:result.compatibility.length,providerCallsDuringVerification:0}));
