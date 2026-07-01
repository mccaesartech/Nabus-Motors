-- Vehicle image storage bucket (public read for website listings)
-- Create the bucket in Supabase Dashboard → Storage if this migration cannot run storage DDL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for listing photos
DROP POLICY IF EXISTS "Public read vehicle images" ON storage.objects;
CREATE POLICY "Public read vehicle images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

-- Service role uploads bypass RLS; this policy documents intended admin upload path.
DROP POLICY IF EXISTS "Service role upload vehicle images" ON storage.objects;
CREATE POLICY "Service role upload vehicle images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'vehicle-images');
