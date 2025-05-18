/*
  # Fix Authentication System

  1. Changes
    - Drop and recreate users table with proper structure
    - Update profiles table
    - Create new RLS policies
    - Add trigger for new user creation
  
  2. Security
    - Enable RLS on all tables
    - Add proper policies for data access
    - Link with Supabase auth
*/

-- First, drop existing tables and policies
DROP POLICY IF EXISTS "Enable read access for admin users" ON users;
DROP POLICY IF EXISTS "Enable read access for own data" ON users;
DROP POLICY IF EXISTS "Enable update access for admin users" ON users;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table linked to auth.users
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Allow users to read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Allow admin to read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE is_admin = true
    )
  );

CREATE POLICY "Allow admin to update users"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM users WHERE is_admin = true
    )
  );

-- Create policies for profiles table
CREATE POLICY "Allow users to read own profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Allow admin to read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM users WHERE is_admin = true
    )
  );

-- Create trigger function for new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert the user record
  INSERT INTO public.users (id, email, is_admin)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN new.email = 'uveshmalik.8860@gmail.com' THEN true
      ELSE false
    END
  );
  
  -- Insert the default profile
  INSERT INTO public.profiles (user_id, name, avatar_url)
  VALUES (
    new.id,
    split_part(new.email, '@', 1),
    'https://i.pravatar.cc/150?u=' || new.id
  );
  
  -- Update the user's metadata to include admin status
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{is_admin}',
    CASE 
      WHEN new.email = 'uveshmalik.8860@gmail.com' THEN 'true'::jsonb
      ELSE 'false'::jsonb
    END
  )
  WHERE id = new.id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();