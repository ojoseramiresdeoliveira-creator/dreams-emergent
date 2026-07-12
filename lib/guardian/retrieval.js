import { embedText, embeddingsConfigured } from '@/lib/embeddings';

// Hybrid retrieval for Guardian conversations.
// Combines: (a) semantic matches over TRUTH (stones), (b) semantic matches
// over interpreted memory, (c) compiled working memory, (d) active patterns
// and traits, (e) temporal anchors (the genesis / first stone).
//
// Returns null on ANY failure — the mentor route then falls back to the
// Phase 1 context (recent stones only). Memory can degrade; the Guardian
// never goes silent because of it.

export async function buildConversationRetrieval(sb, userId, message) {
  if (!embeddingsConfigured()) return null;
  try {
    const queryEmbedding = await embedText(message, 'query');
    const qVec = JSON.stringify(queryEmbedding);

    const [stonesRes, memsRes, ctxRes, patternsRes, traitsRes, firstRes] = await Promise.all([
      sb.rpc('match_stones', { p_user_id: userId, query_embedding: qVec, match_count: 6, min_similarity: 0.3 }),
      sb.rpc('match_memories', { p_user_id: userId, query_embedding: qVec, match_count: 6, min_similarity: 0.35 }),
      sb.from('guardian_context').select('narrative, stats, top_traits, active_patterns').eq('user_id', userId).maybeSingle(),
      sb.from('guardian_patterns').select('title, description, pattern_type, occurrences, status, last_seen_at')
        .eq('user_id', userId).in('status', ['emerging', 'confirmed'])
        .order('occurrences', { ascending: false }).limit(5),
      sb.from('guardian_traits').select('label, strength, trend')
        .eq('user_id', userId).order('strength', { ascending: false }).limit(5),
      sb.from('stones').select('id, type, title, body, happened_at')
        .eq('user_id', userId).order('happened_at', { ascending: true }).limit(1).maybeSingle(),
    ]);

    if (stonesRes.error || memsRes.error) return null; // schema not applied yet

    return {
      matchedStones: stonesRes.data || [],
      memories: memsRes.data || [],
      context: ctxRes.data || null,
      patterns: patternsRes.data || [],
      traits: traitsRes.data || [],
      firstStone: firstRes.data || null,
    };
  } catch (e) {
    console.error('guardian retrieval (falling back to recent context):', e.message);
    return null;
  }
}
