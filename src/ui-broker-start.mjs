import { spawn } from 'node:child_process';
import { readFile, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { kitHome } from './settings.mjs';

export async function startUIBroker() {
  const file=path.join(kitHome(),'ui','broker.json');
  const healthy=async()=>{
  try { const old=JSON.parse(await readFile(file)); if(old.protocol===2&&Number.isInteger(old.port)&&old.port>=1024&&old.port<=65535&&/^[a-f0-9]{64}$/.test(old.token)){
    const response=await fetch(`http://127.0.0.1:${old.port}/health`,{redirect:'error',signal:AbortSignal.timeout(500),headers:{Authorization:'Bearer '+old.token}});
    if(response.ok && (await response.json()).status==='READY')return true;
  } } catch {}
  return false;
  };
  if(await healthy())return {status:'RUNNING',broker_file:file};
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  const lockFile=file+'.start.lock';let lock;
  const lockDeadline=Date.now()+5000;
  while(!lock){
    try{lock=await open(lockFile,'wx',0o600);await lock.writeFile(String(process.pid));}
    catch(e){
      if(e.code!=='EEXIST')throw e;
      if(await healthy())return {status:'RUNNING',broker_file:file};
      try{const pid=Number(await readFile(lockFile,'utf8'));if(Number.isSafeInteger(pid)&&pid>0){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')await unlink(lockFile);}}}catch{}
      if(Date.now()>=lockDeadline)throw Error('UI_BROKER_START_BUSY');
      await new Promise(r=>setTimeout(r,50));
    }
  }
  try{
  if(await healthy())return {status:'RUNNING',broker_file:file};
  const child=spawn(process.execPath,[fileURLToPath(new URL('../bin/jev-ui-broker.mjs',import.meta.url))],{stdio:'ignore',detached:true,windowsHide:true,env:{...process.env,JEV_KIT_HOME:kitHome()}});
  child.on('error',()=>{});child.unref();
  const deadline=Date.now()+4000;
  while(Date.now()<deadline){
    try{const current=JSON.parse(await readFile(file));if(current.pid===child.pid&&await healthy())return {status:'STARTED',broker_file:file};}catch{}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw Error('UI_BROKER_START_FAILED');
  }finally{await lock.close();await unlink(lockFile);}
}
