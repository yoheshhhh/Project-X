import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function retrieveRelevantChunks(
  question: string,
  topK = 4
): Promise<string[]> {
  try {
    // 1. Embed the student's question
    const res = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: question,
    });
    const queryEmbedding = res.data[0].embedding;

    // 2. Search Supabase for similar chunks
    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: queryEmbedding,
      match_count: topK,
      filter_topic: null,
    });

    if (error) {
      console.error('RAG retrieval error:', error.message);
      return [];
    }

    // 3. Return the text content of matched chunks
    return (data ?? []).map((row: any) => row.content);

  } catch (err) {
    console.error('RAG failed:', err);
    return [];
  }
}