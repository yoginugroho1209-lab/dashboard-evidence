-- Enable Supabase Realtime for tables
-- Run this in Supabase SQL Editor to enable real-time synchronization

-- Enable realtime for projects table
ALTER PUBLICATION supabase_realtime ADD TABLE projects;

-- Enable realtime for points table
ALTER PUBLICATION supabase_realtime ADD TABLE points;

-- Enable realtime for evidence table
ALTER PUBLICATION supabase_realtime ADD TABLE evidence;

-- If tables are already in publication, you may see an error - that's OK
-- Alternatively, you can enable it from Supabase Dashboard:
-- 1. Go to Database > Replication
-- 2. Under "supabase_realtime" publication, enable the tables
