import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TOOL_NAME, description, inputSchema, handle } from './mcpTool.mjs';
import '../../proxy-server.mjs';

const server = new McpServer({ name: 'rayspy-investigate', version: '0.1.0' });

server.registerTool(
  TOOL_NAME,
  { title: 'RAYSpy Investigate', description, inputSchema },
  handle
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[rays_investigate] MCP server ready on stdio\n');
