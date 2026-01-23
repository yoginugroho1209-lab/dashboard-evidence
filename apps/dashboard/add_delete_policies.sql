-- =============================================
-- ADD DELETE POLICIES FOR PROJECTS AND EVIDENCE
-- Run this in Supabase SQL Editor
-- =============================================

-- Add DELETE policy for projects table
-- Allow users to delete their own projects
CREATE POLICY "Users can delete own projects" ON projects
    FOR DELETE USING (auth.uid() = user_id);

-- Add DELETE policy for evidence table (for completeness)
CREATE POLICY "Users can delete own evidence" ON evidence
    FOR DELETE USING (auth.uid() = uploaded_by);
