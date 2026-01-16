/**
 * Screen Import Service
 * 
 * Import SDUI modules and convert to agent screens
 */

import { Agent, ModuleConfig, Screen } from '../types/journey';

/**
 * Import module JSON and extract screens
 */
export function importModuleAsScreens(moduleJson: ModuleConfig): Screen[] {
  if (!moduleJson.screens || moduleJson.screens.length === 0) {
    throw new Error('Module has no screens');
  }

  return moduleJson.screens;
}

/**
 * Parse prompt text and extract screen prompts
 */
export function parsePromptText(promptText: string): Record<string, string> {
  const screenPrompts: Record<string, string> = {};

  // Split by screen sections (## SCREEN: screen_id)
  const screenPattern = /## SCREEN:\s*(\S+)\s*\n([\s\S]*?)(?=\n## SCREEN:|$)/g;
  let match;

  while ((match = screenPattern.exec(promptText)) !== null) {
    const screenId = match[1];
    let prompt = match[2].trim();

    // Remove separator lines
    prompt = prompt.replace(/^---\s*$/gm, '').trim();

    if (prompt) {
      screenPrompts[screenId] = prompt;
    }
  }

  return screenPrompts;
}

/**
 * Import module and prompt files into an agent
 */
export function importModuleIntoAgent(
  agent: Agent,
  moduleJson: ModuleConfig,
  promptText?: string
): Agent {
  const screens = importModuleAsScreens(moduleJson);
  const screenPrompts = promptText ? parsePromptText(promptText) : {};

  return {
    ...agent,
    screens,
    screenPrompts,
  };
}

/**
 * Import from file upload
 */
export async function importModuleFromFile(file: File): Promise<ModuleConfig> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const moduleJson = JSON.parse(content);
        
        // Validate basic structure
        if (!moduleJson.id || !moduleJson.screens) {
          reject(new Error('Invalid module format'));
          return;
        }
        
        resolve(moduleJson);
      } catch (error) {
        reject(new Error('Failed to parse module JSON'));
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Import prompt from file upload
 */
export async function importPromptFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const content = e.target?.result as string;
      resolve(content);
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Validate imported module
 */
export function validateImportedModule(moduleJson: ModuleConfig): string[] {
  const errors: string[] = [];

  if (!moduleJson.id) {
    errors.push('Module has no ID');
  }

  if (!moduleJson.screens || moduleJson.screens.length === 0) {
    errors.push('Module has no screens');
  }

  moduleJson.screens?.forEach((screen, index) => {
    if (!screen.id) {
      errors.push(`Screen at index ${index} has no ID`);
    }

    if (!screen.title) {
      errors.push(`Screen "${screen.id || index}" has no title`);
    }

    if (!screen.sections || screen.sections.length === 0) {
      errors.push(`Screen "${screen.id || index}" has no sections`);
    }
  });

  return errors;
}

