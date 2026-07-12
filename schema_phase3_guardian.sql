-- ================================================================
-- Monument of Dreams — Phase 2: Guardian Memory Layer
-- Run AFTER schema_phase1.sql, schema_phase1_patch.sql and
-- schema_phase2_hardening.sql.
--
-- HOW TO RUN: paste this ENTIRE file into the Supabase SQL Editor
-- with NOTHING selected (a text selection makes the editor run only
-- the selection), then Run once. The whole file executes as a single
-- transaction: it either fully succeeds or fully rolls back.
-- Idempotent: safe to run again.
--
-- ARCHITECTURE RULES (see docs/PHASE2_ARCHITECTURE.md):
--   Stones = immutable TRUTH. The pipeline only ever writes the two
--   mechanical stone columns defined in Phase 1: embedding and
--   guardian_processed. All INTERPRETATION lives in the tables below,
--   every row of which must cite its source stones (provenance).
--   The whole layer is disposable and rebuildable from stones.
-- ================================================================


-- ================================================================
-- STEP 0: Embedding dimension
-- voyage-3.5 / text-embedding-3-small @ 1024 dims (provider-portable).
-- Safe: the embedding column has never been populated (Phase 1 code
-- never wrote embeddings). No-op if already vector(1024).
-- ================================================================

ALTER TABLE stones ALTER COLUMN embedding TYPE vector(1024) USING NULL::vector(1024);


-- ================================================================
-- STEP 1: GUARDIAN MEMORIES — atomic interpreted facts
-- Never destructively edited: revisions supersede (is_active=false,
-- superseded_by → new row). Reinforcement bumps counters instead of
-- inserting near-duplicates.
-- ================================================================

CREATE TABLE IF NOT EXISTS guardian_memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id       uuid REFERENCES journeys(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN
                     ('observation','emotion','commitment','turning_point','relationship','growth')),
  content          text NOT NULL,
  source_stone_ids uuid[] NOT NULL CHECK (array_length(source_stone_ids, 1) >= 1),
  confidence       real NOT NULL DEFAULT 0.8 CHECK (confidence BETWEEN 0 AND 1),
  embedding        vector(1024),
  is_active        boolean NOT NULL DEFAULT true,
  superseded_by    uuid REFERENCES guardian_memories(id),
  times_reinforced int  NOT NULL DEFAULT 1,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guardian_memories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_memories: owner full access"
  ON guardian_memories FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gmem_user_active ON guardian_memories (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_gmem_user_seen   ON guardian_memories (user_id, last_seen_at DESC);


-- ================================================================
-- STEP 2: GUARDIAN PATTERNS — what repeats
-- Lifecycle: emerging → confirmed → dormant / broken.
-- Patterns strengthen (occurrences++, evidence append), never duplicate.
-- ================================================================

CREATE TABLE IF NOT EXISTS guardian_patterns (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id         uuid REFERENCES journeys(id) ON DELETE CASCADE,
  pattern_type       text NOT NULL CHECK (pattern_type IN
                       ('behavioral','emotional','cycle','trigger','pre_breakthrough','growth')),
  title              text NOT NULL,
  description        text NOT NULL,
  evidence_stone_ids uuid[] NOT NULL CHECK (array_length(evidence_stone_ids, 1) >= 2),
  occurrences        int  NOT NULL DEFAULT 2,
  status             text NOT NULL DEFAULT 'emerging'
                       CHECK (status IN ('emerging','confirmed','dormant','broken')),
  confidence         real NOT NULL DEFAULT 0.6 CHECK (confidence BETWEEN 0 AND 1),
  embedding          vector(1024),
  first_seen_at      timestamptz NOT NULL,
  last_seen_at       timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE guardian_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_patterns: owner full access"
  ON guardian_patterns FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gpat_user_status ON guardian_patterns (user_id, status);


-- ================================================================
-- STEP 3: GUARDIAN TRAITS — accumulated, structurally unique
-- ================================================================

CREATE TABLE IF NOT EXISTS guardian_traits (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trait_key          text NOT NULL,
  label              text NOT NULL,
  strength           real NOT NULL DEFAULT 0.3 CHECK (strength BETWEEN 0 AND 1),
  trend              text NOT NULL DEFAULT 'rising' CHECK (trend IN ('rising','stable','fading')),
  evidence_stone_ids uuid[] NOT NULL,
  first_seen_at      timestamptz NOT NULL,
  last_seen_at       timestamptz NOT NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, trait_key)
);

ALTER TABLE guardian_traits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_traits: owner full access"
  ON guardian_traits FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gtrait_user_strength ON guardian_traits (user_id, strength DESC);


-- ================================================================
-- STEP 4: STONE LINKS — the web between moments
-- ================================================================

CREATE TABLE IF NOT EXISTS stone_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_stone_id uuid NOT NULL REFERENCES stones(id) ON DELETE CASCADE,
  to_stone_id   uuid NOT NULL REFERENCES stones(id) ON DELETE CASCADE,
  link_type     text NOT NULL CHECK (link_type IN
                  ('echoes','continues','answers','contrasts','caused','resolves')),
  note          text,
  created_by    text NOT NULL DEFAULT 'guardian' CHECK (created_by IN ('guardian','user')),
  confidence    real NOT NULL DEFAULT 0.7 CHECK (confidence BETWEEN 0 AND 1),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_stone_id, to_stone_id, link_type),
  CHECK (from_stone_id <> to_stone_id)
);

ALTER TABLE stone_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stone_links: owner full access"
  ON stone_links FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_slink_user_from ON stone_links (user_id, from_stone_id);
CREATE INDEX IF NOT EXISTS idx_slink_user_to   ON stone_links (user_id, to_stone_id);


-- ================================================================
-- STEP 5: GUARDIAN CONTEXT — compiled working memory (cache)
-- One row per user. Rebuildable; never a source of truth.
-- ================================================================

CREATE TABLE IF NOT EXISTS guardian_context (
  user_id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  narrative         text,
  top_traits        jsonb NOT NULL DEFAULT '[]',
  active_patterns   jsonb NOT NULL DEFAULT '[]',
  key_memories      jsonb NOT NULL DEFAULT '[]',
  stats             jsonb NOT NULL DEFAULT '{}',
  stones_at_compile int  NOT NULL DEFAULT 0,
  compiled_at       timestamptz NOT NULL DEFAULT now(),
  version           int  NOT NULL DEFAULT 1
);

ALTER TABLE guardian_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_context: owner full access"
  ON guardian_context FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ================================================================
-- STEP 6: GUARDIAN JOBS — idempotent processing queue
-- UNIQUE (stone_id, job_type): a stone is never interpreted twice
-- by accident. Deliberate rebuilds delete + re-enqueue.
-- ================================================================

CREATE TABLE IF NOT EXISTS guardian_jobs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stone_id   uuid REFERENCES stones(id) ON DELETE CASCADE,
  job_type   text NOT NULL CHECK (job_type IN ('process_stone','recompile_context')),
  status     text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','running','done','failed')),
  attempts   int  NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (stone_id, job_type)
);

ALTER TABLE guardian_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_jobs: owner full access"
  ON guardian_jobs FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_gjobs_pending
  ON guardian_jobs (created_at) WHERE status IN ('pending','failed');
CREATE INDEX IF NOT EXISTS idx_gjobs_user ON guardian_jobs (user_id, status);


-- ================================================================
-- STEP 7: HNSW indexes for semantic search (cosine)
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_stones_embedding_hnsw
  ON stones USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_gmem_embedding_hnsw
  ON guardian_memories USING hnsw (embedding vector_cosine_ops);


-- ================================================================
-- STEP 8: Semantic search functions
-- SECURITY INVOKER: RLS applies inside — an authenticated caller can
-- only ever match their own rows, whatever p_user_id says. The explicit
-- p_user_id filter is what keeps the service-role (cron) path scoped.
-- ================================================================

CREATE OR REPLACE FUNCTION match_stones(
  p_user_id       uuid,
  query_embedding vector(1024),
  match_count     int  DEFAULT 6,
  min_similarity  real DEFAULT 0.30
)
RETURNS TABLE (
  id uuid, journey_id uuid, type text, moment_type text,
  title text, body text, happened_at timestamptz, similarity real
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT s.id, s.journey_id, s.type, s.moment_type, s.title, s.body, s.happened_at,
         (1 - (s.embedding <=> query_embedding))::real AS similarity
  FROM stones s
  WHERE s.user_id = p_user_id
    AND s.embedding IS NOT NULL
    AND 1 - (s.embedding <=> query_embedding) >= min_similarity
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION match_memories(
  p_user_id       uuid,
  query_embedding vector(1024),
  match_count     int  DEFAULT 6,
  min_similarity  real DEFAULT 0.30
)
RETURNS TABLE (
  id uuid, kind text, content text, source_stone_ids uuid[],
  times_reinforced int, confidence real, last_seen_at timestamptz,
  created_at timestamptz, similarity real
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT m.id, m.kind, m.content, m.source_stone_ids,
         m.times_reinforced, m.confidence, m.last_seen_at, m.created_at,
         (1 - (m.embedding <=> query_embedding))::real AS similarity
  FROM guardian_memories m
  WHERE m.user_id = p_user_id
    AND m.is_active = true
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) >= min_similarity
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_stones(uuid, vector, int, real)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_memories(uuid, vector, int, real) TO authenticated, service_role;


-- ================================================================
-- DONE. Verify with:
--
-- SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN
--   ('guardian_memories','guardian_patterns','guardian_traits',
--    'stone_links','guardian_context','guardian_jobs');
--   → 6 rows, all rowsecurity = true
--
-- SELECT proname FROM pg_proc
--   WHERE proname IN ('match_stones','match_memories');
--   → 2 rows
--
-- SELECT attrelid::regclass AS table_name,
--        format_type(atttypid, atttypmod) AS column_type
-- FROM pg_attribute WHERE attname = 'embedding'
--   AND attrelid IN ('stones'::regclass, 'guardian_memories'::regclass,
--                    'guardian_patterns'::regclass);
--   → 3 rows, all vector(1024)
-- ================================================================
