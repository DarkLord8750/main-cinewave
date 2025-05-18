/*
  # Fix Authentication and User Management

  1. Changes
    - Drop and recreate users and profiles tables
    - Set up proper RLS policies
    - Create trigger for automatic user creation
    - Fix admin user handling
  
  2. Security
    - Enable RLS on all tables
    - Set up proper policies for data access
    - Ensure secure user creation flow
*/

-- Drop existing tables and policies
DROP POLICY IF EXISTS "Enable read access for admin users" ON users;
DROP POLICY IF EXISTS "Enable read access for own data" ON users;
DROP POLICY IF EXISTS "Enable update access for admin users" ON users;
DROP POLICY IF EXISTS "Allow users to read own data" ON users;
DROP POLICY IF EXISTS "Allow admin to read all users" ON users;
DROP POLICY IF EXISTS "Allow admin to update users" ON users;
DROP POLICY IF EXISTS "Allow users to read own profiles" ON profiles;
DROP POLICY IF EXISTS "Allow admin to read all profiles" ON profiles;
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

-- Create simplified policies for users table
CREATE POLICY "users_self_access" ON users
  FOR ALL
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_admin_access" ON users
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- Create simplified policies for profiles table
CREATE POLICY "profiles_self_access" ON profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "profiles_admin_access" ON profiles
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() AND is_admin = true
  ));

-- Create trigger function for new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.users (id, email, is_admin)
  VALUES (
    new.id,
    new.email,
    CASE 
      WHEN new.email = 'uveshmalik.8860@gmail.com' THEN true
      ELSE false
    END
  );
  
  INSERT INTO public.profiles (user_id, name, avatar_url)
  VALUES (
    new.id,
    split_part(new.email, '@', 1),
    'https://i.pravatar.cc/150?u=' || new.id
  );
  
  RETURN new;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();