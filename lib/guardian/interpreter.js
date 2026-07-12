import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Guardian Interpreter — the single LLM call that reads ONE stone (plus its
// semantic neighborhood) and proposes interpretation: memories, links, trait
// signals, pattern signals. Everything it returns is validated here:
//   1. Structured output (JSON schema) constrains the shape at the API level.
//   2. Zod re-validates and enforces length/count limits.
//   3. Callers whitelist every stone/pattern id against the ids actually
//      provided — a hallucinated id can never enter the memory tables.

const MODEL = process.env.GUARDIAN_INTERPRETER_MODEL || 'claude-opus-4-8';
const TIMEOUT_MS = 30_000;

let _client = null;
function client() {
  if (!_client) {
    _client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
    });
  }
  return _client;
}

// ── Output contract ───────────────────────────────────────────────────────────

const MEMORY_KINDS = ['observation', 'emotion', 'commitment', 'turning_point', 'relationship', 'growth'];
const LINK_TYPES = ['echoes', 'continues', 'answers', 'contrasts', 'caused', 'resolves'];
const PATTERN_TYPES = ['behavioral', 'emotional', 'cycle', 'trigger', 'pre_breakthrough', 'growth'];

// JSON schema for the API's structured-output enforcement. Numeric/string
// bounds are not supported there, so those are enforced by Zod below.
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['memories', 'links', 'traits', 'pattern_signals'],
  properties: {
    memories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'content', 'source_stone_ids', 'confidence'],
        properties: {
          kind: { type: 'string', enum: MEMORY_KINDS },
          content: { type: 'string' },
          source_stone_ids: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'number' },
        },
      },
    },
    links: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['to_stone_id', 'link_type', 'note', 'confidence'],
        properties: {
          to_stone_id: { type: 'string' },
          link_type: { type: 'string', enum: LINK_TYPES },
          note: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    traits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['trait_key', 'label', 'direction'],
        properties: {
          trait_key: { type: 'string' },
          label: { type: 'string' },
          direction: { type: 'string', enum: ['up', 'down'] },
        },
      },
    },
    pattern_signals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['matches_pattern_id', 'pattern_type', 'title', 'description', 'evidence_stone_ids'],
        properties: {
          matches_pattern_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          pattern_type: { type: 'string', enum: PATTERN_TYPES },
          title: { type: 'string' },
          description: { type: 'string' },
          evidence_stone_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export const interpretationSchema = z.object({
  memories: z.array(z.object({
    kind: z.enum(MEMORY_KINDS),
    content: z.string().trim().min(10).max(400),
    source_stone_ids: z.array(z.string().uuid()).min(1).max(6),
    confidence: z.number().min(0).max(1),
  })).max(3),
  links: z.array(z.object({
    to_stone_id: z.string().uuid(),
    link_type: z.enum(LINK_TYPES),
    note: z.string().trim().max(300),
    confidence: z.number().min(0).max(1),
  })).max(4),
  traits: z.array(z.object({
    trait_key: z.string().trim().min(2).max(60),
    label: z.string().trim().min(2).max(80),
    direction: z.enum(['up', 'down']),
  })).max(3),
  pattern_signals: z.array(z.object({
    matches_pattern_id: z.string().uuid().nullable(),
    pattern_type: z.enum(PATTERN_TYPES),
    title: z.string().trim().min(4).max(120),
    description: z.string().trim().min(10).max(400),
    evidence_stone_ids: z.array(z.string().uuid()).min(2).max(8),
  })).max(2),
});

// Normalizes a trait key: lowercase, no accents, kebab-case.
export function normalizeTraitKey(key) {
  return String(key)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Drops every id the LLM did not receive. This is the provenance firewall.
export function enforceProvenance(interp, allowedStoneIds, allowedPatternIds) {
  const stoneOk = (id) => allowedStoneIds.has(id);
  const memories = interp.memories
    .map((m) => ({ ...m, source_stone_ids: m.source_stone_ids.filter(stoneOk) }))
    .filter((m) => m.source_stone_ids.length >= 1);
  const links = interp.links.filter((l) => stoneOk(l.to_stone_id));
  const pattern_signals = interp.pattern_signals
    .map((p) => ({
      ...p,
      matches_pattern_id:
        p.matches_pattern_id && allowedPatternIds.has(p.matches_pattern_id)
          ? p.matches_pattern_id
          : null,
      evidence_stone_ids: p.evidence_stone_ids.filter(stoneOk),
    }))
    // A pattern needs ≥2 evidence stones by definition (unless reinforcing an
    // existing one, where current evidence alone is enough).
    .filter((p) => p.matches_pattern_id !== null || p.evidence_stone_ids.length >= 2);
  const traits = interp.traits.map((t) => ({ ...t, trait_key: normalizeTraitKey(t.trait_key) }))
    .filter((t) => t.trait_key.length >= 2);
  return { memories, links, traits, pattern_signals };
}

// ── Prompt ────────────────────────────────────────────────────────────────────

function fmtStone(s) {
  const date = new Date(s.happened_at).toISOString().slice(0, 10);
  const meaning = s.moment_type ? ` moment=${s.moment_type}` : '';
  return `[stone ${s.id}] date=${date} format=${s.type}${meaning}\n  title: ${s.title || '(none)'}\n  body: ${s.body || '(empty)'}`;
}

function buildPrompt({ stone, neighbors, activePatterns, topTraits }) {
  return `A walker has just inscribed a new stone on their Monument. Interpret it.

THE NEW STONE:
${fmtStone(stone)}

NEARBY STONES FROM THEIR ARCHIVE (semantically similar past moments — the only stones you may link to or cite):
${neighbors.length ? neighbors.map(fmtStone).join('\n') : '(none yet — this archive is young)'}

THEIR ACTIVE PATTERNS (reinforce these when the new stone is evidence for one; only reference these ids):
${activePatterns.length ? activePatterns.map((p) => `[pattern ${p.id}] (${p.pattern_type}, seen ${p.occurrences}x) ${p.title}: ${p.description}`).join('\n') : '(none yet)'}

THEIR CURRENT TRAITS:
${topTraits.length ? topTraits.map((t) => `- ${t.label} (strength ${t.strength.toFixed(2)})`).join('\n') : '(none yet)'}

YOUR TASK — extract only what is genuinely present:
1. memories: 0–3 atomic facts worth remembering for years. Each must be one self-contained sentence (≤400 chars) that will still make sense read alone in five years. Cite the stone ids that ground it. Skip the mundane — an empty list is a valid answer.
2. links: connections between the NEW stone and the nearby stones listed above (echoes / continues / answers / contrasts / caused / resolves), with a short note saying why.
3. traits: 0–3 character signals this stone shows (direction "up" if reinforced, "down" if contradicted). trait_key must be a short kebab-case identifier.
4. pattern_signals: only if the new stone plus at least one PAST stone show the same recurring behavior. If it matches an active pattern above, set matches_pattern_id. A single occurrence is never a pattern.

HARD RULES:
- Only use stone ids and pattern ids that appear above. Never invent an id.
- Interpret; never rewrite. Quote the walker's own words where possible.
- Write memory content, link notes and pattern text in the same language the walker writes in.
- confidence reflects how certain the evidence is (0–1). Below 0.5 means don't include it.`;
}

// ── Entry point ───────────────────────────────────────────────────────────────

// Returns validated, provenance-enforced interpretation or throws.
export async function interpretStone({ stone, neighbors, activePatterns, topTraits }) {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      'You are the Guardian Interpreter for Monument of Dreams — the quiet archivist that turns inscribed moments into durable memory. You are precise, restrained, and you never invent. You output only the requested JSON.',
    messages: [{ role: 'user', content: buildPrompt({ stone, neighbors, activePatterns, topTraits }) }],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
  });

  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (response.stop_reason === 'refusal' || !text) throw new Error('interpreter returned no output');

  const parsed = interpretationSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error('interpreter output failed validation: ' + parsed.error.issues[0]?.message);
  }

  const allowedStoneIds = new Set([stone.id, ...neighbors.map((n) => n.id)]);
  const allowedPatternIds = new Set(activePatterns.map((p) => p.id));
  return enforceProvenance(parsed.data, allowedStoneIds, allowedPatternIds);
}
