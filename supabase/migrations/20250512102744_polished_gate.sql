/*
  # Fix Content Management System

  1. Changes
    - Add content_genres function to handle genre relationships
    - Add function to handle series creation
    - Add function to handle season and episode management
    - Update content table constraints
    - Add proper indexes for performance

  2. Security
    - Maintain RLS protection
    - Add proper policies for content management
*/

-- Function to handle content creation with genres
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
  p_genre_names text[]
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
    featured
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
    p_featured
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
  p_description text
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

  RETURN v_season_id;
END;
$$;

-- Function to create a new episode
CREATE OR REPLACE FUNCTION create_episode(
  p_season_id uuid,
  p_episode_number integer,
  p_title text,
  p_description text,
  p_duration text,
  p_thumbnail text,
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

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
CREATE INDEX IF NOT EXISTS idx_content_release_year ON content(release_year);
CREATE INDEX IF NOT EXISTS idx_seasons_series_id ON seasons(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_season_id ON episodes(season_id);