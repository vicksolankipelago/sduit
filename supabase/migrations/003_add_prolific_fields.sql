-- Add Prolific study tracking fields to voice_sessions table
ALTER TABLE voice_sessions
ADD COLUMN IF NOT EXISTS prolific_pid VARCHAR,
ADD COLUMN IF NOT EXISTS prolific_study_id VARCHAR,
ADD COLUMN IF NOT EXISTS prolific_session_id VARCHAR;
