import {runsHome} from './settings.mjs';
import path from 'node:path';
import {realpath,readFile,lstat,mkdir,writeFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {runEvaluate} from '../vendor/jev-mcp/dist/tools/evaluate.js';
import {discoverCode} from '../vendor/pijev/dist/discovery.js';
import {DecisionEngine} from '../vendor/pijev/dist/decisions.js';
import ts from 'typescript';

const ROOTS=[];
const RUNS=path.join(runsHome(),'receipts');
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const inside=(root,target)=>{const rel=path.relative(root,target);return rel!==''&&!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep);};
const denied=p=>p.split(/[\\/]/).some(s=>s.startsWith('.')||/^(?:saves?|saved_games|credentials?|secrets?|backups?|auth|node_modules|vendor|production)$/i.test(s));
const sensitive=s=>/-----BEGIN .*PRIVATE KEY-----|\bapikey_[\w-]{20,}|\b(?:sk|ghp|github_pat)[-_][\w-]{20,}|\bBearer\s+[\w.-]{15,}|\b(?:password|api_key|apiKey|access_token)["']?\s*[:=]\s*["'][^"'\r\n]{8,}/i.test(s);
export const briefSchema=z.object({root:z.string(),path:z.string().min(1).max(400).describe('Explicit approved source subdirectory, relative to root; not the whole repository.'),query:z.string().min(1).max(1800),glob:z.enum(['*.gd','*.lua','*.luau','*.ts','*.js','*.mjs','*.py']).optional(),max_candidates:z.number().int().min(2).max(8).default(6)}).strict();

// Full small files or complete syntactic units; never silently cut a function.
export function excerpt(file,text,anchor){
 const lines=text.split(/\r?\n/);
 if(text.length<=2400)return {text,start_line:1,end_line:lines.length,kind:'whole_file'};
 if(/\.(ts|js|mjs)$/.test(file)){
  const ast=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,/\.ts$/.test(file)?ts.ScriptKind.TS:ts.ScriptKind.JS),nodes=[];
  if(ast.parseDiagnostics.length)fail('PARSE_ERROR');
  const visit=n=>{if(ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||(ts.isVariableStatement(n)&&n.parent===ast)||ts.isClassDeclaration(n)){
   const start=ast.getLineAndCharacterOfPosition(n.getStart(ast)).line+1,end=ast.getLineAndCharacterOfPosition(n.end).line+1;
   if(start<=anchor&&end>=anchor)nodes.push({text:n.getText(ast),start_line:start,end_line:end,kind:'complete_syntax_unit'});
  }ts.forEachChild(n,visit);};visit(ast);
  const node=nodes.sort((a,b)=>a.text.length-b.text.length).find(n=>n.text.length<=4500);if(node)return node;
 }
 if(file.endsWith('.gd')){
  const starts=lines.flatMap((s,i)=>/^(?:static )?func\s/.test(s)?[i]:[]),start=starts.filter(i=>i+1<=anchor).at(-1);
  if(start!==undefined){const end=starts.find(i=>i>start)??lines.length,body=lines.slice(start,end).join('\n');if(body.length<=4500)return {text:body,start_line:start+1,end_line:end,kind:'complete_gd_function'};}
 }
 fail('SOURCE_NEEDS_NARROWER_SCOPE');
}
async function secureRead(root,relative){
 if(denied(relative))fail('SENSITIVE_PATH');let current=root;
 for(const part of relative.split(path.sep)){if(!part||part==='.'||part==='..')fail('INVALID_PATH');current=path.join(current,part);if((await lstat(current)).isSymbolicLink())fail('SYMLINK_SOURCE');}
 const canonical=await realpath(current);if(!inside(root,canonical))fail('PATH_ESCAPE');
 const info=await lstat(canonical);if(!info.isFile()||info.size>256*1024)fail('SOURCE_SIZE');
 const b=await readFile(canonical);if(b.length>256*1024)fail('SOURCE_SIZE');
 // Match discovery's BOM-preserving decoder; hashes still cover original bytes.
 const text=new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(b);if(text.includes('\0'))fail('BINARY_SOURCE');
 return {text,hash:sha(b),canonical};
}
export async function prepareBrief(raw,{evaluate=runEvaluate,roots=ROOTS,runs=RUNS,signal}={}){
 const began=performance.now(),input=briefSchema.parse(raw);signal?.throwIfAborted();
 if(sensitive(input.query)||/[:\\]/.test(input.path)||input.path.split('/').some(s=>!s||s==='.'||s==='..')||denied(input.path))fail('INVALID_OR_SENSITIVE_SCOPE');
 const root=await realpath(input.root),allowed=await Promise.all(roots.map(r=>realpath(r).catch(()=>null)));
 if(!allowed.includes(root))fail('ROOT_NOT_ALLOWED');
 const lexical=path.resolve(root,input.path),scope=await realpath(lexical);
 if(scope!==lexical||!inside(root,scope))fail('SCOPE_ESCAPE');
 let cursor=root;for(const part of path.relative(root,scope).split(path.sep)){cursor=path.join(cursor,part);if((await lstat(cursor)).isSymbolicLink())fail('SYMLINK_SCOPE');}
 const found=await discoverCode({cwd:scope,query:input.query,glob:input.glob,shortlist:input.max_candidates,maxFiles:256,maxReadBytes:2*1024*1024,signal});
 const candidates=[],sources=[],omitted=[];
 for(const c of found.candidates){
  signal?.throwIfAborted();const relative=c.path.split(/[\\/]/).join(path.sep);
  if(denied(relative)||!/\.(?:gd|lua|luau|ts|js|mjs|py)$/.test(relative)){omitted.push({path:c.path,reason:'EXCLUDED_TYPE_OR_PATH'});continue;}
  const current=await secureRead(scope,relative);
  if(sensitive(current.text))fail('SENSITIVE_SOURCE');
  const exactLines=current.text.split('\n').slice(c.startLine-1,c.startLine-1+c.excerpt.split('\n').length).join('\n');
  if(exactLines!==c.excerpt)fail('DISCOVERY_SOURCE_CHANGED_OR_CLIPPED');
  const unit=excerpt(relative,current.text,c.line),canonicalPath=relative.split(path.sep).join('/');
  candidates.push({id:c.id,path:canonicalPath,line:c.line,startLine:unit.start_line,excerpt:unit.text});
  sources.push({id:c.id,path:canonicalPath,relative,sha256:current.hash,...unit});
 }
 const receipts=[];
 const assertFresh=async()=>{for(const s of sources)if((await secureRead(scope,s.relative)).hash!==s.sha256)fail('STALE_SOURCE');};
 const provider={evaluate:async(state,questions)=>{
  signal?.throwIfAborted();if(receipts.length)fail('ONE_REQUEST_LIMIT');
  const request={model:'jev-1.13.0',state,questions},json=JSON.stringify(request);
  if(Object.keys(questions).length>20||json.length>24000)fail('REQUEST_TOO_LARGE');
  if(sensitive(json))fail('SENSITIVE_REQUEST');await assertFresh();
  const t=performance.now(),result=await evaluate(request,{signal,deadline:Date.now()+30000});
  receipts.push({request,input_sha256:sha(json),result,ms:performance.now()-t});await assertFresh();
  if(result.model!=='jev-1.13.0'||!result.coverage?.complete||result.truncated||Object.keys(result.answers??{}).sort().join()!==Object.keys(questions).sort().join())fail('INVALID_RESPONSE');
  for(const a of Object.values(result.answers))if(a.type!=='noul'||!Number.isFinite(a.noul)||a.noul<0||a.noul>1)fail('INVALID_RESPONSE');
  return {status:'ok',answers:result.answers,model:result.model,latencyMs:performance.now()-t,inputTokens:result.usage?.input_tokens??0,outputTokens:result.usage?.output_tokens??0,cached:false};
 }};
 const ranked=await new DecisionEngine(provider).rankCode(input.query,candidates,signal,'source_briefing');
 await assertFresh();signal?.throwIfAborted();
 const status=!ranked.length?'NO_CANDIDATES':ranked.length===1?'DETERMINISTIC_CANDIDATE':ranked[0].relevance>=.8?'BRIEF_READY':'REVIEW_REQUIRED';
 const evidence=ranked.map(c=>{const {relative,...source}=sources.find(s=>s.id===c.id);return {...source,relevance:c.relevance??null};});
 const dir=path.join(runs,randomUUID());await mkdir(dir,{recursive:true});
 const bundle={status,advisory_only:true,root,scope,query:input.query,evidence,omitted,coverage:{files_scanned:found.filesScanned,discovery_partial:found.truncated,repository_complete:false},metrics:{calls:receipts.length,model_ms:receipts.reduce((s,r)=>s+r.ms,0),total_ms:performance.now()-began},receipt_path:path.join(dir,'receipt.json'),limitations:['Ranking is not proof of a defect or permission to edit.','Only the explicit source scope and returned units are represented; other files may matter.','Read current callers and dependencies before implementing.']};
 await writeFile(bundle.receipt_path,JSON.stringify({input,bundle,receipts},null,2),{flag:'wx'});
 await writeFile(path.join(dir,'bundle.json'),JSON.stringify(bundle,null,2),{flag:'wx'});return bundle;
}
