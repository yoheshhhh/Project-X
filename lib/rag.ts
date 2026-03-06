async function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(url, key);
}

export async function retrieveRelevantChunks(
  question: string | undefined,
  topK = 4
): Promise<string[]> {
  try {
    if (!question) return [];
    const supabase = await getSupabase();
    if (!supabase) return [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return [];

    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI({ apiKey });

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