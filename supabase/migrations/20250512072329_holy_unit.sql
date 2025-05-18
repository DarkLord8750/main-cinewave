/*
  # Add Rating Column to Content Table

  1. Changes
    - Add rating column to content table
    - Set default rating value
    - Add check constraint for valid rating range
*/

-- Add rating column to content table
ALTER TABLE content
ADD COLUMN rating numeric(3,1) DEFAULT 0.0 CHECK (rating >= 0 AND rating <= 5);

-- Update existing content to have a default rating
UPDATE content SET rating = 0.0 WHERE rating IS NULL;