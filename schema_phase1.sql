-- ================================================================
-- Monument of Dreams — Phase 1 Schema
-- Run Step 0 first, then Step 1.
-- ================================================================


-- ================================================================
-- STEP 0: Enable pgvector
-- Run this separately and confirm before running Step 1.
-- Verify: SELECT * FROM pg_extension WHERE extname = 'vector';
-- ================================================================

CREATE EXTENSION IF NOT EXISTS vector;


-- ================================================================
-- STEP 1: JOURNEYS
-- Parallel life goals. One user can have many active journeys.
-- ("dreams" table name avoided — already exists in this database.)
-- ================================================================

CREATE TABLE journeys (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  why         text,
  is_primary  boolean     NOT NULL DEFAULT false,
  status      text        NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'paused', 'achieved')),
  phase       text        NOT NULL DEFAULT 'beginning'
                CHECK (phase IN ('beginning', 'building', 'struggling', 'rising')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journeys: owner full access"
  ON journeys FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_journeys_user_id     ON journeys (user_id);
CREATE INDEX idx_journeys_user_status ON journeys (user_id, status);


-- ================================================================
-- STEP 1: STONES
-- One row per moment. Always belongs to a Journey.
-- ================================================================

CREATE TABLE stones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id  uuid        NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,

  -- ── Core content ──────────────────────────────────────────────
  type        text        NOT NULL DEFAULT 'reflection'
                CHECK (type IN ('reflection', 'photo', 'video', 'audio', 'milestone')),
  body        text,
  media_url   text,
  visibility  text        NOT NULL DEFAULT 'private'
                CHECK (visibility IN ('private', 'friends', 'public')),
  happened_at timestamptz NOT NULL DEFAULT now(),

  -- ── Guardian-inferred (all editable by user) ──────────────────
  title        text,
  summary      text,
  moment_type  text
                 CHECK (moment_type IN (
                   'victory', 'defeat', 'restart', 'learning',
                   'fear', 'doubt', 'breakthrough', 'milestone'
                 )),
  emotion      text,
  phase        text
                 CHECK (phase IN ('beginning', 'building', 'struggling', 'rising')),
  impact_score int
                 CHECK (impact_score BETWEEN 1 AND 10),
  traits       text[],
  tags         text[],

  -- ── Processing flags ──────────────────────────────────────────
  guardian_processed boolean NOT NULL DEFAULT false,
  user_edited        boolean NOT NULL DEFAULT false,

  -- ── Phase 2: semantic search (requires pgvector) ──────────────
  embedding   vector(1536),

  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stones: owner full access"
  ON stones FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Core lookup indexes
CREATE INDEX idx_stones_user_id     ON stones (user_id);
CREATE INDEX idx_stones_journey_id  ON stones (journey_id);
CREATE INDEX idx_stones_happened_at ON stones (user_id, happened_at DESC);

-- Partial indexes (only index rows where column is populated)
CREATE INDEX idx_stones_moment_type ON stones (moment_type) WHERE moment_type IS NOT NULL;
CREATE INDEX idx_stones_phase       ON stones (phase)        WHERE phase IS NOT NULL;
CREATE INDEX idx_stones_unprocessed ON stones (user_id)      WHERE guardian_processed = false;

-- Array search (supports WHERE tags @> ARRAY['...'] and traits @> ARRAY['...'])
CREATE INDEX idx_stones_tags   ON stones USING GIN (tags)   WHERE tags   IS NOT NULL;
CREATE INDEX idx_stones_traits ON stones USING GIN (traits) WHERE traits IS NOT NULL;
