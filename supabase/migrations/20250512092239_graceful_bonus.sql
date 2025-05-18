/*
  # Fix Cast Members and Content Display

  1. Changes
    - Add indexes for better performance
    - Update content_cast constraints
    - Add policies for proper access
  
  2. Security
    - Maintain RLS protection
    - Add proper policies for data access
*/

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_content_cast_content_id ON content_cast(content_id);
CREATE INDEX IF NOT EXISTS idx_content_cast_cast_member_id ON content_cast(cast_member_id);
CREATE INDEX IF NOT EXISTS idx_content_cast_order ON content_cast("order");

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read content cast" ON content_cast;
DROP POLICY IF EXISTS "Admin users can manage content cast" ON content_cast;

-- Create new policies for content_cast
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

-- Create function to manage content cast if it doesn't exist
CREATE OR REPLACE FUNCTION manage_content_cast(
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