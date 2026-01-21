-- Migration: Create global_screens table for shared SDUI screens
-- This table stores screen configurations that can be shared across flows

-- Create the global_screens table
CREATE TABLE IF NOT EXISTS global_screens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  sections JSONB NOT NULL DEFAULT '[]',
  events JSONB DEFAULT '[]',
  state JSONB DEFAULT '{}',
  hides_back_button BOOLEAN DEFAULT FALSE,
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_global_screens_title ON global_screens(title);
CREATE INDEX IF NOT EXISTS idx_global_screens_tags ON global_screens USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_global_screens_created_by ON global_screens(created_by);
CREATE INDEX IF NOT EXISTS idx_global_screens_updated_at ON global_screens(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE global_screens ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All authenticated users can read global screens
CREATE POLICY "Global screens are readable by all authenticated users"
  ON global_screens
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policy: Only admins can insert global screens
-- Admin check uses raw_user_meta_data->>'role' = 'admin'
CREATE POLICY "Only admins can insert global screens"
  ON global_screens
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- RLS Policy: Only admins can update global screens
CREATE POLICY "Only admins can update global screens"
  ON global_screens
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- RLS Policy: Only admins can delete global screens
CREATE POLICY "Only admins can delete global screens"
  ON global_screens
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR
    (SELECT raw_user_meta_data ->> 'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
  );

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_global_screens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_global_screens_updated_at ON global_screens;
CREATE TRIGGER trigger_update_global_screens_updated_at
  BEFORE UPDATE ON global_screens
  FOR EACH ROW
  EXECUTE FUNCTION update_global_screens_updated_at();

-- Add comment to table
COMMENT ON TABLE global_screens IS 'Globally shared SDUI screen configurations that can be reused across flows';
