/*
  # Add Video Quality URLs to Content Table

  1. Changes
    - Add columns for different video quality URLs
    - Update content table structure
    - Add check constraints for valid URLs
  
  2. Security
    - Maintain existing RLS policies
    - Add validation for URL formats
*/

-- Add video quality URL columns to content table
ALTER TABLE content
ADD COLUMN video_url_480p text,
ADD COLUMN video_url_720p text,
ADD COLUMN video_url_1080p text,
ADD COLUMN video_url_4k text;

-- Add check constraints for URL format validation
ALTER TABLE content
ADD CONSTRAINT video_url_480p_check CHECK (video_url_480p IS NULL OR video_url_480p ~ '^https?://.*$'),
ADD CONSTRAINT video_url_720p_check CHECK (video_url_720p IS NULL OR video_url_720p ~ '^https?://.*$'),
ADD CONSTRAINT video_url_1080p_check CHECK (video_url_1080p IS NULL OR video_url_1080p ~ '^https?://.*$'),
ADD CONSTRAINT video_url_4k_check CHECK (video_url_4k IS NULL OR video_url_4k ~ '^https?://.*$');

-- Update the create_content_with_genres function to include video URLs
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
BEGIN
  -- Insert content with video URLs
  INSERT INTO content (
    title, description, type, release_year, maturity_rating,
    duration, poster_image, backdrop_image, trailer_url, featured,
    video_url_480p, video_url_720p, video_url_1080p, video_url_4k
  )
  VALUES (
    p_title, p_description, p_type, p_release_year, p_maturity_rating,
    p_duration, p_poster_image, p_backdrop_image, p_trailer_url, p_featured,
    p_video_url_480p, p_video_url_720p, p_video_url_1080p, p_video_url_4k
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
    VALUES (v_content_id);
  END IF;

  RETURN v_content_id;
END;
$$;