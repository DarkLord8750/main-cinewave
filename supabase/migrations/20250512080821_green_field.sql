/*
  # Add User Management Fields

  1. Changes
    - Add status field to users table
    - Add notes field for admin comments
    - Add default values and constraints
*/

-- Add new columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
ADD COLUMN IF NOT EXISTS notes text DEFAULT '';

-- Update existing users to have default status if not set
UPDATE users SET status = 'active' WHERE status IS NULL;