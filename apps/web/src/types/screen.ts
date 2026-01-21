/**
 * Standalone Screen Types
 *
 * Type definitions for standalone screens that exist independently
 * and can be reused across multiple flows/agents.
 */

import { Screen } from './journey';

/**
 * StandaloneScreen - A screen that exists independently of any flow/agent
 * Extends the base Screen interface with metadata for management
 */
export interface StandaloneScreen extends Screen {
  /** Optional description for the screen */
  description?: string;
  /** Tags for categorization and filtering */
  tags?: string[];
  /** ISO timestamp when the screen was created */
  createdAt: string;
  /** ISO timestamp when the screen was last updated */
  updatedAt: string;
  /** Version identifier */
  version?: string;
}

/**
 * StandaloneScreenListItem - Lightweight representation for list views
 */
export interface StandaloneScreenListItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  /** Number of sections in the screen */
  sectionCount: number;
  /** Total number of elements across all sections */
  elementCount: number;
  /** ISO timestamp when the screen was last updated */
  updatedAt: string;
  /** Source info for screens embedded in journeys */
  source?: {
    type: 'global' | 'journey';
    journeyId?: string;
    journeyName?: string;
    agentId?: string;
    agentName?: string;
  };
}

/**
 * Helper function to create a new standalone screen
 */
export function createStandaloneScreen(
  id: string,
  title: string = 'New Screen'
): StandaloneScreen {
  const now = new Date().toISOString();
  return {
    id,
    title,
    description: '',
    tags: [],
    sections: [],
    events: [],
    state: {},
    hidesBackButton: false,
    createdAt: now,
    updatedAt: now,
    version: '1.0.0',
  };
}

/**
 * Helper function to convert a StandaloneScreen to a list item
 */
export function screenToListItem(screen: StandaloneScreen): StandaloneScreenListItem {
  const elementCount = screen.sections.reduce(
    (total, section) => total + (section.elements?.length || 0),
    0
  );

  return {
    id: screen.id,
    title: screen.title,
    description: screen.description,
    tags: screen.tags,
    sectionCount: screen.sections.length,
    elementCount,
    updatedAt: screen.updatedAt,
  };
}

/**
 * Helper function to convert a basic Screen to a StandaloneScreen
 */
export function screenToStandalone(
  screen: Screen,
  metadata?: Partial<Pick<StandaloneScreen, 'description' | 'tags'>>
): StandaloneScreen {
  const now = new Date().toISOString();
  return {
    ...screen,
    description: metadata?.description || '',
    tags: metadata?.tags || [],
    createdAt: now,
    updatedAt: now,
    version: '1.0.0',
  };
}
