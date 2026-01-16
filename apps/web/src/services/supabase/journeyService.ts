/**
 * Journey Service - Supabase Operations
 *
 * Handles CRUD operations for user journeys stored in Supabase.
 * Uses Row Level Security (RLS) for user isolation.
 */

import { supabase, isSupabaseConfigured } from '@sduit/shared/auth';
import { Journey, JourneyListItem } from '../../types/journey';
import { v4 as uuidv4 } from 'uuid';

/**
 * Supabase journey row type (snake_case)
 */
interface SupabaseJourneyRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  system_prompt: string;
  voice: string | null;
  agents: any; // JSONB
  starting_agent_id: string;
  version: string;
  created_at: string;
  updated_at: string;
}

/**
 * Convert Supabase row to Journey type (snake_case → camelCase)
 */
function toJourney(row: SupabaseJourneyRow): Journey {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    systemPrompt: row.system_prompt,
    voice: row.voice || undefined,
    agents: row.agents || [],
    startingAgentId: row.starting_agent_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

/**
 * Convert Journey to Supabase row format (camelCase → snake_case)
 */
function toSupabaseRow(journey: Journey, userId: string): Omit<SupabaseJourneyRow, 'created_at' | 'updated_at'> {
  return {
    id: journey.id,
    user_id: userId,
    name: journey.name,
    description: journey.description || '',
    system_prompt: journey.systemPrompt,
    voice: journey.voice || null,
    agents: journey.agents || [],
    starting_agent_id: journey.startingAgentId,
    version: journey.version || '1.0.0',
  };
}

/**
 * List all journeys for a user
 */
export async function listUserJourneys(userId: string): Promise<JourneyListItem[]> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('journeys')
    .select('id, name, description, agents, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Failed to list journeys:', error);
    throw error;
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    agentCount: Array.isArray(row.agents) ? row.agents.length : 0,
    updatedAt: row.updated_at,
  }));
}

/**
 * Load a specific journey by ID
 */
export async function loadUserJourney(journeyId: string): Promise<Journey | null> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('journeys')
    .select('*')
    .eq('id', journeyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Not found
      return null;
    }
    console.error('Failed to load journey:', error);
    throw error;
  }

  return data ? toJourney(data as SupabaseJourneyRow) : null;
}

/**
 * Save a journey (create or update)
 */
export async function saveUserJourney(journey: Journey, userId: string): Promise<Journey> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const isNew = !journey.id || journey.id.startsWith('new-');
  const journeyId = isNew ? uuidv4() : journey.id;

  const journeyWithId = { ...journey, id: journeyId };
  const row = toSupabaseRow(journeyWithId, userId);

  if (isNew) {
    // Insert new journey
    const { data, error } = await supabase
      .from('journeys')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Failed to create journey:', error);
      throw error;
    }

    return toJourney(data as SupabaseJourneyRow);
  } else {
    // Update existing journey
    const { data, error } = await supabase
      .from('journeys')
      .update({
        name: row.name,
        description: row.description,
        system_prompt: row.system_prompt,
        voice: row.voice,
        agents: row.agents,
        starting_agent_id: row.starting_agent_id,
        version: row.version,
      })
      .eq('id', journeyId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update journey:', error);
      throw error;
    }

    return toJourney(data as SupabaseJourneyRow);
  }
}

/**
 * Delete a journey by ID
 */
export async function deleteUserJourney(journeyId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error('Supabase not configured');
  }

  const { error } = await supabase
    .from('journeys')
    .delete()
    .eq('id', journeyId);

  if (error) {
    console.error('Failed to delete journey:', error);
    throw error;
  }

  return true;
}

/**
 * Duplicate a journey
 */
export async function duplicateUserJourney(journeyId: string, userId: string): Promise<Journey | null> {
  const original = await loadUserJourney(journeyId);
  if (!original) return null;

  // Deep clone the journey
  const duplicate: Journey = JSON.parse(JSON.stringify(original));

  // Generate new IDs
  duplicate.id = uuidv4();
  duplicate.name = `${original.name} (Copy)`;
  duplicate.createdAt = new Date().toISOString();
  duplicate.updatedAt = new Date().toISOString();

  // Generate new IDs for agents and update references
  const idMapping: Record<string, string> = {};
  duplicate.agents = duplicate.agents.map(agent => {
    const newId = uuidv4();
    idMapping[agent.id] = newId;
    return { ...agent, id: newId };
  });

  // Update handoff references
  duplicate.agents = duplicate.agents.map(agent => ({
    ...agent,
    handoffs: agent.handoffs.map(oldId => idMapping[oldId] || oldId),
  }));

  // Update starting agent ID
  duplicate.startingAgentId = idMapping[duplicate.startingAgentId] || duplicate.startingAgentId;

  return saveUserJourney(duplicate, userId);
}

/**
 * Check if a journey exists for a user
 */
export async function journeyExists(journeyId: string, userId: string): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured) {
    return false;
  }

  const { data, error } = await supabase
    .from('journeys')
    .select('id')
    .eq('id', journeyId)
    .eq('user_id', userId)
    .single();

  if (error) {
    return false;
  }

  return !!data;
}
