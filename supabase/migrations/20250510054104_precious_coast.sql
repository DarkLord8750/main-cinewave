/*
  # Fix Authentication and User Tables Setup

  1. Changes
    - Drop existing users table to avoid conflicts with auth.users
    - Recreate users table to link with auth.users
    - Update profiles table foreign key
    - Add proper RLS policies
  
  2. Security
    - Enable RLS on all tables
    - Add policies for user data access
    - Link with Supabase auth
*/

-- Drop existing tables (in correct order due to foreign key constraints)
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Recreate users table linked to auth.users
CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Recreate profiles table
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

-- Policies for users table
CREATE POLICY "Users can read own data" 
  ON users FOR SELECT 
  TO authenticated 
  USING (auth.uid() = id);

CREATE POLICY "Admin users can read all data" 
  ON users FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Admin users can update data" 
  ON users FOR UPDATE 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Policies for profiles table
CREATE POLICY "Users can read their own profiles" 
  ON profiles FOR SELECT 
  TO authenticated 
  USING (user_id = auth.uid());

CREATE POLICY "Admin users can read all profiles" 
  ON profiles FOR SELECT 
  TO authenticated 
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create trigger to automatically create user record
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (new.id, new.email, false);
  
  INSERT INTO public.profiles (user_id, name)
  VALUES (new.id, split_part(new.email, '@', 1));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function every time a user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();