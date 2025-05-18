-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS create_content_with_genres(text, text, text, integer, text, text, text, text, text, boolean, text[], jsonb, text, text, text, text);
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