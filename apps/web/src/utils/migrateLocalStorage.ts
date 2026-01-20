/**
 * LocalStorage to Cloud Migration Utility
 *
 * Migrates user-created journeys from localStorage to the cloud database.
 * Runs once per user on first login after this feature ships.
 */

import { saveUserJourney } from '../services/api/journeyService';
import { Journey } from '../types/journey';
import { isDefaultJourney } from '../lib/voiceAgent/examples';

const STORAGE_KEY = 'voice-agent-journeys';
const MIGRATION_FLAG_KEY = 'voice-agent-migrated-to-cloud';

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: string[];
  alreadyMigrated: boolean;
}

export function isMigrationComplete(userId: string): boolean {
  try {
    const migratedUserId = localStorage.getItem(MIGRATION_FLAG_KEY);
    return migratedUserId === userId;
  } catch {
    return false;
  }
}

function markMigrationComplete(userId: string): void {
  try {
    localStorage.setItem(MIGRATION_FLAG_KEY, userId);
  } catch (error) {
    console.error('Failed to mark migration complete:', error);
  }
}

function getLocalStorageJourneys(): Journey[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to read localStorage journeys:', error);
    return [];
  }
}

function clearMigratedJourneys(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Cleared localStorage journeys after migration');
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

export async function migrateLocalStorageToCloud(
  userId: string,
  clearAfterMigration = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    migrated: 0,
    skipped: 0,
    errors: [],
    alreadyMigrated: false,
  };

  if (isMigrationComplete(userId)) {
    result.alreadyMigrated = true;
    console.log('Migration already completed for this user');
    return result;
  }

  const localJourneys = getLocalStorageJourneys();

  if (localJourneys.length === 0) {
    markMigrationComplete(userId);
    console.log('No localStorage journeys to migrate');
    return result;
  }

  console.log(`Found ${localJourneys.length} journeys in localStorage`);

  for (const journey of localJourneys) {
    if (isDefaultJourney(journey.id)) {
      result.skipped++;
      console.log(`Skipped default journey: ${journey.name}`);
      continue;
    }

    try {
      await saveUserJourney(journey);
      result.migrated++;
      console.log(`Migrated journey: ${journey.name}`);
    } catch (error) {
      const errorMsg = `Failed to migrate "${journey.name}": ${error}`;
      result.errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  markMigrationComplete(userId);

  if (clearAfterMigration && result.errors.length === 0 && result.migrated > 0) {
    clearMigratedJourneys();
  }

  console.log(`Migration complete: ${result.migrated} migrated, ${result.skipped} skipped`);
  if (result.errors.length > 0) {
    console.warn(`${result.errors.length} errors during migration`);
  }

  return result;
}

export function resetMigrationFlag(): void {
  try {
    localStorage.removeItem(MIGRATION_FLAG_KEY);
    console.log('Migration flag reset');
  } catch (error) {
    console.error('Failed to reset migration flag:', error);
  }
}
