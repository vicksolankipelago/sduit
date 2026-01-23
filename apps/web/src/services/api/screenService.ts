import { StandaloneScreen, StandaloneScreenListItem } from '../../types/screen';
import { api, ApiError } from './apiClient';

export async function listGlobalScreens(): Promise<StandaloneScreenListItem[]> {
  return api.get<StandaloneScreenListItem[]>('/api/screens');
}

export async function loadGlobalScreen(screenId: string): Promise<StandaloneScreen | null> {
  try {
    return await api.get<StandaloneScreen>(`/api/screens/${screenId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function saveGlobalScreen(screen: StandaloneScreen): Promise<StandaloneScreen> {
  const isNew = !screen.id || screen.id.startsWith('new-');

  if (isNew) {
    return api.post<StandaloneScreen>('/api/screens', screen);
  } else {
    return api.put<StandaloneScreen>(`/api/screens/${screen.id}`, screen);
  }
}

export async function deleteGlobalScreen(screenId: string): Promise<boolean> {
  await api.delete<{ deleted: boolean }>(`/api/screens/${screenId}`);
  return true;
}

export async function duplicateGlobalScreen(screenId: string): Promise<StandaloneScreen | null> {
  try {
    return await api.post<StandaloneScreen>(`/api/screens/${screenId}/duplicate`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function globalScreenExists(screenId: string): Promise<boolean> {
  try {
    await api.get<StandaloneScreen>(`/api/screens/${screenId}`);
    return true;
  } catch {
    return false;
  }
}
