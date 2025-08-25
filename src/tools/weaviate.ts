import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function regWeaviateTool(server: McpServer) {
  server.tool(
    'Weaviate_Hybrid_Search_with_Extension',
    'Hybrid search in Weaviate with context extension',
    {
      collection: z
        .string()
        .describe(
          'The name of the Weaviate collection to query. This should be the name of the collection where your documents are stored.',
        ),
      query: z
        .string()
        .describe(
          'The search query or requirements from the user. This is the main input for the hybrid search.',
        ),
      topK: z
        .number()
        .min(0)
        .default(5)
        .describe(
          'The number of top results to return from the hybrid search. This defines how many objects will be returned from the initial hybrid search query. Default is 5.',
        ),
      extK: z
        .number()
        .min(0)
        .default(0)
        .describe(
          'The number of additional chunks to include before and after each topK result. This allows for context extension around the top results, providing more comprehensive information. Default is 0.',
        ),
    },
    async ({ collection, query, topK, extK }) => {
      // Helper for GraphQL requests
      const gql = async (q: string) => {
        const res = await fetch('http://localhost:8080/v1/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: q }),
        });
        const json: any = await res.json();
        if (json.errors) throw new Error(JSON.stringify(json.errors));
        return json.data;
      };

      // Detect page_number field
      let hasPageNumber = false;
      try {
        const schemaRes = await fetch(`http://localhost:8080/v1/schema/${collection}`);
        if (schemaRes.ok) {
          const cls: any = await schemaRes.json();
          hasPageNumber = (cls?.properties || []).some((p: any) => p.name === 'page_number');
        }
      } catch {
        hasPageNumber = false;
      }

      const fieldList = ['content', 'source', 'doc_chunk_id'];
      if (hasPageNumber) fieldList.push('page_number');
      const fields = fieldList.join('\n');

      // Hybrid search query
      const hybridQuery = `{
  Get {
    ${collection}(
      hybrid:{query: "${query.replace(/"/g, '\\"')}", properties:["content"]}
      limit: ${topK}
    ) {
      ${fields}
    }
  }
}`;
      const data = await gql(hybridQuery);
      const hits: any[] = data?.Get?.[collection] || [];

      if (extK === 0) {
        return {
          content: hits.map((obj: any) => {
            const result: any = { content: obj.content, source: obj.source || '' };
            if (hasPageNumber && obj.page_number !== undefined && obj.page_number !== null) {
              result.page_number = obj.page_number;
            }
            return { type: 'text', text: JSON.stringify(result, null, 2) };
          }),
        };
      }

      const docChunks: Record<string, Array<{ chunkId: number; content: string }>> = {};
      const docSources: Record<string, string> = {};
      const docPageNumbers: Record<string, number | undefined> = {};
      const addedChunks = new Set<string>();
      const chunksToFetch: string[] = [];

      for (const obj of hits) {
        const { content, doc_chunk_id, source, page_number } = obj;
        const docChunkId = String(doc_chunk_id);
        const [docUuid, chunkIdStr] = docChunkId.split('_');
        const chunkId = parseInt(chunkIdStr, 10);
        docSources[docUuid] = source ? String(source) : '';
        if (
          hasPageNumber &&
          page_number !== undefined &&
          page_number !== null &&
          !docPageNumbers[docUuid]
        ) {
          docPageNumbers[docUuid] = Number(page_number);
        }
        if (!docChunks[docUuid]) docChunks[docUuid] = [];
        docChunks[docUuid].push({ chunkId, content: content ? String(content) : '' });
        addedChunks.add(`${docUuid}_${chunkId}`);

        // Aggregate to get total chunk count for this doc
        const aggQuery = `{
  Aggregate {
    ${collection}(
      where:{path:["doc_chunk_id"], operator:Like, valueText:"${docUuid}*"}
    ){ meta { count } }
  }
}`;
        const aggData = await gql(aggQuery);
        const totalChunkCount = aggData?.Aggregate?.[collection]?.[0]?.meta?.count || 0;

        for (let i = 1; i <= extK; i++) {
          const prev = chunkId - i;
          if (prev >= 0 && !addedChunks.has(`${docUuid}_${prev}`)) {
            chunksToFetch.push(`${docUuid}_${prev}`);
            addedChunks.add(`${docUuid}_${prev}`);
          }
          const next = chunkId + i;
          if (next < totalChunkCount && !addedChunks.has(`${docUuid}_${next}`)) {
            chunksToFetch.push(`${docUuid}_${next}`);
            addedChunks.add(`${docUuid}_${next}`);
          }
        }
      }

      // Fetch neighboring chunks
      const fetchPromises = chunksToFetch.map(async (chunkId) => {
        const fetchQuery = `{
  Get {
    ${collection}(
      where:{path:["doc_chunk_id"], operator:Equal, valueText:"${chunkId}"}
      limit:1
    ) { ${fields} }
  }
}`;
        const fd = await gql(fetchQuery);
        return (fd?.Get?.[collection] || [])[0];
      });
      const fetched = await Promise.all(fetchPromises);

      fetched.forEach((obj) => {
        if (!obj) return;
        const { content, doc_chunk_id, source, page_number } = obj;
        const docChunkId = String(doc_chunk_id);
        const [docUuid, chunkIdStr] = docChunkId.split('_');
        const chunkId = parseInt(chunkIdStr, 10);
        if (!docChunks[docUuid]) docChunks[docUuid] = [];
        if (!docSources[docUuid]) docSources[docUuid] = source ? String(source) : '';
        if (
          hasPageNumber &&
          page_number !== undefined &&
          page_number !== null &&
          !docPageNumbers[docUuid]
        ) {
          docPageNumbers[docUuid] = Number(page_number);
        }
        if (!docChunks[docUuid].some((c) => c.chunkId === chunkId)) {
          docChunks[docUuid].push({ chunkId, content: content ? String(content) : '' });
        }
      });

      const docs = Object.entries(docChunks).map(([docUuid, chunks]) => {
        chunks.sort((a, b) => a.chunkId - b.chunkId);
        const result: any = {
          content: chunks.map((c) => c.content).join(''),
          source: docSources[docUuid],
        };
        if (docPageNumbers[docUuid] !== undefined) result.page_number = docPageNumbers[docUuid];
        return result;
      });

      return { content: docs.map((d) => ({ type: 'text', text: JSON.stringify(d, null, 2) })) };
    },
  );
}
