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
export type SetVoiceEnabledCallback = (enabled: boolean) => void;

export interface JourneyRuntimeCallbacks {
  onEventTrigger?: EventTriggerCallback;
  onRecordInput?: RecordInputCallback;
  onEndCall?: EndCallCallback;
  onSetVoiceEnabled?: SetVoiceEnabledCallback;
}

export interface JourneyRuntimeOptions {
  callbacks?: JourneyRuntimeCallbacks;
  flowContext?: Record<string, any>;
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
  private setVoiceEnabledCallback: SetVoiceEnabledCallback | null = null;
  private flowContext: Record<string, any> = {};

  constructor(options?: JourneyRuntimeCallbacks | JourneyRuntimeOptions) {
    // Support both old JourneyRuntimeCallbacks and new JourneyRuntimeOptions format
    const callbacks = (options && 'callbacks' in options) ? options.callbacks : options as JourneyRuntimeCallbacks | undefined;
    const flowCtx = (options && 'flowContext' in options) ? options.flowContext : undefined;
    
    if (callbacks?.onEventTrigger) {
      this.eventTriggerCallback = callbacks.onEventTrigger;
    }
    if (callbacks?.onRecordInput) {
      this.recordInputCallback = callbacks.onRecordInput;
    }
    if (callbacks?.onEndCall) {
      this.endCallCallback = callbacks.onEndCall;
    }
    if (callbacks?.onSetVoiceEnabled) {
      this.setVoiceEnabledCallback = callbacks.onSetVoiceEnabled;
    }
    if (flowCtx) {
      this.flowContext = flowCtx;
    }
  }

  /**
   * Set the flow context for prompt interpolation
   */
  setFlowContext(context: Record<string, any>): void {
    this.flowContext = context;
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
   * Set the setVoiceEnabled callback for handling setVoiceEnabled tool calls
   */
  setSetVoiceEnabledCallback(callback: SetVoiceEnabledCallback): void {
    this.setVoiceEnabledCallback = callback;
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

      const handoffTargets = (agentConfig.handoffs || [])
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

    let combinedInstructions = promptParts.filter(Boolean).join('\n\n');
    
    // Interpolate {{key}} placeholders with flow context values
    if (Object.keys(this.flowContext).length > 0) {
      combinedInstructions = interpolatePrompt(combinedInstructions, this.flowContext);
    }

    // System tool names — these always use the system implementation to avoid
    // conflicting schemas/descriptions from journey-level tool definitions.
    const systemToolNames = new Set([
      'trigger_event', 'record_input', 'end_call',
      'set_checkin_frequency', 'set_reminder_time',
      'set_goals', 'capture_weekly_focus', 'setVoiceEnabled', 'navigate_to',
    ]);

    // Convert journey tools to RealtimeAgent tools, skipping any that
    // duplicate a system tool (system definitions have the correct schema).
    const realtimeTools = agentConfig.tools
      .filter(toolConfig => !systemToolNames.has(toolConfig.name))
      .map(toolConfig => this.createRealtimeTool(toolConfig, agentName));

    // Add system tools available to all journeys
    // trigger_event - for UI events (and legacy navigation events)
    realtimeTools.push(this.createTriggerEventTool(agentName, agentConfig.screens || []) as any);
    // navigate_to - navigation by target screen id (maps to current screen event)
    realtimeTools.push(this.createNavigateToTool(agentName, agentConfig.screens || []) as any);
    
    // record_input - for recording user responses (always available as system tool)
    realtimeTools.push(this.createSystemRecordInputTool(agentName) as any);

    // Add end_call tool to all agents
    realtimeTools.push(this.createEndCallTool(agentName) as any);

    // Add set_checkin_frequency tool - captures check-in commitment as days per week
    realtimeTools.push(this.createSetCheckinFrequencyTool(agentName) as any);

    // Add set_reminder_time tool - captures preferred reminder time in UTC
    realtimeTools.push(this.createSetReminderTimeTool(agentName) as any);

    // Add set_goals tool - captures structured goals with categories and progress
    realtimeTools.push(this.createSetGoalsTool(agentName) as any);

    // Add capture_weekly_focus tool - captures weekly focus linked to a goal
    realtimeTools.push(this.createCaptureWeeklyFocusTool(agentName) as any);

    // Add setVoiceEnabled tool to all agents - enables/disables voice mode
    realtimeTools.push(this.createSetVoiceEnabledTool(agentName) as any);

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
   * Create the system record_input tool (available for all journeys without configuration)
   */
  private createSystemRecordInputTool(agentName: string) {
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
      description: 'Record user input/response for tracking and state management. Use this to capture what the user said and optionally trigger a follow-up event.',
      parameters: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'A short title for the recorded input (e.g., "feelings_response", "goal_selection")' },
          summary: { type: 'string', description: 'A one-line summary of what the user said or selected' },
          description: { type: 'string', description: 'Optional: A short description providing more context' },
          nextEventId: { type: 'string', description: 'Optional: The ID of the next event to trigger automatically after recording' },
          delay: { type: 'number', description: 'Optional: Delay in seconds before triggering the next event (default: 2s)' },
          storeKey: { type: 'string', description: 'Optional: Module state key to store the recorded summary for later use' },
        },
        required: ['title', 'summary'] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: RecordInputParams) => {
        const { title, summary = '', description = '', nextEventId, delay, storeKey } = input;

        toolLogger.debug(`[System] Recording input - Title: ${title}, Summary: ${summary}, NextEvent: ${nextEventId}`);

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
  private createTriggerEventTool(agentName: string, screens: any[]) {
    const runtime = this;

    interface TriggerEventParams {
      eventId: string;
      delay?: number | string;
    }

    // Navigation events dynamically get a default delay to let users read content.
    // Detect navigation by action type instead of relying on event-id prefixes.
    const navigationEventIds = new Set<string>();
    for (const screen of screens || []) {
      const allEvents = [
        ...(screen?.events || []),
        ...((screen?.sections || []).flatMap((section: any) =>
          (section?.elements || []).flatMap((element: any) => element?.events || [])
        )),
      ];
      for (const event of allEvents) {
        const hasNavigationAction = (event?.action || []).some(
          (action: any) => action?.type === 'navigation' && typeof action?.deeplink === 'string'
        );
        if (hasNavigationAction && typeof event?.id === 'string') {
          navigationEventIds.add(event.id);
        }
      }
    }
    const isNavigationEvent = (eventId: string) => navigationEventIds.has(eventId);

    return (tool as any)({
      name: 'trigger_event',
      description: 'Trigger a UI event on the current screen (selection, permissions, completion). Use navigate_to for screen-to-screen navigation.',
      parameters: {
        type: 'object' as const,
        properties: {
          eventId: {
            type: 'string',
            description: 'The ID of the event to trigger (e.g., "select_daily_commitment", "permissions_screen_event")',
          },
          delay: {
            type: 'number',
            description: 'Delay in seconds before triggering the event. Use 0 for immediate transition, or higher values (e.g., 2, 3, 5) to give users time to read content. Default is 0.5s for smooth transitions.',
          },
        },
        required: ['eventId'] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: TriggerEventParams) => {
        const { eventId } = input;
        const buildNavigationResult = (payload: {
          success: boolean;
          eventId: string;
          currentScreen?: string;
          nextScreen?: string;
          delaySeconds?: number;
          reason?: string;
          message: string;
        }) => ({
          success: payload.success,
          event_id: payload.eventId,
          from_screen: null,
          next_screen: payload.nextScreen ?? null,
          current_screen: payload.currentScreen ?? payload.nextScreen ?? null,
          delay_seconds: payload.delaySeconds ?? 0,
          reason: payload.reason ?? null,
          message: payload.message,
        });

        // Robust delay parsing - use delay from tool call if provided
        let delay = 0;
        if (typeof input.delay === 'number') {
          delay = input.delay;
        } else if (typeof input.delay === 'string') {
          delay = parseFloat(input.delay);
          if (isNaN(delay)) delay = 0;
        }

        // Only apply minimal default delay for navigation if none specified
        // In voice mode, long delays feel awkward since the agent has already spoken
        if (delay === 0 && isNavigationEvent(eventId)) {
          delay = 0.5; // Brief 0.5s delay for smooth transition
          toolLogger.debug(`Using minimal 0.5s delay for navigation event '${eventId}'`);
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
          return buildNavigationResult({
            success: true,
            eventId,
            delaySeconds: delay,
            reason: 'scheduled',
            message: `Event "${eventId}" scheduled with ${delay}s delay`,
          });
        } else {
          trigger();
          return buildNavigationResult({
            success: true,
            eventId,
            delaySeconds: 0,
            reason: 'triggered',
            message: `Event "${eventId}" triggered successfully`,
          });
        }
      },
    });
  }

  /**
   * Create the navigate_to tool for screen-based agents.
   * This maps a target screen id to the corresponding navigation event id.
   */
  private createNavigateToTool(agentName: string, screens: any[]) {
    const runtime = this;

    interface NavigateToParams {
      screen: string;
      delay?: number | string;
    }

    const buildNavigationIndex = () => {
      const entries: Array<{ screenId: string; eventId: string }> = [];
      for (const screen of screens || []) {
        const allEvents = [
          ...(screen?.events || []),
          ...((screen?.sections || []).flatMap((section: any) =>
            (section?.elements || []).flatMap((element: any) => element?.events || [])
          )),
        ];

        for (const event of allEvents) {
          const navAction = (event?.action || []).find(
            (action: any) => action?.type === 'navigation' && typeof action?.deeplink === 'string'
          );
          if (navAction?.deeplink && event?.id) {
            entries.push({ screenId: navAction.deeplink, eventId: event.id });
          }
        }
      }
      return entries;
    };

    return (tool as any)({
      name: 'navigate_to',
      description: 'Navigate to a target screen by screen ID. Use only valid next screens for the current journey.',
      parameters: {
        type: 'object' as const,
        properties: {
          screen: {
            type: 'string',
            description: 'Target screen ID to navigate to (e.g., "about-you", "outcomes")',
          },
          delay: {
            type: 'number',
            description: 'Optional delay in seconds before navigation',
          },
        },
        required: ['screen'] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: NavigateToParams) => {
        const screen = input?.screen;
        if (!screen) {
          return {
            success: false,
            event_id: null,
            from_screen: null,
            next_screen: null,
            current_screen: null,
            delay_seconds: 0,
            reason: 'missing_screen',
            message: 'Missing required "screen" parameter.',
          };
        }

        let delay = 0;
        if (typeof input.delay === 'number') {
          delay = input.delay;
        } else if (typeof input.delay === 'string') {
          delay = parseFloat(input.delay);
          if (isNaN(delay)) delay = 0;
        }

        const navEntries = buildNavigationIndex();
        const candidates = navEntries.filter(entry => entry.screenId === screen);
        if (candidates.length === 0) {
          return {
            success: false,
            event_id: null,
            from_screen: null,
            next_screen: screen,
            current_screen: null,
            delay_seconds: 0,
            reason: 'no_navigation_event_for_screen',
            message: `No navigation event found for target screen "${screen}".`,
          };
        }

        const selected = candidates[0];
        const trigger = () => {
          if (runtime.eventTriggerCallback) {
            runtime.eventTriggerCallback(selected.eventId, agentName);
          }
        };

        if (delay > 0) {
          setTimeout(trigger, delay * 1000);
        } else {
          trigger();
        }

        return {
          success: true,
          event_id: selected.eventId,
          from_screen: null,
          next_screen: screen,
          current_screen: screen,
          delay_seconds: delay,
          reason: 'navigation_triggered',
          message: `Navigation to "${screen}" triggered via event "${selected.eventId}".`,
        };
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
      delaySeconds?: number;
    }

    return (tool as any)({
      name: 'end_call',
      description: 'End the current call/conversation and redirect to the feedback page. Use this when the conversation is complete, the user wants to end the call, or the journey has reached its natural conclusion. This will disconnect the call and navigate to a dedicated feedback page.',
      parameters: {
        type: 'object' as const,
        properties: {
          reason: {
            type: 'string',
            description: 'Optional reason for ending the call (e.g., "conversation complete", "user requested", "journey finished")',
          },
          delaySeconds: {
            type: 'number',
            description: 'Optional delay in seconds before disconnecting and redirecting to feedback page. Defaults to 2 seconds.',
          },
        },
        required: [] as const,
        additionalProperties: false as const,
      },
      strict: false,
      execute: async (input: EndCallParams) => {
        const { reason, delaySeconds } = input;

        toolLogger.debug(`End call triggered by agent ${agentName}${reason ? `: ${reason}` : ''}`);

        // Calculate delay - default to 2 seconds to allow final speech to complete
        const delay = delaySeconds !== undefined ? delaySeconds * 1000 : 2000;
        
        toolLogger.debug(`Scheduling disconnect and feedback page navigation in ${delay}ms`);
        
        setTimeout(() => {
          if (runtime.endCallCallback) {
            // Store session info for feedback page before ending call
            const sessionId = (window as any).__voiceSessionId || '';
            const journeyName = (window as any).__voiceJourneyName || '';
            if (sessionId) {
              localStorage.setItem('voice-session-id', sessionId);
            }
            if (journeyName) {
              localStorage.setItem('voice-journey-name', journeyName);
            }
            
            runtime.endCallCallback(reason);
            
            // Navigate to dedicated feedback page after call ends
            const feedbackUrl = `/feedback${sessionId ? `?sessionId=${sessionId}` : ''}`;
            toolLogger.debug(`Navigating to feedback page: ${feedbackUrl}`);
            window.location.href = feedbackUrl;
          } else {
            toolLogger.warn('End call callback not set. Call will not be ended.');
          }
        }, delay);

        return `Call ending${reason ? `: ${reason}` : ''}. Navigating to feedback page in ${delay / 1000} seconds.`;
      },
    });
  }

  /**
   * Create the set_checkin_frequency tool for capturing check-in commitment
   */
  private createSetCheckinFrequencyTool(agentName: string) {
    const runtime = this;

    interface SetCheckinFrequencyParams {
      days: number;
    }

    return (tool as any)({
      name: 'set_checkin_frequency',
      description: 'Save the member\'s chosen check-in frequency as an integer number of days per week. Call this after the user selects their check-in commitment (e.g., every day = 7, a few times = 4, once = 1).',
      parameters: {
        type: 'object' as const,
        properties: {
          days: {
            type: 'number',
            description: 'Number of days per week the member wants to check in (e.g., 7 for daily, 4 for a few times, 1 for once)',
          },
        },
        required: ['days'] as const,
        additionalProperties: false as const,
      },
      strict: true,
      execute: async (input: SetCheckinFrequencyParams) => {
        const { days } = input;
        const daysInt = Math.round(days);

        toolLogger.debug(`set_checkin_frequency called by agent ${agentName}: days=${daysInt}`);

        // Store via record_input callback with dedicated storeKey
        if (runtime.recordInputCallback) {
          runtime.recordInputCallback('Check-in frequency', String(daysInt), `${daysInt} days per week`, 'checkinFrequency');
        }

        return `Check-in frequency saved: ${daysInt} days per week`;
      },
    });
  }

  /**
   * Create the set_reminder_time tool for capturing preferred reminder time
   */
  private createSetReminderTimeTool(agentName: string) {
    const runtime = this;

    interface SetReminderTimeParams {
      time: string;
    }

    return (tool as any)({
      name: 'set_reminder_time',
      description: 'Save the member\'s preferred daily reminder time. Pass the time the user stated (e.g., "8 PM", "9:00 AM", "20:00"). The system will convert it to UTC automatically based on the member\'s timezone.',
      parameters: {
        type: 'object' as const,
        properties: {
          time: {
            type: 'string',
            description: 'The time the user wants their daily reminder, as they stated it (e.g., "8 PM", "9 AM", "20:00", "morning", "evening")',
          },
        },
        required: ['time'] as const,
        additionalProperties: false as const,
      },
      strict: true,
      execute: async (input: SetReminderTimeParams) => {
        const { time } = input;

        toolLogger.debug(`set_reminder_time called by agent ${agentName}: time=${time}`);

        // Parse the user's stated time and convert to UTC
        const utcTime = parseTimeToUTC(time);

        toolLogger.debug(`Parsed reminder time: local="${time}" → utc="${utcTime}"`);

        // Store via record_input callback with dedicated storeKey
        if (runtime.recordInputCallback) {
          runtime.recordInputCallback('Reminder time', utcTime, `User said: ${time}, stored as UTC: ${utcTime}`, 'reminderTime');
        }

        return `Reminder time saved: ${time} (UTC: ${utcTime})`;
      },
    });
  }

  /**
   * Create the set_goals tool for capturing structured goals with categories and progress.
   * Stores goalTitles (string[]) and memberGoals (full objects) in module state via
   * a moduleStateUpdate window event — matching iOS stateManager.updateModuleState.
   */
  private createSetGoalsTool(agentName: string) {
    const runtime = this;

    interface GoalInput {
      goal: string;
      categories?: string[];
      progress?: number;
    }

    interface SetGoalsParams {
      goals: GoalInput[];
    }

    return (tool as any)({
      name: 'set_goals',
      description: 'Save a structured list of the user\'s goals with categories and progress tracking. Call this after the user shares their desired outcomes. Each goal should include: goal (string), categories (string[]), progress (number 0-100, always 0 at intake).',
      parameters: {
        type: 'object' as const,
        properties: {
          goals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                goal: {
                  type: 'string',
                  description: 'A concise description of the goal in the member\'s own words',
                },
                categories: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Categories: health, relationships, emotional_wellbeing, financial, habits, personal_growth, mindfulness',
                },
                progress: {
                  type: 'number',
                  description: 'Progress percentage 0-100. Always 0 at intake.',
                },
              },
              required: ['goal', 'categories', 'progress'],
            },
            description: 'Array of goal objects with goal text, categories, and progress',
          },
        },
        required: ['goals'] as const,
        additionalProperties: false as const,
      },
      strict: true,
      execute: async (input: SetGoalsParams) => {
        const { goals: rawGoals } = input;

        // Normalise and deduplicate
        const seen = new Set<string>();
        const uniqueGoals = (rawGoals || [])
          .filter((g): g is GoalInput => typeof g?.goal === 'string' && g.goal.trim().length > 0)
          .map(g => ({
            goal: g.goal.trim(),
            categories: Array.isArray(g.categories) ? g.categories : [],
            progress: typeof g.progress === 'number' ? g.progress : 0,
          }))
          .filter(g => {
            const key = g.goal.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

        if (uniqueGoals.length === 0) {
          toolLogger.debug(`set_goals called by agent ${agentName} with no usable goals`);
          return 'No goals were saved. Provide goals as an array of goal objects.';
        }

        const goalTitles = uniqueGoals.map(g => g.goal);
        toolLogger.debug(`set_goals called by agent ${agentName}: ${goalTitles.join(' | ')}`);

        // Store via record_input callback for logging
        if (runtime.recordInputCallback) {
          runtime.recordInputCallback('Goals', goalTitles.join('; '), `Captured ${uniqueGoals.length} goal(s)`, 'goals');
        }

        // Dispatch moduleStateUpdate to store native arrays in module state
        // ScreenContext listens for this event and calls updateModuleState
        window.dispatchEvent(new CustomEvent('moduleStateUpdate', {
          detail: {
            goalTitles,
            memberGoals: uniqueGoals,
          },
        }));

        return `Saved ${uniqueGoals.length} goal(s): ${goalTitles.join(', ')}`;
      },
    });
  }

  /**
   * Create the capture_weekly_focus tool for capturing the member's weekly focus
   * and optionally linking it to one of their goals.
   * Stores weeklyFocus, weeklyFocusGoal, and weeklyFocusCaption in module state
   * via a moduleStateUpdate window event — matching iOS stateManager.updateModuleState.
   */
  private createCaptureWeeklyFocusTool(agentName: string) {
    const runtime = this;

    interface CaptureWeeklyFocusParams {
      focus: string;
      relatedGoal?: string;
    }

    return (tool as any)({
      name: 'capture_weekly_focus',
      description: 'Capture the member\'s weekly focus and optionally link it to one of their goals. Stores the focus text, related goal, and a date caption in module state for display in a quote card.',
      parameters: {
        type: 'object' as const,
        properties: {
          focus: {
            type: 'string',
            description: 'The member\'s weekly focus in their own words',
          },
          relatedGoal: {
            type: 'string',
            description: 'The goal this focus relates to, if relevant. Should match one of the goals from set_goals.',
          },
        },
        required: ['focus'] as const,
        additionalProperties: false as const,
      },
      strict: true,
      execute: async (input: CaptureWeeklyFocusParams) => {
        const focus = input.focus?.trim();
        if (!focus) {
          toolLogger.debug(`capture_weekly_focus called by agent ${agentName} with no focus text`);
          return 'No focus text provided.';
        }

        const relatedGoal = input.relatedGoal?.trim() || null;

        // Generate date caption
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
        const caption = `\u2013 My focus set on ${dateStr}`;

        toolLogger.debug(`capture_weekly_focus called by agent ${agentName}: "${focus}"${relatedGoal ? ` (goal: ${relatedGoal})` : ''}`);

        // Store via record_input callback for logging
        if (runtime.recordInputCallback) {
          runtime.recordInputCallback('Weekly Focus', focus, relatedGoal ? `Related goal: ${relatedGoal}` : 'No related goal', 'weeklyFocus');
        }

        // Dispatch moduleStateUpdate to store in module state
        const stateUpdates: Record<string, any> = {
          weeklyFocus: `\u201C${focus}\u201D`,
          weeklyFocusCaption: caption,
        };
        if (relatedGoal) {
          stateUpdates.weeklyFocusGoal = relatedGoal;
        }

        window.dispatchEvent(new CustomEvent('moduleStateUpdate', {
          detail: stateUpdates,
        }));

        return `Weekly focus saved: "${focus}"${relatedGoal ? ` (related to goal: ${relatedGoal})` : ''}`;
      },
    });
  }

  /**
   * Create the setVoiceEnabled tool for enabling/disabling voice mode
   */
  private createSetVoiceEnabledTool(agentName: string) {
    const runtime = this;

    interface SetVoiceEnabledParams {
      enabled: boolean;
    }

    return (tool as any)({
      name: 'setVoiceEnabled',
      description: 'Enable or disable voice mode for the current session. Use enabled=true to start the voice agent and microphone, or enabled=false to stop voice mode and switch to button-based navigation.',
      parameters: {
        type: 'object' as const,
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Set to true to enable voice mode (start microphone and voice agent), or false to disable voice mode',
          },
        },
        required: ['enabled'] as const,
        additionalProperties: false as const,
      },
      strict: true,
      execute: async (input: SetVoiceEnabledParams) => {
        const { enabled } = input;

        toolLogger.debug(`setVoiceEnabled called by agent ${agentName}: enabled=${enabled}`);

        if (runtime.setVoiceEnabledCallback) {
          runtime.setVoiceEnabledCallback(enabled);
          return `Voice mode ${enabled ? 'enabled' : 'disabled'} successfully`;
        } else {
          toolLogger.warn('setVoiceEnabled callback not set. Voice state will not change.');
          return 'Voice state change requested but callback not available';
        }
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
 * Set the setVoiceEnabled callback for handling setVoiceEnabled tool calls
 * @deprecated Use JourneyRuntime class instead
 */
export function setSetVoiceEnabledCallback(callback: SetVoiceEnabledCallback): void {
  getDefaultRuntime().setSetVoiceEnabledCallback(callback);
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

/**
 * Helper: Parse a user-spoken time string into UTC HH:MM format
 * Uses the browser's local timezone to convert.
 * Examples: "8 PM" → "20:00" (in UTC, adjusted for timezone)
 *           "9 AM" → "09:00" (in UTC, adjusted for timezone)
 *           "20:00" → already 24h, converts to UTC
 *           "morning" → "09:00" (default), "evening" → "18:00" (default)
 */
function parseTimeToUTC(timeStr: string): string {
  const normalized = timeStr.trim().toLowerCase();

  // Handle vague time words
  const vagueMap: Record<string, [number, number]> = {
    'morning': [9, 0],
    'afternoon': [14, 0],
    'evening': [18, 0],
    'night': [21, 0],
    'noon': [12, 0],
    'midday': [12, 0],
    'midnight': [0, 0],
  };

  let localHours: number;
  let localMinutes: number;

  if (vagueMap[normalized]) {
    [localHours, localMinutes] = vagueMap[normalized];
  } else {
    // Try to parse time patterns: "8 PM", "8:30 PM", "8pm", "20:00", "8:00", "8 p.m."
    const timePattern = /(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i;
    const match = normalized.match(timePattern);

    if (!match) {
      // Can't parse - store as-is and let the backend handle it
      return timeStr;
    }

    localHours = parseInt(match[1], 10);
    localMinutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3]?.replace(/\./g, '').toLowerCase();

    // Convert 12h to 24h format
    if (period === 'pm' && localHours < 12) {
      localHours += 12;
    } else if (period === 'am' && localHours === 12) {
      localHours = 0;
    }
  }

  // Create a Date object set to today at the local time, then extract UTC hours/minutes
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), localHours, localMinutes, 0);
  const utcHours = localDate.getUTCHours();
  const utcMinutes = localDate.getUTCMinutes();

  return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
}

/**
 * Helper: Interpolate {{key}} placeholders in a string with values from context
 * Supports simple keys and dotted/nested paths:
 * - {{name}} -> context.name
 * - {{profile.goal}} -> context['profile.goal'] or context.profile.goal
 * - {{answer_feelings}} -> context.answer_feelings
 * 
 * Example: "Hello {{name}}, your goal is {{goal}}" with context {name: "John", goal: "wellness"}
 * becomes "Hello John, your goal is wellness"
 */
function interpolatePrompt(template: string, context: Record<string, any>): string {
  // Match {{key}}, {{key.subkey}}, {{key_with_underscores}}, {{key-with-dashes}}
  return template.replace(/\{\{([\w.-]+)\}\}/g, (match, key) => {
    // Keep runtime navigation placeholders dynamic so tool assignments can update
    // current/next screen state during the session.
    if (
      key === 'currentScreen' ||
      key === 'current_screen' ||
      key === 'nextScreen' ||
      key === 'next_screen' ||
      key === 'navigation_ok' ||
      key === 'navigation_reason'
    ) {
      return match;
    }

    // First try direct key lookup (handles "answer_feelings" and "profile.goal" as flat keys)
    if (context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }
    
    // Try nested path lookup for dotted keys (e.g., "profile.goal" -> context.profile.goal)
    if (key.includes('.')) {
      const parts = key.split('.');
      let value: any = context;
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined && value !== null) {
        return String(value);
      }
    }
    
    // Keep the placeholder if no value found
    return match;
  });
}
