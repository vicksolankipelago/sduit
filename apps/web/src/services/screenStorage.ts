/**
 * Screen Storage Service
 *
 * Handles persistence for standalone screens.
 * Supports hybrid storage: global screens from API + local screens from localStorage.
 */

import { StandaloneScreen, StandaloneScreenListItem, screenToListItem } from '../types/screen';
import * as globalScreenService from './api/screenService';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'standalone-screens';
const STORAGE_VERSION = '1.0.0';

/**
 * Extended list item with source information
 */
export interface HybridScreenListItem extends StandaloneScreenListItem {
  isGlobal: boolean;
}

/**
 * Extended screen with source information
 */
export interface HybridScreen extends StandaloneScreen {
  isGlobal?: boolean;
}

/**
 * Get screens from localStorage
 */
function getLocalStorageScreens(): StandaloneScreen[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get localStorage screens:', error);
    return [];
  }
}

/**
 * Save screens to localStorage
 */
function setLocalStorageScreens(screens: StandaloneScreen[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(screens));
  } catch (error) {
    console.error('Failed to save localStorage screens:', error);
  }
}

/**
 * List all screens (global + local)
 */
export async function listScreens(): Promise<HybridScreenListItem[]> {
  try {
    // Fetch global screens from API
    let globalScreens: HybridScreenListItem[] = [];
    try {
      const apiScreens = await globalScreenService.listGlobalScreens();
      globalScreens = apiScreens.map((s) => ({ ...s, isGlobal: true }));
    } catch (error) {
      console.warn('Failed to fetch global screens, using local only:', error);
    }

    // Get local screens
    const localScreens = getLocalStorageScreens();
    const localItems: HybridScreenListItem[] = localScreens.map((s) => ({
      ...screenToListItem(s),
      isGlobal: false,
    }));

    // Combine and sort by updatedAt
    const allScreens = [...globalScreens, ...localItems];
    return allScreens.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch (error) {
    console.error('Failed to list screens:', error);
    return [];
  }
}

/**
 * List screens synchronously (local only, for initial render)
 */
export function listScreensSync(): HybridScreenListItem[] {
  try {
    const screens = getLocalStorageScreens();
    return screens
      .map((s) => ({ ...screenToListItem(s), isGlobal: false }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Failed to list screens:', error);
    return [];
  }
}

/**
 * List only global screens
 */
export async function listGlobalScreens(): Promise<HybridScreenListItem[]> {
  try {
    const apiScreens = await globalScreenService.listGlobalScreens();
    return apiScreens.map((s) => ({ ...s, isGlobal: true }));
  } catch (error) {
    console.error('Failed to list global screens:', error);
    return [];
  }
}

/**
 * List only local screens
 */
export function listLocalScreens(): HybridScreenListItem[] {
  try {
    const screens = getLocalStorageScreens();
    return screens
      .map((s) => ({ ...screenToListItem(s), isGlobal: false }))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.error('Failed to list local screens:', error);
    return [];
  }
}

/**
 * Load a screen by ID (checks global first, then local)
 */
export async function loadScreen(id: string): Promise<HybridScreen | null> {
  try {
    // Try global first
    try {
      const globalScreen = await globalScreenService.loadGlobalScreen(id);
      if (globalScreen) {
        return { ...globalScreen, isGlobal: true };
      }
    } catch (error) {
      // Global fetch failed, try local
    }

    // Try local
    const screens = getLocalStorageScreens();
    const localScreen = screens.find((s) => s.id === id);
    if (localScreen) {
      return { ...localScreen, isGlobal: false };
    }

    return null;
  } catch (error) {
    console.error(`Failed to load screen ${id}:`, error);
    return null;
  }
}

/**
 * Save a local screen (create or update)
 */
export async function saveScreen(screen: StandaloneScreen): Promise<boolean> {
  try {
    screen.updatedAt = new Date().toISOString();

    const screens = getLocalStorageScreens();
    const existingIndex = screens.findIndex((s) => s.id === screen.id);

    if (existingIndex >= 0) {
      screens[existingIndex] = screen;
      console.log(`Updated screen: ${screen.title}`);
    } else {
      if (!screen.id) {
        screen.id = uuidv4();
      }
      if (!screen.createdAt) {
        screen.createdAt = new Date().toISOString();
      }
      screens.push(screen);
      console.log(`Created screen: ${screen.title}`);
    }

    setLocalStorageScreens(screens);
    return true;
  } catch (error) {
    console.error('Failed to save screen:', error);
    return false;
  }
}

/**
 * Save a global screen (admin only)
 */
export async function saveGlobalScreen(screen: StandaloneScreen): Promise<StandaloneScreen | null> {
  try {
    return await globalScreenService.saveGlobalScreen(screen);
  } catch (error) {
    console.error('Failed to save global screen:', error);
    return null;
  }
}

/**
 * Delete a local screen by ID
 */
export async function deleteScreen(id: string): Promise<boolean> {
  try {
    const screens = getLocalStorageScreens();
    const screen = screens.find((s) => s.id === id);
    const filtered = screens.filter((s) => s.id !== id);
    setLocalStorageScreens(filtered);
    console.log(`Deleted screen: ${screen?.title || id}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete screen ${id}:`, error);
    return false;
  }
}

/**
 * Delete a global screen (admin only)
 */
export async function deleteGlobalScreen(id: string): Promise<boolean> {
  try {
    return await globalScreenService.deleteGlobalScreen(id);
  } catch (error) {
    console.error(`Failed to delete global screen ${id}:`, error);
    return false;
  }
}

/**
 * Duplicate a local screen
 */
export async function duplicateScreen(id: string): Promise<StandaloneScreen | null> {
  try {
    const original = await loadScreen(id);
    if (!original) return null;

    const duplicate: StandaloneScreen = {
      ...JSON.parse(JSON.stringify(original)),
      id: uuidv4(),
      title: `${original.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Remove the isGlobal flag for local storage
    delete (duplicate as any).isGlobal;

    // Generate new IDs for sections and elements
    duplicate.sections = duplicate.sections.map((section) => ({
      ...section,
      id: uuidv4(),
      elements: section.elements?.map((element) => ({
        ...element,
        state: {
          ...element.state,
          id: uuidv4(),
        },
      })),
    }));

    if (await saveScreen(duplicate)) {
      console.log(`Duplicated screen: ${duplicate.title}`);
      return duplicate;
    }
    return null;
  } catch (error) {
    console.error(`Failed to duplicate screen ${id}:`, error);
    return null;
  }
}

/**
 * Duplicate a global screen (admin only)
 */
export async function duplicateGlobalScreen(id: string): Promise<StandaloneScreen | null> {
  try {
    return await globalScreenService.duplicateGlobalScreen(id);
  } catch (error) {
    console.error(`Failed to duplicate global screen ${id}:`, error);
    return null;
  }
}

/**
 * Export screen data
 */
export interface ScreenExport {
  screen: StandaloneScreen;
  exportedAt: string;
  exportVersion: string;
}

export async function exportScreen(id: string): Promise<ScreenExport | null> {
  try {
    const screen = await loadScreen(id);
    if (!screen) return null;

    // Remove hybrid metadata for export
    const exportScreen = { ...screen };
    delete (exportScreen as any).isGlobal;

    return {
      screen: exportScreen,
      exportedAt: new Date().toISOString(),
      exportVersion: STORAGE_VERSION,
    };
  } catch (error) {
    console.error(`Failed to export screen ${id}:`, error);
    return null;
  }
}

/**
 * Download screen as JSON file
 */
export async function downloadScreenAsJSON(id: string): Promise<void> {
  const exportData = await exportScreen(id);
  if (!exportData) return;

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${exportData.screen.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log(`Downloaded screen: ${exportData.screen.title}`);
}

/**
 * Import screen from JSON (saves to local storage)
 */
export async function importScreen(jsonString: string): Promise<StandaloneScreen | null> {
  try {
    const exportData: ScreenExport = JSON.parse(jsonString);
    if (!exportData.screen) {
      throw new Error('Invalid screen export format');
    }

    const screen = exportData.screen;
    screen.id = uuidv4();
    screen.createdAt = new Date().toISOString();
    screen.updatedAt = new Date().toISOString();

    if (await saveScreen(screen)) {
      console.log(`Imported screen: ${screen.title}`);
      return screen;
    }
    return null;
  } catch (error) {
    console.error('Failed to import screen:', error);
    return null;
  }
}

/**
 * Clear all local screens (for testing/reset)
 */
export function clearAllScreens(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('Cleared all local screens');
    return true;
  } catch (error) {
    console.error('Failed to clear screens:', error);
    return false;
  }
}
