// Embeddings layer — provider-agnostic (Voyage AI primary, OpenAI alternative).
// 1024 dimensions on both providers so the DB schema is portable.
// Every call has a hard timeout; callers must treat failures as retryable.

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'voyage';
const API_KEY = process.env.EMBEDDINGS_API_KEY;
export const EMBEDDING_DIMS = 1024;
const TIMEOUT_MS = 10_000;
const MAX_INPUT_CHARS = 8000; // ~2k tokens; stones/memories are far smaller
const MAX_BATCH = 128;

export function embeddingsConfigured() {
  return Boolean(API_KEY);
}

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, MAX_INPUT_CHARS) || ' ';
}

async function post(url, body, headers) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`embeddings ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('embeddings timeout');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// inputType: 'document' (stones, memories, patterns) | 'query' (search questions).
// Voyage uses it to optimize retrieval; OpenAI ignores it.
async function embedBatchOnce(texts, inputType) {
  if (!API_KEY) throw new Error('EMBEDDINGS_API_KEY not configured');
  const inputs = texts.map(normalize);

  if (PROVIDER === 'openai') {
    const data = await post(
      'https://api.openai.com/v1/embeddings',
      { model: 'text-embedding-3-small', input: inputs, dimensions: EMBEDDING_DIMS },
      { Authorization: `Bearer ${API_KEY}` }
    );
    return data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);
  }

  // Default: Voyage AI
  const data = await post(
    'https://api.voyageai.com/v1/embeddings',
    {
      model: 'voyage-3.5',
      input: inputs,
      input_type: inputType === 'query' ? 'query' : 'document',
      output_dimension: EMBEDDING_DIMS,
    },
    { Authorization: `Bearer ${API_KEY}` }
  );
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

// Batch entrypoint (chunks transparently). Returns number[][] aligned to input.
export async function embedTexts(texts, inputType = 'document') {
  const out = [];
  for (let i = 0; i < texts.length; i += MAX_BATCH) {
    out.push(...(await embedBatchOnce(texts.slice(i, i + MAX_BATCH), inputType)));
  }
  return out;
}

export async function embedText(text, inputType = 'document') {
  const [v] = await embedTexts([text], inputType);
  return v;
}
