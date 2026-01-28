import { SessionExport } from '../../utils/transcriptExport';
import { TranscriptItem } from '../../types/voiceAgent';
import { logger } from '../../utils/logger';
import { api, ApiError } from './apiClient';

const sessionLogger = logger.namespace('SessionService');

export interface SessionListItem {
  id: string;
  sessionId: string;
  journeyName: string | null;
  agentName: string | null;
  durationSeconds: number;
  messageCount: number;
  createdAt: string;
  userName?: string;
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
    tools?: unknown[];
  };
  prolific?: {
    participantId?: string;
    studyId?: string;
    sessionId?: string;
  };
}

export async function saveSession(sessionExport: SessionExport): Promise<void> {
  await api.post<{ success: boolean }>('/api/voice-sessions', sessionExport);
}

export async function listUserSessions(limit = 50, offset = 0): Promise<SessionListItem[]> {
  return api.get<SessionListItem[]>(`/api/voice-sessions?limit=${limit}&offset=${offset}`);
}

export async function loadSession(sessionId: string): Promise<SessionExport | null> {
  try {
    return await api.get<SessionExport>(`/api/voice-sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function loadSessionById(id: string): Promise<SessionExport | null> {
  return loadSession(id);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  await api.delete<{ success: boolean }>(`/api/voice-sessions/${sessionId}`);
  return true;
}

export async function deleteSessionById(id: string): Promise<boolean> {
  return deleteSession(id);
}

export async function getSessionCount(): Promise<number> {
  const data = await api.get<{ count: number }>('/api/voice-sessions/count');
  return data.count;
}

export async function getSessionsForJourney(journeyId: string, limit = 20): Promise<SessionListItem[]> {
  return api.get<SessionListItem[]>(`/api/voice-sessions?journeyId=${journeyId}&limit=${limit}`);
}

export async function saveSessionMessage(params: SaveMessageParams): Promise<void> {
  await api.put<{ success: boolean }>(`/api/voice-sessions/${params.sessionId}/message`, {
    message: params.message,
    journey: params.journey,
    agent: params.agent,
    prolific: params.prolific,
  });
}

export class DebouncedSessionSaver {
  private pendingMessages: Map<string, TranscriptItem> = new Map();
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly debounceMs: number;
  private sessionId: string | null = null;
  private journey: SaveMessageParams['journey'];
  private agent: SaveMessageParams['agent'];
  private prolific: SaveMessageParams['prolific'];
  private isSaving = false;
  private onError?: (error: Error) => void;

  constructor(debounceMs = 500, onError?: (error: Error) => void) {
    this.debounceMs = debounceMs;
    this.onError = onError;
  }

  configure(
    sessionId: string,
    journey?: SaveMessageParams['journey'],
    agent?: SaveMessageParams['agent'],
    prolific?: SaveMessageParams['prolific']
  ): void {
    this.sessionId = sessionId;
    this.journey = journey;
    this.agent = agent;
    this.prolific = prolific;
  }

  queueMessage(message: TranscriptItem): void {
    if (!this.sessionId) {
      sessionLogger.warn('DebouncedSessionSaver: sessionId not configured');
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
            prolific: this.prolific,
          }).catch(err => {
            sessionLogger.error(`Failed to save message: ${message.itemId}`, err);
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
    this.prolific = undefined;
    this.isSaving = false;
  }
}

// Re-export ApiError for consumers that need it
export { ApiError };
