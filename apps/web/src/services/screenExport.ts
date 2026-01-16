/**
 * Screen Export Service
 *
 * Export agents as SDUI modules matching iOS format.
 * Since the internal format now uses 'state' (matching iOS), minimal conversion is needed.
 */

import { Agent, Screen, ModuleConfig, ElementConfig, Section, ScreenEvent, AnyCodable, EventConditions } from '../types/journey';

/**
 * iOS Module Config format
 */
interface IOSModuleConfig {
  id: string;
  state: Record<string, AnyCodable>;
  conditions: EventConditions[];
  screens: IOSScreen[];
}

interface IOSScreen {
  id: string;
  title: string | null;
  hidesBackButton?: boolean;
  analyticsProperties: Record<string, AnyCodable> | null;
  state?: Record<string, AnyCodable>;
  sections: IOSSection[];
  events: IOSScreenEvent[];
}

interface IOSSection {
  id: string;
  title: string | null;
  position: string;
  layout: string;
  direction: string;
  scrollable: boolean;
  elements: ElementConfig[];
}

interface IOSScreenEvent {
  id: string;
  type: string;
  conditions: EventConditions[];
  action: Array<Record<string, AnyCodable>>;
  analyticsName?: string;
}

/**
 * Normalize event to iOS format (ensure conditions is always an array)
 */
function normalizeEvent(event: ScreenEvent): IOSScreenEvent {
  return {
    id: event.id,
    type: event.type,
    conditions: event.conditions || [],
    action: event.action as Array<Record<string, AnyCodable>>,
    ...(event.analyticsName && { analyticsName: event.analyticsName }),
  };
}

/**
 * Normalize section to iOS format (ensure title is null if not set)
 */
function normalizeSection(section: Section): IOSSection {
  return {
    id: section.id,
    title: section.title ?? null,
    position: section.position,
    layout: section.layout || 'stack',
    direction: section.direction || 'vertical',
    scrollable: section.scrollable ?? true,
    elements: section.elements, // Elements already use 'state'
  };
}

/**
 * Normalize screen to iOS format
 */
function normalizeScreen(screen: Screen): IOSScreen {
  return {
    id: screen.id,
    title: screen.title || null,
    hidesBackButton: screen.hidesBackButton,
    analyticsProperties: screen.analyticsProperties ?? null,
    ...(screen.state && { state: screen.state }),
    sections: screen.sections.map(normalizeSection),
    events: (screen.events || []).map(normalizeEvent),
  };
}

/**
 * Normalize module to iOS format
 */
function normalizeModule(moduleConfig: ModuleConfig): IOSModuleConfig {
  return {
    id: moduleConfig.id,
    state: moduleConfig.state || {},
    conditions: moduleConfig.conditions || [],
    screens: moduleConfig.screens.map(normalizeScreen),
  };
}

/**
 * Export an agent as an SDUI module
 */
export function exportAgentAsModule(agent: Agent): {
  moduleJson: IOSModuleConfig;
  promptText: string;
} {
  if (!agent.screens || agent.screens.length === 0) {
    throw new Error('Agent has no screens to export');
  }

  // Create module structure
  const internalModule: ModuleConfig = {
    id: agent.id,
    state: {},
    conditions: [],
    screens: agent.screens,
  };

  // Normalize to ensure iOS compatibility (null vs undefined, empty arrays, etc.)
  const moduleJson = normalizeModule(internalModule);

  // Create combined prompt text
  const promptSections: string[] = [];

  // Add system-level instructions
  promptSections.push(`# Voice Agent: ${agent.name}\n`);

  if (agent.prompt) {
    promptSections.push(`## Agent Instructions\n${agent.prompt}\n`);
  }

  // Add screen-specific prompts
  if (agent.screenPrompts) {
    const screenPromptText = agent.screens.map(screen => {
      const prompt = agent.screenPrompts?.[screen.id];
      if (!prompt) {
        return `## SCREEN: ${screen.id}\n**Screen ID:** \`${screen.id}\`\n**Available Events:** ${
          (screen.events || []).map(e => `\`${e.id}\``).join(', ')
        }\n\n*No prompt defined yet*\n`;
      }

      return `## SCREEN: ${screen.id}\n${prompt}\n`;
    }).join('\n---\n\n');

    promptSections.push(screenPromptText);
  }

  const promptText = promptSections.join('\n');

  return {
    moduleJson,
    promptText,
  };
}

/**
 * Download agent as module files (JSON + prompt)
 */
export function downloadAgentAsModule(agent: Agent): void {
  try {
    const { moduleJson, promptText } = exportAgentAsModule(agent);

    // Download module JSON
    const jsonBlob = new Blob([JSON.stringify(moduleJson, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `${agent.id}_module.json`;
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);

    // Download prompt text
    const promptBlob = new Blob([promptText], { type: 'text/plain' });
    const promptUrl = URL.createObjectURL(promptBlob);
    const promptLink = document.createElement('a');
    promptLink.href = promptUrl;
    promptLink.download = `${agent.id}_prompt.txt`;
    promptLink.click();
    URL.revokeObjectURL(promptUrl);

    console.log(`Exported agent "${agent.name}" as SDUI module`);
  } catch (error) {
    console.error('Error exporting agent:', error);
    alert(error instanceof Error ? error.message : 'Failed to export agent');
  }
}

/**
 * Export agent as a single zip file (requires JSZip library)
 * For now, we'll just download separately
 */
export async function downloadAgentAsZip(agent: Agent): Promise<void> {
  // TODO: Implement zip export using JSZip library
  // For now, download files separately
  downloadAgentAsModule(agent);
}

/**
 * Validate agent before export
 */
export function validateAgentForExport(agent: Agent): string[] {
  const errors: string[] = [];

  if (!agent.screens || agent.screens.length === 0) {
    errors.push('Agent has no screens defined');
  }

  if (agent.screens) {
    agent.screens.forEach((screen, index) => {
      if (!screen.id) {
        errors.push(`Screen at index ${index} has no ID`);
      }

      if (!screen.title) {
        errors.push(`Screen "${screen.id}" has no title`);
      }

      if (screen.sections.length === 0) {
        errors.push(`Screen "${screen.id}" has no sections`);
      }

      screen.sections.forEach((section, sectionIndex) => {
        if (section.elements.length === 0) {
          errors.push(`Section ${sectionIndex} in screen "${screen.id}" has no elements`);
        }
      });
    });
  }

  return errors;
}
