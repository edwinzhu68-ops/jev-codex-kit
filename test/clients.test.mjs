import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parse} from 'jsonc-parser';
import {clientConfig,installClient,ENTRY} from '../src/clients.mjs';
import {attachPi} from '../extensions/pi.mjs';

async function fixture(){
  const home=await mkdtemp(path.join(os.tmpdir(),'jev-clients-'));
  const root=path.join(home,'project'),kit=path.join(home,'kit');
  await mkdir(root);await mkdir(kit);
  await writeFile(path.join(root,'proof.txt'),'The test was not executed.\n');
  await writeFile(path.join(kit,'config.json'),JSON.stringify({version:1,roots:[root]}));
  return {home,root,kit,env:{JEV_KIT_HOME:kit}};
}
test('exports each client dialect without credentials, binding custom kit home',()=>{
  const env={JEV_KIT_HOME:path.resolve('test-only-kit'),TYPESAFE_API_KEY:'must-not-be-exported'};
  for(const client of ['codex','claude','cursor','opencode','pi','vscode','windsurf','generic']){
    const out=clientConfig(client,env);assert.ok(!JSON.stringify(out).includes(env.TYPESAFE_API_KEY));
  }
  assert.equal(clientConfig('claude',env).mcpServers['jev-kit'].type,'stdio');
  assert.equal(clientConfig('opencode',env).mcp['jev-kit'].type,'local');
  assert.deepEqual(clientConfig('opencode',env).mcp['jev-kit'].command,[process.execPath,ENTRY,'serve']);
  assert.equal(clientConfig('vscode',env).servers['jev-kit'].type,'stdio');
  assert.throws(()=>clientConfig('unknown'),/Unknown client/);
});
test('Cursor merge preserves comments/settings, backs up existing bytes, and is idempotent',async()=>{
  const f=await fixture(),file=path.join(f.home,'.cursor','mcp.json');await mkdir(path.dirname(file));
  const before='{// keep comment\n "mcpServers":{"other":{"command":"other-server"}}, "unrelated":true,\n}\n';await writeFile(file,before);
  const first=await installClient('cursor',f),after=await readFile(file,'utf8');
  assert.ok(after.includes('// keep comment'));assert.equal(parse(after).mcpServers.other.command,'other-server');assert.equal(parse(after).unrelated,true);
  assert.equal(first.changed.length,2);
  const backups=(await readdir(path.dirname(file))).filter(n=>n.includes('.jev-kit-backup-'));assert.equal(backups.length,1);assert.equal(await readFile(path.join(path.dirname(file),backups[0]),'utf8'),before);
  assert.equal((await installClient('cursor',f)).changed.length,0);
});
test('conflicting entries and invalid JSONC are refused without changing files',async()=>{
  const f=await fixture(),file=path.join(f.home,'.cursor','mcp.json');await mkdir(path.dirname(file));
  for(const before of ['{"mcpServers":{"jev-kit":{"command":"someone-else"}}}','{broken']){
    await writeFile(file,before);await assert.rejects(installClient('cursor',f));assert.equal(await readFile(file,'utf8'),before);
  }
});
test('skill conflict is caught before the MCP config is created',async()=>{
  const f=await fixture(),skill=path.join(f.home,'.cursor','skills','jev-codex-kit','SKILL.md');await mkdir(path.dirname(skill),{recursive:true});await writeFile(skill,'User customized skill');
  await assert.rejects(installClient('cursor',f),/Existing skill/);
  await assert.rejects(readFile(path.join(f.home,'.cursor','mcp.json')),{code:'ENOENT'});
  assert.equal(await readFile(skill,'utf8'),'User customized skill');
});
test('OpenCode honors JSONC/custom location and refuses ambiguous dual configs',async()=>{
  const f=await fixture(),dir=path.join(f.home,'oc');f.env.OPENCODE_CONFIG_DIR=dir;await mkdir(dir);const file=path.join(dir,'opencode.jsonc');await writeFile(file,'{ // preserved\n "model":"existing-provider/model",\n}\n');
  await installClient('opencode',f);const content=await readFile(file,'utf8');assert.ok(content.includes('// preserved'));assert.equal(parse(content).model,'existing-provider/model');assert.equal(parse(content).mcp['jev-kit'].enabled,true);
  await writeFile(path.join(dir,'opencode.json'),'{}');await assert.rejects(installClient('opencode',f),/Both opencode/);
});
test('Claude, Pi and VS Code write only their intended scoped files',async()=>{
  const f=await fixture();f.env.CLAUDE_CONFIG_DIR=path.join(f.home,'claude-custom');f.env.PI_CODING_AGENT_DIR=path.join(f.home,'pi-custom');
  for(const client of ['claude','pi','vscode']){const result=await installClient(client,f);assert.equal(result.changed.length,2);assert.equal((await installClient(client,f)).changed.length,0);}
  assert.equal(JSON.parse(await readFile(path.join(f.env.CLAUDE_CONFIG_DIR,'.claude.json'),'utf8')).mcpServers['jev-kit'].command,process.execPath);
  assert.ok((await readFile(path.join(f.env.PI_CODING_AGENT_DIR,'extensions','jev-kit.ts'),'utf8')).includes('attachPi'));
  assert.equal(JSON.parse(await readFile(path.join(f.root,'.vscode','mcp.json'),'utf8')).servers['jev-kit'].type,'stdio');
});
test('Pi native adapter registers 13 tools and performs actual MCP evidence/status calls without inference',async()=>{
  const f=await fixture(),tools=new Map(),events=new Map(),commands=new Map(),messages=[];
  const api={registerTool:t=>tools.set(t.name,t),on:(name,fn)=>events.set(name,fn),registerCommand:(name,fn)=>commands.set(name,fn),sendMessage:(msg,opts)=>messages.push({msg,opts})};
  const ext=await attachPi(api,{kitHome:f.kit});
  try{
    assert.equal(tools.size,13);assert.equal(tools.get('jev_prepare_evidence').parameters.type,'object');
    assert.equal(tools.get('jev_prepare_work').parameters.type,'object');
    await commands.get('jev-status').handler();assert.match(messages[0].msg.content,/13 tools connected/);assert.equal(messages[0].opts.triggerTurn,false);
    const result=await tools.get('jev_prepare_evidence').execute('test',{task:'Collect proof',root:f.root,sources:[{id:'proof',path:'proof.txt',pinned:true}]},new AbortController().signal);
    assert.equal(result.details.status,'EVIDENCE_READY');assert.equal(result.details.metrics.workflow_inference_calls,0);
    await assert.rejects(tools.get('jev_prepare_evidence').execute('bad',{task:'Invalid root',root:f.home,sources:[{id:'proof',path:'project/proof.txt',pinned:true}]}),/no valid judgment/);
  }finally{await events.get('session_shutdown')();await ext.close();}
});
