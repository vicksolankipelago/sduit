import { UIRegistryEntry, AnimationType, PositionType, UIComponentType } from '../../types/voiceAgentUI';

// Helper types for easier registration
export interface QuickUIConfig {
  animation?: {
    entrance?: AnimationType;
    exit?: AnimationType;
    duration?: number;
    delay?: number;
    easing?: string;
  };
  behavior?: {
    autoDismiss?: boolean;
    dismissDelay?: number;
    dismissOnClick?: boolean;
    dismissOnEscape?: boolean;
    allowMultiple?: boolean;
    priority?: number;
  };
  positioning?: {
    position?: PositionType;
    offset?: { x?: number; y?: number };
  };
  type?: UIComponentType;
  zIndex?: number;
}

// Default configurations for different UI types
export const DEFAULT_CONFIGS: Record<UIComponentType, QuickUIConfig> = {
  card: {
    animation: { entrance: 'slide-in-right', exit: 'slide-in-right', duration: 300 },
    behavior: { autoDismiss: true, dismissDelay: 3000, dismissOnClick: true, dismissOnEscape: true },
    positioning: { position: 'top-right' },
    type: 'card',
  },
  modal: {
    animation: { entrance: 'fade-in', exit: 'fade-in', duration: 200 },
    behavior: { dismissOnClick: true, dismissOnEscape: true, priority: 100 },
    positioning: { position: 'center' },
    type: 'modal',
    zIndex: 2000,
  },
  toast: {
    animation: { entrance: 'slide-in-top', exit: 'slide-in-top', duration: 250 },
    behavior: { autoDismiss: true, dismissDelay: 4000, allowMultiple: true },
    positioning: { position: 'top-center' },
    type: 'toast',
  },
  sidebar: {
    animation: { entrance: 'slide-in-left', exit: 'slide-in-left', duration: 300 },
    behavior: { dismissOnEscape: true, priority: 50 },
    positioning: { position: 'center-left' },
    type: 'sidebar',
    zIndex: 1500,
  },
  'bottom-sheet': {
    animation: { entrance: 'slide-in-bottom', exit: 'slide-in-bottom', duration: 300 },
    behavior: { dismissOnEscape: true },
    positioning: { position: 'bottom-center' },
    type: 'bottom-sheet',
    zIndex: 1500,
  },
  floating: {
    animation: { entrance: 'scale-in', exit: 'scale-in', duration: 200 },
    behavior: { dismissOnClick: true, allowMultiple: true },
    positioning: { position: 'center' },
    type: 'floating',
  },
  overlay: {
    animation: { entrance: 'fade-in', exit: 'fade-in', duration: 200 },
    behavior: { dismissOnClick: true },
    positioning: { position: 'center' },
    type: 'overlay',
    zIndex: 1000,
  },
  inline: {
    animation: { entrance: 'fade-in', exit: 'fade-in', duration: 150 },
    behavior: { allowMultiple: true },
    positioning: { position: 'custom' },
    type: 'inline',
  },
  custom: {
    animation: { entrance: 'fade-in', exit: 'fade-in', duration: 300 },
    behavior: {},
    positioning: { position: 'custom' },
    type: 'custom',
  },
};

// Registry helper class
export class AgentUIRegistry {
  private static instance: AgentUIRegistry;
  private registrations: Map<string, UIRegistryEntry> = new Map();

  static getInstance(): AgentUIRegistry {
    if (!AgentUIRegistry.instance) {
      AgentUIRegistry.instance = new AgentUIRegistry();
    }
    return AgentUIRegistry.instance;
  }

  // Register a UI component for a specific function (global)
  registerFunction(
    functionName: string,
    component: React.ComponentType<any>,
    config: QuickUIConfig = {}
  ): void {
    const key = `function:${functionName}`;
    const defaultConfig = DEFAULT_CONFIGS[config.type || 'card'];
    const mergedConfig = this.mergeConfigs(defaultConfig, config);
    
    this.registrations.set(key, {
      functionName,
      component,
      config: this.convertToUIConfig(mergedConfig),
    });
  }

  // Register a UI component for a specific agent
  registerAgent(
    agentName: string,
    component: React.ComponentType<any>,
    config: QuickUIConfig = {}
  ): void {
    const key = `agent:${agentName}`;
    const defaultConfig = DEFAULT_CONFIGS[config.type || 'card'];
    const mergedConfig = this.mergeConfigs(defaultConfig, config);
    
    this.registrations.set(key, {
      agentName,
      component,
      config: this.convertToUIConfig(mergedConfig),
    });
  }

  // Register a UI component for a specific agent-function combination
  registerAgentFunction(
    agentName: string,
    functionName: string,
    component: React.ComponentType<any>,
    config: QuickUIConfig = {}
  ): void {
    const key = `${agentName}:${functionName}`;
    const defaultConfig = DEFAULT_CONFIGS[config.type || 'card'];
    const mergedConfig = this.mergeConfigs(defaultConfig, config);
    
    this.registrations.set(key, {
      agentName,
      functionName,
      component,
      config: this.convertToUIConfig(mergedConfig),
    });
  }

  // Register a UI component for custom events
  registerEvent(
    eventType: string,
    component: React.ComponentType<any>,
    config: QuickUIConfig = {}
  ): void {
    const key = `event:${eventType}`;
    const defaultConfig = DEFAULT_CONFIGS[config.type || 'card'];
    const mergedConfig = this.mergeConfigs(defaultConfig, config);
    
    this.registrations.set(key, {
      eventType,
      component,
      config: this.convertToUIConfig(mergedConfig),
    });
  }

  // Get all registrations (used to populate the context)
  getRegistrations(): Map<string, UIRegistryEntry> {
    return new Map(this.registrations);
  }

  // Remove a registration
  unregister(key: string): void {
    this.registrations.delete(key);
  }

  // Clear all registrations
  clear(): void {
    this.registrations.clear();
  }

  private mergeConfigs(defaultConfig: QuickUIConfig, userConfig: QuickUIConfig): QuickUIConfig {
    return {
      animation: { ...defaultConfig.animation, ...userConfig.animation },
      behavior: { ...defaultConfig.behavior, ...userConfig.behavior },
      positioning: { ...defaultConfig.positioning, ...userConfig.positioning },
      type: userConfig.type || defaultConfig.type,
      zIndex: userConfig.zIndex || defaultConfig.zIndex,
    };
  }

  private convertToUIConfig(config: QuickUIConfig): any {
    return {
      type: config.type || 'card',
      animation: {
        entrance: config.animation?.entrance || 'fade-in',
        exit: config.animation?.exit || 'fade-in',
        duration: config.animation?.duration || 300,
        easing: config.animation?.easing || 'ease-out',
        delay: config.animation?.delay || 0,
      },
      behavior: {
        autoDismiss: config.behavior?.autoDismiss || false,
        dismissDelay: config.behavior?.dismissDelay || 3000,
        dismissOnClick: config.behavior?.dismissOnClick || false,
        dismissOnEscape: config.behavior?.dismissOnEscape || false,
        allowMultiple: config.behavior?.allowMultiple || false,
        priority: config.behavior?.priority || 0,
      },
      positioning: {
        position: config.positioning?.position || 'top-right',
        offset: config.positioning?.offset || {},
      },
      zIndex: config.zIndex,
    };
  }
}

// Convenience functions for easy registration
export const registerFunction = (
  functionName: string,
  component: React.ComponentType<any>,
  config?: QuickUIConfig
) => {
  AgentUIRegistry.getInstance().registerFunction(functionName, component, config);
};

export const registerAgent = (
  agentName: string,
  component: React.ComponentType<any>,
  config?: QuickUIConfig
) => {
  AgentUIRegistry.getInstance().registerAgent(agentName, component, config);
};

export const registerAgentFunction = (
  agentName: string,
  functionName: string,
  component: React.ComponentType<any>,
  config?: QuickUIConfig
) => {
  AgentUIRegistry.getInstance().registerAgentFunction(agentName, functionName, component, config);
};

export const registerEvent = (
  eventType: string,
  component: React.ComponentType<any>,
  config?: QuickUIConfig
) => {
  AgentUIRegistry.getInstance().registerEvent(eventType, component, config);
};
