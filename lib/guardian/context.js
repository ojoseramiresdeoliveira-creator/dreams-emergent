import Anthropic from '@anthropic-ai/sdk';

// guardian_context — the Guardian's compiled working memory. One row per
// user, pure cache, always rebuildable. Recompiled with a debounce (every
// N new stones or when stale) so conversations stay cheap.

const RECOMPILE_EVERY_STONES = 5;
const RECOMPILE_MAX_AGE_DAYS = 7;
const MODEL = process.env.GUARDIAN_INTERPRETER_MODEL || 'claude-opus-4-8';

let _client = null;
function client() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 });
  }
  return _client;
}

export async function maybeRecompileContext(sb, userId, { force = false } = {}) {
  const { count: totalStones } = await sb
    .from('stones').select('*', { count: 'exact', head: true }).eq('user_id', userId);

  const { data: existing } = await sb
    .from('guardian_context').select('stones_at_compile, compiled_at, version, narrative')
    .eq('user_id', userId).maybeSingle();

  if (!force && existing) {
    const ageDays = (Date.now() - new Date(existing.compiled_at).getTime()) / 86400000;
    const newStones = (totalStones ?? 0) - existing.stones_at_compile;
    if (newStones < RECOMPILE_EVERY_STONES && ageDays < RECOMPILE_MAX_AGE_DAYS) return false;
  }

  // ── Gather (SQL only — cheap) ──────────────────────────────────────────────
  const [first, last, traits, patterns, memories, restarts, victories, defeats] = await Promise.all([
    sb.from('stones').select('happened_at').eq('user_id', userId).order('happened_at', { ascending: true }).limit(1).maybeSingle(),
    sb.from('stones').select('happened_at, title, moment_type, type').eq('user_id', userId).order('happened_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('guardian_traits').select('label, trait_key, strength, trend').eq('user_id', userId).order('strength', { ascending: false }).limit(5),
    sb.from('guardian_patterns').select('id, title, description, pattern_type, occurrences, status, last_seen_at').eq('user_id', userId).in('status', ['emerging', 'confirmed']).order('occurrences', { ascending: false }).limit(5),
    sb.from('guardian_memories').select('id, kind, content, times_reinforced, last_seen_at').eq('user_id', userId).eq('is_active', true).order('times_reinforced', { ascending: false }).order('last_seen_at', { ascending: false }).limit(10),
    sb.from('stones').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('moment_type', 'restart'),
    sb.from('stones').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('moment_type', 'victory'),
    sb.from('stones').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('moment_type', 'defeat'),
  ]);

  const stats = {
    totalStones: totalStones ?? 0,
    restarts: restarts.count ?? 0,
    victories: victories.count ?? 0,
    defeats: defeats.count ?? 0,
    firstStoneAt: first.data?.happened_at || null,
    lastStoneAt: last.data?.happened_at || null,
    daysWalking: first.data
      ? Math.max(1, Math.floor((Date.now() - new Date(first.data.happened_at).getTime()) / 86400000) + 1)
      : 0,
  };

  // Trait decay / pattern dormancy housekeeping (interpretation-layer only).
  const now = Date.now();
  await sb.from('guardian_patterns')
    .update({ status: 'dormant', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .in('status', ['emerging', 'confirmed'])
    .lt('last_seen_at', new Date(now - 90 * 86400000).toISOString());
  await sb.from('guardian_traits')
    .update({ trend: 'fading', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .neq('trend', 'fading')
    .lt('last_seen_at', new Date(now - 30 * 86400000).toISOString());

  // ── Narrative (one small LLM call; non-fatal if it fails) ─────────────────
  let narrative = existing?.narrative || null;
  if (process.env.ANTHROPIC_API_KEY && stats.totalStones > 0) {
    try {
      const response = await client().messages.create({
        model: MODEL,
        max_tokens: 300,
        system:
          'You are the Guardian of the Journey. Write ONE paragraph (max 110 words) describing where this walker stands in their journey right now — grounded ONLY in the data given, in the same language as the memories provided (default to the walker\'s language). No greetings, no advice, no exclamation marks. Timeless, patient, precise.',
        messages: [{
          role: 'user',
          content: `Stats: ${JSON.stringify(stats)}\nTop traits: ${JSON.stringify(traits.data || [])}\nActive patterns: ${JSON.stringify((patterns.data || []).map(p => ({ title: p.title, occurrences: p.occurrences })))}\nMost reinforced memories: ${JSON.stringify((memories.data || []).map(m => m.content))}`,
        }],
      });
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (text && response.stop_reason !== 'refusal') narrative = text;
    } catch (e) {
      console.error('context narrative (non-fatal):', e.message);
    }
  }

  const { error } = await sb.from('guardian_context').upsert({
    user_id: userId,
    narrative,
    top_traits: traits.data || [],
    active_patterns: patterns.data || [],
    key_memories: memories.data || [],
    stats,
    stones_at_compile: totalStones ?? 0,
    compiled_at: new Date().toISOString(),
    version: (existing?.version || 0) + 1,
  }, { onConflict: 'user_id' });
  if (error) throw new Error('context upsert: ' + error.message);
  return true;
}
