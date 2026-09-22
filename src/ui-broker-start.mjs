import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitHome } from './settings.mjs';

export async function startUIBroker() {
  const file=path.join(kitHome(),'ui','broker.json');
  try { const old=JSON.parse(await readFile(file)); if(Number.isInteger(old.port)&&old.port>=1024&&old.port<=65535&&/^[a-f0-9]{64}$/.test(old.token)&&old.expires>Date.now()+30000){
    const response=await fetch(`http://127.0.0.1:${old.port}/health`,{redirect:'error',signal:AbortSignal.timeout(500),headers:{Authorization:'Bearer '+old.token}});
    if(response.ok && (await response.json()).status==='READY')return {status:'RUNNING',broker_file:file};
  } } catch {}
  const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/jev-ui-broker.mjs',import.meta.url))],{stdio:'ignore',detached:true,windowsHide:true,env:{...process.env,JEV_KIT_HOME:kitHome()}});
  child.on('error',()=>{});child.unref();
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){
    try{const current=JSON.parse(await readFile(file));if(current.pid===child.pid&&current.expires>Date.now())return {status:'STARTED',broker_file:file};}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('UI_BROKER_START_FAILED');
}
