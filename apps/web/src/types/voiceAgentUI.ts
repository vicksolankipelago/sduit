import { Screen, Agent } from './journey';

export interface UIComponentConfig {
  id: string;
  type: UIComponentType;
  component: React.ComponentType<any>;
  props: any;
  animation: AnimationConfig;
  behavior: BehaviorConfig;
  positioning: PositioningConfig;
  zIndex?: number;
  createdAt: number;
}

export interface AnimationConfig {
  entrance: AnimationType;
  exit: AnimationType;
  duration: number; // in milliseconds
  easing?: string;
  delay?: number;
}

export interface BehaviorConfig {
  autoDismiss?: boolean;
  dismissDelay?: number; // in milliseconds
  dismissOnClick?: boolean;
  dismissOnEscape?: boolean;
  allowMultiple?: boolean;
  priority?: number; // higher priority shows on top
}

export interface PositioningConfig {
  position: PositionType;
  offset?: { x?: number; y?: number };
  alignment?: AlignmentType;
}

export type UIComponentType = 
  | 'card' 
  | 'modal' 
  | 'overlay' 
  | 'toast' 
  | 'sidebar' 
  | 'bottom-sheet' 
  | 'floating' 
  | 'inline'
  | 'custom';

export type AnimationType = 
  | 'slide-in-right' 
  | 'slide-in-left' 
  | 'slide-in-top' 
  | 'slide-in-bottom'
  | 'fade-in' 
  | 'scale-in' 
  | 'flip-in' 
  | 'bounce-in'
  | 'custom';

export type PositionType = 
  | 'top-right' 
  | 'top-left' 
  | 'top-center'
  | 'bottom-right' 
  | 'bottom-left' 
  | 'bottom-center'
  | 'center' 
  | 'center-left' 
  | 'center-right'
  | 'custom';

export type AlignmentType = 'start' | 'center' | 'end';

// Registry for UI components
export interface UIRegistryEntry {
  agentName?: string;
  functionName?: string;
  eventType?: string;
  component: React.ComponentType<any>;
  config: Omit<UIComponentConfig, 'id' | 'component' | 'props' | 'createdAt'>;
}

export interface AgentUIContextValue {
  activeComponents: UIComponentConfig[];
  registeredComponents: Map<string, UIRegistryEntry>;
  
  // Registry methods
  registerUIComponent: (key: string, entry: UIRegistryEntry) => void;
  unregisterUIComponent: (key: string) => void;
  
  // Display methods
  showUI: (key: string, props?: any, overrides?: Partial<UIComponentConfig>) => string | null;
  hideUI: (id: string) => void;
  hideAllUI: () => void;
  
  // Event-driven methods
  triggerAgentUI: (agentName: string, data?: any) => void;
  triggerFunctionUI: (functionName: string, parameters?: any, agentName?: string) => void;
  triggerEventUI: (eventType: string, data?: any) => void;
  
  // Screen rendering (SDUI)
  screenRenderingMode?: boolean;
  currentAgentScreens?: Screen[];
  currentScreenId?: string | null;
  enableScreenRendering?: (screens: Screen[], initialScreenId?: string) => void;
  disableScreenRendering?: () => void;
  navigateToScreen?: (screenId: string) => void;
  moduleState?: Record<string, any>;
  updateModuleState?: (updates: Record<string, any>) => void;
  
  // Agent management for non-voice mode
  allAgents?: Agent[];
  currentAgentId?: string | null;
  setAgents?: (agents: Agent[]) => void;
  switchToAgent?: (agentId: string) => void;
  
  // Flow context for cross-journey key-value storage
  flowContext?: Record<string, any>;
  updateFlowContext?: (updates: Record<string, any>) => void;
  clearFlowContext?: () => void;
  mergeModuleStateToFlowContext?: () => void;
}
