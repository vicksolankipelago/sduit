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
  triggerEvent: (eventId: string, screens?: Screen[]) => void;
  navigateToScreen: (screenId: string, screens: Screen[]) => void;
  goBack: (screens: Screen[]) => void;
  interpolateString: (template: string) => string;
  evaluateConditions: (conditions?: any[]) => boolean;
}

const ScreenContext = createContext<ScreenContextState | undefined>(undefined);

export interface ScreenProviderProps {
  children: ReactNode;
  initialScreen?: Screen;
  initialModuleState?: Record<string, AnyCodable>;
  onEnableVoice?: () => void; // Direct callback for enable_voice tool - preserves user gesture context
}

export const ScreenProvider: React.FC<ScreenProviderProps> = ({
  children,
  initialScreen,
  initialModuleState = {},
  onEnableVoice,
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

  // Update current screen when initialScreen prop changes
  React.useEffect(() => {
    if (initialScreen) {
      // Always update when the initialScreen changes to support live editing
      setCurrentScreenState(initialScreen);
      // Only reset screen state if it's a different screen
      if (initialScreen.id !== currentScreen?.id) {
        setScreenState(initialScreen.state || {});
      }
    }
  }, [initialScreen]);

  // Sync module state from props if provided
  React.useEffect(() => {
    if (initialModuleState && Object.keys(initialModuleState).length > 0) {
      // Merge with existing state rather than replacing completely, to preserve
      // any state that might have been set locally before prop update
      setModuleState(prev => ({ ...prev, ...initialModuleState }));
    }
  }, [initialModuleState]);

  const setCurrentScreen = useCallback((screen: Screen | null) => {
    setCurrentScreenState(screen);
    if (screen) {
      // Reset screen state to initial state, clearing any recorded input from previous screen
      setScreenState(screen.state || {});
      setNavigationStack(prev => [...prev, screen.id]);
    }
  }, []);

  const updateScreenState = useCallback((updates: Record<string, AnyCodable>) => {
    setScreenState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateModuleState = useCallback((updates: Record<string, AnyCodable>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  }, []);

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
      
      if (storeKey && summary) {
        updateModuleState({ [storeKey]: summary });
      }
    };
    
    window.addEventListener('recordInput', handleRecordInput as EventListener);
    
    return () => {
      window.removeEventListener('recordInput', handleRecordInput as EventListener);
    };
  }, [updateScreenState, updateModuleState]);

  /**
   * Interpolate template strings like {$moduleData.key} or {$screenData.key}
   */
  const interpolateString = useCallback((template: string): string => {
    let result = template;

    // Replace {$moduleData.key} or {{$moduleData.key}} patterns
    const moduleDataPattern = /\{\{?\$moduleData\.([^}]+)\}\}?/g;
    result = result.replace(moduleDataPattern, (match, rawKey) => {
      const key = rawKey?.trim() ?? '';
      const value = getNestedValue(moduleState, key);
      return value !== undefined ? String(value) : match;
    });

    // Replace {$screenData.key} or {{$screenData.key}} patterns
    const screenDataPattern = /\{\{?\$screenData\.([^}]+)\}\}?/g;
    result = result.replace(screenDataPattern, (match, rawKey) => {
      const key = rawKey?.trim() ?? '';
      const value = getNestedValue(screenState, key);
      return value !== undefined ? String(value) : match;
    });

    return result;
  }, [screenState, moduleState]);

  /**
   * Evaluate JSON Logic conditions
   */
  const evaluateConditions = useCallback((conditions?: any[]): boolean => {
    if (!conditions || conditions.length === 0) return true;

    try {
      // Evaluate each condition
      for (const condition of conditions) {
        if (!condition.rules || !condition.state) continue;

        // Resolve state variables
        const resolvedState: Record<string, any> = {};
        for (const [key, valuePath] of Object.entries(condition.state)) {
          if (typeof valuePath === 'string' && valuePath.startsWith('$moduleData.')) {
            const path = valuePath.substring('$moduleData.'.length);
            resolvedState[key] = getNestedValue(moduleState, path);
          } else if (typeof valuePath === 'string' && valuePath.startsWith('$screenData.')) {
            const path = valuePath.substring('$screenData.'.length);
            resolvedState[key] = getNestedValue(screenState, path);
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
  }, [screenState, moduleState]);

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
          if (screenId) {
            navigateToScreen(screenId, screens);
          }
          break;
        }

        case 'stateUpdate': {
          const stateAction = action as StateUpdateAction;
          const scope = stateAction.scope || 'screen';
          if (scope === 'screen') {
            updateScreenState(stateAction.updates);
          } else {
            updateModuleState(stateAction.updates);
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
          // CRITICAL: For enable_voice, call direct callback to preserve user gesture context
          // The window.dispatchEvent pattern loses gesture context, blocking mic permission prompts
          if (toolAction.tool === 'enable_voice') {
            console.log('🎤🎤🎤 ENABLE_VOICE TOOL DETECTED IN SCREENCONTEXT 🎤🎤🎤');
            if (onEnableVoice) {
              console.log('🎤 Calling onEnableVoice callback DIRECTLY (preserves user gesture)');
              onEnableVoice();
            } else {
              console.warn('🎤 onEnableVoice callback not provided - falling back to event dispatch');
              // Fallback to event dispatch (will lose gesture context)
              const event = new CustomEvent('toolCallAction', {
                detail: { tool: toolAction.tool, params: toolAction.params || {} },
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
  }, [evaluateConditions, updateScreenState, updateModuleState]);

  /**
   * Trigger an event by ID
   */
  const triggerEvent = useCallback((eventId: string, screens: Screen[] = []) => {
    console.log('📢 triggerEvent called:', eventId, 'currentScreen:', currentScreen?.id, 'screens:', screens.length);
    
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
  }, [currentScreen, evaluateConditions, executeActions]);

  /**
   * Navigate to a screen by ID
   */
  const navigateToScreen = useCallback((screenId: string, screens: Screen[]) => {
    const screen = screens.find(s => s.id === screenId);
    if (screen) {
      setCurrentScreen(screen);
    } else {
      console.warn('Screen not found:', screenId);
    }
  }, [setCurrentScreen]);

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
        setScreenState(screen.state || {});
      }
      
      return newStack;
    });
  }, []);

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

