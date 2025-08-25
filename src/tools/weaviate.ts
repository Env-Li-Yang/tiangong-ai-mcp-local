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
      where: z.any().optional()
        .describe(`Optional GraphQL "where" filter as strict JSON (keys quoted). Provide a JSON object in Weaviate format; we convert it to GraphQL for you (operator enum is auto-unquoted).
- Must be valid JSON, not GraphQL syntax.
Examples: {"path":["tags"],"operator":"ContainsAny","valueText":["foo","bar"]}`),
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
    async ({ collection, query, where, topK, extK }) => {
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

      // Serialize plain JSON into GraphQL input string
      const toGraphQLInput = (v: any): string => {
        const isEnumLike = (s: string) => /^[A-Z][A-Za-z0-9_]*$/.test(s);
        if (v === null) return 'null';
        const t = typeof v;
        if (t === 'string') return JSON.stringify(v);
        if (t === 'number' || t === 'boolean') return String(v);
        if (Array.isArray(v)) return `[${v.map((x) => toGraphQLInput(x)).join(', ')}]`;
        if (t === 'object') {
          return (
            '{' +
            Object.entries(v)
              .map(([k, val]) => {
                if (k === 'operator' && typeof val === 'string' && isEnumLike(val)) {
                  return `${k}: ${val}`; // GraphQL enum (unquoted)
                }
                return `${k}: ${toGraphQLInput(val)}`;
              })
              .join(', ') +
            '}'
          );
        }
        // Fallback
        return JSON.stringify(v);
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
      const args: string[] = [];
      args.push(`hybrid:{query:${JSON.stringify(query)}, properties:["content"]}`);
      if (where) args.push(`where:${toGraphQLInput(where)}`);
      args.push(`limit:${topK}`);

      const hybridQuery = `{
  Get {
    ${collection}(${args.join(', ')}) { ${fields} }
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
        const idx = docChunkId.lastIndexOf('_');
        const docUuid = idx >= 0 ? docChunkId.slice(0, idx) : docChunkId;
        const chunkId = idx >= 0 ? parseInt(docChunkId.slice(idx + 1), 10) : NaN;
        if (!Number.isFinite(chunkId)) continue; // 防御
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
        return {
          content: results.map((r) => ({ type: 'text', text: JSON.stringify(r, null, 2) })),
        };
      }

      // For each group, expand neighbors from seed chunks only, within the same document; don't create new groups
      const chunkSpecToGroups = new Map<string, Set<GroupKey>>(); // "docUuid_chunkId" -> groups needing it

      for (const [groupKey, group] of groups.entries()) {
        for (const seedId of group.seedChunkIds) {
          for (let i = 1; i <= extK; i++) {
            const prev = seedId - i;
            const next = seedId + i;
            if (prev >= 0 && !group.chunks.has(prev)) {
              const spec = `${group.docUuid}_${prev}`;
              if (!chunkSpecToGroups.has(spec)) chunkSpecToGroups.set(spec, new Set());
              chunkSpecToGroups.get(spec)!.add(groupKey);
            }
            if (!group.chunks.has(next)) {
              // 让后续查询决定是否存在
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
        const chunkWhere = where
          ? `operator:And, operands:[{path:["doc_chunk_id"], operator:Equal, valueText:"${spec}"}, ${toGraphQLInput(
              where,
            )}]`
          : `path:["doc_chunk_id"], operator:Equal, valueText:"${spec}"`;
        const fetchQuery = `{
  Get {
    ${collection}(
      where:{${chunkWhere}}
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
        const idx = docChunkId.lastIndexOf('_');
        const chunkId = idx >= 0 ? parseInt(docChunkId.slice(idx + 1), 10) : NaN;
        if (!Number.isFinite(chunkId)) continue; // 防御
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
