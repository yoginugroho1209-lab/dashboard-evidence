-- Add raw_kml_content column to projects table
-- This stores the original KML file content to preserve folder structure on export

ALTER TABLE projects ADD COLUMN IF NOT EXISTS raw_kml_content TEXT;

-- Add comment
COMMENT ON COLUMN projects.raw_kml_content IS 'Original KML file content for preserving folder structure on export';
