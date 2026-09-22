import { readFile,readdir } from 'node:fs/promises';
import path from 'node:path';
import { hashText } from './skill-router.mjs';
export async function autoStatus(home, sessionId) {
  const directory=path.join(home,'auto','sessions');
  if(sessionId)return JSON.parse(await readFile(path.join(directory,hashText(sessionId)+'.last.json'),'utf8'));
  let files=[];
  try{files=(await readdir(directory)).filter(f=>/^[a-f0-9]{64}\.last\.json$/.test(f));}catch(e){if(e.code!=='ENOENT')throw e;}
  let latest;
  for(const file of files){const record=JSON.parse(await readFile(path.join(directory,file),'utf8'));if(!latest||record.at>latest.at)latest=record;}
  return latest ?? JSON.parse(await readFile(path.join(home,'auto','last-run.json'),'utf8'));
}
