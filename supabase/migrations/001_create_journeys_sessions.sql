-- Migration: Create journeys and sessions tables
-- Run this in your Supabase SQL Editor

-- ============================================
-- JOURNEYS TABLE
-- Stores user-created SDUI journeys
-- ============================================

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  system_prompt TEXT NOT NULL,
  voice TEXT DEFAULT 'shimmer',
  agents JSONB NOT NULL DEFAULT '[]'::jsonb,
  starting_agent_id TEXT NOT NULL,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user queries
CREATE INDEX IF NOT EXISTS idx_journeys_user_id ON journeys(user_id);
CREATE INDEX IF NOT EXISTS idx_journeys_updated_at ON journeys(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own journeys
CREATE POLICY "Users can view their own journeys"
  ON journeys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own journeys"
  ON journeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own journeys"
  ON journeys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own journeys"
  ON journeys FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journeys_updated_at
  BEFORE UPDATE ON journeys
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- SESSIONS TABLE
-- Auto-saved voice session transcripts
-- ============================================

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  exported_at TIMESTAMPTZ DEFAULT NOW(),

  -- Duration metadata
  duration_start_ms BIGINT,
  duration_end_ms BIGINT,
  duration_total_seconds INTEGER,

  -- Journey/Agent context (nullable - session may not have journey)
  journey_id TEXT,
  journey_name TEXT,
  journey_voice TEXT,
  agent_id TEXT,
  agent_name TEXT,
  agent_prompt TEXT,
  agent_tools JSONB DEFAULT '[]'::jsonb,

  -- Conversation data (stored as JSONB)
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB DEFAULT '[]'::jsonb,

  -- Summary statistics
  stats_total_messages INTEGER DEFAULT 0,
  stats_user_messages INTEGER DEFAULT 0,
  stats_assistant_messages INTEGER DEFAULT 0,
  stats_tool_calls INTEGER DEFAULT 0,
  stats_breadcrumbs INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_journey_id ON sessions(journey_id);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own sessions
CREATE POLICY "Users can view their own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions"
  ON sessions FOR DELETE
  USING (auth.uid() = user_id);
