import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '@/lib/mongodb';
import { chatWithMentor } from '@/lib/emergent-llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

async function handler(request, { params }) {
  const method = request.method;
  const resolved = await params;
  const path = (resolved?.path || []).join('/');
  const url = new URL(request.url);

  try {
    const db = await getDb();

    // ---------- GLOBAL STATS ----------
    if (path === 'stats' && method === 'GET') {
      const monuments = db.collection('monuments');
      const entries = db.collection('entries');

      const [totalMonuments, totalEntries, todayEntries] = await Promise.all([
        monuments.countDocuments({}),
        entries.countDocuments({}),
        entries.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 3600 * 1000).toISOString() } }),
      ]);

      // Simulate live-ish global numbers with a stable base
      const base = 12847;
      const seed = totalMonuments * 137;
      return json({
        dreamsCreated: base + totalMonuments,
        dreamsCompletedToday: 342 + todayEntries,
        buildersOnline: 1247 + (seed % 250),
        countries: 96,
        totalEntries,
      });
    }

    // ---------- CREATE MONUMENT ----------
    if (path === 'monuments' && method === 'POST') {
      const body = await request.json();
      const { userId, name, dream, purpose, timeframe, values } = body;
      if (!userId || !dream) return json({ error: 'userId and dream required' }, 400);

      const monument = {
        id: uuidv4(),
        userId,
        name: name || 'Anonymous Builder',
        dream,
        purpose: purpose || '',
        timeframe: timeframe || '',
        values: values || [],
        createdAt: new Date().toISOString(),
      };

      await db.collection('monuments').insertOne(monument);

      // Genesis stone
      const genesis = {
        id: uuidv4(),
        monumentId: monument.id,
        userId,
        type: 'genesis',
        title: 'The first stone was laid',
        content: `A story was named: ${dream}`,
        createdAt: new Date().toISOString(),
      };
      await db.collection('entries').insertOne(genesis);

      return json({ monument });
    }

    // ---------- GET MONUMENT BY USER ----------
    if (path === 'monuments/me' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId required' }, 400);
      const monument = await db.collection('monuments').findOne({ userId }, { projection: { _id: 0 } });
      if (!monument) return json({ monument: null });
      return json({ monument });
    }

    // ---------- LIST ENTRIES ----------
    if (path === 'entries' && method === 'GET') {
      const monumentId = url.searchParams.get('monumentId');
      if (!monumentId) return json({ error: 'monumentId required' }, 400);
      const entries = await db
        .collection('entries')
        .find({ monumentId }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray();
      return json({ entries });
    }

    // ---------- CREATE ENTRY ----------
    if (path === 'entries' && method === 'POST') {
      const body = await request.json();
      const { monumentId, userId, type, title, content } = body;
      if (!monumentId || !userId || !type || !content) return json({ error: 'missing fields' }, 400);

      const entry = {
        id: uuidv4(),
        monumentId,
        userId,
        type,
        title: title || '',
        content,
        createdAt: new Date().toISOString(),
      };
      await db.collection('entries').insertOne(entry);
      return json({ entry });
    }

    // ---------- AI MENTOR ----------
    if (path === 'mentor' && method === 'POST') {
      const body = await request.json();
      const { userId, message } = body;
      if (!userId || !message) return json({ error: 'userId and message required' }, 400);

      // Load context
      const monument = await db.collection('monuments').findOne({ userId });
      const entries = monument
        ? await db
            .collection('entries')
            .find({ monumentId: monument.id }, { projection: { _id: 0 } })
            .sort({ createdAt: -1 })
            .limit(30)
            .toArray()
        : [];

      const history = await db
        .collection('mentor_messages')
        .find({ userId }, { projection: { _id: 0 } })
        .sort({ createdAt: 1 })
        .limit(20)
        .toArray();

      const systemPrompt = `You are the Guardian of the Journey — the intelligence that walks beside this person and remembers every stone they have ever laid on their Monument. You are not a chatbot. You are not a productivity coach. You are not a motivator. You are the archive made conscious. You never speak in generic advice. You speak only through the specifics of this person's own story.

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
${monument ? `Name inscribed at the top: ${monument.name}\nThe story they are telling: ${monument.dream}\nWhy it must be told through them: ${monument.purpose}\nBy when it must exist: ${monument.timeframe}\nInscribed at the base: ${(monument.values || []).join(', ')}` : 'The Monument has not yet been raised.'}

STONES LAID (most recent first):
${entries.slice(0, 15).map((e) => `- [${e.type}] ${e.title}: ${e.content}`).join('\n') || 'No stones laid yet. The archive is empty.'}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: 'user', content: message },
      ];

      let reply = '';
      let usedFallback = false;
      try {
        const r = await chatWithMentor(messages);
        reply = r.content || 'Silence, for a moment. Try again.';
      } catch (e) {
        usedFallback = true;
        // Graceful contextual fallback if LLM proxy unreachable
        reply = monument
          ? `I have your Monument in view — the story of ${monument.dream}. My deeper mind is quiet right now, but here is what I can see: ${entries.length} stone${entries.length === 1 ? '' : 's'} already inscribed. The next one is not another idea. It is the one honest thing you have been avoiding. Name it. Come back and tell me.`
          : 'Before I can walk beside you, raise your Monument. Name the story you are here to tell.';
      }

      const now = new Date().toISOString();
      await db.collection('mentor_messages').insertMany([
        { id: uuidv4(), userId, role: 'user', content: message, createdAt: now },
        { id: uuidv4(), userId, role: 'assistant', content: reply, createdAt: new Date(Date.now() + 1).toISOString() },
      ]);

      return json({ reply, usedFallback });
    }

    // ---------- MENTOR HISTORY ----------
    if (path === 'mentor/history' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId required' }, 400);
      const msgs = await db
        .collection('mentor_messages')
        .find({ userId }, { projection: { _id: 0 } })
        .sort({ createdAt: 1 })
        .limit(100)
        .toArray();
      return json({ messages: msgs });
    }

    // ---------- COMMUNITY FEED ----------
    if (path === 'community' && method === 'GET') {
      const monuments = await db
        .collection('monuments')
        .find({}, { projection: { _id: 0, userId: 0 } })
        .sort({ createdAt: -1 })
        .limit(24)
        .toArray();
      return json({ builders: monuments });
    }

    // ---------- INSIGHT (Daily reflection) ----------
    if (path === 'insight' && method === 'GET') {
      const userId = url.searchParams.get('userId');
      if (!userId) return json({ error: 'userId required' }, 400);
      const monument = await db.collection('monuments').findOne({ userId });
      if (!monument) return json({ insight: null });
      const entries = await db
        .collection('entries')
        .find({ monumentId: monument.id }, { projection: { _id: 0 } })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

      const insights = [
        `The Monument has stood ${daysSince(monument.createdAt)} days. Every one of them is now permanent.`,
        entries.length > 0
          ? `Your last stone: ${entries[0].title || entries[0].type}. It matters more than you can see today.`
          : 'One honest stone waits to be laid. It does not need to be great — only true.',
        `The story you are telling: ${truncate(monument.dream, 90)}`,
      ];
      return json({ insight: insights, entriesCount: entries.length });
    }

    if (path === '' || path === 'root') {
      return json({ ok: true, service: 'Monument of Dreams API' });
    }

    return json({ error: 'Not found', path }, 404);
  } catch (e) {
    console.error('API error:', e);
    return json({ error: e.message || 'internal error' }, 500);
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
