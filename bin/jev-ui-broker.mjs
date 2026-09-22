#!/usr/bin/env node
import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { kitHome, configureRuntime } from '../src/settings.mjs';
import { decideUI } from '../src/ui-loop.mjs';
import { createUIBroker } from '../src/ui-broker.mjs';

// API judgment service only. It cannot operate the browser, read arbitrary
// files, run commands supplied by clients, or return the TypeSafe credential.
const folder=path.join(kitHome(),'ui'), descriptor=path.join(folder,'broker.json');
await mkdir(folder,{recursive:true,mode:0o700});
const token=randomBytes(32).toString('hex');
await configureRuntime();
const cleanup=async()=>{try{const current=JSON.parse(await readFile(descriptor));if(current.token===token)await unlink(descriptor);}catch{}};
const server=createUIBroker({token,decide:decideUI,onIdle:cleanup});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
await writeFile(descriptor,JSON.stringify({protocol:2,port:server.address().port,token,pid:process.pid}),{mode:0o600});
const stop=async()=>{server.close();server.closeAllConnections();await cleanup();process.exit(0);};
process.on('SIGTERM',stop);process.on('SIGINT',stop);
