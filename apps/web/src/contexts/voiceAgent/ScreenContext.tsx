import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Screen, AnyCodable, ScreenEvent, EventAction, NavigationAction, StateUpdateAction, ToolCallAction } from '../../types/journey';
import jsonLogic from 'json-logic-js';

/**
 * Screen Context State
 */
export interface ScreenContextState {
  // Current screen
  currentScreen: Screen | null;
  
  // State management
  screenState: Record<string, AnyCodable>;
  moduleState: Record<string, AnyCodable>;
  
  // Navigation
  navigationStack: string[]; // Stack of screen IDs
  
  // Event queue
  eventQueue: ScreenEvent[];
  
  // Actions
  setCurrentScreen: (screen: Screen | null) => void;
  updateScreenState: (updates: Record<string, AnyCodable>) => void;
  updateModuleState: (updates: Record<string, AnyCodable>) => void;
  triggerEvent: (eventId: string, screens?: Screen[], eventData?: Record<string, any>) => void;
  navigateToScreen: (screenId: string, screens: Screen[]) => void;
  goBack: (screens: Screen[]) => void;
  interpolateString: (template: string) => string;
  resolveStateReference: (template: string) => any | undefined;
  evaluateConditions: (conditions?: any[]) => boolean;
}

const ScreenContext = createContext<ScreenContextState | undefined>(undefined);

export interface ScreenProviderProps {
  children: ReactNode;
  initialScreen?: Screen;
  initialModuleState?: Record<string, AnyCodable>;
  allScreens?: Screen[]; // All screens for event-driven navigation from voice agent tools
  onSetVoiceEnabled?: (enabled: boolean) => void; // Direct callback for setVoiceEnabled tool - preserves user gesture context
  onModuleStateChange?: (updates: Record<string, AnyCodable>) => void; // Callback to propagate module state changes to parent
}

export const ScreenProvider: React.FC<ScreenProviderProps> = ({
  children,
  initialScreen,
  initialModuleState = {},
  allScreens = [],
  onSetVoiceEnabled,
  onModuleStateChange,
}) => {
  const [currentScreen, setCurrentScreenState] = useState<Screen | null>(initialScreen || null);
  const [screenState, setScreenState] = useState<Record<string, AnyCodable>>(
    initialScreen?.state || {}
  );
  const [moduleState, setModuleState] = useState<Record<string, AnyCodable>>(initialModuleState);
  const [navigationStack, setNavigationStack] = useState<string[]>(
    initialScreen ? [initialScreen.id] : []
  );
  const [eventQueue, setEventQueue] = useState<ScreenEvent[]>([]);
  const previousScreenIdRef = React.useRef<string | null>(initialScreen?.id || null);
  
  // CRITICAL: Use refs to store the latest screen state immediately (synchronously)
  // This fixes the race condition where stateUpdate reads from screenState before React's async state update
  const screenStateRef = React.useRef<Record<string, AnyCodable>>(initialScreen?.state || {});
  const moduleStateRef = React.useRef<Record<string, AnyCodable>>(initialModuleState);

  // Update current screen when initialScreen prop changes.
  // IMPORTANT: only react to actual prop ID changes from parent.
  // If this effect runs on local currentScreen changes, it can "snap back"
  // to an old initialScreen and break text-card visibility after record_input.
  const prevInitialScreenIdRef = React.useRef<string | null>(initialScreen?.id ?? null);
  React.useEffect(() => {
    const nextInitialId = initialScreen?.id ?? null;
    if (!initialScreen || nextInitialId === prevInitialScreenIdRef.current) return;

    prevInitialScreenIdRef.current = nextInitialId;
    setCurrentScreenState(initialScreen);
    const newState = initialScreen.state || {};
    screenStateRef.current = newState; // Sync ref immediately
    setScreenState(newState);
  }, [initialScreen]);

  // Sync module state from parent props.
  // CRITICAL: Merge instead of replace to avoid wiping locally-set keys
  // (e.g. aboutYouSummary set via record_input) when the parent pushes
  // an unrelated update (e.g. agentLiveMessage).
  const prevInitialModuleStateRef = React.useRef<Record<string, AnyCodable>>(initialModuleState);
  React.useEffect(() => {
    const nextModuleState = initialModuleState || {};
    const prev = prevInitialModuleStateRef.current || {};
    prevInitialModuleStateRef.current = nextModuleState;

    // Compute only the keys that actually changed in the parent
    const delta: Record<string, AnyCodable> = {};
    for (const key of Object.keys(nextModuleState)) {
      if (nextModuleState[key] !== prev[key]) {
        delta[key] = nextModuleState[key];
      }
    }
    // Also detect keys removed in the parent
    for (const key of Object.keys(prev)) {
      if (!(key in nextModuleState)) {
        delta[key] = undefined as any;
      }
    }

    if (Object.keys(delta).length === 0) return;

    moduleStateRef.current = { ...moduleStateRef.current, ...delta };
    setModuleState(s => ({ ...s, ...delta }));
  }, [initialModuleState]);

  const setCurrentScreen = useCallback((screen: Screen | null) => {
    setCurrentScreenState(screen);
    if (screen) {
      // Reset screen state to initial state, clearing any recorded input from previous screen
      const newState = screen.state || {};
      screenStateRef.current = newState; // Sync ref immediately
      setScreenState(newState);
      setNavigationStack(prev => [...prev, screen.id]);
    }
  }, []);

  const updateScreenState = useCallback((updates: Record<string, AnyCodable>) => {
    // CRITICAL: Update ref immediately (synchronous) to fix race condition
    // This ensures interpolateString can read the latest value even before React re-renders
    screenStateRef.current = { ...screenStateRef.current, ...updates };
    setScreenState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateModuleState = useCallback((updates: Record<string, AnyCodable>) => {
    // CRITICAL: Update ref immediately (synchronous) to fix race condition
    moduleStateRef.current = { ...moduleStateRef.current, ...updates };
    setModuleState(prev => ({ ...prev, ...updates }));
    // Propagate module state changes to parent (AgentUIContext)
    if (onModuleStateChange) {
      console.log('📤 ScreenContext: Propagating module state to parent:', Object.keys(updates));
      onModuleStateChange(updates);
    }
  }, [onModuleStateChange]);

  // Keep both screen pointer keys in sync for prompt/runtime compatibility.
  React.useEffect(() => {
    const screenId = currentScreen?.id;
    if (!screenId) return;

    const moduleCurrentScreen = typeof moduleStateRef.current.currentScreen === 'string'
      ? moduleStateRef.current.currentScreen
      : '';
    const moduleCurrentScreenLegacy = typeof moduleStateRef.current.current_screen === 'string'
      ? moduleStateRef.current.current_screen
      : '';
    if (moduleCurrentScreen === screenId && moduleCurrentScreenLegacy === screenId) {
      return;
    }

    updateModuleState({
      currentScreen: screenId,
      current_screen: screenId,
    });
  }, [currentScreen?.id, updateModuleState]);

  // Emit a dedicated event whenever the active screen actually changes.
  // This powers flow-level logs for transition debugging.
  React.useEffect(() => {
    const currentScreenId = currentScreen?.id || null;
    const previousScreenId = previousScreenIdRef.current;

    if (!currentScreenId || currentScreenId === previousScreenId) {
      return;
    }

    previousScreenIdRef.current = currentScreenId;

    window.dispatchEvent(new CustomEvent('screenChanged', {
      detail: {
        type: 'screen_changed',
        fromScreen: previousScreenId,
        toScreen: currentScreenId,
        navigationDepth: navigationStack.length,
        timestamp: Date.now(),
      },
    }));
  }, [currentScreen?.id, navigationStack.length]);

  // Listen for record_input events from voice agent
  React.useEffect(() => {
    const handleRecordInput = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { title, summary, description, storeKey } = customEvent.detail;
      
      console.log('📝 ScreenContext: Received record_input event', { title, summary, storeKey });
      
      // Update screen state with recorded input
      updateScreenState({
        recordedInputTitle: title,
        recordedInputSummary: summary,
        recordedInputDescription: description || '',
        recordedInputTimestamp: Date.now(),
      });
      
      const moduleUpdates = deriveRecordInputModuleUpdates(title, summary, storeKey);
      if (Object.keys(moduleUpdates).length > 0) {
        updateModuleState(moduleUpdates);
      }
    };
    
    window.addEventListener('recordInput', handleRecordInput as EventListener);
    
    return () => {
      window.removeEventListener('recordInput', handleRecordInput as EventListener);
    };
  }, [updateScreenState, updateModuleState]);

  /**
   * Resolve a pure state reference to its native value (array, object, etc).
   * Matches iOS ResolvableValue<T> behaviour: if the entire string is a single
   * braced reference like "{$moduleData.goalTitles}", return the raw value from
   * state rather than stringifying it. Returns undefined if not a pure reference.
   */
  const resolveStateReference = useCallback((template: string): any | undefined => {
    const pureRefPattern = /^\{(\$(?:moduleData|screenData|screenState|state)\.([^}]+))\}$/;
    const match = template.match(pureRefPattern);
    if (!match) return undefined;

    const fullRef = match[1];
    const key = match[2]?.trim();
    if (!key) return undefined;

    if (fullRef.startsWith('$moduleData.')) {
      return getNestedValue(moduleStateRef.current, key);
    } else if (fullRef.startsWith('$screenData.') || fullRef.startsWith('$screenState.') || fullRef.startsWith('$state.')) {
      return getNestedValue(screenStateRef.current, key);
    }
    return undefined;
  }, []);

  /**
   * Interpolate template strings like {$moduleData.key}, {$screenData.key}, or {$screenState.key}
   * CRITICAL: Uses refs instead of state to avoid race conditions with async React state updates
   */
  const interpolateString = useCallback((template: string): string => {
    let result = template;

    // Replace {$moduleData.key} or {{$moduleData.key}} patterns
    // Uses ref for immediate access to latest value
    const moduleDataPattern = /\{\{?\$moduleData\.([^}]+)\}\}?/g;
    result = result.replace(moduleDataPattern, (match, rawKey) => {
      const key = rawKey?.trim() ?? '';
      const value = getNestedValue(moduleStateRef.current, key);
      return value !== undefined ? String(value) : match;
    });

    // Replace {$screenData.key} or {{$screenData.key}} patterns
    // Uses ref for immediate access to latest value
    const screenDataPattern = /\{\{?\$screenData\.([^}]+)\}\}?/g;
    result = result.replace(screenDataPattern, (match, rawKey) => {
      const key = rawKey?.trim() ?? '';
      const value = getNestedValue(screenStateRef.current, key);
      return value !== undefined ? String(value) : match;
    });

    // Replace {$screenState.key} or {{$screenState.key}} patterns (used by quiz screens)
    // This is the primary pattern used for storing quiz answers like {$screenState.selectedOption}
    // For multi-select (selectedOptions), stores as JSON array for later parsing
    // CRITICAL: Uses screenStateRef for immediate synchronous access to fix race condition
    const screenStatePattern = /\{\{?\$screenState\.([^}]+)\}\}?/g;
    result = result.replace(screenStatePattern, (match, rawKey) => {
      const key = rawKey?.trim() ?? '';
      const value = getNestedValue(screenStateRef.current, key);
      
      if (value === undefined || value === null) {
        console.log(`📝 Interpolating {$screenState.${key}}: undefined (keeping original)`);
        return match;
      }
      
      // Handle arrays (for multi-select like selectedOptions) - store as JSON
      if (Array.isArray(value)) {
        const jsonValue = JSON.stringify(value);
        console.log(`📝 Interpolating {$screenState.${key}} (array): ${jsonValue}`);
        return jsonValue;
      }
      
      console.log(`📝 Interpolating {$screenState.${key}}: ${String(value)}`);
      return String(value);
    });

    return result;
  }, []);

  /**
   * Evaluate JSON Logic conditions
   */
  const evaluateConditions = useCallback((conditions?: any[]): boolean => {
    if (!conditions || conditions.length === 0) return true;

    try {
      // Evaluate each condition
      // CRITICAL: Uses refs instead of React state to avoid race conditions with async state updates
      for (const condition of conditions) {
        if (!condition.rules || !condition.state) continue;

        // Resolve state variables using refs for immediate access
        // Matches iOS EventStateManager.resolveVariable: strips braces first, then checks prefix
        const resolvedState: Record<string, any> = {};
        for (const [key, valuePath] of Object.entries(condition.state)) {
          if (typeof valuePath !== 'string') {
            resolvedState[key] = valuePath;
            continue;
          }
          // Strip braces if present — iOS format is "{$moduleData.key}" with braces
          const cleaned = (valuePath.startsWith('{') && valuePath.endsWith('}'))
            ? valuePath.slice(1, -1)
            : valuePath;
          
          if (cleaned.startsWith('$moduleData.')) {
            const path = cleaned.substring('$moduleData.'.length);
            resolvedState[key] = getNestedValue(moduleStateRef.current, path);
          } else if (
            cleaned.startsWith('$screenData.')
            || cleaned.startsWith('$screenState.')
            || cleaned.startsWith('$state.')
          ) {
            const prefix = cleaned.startsWith('$screenData.')
              ? '$screenData.'
              : cleaned.startsWith('$screenState.')
                ? '$screenState.'
                : '$state.';
            const path = cleaned.substring(prefix.length);
            resolvedState[key] = getNestedValue(screenStateRef.current, path);
          } else {
            resolvedState[key] = valuePath;
          }
        }

        // Evaluate JSON Logic
        const result = jsonLogic.apply(condition.rules, resolvedState);
        if (!result) return false;
      }

      return true;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }, []); // No dependencies - refs are stable and always have latest values

  /**
   * Execute event actions
   */
  const executeActions = useCallback((actions: EventAction[], screens: Screen[]) => {
    for (const action of actions) {
      // Check action-level conditions
      if ('conditions' in action && action.conditions) {
        if (!evaluateConditions(action.conditions)) {
          continue; // Skip this action if conditions not met
        }
      }

      switch (action.type) {
        case 'navigation': {
          const navAction = action as NavigationAction;
          // Extract screen ID from deeplink
          const screenId = extractScreenIdFromDeeplink(navAction.deeplink);
          console.log(`🧭 Navigation action: deeplink="${navAction.deeplink}" -> screenId="${screenId}"`);
          
          // Dispatch navigation event for logging
          window.dispatchEvent(new CustomEvent('screenNavigation', {
            detail: {
              type: 'navigation',
              fromScreen: currentScreen?.id,
              toScreen: screenId,
              deeplink: navAction.deeplink,
              screensAvailable: screens.length,
              screenIds: screens.map(s => s.id),
            }
          }));
          
          if (screenId) {
            navigateToScreen(screenId, screens);
          } else {
            console.warn('⚠️ Could not extract screen ID from deeplink:', navAction.deeplink);
          }
          break;
        }

        case 'stateUpdate': {
          const stateAction = action as StateUpdateAction;
          const scope = stateAction.scope || 'screen';
          
          const interpolatedUpdates: Record<string, any> = {};
          for (const [key, value] of Object.entries(stateAction.updates)) {
            if (typeof value === 'string') {
              const nativeValue = resolveStateReference(value);
              if (nativeValue !== undefined) {
                interpolatedUpdates[key] = nativeValue;
                console.log(`📝 StateUpdate (native): ${key} = "${value}" → ${JSON.stringify(nativeValue)} (${typeof nativeValue}${Array.isArray(nativeValue) ? '[]' : ''})`);
              } else {
                const interpolatedValue = interpolateString(value);
                interpolatedUpdates[key] = interpolatedValue;
                console.log(`📝 StateUpdate: ${key} = "${value}" → "${interpolatedValue}"`);
              }
            } else if (Array.isArray(value)) {
              interpolatedUpdates[key] = value.map(v => {
                if (typeof v !== 'string') return v;
                const native = resolveStateReference(v);
                return native !== undefined ? native : interpolateString(v);
              });
              console.log(`📝 StateUpdate (array): ${key} = ${JSON.stringify(value)} → ${JSON.stringify(interpolatedUpdates[key])}`);
            } else {
              interpolatedUpdates[key] = value;
            }
          }
          
          if (scope === 'screen') {
            updateScreenState(interpolatedUpdates);
          } else {
            updateModuleState(interpolatedUpdates);
          }
          break;
        }

        case 'toolCall': {
          const toolAction = action as ToolCallAction;
          console.log(`🔧🔧🔧 ScreenContext: Tool call action: ${toolAction.tool} 🔧🔧🔧`, toolAction.params);
          
          // Debug logs for specific tools
          if (toolAction.tool === 'start_journey') {
            console.log('🔗 START_JOURNEY TOOL DETECTED IN SCREENCONTEXT');
          }
          // CRITICAL: For setVoiceEnabled, call direct callback to preserve user gesture context
          // The window.dispatchEvent pattern loses gesture context, blocking mic permission prompts
          if (toolAction.tool === 'setVoiceEnabled') {
            const enabled = (toolAction.params as { enabled?: boolean })?.enabled ?? true;
            console.log(`🎤🎤🎤 setVoiceEnabled TOOL DETECTED IN SCREENCONTEXT: enabled=${enabled} 🎤🎤🎤`);
            if (onSetVoiceEnabled) {
              console.log(`🎤 Calling onSetVoiceEnabled callback DIRECTLY (preserves user gesture): enabled=${enabled}`);
              onSetVoiceEnabled(enabled);
            } else {
              console.warn('🎤 onSetVoiceEnabled callback not provided - falling back to event dispatch');
              // Fallback to event dispatch (will lose gesture context)
              const event = new CustomEvent('toolCallAction', {
                detail: { tool: toolAction.tool, params: toolAction.params || {} },
                bubbles: true,
              });
              window.dispatchEvent(event);
            }
            break; // Don't dispatch event again for setVoiceEnabled
          }
          // Legacy support for enable_voice (deprecated - use setVoiceEnabled instead)
          if (toolAction.tool === 'enable_voice') {
            console.log('🎤🎤🎤 LEGACY enable_voice TOOL DETECTED - converting to setVoiceEnabled(true) 🎤🎤🎤');
            if (onSetVoiceEnabled) {
              console.log('🎤 Calling onSetVoiceEnabled(true) callback DIRECTLY (preserves user gesture)');
              onSetVoiceEnabled(true);
            } else {
              console.warn('🎤 onSetVoiceEnabled callback not provided - falling back to event dispatch');
              const event = new CustomEvent('toolCallAction', {
                detail: { tool: 'setVoiceEnabled', params: { enabled: true } },
                bubbles: true,
              });
              window.dispatchEvent(event);
            }
            break; // Don't dispatch event again for enable_voice
          }
          
          // Dispatch a custom event that VoiceAgent or other components can listen to
          const event = new CustomEvent('toolCallAction', {
            detail: {
              tool: toolAction.tool,
              params: toolAction.params || {},
            },
            bubbles: true,
          });
          console.log(`🔧 ScreenContext: Dispatching toolCallAction event to window for tool: ${toolAction.tool}`);
          window.dispatchEvent(event);
          console.log(`🔧 ScreenContext: toolCallAction event DISPATCHED for: ${toolAction.tool}`);
          
          // Handle built-in tool actions
          if (toolAction.tool === 'store_answer' && toolAction.params) {
            const { questionId, answer } = toolAction.params as { questionId?: string; answer?: string };
            if (questionId && answer) {
              updateModuleState({ [`answer_${questionId}`]: answer });
              console.log(`📝 Stored answer: ${questionId} = ${answer}`);
            }
          }
          
          if (toolAction.tool === 'complete_quiz') {
            updateModuleState({ quizCompleted: true });
            console.log('✅ Quiz completed');
          }
          
          break;
        }

        case 'custom':
        case 'serviceCall':
        case 'closeModule':
          console.log('Action not yet implemented:', action.type);
          break;
      }
    }
  }, [
    currentScreen,
    evaluateConditions,
    interpolateString,
    navigateToScreen,
    onSetVoiceEnabled,
    resolveStateReference,
    updateModuleState,
    updateScreenState,
  ]);

  /**
   * Trigger an event by ID
   * @param eventId - The event ID to trigger
   * @param screens - Available screens for navigation
   * @param eventData - Optional data from the element (e.g., { storeKey: 'feelings_alcohol', selectedValue: 'want_to_cut_down' })
   */
  const triggerEvent = useCallback((eventId: string, screens: Screen[] = [], eventData?: Record<string, any>) => {
    console.log('📢 triggerEvent called:', eventId, 'currentScreen:', currentScreen?.id, 'screens:', screens.length, 'eventData:', eventData);
    
    // Dispatch event trigger for logging
    window.dispatchEvent(new CustomEvent('eventTriggered', {
      detail: {
        eventId,
        currentScreen: currentScreen?.id,
        screensCount: screens.length,
        eventData,
      }
    }));
    
    // If eventData includes storeKey and selectedValue, store in moduleState
    // This allows quiz elements to store their selections automatically
    if (eventData?.storeKey && eventData?.selectedValue !== undefined) {
      console.log(`📝 Storing quiz answer: ${eventData.storeKey} = ${eventData.selectedValue}`);
      updateModuleState({ [eventData.storeKey]: eventData.selectedValue });
    }
    
    if (!currentScreen) {
      console.log('⚠️ No current screen, cannot trigger event');
      return;
    }

    // Find event in current screen's top-level events
    const event = currentScreen.events?.find(e => e.id === eventId);
    console.log('📢 Screen-level event search:', event ? 'found' : 'not found');
    
    // Also check element events (within sections)
    const elementEvent = currentScreen.sections
      .flatMap(section => section.elements)
      .flatMap(element => element.events || [])
      .find(e => e.id === eventId);
    console.log('📢 Element-level event search:', elementEvent ? 'found' : 'not found');

    const foundEvent = event || elementEvent;

    if (foundEvent) {
      console.log('✅ Event found:', foundEvent.id, 'actions:', foundEvent.action?.length || 0);
      
      // Check event-level conditions
      if (foundEvent.conditions && !evaluateConditions(foundEvent.conditions)) {
        console.log('Event conditions not met:', eventId);
        return;
      }

      // Execute actions
      if (foundEvent.action && foundEvent.action.length > 0) {
        console.log('🚀 Executing actions:', foundEvent.action);
        executeActions(foundEvent.action, screens);
      } else {
        console.log('⚠️ No actions to execute for event:', eventId);
      }

      // Add to event queue for tracking
      setEventQueue(prev => [...prev, foundEvent]);
    } else {
      console.warn('Event not found:', eventId);
    }
  }, [currentScreen, evaluateConditions, executeActions, updateModuleState]);

  /**
   * Navigate to a screen by ID
   */
  const navigateToScreen = useCallback((screenId: string, screens: Screen[]) => {
    console.log(`🧭 navigateToScreen called: screenId="${screenId}", screens.length=${screens.length}`);
    const screen = screens.find(s => s.id === screenId);
    if (screen) {
      console.log(`✅ Screen found: "${screenId}" - navigating from "${currentScreen?.id}" to "${screen.id}"`);
      setCurrentScreen(screen);
      
      // Dispatch success event for logging
      window.dispatchEvent(new CustomEvent('screenNavigationResult', {
        detail: {
          success: true,
          fromScreen: currentScreen?.id,
          toScreen: screen.id,
        }
      }));
    } else {
      console.warn(`❌ Screen not found: "${screenId}". Available screens: [${screens.map(s => s.id).join(', ')}]`);
      
      // Dispatch failure event for logging
      window.dispatchEvent(new CustomEvent('screenNavigationResult', {
        detail: {
          success: false,
          fromScreen: currentScreen?.id,
          toScreen: screenId,
          availableScreens: screens.map(s => s.id),
        }
      }));
    }
  }, [setCurrentScreen, currentScreen]);

  /**
   * Go back to previous screen
   */
  const goBack = useCallback((screens: Screen[]) => {
    setNavigationStack(prev => {
      if (prev.length <= 1) return prev;
      
      const newStack = prev.slice(0, -1);
      const previousScreenId = newStack[newStack.length - 1];
      
      const screen = screens.find(s => s.id === previousScreenId);
      if (screen) {
        setCurrentScreenState(screen);
        const newState = screen.state || {};
        screenStateRef.current = newState; // Sync ref immediately
        setScreenState(newState);
      }
      
      return newStack;
    });
  }, []);

  // Listen for moduleStateUpdate events from voice agent tools (Azure/OpenAI journeyRuntime)
  // Allows tools that store non-string data (arrays, objects) to update module state directly,
  // matching iOS's stateManager.updateModuleState pattern.
  React.useEffect(() => {
    const handleModuleStateUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const updates = customEvent.detail;
      if (updates && typeof updates === 'object') {
        console.log('📦 ScreenContext: Received moduleStateUpdate', Object.keys(updates));
        updateModuleState(updates);
      }
    };

    window.addEventListener('moduleStateUpdate', handleModuleStateUpdate as EventListener);

    return () => {
      window.removeEventListener('moduleStateUpdate', handleModuleStateUpdate as EventListener);
    };
  }, [updateModuleState]);

  // Listen for trigger_event events from voice agent tools (ElevenLabs)
  // This allows the agent to navigate screens via tool calls
  React.useEffect(() => {
    const handleTriggerEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { eventId, eventData } = customEvent.detail;

      console.log('⚡ ScreenContext: Received trigger_event', { eventId, eventData, screensCount: allScreens.length });

      // Call triggerEvent with the stored allScreens
      if (eventId && allScreens.length > 0) {
        triggerEvent(eventId, allScreens, eventData);
      } else {
        console.warn('⚠️ Cannot trigger event: missing eventId or no screens available');
      }
    };

    window.addEventListener('triggerEvent', handleTriggerEvent as EventListener);

    return () => {
      window.removeEventListener('triggerEvent', handleTriggerEvent as EventListener);
    };
  }, [triggerEvent, allScreens]);

  const value: ScreenContextState = {
    currentScreen,
    screenState,
    moduleState,
    navigationStack,
    eventQueue,
    setCurrentScreen,
    updateScreenState,
    updateModuleState,
    triggerEvent,
    navigateToScreen,
    goBack,
    interpolateString,
    resolveStateReference,
    evaluateConditions,
  };

  return (
    <ScreenContext.Provider value={value}>
      {children}
    </ScreenContext.Provider>
  );
};

/**
 * Hook to use Screen Context
 */
export const useScreenContext = (): ScreenContextState => {
  const context = useContext(ScreenContext);
  if (!context) {
    throw new Error('useScreenContext must be used within a ScreenProvider');
  }
  return context;
};

function normalizeRecordInputTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function toCamelCaseKey(input: string): string {
  const parts = normalizeRecordInputTitle(input).split(' ').filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
}

function deriveRecordInputModuleUpdates(
  title: unknown,
  summary: unknown,
  storeKey: unknown
): Record<string, AnyCodable> {
  const summaryText = typeof summary === 'string' ? summary.trim() : '';
  if (!summaryText) return {};

  const updates: Record<string, AnyCodable> = {};
  const safeStoreKey = typeof storeKey === 'string' ? storeKey.trim() : '';
  const normalizedTitle = normalizeRecordInputTitle(typeof title === 'string' ? title : '');

  const setUpdate = (key: string) => {
    if (key && updates[key] === undefined) {
      updates[key] = summaryText;
    }
  };

  if (safeStoreKey) {
    setUpdate(safeStoreKey);
  }

  if (normalizedTitle) {
    const titleKey = toCamelCaseKey(normalizedTitle);
    if (titleKey) {
      setUpdate(titleKey);
      if (!titleKey.endsWith('Summary')) {
        setUpdate(`${titleKey}Summary`);
      }
    }
  }

  return updates;
}

/**
 * Helper: Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
  const keys = path.split('.');
  let value: any = obj;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  
  return value;
}

/**
 * Helper: Extract screen ID from deeplink
 */
function extractScreenIdFromDeeplink(deeplink: string): string | null {
  try {
    // Expected format: https://links.pelagohealth.com/module-id/screen-id
    const url = new URL(deeplink);
    const pathParts = url.pathname.split('/').filter(Boolean);
    return pathParts[pathParts.length - 1] || null;
  } catch {
    // If not a valid URL, assume it's just the screen ID
    return deeplink;
  }
}
