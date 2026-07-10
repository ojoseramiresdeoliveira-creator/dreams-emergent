-- ================================================================
-- Monument of Dreams — Phase 1 Patch
-- Run AFTER schema_phase1.sql is already applied.
-- ================================================================


-- ================================================================
-- PATCH 1: JOURNEYS — add columns the onboarding collects
-- All nullable and non-destructive; existing rows unaffected.
-- ================================================================

ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS name      text,
  ADD COLUMN IF NOT EXISTS timeframe text,
  ADD COLUMN IF NOT EXISTS values    text[];


-- ================================================================
-- PATCH 2: STONES — extend the type CHECK to include 'genesis'
--
-- ARCHITECTURE RULE (enforced in all future code):
--   type        = FORMAT   — what kind of record this stone is
--                            (reflection, photo, video, audio,
--                             milestone, genesis)
--   moment_type = MEANING  — what this moment meant in the journey
--                            (victory, defeat, restart, learning,
--                             fear, doubt, breakthrough, milestone)
--
-- The UI entry-type picker maps to moment_type, NOT to type.
-- App-layer translation table:
--   UI label "Reflection" → type='reflection',  moment_type=(Guardian-inferred)
--   UI label "Milestone"  → type='milestone',   moment_type='milestone'
--   UI label "Victory"    → type='reflection',  moment_type='victory'
--   UI label "Failure"    → type='reflection',  moment_type='defeat'  ← 'failure' in UI = 'defeat' in DB
--   UI label "Restart"    → type='reflection',  moment_type='restart'
-- ================================================================

ALTER TABLE stones
  DROP CONSTRAINT IF EXISTS stones_type_check;

ALTER TABLE stones
  ADD CONSTRAINT stones_type_check
    CHECK (type IN ('reflection', 'photo', 'video', 'audio', 'milestone', 'genesis'));


-- ================================================================
-- PATCH 3: MENTOR_MESSAGES — Guardian conversation history
--
-- ARCHITECTURE RULE (enforced in all future schema):
--   Stones    = immutable TRUTH recorded by the user (what happened).
--   Guardian tables (mentor_messages, and future: insights, chapters,
--   patterns, embeddings) = INTERPRETATION by the Guardian (what it
--   sees, says, and infers). Guardian interpretation NEVER lives
--   inside stones columns.
--
-- role CHECK uses 'guardian' (not 'assistant') to match the product
-- language. The app layer maps LLM role='assistant' → 'guardian'
-- before insert, and 'guardian' → 'assistant' when building LLM
-- message arrays.
-- ================================================================

CREATE TABLE IF NOT EXISTS mentor_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id  uuid        REFERENCES journeys(id) ON DELETE CASCADE,  -- nullable: pre-journey messages allowed
  role        text        NOT NULL
                CHECK (role IN ('user', 'guardian')),
  content     text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mentor_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mentor_messages: owner full access"
  ON mentor_messages FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mentor_messages_user_created
  ON mentor_messages (user_id, created_at DESC);
