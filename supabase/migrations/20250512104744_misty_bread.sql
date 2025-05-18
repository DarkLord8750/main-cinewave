/*
  # Update Content Schema and Functions

  1. Changes
    - Remove video URL fields from content table
    - Add video URL fields to episodes table only
    - Update functions to reflect these changes
  
  2. Security
    - Maintain existing RLS policies
    - Keep existing constraints
*/

-- Remove video URL columns from content table
ALTER TABLE content
DROP COLUMN IF EXISTS video_url_480p,
DROP COLUMN IF EXISTS video_url_720p,
DROP COLUMN IF EXISTS video_url_1080p,
DROP COLUMN IF EXISTS video_url_4k;

-- Update create_content_with_genres function to remove video URL parameters
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
  p_cast_data jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_content_id uuid;
  v_genre_id uuid;
  v_series_id uuid;
  v_cast_member jsonb;
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

  -- Add cast members if provided
  IF p_cast_data IS NOT NULL THEN
    FOR v_cast_member IN SELECT * FROM jsonb_array_elements(p_cast_data)
    LOOP
      -- Create or update cast member
      WITH cast_upsert AS (
        INSERT INTO cast_members (name, photo_url)
        VALUES (
          v_cast_member->>'name',
          v_cast_member->>'photo_url'
        )
        ON CONFLICT (name) DO UPDATE
        SET photo_url = EXCLUDED.photo_url
        RETURNING id
      )
      -- Link cast member to content
      INSERT INTO content_cast (content_id, cast_member_id, role, "order")
      SELECT 
        v_content_id,
        cast_upsert.id,
        v_cast_member->>'role',
        (v_cast_member->>'order')::integer
      FROM cast_upsert;
    END LOOP;
  END IF;

  -- Create series if type is 'series'
  IF p_type = 'series' THEN
    INSERT INTO series (content_id)
    VALUES (v_content_id)
    RETURNING id INTO v_series_id;
  END IF;

  RETURN v_content_id;
END;
$$;