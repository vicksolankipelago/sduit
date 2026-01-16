/**
 * Journey Storage Service
 *
 * Handles CRUD operations for agent journeys.
 * Uses Supabase when authenticated, localStorage as fallback.
 * Default journeys are loaded from the codebase (not stored in DB or localStorage).
 */

import { Journey, JourneyListItem, JourneyExport } from '../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadDefaultJourneys, isDefaultJourney } from '../lib/voiceAgent/examples';
import { supabase, isSupabaseConfigured } from '@sduit/shared/auth';
import * as supabaseJourneyService from './supabase/journeyService';

const STORAGE_KEY = 'voice-agent-journeys';
const STORAGE_VERSION = '1.0.0';

// Cache for default journeys to avoid reloading on every call
let defaultJourneysCache: Journey[] | null = null;

/**
 * Get the current authenticated user ID
 * Returns null if not authenticated
 */
async function getCurrentUserId(): Promise<string | null> {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Load default journeys from codebase
 * These are always available and cannot be deleted
 */
async function getDefaultJourneys(): Promise<Journey[]> {
  if (!defaultJourneysCache) {
    defaultJourneysCache = await loadDefaultJourneys();
    console.log(`✨ Loaded ${defaultJourneysCache.length} default journeys from codebase`);
  }
  return defaultJourneysCache;
}

/**
 * Get user journeys from localStorage (fallback)
 */
function getLocalStorageJourneys(): Journey[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get localStorage journeys:', error);
    return [];
  }
}

/**
 * Get all journeys (default + user-created)
 * Uses Supabase if authenticated, localStorage otherwise
 */
export async function listJourneys(): Promise<JourneyListItem[]> {
  try {
    // Clean up old default journeys from localStorage FIRST
    cleanupDefaultJourneysFromLocalStorage();

    // Get default journeys from codebase
    const defaultJourneys = await getDefaultJourneys();

    // Get user journeys from appropriate source
    const userId = await getCurrentUserId();
    let userJourneys: JourneyListItem[] = [];

    if (userId && isSupabaseConfigured) {
      // Authenticated: use Supabase
      try {
        userJourneys = await supabaseJourneyService.listUserJourneys(userId);
        console.log(`☁️ Loaded ${userJourneys.length} journeys from Supabase`);
      } catch (error) {
        console.error('Failed to load from Supabase, falling back to localStorage:', error);
        const localJourneys = getLocalStorageJourneys();
        userJourneys = localJourneys.map((journey) => ({
          id: journey.id,
          name: journey.name,
          description: journey.description,
          agentCount: journey.agents?.length || 0,
          updatedAt: journey.updatedAt,
        }));
      }
    } else {
      // Not authenticated: use localStorage
      const localJourneys = getLocalStorageJourneys();
      userJourneys = localJourneys.map((journey) => ({
        id: journey.id,
        name: journey.name,
        description: journey.description,
        agentCount: journey.agents?.length || 0,
        updatedAt: journey.updatedAt,
      }));
    }

    // Default journeys first, then user journeys
    const defaultItems = defaultJourneys.map((journey) => ({
      id: journey.id,
      name: journey.name,
      description: journey.description,
      agentCount: journey.agents?.length || 0,
      updatedAt: journey.updatedAt,
    }));

    return [...defaultItems, ...userJourneys];
  } catch (error) {
    console.error('Failed to list journeys:', error);
    return [];
  }
}

/**
 * Clean up default journeys from localStorage
 * Runs automatically when listing journeys
 */
function cleanupDefaultJourneysFromLocalStorage(): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const journeys = JSON.parse(data);

    // List of all default journey names and IDs to remove
    const defaultJourneyNames = [
      'Post-Web PQ Voice Intake',
      'Intake Call',
      'GAD-2 / PHQ-2 Mental Health Screening',
      'Mental Health Screening',
      'Dry January Intake Call',
    ];

    const defaultIds = ['default-post-web-pq', 'default-gad-phq2', 'default-dry-january'];

    // Keep only user journeys (not default by ID or name)
    const userJourneysOnly = journeys.filter(
      (j: any) => !defaultIds.includes(j.id) && !defaultJourneyNames.includes(j.name)
    );

    if (userJourneysOnly.length !== journeys.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userJourneysOnly));
      console.log(
        `🧹 Cleaned up ${journeys.length - userJourneysOnly.length} old default journey(s)`
      );
    }
  } catch (error) {
    console.error('Failed to cleanup:', error);
  }
}

/**
 * Synchronous version for compatibility (returns empty array, use await listJourneys() instead)
 * @deprecated Use async listJourneys() instead
 */
export function listJourneysSync(): JourneyListItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const journeys: Journey[] = JSON.parse(data);

    return journeys.map((journey) => ({
      id: journey.id,
      name: journey.name,
      description: journey.description,
      agentCount: journey.agents?.length || 0,
      updatedAt: journey.updatedAt,
    }));
  } catch (error) {
    console.error('Failed to list journeys:', error);
    return [];
  }
}

/**
 * Load a specific journey by ID
 * Checks default journeys first, then Supabase/localStorage
 */
export async function loadJourney(id: string): Promise<Journey | null> {
  try {
    // Check if it's a default journey first
    if (isDefaultJourney(id)) {
      const defaultJourneys = await getDefaultJourneys();
      return defaultJourneys.find((j) => j.id === id) || null;
    }

    // Try Supabase if authenticated
    const userId = await getCurrentUserId();
    if (userId && isSupabaseConfigured) {
      try {
        const journey = await supabaseJourneyService.loadUserJourney(id);
        if (journey) {
          console.log(`☁️ Loaded journey from Supabase: ${journey.name}`);
          return journey;
        }
      } catch (error) {
        console.error('Failed to load from Supabase, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;

    const journeys: Journey[] = JSON.parse(data);
    return journeys.find((j) => j.id === id) || null;
  } catch (error) {
    console.error(`Failed to load journey ${id}:`, error);
    return null;
  }
}

/**
 * Save a journey (create or update)
 * Uses Supabase if authenticated, localStorage otherwise
 */
export async function saveJourney(journey: Journey): Promise<boolean> {
  try {
    // Prevent saving default journeys
    if (isDefaultJourney(journey.id)) {
      console.warn(
        `⚠️ Cannot save default journey: ${journey.name}. Default journeys are read-only.`
      );
      return false;
    }

    // Update timestamp
    journey.updatedAt = new Date().toISOString();

    // Try Supabase if authenticated
    const userId = await getCurrentUserId();
    if (userId && isSupabaseConfigured) {
      try {
        const saved = await supabaseJourneyService.saveUserJourney(journey, userId);
        console.log(`☁️ Saved journey to Supabase: ${saved.name}`);
        return true;
      } catch (error) {
        console.error('Failed to save to Supabase, falling back to localStorage:', error);
      }
    }

    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEY);
    let journeys: Journey[] = data ? JSON.parse(data) : [];

    // Check if journey exists
    const existingIndex = journeys.findIndex((j) => j.id === journey.id);

    if (existingIndex >= 0) {
      // Update existing
      journeys[existingIndex] = journey;
      console.log(`📝 Updated journey: ${journey.name}`);
    } else {
      // Create new
      if (!journey.id) {
        journey.id = uuidv4();
      }
      if (!journey.createdAt) {
        journey.createdAt = new Date().toISOString();
      }
      journeys.push(journey);
      console.log(`✨ Created journey: ${journey.name}`);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
    return true;
  } catch (error) {
    console.error('Failed to save journey:', error);
    return false;
  }
}

/**
 * Delete a journey by ID
 * Uses Supabase if authenticated, localStorage otherwise
 */
export async function deleteJourney(id: string): Promise<boolean> {
  try {
    // Prevent deleting default journeys
    if (isDefaultJourney(id)) {
      console.warn(`⚠️ Cannot delete default journey: ${id}. Default journeys are read-only.`);
      return false;
    }

    // Try Supabase if authenticated
    const userId = await getCurrentUserId();
    if (userId && isSupabaseConfigured) {
      try {
        await supabaseJourneyService.deleteUserJourney(id);
        console.log(`☁️ Deleted journey from Supabase: ${id}`);
        return true;
      } catch (error) {
        console.error('Failed to delete from Supabase, trying localStorage:', error);
      }
    }

    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return false;

    let journeys: Journey[] = JSON.parse(data);
    const journey = journeys.find((j) => j.id === id);

    journeys = journeys.filter((j) => j.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));

    console.log(`🗑️ Deleted journey: ${journey?.name || id}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete journey ${id}:`, error);
    return false;
  }
}

/**
 * Export a journey as JSON
 */
export async function exportJourney(id: string): Promise<JourneyExport | null> {
  try {
    const journey = await loadJourney(id);
    if (!journey) return null;

    const exportData: JourneyExport = {
      journey,
      exportedAt: new Date().toISOString(),
      exportVersion: STORAGE_VERSION,
    };

    return exportData;
  } catch (error) {
    console.error(`Failed to export journey ${id}:`, error);
    return null;
  }
}

/**
 * Download journey as JSON file
 */
export async function downloadJourneyAsJSON(id: string): Promise<void> {
  const exportData = await exportJourney(id);
  if (!exportData) return;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exportData.journey.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`💾 Downloaded journey: ${exportData.journey.name}`);
}

/**
 * Import a journey from JSON
 */
export async function importJourney(jsonString: string): Promise<Journey | null> {
  try {
    const exportData: JourneyExport = JSON.parse(jsonString);

    // Validate export format
    if (!exportData.journey) {
      throw new Error('Invalid journey export format');
    }

    const journey = exportData.journey;

    // Generate new ID to avoid conflicts
    journey.id = uuidv4();
    journey.createdAt = new Date().toISOString();
    journey.updatedAt = new Date().toISOString();

    // Save imported journey
    if (await saveJourney(journey)) {
      console.log(`📥 Imported journey: ${journey.name}`);
      return journey;
    }

    return null;
  } catch (error) {
    console.error('Failed to import journey:', error);
    return null;
  }
}

/**
 * Duplicate an existing journey
 * Uses Supabase if authenticated, localStorage otherwise
 */
export async function duplicateJourney(id: string): Promise<Journey | null> {
  try {
    // Try Supabase if authenticated
    const userId = await getCurrentUserId();
    if (userId && isSupabaseConfigured) {
      try {
        const duplicate = await supabaseJourneyService.duplicateUserJourney(id, userId);
        if (duplicate) {
          console.log(`☁️ Duplicated journey in Supabase: ${duplicate.name}`);
          return duplicate;
        }
      } catch (error) {
        console.error('Failed to duplicate in Supabase, trying localStorage:', error);
      }
    }

    // Fallback: load and save manually
    const original = await loadJourney(id);
    if (!original) return null;

    const duplicate: Journey = {
      ...JSON.parse(JSON.stringify(original)), // Deep clone
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Generate new IDs for agents to avoid conflicts
    const idMapping: Record<string, string> = {};
    duplicate.agents = duplicate.agents.map((agent) => {
      const newId = uuidv4();
      idMapping[agent.id] = newId;
      return { ...agent, id: newId };
    });

    // Update handoff references
    duplicate.agents = duplicate.agents.map((agent) => ({
      ...agent,
      handoffs: agent.handoffs.map((oldId) => idMapping[oldId] || oldId),
    }));

    // Update starting agent ID
    duplicate.startingAgentId = idMapping[duplicate.startingAgentId] || duplicate.startingAgentId;

    if (await saveJourney(duplicate)) {
      console.log(`📋 Duplicated journey: ${duplicate.name}`);
      return duplicate;
    }

    return null;
  } catch (error) {
    console.error(`Failed to duplicate journey ${id}:`, error);
    return null;
  }
}

/**
 * Clear all user journeys from localStorage (use with caution)
 * Does not affect Supabase data
 */
export function clearAllJourneys(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🗑️ Cleared all local journeys');
    return true;
  } catch (error) {
    console.error('Failed to clear journeys:', error);
    return false;
  }
}
