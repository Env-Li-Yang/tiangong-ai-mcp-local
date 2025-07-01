import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

let client: Client | undefined = undefined;
const url = 'http://localhost:9279/mcp';
const baseUrl = new URL(url);
try {
  client = new Client({
    name: 'streamable-http-client',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
  await client.connect(transport);
  const tools = await client.listTools();
  console.log('Connected to server:', client);
  console.log('Available tools:', tools);

  console.log('Connected using Streamable HTTP transport');
} catch (error) {
  console.error('Error connecting to server:', error);
}
