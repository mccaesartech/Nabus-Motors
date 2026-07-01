-- Site content CMS: structured JSON per public page section

CREATE TABLE IF NOT EXISTS site_content (
  section TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_content_deny_all" ON site_content;
CREATE POLICY "site_content_deny_all" ON site_content
  FOR ALL USING (false) WITH CHECK (false);
