-- Termii notification settings defaults and SMS channel in notification_log.

INSERT INTO site_settings (key, value) VALUES
  ('termii_api_key', ''),
  ('termii_sender_id', ''),
  ('termii_whatsapp_device', ''),
  ('termii_base_url', 'https://api.ng.termii.com'),
  ('termii_sms_channel', 'dnd')
ON CONFLICT (key) DO NOTHING;

-- Allow SMS channel in delivery log (Termii fallback).
ALTER TABLE notification_log DROP CONSTRAINT IF EXISTS notification_log_channel_check;
ALTER TABLE notification_log ADD CONSTRAINT notification_log_channel_check
  CHECK (channel IN ('whatsapp', 'email', 'sms'));
