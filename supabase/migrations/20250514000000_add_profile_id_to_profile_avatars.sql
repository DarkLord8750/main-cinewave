-- Add profile_id column to profile_avatars table
ALTER TABLE profile_avatars ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
-- Make profile_id unique (one avatar per profile)
CREATE UNIQUE INDEX IF NOT EXISTS profile_avatars_profile_id_idx ON profile_avatars(profile_id); 