-- =============================================================================
-- 098 - Staff WhatsApp assist conversation history (outbound staff sends)
-- =============================================================================
-- DO NOT apply remotely from CI/agent - run in the Supabase SQL Editor after review.
--
-- Stores messages staff send via Platform → WhatsApp Assist (API or wa.me fallback).
-- Used for follow-up context in AI suggestions; not a full WhatsApp Business inbox.
--
-- Reversal:
--   DROP TABLE IF EXISTS public.staff_whatsapp_messages;
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.staff_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  customer_user_id TEXT,
  customer_email TEXT,
  customer_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound')),
  body TEXT NOT NULL,
  staff_user_id TEXT,
  staff_is_owner BOOLEAN NOT NULL DEFAULT false,
  staff_name TEXT,
  context_type TEXT,
  context_id TEXT,
  send_method TEXT
    CHECK (send_method IS NULL OR send_method IN ('api', 'wa_me')),
  provider_message_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.staff_whatsapp_messages IS
  'Outbound WhatsApp messages sent by platform staff via WhatsApp Assist (reviewed before send).';

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_phone_created
  ON public.staff_whatsapp_messages (customer_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_user_created
  ON public.staff_whatsapp_messages (customer_user_id, created_at DESC)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staff_whatsapp_messages_email_created
  ON public.staff_whatsapp_messages (customer_email, created_at DESC)
  WHERE customer_email IS NOT NULL;

ALTER TABLE public.staff_whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No client access staff_whatsapp_messages" ON public.staff_whatsapp_messages;
CREATE POLICY "No client access staff_whatsapp_messages"
  ON public.staff_whatsapp_messages
  FOR ALL
  USING (false)
  WITH CHECK (false);
