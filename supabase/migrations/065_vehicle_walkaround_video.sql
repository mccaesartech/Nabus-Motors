-- Optional walkaround video URL for vehicle detail page

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS walkaround_video_url TEXT;

COMMENT ON COLUMN vehicles.walkaround_video_url IS
  'Optional YouTube, Vimeo, or direct MP4 URL shown as walkaround video on vehicle detail';
