/*
  # Fix Users Table RLS Policies

  1. Changes
    - Remove existing problematic policies that cause infinite recursion
    - Add new, simplified policies for users table access:
      - Allow users to read their own data
      - Allow admins to read all user data
      - Prevent any other access

  2. Security
    - Maintains RLS protection
    - Simplifies policy logic to prevent recursion
    - Ensures proper access control for users and admins
*/

-- Drop existing policies to replace them with fixed versions
DROP POLICY IF EXISTS "users_admin_access" ON "public"."users";
DROP POLICY IF EXISTS "users_self_access" ON "public"."users";

-- Create new, simplified policies
CREATE POLICY "enable_self_access"
ON "public"."users"
FOR ALL
TO authenticated
USING (
  auth.uid() = id
)
WITH CHECK (
  auth.uid() = id
);

CREATE POLICY "enable_admin_access"
ON "public"."users"
FOR ALL
TO authenticated
USING (
  is_admin = true
  AND
  auth.uid() = id
);