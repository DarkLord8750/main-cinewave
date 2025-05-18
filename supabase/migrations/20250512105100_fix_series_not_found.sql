/*
  # Fix Series Not Found Error

  1. Changes
    - Complete rewrite of database functions
    - Added proper constraints
    - Improved error handling
    - Added content type validation
    - Fixed parameter order
*/

-- Drop existing functions and triggers
DROP FUNCTION IF EXISTS create_season(uuid, integer, text, text);
DROP FUNCTION IF EXISTS create_season(uuid, integer);
DROP FUNCTION IF EXISTS get_total_seasons(uuid);
DROP FUNCTION IF EXISTS create_or_get_series(uuid);
DROP TRIGGER IF EXISTS ensure_series_exists ON seasons;
DROP FUNCTION IF EXISTS ensure_series_exists();
DROP FUNCTION IF EXISTS create_series_and_season(uuid, integer, text, text);
DROP FUNCTION IF EXISTS get_series_by_content(uuid);
DROP FUNCTION IF EXISTS validate_content_type(uuid);

-- Enable RLS on series table if not already enabled
ALTER TABLE series ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable read access for all users" ON series;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON series;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON series;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON series;

-- Create policies for series table
CREATE POLICY "Enable read access for all users" ON series
    FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for authenticated users only" ON series
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users only" ON series
    FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Enable delete for authenticated users only" ON series
    FOR DELETE
    USING (auth.role() = 'authenticated');

-- Create function to validate content type
CREATE OR REPLACE FUNCTION public.validate_content_type(p_content_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_type text;
BEGIN
  SELECT type INTO v_content_type
  FROM content
  WHERE id = p_content_id;

  IF v_content_type IS NULL THEN
    RAISE EXCEPTION 'Content with ID % does not exist', p_content_id;
  END IF;

  IF v_content_type != 'series' THEN
    RAISE EXCEPTION 'Content with ID % is not a series', p_content_id;
  END IF;

  RETURN true;
END;
$$;

-- Create function to create series and season with exact parameter order
CREATE OR REPLACE FUNCTION public.create_series_and_season(
  p_content_id uuid,
  p_description text DEFAULT NULL,
  p_season_number integer,
  p_title text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
  v_season_id uuid;
  v_existing_season integer;
BEGIN
  -- Validate content type
  PERFORM validate_content_type(p_content_id);

  -- Check if season number already exists
  SELECT season_number INTO v_existing_season
  FROM seasons s
  JOIN series sr ON s.series_id = sr.id
  WHERE sr.content_id = p_content_id
  AND s.season_number = p_season_number;

  IF v_existing_season IS NOT NULL THEN
    RAISE EXCEPTION 'Season % already exists for this series', p_season_number;
  END IF;

  -- First create or get series
  INSERT INTO series (content_id, total_seasons)
  VALUES (p_content_id, 0)
  ON CONFLICT (content_id) DO NOTHING
  RETURNING id INTO v_series_id;

  -- If no series was created, get the existing one
  IF v_series_id IS NULL THEN
    SELECT id INTO v_series_id
    FROM series
    WHERE content_id = p_content_id;

    IF v_series_id IS NULL THEN
      RAISE EXCEPTION 'Failed to create or find series for content %', p_content_id;
    END IF;
  END IF;

  -- Create the season
  INSERT INTO seasons (series_id, season_number, title, description)
  VALUES (v_series_id, p_season_number, p_title, p_description)
  RETURNING id INTO v_season_id;

  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'Failed to create season';
  END IF;

  -- Update total seasons count
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

-- Create function to get series by content ID
CREATE OR REPLACE FUNCTION public.get_series_by_content(p_content_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
BEGIN
  -- Validate content type
  PERFORM validate_content_type(p_content_id);

  SELECT id INTO v_series_id
  FROM series
  WHERE content_id = p_content_id;
  
  IF v_series_id IS NULL THEN
    RAISE EXCEPTION 'No series found for content %', p_content_id;
  END IF;

  RETURN v_series_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.validate_content_type(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_series_and_season(uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_series_by_content(uuid) TO authenticated;

-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON series TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON seasons TO authenticated;

-- Notify PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema'; 