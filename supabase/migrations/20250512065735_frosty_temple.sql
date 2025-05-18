/*
  # Add Cast Management Tables

  1. New Tables
    - `cast_members`
      - `id` (uuid, primary key)
      - `name` (text)
      - `photo_url` (text)
      - `created_at` (timestamp)
    
    - `content_cast`
      - `content_id` (uuid, references content)
      - `cast_member_id` (uuid, references cast_members)
      - `role` (text)
      - `order` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add policies for admin users
*/

-- Create cast_members table
CREATE TABLE cast_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_photo_url CHECK (photo_url IS NULL OR photo_url ~ '^https?://.*$')
);

-- Create content_cast junction table
CREATE TABLE content_cast (
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  cast_member_id uuid REFERENCES cast_members(id) ON DELETE CASCADE,
  role text NOT NULL,
  "order" integer DEFAULT 0,
  PRIMARY KEY (content_id, cast_member_id)
);

-- Enable RLS
ALTER TABLE cast_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_cast ENABLE ROW LEVEL SECURITY;

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

-- Create function to manage content cast
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