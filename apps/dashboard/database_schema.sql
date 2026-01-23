-- =============================================
-- TELKOM EVIDENCE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PROJECTS TABLE
-- Stores KML project information
-- =============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    region VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- =============================================
-- POINTS TABLE
-- Stores KML coordinate points
-- =============================================
CREATE TABLE IF NOT EXISTS points (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    point_id VARCHAR(50) NOT NULL, -- e.g., TK-8821-A
    name VARCHAR(255),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    status VARCHAR(20) DEFAULT 'planned', -- planned, installed, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- EVIDENCE TABLE
-- Stores uploaded photos and analysis results
-- =============================================
CREATE TABLE IF NOT EXISTS evidence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    point_id UUID REFERENCES points(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Photo information
    photo_url TEXT NOT NULL,
    photo_filename VARCHAR(255),
    
    -- EXIF data extracted from photo
    exif_latitude DECIMAL(10, 8),
    exif_longitude DECIMAL(11, 8),
    exif_timestamp TIMESTAMP WITH TIME ZONE,
    exif_device VARCHAR(100),
    
    -- AI Detection results (stored as JSON)
    ai_detections JSONB,
    
    -- Matching info
    matched_distance_meters DECIMAL(10, 2),
    
    -- Metadata
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- TECHNICIANS TABLE
-- Stores technician/user profile info
-- =============================================
CREATE TABLE IF NOT EXISTS technicians (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'technician', -- admin, technician
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;

-- Projects: Users can read all, but only modify their own
CREATE POLICY "Projects are viewable by everyone" ON projects FOR SELECT USING (true);
CREATE POLICY "Users can create projects" ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON projects FOR UPDATE USING (auth.uid() = user_id);

-- Points: Everyone can read, authenticated users can modify
CREATE POLICY "Points are viewable by everyone" ON points FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage points" ON points FOR ALL USING (auth.role() = 'authenticated');

-- Evidence: Everyone can read, authenticated users can upload
CREATE POLICY "Evidence is viewable by everyone" ON evidence FOR SELECT USING (true);
CREATE POLICY "Authenticated users can upload evidence" ON evidence FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Technicians: Users can read all, only see own profile details
CREATE POLICY "Technicians are viewable by everyone" ON technicians FOR SELECT USING (true);
CREATE POLICY "Users can update own technician profile" ON technicians FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- STORAGE BUCKET
-- Run this separately or create via Supabase Dashboard
-- =============================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('evidence', 'evidence', true);
