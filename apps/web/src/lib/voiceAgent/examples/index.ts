/**
 * Example Journeys Registry
 * 
 * Default journeys that are always available to all users.
 * These are included in the codebase and loaded on-demand.
 */

import { Journey } from '../../../types/journey';
import { createPostWebPQJourney } from './postWebPQJourney';
import { createGadPhq2Journey } from './gadPhq2Journey';
import { createDryJanuaryJourney } from './dryJanuaryJourney';

/**
 * Load all default example journeys
 * These are always available and cannot be deleted
 */
export async function loadDefaultJourneys(): Promise<Journey[]> {
  try {
    const [intakeCall, mentalHealth, dryJanuary] = await Promise.all([
      createPostWebPQJourney(),
      createGadPhq2Journey(),
      createDryJanuaryJourney(),
    ]);

    // Assign fixed IDs so we can identify them
    intakeCall.id = 'default-post-web-pq';
    mentalHealth.id = 'default-gad-phq2';
    dryJanuary.id = 'default-dry-january';

    return [intakeCall, mentalHealth, dryJanuary];
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
  ];
}

