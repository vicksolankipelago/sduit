import { SessionExport } from '../../utils/transcriptExport';

export interface SessionListItem {
  id: string;
  sessionId: string;
  journeyName: string | null;
  agentName: string | null;
  durationSeconds: number;
  messageCount: number;
  createdAt: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    window.location.href = '/api/login';
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}

export async function saveSession(sessionExport: SessionExport): Promise<void> {
  const response = await fetch('/api/voice-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(sessionExport),
  });
  await handleResponse<{ success: boolean }>(response);
}

export async function listUserSessions(limit = 50, offset = 0): Promise<SessionListItem[]> {
  const response = await fetch(`/api/voice-sessions?limit=${limit}&offset=${offset}`, {
    credentials: 'include',
  });
  return handleResponse<SessionListItem[]>(response);
}

export async function loadSession(sessionId: string): Promise<SessionExport | null> {
  const response = await fetch(`/api/voice-sessions/${sessionId}`, {
    credentials: 'include',
  });
  
  if (response.status === 404) {
    return null;
  }
  
  return handleResponse<SessionExport>(response);
}

export async function loadSessionById(id: string): Promise<SessionExport | null> {
  return loadSession(id);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  const response = await fetch(`/api/voice-sessions/${sessionId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse<{ success: boolean }>(response);
  return true;
}

export async function deleteSessionById(id: string): Promise<boolean> {
  return deleteSession(id);
}

export async function getSessionCount(): Promise<number> {
  const response = await fetch('/api/voice-sessions/count', {
    credentials: 'include',
  });
  const data = await handleResponse<{ count: number }>(response);
  return data.count;
}

export async function getSessionsForJourney(journeyId: string, limit = 20): Promise<SessionListItem[]> {
  const response = await fetch(`/api/voice-sessions?journeyId=${journeyId}&limit=${limit}`, {
    credentials: 'include',
  });
  return handleResponse<SessionListItem[]>(response);
}
