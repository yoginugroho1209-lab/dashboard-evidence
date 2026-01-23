-- Function to check if a user email exists in auth.users
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.check_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE email = user_email
    ) INTO user_exists;
    
    RETURN user_exists;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO authenticated;
