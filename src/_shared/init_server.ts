import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { regElleAgent } from '../agents/elle.js';
import { regWeaviateTool } from '../tools/weaviate.js';

export function initializeServer(): McpServer {
  const server = new McpServer({
    name: 'TianGong-MCP-Server-Local',
    version: '1.0.0',
  });

  regWeaviateTool(server);
  regElleAgent(server);

  return server;
}

export function getServer() {
  return initializeServer();
}
