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

export async function listNotes(sessionId: string): Promise<TranscriptNote[]> {
  const response = await fetch(`/api/voice-sessions/${sessionId}/notes`, {
    method: 'GET',
    credentials: 'include',
  });
  return handleResponse<TranscriptNote[]>(response);
}

export async function createNote(sessionId: string, params: CreateNoteParams): Promise<TranscriptNote> {
  const response = await fetch(`/api/voice-sessions/${sessionId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  return handleResponse<TranscriptNote>(response);
}

export async function updateNote(sessionId: string, noteId: string, params: UpdateNoteParams): Promise<TranscriptNote> {
  const response = await fetch(`/api/voice-sessions/${sessionId}/notes/${noteId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  return handleResponse<TranscriptNote>(response);
}

export async function deleteNote(sessionId: string, noteId: string): Promise<void> {
  const response = await fetch(`/api/voice-sessions/${sessionId}/notes/${noteId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse<{ success: boolean }>(response);
}
