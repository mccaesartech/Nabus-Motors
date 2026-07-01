-- Backend connection verify: public read policies for operational settings
-- Required when the anon Supabase client reads site_settings (pre-order form, layout flags).
-- Server routes may also use the service role; this policy keeps direct anon reads working.

DROP POLICY IF EXISTS "Public operational site_settings are readable" ON site_settings;
CREATE POLICY "Public operational site_settings are readable"
  ON site_settings FOR SELECT
  USING (
    key IN (
      'clearing_fee_notice',
      'preorder_terms_a',
      'preorder_terms_b',
      'preorder_terms_c',
      'maintenance_mode',
      'maintenance_message',
      'freight_default_origins',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

-- Verify core backend tables exist (no-op if already present from earlier migrations)
CREATE TABLE IF NOT EXISTS site_content (
  section TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
