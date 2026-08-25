-- Enterprise maintenance mode audit keys (site_settings key-value store).
-- Soft-fail safe: app defaults if these keys are missing during rollout.
--
-- Existing keys (from 034_platform_settings_expand.sql):
--   maintenance_mode, maintenance_message
--
-- This migration adds who/when metadata for enable/disable events.
-- Activity detail also goes to platform_activity_log from the settings API.

INSERT INTO site_settings (key, value) VALUES
  ('maintenance_mode', 'false'),
  (
    'maintenance_message',
    'We are performing scheduled maintenance. Some features may be temporarily unavailable.'
  ),
  ('maintenance_enabled_by', ''),
  ('maintenance_enabled_at', ''),
  ('maintenance_disabled_by', ''),
  ('maintenance_disabled_at', ''),
  ('maintenance_updated_by', ''),
  ('maintenance_updated_at', '')
ON CONFLICT (key) DO NOTHING;

-- Keep public read of the visitor-facing flags (policy recreate is idempotent).
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
      'freight_cargo_options',
      'feature_show_spare_parts_nav',
      'feature_show_freight_nav',
      'appointment_branches',
      'phone',
      'email',
      'whatsapp_number',
      'company_name',
      'hours_weekday',
      'hours_saturday',
      'hours_sunday'
    )
  );

COMMENT ON TABLE site_settings IS
  'Key-value operational settings. Maintenance: maintenance_mode, maintenance_message, maintenance_*_by/at audit keys.';
