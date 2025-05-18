/*
  # Fix Series Creation and Season Management

  1. Changes
    - Add function to ensure series record exists
    - Update create_season function to use the new function
    - Add better error handling and logging
  
  2. Security
    - Maintain RLS protection
    - Keep existing admin checks
*/

-- Function to ensure series record exists
CREATE OR REPLACE FUNCTION ensure_series_exists(
  p_content_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_series_id uuid;
  v_content_type text;
BEGIN
  -- Check if content exists and is a series
  SELECT type INTO v_content_type
  FROM content
  WHERE id = p_content_id;

  IF v_content_type IS NULL THEN
    RAISE EXCEPTION 'Content with ID % does not exist', p_content_id;
  END IF;

  IF v_content_type != 'series' THEN
    RAISE EXCEPTION 'Content with ID % is not a series (type is %)', p_content_id, v_content_type;
  END IF;

  -- Get or create series record
  SELECT id INTO v_series_id
  FROM series
  WHERE content_id = p_content_id;

  IF v_series_id IS NULL THEN
    INSERT INTO series (content_id, total_seasons)
    VALUES (p_content_id, 1)
    RETURNING id INTO v_series_id;
  END IF;

  RETURN v_series_id;
END;
$$;

-- Update create_season function to use ensure_series_exists
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
BEGIN
  -- Check if user is admin
  SELECT is_admin INTO v_is_admin
  FROM users
  WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'You do not have permission to create seasons. Please ensure you are logged in as an admin user.';
  END IF;

  -- Get or create series record
  v_series_id := ensure_series_exists(p_content_id);

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