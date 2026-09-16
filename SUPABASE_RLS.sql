-- Enable RLS (Row Level Security) on both tables
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for whatsapp_sessions table
-- ============================================

-- Allow users to view only their own sessions
CREATE POLICY "Users can view their own whatsapp_sessions"
ON whatsapp_sessions FOR SELECT
USING (
  owner_id = current_user_id()
);

-- Allow users to insert only their own sessions
CREATE POLICY "Users can insert their own whatsapp_sessions"
ON whatsapp_sessions FOR INSERT
WITH CHECK (
  owner_id = current_user_id()
);

-- Allow users to update only their own sessions
CREATE POLICY "Users can update their own whatsapp_sessions"
ON whatsapp_sessions FOR UPDATE
USING (
  owner_id = current_user_id()
)
WITH CHECK (
  owner_id = current_user_id()
);

-- Allow users to delete only their own sessions
CREATE POLICY "Users can delete their own whatsapp_sessions"
ON whatsapp_sessions FOR DELETE
USING (
  owner_id = current_user_id()
);

-- ============================================
-- RLS Policies for activity_events table
-- ============================================

-- Allow users to view only their own activity events
CREATE POLICY "Users can view their own activity_events"
ON activity_events FOR SELECT
USING (
  owner_id = current_user_id()
);

-- Allow users to insert only their own activity events
CREATE POLICY "Users can insert their own activity_events"
ON activity_events FOR INSERT
WITH CHECK (
  owner_id = current_user_id()
);

-- Allow users to delete only their own activity events
CREATE POLICY "Users can delete their own activity_events"
ON activity_events FOR DELETE
USING (
  owner_id = current_user_id()
);

-- ============================================
-- NOTE: Disable for Development
-- ============================================
-- If you're in development and need full access without authentication,
-- you can comment out the ALTER TABLE lines above and use these anonymous policies instead:
--
-- CREATE POLICY "Allow anonymous read on whatsapp_sessions"
-- ON whatsapp_sessions FOR SELECT
-- USING (true);
--
-- CREATE POLICY "Allow anonymous read on activity_events"
-- ON activity_events FOR SELECT
-- USING (true);
--
-- But NEVER use this in production!
