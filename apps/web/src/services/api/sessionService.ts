import { SessionExport } from '../../utils/transcriptExport';
import { TranscriptItem } from '../../types/voiceAgent';

export interface SessionListItem {
  id: string;
  sessionId: string;
  journeyName: string | null;
  agentName: string | null;
  durationSeconds: number;
  messageCount: number;
  createdAt: string;
}

export interface SaveMessageParams {
  sessionId: string;
  message: TranscriptItem;
  journey?: {
    id: string;
    name: string;
    voice?: string;
  };
  agent?: {
    id: string;
    name: string;
    prompt?: string;
    tools?: any[];
  };
}

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

export async function saveSessionMessage(params: SaveMessageParams): Promise<void> {
  const response = await fetch(`/api/voice-sessions/${params.sessionId}/message`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      message: params.message,
      journey: params.journey,
      agent: params.agent,
    }),
  });
  await handleResponse<{ success: boolean }>(response);
}

export class DebouncedSessionSaver {
  private pendingMessages: Map<string, TranscriptItem> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private sessionId: string | null = null;
  private journey: SaveMessageParams['journey'];
  private agent: SaveMessageParams['agent'];
  private isSaving = false;
  private onError?: (error: Error) => void;

  constructor(debounceMs = 500, onError?: (error: Error) => void) {
    this.debounceMs = debounceMs;
    this.onError = onError;
  }

  configure(
    sessionId: string,
    journey?: SaveMessageParams['journey'],
    agent?: SaveMessageParams['agent']
  ): void {
    this.sessionId = sessionId;
    this.journey = journey;
    this.agent = agent;
  }

  queueMessage(message: TranscriptItem): void {
    if (!this.sessionId) {
      console.warn('DebouncedSessionSaver: sessionId not configured');
      return;
    }

    this.pendingMessages.set(message.itemId, message);
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  async flush(): Promise<void> {
    if (this.isSaving || this.pendingMessages.size === 0 || !this.sessionId) {
      return;
    }

    this.isSaving = true;
    const messagesToSave = Array.from(this.pendingMessages.values());
    this.pendingMessages.clear();

    try {
      await Promise.all(
        messagesToSave.map(message =>
          saveSessionMessage({
            sessionId: this.sessionId!,
            message,
            journey: this.journey,
            agent: this.agent,
          }).catch(err => {
            console.error('Failed to save message:', message.itemId, err);
            this.onError?.(err);
          })
        )
      );
    } finally {
      this.isSaving = false;
      if (this.pendingMessages.size > 0) {
        this.scheduleFlush();
      }
    }
  }

  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingMessages.clear();
    this.sessionId = null;
    this.journey = undefined;
    this.agent = undefined;
    this.isSaving = false;
  }
}
