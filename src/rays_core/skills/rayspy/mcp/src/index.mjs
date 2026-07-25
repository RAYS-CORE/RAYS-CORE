import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TOOL_NAME, description, inputSchema, handle } from './mcpTool.mjs';
import { run as runSherlock } from './tools/sherlock.mjs';
import { run as runHolehe } from './tools/holehe.mjs';
import { run as runSpiderfoot } from './tools/spiderfoot.mjs';
import { run as runSerp } from './tools/serp.mjs';
import { run as runEpieos } from './tools/epieos.mjs';
import { run as runOverpass } from './tools/overpassTurbo.mjs';
import { run as runPhoneinfoga } from './tools/phoneinfoga.mjs';

const server = new McpServer({ name: 'rayspy-investigate', version: '0.1.0' });

// The modular OSINT pipeline tools for autonomous agent orchestration
server.registerTool(
  'osint_sherlock',
  {
    title: 'OSINT Sherlock (Username Scan)',
    description: 'Scans over 300+ social media platforms to check if a specific username exists. Returns URLs and confidence scores.',
    inputSchema: { username: z.string().describe('The target username to search.') }
  },
  async (args) => {
    const result = await runSherlock(args.username);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_holehe',
  {
    title: 'OSINT Holehe (Email Scan)',
    description: 'Checks over 120+ websites to see if the target email address is registered, without alerting the user.',
    inputSchema: { email: z.string().describe('The target email address to search.') }
  },
  async (args) => {
    const result = await runHolehe(args.email);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_spiderfoot',
  {
    title: 'OSINT SpiderFoot (Deep Scan)',
    description: 'Runs SpiderFoot OSINT framework with over 200 modules against an IP, domain, username, or email. Requires SPIDERFOOT_SF_PY to be set.',
    inputSchema: { 
      target: z.string().describe('The target to scan (IP, domain, email, username).'),
      targetType: z.enum(['USERNAME', 'EMAILADDR', 'DOMAIN_NAME', 'IP_ADDRESS']).describe('The type of the target.')
    }
  },
  async (args) => {
    const result = await runSpiderfoot(args.target, { targetType: args.targetType });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_serp',
  {
    title: 'OSINT Web Search (DuckDuckGo Lite / SerpAPI)',
    description: 'Searches the web for generic queries (names, keywords) to triangulate dirty data.',
    inputSchema: { query: z.string().describe('The search query.') }
  },
  async (args) => {
    const result = await runSerp(args.query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_epieos',
  {
    title: 'OSINT Epieos (Google Account extraction)',
    description: 'Extracts Google Maps reviews, Google Calendar, and Google account details from an email address.',
    inputSchema: { email: z.string().describe('The email address to scan.') }
  },
  async (args) => {
    const result = await runEpieos(args.email);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_overpass',
  {
    title: 'OSINT OverpassTurbo (Geolocation)',
    description: 'Queries OpenStreetMap for physical locations (e.g., finding all Coffee shops near a specific University).',
    inputSchema: { query: z.string().describe('The Overpass API query or natural language location query.') }
  },
  async (args) => {
    const result = await runOverpass(args.query);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

server.registerTool(
  'osint_phoneinfoga',
  {
    title: 'OSINT PhoneInfoga (Phone Number Scan)',
    description: 'Scans phone numbers using international routing and footprinting to determine carrier, line type, country, and public leaks.',
    inputSchema: { number: z.string().describe('The phone number in E.164 format (e.g., +919362686842).') }
  },
  async (args) => {
    const result = await runPhoneinfoga(args.number);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write('[rays_investigate] MCP server ready on stdio with 7 tools\n');
