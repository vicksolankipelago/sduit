/**
 * Journey Runtime Converter
 *
 * Converts Journey configurations into runtime RealtimeAgent instances
 * that can be executed with Azure OpenAI Realtime API
 *
 * Uses instance-based state management to avoid global mutable state.
 */

import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { Journey, Agent as JourneyAgent, Tool as JourneyTool, Screen } from '../../types/journey';
import { toolLogger } from '../../utils/logger';

// Type definitions
export type EventTriggerCallback = (eventId: string, agentName: string) => void;
export type RecordInputCallback = (title: string, summary: string, description?: string, storeKey?: string) => void;
export type EndCallCallback = (reason?: string) => void;

export interface JourneyRuntimeCallbacks {
  onEventTrigger?: EventTriggerCallback;
  onRecordInput?: RecordInputCallback;
  onEndCall?: EndCallCallback;
}

export interface JourneyRuntimeResult {
  agents: RealtimeAgent[];
  startingAgent: RealtimeAgent | null;
  agentMap: Map<string, RealtimeAgent>;
  runtime: JourneyRuntime;
}

/**
 * Journey Runtime Class
 *
 * Encapsulates all state for a single journey session.
 * Create a new instance for each journey to avoid shared state issues.
 */
export class JourneyRuntime {
  private agentInstanceMap = new Map<string, RealtimeAgent>();
  private agentScreensMap = new Map<string, Screen[]>();
  private eventTriggerCallback: EventTriggerCallback | null = null;
  private recordInputCallback: RecordInputCallback | null = null;
  private endCallCallback: EndCallCallback | null = null;

  constructor(callbacks?: JourneyRuntimeCallbacks) {
    if (callbacks?.onEventTrigger) {
      this.eventTriggerCallback = callbacks.onEventTrigger;
    }
    if (callbacks?.onRecordInput) {
      this.recordInputCallback = callbacks.onRecordInput;
    }
    if (callbacks?.onEndCall) {
      this.endCallCallback = callbacks.onEndCall;
    }
  }

  /**
   * Set the event trigger callback for handling trigger_event tool calls
   */
  setEventTriggerCallback(callback: EventTriggerCallback): void {
    this.eventTriggerCallback = callback;
  }

  /**
   * Set the record input callback for handling record_input tool calls
   */
  setRecordInputCallback(callback: RecordInputCallback): void {
    this.recordInputCallback = callback;
  }

  /**
   * Set the end call callback for handling end_call tool calls
   */
  setEndCallCallback(callback: EndCallCallback): void {
    this.endCallCallback = callback;
  }

  /**
   * Get screens for an agent by name
   */
  getAgentScreens(agentName: string): Screen[] {
    return this.agentScreensMap.get(agentName) || [];
  }

  /**
   * Convert a Journey to runtime RealtimeAgent instances
   */
  convert(journey: Journey): JourneyRuntimeResult {
    this.agentInstanceMap.clear();
    this.agentScreensMap.clear();

    // First pass: Create all agent instances
    journey.agents.forEach(agentConfig => {
      const realtimeAgent = this.createRealtimeAgent(agentConfig, journey.systemPrompt);
      this.agentInstanceMap.set(agentConfig.id, realtimeAgent);
    });

    // Second pass: Set up handoffs now that all agents exist
    journey.agents.forEach(agentConfig => {
      const agent = this.agentInstanceMap.get(agentConfig.id);
      if (!agent) return;

      const handoffTargets = agentConfig.handoffs
        .map(targetId => this.agentInstanceMap.get(targetId))
        .filter(Boolean) as RealtimeAgent[];

      agent.handoffs = handoffTargets;
    });

    const startingAgent = journey.startingAgentId
      ? this.agentInstanceMap.get(journey.startingAgentId) || null
      : null;

    return {
      agents: Array.from(this.agentInstanceMap.values()),
      startingAgent,
      agentMap: new Map(this.agentInstanceMap),
      runtime: this,
    };
  }

  /**
   * Clear all cached data
   */
  cleanup(): void {
    this.agentInstanceMap.clear();
    this.agentScreensMap.clear();
    this.eventTriggerCallback = null;
    this.recordInputCallback = null;
    this.endCallCallback = null;
  }

  /**
   * Create a single RealtimeAgent from journey configuration
   */
  private createRealtimeAgent(agentConfig: JourneyAgent, systemPrompt: string): RealtimeAgent {
    const agentName = toCamelCase(agentConfig.name);

    // Combine prompts: system + agent + screen prompts
    const promptParts = [systemPrompt, agentConfig.prompt];

    // Add screen-specific prompts if agent has screens
    if (agentConfig.screens && agentConfig.screens.length > 0) {
      // Store screens for later access
      this.agentScreensMap.set(agentName, agentConfig.screens);

      // Add screen prompts to instructions
      if (agentConfig.screenPrompts) {
        const screenPromptsText = Object.entries(agentConfig.screenPrompts)
          .map(([screenId, prompt]) => `\n## SCREEN: ${screenId}\n${prompt}`)
          .join('\n\n');

        if (screenPromptsText) {
          promptParts.push(screenPromptsText);
        }
      }
    }

    const combinedInstructions = promptParts.filter(Boolean).join('\n\n');

    // Convert journey tools to RealtimeAgent tools
    const realtimeTools = agentConfig.tools.map(toolConfig =>
      this.createRealtimeTool(toolConfig, agentName)
    );

    // Add trigger_event tool if agent has screens
    if (agentConfig.screens && agentConfig.screens.length > 0) {
      realtimeTools.push(this.createTriggerEventTool(agentName) as any);
    }

    // Add end_call tool to all agents
    realtimeTools.push(this.createEndCallTool(agentName) as any);

    return new RealtimeAgent({
      name: agentName,
      voice: agentConfig.voice as 'shimmer' | 'sage' | 'alloy' | 'echo' | 'ash' | 'ballad' | 'coral' | 'verse',
      instructions: combinedInstructions,
      handoffs: [], // Will be set in second pass
      tools: realtimeTools,
      handoffDescription: agentConfig.handoffDescription || agentConfig.name,
    });
  }

  /**
   * Create a RealtimeAgent tool from journey tool configuration
   */
  private createRealtimeTool(toolConfig: JourneyTool, agentName: string) {
    // Special handling for record_input tool
    if (toolConfig.name === 'record_input') {
      return this.createRecordInputTool(toolConfig, agentName);
    }

    const runtime = this;

    return tool({
      name: toolConfig.name,
      description: toolConfig.description,
      parameters: toolConfig.parameters as any,
      strict: false,
      execute: async (input: any) => {
        // Execute user-defined code (Note: This is a security concern - see issue #1)
        if (toolConfig.executeCode) {
          try {
            // Create function from string and execute it
            // WARNING: This is a security vulnerability - should be sandboxed or removed
            const executeFunction = new Function('input', 'context', toolConfig.executeCode);
            const result = await executeFunction(input, { runtime });
            return result;
          } catch (error) {
            toolLogger.error(`Tool execution error (${toolConfig.name}):`, error);
            return `[INTERNAL ERROR: ${error instanceof Error ? error.message : 'Unknown error'}]`;
          }
        }

        // Default fallback
        toolLogger.debug(`Tool executed: ${toolConfig.name}`, input);
        return `${toolConfig.name} executed`;
      },
    });
  }

  /**
   * Create the record_input tool
   */
  private createRecordInputTool(toolConfig: JourneyTool, agentName: string) {
    const runtime = this;

    interface RecordInputParams {
      title: string;
      summary?: string;
      description?: string;
      nextEventId?: string;
      delay?: number | string;
      storeKey?: string;
    }

    return (tool as any)({
      name: 'record_input',
      description: toolConfig.description,
      parameters: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'A short title for the recorded input' },
          summary: { type: 'string', description: 'A one-line summary of what the user said' },
          description: { type: 'string', description: 'A short description providing more context' },
          nextEventId: { type: 'string', description: 'Optional: The ID of the next event to trigger automatically' },
          delay: { type: 'number', description: 'Optional: Delay in seconds before triggering the next event' },
          storeKey: { type: 'string', description: 'Optional: Module state key to store the recorded summary' },
        },
        required: ['title', 'summary'] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: RecordInputParams) => {
        const { title, summary = '', description = '', nextEventId, delay, storeKey } = input;

        toolLogger.debug(`Recording input - Title: ${title}, Summary: ${summary}, NextEvent: ${nextEventId}`);

        // Call the record input callback if set
        if (runtime.recordInputCallback) {
          runtime.recordInputCallback(title, summary, description, storeKey);
        }

        // Handle automatic navigation if requested
        if (nextEventId) {
          let delayMs = 2000; // Default 2s
          if (typeof delay === 'number') delayMs = delay * 1000;
          else if (typeof delay === 'string') delayMs = parseFloat(delay) * 1000;
          if (isNaN(delayMs) || delayMs <= 0) delayMs = 2000;

          if (runtime.eventTriggerCallback) {
            toolLogger.debug(`Scheduling auto-navigation to ${nextEventId} in ${delayMs}ms`);
            setTimeout(() => {
              if (runtime.eventTriggerCallback) {
                runtime.eventTriggerCallback(nextEventId, agentName);
              }
            }, delayMs);
          }
        }

        return `Input recorded successfully: ${title}`;
      },
    });
  }

  /**
   * Create the trigger_event tool for screen-based agents
   */
  private createTriggerEventTool(agentName: string) {
    const runtime = this;

    interface TriggerEventParams {
      eventId: string;
      delay?: number | string;
    }

    // Navigation events dynamically get a default delay to let users read content
    // Any event starting with 'navigate_to_' will be treated as a navigation event
    const isNavigationEvent = (eventId: string) => eventId.startsWith('navigate_to_');

    return (tool as any)({
      name: 'trigger_event',
      description: 'Trigger a screen event to navigate or perform actions in the UI. Use this after user interactions to move through the flow.',
      parameters: {
        type: 'object' as const,
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to trigger (e.g., "navigate_to_outcomes", "next_step_event")',
          },
          delay: {
            type: 'number',
            description: 'Optional delay in seconds before triggering the event. Use this to allow users to read information on screen before navigating.',
          },
        },
        required: ['eventId'] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: TriggerEventParams) => {
        const { eventId } = input;

        // Robust delay parsing
        let delay = 0;
        if (typeof input.delay === 'number') {
          delay = input.delay;
        } else if (typeof input.delay === 'string') {
          delay = parseFloat(input.delay);
          if (isNaN(delay)) delay = 0;
        }

        // Enforce delay for navigation events if not provided
        if (delay === 0 && isNavigationEvent(eventId)) {
          delay = 2; // Default delay
          toolLogger.debug(`Enforcing default 2s delay for navigation event '${eventId}'`);
        }

        toolLogger.debug(`Event triggered: ${eventId} by agent ${agentName} (delay: ${delay}s)`);

        const trigger = () => {
          if (runtime.eventTriggerCallback) {
            runtime.eventTriggerCallback(eventId, agentName);
          } else {
            toolLogger.warn('Event trigger callback not set. Event will not be processed.');
          }
        };

        if (delay > 0) {
          setTimeout(trigger, delay * 1000);
          return `Event "${eventId}" scheduled with ${delay}s delay`;
        } else {
          trigger();
          return `Event "${eventId}" triggered successfully`;
        }
      },
    });
  }

  /**
   * Create the end_call tool for ending the conversation
   */
  private createEndCallTool(agentName: string) {
    const runtime = this;

    interface EndCallParams {
      reason?: string;
      feedbackScreenId?: string;
      delaySeconds?: number;
    }

    return (tool as any)({
      name: 'end_call',
      description: 'End the current call/conversation. Use this when the conversation is complete, the user wants to end the call, or the journey has reached its natural conclusion. This will trigger the feedback screen (if specified) and then disconnect the call after the delay.',
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for ending the call (e.g., "conversation complete", "user requested", "journey finished")',
          },
          feedbackScreenId: {
            type: 'string',
            description: 'Optional screen ID to navigate to before ending (e.g., "feedback_screen", "goodbye_screen"). If not provided, will attempt to find a feedback/goodbye screen automatically.',
          },
          delaySeconds: {
            type: 'number',
            description: 'Optional delay in seconds before disconnecting after showing the feedback screen. Defaults to 5 seconds if a feedback screen is shown.',
          },
        },
        required: [] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: EndCallParams) => {
        const { reason, feedbackScreenId, delaySeconds } = input;

        toolLogger.debug(`End call triggered by agent ${agentName}${reason ? `: ${reason}` : ''}`);

        // Trigger feedback screen event if a screen ID is provided or by default
        const showFeedback = feedbackScreenId !== undefined || true; // Always try to show feedback
        if (showFeedback && runtime.eventTriggerCallback) {
          toolLogger.debug(`Triggering feedback screen before ending call: ${feedbackScreenId || 'auto-detect'}`);
          // Pass the screen ID in the event ID, or use the generic event
          const eventId = feedbackScreenId ? `navigate_to_${feedbackScreenId}` : 'show_feedback_screen';
          runtime.eventTriggerCallback(eventId, agentName);
        }

        // Calculate delay - default to 5 seconds if showing feedback, 0 otherwise
        const delay = delaySeconds !== undefined ? delaySeconds * 1000 : (showFeedback ? 5000 : 0);
        
        toolLogger.debug(`Scheduling disconnect in ${delay}ms`);
        
        setTimeout(() => {
          if (runtime.endCallCallback) {
            runtime.endCallCallback(reason);
          } else {
            toolLogger.warn('End call callback not set. Call will not be ended.');
          }
        }, delay);

        return `Call ending${reason ? `: ${reason}` : ''}${feedbackScreenId ? `. Navigating to ${feedbackScreenId} first.` : '. Feedback screen triggered.'} Disconnecting in ${delay / 1000} seconds.`;
      },
    });
  }
}

// ============================================================================
// Legacy API - For backwards compatibility
// These functions maintain the old API while using instance-based implementation
// ============================================================================

// Default instance for backwards compatibility
let defaultRuntime: JourneyRuntime | null = null;

function getDefaultRuntime(): JourneyRuntime {
  if (!defaultRuntime) {
    defaultRuntime = new JourneyRuntime();
  }
  return defaultRuntime;
}

/**
 * Set the event trigger callback for handling trigger_event tool calls
 * @deprecated Use JourneyRuntime class instead
 */
export function setEventTriggerCallback(callback: EventTriggerCallback): void {
  getDefaultRuntime().setEventTriggerCallback(callback);
}

/**
 * Set the record input callback for handling record_input tool calls
 * @deprecated Use JourneyRuntime class instead
 */
export function setRecordInputCallback(callback: RecordInputCallback): void {
  getDefaultRuntime().setRecordInputCallback(callback);
}

/**
 * Set the end call callback for handling end_call tool calls
 * @deprecated Use JourneyRuntime class instead
 */
export function setEndCallCallback(callback: EndCallCallback): void {
  getDefaultRuntime().setEndCallCallback(callback);
}

/**
 * Get screens for an agent by name
 * @deprecated Use JourneyRuntime class instead
 */
export function getAgentScreens(agentName: string): Screen[] {
  return getDefaultRuntime().getAgentScreens(agentName);
}

/**
 * Convert a Journey to runtime RealtimeAgent instances
 * @deprecated Use JourneyRuntime class instead
 */
export function journeyToRealtimeAgents(journey: Journey): {
  agents: RealtimeAgent[];
  startingAgent: RealtimeAgent | null;
  agentMap: Map<string, RealtimeAgent>;
} {
  // Create new runtime for each conversion to avoid stale callbacks
  defaultRuntime = new JourneyRuntime();
  const result = defaultRuntime.convert(journey);
  return {
    agents: result.agents,
    startingAgent: result.startingAgent,
    agentMap: result.agentMap,
  };
}

/**
 * Get starting agent name for a journey
 */
export function getStartingAgentName(journey: Journey): string {
  const startingAgent = journey.agents.find(a => a.id === journey.startingAgentId);
  return startingAgent ? toCamelCase(startingAgent.name) : 'greeter';
}

/**
 * Clear agent instance cache
 * @deprecated Use JourneyRuntime.cleanup() instead
 */
export function clearAgentCache(): void {
  if (defaultRuntime) {
    defaultRuntime.cleanup();
    defaultRuntime = null;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Helper: Convert string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase())
    .replace(/^(.)/, char => char.toLowerCase());
}
