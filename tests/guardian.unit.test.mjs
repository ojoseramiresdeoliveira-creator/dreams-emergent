// Unit tests for the Guardian pipeline's pure logic (no network).
import { enforceProvenance, normalizeTraitKey, interpretationSchema } from './lib/guardian/interpreter.js';

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; failures.push(name); console.log(`FAIL  ${name} ${extra}`); }
}

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const FAKE = '99999999-9999-4999-8999-999999999999';
const PAT = '33333333-3333-4333-8333-333333333333';

console.log('— normalizeTraitKey —');
check('accents + case + spaces', normalizeTraitKey('Resiliente nos Recomeços') === 'resiliente-nos-recomecos');
check('symbols stripped', normalizeTraitKey('  Fé!! & Coragem__ ') === 'fe-coragem');
check('length capped at 60', normalizeTraitKey('x'.repeat(200)).length <= 60);

console.log('— interpretationSchema (Zod) —');
const valid = {
  memories: [{ kind: 'observation', content: 'Um facto atómico suficientemente longo.', source_stone_ids: [A], confidence: 0.8 }],
  links: [{ to_stone_id: B, link_type: 'echoes', note: 'mesmo tema', confidence: 0.7 }],
  traits: [{ trait_key: 'coragem', label: 'Coragem', direction: 'up' }],
  pattern_signals: [{ matches_pattern_id: null, pattern_type: 'cycle', title: 'Recomeço após silêncio', description: 'Depois de dias sem escrever, recomeça.', evidence_stone_ids: [A, B] }],
};
check('valid payload parses', interpretationSchema.safeParse(valid).success);
check('rejects bad kind', !interpretationSchema.safeParse({ ...valid, memories: [{ ...valid.memories[0], kind: 'invented' }] }).success);
check('rejects >3 memories', !interpretationSchema.safeParse({ ...valid, memories: Array(4).fill(valid.memories[0]) }).success);
check('rejects memory >400 chars', !interpretationSchema.safeParse({ ...valid, memories: [{ ...valid.memories[0], content: 'x'.repeat(401) }] }).success);
check('rejects non-uuid stone id', !interpretationSchema.safeParse({ ...valid, links: [{ ...valid.links[0], to_stone_id: 'nope' }] }).success);
check('rejects pattern with 1 evidence stone', !interpretationSchema.safeParse({ ...valid, pattern_signals: [{ ...valid.pattern_signals[0], evidence_stone_ids: [A] }] }).success);
check('rejects confidence >1', !interpretationSchema.safeParse({ ...valid, memories: [{ ...valid.memories[0], confidence: 1.5 }] }).success);

console.log('— enforceProvenance (the firewall) —');
const allowedStones = new Set([A, B]);
const allowedPatterns = new Set([PAT]);
const hallucinated = {
  memories: [
    { kind: 'observation', content: 'Facto com fonte real e fonte inventada.', source_stone_ids: [A, FAKE], confidence: 0.9 },
    { kind: 'emotion', content: 'Facto só com fonte inventada — deve cair.', source_stone_ids: [FAKE], confidence: 0.9 },
  ],
  links: [
    { to_stone_id: B, link_type: 'echoes', note: 'real', confidence: 0.8 },
    { to_stone_id: FAKE, link_type: 'caused', note: 'inventado', confidence: 0.9 },
  ],
  traits: [{ trait_key: 'Fé Inabalável', label: 'Fé inabalável', direction: 'up' }],
  pattern_signals: [
    { matches_pattern_id: FAKE, pattern_type: 'cycle', title: 'Padrão com id de pattern inventado', description: 'matches deve virar null; com 2 evidências reais sobrevive como novo.', evidence_stone_ids: [A, B] },
    { matches_pattern_id: null, pattern_type: 'trigger', title: 'Padrão sem evidência suficiente', description: 'Só 1 stone real após filtragem — deve cair.', evidence_stone_ids: [A, FAKE] },
    { matches_pattern_id: PAT, pattern_type: 'growth', title: 'Reforço legítimo', description: 'Id de pattern real fornecido.', evidence_stone_ids: [FAKE] },
  ],
};
const out = enforceProvenance(hallucinated, allowedStones, allowedPatterns);
check('fake source id stripped, memory kept with real source', out.memories.length === 1 && out.memories[0].source_stone_ids.join() === A);
check('memory with only fake sources dropped', !out.memories.some(m => m.content.includes('deve cair')));
check('link to fake stone dropped', out.links.length === 1 && out.links[0].to_stone_id === B);
check('fake pattern id nulled but pattern survives (2 real evidences)', out.pattern_signals.some(p => p.title.includes('id de pattern inventado') && p.matches_pattern_id === null));
check('new pattern with <2 real evidences dropped', !out.pattern_signals.some(p => p.title.includes('sem evidência')));
check('legit reinforcement kept even with 0 evidence stones', out.pattern_signals.some(p => p.matches_pattern_id === PAT));
check('trait keys normalized', out.traits[0].trait_key === 'fe-inabalavel');

console.log(`\n===== UNIT RESULT: ${pass} passed, ${fail} failed =====`);
if (failures.length) { failures.forEach(f => console.log('  - ' + f)); process.exit(1); }
