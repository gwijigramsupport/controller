-- Drop existing tables if they exist (be careful with this in production!)
DROP TABLE IF EXISTS activity_events CASCADE;
DROP TABLE IF EXISTS whatsapp_sessions CASCADE;

-- Create whatsapp_sessions table
CREATE TABLE whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT,
  display_number TEXT,
  profile_name TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'connecting', 'disconnected', 'logged_out', 'error')),
  last_seen_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for whatsapp_sessions
CREATE INDEX idx_whatsapp_sessions_owner_id ON whatsapp_sessions(owner_id);
CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(status);

-- Create activity_events table
CREATE TABLE activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  session_id UUID,
  session_name TEXT,
  type TEXT NOT NULL CHECK (type IN ('session_connected', 'session_created', 'session_disconnected', 'session_logged_out', 'session_error', 'message_received')),
  title TEXT NOT NULL,
  detail TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  FOREIGN KEY (session_id) REFERENCES whatsapp_sessions(id) ON DELETE CASCADE
);

-- Create indexes for activity_events
CREATE INDEX idx_activity_events_owner_id ON activity_events(owner_id);
CREATE INDEX idx_activity_events_session_id ON activity_events(session_id);
CREATE INDEX idx_activity_events_created_at ON activity_events(created_at);
CREATE INDEX idx_activity_events_type ON activity_events(type);

-- Add comment to tables for documentation
COMMENT ON TABLE whatsapp_sessions IS 'Stores WhatsApp session metadata for multi-tenant SaaS';
COMMENT ON TABLE activity_events IS 'Logs all activity events for WhatsApp sessions';
