import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { fileURLToPath } from 'node:url';
import { toolCatalog } from '../src/tools.mjs';

// Native Pi extension. Register synchronously after local schema loading; defer
// MCP process startup until an actual tool/status request. No Pi provider changes.
export async function attachPi(pi,{kitHome}={}) {
  const catalog=await toolCatalog();
  let client,opening;
  async function connection(){
    if(client)return client;
    if(!opening)opening=(async()=>{
      const candidate=new Client({name:'jev-kit-pi',version:'0.3.0'});
      const env={...process.env,...(kitHome?{JEV_KIT_HOME:kitHome}:{})};
      const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('../bin/jev-kit.mjs',import.meta.url)),'serve'],env,stderr:'pipe'});
      transport.stderr?.on('data',()=>{});
      try{await candidate.connect(transport);client=candidate;return candidate;}
      catch{await candidate.close().catch(()=>{});throw Error('Jev MCP startup failed; run the kit doctor.');}
      finally{opening=undefined;}
    })();
    return opening;
  }
  for(const [name,tool] of catalog){
    pi.registerTool({name,label:name,description:tool.description,
      parameters:z.toJSONSchema(tool.schema,{target:'draft-7',io:'input'}),
      async execute(_id,args,signal){
        signal?.throwIfAborted();
        const c=await connection();
        const result=await c.callTool({name,arguments:args},undefined,{signal,timeout:35000});
        if(result.isError)throw Error('Jev returned no valid judgment; inspect input, root, limits or service.');
        return {content:result.content,details:result.structuredContent??{advisory_only:true}};
      }
    });
  }
  pi.registerCommand('jev-status',{description:'Check Jev MCP registration (no model call)',handler:async()=>{
    const c=await connection(),list=await c.listTools();
    pi.sendMessage({customType:'jev-kit-status',content:`Jev Coding Kit: ${list.tools.length} tools connected. No model request was made.`,display:true},{triggerTurn:false});
  }});
  const close=async()=>{if(opening)await opening.catch(()=>{});const active=client;client=undefined;if(active)await active.close();};
  pi.on('session_shutdown',close);
  return {close};
}
export default attachPi;
