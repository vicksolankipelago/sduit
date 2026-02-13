import {
  Journey,
  JourneyAiProposalApplyRequest,
  JourneyAiProposalApplyResponse,
  JourneyAiProposalRequest,
  JourneyAiProposalResponse,
  JourneyListItem,
  PublishedJourney,
} from '../../types/journey';
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
    try {
      return await api.put<Journey>(`/api/journeys/${journey.id}`, journey);
    } catch (error) {
      // If PUT fails with 404 (journey doesn't exist in DB), create it instead
      if (error instanceof ApiError && error.status === 404) {
        console.log('Journey not found in database, creating new one...');
        return api.post<Journey>('/api/journeys', journey);
      }
      throw error;
    }
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

export async function createJourneyAiProposal(
  journeyId: string,
  request: JourneyAiProposalRequest
): Promise<JourneyAiProposalResponse> {
  return api.post<JourneyAiProposalResponse>(`/api/journeys/${journeyId}/ai/proposals`, request);
}

export async function applyJourneyAiProposal(
  journeyId: string,
  proposalId: string,
  request: JourneyAiProposalApplyRequest = {}
): Promise<JourneyAiProposalApplyResponse> {
  return api.post<JourneyAiProposalApplyResponse>(
    `/api/journeys/${journeyId}/ai/proposals/${proposalId}/apply`,
    request
  );
}

// Production endpoints - fetch from Object Storage (shared between dev and prod databases)
// These are public read-only endpoints, no credentials needed
export async function listProductionFlows(): Promise<{ journeyId: string; name: string; description: string; publishedAt: string; agentCount?: number }[]> {
  return api.get('/api/journeys/production/list', {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  });
}

export async function getProductionFlow(journeyId: string): Promise<PublishedJourney | null> {
  try {
    return await api.get<PublishedJourney>(`/api/journeys/production/${journeyId}?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// Production management endpoints - delete/update flows directly in Object Storage
export async function deleteProductionFlow(journeyId: string): Promise<boolean> {
  await api.delete<{ deleted: boolean }>(`/api/journeys/production/${journeyId}`);
  return true;
}

export async function updateProductionFlow(journeyId: string, updates: Partial<Journey>): Promise<Journey> {
  return api.put<Journey>(`/api/journeys/production/${journeyId}`, updates);
}
