/*
  # Add Cast Management Tables

  1. Changes
    - Add URL validation for cast_members photo_url
    - Create policies for cast_members and content_cast tables
    - Add function to manage content cast
  
  2. Security
    - Enable RLS on tables
    - Add proper policies for data access
*/

-- Add URL validation for cast_members photo_url if not exists
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_photo_url'
  ) THEN
    ALTER TABLE cast_members
    ADD CONSTRAINT valid_photo_url 
    CHECK (photo_url IS NULL OR photo_url ~ '^https?://.*$');
  END IF;
END $$;

-- Enable RLS if not already enabled
ALTER TABLE cast_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cast ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can read cast members" ON cast_members;
DROP POLICY IF EXISTS "Admin users can manage cast members" ON cast_members;
DROP POLICY IF EXISTS "Anyone can read content cast" ON content_cast;
DROP POLICY IF EXISTS "Admin users can manage content cast" ON content_cast;

-- Create policies for cast_members
CREATE POLICY "Anyone can read cast members"
  ON cast_members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage cast members"
  ON cast_members
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for content_cast
CREATE POLICY "Anyone can read content cast"
  ON content_cast
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage content cast"
  ON content_cast
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS manage_content_cast(uuid, jsonb);

-- Create function to manage content cast
CREATE FUNCTION manage_content_cast(
  p_content_id uuid,
  p_cast_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing cast entries for this content
  DELETE FROM content_cast WHERE content_id = p_content_id;
  
  -- Insert new cast entries
  INSERT INTO content_cast (content_id, cast_member_id, role, "order")
  SELECT 
    p_content_id,
    (cast_entry->>'cast_member_id')::uuid,
    cast_entry->>'role',
    (cast_entry->>'order')::integer
  FROM jsonb_array_elements(p_cast_data) AS cast_entry;
END;
$$;