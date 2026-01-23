import { api, ApiError } from './apiClient';

export interface TranscriptNote {
  id: string;
  sessionId: string;
  messageIndex: number;
  userId: string;
  userRole: string;
  userName: string;
  content: string;
  status: 'todo' | 'done';
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteParams {
  messageIndex: number;
  content: string;
  parentId?: string;
}

export interface UpdateNoteParams {
  content?: string;
  status?: 'todo' | 'done';
}

export async function listNotes(sessionId: string): Promise<TranscriptNote[]> {
  return api.get<TranscriptNote[]>(`/api/voice-sessions/${sessionId}/notes`);
}

export async function createNote(sessionId: string, params: CreateNoteParams): Promise<TranscriptNote> {
  return api.post<TranscriptNote>(`/api/voice-sessions/${sessionId}/notes`, params);
}

export async function updateNote(sessionId: string, noteId: string, params: UpdateNoteParams): Promise<TranscriptNote> {
  return api.patch<TranscriptNote>(`/api/voice-sessions/${sessionId}/notes/${noteId}`, params);
}

export async function deleteNote(sessionId: string, noteId: string): Promise<void> {
  await api.delete<{ success: boolean }>(`/api/voice-sessions/${sessionId}/notes/${noteId}`);
}

export async function getNoteCounts(sessionIds: string[]): Promise<Record<string, number>> {
  return api.post<Record<string, number>>('/api/voice-sessions/note-counts', { sessionIds });
}

// Re-export ApiError for consumers that need it
export { ApiError };
