-- Enterprise account deletion lifecycle (soft delete + retention + anonymization).
-- Extends migration 068 hard-delete with a recoverable pending-deletion flow.

-- ---------------------------------------------------------------------------
-- Schema: profile lifecycle columns
-- ---------------------------------------------------------------------------

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS anonymized_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_anonymized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deletion_feedback JSONB,
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_account_status_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_account_status_check
  CHECK (
    account_status IN (
      'active',
      'suspended',
      'pending_deletion',
      'archived',
      'deleted'
    )
  );

CREATE INDEX IF NOT EXISTS idx_profiles_account_status
  ON profiles (account_status);

CREATE INDEX IF NOT EXISTS idx_profiles_pending_deletion
  ON profiles (retention_expires_at)
  WHERE account_status = 'pending_deletion';

COMMENT ON COLUMN profiles.account_status IS
  'Customer account lifecycle: active, suspended, pending_deletion, archived, deleted.';

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_lifecycle_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  user_id UUID,
  administrator_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
  ip_address INET,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_account_lifecycle_audit_user
  ON account_lifecycle_audit_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_lifecycle_audit_action
  ON account_lifecycle_audit_log (action, created_at DESC);

ALTER TABLE account_lifecycle_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages account lifecycle audit" ON account_lifecycle_audit_log;
CREATE POLICY "Service role manages account lifecycle audit"
  ON account_lifecycle_audit_log FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Rate limiting for deletion requests
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS account_deletion_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_attempts_user
  ON account_deletion_attempts (user_id, attempted_at DESC);

ALTER TABLE account_deletion_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages deletion attempts" ON account_deletion_attempts;
CREATE POLICY "Service role manages deletion attempts"
  ON account_deletion_attempts FOR ALL USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anonymized_customer_ref(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 'deleted_user_' || replace(p_user_id::text, '-', '');
$$;

CREATE OR REPLACE FUNCTION public.anonymized_customer_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT anonymized_customer_ref(p_user_id) || '@deleted.truegoshen.local';
$$;

CREATE OR REPLACE FUNCTION public.log_account_lifecycle_event(
  p_action TEXT,
  p_user_id UUID,
  p_administrator_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO account_lifecycle_audit_log (
    action,
    user_id,
    administrator_id,
    ip_address,
    metadata
  ) VALUES (
    p_action,
    p_user_id,
    p_administrator_id,
    p_ip_address,
    COALESCE(p_metadata, '{}'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Immediate personal data purge (on deletion request)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.purge_customer_personal_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  -- Messaging
  DELETE FROM customer_conversation_messages
  WHERE conversation_id IN (
    SELECT id FROM customer_conversations WHERE user_id = p_user_id
  );
  DELETE FROM customer_conversations WHERE user_id = p_user_id;
  DELETE FROM customer_messages WHERE user_id = p_user_id;

  -- Cart
  DELETE FROM cart_items
  WHERE cart_id IN (SELECT id FROM customer_carts WHERE user_id = p_user_id);
  DELETE FROM customer_carts WHERE user_id = p_user_id;

  -- Notifications, saved vehicles, alerts
  DELETE FROM customer_notifications WHERE user_id = p_user_id;
  DELETE FROM saved_vehicles WHERE user_id = p_user_id;

  IF v_email_lower IS NOT NULL AND v_email_lower <> '' THEN
    DELETE FROM vehicle_availability_notifications
    WHERE lower(trim(email)) = v_email_lower;

    DELETE FROM vehicle_interest
    WHERE user_id = p_user_id
       OR lower(trim(coalesce(email, ''))) = v_email_lower;

    DELETE FROM price_alerts
    WHERE user_id = p_user_id
       OR lower(trim(email)) = v_email_lower;

    DELETE FROM newsletter_subscribers
    WHERE lower(trim(email)) = v_email_lower;
  ELSE
    DELETE FROM vehicle_interest WHERE user_id = p_user_id;
    DELETE FROM price_alerts WHERE user_id = p_user_id;
  END IF;

  -- Clear personal settings on profile (row kept for lifecycle)
  UPDATE profiles
  SET
    vehicle_preferences = NULL,
    session_preference = NULL,
    whatsapp_opt_in = FALSE,
    updated_at = NOW()
  WHERE id = p_user_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Anonymize PII on business records (retained for integrity)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.anonymize_customer_business_pii(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref TEXT;
  v_anon_email TEXT;
  v_email_lower TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  v_ref := anonymized_customer_ref(p_user_id);
  v_anon_email := anonymized_customer_email(p_user_id);

  SELECT lower(trim(email))
  INTO v_email_lower
  FROM profiles
  WHERE id = p_user_id;

  IF v_email_lower IS NULL OR v_email_lower = '' THEN
    SELECT lower(trim(email))
    INTO v_email_lower
    FROM auth.users
    WHERE id = p_user_id;
  END IF;

  -- Parts orders
  UPDATE parts_orders
  SET
    email = v_anon_email,
    customer_name = v_ref,
    phone = NULL,
    shipping_address = NULL,
    notes = CASE
      WHEN notes IS NOT NULL THEN '[anonymized] ' || left(notes, 200)
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  -- Pre-orders and inquiries
  UPDATE preorder_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE
      WHEN message IS NOT NULL THEN '[anonymized]'
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE freight_quote_requests
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    cargo_description = CASE
      WHEN cargo_description IS NOT NULL THEN '[anonymized]'
      ELSE NULL
    END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE finance_applications
  SET
    email = v_anon_email,
    first_name = 'Deleted',
    last_name = 'User',
    phone = v_ref,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE vehicle_appointments
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower);

  UPDATE shipment_tracking
  SET
    customer_email = v_anon_email,
    customer_name = v_ref,
    customer_phone = NULL,
    notes = CASE WHEN notes IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE user_id = p_user_id
     OR (v_email_lower IS NOT NULL AND lower(trim(coalesce(customer_email, ''))) = v_email_lower);

  UPDATE contact_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE WHEN message IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower;

  UPDATE vehicle_inquiries
  SET
    email = v_anon_email,
    name = v_ref,
    phone = NULL,
    message = CASE WHEN message IS NOT NULL THEN '[anonymized]' ELSE NULL END
  WHERE v_email_lower IS NOT NULL AND lower(trim(email)) = v_email_lower;

  -- Profile row (keep registration_id for business cross-reference)
  UPDATE profiles
  SET
    first_name = 'Deleted',
    last_name = 'User',
    phone = NULL,
    email = v_anon_email,
    is_anonymized = TRUE,
    anonymized_at = COALESCE(anonymized_at, NOW()),
    updated_at = NOW()
  WHERE id = p_user_id;

  IF v_email_lower IS NOT NULL AND v_email_lower <> '' THEN
    INSERT INTO deleted_customer_emails (email, deleted_by)
    VALUES (v_email_lower, 'account_lifecycle')
    ON CONFLICT (email) DO UPDATE
    SET deleted_at = NOW(), deleted_by = EXCLUDED.deleted_by;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Request soft deletion (primary customer path)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_account_deletion(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_feedback JSONB DEFAULT NULL,
  p_retention_days INTEGER DEFAULT 30,
  p_ip_address INET DEFAULT NULL
)
RETURNS TABLE (
  retention_expires_at TIMESTAMPTZ,
  scheduled_deletion_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_days INTEGER;
  v_expires TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  v_days := GREATEST(COALESCE(p_retention_days, 30), 1);

  SELECT account_status
  INTO v_status
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  IF v_status = 'pending_deletion' THEN
    RAISE EXCEPTION 'Account deletion is already pending';
  END IF;

  IF v_status IN ('archived', 'deleted') THEN
    RAISE EXCEPTION 'Account has already been deleted';
  END IF;

  v_expires := v_now + make_interval(days => v_days);

  PERFORM purge_customer_personal_data(p_user_id);

  UPDATE profiles
  SET
    account_status = 'pending_deletion',
    deletion_requested_at = v_now,
    scheduled_deletion_at = v_expires,
    retention_expires_at = v_expires,
    deletion_reason = NULLIF(trim(p_reason), ''),
    deletion_feedback = p_feedback,
    updated_at = v_now
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    'deletion_requested',
    p_user_id,
    NULL,
    p_ip_address,
    jsonb_build_object(
      'reason', p_reason,
      'retention_days', v_days,
      'retention_expires_at', v_expires
    )
  );

  retention_expires_at := v_expires;
  scheduled_deletion_at := v_expires;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancel pending deletion (within retention)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_account_deletion(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_administrator_id UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  SELECT account_status, retention_expires_at
  INTO v_status, v_expires
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS DISTINCT FROM 'pending_deletion' THEN
    RAISE EXCEPTION 'No pending deletion to cancel';
  END IF;

  IF v_expires IS NOT NULL AND v_expires < NOW() THEN
    RAISE EXCEPTION 'Retention period has expired';
  END IF;

  UPDATE profiles
  SET
    account_status = 'active',
    deletion_requested_at = NULL,
    scheduled_deletion_at = NULL,
    retention_expires_at = NULL,
    deletion_reason = NULL,
    deletion_feedback = NULL,
    updated_at = NOW()
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    CASE WHEN p_administrator_id IS NULL THEN 'deletion_cancelled' ELSE 'account_restored' END,
    p_user_id,
    p_administrator_id,
    p_ip_address,
    '{}'::jsonb
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Final anonymization after retention (or admin-triggered)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.execute_account_anonymization(
  p_user_id UUID,
  p_administrator_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id is required';
  END IF;

  PERFORM anonymize_customer_business_pii(p_user_id);

  UPDATE profiles
  SET
    account_status = 'archived',
    deleted_at = COALESCE(deleted_at, v_now),
    is_anonymized = TRUE,
    anonymized_at = COALESCE(anonymized_at, v_now),
    updated_at = v_now
  WHERE id = p_user_id;

  PERFORM log_account_lifecycle_event(
    'personal_data_anonymized',
    p_user_id,
    p_administrator_id,
    p_ip_address,
    jsonb_build_object('finalized_at', v_now)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Batch: process accounts past retention
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.process_expired_deletions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_row IN
    SELECT id
    FROM profiles
    WHERE account_status = 'pending_deletion'
      AND retention_expires_at IS NOT NULL
      AND retention_expires_at < NOW()
    ORDER BY retention_expires_at ASC
    LIMIT 200
  LOOP
    PERFORM execute_account_anonymization(v_row.id, NULL, NULL);

    PERFORM log_account_lifecycle_event(
      'retention_expired',
      v_row.id,
      NULL,
      NULL,
      jsonb_build_object('processed_at', NOW())
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Deprecate 068 hard-delete: route through lifecycle final step
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_customer_account_data(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Legacy entry point — now performs anonymization instead of hard delete.
  PERFORM execute_account_anonymization(p_user_id, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.log_account_lifecycle_event(TEXT, UUID, UUID, INET, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_customer_personal_data(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.anonymize_customer_business_pii(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.request_account_deletion(UUID, TEXT, JSONB, INTEGER, INET) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_account_deletion(UUID, INET, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.execute_account_anonymization(UUID, UUID, INET) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_expired_deletions() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.log_account_lifecycle_event(TEXT, UUID, UUID, INET, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.purge_customer_personal_data(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.anonymize_customer_business_pii(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(UUID, TEXT, JSONB, INTEGER, INET) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion(UUID, INET, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.execute_account_anonymization(UUID, UUID, INET) TO service_role;
GRANT EXECUTE ON FUNCTION public.process_expired_deletions() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_customer_account_data(UUID) TO service_role;

COMMENT ON FUNCTION public.request_account_deletion IS
  'Soft-delete customer account: purge personal data, set pending_deletion with retention window.';
COMMENT ON FUNCTION public.cancel_account_deletion IS
  'Cancel a pending account deletion within the retention period.';
COMMENT ON FUNCTION public.execute_account_anonymization IS
  'Anonymize retained business records and mark account archived.';
COMMENT ON FUNCTION public.process_expired_deletions IS
  'Daily job: finalize accounts whose retention period has expired.';
COMMENT ON FUNCTION public.delete_customer_account_data IS
  'Deprecated hard-delete — now delegates to execute_account_anonymization.';
