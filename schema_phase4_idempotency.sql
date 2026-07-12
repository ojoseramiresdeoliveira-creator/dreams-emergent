-- ================================================================
-- Monument of Dreams — Phase 4: Stone creation idempotency
-- Run AFTER schema_phase3_guardian.sql.
--
-- HOW TO RUN: paste this ENTIRE file into the Supabase SQL Editor
-- with NOTHING selected, then Run once. Idempotent: safe to re-run.
--
-- WHY: a client-side timeout does not cancel the server-side INSERT.
-- The client now sends a client_ref (uuid, generated when the form is
-- filled); a retry of the same submission reuses the same ref, and the
-- unique index below makes the duplicate structurally impossible —
-- the API returns the already-created stone instead.
--
-- client_ref is request metadata (mechanical), not interpretation:
-- it is written once at INSERT time by the user's own request, never
-- touched afterwards. Stones remain immutable.
-- ================================================================

ALTER TABLE stones ADD COLUMN IF NOT EXISTS client_ref uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stones_user_client_ref
  ON stones (user_id, client_ref)
  WHERE client_ref IS NOT NULL;

-- Verify with:
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'stones' AND column_name = 'client_ref';   → 1 row
-- SELECT indexname FROM pg_indexes
--   WHERE indexname = 'idx_stones_user_client_ref';               → 1 row
