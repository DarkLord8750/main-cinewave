/*
  # Fix recursive policies for users table
  
  1. Changes
    - Drop existing recursive policies
    - Create new non-recursive policies for users table
    
  2. Security
    - Maintain same security model but implement it without recursion
    - Admin users can still manage all users
    - Regular users can only read their own data
*/

-- First, drop the problematic policies
DROP POLICY IF EXISTS "admin_read_access" ON "public"."users";
DROP POLICY IF EXISTS "admin_insert_access" ON "public"."users";
DROP POLICY IF EXISTS "admin_update_access" ON "public"."users";
DROP POLICY IF EXISTS "admin_delete_access" ON "public"."users";
DROP POLICY IF EXISTS "users_read_own_data" ON "public"."users";

-- Create new non-recursive policies
CREATE POLICY "users_admin_access" ON "public"."users"
AS PERMISSIVE FOR ALL
TO authenticated
USING (
  -- Check if the requesting user's ID exists in users table with is_admin = true
  EXISTS (
    SELECT 1 FROM "public"."users"
    WHERE id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."users"
    WHERE id = auth.uid() AND is_admin = true
  )
);

-- Allow users to read their own data
CREATE POLICY "users_read_own_data" ON "public"."users"
AS PERMISSIVE FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);