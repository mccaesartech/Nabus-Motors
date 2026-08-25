-- =============================================================================
-- 095 - Inventory AI usage history (Gemini chat, vision, image edits, stock photos)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Design:
--   - Application reads/writes via service role (RLS denies clients).
--   - Soft-delete via deleted_at (staff/managers can discard from default views).
--   - Permanent purge is gated in the platform API (owner / super_admin / administrator).
--
-- Reversal:
--   DROP TABLE IF EXISTS public.ai_usage_logs;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  actor_user_id TEXT,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success'
    CHECK (status IN ('success', 'error', 'partial')),
  vehicle_id TEXT,
  vehicle_slug TEXT,
  vehicle_label TEXT,
  preview_snippet TEXT,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.ai_usage_logs IS
  'Inventory AI usage history (chat, vision, image adjust, stock photos). Soft-deletable; permanent purge via service role API.';

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at
  ON public.ai_usage_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_vehicle_id
  ON public.ai_usage_logs (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_action
  ON public.ai_usage_logs (action);

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_deleted_at
  ON public.ai_usage_logs (deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_actor_user_id
  ON public.ai_usage_logs (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access ai_usage_logs" ON public.ai_usage_logs;
CREATE POLICY "No client access ai_usage_logs"
  ON public.ai_usage_logs
  FOR ALL
  USING (false)
  WITH CHECK (false);