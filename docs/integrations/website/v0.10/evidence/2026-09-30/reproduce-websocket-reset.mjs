// Isolated dependency diagnostic. No Discord requests or credentials.
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(path.resolve(import.meta.dirname,'../../../../../../package.json'));
const {WebSocketShard}=require('@discordjs/ws');
const mode=process.argv[2];
if(!['control','destroy-connecting'].includes(mode))throw Error('Expected mode');
let shard;
const server=http.createServer();
const deadline=setTimeout(()=>{console.error('Diagnostic deadline');process.exit(2);},3000);
server.on('upgrade',async(_request,socket)=>{
 if(mode==='destroy-connecting'){
  await shard.destroy({code:1000,reason:'Local acceptance teardown reproduction'});
  console.log('SDK destroyed CONNECTING socket before the pending handshake ended');
 }
 socket.destroy();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const strategy={
 options:{gatewayInformation:{url:`ws://127.0.0.1:${server.address().port}`},version:'10',encoding:'json',compression:null,helloTimeout:2000,handshakeTimeout:2000,shardCount:1,token:'offline-placeholder'},
 retrieveSessionInfo:async()=>null,updateSessionInfo:async()=>{},
};
shard=new WebSocketShard(strategy,0);
shard.on('error',()=>console.log('SDK shard error listener invoked'));
shard.on('debug',({message})=>{
 if(mode==='control'&&message.includes('Failed to connect to the gateway URL specified due to a network error')){
  console.log('Control: network reset handled by SDK without process crash');
  clearTimeout(deadline);server.close();process.exitCode=0;setTimeout(()=>process.exit(0),100);
 }
});
void shard.connect().catch(()=>console.log('connect rejected through its promise'));
