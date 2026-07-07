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

      // Add the genesis entry
      const genesis = {
        id: uuidv4(),
        monumentId: monument.id,
        userId,
        type: 'genesis',
        title: 'The Monument was raised',
        content: `A dream was declared: ${dream}`,
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

      const systemPrompt = `You are the Monument Mentor — a calm, deeply human AI who remembers every step of the user's journey. You speak with the elegance of a museum curator and the warmth of a lifelong friend. You do NOT give generic motivational advice. You reflect back on their actual journey, name specific patterns, and give one crystal-clear next step.

RULES:
- Never use exclamation points more than once per response.
- Never use emojis.
- Keep responses under 140 words unless they explicitly ask for depth.
- Refer to their monument, their dream, and specific entries by name.
- Speak like a legacy: timeless, patient, precise.

THE USER'S MONUMENT:
${monument ? `Name: ${monument.name}\nDream: ${monument.dream}\nPurpose: ${monument.purpose}\nTimeframe: ${monument.timeframe}\nValues: ${(monument.values || []).join(', ')}` : 'No monument declared yet.'}

RECENT JOURNEY (most recent first):
${entries.slice(0, 15).map((e) => `- [${e.type}] ${e.title}: ${e.content}`).join('\n') || 'No entries yet.'}`;

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
          ? `I have your monument in view — ${monument.dream}. Right now the connection to my deeper mind is muted, but here is what I see: your journey has ${entries.length} preserved moments. The next brick to lay is not another idea — it is the one action you have been avoiding. Name it.`
          : 'Before I can mentor you, raise your monument. Declare the dream you are here to build.';
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
        `Your monument stands ${daysSince(monument.createdAt)} days tall. Every one of them is now permanent.`,
        entries.length > 0
          ? `Last movement: ${entries[0].title || entries[0].type}. It matters more than you think.`
          : 'The next brick is waiting. Lay it today.',
        `Dream in view: ${truncate(monument.dream, 90)}`,
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
