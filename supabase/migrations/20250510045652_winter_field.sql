/*
  # Initial Schema Setup for Netflix Clone

  1. New Tables
    - `users`
      - `id` (uuid, primary key) - User's unique identifier
      - `email` (text) - User's email address
      - `is_admin` (boolean) - Whether user is an admin
      - `created_at` (timestamp) - When user was created
    
    - `profiles`
      - `id` (uuid, primary key) - Profile's unique identifier
      - `user_id` (uuid) - Reference to users table
      - `name` (text) - Profile name
      - `avatar_url` (text) - Profile avatar URL
      - `created_at` (timestamp) - When profile was created

    - `content`
      - `id` (uuid, primary key) - Content's unique identifier
      - `title` (text) - Content title
      - `description` (text) - Content description
      - `type` (text) - Content type (movie/series)
      - `release_year` (integer) - Release year
      - `maturity_rating` (text) - Content rating
      - `duration` (text) - Duration or number of episodes
      - `poster_image` (text) - Poster image URL
      - `backdrop_image` (text) - Backdrop image URL
      - `trailer_url` (text) - Trailer URL
      - `featured` (boolean) - Whether content is featured
      - `created_at` (timestamp) - When content was created

    - `series`
      - `id` (uuid, primary key) - Series unique identifier
      - `content_id` (uuid) - Reference to content table
      - `total_seasons` (integer) - Total number of seasons
      - `created_at` (timestamp) - When series was created

    - `seasons`
      - `id` (uuid, primary key) - Season unique identifier
      - `series_id` (uuid) - Reference to series table
      - `season_number` (integer) - Season number
      - `title` (text) - Season title
      - `description` (text) - Season description
      - `created_at` (timestamp) - When season was created

    - `episodes`
      - `id` (uuid, primary key) - Episode unique identifier
      - `season_id` (uuid) - Reference to seasons table
      - `episode_number` (integer) - Episode number
      - `title` (text) - Episode title
      - `description` (text) - Episode description
      - `duration` (text) - Episode duration
      - `thumbnail` (text) - Episode thumbnail URL
      - `video_url` (text) - Episode video URL
      - `created_at` (timestamp) - When episode was created

    - `genres`
      - `id` (uuid, primary key) - Genre unique identifier
      - `name` (text) - Genre name
      - `created_at` (timestamp) - When genre was created

    - `content_genres`
      - `content_id` (uuid) - Reference to content table
      - `genre_id` (uuid) - Reference to genres table
      - Primary key is (content_id, genre_id)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
    - Add policies for admin users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Create content table
CREATE TABLE IF NOT EXISTS content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('movie', 'series')),
  release_year integer,
  maturity_rating text,
  duration text,
  poster_image text,
  backdrop_image text,
  trailer_url text,
  featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create series table
CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  total_seasons integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Create seasons table
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid REFERENCES series(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  title text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(series_id, season_number)
);

-- Create episodes table
CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number integer NOT NULL,
  title text NOT NULL,
  description text,
  duration text,
  thumbnail text,
  video_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(season_id, episode_number)
);

-- Create genres table
CREATE TABLE IF NOT EXISTS genres (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create content_genres junction table
CREATE TABLE IF NOT EXISTS content_genres (
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  genre_id uuid REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, genre_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can read their own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin users can read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for profiles table
CREATE POLICY "Users can read their own profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin users can read all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for content table
CREATE POLICY "Anyone can read content"
  ON content
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage content"
  ON content
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for series table
CREATE POLICY "Anyone can read series"
  ON series
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage series"
  ON series
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for seasons table
CREATE POLICY "Anyone can read seasons"
  ON seasons
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage seasons"
  ON seasons
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for episodes table
CREATE POLICY "Anyone can read episodes"
  ON episodes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage episodes"
  ON episodes
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for genres table
CREATE POLICY "Anyone can read genres"
  ON genres
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage genres"
  ON genres
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Create policies for content_genres table
CREATE POLICY "Anyone can read content_genres"
  ON content_genres
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage content_genres"
  ON content_genres
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  ));

-- Insert initial genres
INSERT INTO genres (name) VALUES
  ('Action'),
  ('Adventure'),
  ('Comedy'),
  ('Crime'),
  ('Drama'),
  ('Fantasy'),
  ('Horror'),
  ('Mystery'),
  ('Romance'),
  ('Sci-Fi'),
  ('Thriller')
ON CONFLICT (name) DO NOTHING;