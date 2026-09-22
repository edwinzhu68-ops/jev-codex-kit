import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { toolCatalog, executeTool } from '../src/tools.mjs';
import { MODEL } from '../src/settings.mjs';

const entry = fileURLToPath(new URL('../bin/jev-kit.mjs', import.meta.url));
async function fixture() {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'jev-kit-entry-'));
  const root = path.join(temp, 'project'); await mkdir(root);
  await writeFile(path.join(root, 'proof.txt'), 'The inventory test was not run.\n');
  const env = { ...process.env, JEV_KIT_HOME: path.join(temp, 'config') };
  delete env.TYPESAFE_API_KEY;
  const run = (...args) => spawnSync(process.execPath, [entry, ...args], { env, encoding: 'utf8', windowsHide: true, timeout: 15000 });
  return { temp, root, env, run };
}
test('setup preserves configured roots; doctor is offline and reports missing key', async () => {
  const f = await fixture();
  assert.equal(f.run('setup', '--root', f.root, '--no-key-prompt').status, 0);
  assert.equal(f.run('setup', '--root', f.root, '--no-key-prompt').status, 0);
  const cfg = JSON.parse(await readFile(path.join(f.env.JEV_KIT_HOME, 'config.json'), 'utf8'));
  assert.deepEqual(cfg.roots, [await realpath(f.root)]);
  const doctor = f.run('doctor'); assert.equal(doctor.status, 1);
  const data = JSON.parse(doctor.stdout); assert.equal(data.network_requests, 0); assert.equal(data.key_present, false);
  const config = JSON.parse(f.run('config').stdout); assert.deepEqual(config.mcpServers['jev-kit'].args, [entry, 'serve']);
  assert.ok(!JSON.stringify(config).includes('API_KEY'));
});

test('skills CLI exports offline metadata, preserves outputs and rejects stale catalog before inference', async () => {
  const f = await fixture(), directory = path.join(f.root, 'skills'), skill = path.join(directory, 'manual', 'SKILL.md');
  await mkdir(path.dirname(skill), {recursive:true});
  await writeFile(skill, '---\nname: manual\ndescription: Follow explicit user instructions\ndisable-model-invocation: true\n---\nDo not export this body.');
  const catalog = path.join(f.temp, 'catalog.json'), resultFile = path.join(f.temp, 'result.json');
  assert.equal(f.run('skills','catalog',directory,catalog).status,0);
  assert.ok(!(await readFile(catalog,'utf8')).includes('Do not export this body'));
  assert.equal(f.run('skills','catalog',directory,catalog).status,1);
  assert.equal(f.run('skills','suggest',catalog,'An ordinary request',resultFile).status,0);
  const result = JSON.parse(await readFile(resultFile,'utf8'));
  assert.equal(result.status,'EMPTY_CATALOG'); assert.equal(result.metrics.workflow_inference_calls,0);
  assert.equal(result.source_validation,'fresh_at_readback');
  assert.equal(f.run('skills','suggest',catalog,'An ordinary request',resultFile).status,1);
  await writeFile(skill,'---\nname: manual\ndescription: Changed\n---\n');
  const stale = path.join(f.temp,'stale.json');
  assert.equal(f.run('skills','suggest',catalog,'New request',stale).status,1);
  await assert.rejects(readFile(stale),{code:'ENOENT'});
});
test('CLI produces actual source evidence without key; refuses output overwrite and unauthorized roots', async () => {
  const f = await fixture(); assert.equal(f.run('setup','--root',f.root,'--no-key-prompt').status,0);
  const input = path.join(f.temp,'input.json'), output = path.join(f.temp,'output.json');
  await writeFile(input, JSON.stringify({task:'Collect proof',root:f.root,sources:[{id:'proof',path:'proof.txt',pinned:true}]}));
  assert.equal(f.run('call','jev_prepare_evidence',input,output).status,0);
  const result = JSON.parse(await readFile(output,'utf8'));
  assert.equal(result.status,'EVIDENCE_READY'); assert.equal(result.metrics.workflow_inference_calls,0);
  assert.equal(result.evidence[0].text,'The inventory test was not run.\n');
  assert.equal(f.run('call','jev_prepare_evidence',input,output).status,1);
  assert.deepEqual(JSON.parse(await readFile(output,'utf8')),result);
  await writeFile(input, JSON.stringify({task:'Collect proof',root:f.temp,sources:[{id:'proof',path:'project/proof.txt',pinned:true}]}));
  const denied = path.join(f.temp,'denied.json'); assert.equal(f.run('call','jev_prepare_evidence',input,denied).status,1);
  assert.equal(JSON.parse(await readFile(denied,'utf8')).status,'ERROR');
});
test('actual stdio exposes 12 tools and returns deterministic evidence and required skills with no provider', async () => {
  const f = await fixture(); assert.equal(f.run('setup','--root',f.root,'--no-key-prompt').status,0);
  const transport = new StdioClientTransport({command:process.execPath,args:[entry,'serve'],env:f.env,stderr:'pipe'});
  let stderr=''; transport.stderr?.on('data',c=>stderr+=c.toString());
  const client = new Client({name:'kit-test',version:'1'});
  try {
    await client.connect(transport); const tools = await client.listTools(); assert.equal(tools.tools.length,12);
    assert.ok(tools.tools.some(t=>t.name==='jev_code_brief'));
    const routed = await client.callTool({name:'jev_route_skills',arguments:{goal:'User requires review',candidates:[{id:'review',name:'Review',description:'Review code changes'}],required_ids:['review']}});
    assert.equal(routed.structuredContent.status,'REQUIRED_SKILLS');
    assert.equal(routed.structuredContent.metrics.workflow_inference_calls,0);
    const result = await client.callTool({name:'jev_prepare_evidence',arguments:{task:'Collect proof',root:f.root,sources:[{id:'proof',path:'proof.txt',pinned:true}]}});
    assert.equal(result.structuredContent.status,'EVIDENCE_READY');
    const rejected = await client.callTool({name:'jev_evaluate',arguments:{model:'other-model',state:'x',questions:{a:{type:'noul',instructions:'Does x exist?'}}}});
    assert.equal(rejected.isError,true);
  } finally { await client.close(); }
  assert.equal(stderr,'');
});
test('all recipe schemas and runners exist; envelope rejects oversized calls/model overrides', async () => {
  const catalog = await toolCatalog(); assert.equal(catalog.size,12);
  for(const t of catalog.values()){assert.equal(typeof t.schema.parse,'function');assert.equal(typeof t.run,'function');}
  await assert.rejects(executeTool(catalog,'jev_evaluate',{state:'x'.repeat(24001),questions:{}}),/INPUT_CHARACTER_LIMIT/);
  await assert.rejects(executeTool(catalog,'jev_evaluate',{state:'x',questions:{},model:'other'}),/MODEL_OVERRIDE/);
});
test('inference boundary rejects generated question excess before a network call', async () => {
  const { systemOne } = await import('../vendor/jev-mcp/dist/typesafe.js');
  const previous=process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY='test-only-placeholder';
  try {
    const questions=Object.fromEntries(Array.from({length:21},(_,i)=>['q'+i,{type:'noul',instructions:'Does state say yes?'}]));
    await assert.rejects(systemOne({model:MODEL,state:'yes',questions}),/REQUEST_LIMIT/);
  } finally { if(previous===undefined)delete process.env.TYPESAFE_API_KEY;else process.env.TYPESAFE_API_KEY=previous; }
});
test('credential storage roundtrip is isolated and does not expose key in doctor', async () => {
  const f=await fixture(); const previousHome=process.env.JEV_KIT_HOME,previousKey=process.env.TYPESAFE_API_KEY;
  process.env.JEV_KIT_HOME=f.env.JEV_KIT_HOME; delete process.env.TYPESAFE_API_KEY;
  const {saveKey,loadKey}=await import('../src/settings.mjs');
  const fake='test-only-key-never-used-for-network';
  try {
    await saveKey(fake); assert.equal(await loadKey(),fake);
    const raw=await readFile(path.join(f.env.JEV_KIT_HOME,'credentials.json'),'utf8');
    if(process.platform==='win32'){assert.ok(!raw.includes(fake));assert.equal(JSON.parse(raw).encoding,'windows-dpapi');}
    const doctor=f.run('doctor');assert.ok(!doctor.stdout.includes(fake));assert.equal(JSON.parse(doctor.stdout).key_present,true);
  } finally {
    if(previousHome===undefined)delete process.env.JEV_KIT_HOME;else process.env.JEV_KIT_HOME=previousHome;
    if(previousKey===undefined)delete process.env.TYPESAFE_API_KEY;else process.env.TYPESAFE_API_KEY=previousKey;
  }
});
