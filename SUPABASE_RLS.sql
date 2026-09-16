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
  owner_id = auth.uid()::text
);

-- Allow users to insert only their own sessions
CREATE POLICY "Users can insert their own whatsapp_sessions"
ON whatsapp_sessions FOR INSERT
WITH CHECK (
  owner_id = auth.uid()::text
);

-- Allow users to update only their own sessions
CREATE POLICY "Users can update their own whatsapp_sessions"
ON whatsapp_sessions FOR UPDATE
USING (
  owner_id = auth.uid()::text
)
WITH CHECK (
  owner_id = auth.uid()::text
);

-- Allow users to delete only their own sessions
CREATE POLICY "Users can delete their own whatsapp_sessions"
ON whatsapp_sessions FOR DELETE
USING (
  owner_id = auth.uid()::text
);

-- ============================================
-- RLS Policies for activity_events table
-- ============================================

-- Allow users to view only their own activity events
CREATE POLICY "Users can view their own activity_events"
ON activity_events FOR SELECT
USING (
  owner_id = auth.uid()::text
);

-- Allow users to insert only their own activity events
CREATE POLICY "Users can insert their own activity_events"
ON activity_events FOR INSERT
WITH CHECK (
  owner_id = auth.uid()::text
);

-- Allow users to delete only their own activity events
CREATE POLICY "Users can delete their own activity_events"
ON activity_events FOR DELETE
USING (
  owner_id = auth.uid()::text
);

-- ============================================
-- NOTE: For Development/Testing
-- ============================================
-- If you're in development and the API calls bypass auth,
-- you can temporarily DISABLE RLS with:
--
-- ALTER TABLE whatsapp_sessions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE activity_events DISABLE ROW LEVEL SECURITY;
--
-- But ALWAYS enable it in production!
