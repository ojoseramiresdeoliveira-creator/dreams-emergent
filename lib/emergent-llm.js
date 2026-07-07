// Emergent Universal LLM helper — calls the emergent LiteLLM-style proxy.
// Tries multiple known base URLs since the exact Emergent endpoint varies.

const KEY = process.env.EMERGENT_LLM_KEY;

const CANDIDATE_ENDPOINTS = [
  'https://integrations.emergentagent.com/llm/v1/chat/completions',
  'https://integrations.emergentagent.com/llm/chat/completions',
];

let workingEndpoint = null;

async function tryEndpoint(url, payload) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, status: res.status, error: txt };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function chatWithMentor(messages, { model = 'claude-sonnet-4-5-20250929', temperature = 0.7, max_tokens = 800 } = {}) {
  if (!KEY) throw new Error('EMERGENT_LLM_KEY not configured');

  const payload = { model, messages, temperature, max_tokens };

  // Try cached working endpoint first
  const endpoints = workingEndpoint
    ? [workingEndpoint, ...CANDIDATE_ENDPOINTS.filter((u) => u !== workingEndpoint)]
    : CANDIDATE_ENDPOINTS;

  let lastError = null;
  for (const url of endpoints) {
    const r = await tryEndpoint(url, payload);
    if (r.ok) {
      workingEndpoint = url;
      const content =
        r.data?.choices?.[0]?.message?.content ??
        r.data?.content?.[0]?.text ??
        r.data?.output?.message?.content ??
        '';
      return { content, raw: r.data, endpoint: url };
    }
    lastError = r.error;
  }

  // If all endpoints fail, return a graceful fallback so UI still works
  console.error('All Emergent endpoints failed. Last error:', lastError);
  throw new Error('LLM_UNAVAILABLE: ' + String(lastError).slice(0, 300));
}
