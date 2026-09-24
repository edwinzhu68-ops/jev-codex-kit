import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { hashText } from './skill-router.mjs';
export async function autoStatus(home, sessionId) {
  const config=JSON.parse(await readFile(path.join(home,'auto','config.json'),'utf8'));
  const current={enabled:config.enabled!==false,mode:config.mode??'skills'};
  const directory=path.join(home,'auto','sessions');
  if(sessionId){
    let last=null;
    try{last=JSON.parse(await readFile(path.join(directory,hashText(sessionId)+'.last.json'),'utf8'));}
    catch(e){if(e.code!=='ENOENT')throw e;}
    return {...last,...current,status:current.enabled?(last?.status??'NO_OBSERVED_RUN'):'DISABLED',last_run:last};
  }
  let files=[];
  try{files=(await readdir(directory)).filter(f=>/^[a-f0-9]{64}\.last\.json$/.test(f));}catch(e){if(e.code!=='ENOENT')throw e;}
  let latest;
  for(const file of files){const record=JSON.parse(await readFile(path.join(directory,file),'utf8'));if(!latest||record.at>latest.at)latest=record;}
  if(!latest)try{latest=JSON.parse(await readFile(path.join(home,'auto','last-run.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  return {...latest,...current,status:current.enabled?(latest?.status??'NO_OBSERVED_RUN'):'DISABLED',last_run:latest??null};
}
