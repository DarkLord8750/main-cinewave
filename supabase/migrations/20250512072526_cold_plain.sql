/*
  # Remove Rating Column and Keep Maturity Rating

  1. Changes
    - Remove rating column from content table
    - Keep maturity_rating column
*/

-- Remove rating column
ALTER TABLE content DROP COLUMN IF EXISTS rating;