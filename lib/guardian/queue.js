import { embedText, embeddingsConfigured } from '@/lib/embeddings';
import { interpretStone } from '@/lib/guardian/interpreter';
import { maybeRecompileContext } from '@/lib/guardian/context';

// Guardian processing queue + pipeline.
//
// Invariants (docs/PHASE2_ARCHITECTURE.md):
// - Stones are TRUTH. The pipeline writes exactly two stone columns:
//   `embedding` (mechanical derivation) and `guardian_processed` (flag).
// - Every interpretation row carries stone provenance.
// - Idempotent: UNIQUE(stone_id, job_type) + guardian_processed guard.
//   Running twice never duplicates; the whole layer is rebuildable.
// - Graceful staged activation: if the guardian tables (SQL not applied) or
//   the API keys are missing, stone creation is never affected — jobs simply
//   wait and are picked up by a later drain.

const MAX_ATTEMPTS = 3;
const MEMORY_MERGE_SIMILARITY = 0.9;
const PATTERN_MERGE_SIMILARITY = 0.85;
const MIN_CONFIDENCE = 0.5;

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205', 'PGRST202']);

function isMissingSchema(error) {
  return error && MISSING_TABLE_CODES.has(error.code);
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

// Never throws: the Guardian layer must not be able to break stone creation.
export async function enqueueStoneJob(sb, userId, stoneId) {
  try {
    const { error } = await sb
      .from('guardian_jobs')
      .upsert(
        { user_id: userId, stone_id: stoneId, job_type: 'process_stone' },
        { onConflict: 'stone_id,job_type', ignoreDuplicates: true }
      );
    if (error && !isMissingSchema(error)) console.error('enqueueStoneJob:', error.message);
    return !error;
  } catch (e) {
    console.error('enqueueStoneJob:', e.message);
    return false;
  }
}

// ── Drain ─────────────────────────────────────────────────────────────────────

// Processes pending jobs. `userId` scopes to one user (RLS path); without it
// (cron/service-role path) it drains globally, job by job, each scoped to the
// job's own user_id. `retryFailed` resets exhausted attempts (used after an
// API key is fixed).
export async function drainJobs(sb, { userId = null, limit = 10, retryFailed = false } = {}) {
  if (!embeddingsConfigured() || !process.env.ANTHROPIC_API_KEY) {
    return { processed: 0, skipped: 'guardian keys not configured (EMBEDDINGS_API_KEY / ANTHROPIC_API_KEY)' };
  }

  if (retryFailed) {
    let q = sb.from('guardian_jobs').update({ attempts: 0, status: 'pending', last_error: null })
      .eq('status', 'failed');
    if (userId) q = q.eq('user_id', userId);
    await q;
  }

  let query = sb
    .from('guardian_jobs')
    .select('id, user_id, stone_id, job_type, attempts')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (userId) query = query.eq('user_id', userId);

  const { data: jobs, error } = await query;
  if (error) {
    if (isMissingSchema(error)) return { processed: 0, skipped: 'guardian schema not applied yet' };
    return { processed: 0, error: error.message };
  }
  if (!jobs?.length) return { processed: 0, pending: 0 };

  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    // Atomic claim: only one worker wins this update.
    const { data: claimed } = await sb
      .from('guardian_jobs')
      .update({ status: 'running', attempts: job.attempts + 1, updated_at: new Date().toISOString() })
      .eq('id', job.id)
      .in('status', ['pending', 'failed'])
      .select('id');
    if (!claimed?.length) continue;

    try {
      if (job.job_type === 'process_stone') {
        await processStone(sb, job.user_id, job.stone_id);
      } else if (job.job_type === 'recompile_context') {
        await maybeRecompileContext(sb, job.user_id, { force: true });
      }
      await sb.from('guardian_jobs')
        .update({ status: 'done', last_error: null, updated_at: new Date().toISOString() })
        .eq('id', job.id);
      processed++;
    } catch (e) {
      failed++;
      console.error(`guardian job ${job.id} failed:`, e.message);
      await sb.from('guardian_jobs')
        .update({ status: 'failed', last_error: String(e.message).slice(0, 500), updated_at: new Date().toISOString() })
        .eq('id', job.id);
    }
  }
  return { processed, failed };
}

// ── Pipeline (one stone) ──────────────────────────────────────────────────────

async function processStone(sb, userId, stoneId) {
  const { data: stone, error: sErr } = await sb
    .from('stones')
    .select('id, journey_id, type, moment_type, title, body, happened_at, guardian_processed')
    .eq('id', stoneId)
    .single();
  if (sErr) throw new Error('stone fetch: ' + sErr.message);
  if (stone.guardian_processed) return; // idempotence guard

  // 1. Embedding — the only mechanical write to the stone besides the flag.
  const embedding = await embedText(`${stone.title || ''}\n${stone.body || ''}`, 'document');
  {
    const { error } = await sb.from('stones')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', stone.id);
    if (error) throw new Error('embedding write: ' + error.message);
  }

  // Genesis stones carry no meaning to extract (the dream lives on the
  // journey); embedding alone makes them searchable.
  if (stone.type !== 'genesis') {
    // 2. Semantic neighborhood (truth only, excluding the stone itself).
    const { data: rawNeighbors, error: nErr } = await sb.rpc('match_stones', {
      p_user_id: userId,
      query_embedding: JSON.stringify(embedding),
      match_count: 9,
      min_similarity: 0.3,
    });
    if (nErr) throw new Error('match_stones: ' + nErr.message);
    const neighbors = (rawNeighbors || []).filter((n) => n.id !== stone.id).slice(0, 8);

    // 3. Current interpretation state for reinforcement decisions.
    const [{ data: activePatterns }, { data: topTraits }] = await Promise.all([
      sb.from('guardian_patterns')
        .select('id, pattern_type, title, description, occurrences, confidence, status, evidence_stone_ids, embedding')
        .eq('user_id', userId)
        .in('status', ['emerging', 'confirmed', 'dormant'])
        .order('occurrences', { ascending: false })
        .limit(12),
      sb.from('guardian_traits')
        .select('trait_key, label, strength')
        .eq('user_id', userId)
        .order('strength', { ascending: false })
        .limit(5),
    ]);

    // 4. One interpreter call, provenance-enforced inside.
    const interp = await interpretStone({
      stone,
      neighbors,
      activePatterns: activePatterns || [],
      topTraits: topTraits || [],
    });

    // 5. Writes, each with its own dedup strategy.
    await writeMemories(sb, userId, stone, interp.memories);
    await writeLinks(sb, userId, stone, interp.links);
    await writeTraits(sb, userId, stone, interp.traits);
    await writePatterns(sb, userId, stone, interp.pattern_signals, activePatterns || []);
  }

  // 6. Mark processed (flag column — sanctioned mechanical write).
  {
    const { error } = await sb.from('stones').update({ guardian_processed: true }).eq('id', stone.id);
    if (error) throw new Error('processed flag: ' + error.message);
  }

  // 7. Debounced working-memory recompile (non-fatal).
  try {
    await maybeRecompileContext(sb, userId);
  } catch (e) {
    console.error('context recompile (non-fatal):', e.message);
  }
}

// ── Memories: semantic dedup — reinforce instead of duplicate ─────────────────

async function writeMemories(sb, userId, stone, memories) {
  for (const mem of memories) {
    if (mem.confidence < MIN_CONFIDENCE) continue;
    const embedding = await embedText(mem.content, 'document');

    const { data: similar } = await sb.rpc('match_memories', {
      p_user_id: userId,
      query_embedding: JSON.stringify(embedding),
      match_count: 1,
      min_similarity: MEMORY_MERGE_SIMILARITY,
    });

    if (similar?.length) {
      const hit = similar[0];
      const mergedSources = [...new Set([...(hit.source_stone_ids || []), ...mem.source_stone_ids])].slice(0, 40);
      await sb.from('guardian_memories').update({
        times_reinforced: (hit.times_reinforced || 1) + 1,
        source_stone_ids: mergedSources,
        confidence: Math.max(hit.confidence || 0, mem.confidence),
        last_seen_at: stone.happened_at,
      }).eq('id', hit.id);
    } else {
      await sb.from('guardian_memories').insert({
        user_id: userId,
        journey_id: stone.journey_id,
        kind: mem.kind,
        content: mem.content,
        source_stone_ids: mem.source_stone_ids,
        confidence: mem.confidence,
        embedding: JSON.stringify(embedding),
        last_seen_at: stone.happened_at,
      });
    }
  }
}

// ── Links: structurally unique ────────────────────────────────────────────────

async function writeLinks(sb, userId, stone, links) {
  const rows = links
    .filter((l) => l.confidence >= MIN_CONFIDENCE && l.to_stone_id !== stone.id)
    .map((l) => ({
      user_id: userId,
      from_stone_id: stone.id,
      to_stone_id: l.to_stone_id,
      link_type: l.link_type,
      note: l.note || null,
      confidence: l.confidence,
      created_by: 'guardian',
    }));
  if (rows.length) {
    await sb.from('stone_links').upsert(rows, {
      onConflict: 'from_stone_id,to_stone_id,link_type',
      ignoreDuplicates: true,
    });
  }
}

// ── Traits: UNIQUE(user_id, trait_key) accumulation ───────────────────────────

async function writeTraits(sb, userId, stone, traits) {
  for (const t of traits) {
    const { data: existing } = await sb
      .from('guardian_traits')
      .select('id, strength, evidence_stone_ids')
      .eq('user_id', userId)
      .eq('trait_key', t.trait_key)
      .maybeSingle();

    if (existing) {
      // Asymptotic reinforcement / gentle contradiction.
      const s = existing.strength;
      const strength = t.direction === 'up' ? s + (1 - s) * 0.15 : s * 0.8;
      const evidence = [...new Set([...(existing.evidence_stone_ids || []), stone.id])].slice(0, 30);
      await sb.from('guardian_traits').update({
        strength: Math.round(strength * 1000) / 1000,
        trend: t.direction === 'up' ? 'rising' : 'fading',
        evidence_stone_ids: evidence,
        last_seen_at: stone.happened_at,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else if (t.direction === 'up') {
      await sb.from('guardian_traits').insert({
        user_id: userId,
        trait_key: t.trait_key,
        label: t.label,
        strength: 0.3,
        trend: 'rising',
        evidence_stone_ids: [stone.id],
        first_seen_at: stone.happened_at,
        last_seen_at: stone.happened_at,
      });
    }
  }
}

// ── Patterns: reinforce by id, then by embedding, only then create ────────────

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function reinforcePattern(sb, pattern, stone, extraEvidence) {
  const evidence = [...new Set([...(pattern.evidence_stone_ids || []), stone.id, ...extraEvidence])].slice(0, 60);
  const occurrences = (pattern.occurrences || 2) + 1;
  const confidence = Math.min(1, (pattern.confidence || 0.6) + 0.1);
  let status = pattern.status;
  if (status === 'dormant') status = 'confirmed'; // it woke up
  if (status === 'emerging' && occurrences >= 3 && confidence >= 0.75) status = 'confirmed';
  await sb.from('guardian_patterns').update({
    occurrences,
    confidence,
    status,
    evidence_stone_ids: evidence,
    last_seen_at: stone.happened_at,
    updated_at: new Date().toISOString(),
  }).eq('id', pattern.id);
}

async function writePatterns(sb, userId, stone, signals, activePatterns) {
  for (const sig of signals) {
    // 1st: the interpreter recognized an existing pattern by id.
    if (sig.matches_pattern_id) {
      const target = activePatterns.find((p) => p.id === sig.matches_pattern_id);
      if (target) await reinforcePattern(sb, target, stone, sig.evidence_stone_ids);
      continue;
    }

    // 2nd: semantic belt-and-braces — near-duplicate of an existing pattern?
    const embedding = await embedText(`${sig.title}\n${sig.description}`, 'document');
    let merged = false;
    for (const p of activePatterns) {
      if (!p.embedding) continue;
      const pEmb = typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding;
      if (cosineSim(embedding, pEmb) >= PATTERN_MERGE_SIMILARITY) {
        await reinforcePattern(sb, p, stone, sig.evidence_stone_ids);
        merged = true;
        break;
      }
    }
    if (merged) continue;

    // 3rd: genuinely new — needs ≥2 evidence stones (enforced upstream too).
    const { data: evStones } = await sb
      .from('stones')
      .select('id, happened_at')
      .in('id', sig.evidence_stone_ids);
    const dates = (evStones || []).map((s) => s.happened_at).sort();
    if (dates.length < 2) continue;

    await sb.from('guardian_patterns').insert({
      user_id: userId,
      journey_id: stone.journey_id,
      pattern_type: sig.pattern_type,
      title: sig.title,
      description: sig.description,
      evidence_stone_ids: (evStones || []).map((s) => s.id),
      occurrences: dates.length,
      status: 'emerging',
      confidence: 0.6,
      embedding: JSON.stringify(embedding),
      first_seen_at: dates[0],
      last_seen_at: dates[dates.length - 1],
    });
  }
}
