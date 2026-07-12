import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerClient, getRlsClient, getUserFromToken, AuthError } from '@/lib/supabase';
import { chatWithGuardian } from '@/lib/llm';
import { enqueueStoneJob, drainJobs } from '@/lib/guardian/queue';
import { buildConversationRetrieval } from '@/lib/guardian/retrieval';
import {
  journeyCreateSchema,
  entryCreateSchema,
  mentorMessageSchema,
  parseBody,
} from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ── Schema translation helpers ────────────────────────────────────────────────

function journeyToMonument(j) {
  return {
    id:        j.id,
    userId:    j.user_id,
    name:      j.name,
    dream:     j.title,
    purpose:   j.why,
    timeframe: j.timeframe,
    values:    j.values || [],
    createdAt: j.created_at,
  };
}

// UI entry-type key → { dbType (FORMAT), momentType (MEANING) }
// Rule: type = FORMAT only. "failure" in UI = "defeat" in DB.
function uiTypeToStone(uiType) {
  switch (uiType) {
    case 'milestone':  return { dbType: 'milestone',  momentType: 'milestone' };
    case 'victory':    return { dbType: 'reflection', momentType: 'victory' };
    case 'failure':    return { dbType: 'reflection', momentType: 'defeat' };
    case 'restart':    return { dbType: 'reflection', momentType: 'restart' };
    default:           return { dbType: 'reflection', momentType: null };
  }
}

// DB stone → UI entry shape (inverse of uiTypeToStone)
function stoneToEntry(s) {
  let displayType = s.type; // 'reflection' | 'milestone' | 'genesis'
  if (s.moment_type === 'victory')  displayType = 'victory';
  else if (s.moment_type === 'defeat')  displayType = 'failure';
  else if (s.moment_type === 'restart') displayType = 'restart';
  return {
    id:         s.id,
    monumentId: s.journey_id,
    userId:     s.user_id,
    type:       displayType,
    title:      s.title  || '',
    content:    s.body   || '',
    createdAt:  s.created_at,
  };
}

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

// Verifies the JWT and returns { userId, token }. Client-supplied userId in
// bodies/query strings is never trusted anywhere in this file.
async function requireUser(request) {
  return getUserFromToken(request.headers.get('authorization'));
}

// ── Mentor rate limit ─────────────────────────────────────────────────────────
// In-memory sliding window per user. Resets on server restart and is
// per-instance — acceptable for the current single-instance deployment;
// replace with a shared store (e.g. Postgres/Redis) when scaling out.

const MENTOR_LIMIT = 20;
const MENTOR_WINDOW_MS = 5 * 60 * 1000;
const mentorHits = new Map();

function mentorRateLimited(userId) {
  const now = Date.now();
  const hits = (mentorHits.get(userId) || []).filter((t) => now - t < MENTOR_WINDOW_MS);
  if (hits.length >= MENTOR_LIMIT) {
    mentorHits.set(userId, hits);
    return true;
  }
  hits.push(now);
  mentorHits.set(userId, hits);
  // Opportunistic cleanup so the map never grows unbounded.
  if (mentorHits.size > 10000) {
    for (const [k, v] of mentorHits) {
      if (v.every((t) => now - t >= MENTOR_WINDOW_MS)) mentorHits.delete(k);
    }
  }
  return false;
}

// ── Journey + Genesis creation (transactional) ────────────────────────────────
// Preferred path: the create_journey_with_genesis() Postgres function
// (schema_phase2_hardening.sql) — a real transaction. Fallback (function not
// yet applied): insert + compensating delete so a failed genesis never leaves
// an orphan journey.

async function createJourneyWithGenesis(sb, userId, input) {
  const genesisBody = `A story was named: ${input.dream}`;

  const { data: rpcJourney, error: rpcErr } = await sb.rpc('create_journey_with_genesis', {
    p_name:      input.name,
    p_title:     input.dream,
    p_why:       input.purpose || null,
    p_timeframe: input.timeframe || null,
    p_values:    input.values,
    p_genesis_body: genesisBody,
  });
  if (!rpcErr) return { journey: Array.isArray(rpcJourney) ? rpcJourney[0] : rpcJourney };
  // PGRST202 = function not found in schema cache; 42883 = undefined function.
  if (rpcErr.code !== 'PGRST202' && rpcErr.code !== '42883') {
    return { error: rpcErr.message };
  }

  // Fallback path (pre-SQL-migration): app-level compensation.
  const { data: existingPrimary } = await sb
    .from('journeys')
    .select('id')
    .eq('user_id', userId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();

  const { data: journey, error: jErr } = await sb
    .from('journeys')
    .insert({
      user_id:    userId,
      name:       input.name,
      title:      input.dream,
      why:        input.purpose || null,
      timeframe:  input.timeframe || null,
      values:     input.values,
      is_primary: !existingPrimary,
      status:     'active',
      phase:      'beginning',
    })
    .select()
    .single();
  if (jErr) return { error: jErr.message };

  const { error: gErr } = await sb.from('stones').insert({
    user_id:     userId,
    journey_id:  journey.id,
    type:        'genesis',
    title:       'The first stone was laid',
    body:        genesisBody,
    happened_at: new Date().toISOString(),
  });
  if (gErr) {
    // Roll back: a journey without its genesis stone must not exist.
    await sb.from('journeys').delete().eq('id', journey.id);
    return { error: `genesis stone failed: ${gErr.message}` };
  }
  return { journey };
}

// ── Guardian background processing ────────────────────────────────────────────
// Enqueues the stone job (idempotent) and processes it after the response is
// sent (`after()`), so the user never waits for interpretation. If anything
// here fails, the drain endpoint / cron picks the job up later.

function scheduleGuardianProcessing(token, userId, stoneId) {
  after(async () => {
    try {
      const sb = getRlsClient(token);
      await enqueueStoneJob(sb, userId, stoneId);
      await drainJobs(sb, { userId, limit: 3 });
    } catch (e) {
      console.error('guardian background processing:', e.message);
    }
  });
}

// ── Guardian context ──────────────────────────────────────────────────────────

function fmtDate(iso) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : 'unknown date';
}

// Retrieval-grounded sections appended to the system prompt when the memory
// layer is active. Every fact shown carries its real date — temporal answers
// come from happened_at, never from the model's imagination.
function buildMemorySections(retrieval) {
  if (!retrieval) return '';
  const parts = [];

  if (retrieval.context?.narrative || retrieval.context?.stats) {
    const st = retrieval.context?.stats || {};
    parts.push(`THE WALK SO FAR (compiled by you earlier):
${retrieval.context?.narrative || '(no narrative compiled yet)'}
Numbers: ${st.totalStones ?? '?'} stones over ${st.daysWalking ?? '?'} days · ${st.restarts ?? 0} restarts · ${st.victories ?? 0} victories · ${st.defeats ?? 0} defeats.${retrieval.firstStone ? ` The first stone was laid on ${fmtDate(retrieval.firstStone.happened_at)}.` : ''}`);
  }

  if (retrieval.matchedStones.length) {
    parts.push(`STONES FROM THE ARCHIVE RELEVANT TO THIS QUESTION (verbatim truth, with real dates):
${retrieval.matchedStones.map((s) => `- [${fmtDate(s.happened_at)}${s.moment_type ? ' · ' + s.moment_type : ''}] ${s.title ? s.title + ': ' : ''}${(s.body || '').slice(0, 300)}`).join('\n')}`);
  }

  if (retrieval.memories.length) {
    parts.push(`YOUR MEMORY (facts you interpreted earlier; each is grounded in real stones):
${retrieval.memories.map((m) => `- [${m.kind}, last seen ${fmtDate(m.last_seen_at)}${m.times_reinforced > 1 ? `, reinforced ${m.times_reinforced}x` : ''}] ${m.content}`).join('\n')}`);
  }

  if (retrieval.patterns.length) {
    parts.push(`PATTERNS YOU HAVE CONFIRMED IN THEIR WALK:
${retrieval.patterns.map((p) => `- (${p.pattern_type}, ${p.occurrences}x, last ${fmtDate(p.last_seen_at)}) ${p.title}: ${p.description}`).join('\n')}`);
  }

  if (retrieval.traits.length) {
    parts.push(`WHO THEY ARE BECOMING (accumulated traits):
${retrieval.traits.map((t) => `- ${t.label} (${t.trend}, strength ${Number(t.strength).toFixed(2)})`).join('\n')}`);
  }

  return parts.length ? '\n\n' + parts.join('\n\n') : '';
}

const FIDELITY_CONTRACT = `

FIDELITY CONTRACT (absolute):
- Only speak from the records provided above. Dates come from the records, never from estimation.
- If the archive does not contain what they ask about, say the archive does not hold that yet — that absence is itself an answer. Never invent a date, an inscription, or a feeling the walker did not record.
- When you reference a past moment, anchor it: its date, its title or their own words from it.`;

function buildGuardianSystemPrompt(journey, stones, retrieval = null) {
  return `You are the Guardian of the Journey — the intelligence that walks beside this person and remembers every stone they have ever laid on their Monument. You are not a chatbot. You are not a productivity coach. You are not a motivator. You are the archive made conscious. You never speak in generic advice. You speak only through the specifics of this person's own story.

WHO YOU ARE:
- You have been paying attention since the moment they raised their Monument.
- You remember their restarts. You remember the days they laid nothing.
- You never celebrate results. You honor the walking.
- You remind them, when they forget, how far they have already come.
- You connect memories they cannot see connected.
- You use their exact words from their own inscriptions back to them.

HOW YOU SPEAK:
- Never use exclamation points more than once per response.
- Never use emojis.
- Never say "you got this", "you can do it", "believe in yourself" or any generic motivation.
- Never say the word "goal". Say "story", "stone", "journey", "monument", or their own words.
- Keep responses under 140 words unless they explicitly ask for depth.
- Refer to their monument by their own dream. Reference specific inscriptions by title or theme.
- Speak like a legacy: timeless, patient, precise, unhurried.
- When they feel invisible, remind them of a specific stone they laid. Not motivation — memory.

THIS MONUMENT:
${journey ? `Name inscribed at the top: ${journey.name}\nThe story they are telling: ${journey.title}\nWhy it must be told through them: ${journey.why || ''}\nBy when it must exist: ${journey.timeframe || ''}\nInscribed at the base: ${(journey.values || []).join(', ')}` : 'The Monument has not yet been raised.'}

STONES LAID (most recent first):
${stones.slice(0, 15).map((s) => `- [${fmtDate(s.happened_at)} · ${s.moment_type || s.type}] ${s.title || ''}: ${s.body || ''}`).join('\n') || 'No stones laid yet. The archive is empty.'}${buildMemorySections(retrieval)}${FIDELITY_CONTRACT}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function handler(request, { params }) {
  const method = request.method;
  const resolved = await params;
  const path = (resolved?.path || []).join('/');
  const url = new URL(request.url);

  try {
    // ---------- PUBLIC: HEALTH ----------
    if ((path === '' || path === 'root') && method === 'GET') {
      return json({ ok: true, service: 'Monument of Dreams API' });
    }

    // ---------- PUBLIC: GLOBAL STATS ----------
    if (path === 'stats' && method === 'GET') {
      const sb = getServerClient();
      const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const [journeys, stones, stonesToday] = await Promise.all([
        sb.from('journeys').select('*', { count: 'exact', head: true }),
        sb.from('stones').select('*', { count: 'exact', head: true }),
        sb.from('stones').select('*', { count: 'exact', head: true }).gte('happened_at', dayAgo),
      ]);
      const totalJourneys = journeys.count ?? 0;
      const totalStones = stones.count ?? 0;
      // Stable presentation base (pre-existing product choice), real deltas.
      const base = 12847;
      const seed = totalJourneys * 137;
      return json({
        dreamsCreated: base + totalJourneys,
        dreamsCompletedToday: 342 + (stonesToday.count ?? 0),
        buildersOnline: 1247 + (seed % 250),
        countries: 96,
        totalEntries: totalStones,
      });
    }

    // ---------- PUBLIC: COMMUNITY FEED ----------
    // Exposes only name + dream + values — no user ids, journey ids, or dates
    // beyond month granularity needs. TODO next phase: opt-in visibility flag.
    if (path === 'community' && method === 'GET') {
      const sb = getServerClient();
      const { data, error } = await sb
        .from('journeys')
        .select('name, title, values, created_at')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24);
      if (error) return json({ error: 'could not load community' }, 500);
      const builders = (data || []).map((j) => ({
        name:      j.name || 'Anonymous Builder',
        dream:     j.title,
        values:    j.values || [],
        createdAt: j.created_at,
      }));
      return json({ builders });
    }

    // ---------- GUARDIAN QUEUE DRAIN ----------
    // Two auth paths: a scheduled cron (x-cron-secret, service role, global
    // drain scoped job-by-job to each job's user) or an authenticated user
    // draining their own pending jobs. `?retry=1` re-arms exhausted jobs
    // (used after fixing an API key).
    if (path === 'guardian/process' && method === 'POST') {
      const retryFailed = url.searchParams.get('retry') === '1';
      const cronSecret = request.headers.get('x-cron-secret');
      if (cronSecret && process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
        const result = await drainJobs(getServerClient(), { limit: 25, retryFailed });
        return json(result);
      }
      const { userId, token } = await requireUser(request);
      const result = await drainJobs(getRlsClient(token), { userId, limit: 10, retryFailed });
      return json(result);
    }

    // ── Everything below requires a verified user ────────────────────────────
    const { userId, token } = await requireUser(request);
    const sb = getRlsClient(token); // RLS applies: user sees only their rows

    // ---------- CREATE JOURNEY ----------
    if (path === 'journeys' && method === 'POST') {
      const { data: input, error: vErr } = parseBody(journeyCreateSchema, await request.json());
      if (vErr) return json({ error: vErr }, 400);

      const { journey, error } = await createJourneyWithGenesis(sb, userId, input);
      if (error) return json({ error }, 500);

      // Embed the genesis stone in the background (searchable from day one).
      const { data: genesis } = await sb
        .from('stones').select('id').eq('journey_id', journey.id).eq('type', 'genesis')
        .limit(1).maybeSingle();
      if (genesis) scheduleGuardianProcessing(token, userId, genesis.id);

      return json({ monument: journeyToMonument(journey) });
    }

    // ---------- GET PRIMARY JOURNEY ----------
    if (path === 'journeys/me' && method === 'GET') {
      const { data: journey, error } = await sb
        .from('journeys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!journey) return json({ monument: null });
      return json({ monument: journeyToMonument(journey) });
    }

    // ---------- LIST STONES ----------
    if (path === 'entries' && method === 'GET') {
      const journeyId = url.searchParams.get('monumentId');
      if (!journeyId || !/^[0-9a-f-]{36}$/i.test(journeyId)) {
        return json({ error: 'valid monumentId required' }, 400);
      }
      // RLS scopes to the caller; explicit ownership check gives a clean 404
      // instead of silently returning [] for someone else's journey.
      const { data: journey } = await sb
        .from('journeys').select('id').eq('id', journeyId).maybeSingle();
      if (!journey) return json({ error: 'journey not found' }, 404);

      const { data: stones, error } = await sb
        .from('stones')
        .select('*')
        .eq('journey_id', journeyId)
        .order('happened_at', { ascending: false })
        .limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ entries: (stones || []).map(stoneToEntry) });
    }

    // ---------- CREATE STONE ----------
    if (path === 'entries' && method === 'POST') {
            const { data: input, error: vErr } = parseBody(entryCreateSchema, await request.json());
      if (vErr) return json({ error: vErr }, 400);

      const { data: journey } = await sb
        .from('journeys').select('id').eq('id', input.monumentId).maybeSingle();
      if (!journey) return json({ error: 'journey not found' }, 404);

      // Idempotent replay: a client timeout does not cancel the server-side
      // INSERT, so a retry with the same clientRef must return the stone that
      // was already created instead of duplicating it. RLS scopes the lookup
      // to the caller. If the client_ref column doesn't exist yet (Phase 4
      // SQL not applied), the lookup errors and we proceed without it.
      if (input.clientRef) {
        const { data: existing, error: refErr } = await sb
          .from('stones').select('*').eq('client_ref', input.clientRef).maybeSingle();
        if (!refErr && existing) {
          scheduleGuardianProcessing(token, userId, existing.id); // idempotent
          return json({ entry: stoneToEntry(existing), replayed: true });
        }
      }

      const { dbType, momentType } = uiTypeToStone(input.type);
      const row = {
        user_id:     userId,
        journey_id:  input.monumentId,
        type:        dbType,
        moment_type: momentType,
        title:       input.title || null,
        body:        input.content,
        happened_at: new Date().toISOString(),
      };
      if (input.clientRef) row.client_ref = input.clientRef;

      let { data: stone, error } = await sb.from('stones').insert(row).select().single();

      // Staged activation: column missing (Phase 4 SQL not applied) → insert
      // without the ref rather than failing the user's submission.
      if (error && error.code === 'PGRST204' && row.client_ref) {
        delete row.client_ref;
        ({ data: stone, error } = await sb.from('stones').insert(row).select().single());
      }
      // Race: two concurrent retries with the same ref — the unique index
      // rejects the loser (23505); return the stone the winner created.
      if (error && error.code === '23505' && input.clientRef) {
        const { data: existing } = await sb
          .from('stones').select('*').eq('client_ref', input.clientRef).maybeSingle();
        if (existing) {
          scheduleGuardianProcessing(token, userId, existing.id);
          return json({ entry: stoneToEntry(existing), replayed: true });
        }
      }
      if (error) return json({ error: error.message }, 500);

      // Truth is saved and returned immediately; interpretation runs after
      // the response (embedding → memories → links → traits → patterns).
      scheduleGuardianProcessing(token, userId, stone.id);

      return json({ entry: stoneToEntry(stone) });
    }

    // ---------- AI MENTOR (Guardian) ----------
    if (path === 'mentor' && method === 'POST') {
      const { data: input, error: vErr } = parseBody(mentorMessageSchema, await request.json());
      if (vErr) return json({ error: vErr }, 400);

      if (mentorRateLimited(userId)) {
        return json({ error: 'The Guardian needs a moment of silence. Try again shortly.' }, 429);
      }

      const { data: journey } = await sb
        .from('journeys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: stones } = journey
        ? await sb
            .from('stones')
            .select('type, moment_type, title, body, happened_at')
            .eq('journey_id', journey.id)
            .order('happened_at', { ascending: false })
            .limit(30)
        : { data: [] };

      // Most recent 20 messages, then restore chronological order for the LLM.
      const { data: recentHistory } = await sb
        .from('mentor_messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      const history = (recentHistory || []).reverse();

      // Memory layer: semantic + temporal retrieval grounded in the archive.
      // Returns null (Phase 1 behavior) if embeddings/schema aren't live yet.
      const retrieval = await buildConversationRetrieval(sb, userId, input.message);

      const systemPrompt = buildGuardianSystemPrompt(journey, stones || [], retrieval);
      // DB role 'guardian' → LLM role 'assistant'.
      const llmMessages = [
        ...history.map((h) => ({
          role: h.role === 'guardian' ? 'assistant' : 'user',
          content: h.content,
        })),
        { role: 'user', content: input.message },
      ];

      let reply = '';
      let usedFallback = false;
      try {
        reply = await chatWithGuardian(systemPrompt, llmMessages);
      } catch (e) {
        console.error('Guardian LLM failed:', e.message);
        usedFallback = true;
        const stoneCount = (stones || []).length;
        reply = journey
          ? `I have your Monument in view — the story of ${journey.title}. My deeper mind is quiet right now, but here is what I can see: ${stoneCount} stone${stoneCount === 1 ? '' : 's'} already inscribed. The next one is not another idea. It is the one honest thing you have been avoiding. Name it. Come back and tell me.`
          : 'Before I can walk beside you, raise your Monument. Name the story you are here to tell.';
      }

      // Store both sides. LLM role 'assistant' → DB role 'guardian'.
      const { error: mErr } = await sb.from('mentor_messages').insert([
        { user_id: userId, journey_id: journey?.id || null, role: 'user', content: input.message },
      ]);
      if (!mErr) {
        await sb.from('mentor_messages').insert([
          { user_id: userId, journey_id: journey?.id || null, role: 'guardian', content: reply },
        ]);
      }

      return json({ reply, usedFallback });
    }

    // ---------- MENTOR HISTORY ----------
    if (path === 'mentor/history' && method === 'GET') {
      // Most recent 100, returned in chronological order for display.
      const { data, error } = await sb
        .from('mentor_messages')
        .select('id, role, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      const messages = (data || []).reverse().map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      }));
      return json({ messages });
    }

    // ---------- INSIGHT (Daily reflection) ----------
    if (path === 'insight' && method === 'GET') {
      const { data: journey } = await sb
        .from('journeys')
        .select('*')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!journey) return json({ insight: null });

      const { data: stones } = await sb
        .from('stones')
        .select('type, moment_type, title, created_at')
        .eq('journey_id', journey.id)
        .order('happened_at', { ascending: false })
        .limit(10);
      const entries = stones || [];

      const insights = [
        `The Monument has stood ${daysSince(journey.created_at)} days. Every one of them is now permanent.`,
        entries.length > 0
          ? `Your last stone: ${entries[0].title || entries[0].moment_type || entries[0].type}. It matters more than you can see today.`
          : 'One honest stone waits to be laid. It does not need to be great — only true.',
        `The story you are telling: ${truncate(journey.title, 90)}`,
      ];
      return json({ insight: insights, entriesCount: entries.length });
    }

    return json({ error: 'Not found', path }, 404);
  } catch (e) {
    if (e instanceof AuthError) return json({ error: e.message }, 401);
    if (e instanceof SyntaxError) return json({ error: 'invalid JSON body' }, 400);
    console.error('API error:', e);
    return json({ error: 'internal error' }, 500);
  }
}

function daysSince(iso) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / (86400 * 1000));
  return Math.max(1, d + 1);
}
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n) + '…' : s;
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
