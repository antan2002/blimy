import { invoke } from "@tauri-apps/api/core";

export interface IndexedDocChunk {
  id: number;
  url: string;
  title: string;
  content: string;
  score: number;
}

export interface DocsIndexerService {
  crawlAndIndex(url: string): Promise<number>;
  query(query: string, limit?: number): Promise<IndexedDocChunk[]>;
}

export const docsIndexer: DocsIndexerService = {
  async crawlAndIndex(url: string): Promise<number> {
    const result = await invoke<number>("crawl_and_index_docs", { url });
    return result;
  },
  async query(query: string, limit?: number): Promise<IndexedDocChunk[]> {
    const result = await invoke<IndexedDocChunk[]>("query_indexed_docs", {
      query,
      limit: limit ?? 10,
    });
    return result;
  },
};
