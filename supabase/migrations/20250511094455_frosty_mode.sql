/*
  # Fix Featured Content Management

  1. Changes
    - Add featured_order column to content table
    - Update featured content handling
    - Add function to manage featured content order
*/

-- Add featured_order column to content table
ALTER TABLE content
ADD COLUMN featured_order integer;

-- Create index on featured and featured_order
CREATE INDEX idx_content_featured ON content (featured, featured_order)
WHERE featured = true;

-- Create function to manage featured content order
CREATE OR REPLACE FUNCTION manage_featured_order()
RETURNS trigger AS $$
BEGIN
  -- If content is being set as featured
  IF NEW.featured = true AND (OLD.featured = false OR OLD.featured IS NULL) THEN
    -- Get the maximum featured_order
    SELECT COALESCE(MAX(featured_order), 0) + 1
    INTO NEW.featured_order
    FROM content
    WHERE featured = true;
  -- If content is being unfeatured
  ELSIF NEW.featured = false AND OLD.featured = true THEN
    -- Reset featured_order
    NEW.featured_order := NULL;
    
    -- Reorder remaining featured content
    UPDATE content
    SET featured_order = subquery.new_order
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY featured_order) AS new_order
      FROM content
      WHERE featured = true AND id != OLD.id
    ) AS subquery
    WHERE content.id = subquery.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for managing featured order
CREATE TRIGGER manage_featured_order_trigger
BEFORE INSERT OR UPDATE OF featured ON content
FOR EACH ROW
EXECUTE FUNCTION manage_featured_order();