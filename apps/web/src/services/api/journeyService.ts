import { Journey, JourneyListItem, PublishedJourney } from '../../types/journey';

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}

export async function listUserJourneys(): Promise<JourneyListItem[]> {
  const response = await fetch('/api/journeys', {
    credentials: 'include',
  });
  return handleResponse<JourneyListItem[]>(response);
}

export async function loadUserJourney(journeyId: string): Promise<Journey | null> {
  const response = await fetch(`/api/journeys/${journeyId}`, {
    credentials: 'include',
  });
  
  if (response.status === 404) {
    return null;
  }
  
  return handleResponse<Journey>(response);
}

export async function saveUserJourney(journey: Journey): Promise<Journey> {
  const isNew = !journey.id || journey.id.startsWith('new-');
  
  if (isNew) {
    const response = await fetch('/api/journeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(journey),
    });
    return handleResponse<Journey>(response);
  } else {
    const response = await fetch(`/api/journeys/${journey.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(journey),
    });
    return handleResponse<Journey>(response);
  }
}

export async function deleteUserJourney(journeyId: string): Promise<boolean> {
  const response = await fetch(`/api/journeys/${journeyId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse<{ success: boolean }>(response);
  return true;
}

export async function duplicateUserJourney(journeyId: string): Promise<Journey | null> {
  const response = await fetch(`/api/journeys/${journeyId}/duplicate`, {
    method: 'POST',
    credentials: 'include',
  });
  
  if (response.status === 404) {
    return null;
  }
  
  return handleResponse<Journey>(response);
}

export async function journeyExists(journeyId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/journeys/${journeyId}`, {
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createJourney(journey: Journey): Promise<Journey> {
  const response = await fetch('/api/journeys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(journey),
  });
  return handleResponse<Journey>(response);
}

export async function publishJourney(journeyId: string): Promise<{ success: boolean; publishedJourney?: { id: string; journeyId: string; name: string; publishedAt: string } }> {
  const response = await fetch(`/api/journeys/${journeyId}/publish`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function unpublishJourney(journeyId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/journeys/${journeyId}/unpublish`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function getPublishedJourney(journeyId: string): Promise<PublishedJourney | null> {
  const response = await fetch(`/api/journeys/${journeyId}/published`, {
    credentials: 'include',
  });
  
  if (response.status === 404) {
    return null;
  }
  
  return handleResponse<PublishedJourney>(response);
}

export async function listPublishedJourneys(): Promise<{ id: string; journeyId: string; name: string; description: string; publishedAt: string }[]> {
  const response = await fetch('/api/journeys/published/all', {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function getEnvironment(): Promise<{ isProduction: boolean; environment: string }> {
  const response = await fetch('/api/journeys/environment', {
    credentials: 'include',
  });
  return handleResponse(response);
}

// Production endpoints - fetch from Object Storage (shared between dev and prod databases)
// These are public read-only endpoints, no credentials needed
export async function listProductionFlows(): Promise<{ journeyId: string; name: string; description: string; publishedAt: string }[]> {
  const response = await fetch('/api/journeys/production/list');
  return handleResponse(response);
}

export async function getProductionFlow(journeyId: string): Promise<PublishedJourney | null> {
  const response = await fetch(`/api/journeys/production/${journeyId}`);
  
  if (response.status === 404) {
    return null;
  }
  
  return handleResponse<PublishedJourney>(response);
}
