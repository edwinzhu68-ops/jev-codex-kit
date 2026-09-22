import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createUIBroker } from '../src/ui-broker.mjs';
import { createBrokerSession,brokerDecision } from '../src/ui-broker-client.mjs';
import { createWindowsSession } from '../src/ui-windows.mjs';
import { installCodexSkill,removeCodexSkill } from '../src/codex-skills.mjs';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

async function broker(t,decide,options={}) {
 const home=await mkdtemp(path.join(tmpdir(),'jev-resume-')),token='a'.repeat(64);
 const server=createUIBroker({token,decide,...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const file=path.join(home,'broker.json'),port=server.address().port;
 await writeFile(file,JSON.stringify({protocol:2,port,token}));
 return {file,url:`http://127.0.0.1:${port}`,headers:{Authorization:'Bearer '+token}};
}
const task={goal:'Navigate through the report pages',authorized:true,controls:[{op:'click',name:'Next'}]};
function target(){let n=0;return {getAXState:async()=>`Browser tab: 1, Title: "Fixture", URL: "https://example.com/".\n0 AXWebArea Fixture\n1 button Next\n2 text Page ${n}`,click:async()=>n++};}
test('real loopback survives 40 actions across chunks; only recent history goes over wire',async t=>{
 const lengths=[];const b=await broker(t,async input=>{lengths.push(input.history.length);return {choice:'a0',confidence:1};});
 const flow=createBrokerSession(target(),{brokerFile:b.file,scope:{kind:'browser',allowedOrigins:['https://example.com']},maxSteps:8});
 let r;for(let n=0;n<5;n++){r=await flow.run(task);assert.equal(r.status,'STEP_LIMIT');}
 assert.equal(r.history.length,40);assert.equal(r.metrics.actions,40);assert(Math.max(...lengths)<=4);
 const health=await (await fetch(b.url+'/health',{headers:b.headers})).json();assert.equal(health.status,'READY');assert.equal(health.calls,40);
});
test('two simultaneous UI tasks finish without a shared busy failure',async t=>{
 const b=await broker(t,async()=>{await new Promise(r=>setTimeout(r,60));return {choice:'DONE',confidence:1};});
 const flows=[target(),target()].map(t=>createBrokerSession(t,{brokerFile:b.file,scope:{kind:'browser',allowedOrigins:['https://example.com']}}));
 const results=await Promise.all(flows.map(f=>f.run(task)));assert(results.every(r=>r.status==='NEEDS_VERIFICATION'));
});
test('Chinese payload over 24k bytes is accepted below 24k characters; genuine overflow rejects',async t=>{
 let calls=0;const b=await broker(t,async()=>{calls++;return {choice:'DONE',confidence:1};});
 const input={goal:'检查当前页面',state:'中'.repeat(9000),actions:[],history:[]};
 assert(Buffer.byteLength(JSON.stringify(input))>24000);
 assert.equal((await brokerDecision(b.file)(input,{signal:AbortSignal.timeout(5000)})).choice,'DONE');
 assert.equal((await fetch(b.url+'/judge',{method:'POST',headers:b.headers,body:'x'.repeat(72001)})).status,413);
 assert.equal(calls,1);
});
test('missing broker is resumable before inference, provider errors remain terminal',async t=>{
 const home=await mkdtemp(path.join(tmpdir(),'jev-absent-'));
 const flow=createBrokerSession(target(),{brokerFile:path.join(home,'absent.json'),scope:{kind:'browser',allowedOrigins:['https://example.com']}});
 assert.equal((await flow.run(task)).status,'BROKER_NOT_READY');assert.equal((await flow.run(task)).status,'BROKER_NOT_READY');
 const b=await broker(t,async()=>{throw Error('provider failed');});
 const fail=createBrokerSession(target(),{brokerFile:b.file,scope:{kind:'browser',allowedOrigins:['https://example.com']}});
 assert.equal((await fail.run(task)).status,'ERROR_HANDOFF');assert.equal((await fail.run(task)).status,'SESSION_STOPPED');
});
test('Windows adapter requires host inspection and performs only one sky action per step',async()=>{
 let n=0;const window={id:7,app:'fixture'};
 const sky={target:'windows',get_window_state:async()=>({window,accessibility:{tree:`0 window Fixture\n${n+1} button Next\n9 text Page ${n}`}}),click:async input=>{assert.equal(input.window.id,7);assert.equal(input.element_index,n+1);n++;}};
 const flow=createWindowsSession(sky,window,{decide:async()=>({choice:'a0',confidence:1})});
 const observation=await flow.observe();await assert.rejects(flow.step({...task,observation}),/OBSERVE_INSPECT/);
 const r=await flow.step({...task,observation,inspected:true});assert.equal(r.status,'OBSERVE_REQUIRED');assert.equal(n,1);assert.equal(r.verified,false);
 await assert.rejects(flow.step({...task,observation,inspected:true}),/OBSERVE_INSPECT/);
 const r2=await flow.step({...task,observation:r.observation,inspected:true});assert.equal(r2.metrics.actions,2);
});
test('missing Windows accessibility never invents controls or calls a model',async()=>{
 const window={id:7,app:'fixture'},sky={target:'windows',get_window_state:async()=>({window,accessibility:null}),click:()=>assert.fail()};
 const flow=createWindowsSession(sky,window,{decide:()=>assert.fail()});const observation=await flow.observe();
 assert.equal((await flow.step({...task,observation,inspected:true})).status,'HOST_VISUAL_REQUIRED');
});
test('owned skill upgrade backs up exact bytes; removal preserves modified files',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'jev-skill-upgrade-'));
 const installed=await installCodexSkill('jev-ui',{home});await writeFile(installed.skill,'old customized skill');
 await assert.rejects(installCodexSkill('jev-ui',{home}),/preserved/);await assert.rejects(removeCodexSkill('jev-ui',{home}),/PRESERVED/);
 const upgraded=await installCodexSkill('jev-ui',{home,upgrade:true});assert(upgraded.backup);
 assert.equal((await removeCodexSkill('jev-ui',{home})).status,'REMOVED');assert.equal((await removeCodexSkill('jev-ui',{home})).status,'NOT_INSTALLED');
});

test('idle broker actually closes rather than advertising an expired READY service',async()=>{
 const server=createUIBroker({token:'a'.repeat(64),decide:()=>assert.fail('No host request'),idleMs:100});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 await new Promise(r=>server.once('close',r));assert.equal(server.listening,false);
 await assert.rejects(fetch(`http://127.0.0.1:${port}/health`,{signal:AbortSignal.timeout(1000)}));
});

test('simultaneous real launcher processes share one broker without paid calls',async()=>{
 const home=await mkdtemp(path.join(tmpdir(),'jev-start-race-'));
 const env={...process.env,JEV_KIT_HOME:home,TYPESAFE_API_KEY:'fixture-only-not-a-provider-key'};
 const start=()=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['bin/jev-kit.mjs','ui','start'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});let out='',err='';child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.once('error',reject);child.once('exit',code=>code===0?resolve(JSON.parse(out)):reject(Error(err)));});
 let descriptor;
 try{const results=await Promise.all([start(),start()]);descriptor=JSON.parse(await readFile(path.join(home,'ui','broker.json')));assert.equal(results.filter(r=>r.status==='STARTED').length,1);assert.equal(results.filter(r=>r.status==='RUNNING').length,1);const health=await (await fetch(`http://127.0.0.1:${descriptor.port}/health`,{headers:{Authorization:'Bearer '+descriptor.token}})).json();assert.equal(health.calls,0);}
 finally{descriptor??=JSON.parse(await readFile(path.join(home,'ui','broker.json')));try{process.kill(descriptor.pid);}catch(e){if(e.code!=='ESRCH')throw e;}}
});
