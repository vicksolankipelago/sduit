import { Journey, JourneyListItem, JourneyExport } from '../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadDefaultJourneys, isDefaultJourney } from '../lib/voiceAgent/examples';
import * as journeyApi from './api/journeyService';

const STORAGE_KEY = 'voice-agent-journeys';
const STORAGE_VERSION = '1.0.0';

let defaultJourneysCache: Journey[] | null = null;

async function getDefaultJourneys(): Promise<Journey[]> {
  if (!defaultJourneysCache) {
    defaultJourneysCache = await loadDefaultJourneys();
    console.log(`Loaded ${defaultJourneysCache.length} default journeys from codebase`);
  }
  return defaultJourneysCache;
}

function getLocalStorageJourneys(): Journey[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get localStorage journeys:', error);
    return [];
  }
}

function cleanupDefaultJourneysFromLocalStorage(): void {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return;

    const journeys = JSON.parse(data);
    const defaultJourneyNames = [
      'Post-Web PQ Voice Intake',
      'Intake Call',
      'GAD-2 / PHQ-2 Mental Health Screening',
      'Mental Health Screening',
      'Dry January Intake Call',
    ];
    const defaultIds = ['default-post-web-pq', 'default-gad-phq2', 'default-dry-january'];

    const userJourneysOnly = journeys.filter(
      (j: any) => !defaultIds.includes(j.id) && !defaultJourneyNames.includes(j.name)
    );

    if (userJourneysOnly.length !== journeys.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userJourneysOnly));
      console.log(`Cleaned up ${journeys.length - userJourneysOnly.length} old default journey(s)`);
    }
  } catch (error) {
    console.error('Failed to cleanup:', error);
  }
}

export async function listJourneys(): Promise<JourneyListItem[]> {
  try {
    cleanupDefaultJourneysFromLocalStorage();
    const defaultJourneys = await getDefaultJourneys();

    let userJourneys: JourneyListItem[] = [];
    try {
      userJourneys = await journeyApi.listUserJourneys();
      console.log(`Loaded ${userJourneys.length} journeys from API`);
    } catch (error) {
      console.error('Failed to load from API, using localStorage:', error);
      const localJourneys = getLocalStorageJourneys();
      userJourneys = localJourneys.map((journey) => ({
        id: journey.id,
        name: journey.name,
        description: journey.description,
        agentCount: journey.agents?.length || 0,
        updatedAt: journey.updatedAt,
      }));
    }

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

export async function loadJourney(id: string): Promise<Journey | null> {
  try {
    if (isDefaultJourney(id)) {
      const defaultJourneys = await getDefaultJourneys();
      return defaultJourneys.find((j) => j.id === id) || null;
    }

    try {
      const journey = await journeyApi.loadUserJourney(id);
      if (journey) {
        console.log(`Loaded journey from API: ${journey.name}`);
        return journey;
      }
    } catch (error) {
      console.error('Failed to load from API, trying localStorage:', error);
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return null;
    const journeys: Journey[] = JSON.parse(data);
    return journeys.find((j) => j.id === id) || null;
  } catch (error) {
    console.error(`Failed to load journey ${id}:`, error);
    return null;
  }
}

export async function saveJourney(journey: Journey): Promise<boolean> {
  try {
    if (isDefaultJourney(journey.id)) {
      console.warn(`Cannot save default journey: ${journey.name}. Default journeys are read-only.`);
      return false;
    }

    journey.updatedAt = new Date().toISOString();

    try {
      await journeyApi.saveUserJourney(journey);
      console.log(`Saved journey to API: ${journey.name}`);
      return true;
    } catch (error) {
      console.error('Failed to save to API, falling back to localStorage:', error);
    }

    const data = localStorage.getItem(STORAGE_KEY);
    let journeys: Journey[] = data ? JSON.parse(data) : [];
    const existingIndex = journeys.findIndex((j) => j.id === journey.id);

    if (existingIndex >= 0) {
      journeys[existingIndex] = journey;
      console.log(`Updated journey: ${journey.name}`);
    } else {
      if (!journey.id) {
        journey.id = uuidv4();
      }
      if (!journey.createdAt) {
        journey.createdAt = new Date().toISOString();
      }
      journeys.push(journey);
      console.log(`Created journey: ${journey.name}`);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
    return true;
  } catch (error) {
    console.error('Failed to save journey:', error);
    return false;
  }
}

export async function deleteJourney(id: string): Promise<boolean> {
  try {
    if (isDefaultJourney(id)) {
      console.warn(`Cannot delete default journey: ${id}. Default journeys are read-only.`);
      return false;
    }

    try {
      await journeyApi.deleteUserJourney(id);
      console.log(`Deleted journey from API: ${id}`);
      return true;
    } catch (error) {
      console.error('Failed to delete from API, trying localStorage:', error);
    }

    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return false;

    let journeys: Journey[] = JSON.parse(data);
    const journey = journeys.find((j) => j.id === id);
    journeys = journeys.filter((j) => j.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(journeys));
    console.log(`Deleted journey: ${journey?.name || id}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete journey ${id}:`, error);
    return false;
  }
}

export async function exportJourney(id: string): Promise<JourneyExport | null> {
  try {
    const journey = await loadJourney(id);
    if (!journey) return null;

    return {
      journey,
      exportedAt: new Date().toISOString(),
      exportVersion: STORAGE_VERSION,
    };
  } catch (error) {
    console.error(`Failed to export journey ${id}:`, error);
    return null;
  }
}

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

  console.log(`Downloaded journey: ${exportData.journey.name}`);
}

export async function importJourney(jsonString: string): Promise<Journey | null> {
  try {
    const exportData: JourneyExport = JSON.parse(jsonString);
    if (!exportData.journey) {
      throw new Error('Invalid journey export format');
    }

    const journey = exportData.journey;
    journey.id = uuidv4();
    journey.createdAt = new Date().toISOString();
    journey.updatedAt = new Date().toISOString();

    if (await saveJourney(journey)) {
      console.log(`Imported journey: ${journey.name}`);
      return journey;
    }
    return null;
  } catch (error) {
    console.error('Failed to import journey:', error);
    return null;
  }
}

export async function duplicateJourney(id: string): Promise<Journey | null> {
  try {
    try {
      const duplicate = await journeyApi.duplicateUserJourney(id);
      if (duplicate) {
        console.log(`Duplicated journey via API: ${duplicate.name}`);
        return duplicate;
      }
    } catch (error) {
      console.error('Failed to duplicate via API, trying locally:', error);
    }

    const original = await loadJourney(id);
    if (!original) return null;

    const duplicate: Journey = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      name: `${original.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const idMapping: Record<string, string> = {};
    duplicate.agents = duplicate.agents.map((agent) => {
      const newId = uuidv4();
      idMapping[agent.id] = newId;
      return { ...agent, id: newId };
    });

    duplicate.agents = duplicate.agents.map((agent) => ({
      ...agent,
      handoffs: agent.handoffs.map((oldId) => idMapping[oldId] || oldId),
    }));

    duplicate.startingAgentId = idMapping[duplicate.startingAgentId] || duplicate.startingAgentId;

    if (await saveJourney(duplicate)) {
      console.log(`Duplicated journey: ${duplicate.name}`);
      return duplicate;
    }
    return null;
  } catch (error) {
    console.error(`Failed to duplicate journey ${id}:`, error);
    return null;
  }
}

export function clearAllJourneys(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Cleared all local journeys');
    return true;
  } catch (error) {
    console.error('Failed to clear journeys:', error);
    return false;
  }
}
