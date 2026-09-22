import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawn} from 'node:child_process';

test('real loopback broker requires private token, rejects Origin and invalid schema without inference',async()=>{
  const home=await mkdtemp(path.join(os.tmpdir(),'jev-broker-'));
  const child=spawn(process.execPath,['bin/jev-ui-broker.mjs'],{stdio:'ignore',windowsHide:true,env:{...process.env,JEV_KIT_HOME:home,TYPESAFE_API_KEY:'fixture-only-not-a-provider-key'}});
  try{
    let broker;
    for(let i=0;i<100;i++){try{broker=JSON.parse(await readFile(path.join(home,'ui','broker.json')));break;}catch{await new Promise(r=>setTimeout(r,50));}}
    assert(broker);const url=`http://127.0.0.1:${broker.port}`;
    assert.equal((await fetch(url+'/health')).status,403);
    const headers={Authorization:'Bearer '+broker.token};
    assert.equal((await fetch(url+'/health',{headers})).status,200);
    assert.equal((await fetch(url+'/health',{headers:{...headers,Origin:'https://attacker.invalid'}})).status,403);
    assert.equal((await fetch(url+'/judge',{method:'POST',headers,body:'{}'})).status,400);
    assert.equal((await fetch(url+'/judge',{method:'POST',headers,body:'x'.repeat(25000)})).status,413);
    assert.equal((await fetch(url+'/arbitrary-command',{method:'POST',headers,body:'{}'})).status,403);
  }finally{child.kill();await new Promise(r=>child.once('exit',r));}
});
