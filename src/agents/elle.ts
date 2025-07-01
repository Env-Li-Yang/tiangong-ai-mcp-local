import { Client } from '@langchain/langgraph-sdk';
import { RemoteGraph } from '@langchain/langgraph/remote';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { remote_deployment_url, remote_langsmith_api_key } from '../_shared/config.js';

const input_schema = {
  input: z.string().min(1).describe('Input question or requirements from the user.'),
};

const client = new Client({ apiUrl: remote_deployment_url, apiKey: remote_langsmith_api_key });
const remoteGraph = new RemoteGraph({
  graphId: 'elle_agent',
  url: remote_deployment_url,
  apiKey: remote_langsmith_api_key,
});

async function elleAgent(input: { input?: string }): Promise<any> {
  try {
    const thread = await client.threads.create();
    const config = { configurable: { thread_id: thread.thread_id } };
    const response = await remoteGraph.invoke({
      messages: [{ role: 'human', content: input.input || '' }],
      config,
    });
    console.error('response', response);
    return JSON.stringify([
      {
        answer: JSON.stringify(response.answers[response.answers.length - 1]),
      },
    ]);
  } catch (error) {
    console.error('Error making the request:', error);
    throw error;
  }
}

export function regElleAgent(server: McpServer) {
  server.tool(
    'Elle_Agent',
    'Ask environmental questions from the user',
    input_schema,
    async ({ input }, extra) => {
      const result = await elleAgent({
        input,
      });
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    },
  );
}
