import { readFile, writeFile, mkdir, copyFile, access, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse, modify, applyEdits } from 'jsonc-parser';

export const CLIENTS = ['codex', 'claude', 'cursor', 'opencode', 'pi', 'vscode', 'windsurf', 'generic'];
export const ENTRY = fileURLToPath(new URL('../bin/jev-kit.mjs', import.meta.url));
const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const MANAGED = '<!-- Managed by Jev Coding Kit -->';
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
export function serverSpec(env = process.env) {
  const spec = { command: process.execPath, args: [ENTRY, 'serve'] };
  if (env.JEV_KIT_HOME) spec.env = { JEV_KIT_HOME: path.resolve(env.JEV_KIT_HOME) };
  return spec;
}
export function clientConfig(client='generic', env=process.env) {
  if (!CLIENTS.includes(client)) throw Error('Unknown client. Use ' + CLIENTS.join(', '));
  const spec = serverSpec(env);
  if(client==='opencode') return { $schema:'https://opencode.ai/config.json', mcp:{'jev-kit':{type:'local',command:[spec.command,...spec.args],enabled:true,timeout:45000,...(spec.env?{environment:spec.env}:{})}} };
  if(client==='vscode') return {servers:{'jev-kit':{type:'stdio',...spec}}};
  if(client==='pi') return {extension:path.join(PACKAGE,'extensions','pi.mjs'),note:'Use setup --client pi to install a native extension, not an MCP JSON file.'};
  if(client==='codex') return {mcp_servers:{'jev-kit':spec}};
  return {mcpServers:{'jev-kit':{...(client==='claude'?{type:'stdio'}:{}),...spec}}};
}
async function readOptional(file) {
  try { if((await lstat(file)).isSymbolicLink()) throw Error('Refusing a symlink configuration file: '+file); return await readFile(file,'utf8'); }
  catch(e){if(e.code==='ENOENT')return null;throw e;}
}
function object(value){return value!==null && typeof value==='object' && !Array.isArray(value);}
async function jsonPlan(file, section, value) {
  const before=await readOptional(file), errors=[];
  const original=before??'{}\n', data=parse(original,errors,{allowTrailingComma:true});
  if(errors.length||!object(data)|| (data[section]!==undefined&&!object(data[section]))) throw Error('Invalid config; preserved unchanged: '+file);
  const previous=data[section]?.['jev-kit'];
  if(previous!==undefined&&!equal(previous,value)) throw Error('A different jev-kit entry exists; preserved unchanged: '+file+'. Merge the output of config --client CLIENT manually.');
  const after=previous===undefined?applyEdits(original,modify(original,[section,'jev-kit'],value,{formattingOptions:{insertSpaces:true,tabSize:2}})):original;
  return {file,before,after};
}
async function textPlan(file, content) {
  const before=await readOptional(file);
  if(before!==null&&before!==content&&!before.includes(MANAGED)) throw Error('Existing skill/extension preserved: '+file);
  return {file,before,after:content};
}
export async function skillContent(){
  return (await readFile(path.join(PACKAGE,'skills/jev-codex-kit/SKILL.md'),'utf8')).replaceAll('__KIT_ENTRY__',ENTRY.replaceAll('\\','/'))+'\n'+MANAGED+'\n';
}
export async function installClient(client,{home=homedir(),root,env=process.env}={}) {
  if(!CLIENTS.includes(client))throw Error('Unknown client');
  if(['codex','windsurf','generic'].includes(client))throw Error('This client uses its CLI or manual config export.');
  const config=clientConfig(client,env),plans=[];
  let skillDir;
  if(client==='claude'){
    const configDir=env.CLAUDE_CONFIG_DIR?path.resolve(env.CLAUDE_CONFIG_DIR):path.join(home,'.claude');
    const configFile=env.CLAUDE_CONFIG_DIR?path.join(configDir,'.claude.json'):path.join(home,'.claude.json');
    plans.push(await jsonPlan(configFile,'mcpServers',config.mcpServers['jev-kit']));
    skillDir=path.join(configDir,'skills');
  }else if(client==='cursor'){
    plans.push(await jsonPlan(path.join(home,'.cursor','mcp.json'),'mcpServers',config.mcpServers['jev-kit']));
    skillDir=path.join(home,'.cursor','skills');
  }else if(client==='opencode'){
    const dir=env.OPENCODE_CONFIG_DIR?path.resolve(env.OPENCODE_CONFIG_DIR):path.join(env.XDG_CONFIG_HOME||path.join(home,'.config'),'opencode');
    const json=path.join(dir,'opencode.json'),jsonc=path.join(dir,'opencode.jsonc');
    const hasJson=await access(json).then(()=>true,()=>false),hasJsonc=await access(jsonc).then(()=>true,()=>false);
    if(hasJson&&hasJsonc)throw Error('Both opencode.json and opencode.jsonc exist; use config --client opencode and merge the active config manually.');
    plans.push(await jsonPlan(hasJsonc?jsonc:json,'mcp',config.mcp['jev-kit']));
    skillDir=path.join(dir,'skills');
  }else if(client==='vscode'){
    if(!root)throw Error('VS Code requires the project root for .vscode/mcp.json');
    plans.push(await jsonPlan(path.join(root,'.vscode','mcp.json'),'servers',config.servers['jev-kit']));
    skillDir=path.join(root,'.github','skills');
  }else if(client==='pi'){
    const dir=env.PI_CODING_AGENT_DIR?path.resolve(env.PI_CODING_AGENT_DIR):path.join(home,'.pi','agent');
    const moduleURL=pathToFileURL(path.join(PACKAGE,'extensions','pi.mjs')).href;
    const boundHome=env.JEV_KIT_HOME?path.resolve(env.JEV_KIT_HOME):null;
    const wrapper=`// ${MANAGED}\nexport default async function(pi: any) {\n  const { attachPi } = await import(${JSON.stringify(moduleURL)});\n  return attachPi(pi, ${JSON.stringify({kitHome:boundHome})});\n}\n`;
    plans.push(await textPlan(path.join(dir,'extensions','jev-kit.ts'),wrapper));
    skillDir=path.join(dir,'skills');
  }
  plans.push(await textPlan(path.join(skillDir,'jev-codex-kit','SKILL.md'),await skillContent()));
  // Preflight the whole client's write set, then recheck immediately before each write.
  const changed=[];
  for(const item of plans){
    if(item.before===item.after)continue;
    await mkdir(path.dirname(item.file),{recursive:true});
    if(await readOptional(item.file)!==item.before)throw Error('Configuration changed during installation; stopped: '+item.file);
    if(item.before!==null)await copyFile(item.file,item.file+'.jev-kit-backup-'+randomUUID(),constants.COPYFILE_EXCL);
    await writeFile(item.file,item.after,{flag:item.before===null?'wx':'w',mode:0o600});
    changed.push(item.file);
  }
  return {client,changed,files:plans.map(p=>p.file),note:'Registration written; the client may require trusting/enabling the server or reloading tools.'};
}
