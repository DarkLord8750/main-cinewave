/*
  # Update User and Profile Access Policies
  
  1. Changes
    - Drop existing policies
    - Add new policies for admin access
    - Add new policies for user self-access
    
  2. Security
    - Maintain RLS protection
    - Add specific admin check from users table
    - Ensure proper user data access
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_access_admin" ON users;
DROP POLICY IF EXISTS "users_read_access_self" ON users;
DROP POLICY IF EXISTS "users_write_access_admin" ON users;
DROP POLICY IF EXISTS "profiles_read_access_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_read_access_self" ON profiles;
DROP POLICY IF EXISTS "profiles_write_access_admin" ON profiles;

-- Create policies for users table
CREATE POLICY "users_read_access_admin_20250512"
ON users FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
));

CREATE POLICY "users_read_access_self_20250512"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "users_write_access_admin_20250512"
ON users FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
));

-- Create policies for profiles table
CREATE POLICY "profiles_read_access_admin_20250512"
ON profiles FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
));

CREATE POLICY "profiles_read_access_self_20250512"
ON profiles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "profiles_write_access_admin_20250512"
ON profiles FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users AS u 
  WHERE u.id = auth.uid() 
  AND u.is_admin = true
));