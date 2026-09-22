#!/usr/bin/env node
import http from 'node:http';
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { kitHome, configureRuntime } from '../src/settings.mjs';
import { decideUI } from '../src/ui-loop.mjs';

// API judgment service only. It cannot operate the browser, read arbitrary
// files, run commands supplied by clients, or return the TypeSafe credential.
const folder=path.join(kitHome(),'ui'), descriptor=path.join(folder,'broker.json');
await mkdir(folder,{recursive:true,mode:0o700});
const token=randomBytes(32).toString('hex'), expires=Date.now()+10*60*1000;
let busy=false,calls=0;
await configureRuntime();
const server=http.createServer(async(req,res)=>{
  const finish=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
  if(req.headers.origin || req.headers.authorization !== 'Bearer '+token) return finish(403,{error:'UNAUTHORIZED'});
  if(req.url==='/health' && req.method==='GET') return finish(200,{status:'READY',expires});
  if(req.url!=='/judge' || req.method!=='POST') return finish(403,{error:'UNAUTHORIZED'});
  if(busy || calls>=30 || Date.now()>=expires) return finish(429,{error:'BUDGET_OR_BUSY'});
  busy=true;
  try {
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>24000) return finish(413,{error:'INPUT_LIMIT'});chunks.push(chunk);}
    const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(typeof input.goal!=='string'||input.goal.length>1800||typeof input.state!=='string'||input.state.length>16000||!Array.isArray(input.actions)||input.actions.length>19||!Array.isArray(input.history)||input.history.length>20||input.actions.some((a,i)=>a.id!=='a'+i||!['click','scroll'].includes(a.op)||typeof a.name!=='string'||a.name.length>160)) return finish(400,{error:'SCHEMA'});
    calls++;
    const result=await decideUI(input,{signal:AbortSignal.timeout(5000)});
    finish(200,result);
  }catch{finish(502,{error:'JUDGMENT_FAILED'});}finally{busy=false;}
});
server.requestTimeout=8000;server.headersTimeout=8000;
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
await writeFile(descriptor,JSON.stringify({port:server.address().port,token,pid:process.pid,expires}),{mode:0o600});
const stop=async()=>{server.close();server.closeAllConnections();try{const current=JSON.parse(await readFile(descriptor));if(current.token===token)await unlink(descriptor);}catch{}process.exit(0);};
setTimeout(stop,10*60*1000).unref();
process.on('SIGTERM',stop);process.on('SIGINT',stop);
