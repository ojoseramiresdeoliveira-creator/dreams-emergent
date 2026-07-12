// Monument of Dreams — Phase "foundation hardening" E2E test suite.
// Creates two throwaway users in Supabase, exercises every API route with
// real JWTs, verifies RLS isolation, validation, rate limiting, and cleans up.

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const PROJECT = 'c:/Users/ernes/Desktop/dreams-emergent';

// ── env ──────────────────────────────────────────────────────────────────────
const env = {};
for (const line of readFileSync(`${PROJECT}/.env.local`, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(SB_URL, SERVICE, { auth: { persistSession: false } });
const anon = () => createClient(SB_URL, ANON, { auth: { persistSession: false } });

// ── tiny test harness ────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; failures.push(name + (extra ? ` — ${extra}` : '')); console.log(`FAIL  ${name} ${extra}`); }
}

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}/api/${path}`, {
    method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

// ── users ────────────────────────────────────────────────────────────────────
const stamp = Date.now();
const USERS = [
  { email: `mod-e2e-a-${stamp}@example.com`, password: 'e2e-Passw0rd-A!' },
  { email: `mod-e2e-b-${stamp}@example.com`, password: 'e2e-Passw0rd-B!' },
];

async function createAndLogin({ email, password }) {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error('createUser: ' + error.message);
  const { data: login, error: lErr } = await anon().auth.signInWithPassword({ email, password });
  if (lErr) throw new Error('signIn: ' + lErr.message);
  return { id: data.user.id, token: login.session.access_token };
}

async function main() {
  console.log('\n— health & public routes —');
  const health = await api('root');
  check('GET /api/root → 200 ok', health.status === 200 && health.data.ok === true);

  const stats = await api('stats');
  check('GET /api/stats → 200 with counters', stats.status === 200 && typeof stats.data.dreamsCreated === 'number');

  const community = await api('community');
  check('GET /api/community → 200 array', community.status === 200 && Array.isArray(community.data.builders));
  const leaks = (community.data.builders || []).some(b => 'userId' in b || 'user_id' in b || 'id' in b);
  check('community feed exposes no user/journey ids', !leaks);

  console.log('\n— authentication required —');
  for (const [m, p, body] of [
    ['GET', 'journeys/me'], ['POST', 'journeys', { name: 'x', dream: 'a real dream here' }],
    ['GET', 'entries?monumentId=00000000-0000-0000-0000-000000000000'],
    ['POST', 'entries', { monumentId: '00000000-0000-0000-0000-000000000000', type: 'victory', content: 'x' }],
    ['POST', 'mentor', { message: 'hello' }], ['GET', 'mentor/history'], ['GET', 'insight'],
  ]) {
    const r = await api(p, { method: m, body });
    check(`${m} /api/${p.split('?')[0]} without token → 401`, r.status === 401, `got ${r.status}`);
  }
  const badTok = await api('journeys/me', { token: 'garbage-token' });
  check('invalid token → 401', badTok.status === 401, `got ${badTok.status}`);

  console.log('\n— users —');
  const A = await createAndLogin(USERS[0]);
  const B = await createAndLogin(USERS[1]);
  console.log(`  created A=${A.id.slice(0, 8)}… B=${B.id.slice(0, 8)}…`);

  console.log('\n— input validation (Zod) —');
  let r = await api('journeys', { method: 'POST', token: A.token, body: { name: 'A', dream: 'hi' } });
  check('journey with 2-char dream → 400', r.status === 400, `got ${r.status}`);
  r = await api('journeys', { method: 'POST', token: A.token, body: { dream: 'a valid dream but no name' } });
  check('journey without name → 400', r.status === 400, `got ${r.status}`);
  r = await api('entries', { method: 'POST', token: A.token, body: { monumentId: 'not-a-uuid', type: 'victory', content: 'x' } });
  check('entry with non-uuid monumentId → 400', r.status === 400, `got ${r.status}`);

  console.log('\n— journey creation (+ genesis) —');
  r = await api('journeys', { method: 'POST', token: A.token, body: {
    name: 'E2E Tester', dream: 'To prove this foundation is solid', purpose: 'Because trust is earned', timeframe: 'by 2027', values: ['Truth', 'Craft', 'Discipline'],
  }});
  check('POST /api/journeys → 200 monument', r.status === 200 && !!r.data.monument?.id, JSON.stringify(r.data).slice(0, 120));
  const journeyA = r.data.monument;
  check('monument.userId comes from JWT, not body', journeyA?.userId === A.id);

  r = await api(`entries?monumentId=${journeyA.id}`, { token: A.token });
  const genesis = (r.data.entries || []).find(e => e.type === 'genesis');
  check('genesis stone exists after creation', !!genesis);

  // Second journey: must not displace the primary.
  r = await api('journeys', { method: 'POST', token: A.token, body: { name: 'E2E Tester', dream: 'A second parallel story' } });
  const journeyA2 = r.data.monument;
  check('second journey creates without error', r.status === 200 && !!journeyA2?.id);
  r = await api('journeys/me', { token: A.token });
  check('journeys/me still returns the FIRST (primary) journey', r.data.monument?.id === journeyA.id, `got ${r.data.monument?.id}`);

  // DB-level check: only one primary.
  const { data: prims } = await admin.from('journeys').select('id, is_primary').eq('user_id', A.id).eq('is_primary', true);
  check('exactly one primary journey in DB', (prims || []).length === 1, `got ${(prims || []).length}`);

  console.log('\n— stones: type = FORMAT / moment_type = MEANING —');
  r = await api('entries', { method: 'POST', token: A.token, body: { monumentId: journeyA.id, type: 'failure', title: 'Honest defeat', content: 'I missed a week. Writing it down anyway.' } });
  check('POST entry (failure) → 200', r.status === 200 && !!r.data.entry, JSON.stringify(r.data).slice(0, 120));
  check('UI type round-trips as "failure"', r.data.entry?.type === 'failure');
  const { data: stoneRow } = await admin.from('stones').select('type, moment_type').eq('id', r.data.entry.id).single();
  check('DB: type="reflection", moment_type="defeat"', stoneRow?.type === 'reflection' && stoneRow?.moment_type === 'defeat', JSON.stringify(stoneRow));

  r = await api('entries', { method: 'POST', token: A.token, body: { monumentId: journeyA.id, type: 'victory', content: 'Shipped the fix.' } });
  check('POST entry (victory) → 200', r.status === 200);

  console.log('\n— cross-user isolation (RLS + ownership) —');
  r = await api(`entries?monumentId=${journeyA.id}`, { token: B.token });
  check("B reading A's stones → 404", r.status === 404, `got ${r.status}`);
  r = await api('entries', { method: 'POST', token: B.token, body: { monumentId: journeyA.id, type: 'victory', content: 'forged stone' } });
  check("B writing into A's journey → 404", r.status === 404, `got ${r.status}`);
  r = await api('journeys/me', { token: B.token });
  check('B has no monument (not A\'s)', r.status === 200 && r.data.monument === null, JSON.stringify(r.data).slice(0, 80));

  console.log('\n— Guardian (mentor) —');
  r = await api('mentor', { method: 'POST', token: A.token, body: { message: 'What have I preserved so far? Answer in one short sentence.' } });
  check('POST /api/mentor → 200 with reply', r.status === 200 && typeof r.data.reply === 'string' && r.data.reply.length > 0, JSON.stringify(r.data).slice(0, 160));
  console.log(`  usedFallback=${r.data.usedFallback} reply="${String(r.data.reply).slice(0, 100)}…"`);
  const realLLM = r.data.usedFallback === false;
  check('reply came from the real LLM (not fallback)', realLLM, 'usedFallback=true — check ANTHROPIC_API_KEY');

  r = await api('mentor', { method: 'POST', token: A.token, body: { message: '' } });
  check('empty mentor message → 400', r.status === 400, `got ${r.status}`);
  r = await api('mentor', { method: 'POST', token: A.token, body: { message: 'x'.repeat(5000) } });
  check('oversized mentor message → 400', r.status === 400, `got ${r.status}`);

  r = await api('mentor/history', { token: A.token });
  const roles = new Set((r.data.messages || []).map(m => m.role));
  check('history has user + guardian messages', r.status === 200 && roles.has('user') && roles.has('guardian'), JSON.stringify([...roles]));

  r = await api('mentor/history', { token: B.token });
  check("B cannot see A's Guardian history", r.status === 200 && (r.data.messages || []).length === 0, `got ${(r.data.messages || []).length} messages`);

  console.log('\n— insight —');
  r = await api('insight', { token: A.token });
  check('GET /api/insight → 200 with 3 lines', r.status === 200 && Array.isArray(r.data.insight) && r.data.insight.length === 3);
  r = await api('insight', { token: B.token });
  check('insight for user without journey → insight:null', r.status === 200 && r.data.insight === null);

  console.log('\n— mentor rate limit (20 / 5 min) —');
  // A already used 3 slots above (1 ok + 2 rejected-before-limit... note: the
  // two 400s hit validation BEFORE the rate limiter? No — limiter runs after
  // validation, so only the successful call consumed a slot. Fire 25 more.
  const results = await Promise.all(Array.from({ length: 25 }, () =>
    api('mentor', { method: 'POST', token: A.token, body: { message: 'ping' } })));
  const ok = results.filter(x => x.status === 200).length;
  const limited = results.filter(x => x.status === 429).length;
  console.log(`  200=${ok} 429=${limited}`);
  check('rate limiter returns 429 after 20 requests', limited >= 5 && ok <= 20, `200=${ok} 429=${limited}`);

  console.log('\n— stone idempotency via clientRef (Phase 4) —');
  {
    // Does the client_ref column exist? (Phase 4 SQL applied?)
    const probe = await admin.from('stones').select('client_ref').limit(1);
    const columnExists = !probe.error;
    console.log(`  client_ref column present: ${columnExists}`);

    const ref = crypto.randomUUID();
    const body = { monumentId: journeyA.id, type: 'victory', title: 'Idempotency proof', content: 'This exact submission is sent twice with the same clientRef.', clientRef: ref };
    const first = await api('entries', { method: 'POST', token: A.token, body });
    const second = await api('entries', { method: 'POST', token: A.token, body });
    check('1st submission with clientRef → 200', first.status === 200 && !!first.data.entry, JSON.stringify(first.data).slice(0, 120));
    check('2nd identical submission → 200 (never an error)', second.status === 200 && !!second.data.entry, JSON.stringify(second.data).slice(0, 120));

    if (columnExists) {
      check('STRICT: retry returns the SAME stone id (replay, no duplicate)',
        second.data.entry.id === first.data.entry.id && second.data.replayed === true,
        `first=${first.data.entry.id} second=${second.data.entry.id}`);
      const { data: sameRef } = await admin.from('stones').select('id').eq('client_ref', ref);
      check('STRICT: exactly 1 row with this client_ref in DB', (sameRef || []).length === 1, `got ${(sameRef || []).length}`);
      // Edited resubmission must create a NEW stone (new intent → client sends a new ref)
      const edited = await api('entries', { method: 'POST', token: A.token, body: { ...body, content: 'Edited content — a different intent.', clientRef: crypto.randomUUID() } });
      check('STRICT: edited resubmission with new ref → new stone', edited.status === 200 && edited.data.entry.id !== first.data.entry.id);
    } else {
      console.log('  (degraded mode: run schema_phase4_idempotency.sql for strict replay guarantees)');
      check('DEGRADED: submissions succeed without client_ref column', first.status === 200 && second.status === 200);
    }
  }

  console.log('\n— guardian processing endpoint (Phase 2) —');
  r = await api('guardian/process', { method: 'POST' });
  check('POST /api/guardian/process without token → 401', r.status === 401, `got ${r.status}`);
  r = await api('guardian/process', { method: 'POST', token: A.token });
  check('drain with user token → 200', r.status === 200, JSON.stringify(r.data).slice(0, 120));
  check('drain reports staged-activation state (keys/schema pending)',
    r.data.skipped !== undefined || typeof r.data.processed === 'number', JSON.stringify(r.data).slice(0, 120));
  {
    const res = await fetch(`${BASE}/api/guardian/process`, {
      method: 'POST', headers: { 'x-cron-secret': 'wrong-secret' },
    });
    check('wrong cron secret without token → 401', res.status === 401, `got ${res.status}`);
  }
  // Stone creation must remain instant and unaffected by the Guardian layer
  // (schema not applied + keys missing = worst case for the background hook).
  {
    const t0 = Date.now();
    const rr = await api('entries', { method: 'POST', token: A.token, body: { monumentId: journeyA.id, type: 'reflection', content: 'Stone written while the Guardian layer is dormant.' } });
    const ms = Date.now() - t0;
    check('stone creation unaffected by dormant Guardian layer', rr.status === 200 && !!rr.data.entry, `status=${rr.status}`);
    console.log(`  stone POST latency with background hook: ${ms}ms`);
  }

  console.log('\n— cleanup —');
  for (const u of [A, B]) {
    const { error } = await admin.auth.admin.deleteUser(u.id);
    check(`deleted test user ${u.id.slice(0, 8)}…`, !error, error?.message);
  }
  const { data: orphans } = await admin.from('journeys').select('id').in('user_id', [A.id, B.id]);
  check('cascade removed test journeys', (orphans || []).length === 0);

  console.log(`\n===== RESULT: ${pass} passed, ${fail} failed =====`);
  if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
}

main().catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
