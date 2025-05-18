/*
  # Add Content Management Tables and Functions

  1. New Functions
    - Add function to handle content creation with genres
    - Add function to handle content updates
    - Add function to handle series management
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
BEGIN
  -- Insert content
  INSERT INTO content (
    title, description, type, release_year, maturity_rating,
    duration, poster_image, backdrop_image, trailer_url, featured
  )
  VALUES (
    p_title, p_description, p_type, p_release_year, p_maturity_rating,
    p_duration, p_poster_image, p_backdrop_image, p_trailer_url, p_featured
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