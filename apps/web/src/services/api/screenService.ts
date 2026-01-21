import { StandaloneScreen, StandaloneScreenListItem } from '../../types/screen';

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

export async function listGlobalScreens(): Promise<StandaloneScreenListItem[]> {
  const response = await fetch('/api/screens', {
    credentials: 'include',
  });
  return handleResponse<StandaloneScreenListItem[]>(response);
}

export async function loadGlobalScreen(screenId: string): Promise<StandaloneScreen | null> {
  const response = await fetch(`/api/screens/${screenId}`, {
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  return handleResponse<StandaloneScreen>(response);
}

export async function saveGlobalScreen(screen: StandaloneScreen): Promise<StandaloneScreen> {
  const isNew = !screen.id || screen.id.startsWith('new-');

  if (isNew) {
    const response = await fetch('/api/screens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(screen),
    });
    return handleResponse<StandaloneScreen>(response);
  } else {
    const response = await fetch(`/api/screens/${screen.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(screen),
    });
    return handleResponse<StandaloneScreen>(response);
  }
}

export async function deleteGlobalScreen(screenId: string): Promise<boolean> {
  const response = await fetch(`/api/screens/${screenId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse<{ success: boolean }>(response);
  return true;
}

export async function duplicateGlobalScreen(screenId: string): Promise<StandaloneScreen | null> {
  const response = await fetch(`/api/screens/${screenId}/duplicate`, {
    method: 'POST',
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  return handleResponse<StandaloneScreen>(response);
}

export async function globalScreenExists(screenId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/screens/${screenId}`, {
      credentials: 'include',
    });
    return response.ok;
  } catch {
    return false;
  }
}
