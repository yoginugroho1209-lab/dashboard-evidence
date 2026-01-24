-- Add category and infrastructure_type columns to the evidence table
-- Run this in Supabase SQL Editor

-- Add category column (Existing or Plan)
ALTER TABLE evidence
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Existing';

-- Add infrastructure_type column (ODC, ODP, Tiang, Kabel, Closure)
ALTER TABLE evidence
ADD COLUMN IF NOT EXISTS infrastructure_type TEXT DEFAULT 'ODC';

-- Also add these columns to points table for storing infrastructure type per point
ALTER TABLE points
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Existing';

ALTER TABLE points
ADD COLUMN IF NOT EXISTS infrastructure_type TEXT;

-- Create index for faster queries by infrastructure type
CREATE INDEX IF NOT EXISTS idx_evidence_infrastructure_type ON evidence(infrastructure_type);
CREATE INDEX IF NOT EXISTS idx_evidence_category ON evidence(category);
CREATE INDEX IF NOT EXISTS idx_points_infrastructure_type ON points(infrastructure_type);
CREATE INDEX IF NOT EXISTS idx_points_category ON points(category);
