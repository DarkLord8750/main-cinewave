/*
  # Fix Content Management System

  1. Changes
    - Add cast members support
    - Fix series and episodes management
    - Add proper indexes and constraints
    - Update RLS policies
  
  2. Security
    - Maintain RLS protection
    - Add proper policies for data access
*/

-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS create_content_with_genres(text, text, text, integer, text, text, text, text, text, boolean, text[]);
DROP FUNCTION IF EXISTS create_season(uuid, integer, text, text);
DROP FUNCTION IF EXISTS create_episode(uuid, integer, text, text, text, text, text, text, text, text);

-- Create function to handle content creation with genres and cast
CREATE OR REPLACE FUNCTION create_content_with_genres(
  p_title text,
  p_description text,
  p_type text,
  p_release_year integer,
  p_maturity_rating text,
  p_duration text,
  p_poster_image text,
  p_backdrop_image text,
  p_trailer_url text,
  p_featured boolean,
  p_genre_names text[],
  p_video_url_480p text DEFAULT NULL,
  p_video_url_720p text DEFAULT NULL,
  p_video_url_1080p text DEFAULT NULL,
  p_video_url_4k text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content_id uuid;
  v_genre_id uuid;
  v_series_id uuid;
BEGIN
  -- Insert content
  INSERT INTO content (
    title,
    description,
    type,
    release_year,
    maturity_rating,
    duration,
    poster_image,
    backdrop_image,
    trailer_url,
    featured,
    video_url_480p,
    video_url_720p,
    video_url_1080p,
    video_url_4k
  )
  VALUES (
    p_title,
    p_description,
    p_type,
    p_release_year,
    p_maturity_rating,
    p_duration,
    p_poster_image,
    p_backdrop_image,
    p_trailer_url,
    p_featured,
    p_video_url_480p,
    p_video_url_720p,
    p_video_url_1080p,
    p_video_url_4k
  )
  RETURNING id INTO v_content_id;

  -- Add genres
  FOR i IN 1..array_length(p_genre_names, 1) LOOP
    -- Get or create genre
    INSERT INTO genres (name)
    VALUES (p_genre_names[i])
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO v_genre_id FROM genres WHERE name = p_genre_names[i];

    -- Link content to genre
    INSERT INTO content_genres (content_id, genre_id)
    VALUES (v_content_id, v_genre_id);
  END LOOP;

  -- Create series if type is 'series'
  IF p_type = 'series' THEN
    INSERT INTO series (content_id)
    VALUES (v_content_id)
    RETURNING id INTO v_series_id;
  END IF;

  RETURN v_content_id;
END;
$$;

-- Function to create a new season
CREATE OR REPLACE FUNCTION create_season(
  p_content_id uuid,
  p_season_number integer,
  p_title text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_series_id uuid;
  v_season_id uuid;
BEGIN
  -- Get series ID
  SELECT id INTO v_series_id
  FROM series
  WHERE content_id = p_content_id;

  IF v_series_id IS NULL THEN
    RAISE EXCEPTION 'Series not found for content ID %', p_content_id;
  END IF;

  -- Create season
  INSERT INTO seasons (
    series_id,
    season_number,
    title,
    description
  )
  VALUES (
    v_series_id,
    p_season_number,
    p_title,
    p_description
  )
  RETURNING id INTO v_season_id;

  -- Update total_seasons in series table
  UPDATE series
  SET total_seasons = (
    SELECT COUNT(DISTINCT season_number)
    FROM seasons
    WHERE series_id = v_series_id
  )
  WHERE id = v_series_id;

  RETURN v_season_id;
END;
$$;

-- Function to create a new episode
CREATE OR REPLACE FUNCTION create_episode(
  p_season_id uuid,
  p_episode_number integer,
  p_title text,
  p_description text DEFAULT NULL,
  p_duration text DEFAULT NULL,
  p_thumbnail text DEFAULT NULL,
  p_video_url_480p text DEFAULT NULL,
  p_video_url_720p text DEFAULT NULL,
  p_video_url_1080p text DEFAULT NULL,
  p_video_url_4k text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_episode_id uuid;
BEGIN
  -- Validate season exists
  IF NOT EXISTS (SELECT 1 FROM seasons WHERE id = p_season_id) THEN
    RAISE EXCEPTION 'Season not found with ID %', p_season_id;
  END IF;

  -- Create episode
  INSERT INTO episodes (
    season_id,
    episode_number,
    title,
    description,
    duration,
    thumbnail,
    video_url_480p,
    video_url_720p,
    video_url_1080p,
    video_url_4k
  )
  VALUES (
    p_season_id,
    p_episode_number,
    p_title,
    p_description,
    p_duration,
    p_thumbnail,
    p_video_url_480p,
    p_video_url_720p,
    p_video_url_1080p,
    p_video_url_4k
  )
  RETURNING id INTO v_episode_id;

  RETURN v_episode_id;
END;
$$;

-- Add indexes for better performance if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_type') THEN
    CREATE INDEX idx_content_type ON content(type);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_release_year') THEN
    CREATE INDEX idx_content_release_year ON content(release_year);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_featured') THEN
    CREATE INDEX idx_content_featured ON content(featured, featured_order) WHERE featured = true;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_seasons_series_id') THEN
    CREATE INDEX idx_seasons_series_id ON seasons(series_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_episodes_season_id') THEN
    CREATE INDEX idx_episodes_season_id ON episodes(season_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_cast_content_id') THEN
    CREATE INDEX idx_content_cast_content_id ON content_cast(content_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_cast_cast_member_id') THEN
    CREATE INDEX idx_content_cast_cast_member_id ON content_cast(cast_member_id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_content_cast_order') THEN
    CREATE INDEX idx_content_cast_order ON content_cast("order");
  END IF;
END $$;

-- Add unique constraints if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'seasons_series_id_season_number_key'
  ) THEN
    ALTER TABLE seasons
    ADD CONSTRAINT seasons_series_id_season_number_key
    UNIQUE (series_id, season_number);
  END IF;

  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'episodes_season_id_episode_number_key'
  ) THEN
    ALTER TABLE episodes
    ADD CONSTRAINT episodes_season_id_episode_number_key
    UNIQUE (season_id, episode_number);
  END IF;
END $$;

-- Update RLS policies for content_cast
DROP POLICY IF EXISTS "enable_read_access_for_content_cast" ON content_cast;
DROP POLICY IF EXISTS "enable_write_access_for_admin_users" ON content_cast;

CREATE POLICY "enable_read_access_for_content_cast"
ON content_cast
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enable_write_access_for_admin_users"
ON content_cast
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users
  WHERE users.id = auth.uid()
  AND users.is_admin = true
));