-- =========================================
-- Role-Based Access Control SQL Setup
-- Run this in Supabase SQL Editor
-- =========================================

-- Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role text NOT NULL DEFAULT 'teknisi' CHECK (role IN ('teknisi', 'admin')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: users can read their own role
CREATE POLICY "Users can view own role" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Allow insert during registration (authenticated users can insert their own role)
CREATE POLICY "Users can insert own role" ON user_roles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =========================================
-- To create an admin account, run this:
-- =========================================
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ('YOUR_USER_UUID_HERE', 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
