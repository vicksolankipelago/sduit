import { Journey, JourneyListItem, PublishedJourney } from '../../types/journey';
import { api, ApiError } from './apiClient';

export async function listUserJourneys(): Promise<JourneyListItem[]> {
  return api.get<JourneyListItem[]>('/api/journeys');
}

export async function loadUserJourney(journeyId: string): Promise<Journey | null> {
  try {
    return await api.get<Journey>(`/api/journeys/${journeyId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveUserJourney(journey: Journey): Promise<Journey> {
  const isNew = !journey.id || journey.id.startsWith('new-');

  if (isNew) {
    return api.post<Journey>('/api/journeys', journey);
  } else {
    return api.put<Journey>(`/api/journeys/${journey.id}`, journey);
  }
}

export async function deleteUserJourney(journeyId: string): Promise<boolean> {
  await api.delete<{ deleted: boolean }>(`/api/journeys/${journeyId}`);
  return true;
}

export async function duplicateUserJourney(journeyId: string): Promise<Journey | null> {
  try {
    return await api.post<Journey>(`/api/journeys/${journeyId}/duplicate`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function journeyExists(journeyId: string): Promise<boolean> {
  try {
    await api.get<Journey>(`/api/journeys/${journeyId}`);
    return true;
  } catch {
    return false;
  }
}

export async function createJourney(journey: Journey): Promise<Journey> {
  return api.post<Journey>('/api/journeys', journey);
}

export async function publishJourney(journeyId: string): Promise<{ success: boolean; publishedJourney?: { id: string; journeyId: string; name: string; publishedAt: string } }> {
  return api.post(`/api/journeys/${journeyId}/publish`);
}

export async function unpublishJourney(journeyId: string): Promise<{ success: boolean }> {
  return api.post(`/api/journeys/${journeyId}/unpublish`);
}

export async function getPublishedJourney(journeyId: string): Promise<PublishedJourney | null> {
  try {
    return await api.get<PublishedJourney>(`/api/journeys/${journeyId}/published`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function listPublishedJourneys(): Promise<{ id: string; journeyId: string; name: string; description: string; publishedAt: string }[]> {
  return api.get('/api/journeys/published/all');
}

export async function getEnvironment(): Promise<{ isProduction: boolean; environment: string }> {
  return api.get('/api/journeys/environment');
}

// Production endpoints - fetch from Object Storage (shared between dev and prod databases)
// These are public read-only endpoints, no credentials needed
export async function listProductionFlows(): Promise<{ journeyId: string; name: string; description: string; publishedAt: string }[]> {
  return api.get('/api/journeys/production/list');
}

export async function getProductionFlow(journeyId: string): Promise<PublishedJourney | null> {
  try {
    return await api.get<PublishedJourney>(`/api/journeys/production/${journeyId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
