import { Journey, JourneyListItem, JourneyExport } from '../types/journey';
import { v4 as uuidv4 } from 'uuid';
import { loadDefaultJourneys } from '../lib/voiceAgent/examples';
import * as journeyApi from './api/journeyService';

const STORAGE_KEY = 'voice-agent-journeys';
const STORAGE_VERSION = '1.0.0';
const SEEDED_KEY = 'journeys-seeded';

async function seedDefaultJourneysIfNeeded(): Promise<void> {
  try {
    if (localStorage.getItem(SEEDED_KEY)) {
      return;
    }

    const existingJourneys = await journeyApi.listUserJourneys();
    if (existingJourneys.length > 0) {
      localStorage.setItem(SEEDED_KEY, 'true');
      return;
    }

    console.log('No journeys found, seeding default journeys...');
    const defaultJourneys = await loadDefaultJourneys();
    
    for (const journey of defaultJourneys) {
      journey.id = uuidv4();
      await journeyApi.createJourney(journey);
      console.log(`Seeded default journey: ${journey.name}`);
    }
    
    localStorage.setItem(SEEDED_KEY, 'true');
    console.log(`Seeded ${defaultJourneys.length} default journeys`);
  } catch (error) {
    console.error('Failed to seed default journeys:', error);
  }
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

export async function listJourneys(): Promise<JourneyListItem[]> {
  try {
    await seedDefaultJourneysIfNeeded();

    let journeys: JourneyListItem[] = [];
    try {
      journeys = await journeyApi.listUserJourneys();
      console.log(`Loaded ${journeys.length} journeys from API`);
    } catch (error) {
      console.error('Failed to load from API, using localStorage:', error);
      const localJourneys = getLocalStorageJourneys();
      journeys = localJourneys.map((journey) => ({
        id: journey.id,
        name: journey.name,
        description: journey.description,
        agentCount: journey.agents?.length || 0,
        updatedAt: journey.updatedAt,
      }));
    }

    return journeys;
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
