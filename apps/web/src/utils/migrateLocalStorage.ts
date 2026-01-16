/**
 * LocalStorage to Supabase Migration Utility
 *
 * Migrates user-created journeys from localStorage to Supabase.
 * Runs once per user on first login after this feature ships.
 */

import { supabase, isSupabaseConfigured } from '@sduit/shared/auth';
import { saveUserJourney } from '../services/supabase/journeyService';
import { Journey } from '../types/journey';
import { isDefaultJourney } from '../lib/voiceAgent/examples';

const STORAGE_KEY = 'voice-agent-journeys';
const MIGRATION_FLAG_KEY = 'voice-agent-migrated-to-supabase';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
  alreadyMigrated: boolean;
}

/**
 * Check if migration has already been completed for this user
 */
export function isMigrationComplete(userId: string): boolean {
  try {
    const migratedUserId = localStorage.getItem(MIGRATION_FLAG_KEY);
    return migratedUserId === userId;
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete for this user
 */
function markMigrationComplete(userId: string): void {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, userId);
  } catch (error) {
    console.error('Failed to mark migration complete:', error);
  }
}

/**
 * Get journeys from localStorage
 */
function getLocalStorageJourneys(): Journey[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to read localStorage journeys:', error);
    return [];
  }
}

/**
 * Clear migrated journeys from localStorage
 */
function clearMigratedJourneys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('🧹 Cleared localStorage journeys after migration');
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

/**
 * Migrate localStorage journeys to Supabase
 *
 * This function:
 * 1. Checks if migration was already done for this user
 * 2. Reads journeys from localStorage
 * 3. Filters out default journeys (they're in the codebase)
 * 4. Saves user-created journeys to Supabase
 * 5. Marks migration as complete
 * 6. Optionally clears localStorage after successful migration
 *
 * @param userId - The authenticated user's ID
 * @param clearAfterMigration - Whether to clear localStorage after successful migration (default: true)
 * @returns Migration result with counts and errors
 */
export async function migrateLocalStorageToSupabase(
  userId: string,
  clearAfterMigration = false // Changed to false - don't auto-clear, let user decide
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    errors: [],
    alreadyMigrated: false,
  };

  // Check if Supabase is configured
  if (!supabase || !isSupabaseConfigured) {
    result.errors.push('Supabase not configured');
    return result;
  }

  // Check if migration was already completed
  if (isMigrationComplete(userId)) {
    result.alreadyMigrated = true;
    console.log('✅ Migration already completed for this user');
    return result;
  }

  // Get journeys from localStorage
  const localJourneys = getLocalStorageJourneys();

  if (localJourneys.length === 0) {
    // No journeys to migrate, mark as complete
    markMigrationComplete(userId);
    console.log('ℹ️ No localStorage journeys to migrate');
    return result;
  }

  console.log(`📦 Found ${localJourneys.length} journeys in localStorage`);

  // Migrate each journey
  for (const journey of localJourneys) {
    // Skip default journeys (they're loaded from codebase)
    if (isDefaultJourney(journey.id)) {
      result.skipped++;
      console.log(`⏭️ Skipped default journey: ${journey.name}`);
      continue;
    }

    try {
      await saveUserJourney(journey, userId);
      result.migrated++;
      console.log(`☁️ Migrated journey: ${journey.name}`);
    } catch (error) {
      const errorMsg = `Failed to migrate "${journey.name}": ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  // Mark migration as complete
  markMigrationComplete(userId);

  // Clear localStorage if requested and no errors
  if (clearAfterMigration && result.errors.length === 0 && result.migrated > 0) {
    clearMigratedJourneys();
  }

  // Log summary
  console.log(`✅ Migration complete: ${result.migrated} migrated, ${result.skipped} skipped`);
  if (result.errors.length > 0) {
    console.warn(`⚠️ ${result.errors.length} errors during migration`);
  }

  return result;
}

/**
 * Reset migration flag (for testing purposes)
 */
export function resetMigrationFlag(): void {
  try {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('🔄 Migration flag reset');
  } catch (error) {
    console.error('Failed to reset migration flag:', error);
  }
}
