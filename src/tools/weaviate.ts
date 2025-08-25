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

      // Build groups from topK seed hits: group by (docUuid, page) when page_number exists; otherwise by docUuid
      type GroupKey = string; // docUuid or `${docUuid}@${pageNumber}` when grouping by page
      interface GroupInfo {
        docUuid: string;
        pageNumber?: number; // present only when hasPageNumber and value is known
        source: string;
        // collected chunks for this group
        chunks: Map<number, string>; // chunkId -> content
        // seed chunk ids (used for extension)
        seedChunkIds: Set<number>;
      }

      const groups = new Map<GroupKey, GroupInfo>();
      const uniqueDocUuids = new Set<string>();

      for (const obj of hits) {
        const { content, doc_chunk_id, source, page_number } = obj;
        const docChunkId = String(doc_chunk_id);
        const [docUuid, chunkIdStr] = docChunkId.split('_');
        const chunkId = parseInt(chunkIdStr, 10);
        uniqueDocUuids.add(docUuid);

        // Determine grouping key
        let groupKey: GroupKey;
        let pageNum: number | undefined = undefined;
        if (hasPageNumber && page_number !== undefined && page_number !== null) {
          pageNum = Number(page_number);
          groupKey = `${docUuid}@${pageNum}`;
        } else {
          groupKey = docUuid;
        }

        let group = groups.get(groupKey);
        if (!group) {
          group = {
            docUuid,
            pageNumber: pageNum,
            source: source ? String(source) : '',
            chunks: new Map<number, string>(),
            seedChunkIds: new Set<number>(),
          };
          groups.set(groupKey, group);
        } else if (!group.source) {
          group.source = source ? String(source) : '';
        }

        // Initialize group with seed chunk only
        group.chunks.set(chunkId, content ? String(content) : '');
        group.seedChunkIds.add(chunkId);
      }

      // If no extension requested, aggregate per group and return
      if (extK === 0) {
        const results = Array.from(groups.values()).map((g) => {
          const sortedIds = Array.from(g.chunks.keys()).sort((a, b) => a - b);
          const mergedContent = sortedIds.map((id) => g.chunks.get(id) || '').join('');
          const result: any = { content: mergedContent, source: g.source };
          if (g.pageNumber !== undefined) result.page_number = g.pageNumber;
          return result;
        });
        return { content: results.map((r) => ({ type: 'text', text: JSON.stringify(r, null, 2) })) };
      }

      // Get total chunk count per unique docUuid (to bound neighbor selection)
      const docTotalCount = new Map<string, number>();
      for (const docUuid of uniqueDocUuids) {
        const aggQuery = `{
  Aggregate {
    ${collection}(
      where:{path:["doc_chunk_id"], operator:Like, valueText:"${docUuid}*"}
    ){ meta { count } }
  }
}`;
        const aggData = await gql(aggQuery);
        const totalChunkCount = aggData?.Aggregate?.[collection]?.[0]?.meta?.count || 0;
        docTotalCount.set(docUuid, totalChunkCount);
      }

      // For each group, expand neighbors from seed chunks only, within the same document; don't create new groups
      const chunkSpecToGroups = new Map<string, Set<GroupKey>>(); // "docUuid_chunkId" -> groups needing it

      for (const [groupKey, group] of groups.entries()) {
        const total = docTotalCount.get(group.docUuid) ?? 0;
        for (const seedId of group.seedChunkIds) {
          for (let i = 1; i <= extK; i++) {
            const prev = seedId - i;
            const next = seedId + i;
            if (prev >= 0 && !group.chunks.has(prev)) {
              const spec = `${group.docUuid}_${prev}`;
              if (!chunkSpecToGroups.has(spec)) chunkSpecToGroups.set(spec, new Set());
              chunkSpecToGroups.get(spec)!.add(groupKey);
            }
            if (next < total && !group.chunks.has(next)) {
              const spec = `${group.docUuid}_${next}`;
              if (!chunkSpecToGroups.has(spec)) chunkSpecToGroups.set(spec, new Set());
              chunkSpecToGroups.get(spec)!.add(groupKey);
            }
          }
        }
      }

      // Fetch all required neighbor chunks (deduplicated globally), then assign to requesting groups
      const chunkSpecs = Array.from(chunkSpecToGroups.keys());
      const fetchPromises = chunkSpecs.map(async (spec) => {
        const fetchQuery = `{
  Get {
    ${collection}(
      where:{path:["doc_chunk_id"], operator:Equal, valueText:"${spec}"}
      limit:1
    ) { ${fields} }
  }
}`;
        const fd = await gql(fetchQuery);
        const obj = (fd?.Get?.[collection] || [])[0];
        return { spec, obj } as { spec: string; obj: any };
      });
      const fetched = await Promise.all(fetchPromises);

      for (const { spec, obj } of fetched) {
        if (!obj) continue;
        const { content, doc_chunk_id } = obj;
        const docChunkId = String(doc_chunk_id);
        const [, chunkIdStr] = docChunkId.split('_');
        const chunkId = parseInt(chunkIdStr, 10);
        const targetGroups = chunkSpecToGroups.get(spec);
        if (!targetGroups) continue;
        for (const gKey of targetGroups) {
          const g = groups.get(gKey);
          if (!g) continue;
          if (!g.chunks.has(chunkId)) {
            g.chunks.set(chunkId, content ? String(content) : '');
          }
        }
      }

      // Aggregate per group: sort by chunkId and merge content; include page_number when available
      const results = Array.from(groups.values()).map((g) => {
        const sortedIds = Array.from(g.chunks.keys()).sort((a, b) => a - b);
        const mergedContent = sortedIds.map((id) => g.chunks.get(id) || '').join('');
        const result: any = { content: mergedContent, source: g.source };
        if (g.pageNumber !== undefined) result.page_number = g.pageNumber;
        return result;
      });

      return { content: results.map((r) => ({ type: 'text', text: JSON.stringify(r, null, 2) })) };
    },
  );
}
