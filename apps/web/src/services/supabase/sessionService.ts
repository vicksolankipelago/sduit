/**
 * Session Service - Supabase Operations
 *
 * Handles auto-saving and retrieving voice session transcripts.
 * Uses Row Level Security (RLS) for user isolation.
 */

import { supabase, isSupabaseConfigured } from '@sduit/shared/auth';
import { SessionExport } from '../../utils/transcriptExport';

/**
 * Supabase session row type (snake_case)
 */
interface SupabaseSessionRow {
  id: string;
  user_id: string;
  session_id: string;
  exported_at: string;
  duration_start_ms: number | null;
  duration_end_ms: number | null;
  duration_total_seconds: number | null;
  journey_id: string | null;
  journey_name: string | null;
  journey_voice: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_prompt: string | null;
  agent_tools: any; // JSONB
  transcript: any; // JSONB
  events: any; // JSONB
  stats_total_messages: number;
  stats_user_messages: number;
  stats_assistant_messages: number;
  stats_tool_calls: number;
  stats_breadcrumbs: number;
  created_at: string;
}

/**
 * Session list item for displaying in UI
 */
export interface SessionListItem {
  id: string;
  sessionId: string;
  journeyName: string | null;
  agentName: string | null;
  durationSeconds: number;
  messageCount: number;
  createdAt: string;
}

/**
 * Convert Supabase row to SessionExport type
 */
function toSessionExport(row: SupabaseSessionRow): SessionExport {
  return {
    sessionId: row.session_id,
    exportedAt: row.exported_at,
    duration: {
      startMs: row.duration_start_ms || 0,
      endMs: row.duration_end_ms || 0,
      totalSeconds: row.duration_total_seconds || 0,
    },
    journey: row.journey_id
      ? {
          id: row.journey_id,
          name: row.journey_name || '',
          voice: row.journey_voice || '',
        }
      : undefined,
    agent: row.agent_id
      ? {
          id: row.agent_id,
          name: row.agent_name || '',
          prompt: row.agent_prompt || '',
          tools: row.agent_tools || [],
        }
      : undefined,
    transcript: row.transcript || [],
    events: row.events || [],
    stats: {
      totalMessages: row.stats_total_messages || 0,
      userMessages: row.stats_user_messages || 0,
      assistantMessages: row.stats_assistant_messages || 0,
      toolCalls: row.stats_tool_calls || 0,
      breadcrumbs: row.stats_breadcrumbs || 0,
    },
  };
}

/**
 * Convert SessionExport to Supabase row format
 */
function toSupabaseRow(
  sessionExport: SessionExport,
  userId: string
): Omit<SupabaseSessionRow, 'id' | 'created_at'> {
  return {
    user_id: userId,
    session_id: sessionExport.sessionId,
    exported_at: sessionExport.exportedAt,
    duration_start_ms: sessionExport.duration.startMs,
    duration_end_ms: sessionExport.duration.endMs,
    duration_total_seconds: sessionExport.duration.totalSeconds,
    journey_id: sessionExport.journey?.id || null,
    journey_name: sessionExport.journey?.name || null,
    journey_voice: sessionExport.journey?.voice || null,
    agent_id: sessionExport.agent?.id || null,
    agent_name: sessionExport.agent?.name || null,
    agent_prompt: sessionExport.agent?.prompt || null,
    agent_tools: sessionExport.agent?.tools || [],
    transcript: sessionExport.transcript,
    events: sessionExport.events,
    stats_total_messages: sessionExport.stats.totalMessages,
    stats_user_messages: sessionExport.stats.userMessages,
    stats_assistant_messages: sessionExport.stats.assistantMessages,
    stats_tool_calls: sessionExport.stats.toolCalls,
    stats_breadcrumbs: sessionExport.stats.breadcrumbs,
  };
}

/**
 * Auto-save a session to Supabase
 * Uses upsert to handle duplicate session IDs
 */
export async function saveSession(
  sessionExport: SessionExport,
  userId: string
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) {
    console.warn('Supabase not configured, skipping session save');
    return;
  }

  const row = toSupabaseRow(sessionExport, userId);

  const { error } = await supabase
    .from('sessions')
    .upsert(row, { onConflict: 'session_id' });

  if (error) {
    console.error('Failed to save session to Supabase:', error);
    throw error;
  }

  console.log(`Session ${sessionExport.sessionId} saved to Supabase`);
}

/**
 * List user sessions (for session history UI)
 */
export async function listUserSessions(
  userId: string,
  limit = 50,
  offset = 0
): Promise<SessionListItem[]> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, session_id, journey_name, agent_name, duration_total_seconds, stats_total_messages, created_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to list sessions:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    journeyName: row.journey_name,
    agentName: row.agent_name,
    durationSeconds: row.duration_total_seconds || 0,
    messageCount: row.stats_total_messages || 0,
    createdAt: row.created_at,
  }));
}

/**
 * Load a full session by session_id
 */
export async function loadSession(sessionId: string): Promise<SessionExport | null> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Failed to load session:', error);
    throw error;
  }

  return data ? toSessionExport(data as SupabaseSessionRow) : null;
}

/**
 * Load a full session by database ID
 */
export async function loadSessionById(id: string): Promise<SessionExport | null> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Failed to load session:', error);
    throw error;
  }

  return data ? toSessionExport(data as SupabaseSessionRow) : null;
}

/**
 * Delete a session by session_id
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Failed to delete session:', error);
    throw error;
  }

  return true;
}

/**
 * Delete a session by database ID
 */
export async function deleteSessionById(id: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase.from('sessions').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete session:', error);
    throw error;
  }

  return true;
}

/**
 * Get session count for a user
 */
export async function getSessionCount(userId: string): Promise<number> {
  if (!supabase || !isSupabaseConfigured) {
    return 0;
  }

  const { count, error } = await supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to count sessions:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Get sessions for a specific journey
 */
export async function getSessionsForJourney(
  userId: string,
  journeyId: string,
  limit = 20
): Promise<SessionListItem[]> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, session_id, journey_name, agent_name, duration_total_seconds, stats_total_messages, created_at'
    )
    .eq('user_id', userId)
    .eq('journey_id', journeyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get sessions for journey:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    journeyName: row.journey_name,
    agentName: row.agent_name,
    durationSeconds: row.duration_total_seconds || 0,
    messageCount: row.stats_total_messages || 0,
    createdAt: row.created_at,
  }));
}
