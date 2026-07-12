-- ================================================================
-- Monument of Dreams — Phase 2 Hardening
-- Run AFTER schema_phase1.sql and schema_phase1_patch.sql,
-- and BEFORE schema_phase3_guardian.sql.
--
-- HOW TO RUN: paste this ENTIRE file into the Supabase SQL Editor
-- with NOTHING selected (a text selection makes the editor run only
-- the selection), then Run once. The whole file executes as a single
-- transaction: it either fully succeeds or fully rolls back.
-- Idempotent: safe to run again.
--
-- The app works without this file (it has app-level fallbacks), but
-- these guarantees only become airtight once it is applied.
-- ================================================================


-- ================================================================
-- HARDENING 0: Safety cleanup before the unique index
-- If any user somehow has more than one primary journey (possible for
-- rows created before the Phase 1 fix), keep only the OLDEST one as
-- primary — exactly what the API's journeys/me endpoint returns — and
-- demote the rest. Deterministic tiebreak on id for equal timestamps.
-- No-op when there are no duplicates.
-- ================================================================

WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM journeys
  WHERE is_primary = true
)
UPDATE journeys
SET is_primary = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);


-- ================================================================
-- HARDENING 1: One primary journey per user (DB-enforced)
-- The API also checks this, but only the index makes it race-proof.
-- ================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_journeys_one_primary_per_user
  ON journeys (user_id)
  WHERE is_primary = true;


-- ================================================================
-- HARDENING 2: Index for the main stone read pattern
-- GET /api/entries filters by journey_id and orders by happened_at DESC.
-- ================================================================

CREATE INDEX IF NOT EXISTS idx_stones_journey_happened
  ON stones (journey_id, happened_at DESC);


-- ================================================================
-- HARDENING 3: Transactional Journey + Genesis creation
--
-- SECURITY INVOKER + auth.uid(): runs as the calling (authenticated)
-- user, so RLS policies apply inside the function. Either both rows
-- are created or neither is.
--
-- The API calls this via rpc('create_journey_with_genesis', ...) and
-- falls back to insert+compensating-delete if the function is absent.
-- The moment this function exists, the app upgrades itself to the
-- transactional path automatically — no deploy needed.
-- ================================================================

CREATE OR REPLACE FUNCTION create_journey_with_genesis(
  p_name         text,
  p_title        text,
  p_why          text,
  p_timeframe    text,
  p_values       text[],
  p_genesis_body text
)
RETURNS journeys
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_journey journeys;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  INSERT INTO journeys (user_id, name, title, why, timeframe, values, is_primary, status, phase)
  VALUES (
    v_user_id, p_name, p_title, p_why, p_timeframe, p_values,
    NOT EXISTS (SELECT 1 FROM journeys WHERE user_id = v_user_id AND is_primary = true),
    'active', 'beginning'
  )
  RETURNING * INTO v_journey;

  -- Genesis stone: type = FORMAT ('genesis'). Same transaction — if this
  -- fails, the journey insert above rolls back too.
  INSERT INTO stones (user_id, journey_id, type, title, body, happened_at)
  VALUES (v_user_id, v_journey.id, 'genesis', 'The first stone was laid', p_genesis_body, now());

  RETURN v_journey;
END;
$$;

REVOKE ALL ON FUNCTION create_journey_with_genesis(text, text, text, text, text[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_journey_with_genesis(text, text, text, text, text[], text) TO authenticated;


-- ================================================================
-- DONE. Verify with:
--
-- SELECT
--   (SELECT count(*) FROM pg_indexes
--     WHERE indexname = 'idx_journeys_one_primary_per_user') AS has_unique_index,
--   (SELECT count(*) FROM pg_indexes
--     WHERE indexname = 'idx_stones_journey_happened')       AS has_stone_index,
--   (SELECT count(*) FROM pg_proc
--     WHERE proname = 'create_journey_with_genesis')         AS has_function;
--   → expect 1, 1, 1
--
-- SELECT user_id, count(*) FROM journeys
--   WHERE is_primary = true GROUP BY user_id HAVING count(*) > 1;
--   → expect zero rows (no duplicate primaries remain)
-- ================================================================
