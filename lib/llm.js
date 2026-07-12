import Anthropic from '@anthropic-ai/sdk';

// Guardian LLM layer.
// Primary: direct Anthropic API (ANTHROPIC_API_KEY).
// Fallback: Emergent LiteLLM proxy (EMERGENT_LLM_KEY) — kept only for the
// hosted Emergent environment; removed once that environment is retired.
// Every path has a hard timeout so the mentor route can never hang.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const EMERGENT_KEY = process.env.EMERGENT_LLM_KEY;
const MODEL = process.env.GUARDIAN_MODEL || 'claude-opus-4-8';
const LLM_TIMEOUT_MS = 30_000;

let _anthropic = null;
function getAnthropic() {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: ANTHROPIC_KEY,
      timeout: LLM_TIMEOUT_MS, // milliseconds in the TS/JS SDK
      maxRetries: 1,
    });
  }
  return _anthropic;
}

// messages: [{ role: 'user' | 'assistant', content }], system: string
async function chatViaAnthropic(system, messages) {
  const response = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages,
  });
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
  if (response.stop_reason === 'refusal' || !text) {
    throw new Error('LLM_EMPTY_RESPONSE');
  }
  return text;
}

const EMERGENT_ENDPOINTS = [
  'https://integrations.emergentagent.com/llm/v1/chat/completions',
  'https://integrations.emergentagent.com/llm/chat/completions',
];

async function chatViaEmergent(system, messages) {
  const payload = {
    model: 'claude-sonnet-4-5-20250929',
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: 1024,
  };
  let lastError = null;
  for (const url of EMERGENT_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EMERGENT_KEY}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? '';
      if (content) return content;
      lastError = 'empty response';
    } catch (e) {
      lastError = e.name === 'AbortError' ? 'timeout' : e.message;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('LLM_UNAVAILABLE: ' + String(lastError).slice(0, 200));
}

// Returns the Guardian's reply text or throws. `messages` roles must be
// 'user' | 'assistant' (map DB role 'guardian' → 'assistant' before calling).
export async function chatWithGuardian(system, messages) {
  if (ANTHROPIC_KEY) return chatViaAnthropic(system, messages);
  if (EMERGENT_KEY) return chatViaEmergent(system, messages);
  throw new Error('No LLM key configured (ANTHROPIC_API_KEY or EMERGENT_LLM_KEY)');
}
