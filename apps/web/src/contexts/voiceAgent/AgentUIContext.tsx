import React, { createContext, useContext, useState, useCallback, FC, PropsWithChildren, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { AgentUIRegistry } from "../../lib/voiceAgent/agentUIRegistry";
import { initializeAllAgentUI } from "../../lib/voiceAgent/initializeAgentUI";
import { AgentUIContextValue, UIComponentConfig, UIRegistryEntry } from "../../types/voiceAgentUI";
import { Screen } from "../../types/journey";

const AgentUIContext = createContext<AgentUIContextValue | undefined>(undefined);

export const AgentUIProvider: FC<PropsWithChildren> = ({ children }) => {
  const [activeComponents, setActiveComponents] = useState<UIComponentConfig[]>([]);
  const [registeredComponents] = useState<Map<string, UIRegistryEntry>>(new Map());
  
  // Screen-based rendering state
  const [screenRenderingMode, setScreenRenderingMode] = useState(false);
  const [currentAgentScreens, setCurrentAgentScreens] = useState<Screen[]>([]);
  const [currentScreenId, setCurrentScreenId] = useState<string | null>(null);
  
  // Shared module state
  const [moduleState, setModuleState] = useState<Record<string, any>>({});

  // Initialise the registry on mount
  useEffect(() => {
    initializeAllAgentUI();
    const registry = AgentUIRegistry.getInstance();
    const registrations = registry.getRegistrations();
    
    // Copy all registrations to the context
    registrations.forEach((entry, key) => {
      registeredComponents.set(key, entry);
    });
  }, [registeredComponents]);

  const registerUIComponent = useCallback((key: string, entry: UIRegistryEntry) => {
    registeredComponents.set(key, entry);
  }, [registeredComponents]);

  const unregisterUIComponent = useCallback((key: string) => {
    registeredComponents.delete(key);
  }, [registeredComponents]);

  const showUI = useCallback((key: string, props: any = {}, overrides: Partial<UIComponentConfig> = {}): string | null => {
    const entry = registeredComponents.get(key);
    if (!entry) {
      console.warn(`UI component not found for key: ${key}`);
      return null;
    }

    const id = uuidv4();
    const component: UIComponentConfig = {
      id,
      component: entry.component,
      props: { ...props, id },
      createdAt: Date.now(),
      ...entry.config,
      ...overrides,
    };

    setActiveComponents(prev => {
      // Handle allowMultiple behaviour
      if (!component.behavior.allowMultiple) {
        // Remove existing components of the same type or from same registration key
        const filtered = prev.filter(comp => {
          const compEntry = Array.from(registeredComponents.entries())
            .find(([, regEntry]) => regEntry.component === comp.component);
          return compEntry?.[0] !== key;
        });
        return [...filtered, component].sort((a, b) => (b.behavior.priority || 0) - (a.behavior.priority || 0));
      }
      
      return [...prev, component].sort((a, b) => (b.behavior.priority || 0) - (a.behavior.priority || 0));
    });

    // Auto-dismiss if configured
    if (component.behavior.autoDismiss && component.behavior.dismissDelay) {
      setTimeout(() => {
        hideUI(id);
      }, component.behavior.dismissDelay);
    }

    return id;
  }, [registeredComponents]);

  const hideUI = useCallback((id: string) => {
    setActiveComponents(prev => prev.filter(comp => comp.id !== id));
  }, []);

  const hideAllUI = useCallback(() => {
    setActiveComponents([]);
  }, []);

  const triggerAgentUI = useCallback((agentName: string, data: any = {}) => {
    const agentKey = `agent:${agentName}`;
    showUI(agentKey, data);
  }, [showUI]);

  const triggerFunctionUI = useCallback((functionName: string, parameters: any = {}, agentName?: string) => {
    // Try agent-specific function first
    if (agentName) {
      const agentFunctionKey = `${agentName}:${functionName}`;
      if (registeredComponents.has(agentFunctionKey)) {
        showUI(agentFunctionKey, parameters);
        return;
      }
    }
    
    // Fall back to global function
    const functionKey = `function:${functionName}`;
    showUI(functionKey, parameters);
  }, [showUI, registeredComponents]);

  const triggerEventUI = useCallback((eventType: string, data: any = {}) => {
    const eventKey = `event:${eventType}`;
    showUI(eventKey, data);
  }, [showUI]);

  // Screen rendering methods
  const enableScreenRendering = useCallback((screens: Screen[], initialScreenId?: string) => {
    setScreenRenderingMode(true);
    setCurrentAgentScreens(screens);
    setCurrentScreenId(initialScreenId || (screens.length > 0 ? screens[0].id : null));
    // Hide all card-based UI when switching to screen mode
    hideAllUI();
  }, [hideAllUI]);

  const disableScreenRendering = useCallback(() => {
    setScreenRenderingMode(false);
    setCurrentAgentScreens([]);
    setCurrentScreenId(null);
  }, []);

  const navigateToScreen = useCallback((screenId: string) => {
    setCurrentScreenId(screenId);
  }, []);

  const updateModuleState = useCallback((updates: Record<string, any>) => {
    setModuleState(prev => ({ ...prev, ...updates }));
  }, []);

  return (
    <AgentUIContext.Provider
      value={{
        activeComponents,
        registeredComponents,
        registerUIComponent,
        unregisterUIComponent,
        showUI,
        hideUI,
        hideAllUI,
        triggerAgentUI,
        triggerFunctionUI,
        triggerEventUI,
        // Screen rendering
        screenRenderingMode,
        currentAgentScreens,
        currentScreenId,
        enableScreenRendering,
        disableScreenRendering,
        navigateToScreen,
        moduleState,
        updateModuleState,
      }}
    >
      {children}
    </AgentUIContext.Provider>
  );
};

export function useAgentUI() {
  const context = useContext(AgentUIContext);
  if (!context) {
    throw new Error("useAgentUI must be used within an AgentUIProvider");
  }
  return context;
}
