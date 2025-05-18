/*
  # Fix User and Profile Access Policies

  1. Changes
    - Drop all existing policies
    - Create new policies with unique names
    - Set up proper admin and self-access rules
  
  2. Security
    - Maintain RLS protection
    - Ensure proper access control
*/

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "users_read_access_admin_20250512" ON users;
DROP POLICY IF EXISTS "users_read_access_self_20250512" ON users;
DROP POLICY IF EXISTS "users_write_access_admin_20250512" ON users;
DROP POLICY IF EXISTS "users_read_access_admin_20250512_v2" ON users;
DROP POLICY IF EXISTS "users_read_access_self_20250512_v2" ON users;
DROP POLICY IF EXISTS "users_write_access_admin_20250512_v2" ON users;
DROP POLICY IF EXISTS "profiles_read_access_admin_20250512" ON profiles;
DROP POLICY IF EXISTS "profiles_read_access_self_20250512" ON profiles;
DROP POLICY IF EXISTS "profiles_write_access_admin_20250512" ON profiles;
DROP POLICY IF EXISTS "profiles_read_access_admin_20250512_v2" ON profiles;
DROP POLICY IF EXISTS "profiles_read_access_self_20250512_v2" ON profiles;
DROP POLICY IF EXISTS "profiles_write_access_admin_20250512_v2" ON profiles;

-- Create new policies with unique names for users table
CREATE POLICY "users_read_access_admin_20250512_v3"
ON users FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

CREATE POLICY "users_read_access_self_20250512_v3"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_write_access_admin_20250512_v3"
ON users FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

-- Create new policies with unique names for profiles table
CREATE POLICY "profiles_read_access_admin_20250512_v3"
ON profiles FOR SELECT
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

CREATE POLICY "profiles_read_access_self_20250512_v3"
ON profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "profiles_write_access_admin_20250512_v3"
ON profiles FOR ALL
TO authenticated
USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');