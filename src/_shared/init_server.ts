import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { regElleAgent } from '../agents/elle.js';
import { regEduTool } from '../tools/edu.js';
import { regESGTool } from '../tools/esg.js';
import { regSciTool } from '../tools/sci.js';
import { regWeaviateTool } from '../tools/weaviate.js';

export function initializeServer(): McpServer {
  const server = new McpServer({
    name: 'TianGong-MCP-Server',
    version: '1.0.0',
  });

  regWeaviateTool(server);
  regESGTool(server);
  regSciTool(server);
  regEduTool(server);
  regElleAgent(server);

  return server;
}

export function getServer() {
  return initializeServer();
}
