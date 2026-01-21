/**
 * Example Journeys Registry
 * 
 * Default journeys that are always available to all users.
 * These are included in the codebase and loaded on-demand.
 */

import { Journey } from '../../../types/journey';
import { createPostWebPQJourney } from './postWebPQJourney';
import { createGadPhq2Journey } from './gadPhq2Journey';
import { createOrbIntakeJourney } from './orbIntakeJourney';

/**
 * Load all default example journeys
 * These are seeded for new users
 */
export async function loadDefaultJourneys(): Promise<Journey[]> {
  try {
    const [intakeCall, mentalHealth, orbIntake] = await Promise.all([
      createPostWebPQJourney(),
      createGadPhq2Journey(),
      createOrbIntakeJourney(),
    ]);

    return [intakeCall, mentalHealth, orbIntake];
  } catch (error) {
    console.error('Failed to load default journeys:', error);
    return [];
  }
}

/**
 * Check if a journey ID is a default (non-deletable) journey
 */
export function isDefaultJourney(journeyId: string): boolean {
  return [
    'default-post-web-pq',
    'default-gad-phq2',
    'default-dry-january',
    'default-orb-intake',
  ].includes(journeyId);
}

/**
 * Get default journey IDs
 */
export function getDefaultJourneyIds(): string[] {
  return [
    'default-post-web-pq',
    'default-gad-phq2',
    'default-dry-january',
    'default-orb-intake',
  ];
}

