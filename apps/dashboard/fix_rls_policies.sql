-- =============================================
-- FIX ROW LEVEL SECURITY (RLS) POLICIES
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Evidence is viewable by everyone" ON evidence;
DROP POLICY IF EXISTS "Authenticated users can upload evidence" ON evidence;
DROP POLICY IF EXISTS "Projects are viewable by everyone" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Points are viewable by everyone" ON points;
DROP POLICY IF EXISTS "Authenticated users can manage points" ON points;

-- =============================================
-- EVIDENCE TABLE POLICIES
-- =============================================

-- Allow everyone to view evidence
CREATE POLICY "Anyone can view evidence" ON evidence
    FOR SELECT USING (true);

-- Allow authenticated users to insert evidence
CREATE POLICY "Authenticated users can insert evidence" ON evidence
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own evidence
CREATE POLICY "Users can update own evidence" ON evidence
    FOR UPDATE USING (auth.uid() = uploaded_by);

-- =============================================
-- PROJECTS TABLE POLICIES
-- =============================================

-- Allow everyone to view projects
CREATE POLICY "Anyone can view projects" ON projects
    FOR SELECT USING (true);

-- Allow authenticated users to create projects
CREATE POLICY "Authenticated users can create projects" ON projects
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow users to update their own projects
CREATE POLICY "Users can update own projects" ON projects
    FOR UPDATE USING (auth.uid() = user_id);

-- =============================================
-- POINTS TABLE POLICIES
-- =============================================

-- Allow everyone to view points
CREATE POLICY "Anyone can view points" ON points
    FOR SELECT USING (true);

-- Allow authenticated users to insert points
CREATE POLICY "Authenticated users can insert points" ON points
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update points
CREATE POLICY "Authenticated users can update points" ON points
    FOR UPDATE USING (auth.role() = 'authenticated');
