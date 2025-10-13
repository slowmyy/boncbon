/*
  # Create videos storage bucket and table

  1. Storage Bucket
    - Create a public bucket 'videos' for storing generated videos
    - Enable public access for reading videos
    
  2. New Table
    - `videos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, optional for future auth)
      - `prompt` (text)
      - `model` (text)
      - `duration` (integer)
      - `width` (integer)
      - `height` (integer)
      - `storage_path` (text) - path in Supabase storage
      - `public_url` (text) - public URL for the video
      - `created_at` (timestamptz)
      - `metadata` (jsonb) - for additional data
  
  3. Security
    - Enable RLS on videos table
    - Add policy for public read access (since auth is optional)
    - Add policy for insert (public for now)
*/

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  prompt text NOT NULL,
  model text NOT NULL DEFAULT 'sora-2',
  duration integer NOT NULL DEFAULT 5,
  width integer NOT NULL DEFAULT 1920,
  height integer NOT NULL DEFAULT 1080,
  storage_path text NOT NULL,
  public_url text NOT NULL,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read videos (public access)
CREATE POLICY "Public can view videos"
  ON videos
  FOR SELECT
  TO public
  USING (true);

-- Policy: Anyone can insert videos (for now, without auth)
CREATE POLICY "Public can insert videos"
  ON videos
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Policy: Users can delete their own videos (future-proof)
CREATE POLICY "Users can delete own videos"
  ON videos
  FOR DELETE
  TO public
  USING (true);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  104857600, -- 100MB limit
  ARRAY['video/mp4', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Anyone can read from videos bucket
CREATE POLICY "Public can read videos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'videos');

-- Storage policy: Anyone can upload to videos bucket
CREATE POLICY "Public can upload videos"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'videos');

-- Storage policy: Anyone can delete from videos bucket (for cleanup)
CREATE POLICY "Public can delete videos"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'videos');

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS videos_model_idx ON videos(model);
