// Read-only verification of committed evidence. This does not rerun acceptance.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=import.meta.dirname;
const repo=path.resolve(root,'../../../../../..');
const manifest=JSON.parse(readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const [file,entry]of Object.entries(manifest.artifacts)){
  const bytes=readFileSync(path.join(root,file));
  const value=entry.encoding==='utf8-lf'?bytes.toString('utf8').replaceAll('\r\n','\n'):bytes;
  assert.equal(createHash('sha256').update(value).digest('hex'),entry.sha256,'Evidence changed: '+file);
}
const source=JSON.parse(readFileSync(path.join(root,'source-manifest.json'),'utf8'));
for(const [file,expected]of Object.entries(source.changedFiles))assert.equal(createHash('sha256').update(readFileSync(path.join(repo,file),'utf8').replaceAll('\r\n','\n')).digest('hex'),expected,'Source changed: '+file);
execFileSync('git',['diff','--exit-code',source.commit,'--',...source.runtimePaths],{cwd:repo,stdio:'pipe'});
const tests=readFileSync(path.join(root,'tests.txt'),'utf8');
for(const count of ['tests 564','pass 564','fail 0','skipped 0'])assert.ok(tests.includes(count),'Missing test count: '+count);
const checks=JSON.parse(readFileSync(path.join(root,'checks.json'),'utf8'));
for(const check of Object.values(checks))assert.equal(check.code,0,check.mode);
const cleanup=JSON.parse(readFileSync(path.join(root,'cleanup.json'),'utf8'));
assert.equal(cleanup.testListenersRemaining,0);
assert.equal(cleanup.discord.priorCommandDefinitionsRestored,19);
assert.equal(cleanup.discord.definitionEqualityReadback,true);
console.log(JSON.stringify({artifacts:Object.keys(manifest.artifacts).length,hashes:'pass',source:source.commit,runtimeSource:'unchanged',recordedTests:564,acceptanceRerun:false}));
