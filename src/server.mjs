import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { toolCatalog, executeTool } from './tools.mjs';

export async function serve() {
  const catalog = await toolCatalog();
  const server = new McpServer({ name: 'jev-codex-kit', version: '0.3.0' });
  for (const [name, tool] of catalog) server.registerTool(name, {
    description: tool.description,
    inputSchema: tool.schema,
    annotations: { readOnlyHint: !['jev_code_brief', 'jev_prepare_evidence', 'jev_route_skills'].includes(name), destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }, async (args, extra) => {
    try {
      const result = await executeTool(catalog, name, args, extra.signal);
      return { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result };
    } catch {
      return { isError: true, content: [{ type: 'text', text: JSON.stringify({ status: 'ERROR', message: 'No valid verdict. Check input, configured root, request limits, credential and service availability. Provider details are withheld.' }) }] };
    }
  });
  await server.connect(new StdioServerTransport());
}
