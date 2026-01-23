import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wrwlibyrpoqknaycwlex.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indyd2xpYnlycG9xa25heWN3bGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwMTcxMzEsImV4cCI6MjA4NDU5MzEzMX0.y8nlF4Nn11h0rtiBAbHY4gyP-DR7fTXBdVLb-O54MAA'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
