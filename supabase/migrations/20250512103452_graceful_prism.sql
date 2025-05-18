-- Drop existing functions to recreate them
DROP FUNCTION IF EXISTS create_content_with_genres(text, text, text, integer, text, text, text, text, text, boolean, text[]);
DROP FUNCTION IF EXISTS create_season(uuid, integer, text, text);
DROP FUNCTION IF EXISTS create_episode(uuid, integer, text, text, text, text, text, text, text, text);

-- Enable RLS on all tables
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cast ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "content_read_access" ON content;
DROP POLICY IF EXISTS "content_write_access" ON content;
DROP POLICY IF EXISTS "series_read_access" ON series;
DROP POLICY IF EXISTS "series_write_access" ON series;
DROP POLICY IF EXISTS "seasons_read_access" ON seasons;
DROP POLICY IF EXISTS "seasons_write_access" ON seasons;
DROP POLICY IF EXISTS "episodes_read_access" ON episodes;
DROP POLICY IF EXISTS "episodes_write_access" ON episodes;
DROP POLICY IF EXISTS "content_genres_read_access" ON content_genres;
DROP POLICY IF EXISTS "content_genres_write_access" ON content_genres;
DROP POLICY IF EXISTS "content_cast_read_access" ON content_cast;
DROP POLICY IF EXISTS "content_cast_write_access" ON content_cast;

-- Create policies for content table
CREATE POLICY "content_read_access"
ON content
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read content

CREATE POLICY "content_write_access"
ON content
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Create policies for series table
CREATE POLICY "series_read_access"
ON series
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read series

CREATE POLICY "series_insert_access"
ON series
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "series_update_access"
ON series
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "series_delete_access"
ON series
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Create policies for seasons table
CREATE POLICY "seasons_read_access"
ON seasons
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read seasons

CREATE POLICY "seasons_insert_access"
ON seasons
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "seasons_update_access"
ON seasons
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "seasons_delete_access"
ON seasons
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Create policies for episodes table
CREATE POLICY "episodes_read_access"
ON episodes
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read episodes

CREATE POLICY "episodes_insert_access"
ON episodes
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "episodes_update_access"
ON episodes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

CREATE POLICY "episodes_delete_access"
ON episodes
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Create policies for content_genres table
CREATE POLICY "content_genres_read_access"
ON content_genres
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read content genres

CREATE POLICY "content_genres_write_access"
ON content_genres
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

-- Create policies for content_cast table
CREATE POLICY "content_cast_read_access"
ON content_cast
FOR SELECT
TO authenticated
USING (true);  -- Everyone can read content cast

CREATE POLICY "content_cast_write_access"
ON content_cast
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() 
    AND is_admin = true
  )
);

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
  p_cast_data jsonb DEFAULT NULL,
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
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
  v_season_id uuid;
  v_is_admin boolean;
  v_content_type text;
  v_content_exists boolean;
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO v_is_admin
  FROM users
  WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'You do not have permission to create seasons. Please ensure you are logged in as an admin user.';
  END IF;

  -- Check if content exists
  SELECT EXISTS (
    SELECT 1 FROM content WHERE id = p_content_id
  ) INTO v_content_exists;

  IF NOT v_content_exists THEN
    RAISE EXCEPTION 'Content with ID % does not exist', p_content_id;
  END IF;

  -- Check if content is a series
  SELECT type INTO v_content_type
  FROM content
  WHERE id = p_content_id;

  RAISE NOTICE 'Content type for ID %: %', p_content_id, v_content_type;

  IF v_content_type != 'series' THEN
    RAISE EXCEPTION 'Content with ID % is not a series (type is %)', p_content_id, v_content_type;
  END IF;

  -- Get or create series record
  SELECT id INTO v_series_id
  FROM series
  WHERE content_id = p_content_id;

  RAISE NOTICE 'Existing series ID for content %: %', p_content_id, v_series_id;

  IF v_series_id IS NULL THEN
    -- Create new series record
    INSERT INTO series (content_id, total_seasons)
    VALUES (p_content_id, 1)
    RETURNING id INTO v_series_id;

    RAISE NOTICE 'Created new series record with ID: %', v_series_id;
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

  RAISE NOTICE 'Created new season with ID: %', v_season_id;

  -- Update total_seasons in series table
  UPDATE series
  SET total_seasons = (
    SELECT COUNT(DISTINCT season_number)
    FROM seasons
    WHERE series_id = v_series_id
  )
  WHERE id = v_series_id;

  RETURN v_season_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error details
    RAISE NOTICE 'Error in create_season: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RAISE;
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

-- Add unique constraint for cast_members name if it doesn't exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cast_members_name_key'
  ) THEN
    ALTER TABLE cast_members ADD CONSTRAINT cast_members_name_key UNIQUE (name);
  END IF;
END $$;

-- Add indexes for better performance if they don't exist
DO $$ BEGIN
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