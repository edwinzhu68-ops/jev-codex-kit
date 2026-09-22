import { readFile, writeFile, mkdir, copyFile, rename, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { skillContent } from './clients.mjs';
const root = fileURLToPath(new URL('../',import.meta.url));
export async function codexSkillContent(name) {
  if (name === 'jev-codex-kit') return skillContent();
  if (name !== 'jev-ui') throw Error('UNKNOWN_OWNED_SKILL');
  return (await readFile(path.join(root,'skills','jev-ui','SKILL.md'),'utf8')).replaceAll('{{KIT_ROOT}}',root.replaceAll('\\','/')).replaceAll('file:///ABSOLUTE/KIT',pathToFileURL(root.replace(/[\\/]$/,'')).href);
}
export async function installCodexSkill(name,{home=homedir(),upgrade=false}={}) {
  const file=path.join(home,'.agents','skills',name,'SKILL.md'),content=await codexSkillContent(name);
  let before=null;
  try {if((await lstat(file)).isSymbolicLink())throw Error('SYMLINK_SKILL');before=await readFile(file,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(before===content)return {status:'UNCHANGED',skill:file};
  if(before!==null&&!upgrade)throw Error('Existing skill preserved. Review changes then use --upgrade for a backed-up replacement.');
  await mkdir(path.dirname(file),{recursive:true});
  let backup=null;
  if(before!==null){backup=file+'.backup-'+randomUUID();await copyFile(file,backup,constants.COPYFILE_EXCL);if(await readFile(file,'utf8')!==before)throw Error('SKILL_CHANGED');}
  await writeFile(file,content,{flag:before===null?'wx':'w',mode:0o600});
  return {status:before===null?'INSTALLED':'UPGRADED',skill:file,backup};
}
export async function removeCodexSkill(name,{home=homedir()}={}) {
  const file=path.join(home,'.agents','skills',name,'SKILL.md'),content=await codexSkillContent(name);
  let before;
  try{if((await lstat(file)).isSymbolicLink())throw Error('SYMLINK_SKILL');before=await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')return {status:'NOT_INSTALLED'};throw e;}
  if(before!==content)throw Error('MODIFIED_SKILL_PRESERVED');
  const backup=file+'.removed-'+randomUUID();
  await rename(file,backup);
  return {status:'REMOVED',backup};
}
