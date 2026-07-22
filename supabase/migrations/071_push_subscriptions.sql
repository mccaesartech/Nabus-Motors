-- Web Push subscription storage (VAPID delivery prepared; no sender wired yet)

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  platform_user_id UUID REFERENCES platform_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  expiration_time BIGINT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_subscriptions_subject_check CHECK (
    (role = 'customer' AND customer_user_id IS NOT NULL AND platform_user_id IS NULL)
    OR (role = 'admin' AND platform_user_id IS NOT NULL AND customer_user_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer
  ON push_subscriptions(customer_user_id)
  WHERE customer_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_platform
  ON push_subscriptions(platform_user_id)
  WHERE platform_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role
  ON push_subscriptions(role);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "No public access to push subscriptions" ON push_subscriptions;
CREATE POLICY "No public access to push subscriptions"
  ON push_subscriptions FOR ALL USING (false) WITH CHECK (false);
