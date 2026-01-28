/**
 * Journey Types
 *
 * Type definitions for the Agent Journey Builder system.
 * Journeys define multi-agent conversation flows with configurable prompts,
 * tools, and handoff logic.
 *
 * Includes Server-Driven UI (SDUI) support matching iOS structure.
 */

import { Variable } from './variables';

/**
 * Tool Parameter Schema
 * JSON Schema for tool parameters
 */
export interface ToolParameterSchema {
  type: 'object' | 'string' | 'number' | 'boolean' | 'array';
  properties?: Record<string, any>;
  required?: string[];
  enum?: string[];
  description?: string;
  items?: any;
  minimum?: number;
  maximum?: number;
  additionalProperties?: boolean;
}

// ============================================================================
// SDUI TYPE DEFINITIONS (Matching iOS Structure)
// ============================================================================

/**
 * Any Codable - For JSON values that can be any type
 */
export type AnyCodable = string | number | boolean | null | AnyCodable[] | { [key: string]: AnyCodable };

/**
 * Element Type - All supported element types
 */
export type ElementType =
  | 'largeQuestion'
  | 'textBlock'
  | 'button'
  | 'image'
  | 'imageCard'
  | 'textCard'
  | 'checklistCard'
  | 'toggleCard'
  | 'animatedImage'
  | 'spacer'
  | 'loadingView'
  | 'careCall'
  | 'animatedComponents'
  | 'quoteCard'
  | 'imageCheckboxButton'
  | 'checkboxButton'
  | 'circularStepper'
  | 'miniWidget'
  | 'weekCheckinSummary'
  | 'agentMessageCard'
  | 'openQuestion'
  | 'orb';

/**
 * Event Type - All supported event types
 */
export type EventType =
  | 'onStart'
  | 'onLoad'
  | 'onSubmit'
  | 'onClose'
  | 'onAppear'
  | 'onDisappear'
  | 'onSelected'
  | 'onToggle'
  | 'onToggleOn'
  | 'onToggleOff'
  | 'onAnimationComplete'
  | 'custom';

/**
 * State Scope - Where state updates are stored
 */
export type StateScope = 'screen' | 'module';

/**
 * Section Position - Where sections appear on screen
 */
export type SectionPosition = 'fixed-top' | 'body' | 'fixed-bottom';

/**
 * Section Layout - How elements are arranged
 */
export type SectionLayout = 'stack' | 'grid';

/**
 * Section Direction - Stack direction
 */
export type SectionDirection = 'vertical' | 'horizontal';

/**
 * Event Conditions - JSON Logic rules for conditional behavior
 */
export interface EventConditions {
  rules: Record<string, AnyCodable>;
  state: Record<string, AnyCodable>;
}

/**
 * State Update Action
 */
export interface StateUpdateAction {
  type: 'stateUpdate';
  scope?: StateScope;
  updates: Record<string, AnyCodable>;
  conditions?: EventConditions[];
}

/**
 * Navigation Action
 */
export interface NavigationAction {
  type: 'navigation';
  deeplink: string;
  conditions?: EventConditions[];
}

/**
 * Custom Action
 */
export interface CustomAction {
  type: 'custom';
  name: string;
  parameters?: Record<string, AnyCodable>;
  conditions?: EventConditions[];
}

/**
 * Response Mapping - Maps service response to state
 */
export interface ResponseMapping {
  stateKey: string;
  scope?: StateScope;
  transformation?: string;
}

/**
 * Service Call Action
 */
export interface ServiceCallAction {
  type: 'serviceCall';
  serviceName: string;
  functionName: string;
  parameters?: Record<string, AnyCodable>;
  responseMapping?: ResponseMapping;
  onSuccess?: EventAction[];
  onError?: EventAction[];
  conditions?: EventConditions[];
}

/**
 * Close Module Action
 */
export interface CloseModuleAction {
  type: 'closeModule';
  flowCompleted?: boolean;
  parameters?: Record<string, AnyCodable>;
  conditions?: EventConditions[];
}

/**
 * Tool Call Action
 * Used for non-voice mode to trigger tools like navigate_to_agent, store_answer, complete_quiz
 */
export interface ToolCallAction {
  type: 'toolCall';
  tool: string;
  params?: Record<string, AnyCodable>;
  conditions?: EventConditions[];
}

/**
 * Event Action - Union of all action types
 */
export type EventAction =
  | StateUpdateAction
  | NavigationAction
  | CustomAction
  | ServiceCallAction
  | CloseModuleAction
  | ToolCallAction;

/**
 * Screen Event - Events that can be triggered
 */
export interface ScreenEvent {
  id: string;
  type: EventType;
  conditions?: EventConditions[];
  action: EventAction[];
  analyticsName?: string;
}

/**
 * Element Config - Base configuration for all elements
 * Note: Uses 'state' to match iOS SDUI implementation
 */
export interface ElementConfig {
  type: ElementType;
  state: Record<string, AnyCodable>;
  style?: Record<string, AnyCodable>;
  events?: ScreenEvent[];
  conditions?: EventConditions[];
  analyticsProperties?: Record<string, AnyCodable>;
}

/**
 * Section - Container for elements
 */
export interface Section {
  id: string;
  title?: string;
  position: SectionPosition;
  layout?: SectionLayout;
  direction?: SectionDirection;
  scrollable?: boolean;
  elements: ElementConfig[];
}

/**
 * Screen - Complete screen definition
 */
export interface Screen {
  id: string;
  title: string;
  hidesBackButton?: boolean;
  state?: Record<string, AnyCodable>;
  analyticsProperties?: Record<string, AnyCodable>;
  sections: Section[];
  events?: ScreenEvent[];
}

/**
 * Module Config - Container for multiple screens
 */
export interface ModuleConfig {
  id: string;
  state?: Record<string, AnyCodable>;
  conditions?: EventConditions[];
  screens: Screen[];
}

// ============================================================================
// ELEMENT-SPECIFIC TYPE DEFINITIONS
// Note: Type names use 'Data' suffix to match iOS SDUI implementation
// ============================================================================

/**
 * Button Element
 */
export interface ButtonData {
  id: string;
  title: string;
  isDisabled?: boolean;
}

export interface ButtonElementStyle {
  style: 'primary' | 'secondary' | 'tertiary' | 'alert';
  size: 'large' | 'medium' | 'small';
}

/**
 * Text Block Element
 */
export interface TextBlockData {
  id: string;
  text: string;
}

export interface TextBlockElementStyle {
  style: 'heading1' | 'heading2' | 'heading3' | 'heading4' | 'body1' | 'body2' | 'caption';
  alignment?: 'leading' | 'center' | 'trailing';
  color?: string;
}

/**
 * Image Element
 */
export interface ImageData {
  id: string;
  imageName: string;
}

export interface ImageElementStyle {
  width?: number;
  height?: number;
  contentMode?: 'fit' | 'fill';
}

/**
 * Image Card Element
 */
export interface ImageCardData {
  id: string;
  title: string;
  description: string;
}

export interface ImageCardElementStyle {
  imageName: string;
  imageWidth?: number;
  imageHeight?: number;
  backgroundColor?: string;
  cornerRadius?: number;
}

/**
 * Checklist Card Element
 */
export interface ChecklistCardData {
  id: string;
  title: string;
  itemTitles: string[];
}

export interface ChecklistCardElementStyle {
  backgroundColor?: string;
  cornerRadius?: number;
}

/**
 * Toggle Card Element
 */
export interface ToggleCardData {
  id: string;
  title: string;
  description?: string;
  label?: string;
  isToggled: boolean;
}

export interface ToggleCardElementStyle {
  icon?: string;
  backgroundColor?: string;
  borderColor?: string;
  cornerRadius?: number;
}

/**
 * Care Call Element
 */
export interface CareCallData {
  id: string;
  appointmentId?: number;
  reason: string;
  pelatokens?: number;
  time: string;
  participant: string;
  duration: number;
  callType: string;
  ctaTitle: string;
  canEdit?: boolean;
  canBeJoined?: boolean;
  alertText?: string;
  isAlertInfo?: boolean;
  frequency?: string | null;
  callActionEventId?: string;
  callDetailsEventId?: string;
}

export interface CareCallElementStyle {
  backgroundColor?: string;
  borderColor?: string;
  cornerRadius?: number;
}

/**
 * Quote Card Element
 */
export interface QuoteCardData {
  id: string;
  message: string;
  jobTitle?: string;
}

export interface QuoteCardElementStyle {
  imageName?: string | null;
}

/**
 * Large Question Option Pill - For showing reward points or badges
 */
export interface LargeQuestionOptionPill {
  text: string;
  iconName?: string; // e.g., 'coin', 'star', 'check'
  backgroundColor?: string; // CSS color value
}

/**
 * Large Question Element
 */
export interface LargeQuestionOption {
  id: string;
  title: string;
  description?: string;
  imageName?: string;
  pill?: LargeQuestionOptionPill;
}

export interface LargeQuestionData {
  id: string;
  title: string;
  options: LargeQuestionOption[];
  selectedOptionId?: string;
}

/**
 * Checkbox Button Element
 */
export interface CheckboxButtonData {
  id: string;
  title: string;
  option: string;
  isSelected?: boolean;
}

export interface CheckboxButtonElementStyle {
  height?: number;
}

/**
 * Image Checkbox Button Element
 */
export interface ImageCheckboxButtonData {
  id: string;
  title: string;
  caption?: string;
  imageName: string;
  backgroundColor: string;
  option: string;
  isSelected?: boolean;
}

export interface ImageCheckboxButtonElementStyle {
  imageDimension?: 'icon' | 'small' | 'medium' | 'large';
  recolor?: boolean;
}

/**
 * Spacer Element
 */
export interface SpacerData {
  id: string;
}

export interface SpacerElementStyle {
  height?: number | null;
  width?: number | null;
  isFlexible?: boolean;
  direction?: 'vertical' | 'horizontal';
}

/**
 * Loading View Element
 */
export interface LoadingViewData {
  id: string;
}

/**
 * Animated Image Element (Lottie)
 */
export interface AnimatedImageData {
  id: string;
  lottieName: string;
}

export interface AnimatedImageElementStyle {
  width?: number;
  height?: number;
}

/**
 * Animated Components Element
 */
export interface AnimatedComponentsData {
  id: string;
  elements: ElementConfig[];
}

export interface AnimatedComponentsElementStyle {
  duration?: number;
  loop?: boolean;
  autoStart?: boolean;
  direction?: 'forward' | 'reverse';
  curve?: 'easeIn' | 'easeOut' | 'easeInOut' | 'linear';
  pauseOnTap?: boolean;
}

/**
 * Circular Stepper Element
 */
export interface CircularStepperData {
  id: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  label?: string;
}

/**
 * Text Card Element
 */
export interface TextCardData {
  id: string;
  title: string;
  content: string;
}

export interface TextCardElementStyle {
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  captionColor?: string;
  borderWidth?: number;
  cornerRadius?: number;
  showCheckmark?: boolean;
}

/**
 * Mini Widget Element
 * Matches iOS MiniWidgetData structure
 */
export interface MiniWidgetData {
  id: string;
  title?: string;
  content?: string;
  titleIconName?: string | null;
  contentIconName?: string | null;
  showActionArrow?: boolean;
  // Extended properties for complex widget types
  type?: string;
  currentState?: string;
  subtitle?: string;
  ctaText?: string;
  ctaTarget?: string;
  image?: string;
  postfixImage?: string;
  relevantData?: Record<string, AnyCodable>;
  backgroundColor?: string;
}

export interface MiniWidgetElementStyle {
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string | null;
  borderDashed?: boolean;
  showAlert?: boolean;
}

/**
 * Week Checkin Summary Element
 */
export interface WeekCheckinSummaryData {
  id: string;
  weekNumber: number;
  checkinCount: number;
  targetCount: number;
  stats?: Record<string, AnyCodable>;
}

/**
 * Agent Message Card Element
 */
export interface AgentMessageCardData {
  id: string;
  message: string;
  agentName?: string;
  avatar?: string;
  timestamp?: string;
}

export interface AgentMessageCardElementStyle {
  backgroundColor?: string;
  cornerRadius?: number;
}

/**
 * Open Question Element
 */
export interface OpenQuestionData {
  id: string;
  question: string;
}

export interface OpenQuestionElementStyle {
  // No style properties needed for now
}

/**
 * Orb Element (Voice Agent Visualization)
 * Uses ElevenLabs UI Orb component with Three.js
 */
export interface OrbData {
  id: string;
  /** Custom gradient colors [start, end] */
  colors?: [string, string];
  /** Agent state for auto volume mode */
  agentState?: 'thinking' | 'listening' | 'talking' | null;
  /** Volume control mode - 'auto' for state-based, 'manual' for explicit volume */
  volumeMode?: 'auto' | 'manual';
  /** Seed for consistent animation patterns */
  seed?: number;
}

export interface OrbElementStyle {
  /** Size variant */
  size?: 'small' | 'medium' | 'large';
  /** Custom width (CSS value) */
  width?: string;
  /** Custom height (CSS value) */
  height?: string;
  /** Container background color */
  backgroundColor?: string;
}

// ============================================================================
// TYPE ALIASES FOR BACKWARDS COMPATIBILITY
// ============================================================================
/** @deprecated Use ButtonData instead */
export type ButtonElementState = ButtonData;
/** @deprecated Use TextBlockData instead */
export type TextBlockElementState = TextBlockData;
/** @deprecated Use ImageData instead */
export type ImageElementState = ImageData;
/** @deprecated Use ImageCardData instead */
export type ImageCardElementState = ImageCardData;
/** @deprecated Use ChecklistCardData instead */
export type ChecklistCardElementState = ChecklistCardData;
/** @deprecated Use ToggleCardData instead */
export type ToggleCardElementState = ToggleCardData;
/** @deprecated Use CareCallData instead */
export type CareCallElementState = CareCallData;
/** @deprecated Use QuoteCardData instead */
export type QuoteCardElementState = QuoteCardData;
/** @deprecated Use LargeQuestionData instead */
export type LargeQuestionElementState = LargeQuestionData;
/** @deprecated Use CheckboxButtonData instead */
export type CheckboxButtonElementState = CheckboxButtonData;
/** @deprecated Use ImageCheckboxButtonData instead */
export type ImageCheckboxButtonElementState = ImageCheckboxButtonData;
/** @deprecated Use SpacerData instead */
export type SpacerElementState = SpacerData;
/** @deprecated Use LoadingViewData instead */
export type LoadingViewElementState = LoadingViewData;
/** @deprecated Use AnimatedImageData instead */
export type AnimatedImageElementState = AnimatedImageData;
/** @deprecated Use AnimatedComponentsData instead */
export type AnimatedComponentsElementState = AnimatedComponentsData;
/** @deprecated Use CircularStepperData instead */
export type CircularStepperElementState = CircularStepperData;
/** @deprecated Use TextCardData instead */
export type TextCardElementState = TextCardData;
/** @deprecated Use MiniWidgetData instead */
export type MiniWidgetElementState = MiniWidgetData;
/** @deprecated Use WeekCheckinSummaryData instead */
export type WeekCheckinSummaryElementState = WeekCheckinSummaryData;
/** @deprecated Use AgentMessageCardData instead */
export type AgentMessageCardElementState = AgentMessageCardData;
/** @deprecated Use OpenQuestionData instead */
export type OpenQuestionElementState = OpenQuestionData;

/**
 * Tool Definition
 * Defines a function/tool that an agent can call
 */
export interface Tool {
  id: string;
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  uiComponent?: string; // Reference to registered UI component key
  executeCode?: string; // JavaScript code for tool execution (as string)
  eventId?: string; // Optional event ID to link tools to screen events (for trigger_event tool)
}

/**
 * Agent Definition
 * Defines a single agent in the journey
 */
export interface Agent {
  id: string;
  name: string;
  voice: string; // Voice ID (e.g., 'sage', 'alloy', 'echo')
  prompt: string; // Agent-specific instructions (backward compatibility)
  tools: Tool[];
  handoffs: string[]; // Array of agent IDs this agent can hand off to
  handoffDescription?: string; // Description of this agent's role in the flow
  position?: { x: number; y: number }; // Position in visual flow editor
  
  // SDUI Support
  screens?: Screen[]; // Array of SDUI screens for this agent
  screenPrompts?: Record<string, string>; // Map of screenId → prompt section
}

/**
 * Journey Definition
 * Complete multi-agent conversation flow
 */
export interface Journey {
  id: string;
  name: string;
  description: string;
  systemPrompt: string; // Global prompt shared by all agents
  voice?: string; // Voice for all agents in journey (e.g., 'alloy', 'sage', 'echo')
  voiceEnabled?: boolean; // Whether voice interaction is enabled (default true)
  agents: Agent[];
  startingAgentId: string; // ID of the first agent in the flow
  createdAt: string;
  updatedAt: string;
  version: string; // For future migration compatibility
  customVariables?: Variable[]; // User-defined template variables for prompts
}

/**
 * Journey List Item
 * Lightweight representation for journey lists
 */
export interface JourneyListItem {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  updatedAt: string;
  status?: 'draft' | 'published';
  isPublished?: boolean;
  publishedAt?: string;
  voiceEnabled?: boolean;
}

/**
 * Published Journey
 * Represents a journey that has been published to production
 */
export interface PublishedJourney {
  id: string;
  journeyId: string;
  name: string;
  description: string;
  systemPrompt: string;
  voice: string;
  voiceEnabled?: boolean;
  agents: Agent[];
  startingAgentId: string;
  version: string;
  publishedAt: string;
}

/**
 * Journey Export Format
 * Format for exporting/importing journeys
 */
export interface JourneyExport {
  journey: Journey;
  exportedAt: string;
  exportVersion: string;
}

/**
 * Default Voice Options
 */
export const VOICE_OPTIONS = [
  { value: 'shimmer', label: 'Shimmer (Soft & Gentle)' }, // Default voice - first in list
  { value: 'sage', label: 'Sage (Warm & Wise)' },
  { value: 'alloy', label: 'Alloy (Neutral & Clear)' },
  { value: 'echo', label: 'Echo (Friendly & Upbeat)' },
  { value: 'ash', label: 'Ash (Calm & Steady)' },
  { value: 'ballad', label: 'Ballad (Warm & Conversational)' },
  { value: 'coral', label: 'Coral (Bright & Energetic)' },
  { value: 'verse', label: 'Verse (Smooth & Articulate)' },
] as const;

/**
 * Default System Prompt Template
 */
export const DEFAULT_SYSTEM_PROMPT = `## General Guidelines

### Voice and Tone
- Warm, steady, professional, calm
- Speak slowly, clearly, and with empathy
- Use {{memberName}} selectively — not every turn
- Avoid repeating yourself unless explicitly asked
- Plain, concise, member-friendly language
- Low, calm enthusiasm — encourage through clarity and care, not energy

### Acknowledgment Phrases (rotate; don't repeat consecutively)
- "Got it."
- "I hear you."
- "Appreciate that."
- "Thanks, noted."
- "Makes sense."
- "All set."

### Response Guidelines
- Keep acknowledgments brief (2-3 words max)
- Flow naturally from one question to the next
- Don't pause between questions unless the user is clearly still speaking
- If the user gives a very short answer, gently encourage more detail before moving on
- Use varied acknowledgments; rotate through the phrases above

### Personalization Guidelines
- **Lead with Context Recognition:** Acknowledge their previous responses early and throughout
- **Reference Specific Answers:** Connect current responses to their quiz answers. For example: "That aligns with what you shared about wanting to focus on moderation"
- **Honor Their Preferences:** Adapt tone to match their preferred support style ({{personalizedApproach}}) - be {{carePreferences}} as they requested
- **Acuity-Aware Responses:** Since they're {{acuityLevel}} acuity, be particularly empathetic and acknowledge the challenges they've shared
- **Connect Patterns:** Link current responses to previous answers - if they mention struggles, reference their previous sharing
- **Learning Interest Integration:** Naturally weave in their interest in {{learningTopics}} when relevant
- **Goal Continuity:** Keep their stated goal ({{primaryGoal}}) and motivation ({{motivation}}) central to the conversation

### Tool Call Rules
- You MUST issue a function call (not text) for each step as specified
- Do not describe the tool call in spoken content
- Tool calls are system actions only and never spoken aloud
- Make tool calls immediately after acknowledging the user's response
- Do not wait for tool results; continue the conversation
- Output order: tool call first, then speech

### Tool Call Format
- Always emit a function call item, not a textual description
- Name: \`trigger_event\`
- Arguments object must use the exact key: \`eventId\`
- Example: \`trigger_event with arguments {"eventId": "navigate_to_outcomes"}\`

### Response Structure
After the user finishes speaking and you acknowledge, your response MUST contain:
1. Function call item: \`trigger_event with {"eventId": "event_name"}\`
2. Spoken/audio message continuing the conversation

Do NOT merge the tool call into the spoken content. Always output the function call first so the client can update the UI immediately, then continue speaking.

### Fallback Responses
- **If hesitant about sharing:** "There's no pressure at all."
- **If they ask what Pelago is:** "Pelago is here to help you {{primaryGoal}} and explore your relationship with {{mainSubstance}} in a way that fits your goals and supports your {{motivation}}."
- **If vague responses:** "I want to make sure I understand you well. You mentioned in your quiz that you're interested in {{learningTopics}} - can you tell me a bit more about that?"
- **If off-topic:** "I want to make sure we're focusing on what matters most to you with Pelago, especially your goal to {{primaryGoal}} and your focus on {{motivation}}."
- **If they express doubt:** "I understand this can feel uncertain. You shared that you're curious about changing, and that's exactly where many people start. Your interest in {{learningTopics}} shows you're already thinking about growth."`;

/**
 * Default Tool Parameter Template
 */
export const DEFAULT_TOOL_PARAMETERS: ToolParameterSchema = {
  type: 'object',
  properties: {},
  required: [],
  additionalProperties: false,
};

/**
 * Journey Validation Error
 */
export interface JourneyValidationError {
  field: string;
  message: string;
  agentId?: string;
  toolId?: string;
}

/**
 * Validate a journey configuration
 */
export function validateJourney(journey: Journey): JourneyValidationError[] {
  const errors: JourneyValidationError[] = [];

  // Basic validation
  if (!journey.name?.trim()) {
    errors.push({ field: 'name', message: 'Journey name is required' });
  }

  if (!journey.systemPrompt?.trim()) {
    errors.push({ field: 'systemPrompt', message: 'System prompt is required' });
  }

  if (!journey.agents || journey.agents.length === 0) {
    errors.push({ field: 'agents', message: 'At least one agent is required' });
  }

  if (!journey.startingAgentId) {
    errors.push({ field: 'startingAgentId', message: 'Starting agent must be selected' });
  }

  // Validate agents
  journey.agents?.forEach((agent, index) => {
    if (!agent.name?.trim()) {
      errors.push({ 
        field: `agents[${index}].name`, 
        message: 'Agent name is required',
        agentId: agent.id 
      });
    }

    if (!agent.prompt?.trim()) {
      errors.push({ 
        field: `agents[${index}].prompt`, 
        message: 'Agent prompt is required',
        agentId: agent.id 
      });
    }

    // Validate handoff targets exist
    agent.handoffs?.forEach(targetId => {
      if (!journey.agents.find(a => a.id === targetId)) {
        errors.push({ 
          field: `agents[${index}].handoffs`, 
          message: `Handoff target "${targetId}" does not exist`,
          agentId: agent.id 
        });
      }
    });

    // Validate tools
    agent.tools?.forEach((tool, toolIndex) => {
      if (!tool.name?.trim()) {
        errors.push({ 
          field: `agents[${index}].tools[${toolIndex}].name`, 
          message: 'Tool name is required',
          agentId: agent.id,
          toolId: tool.id 
        });
      }
    });
  });

  // Check for circular dependencies in handoffs
  const detectCircular = (agentId: string, visited: Set<string> = new Set()): boolean => {
    if (visited.has(agentId)) return true;
    visited.add(agentId);
    
    const agent = journey.agents.find(a => a.id === agentId);
    if (!agent) return false;
    
    return agent.handoffs.some(targetId => detectCircular(targetId, new Set(visited)));
  };

  if (journey.startingAgentId && detectCircular(journey.startingAgentId)) {
    errors.push({ field: 'handoffs', message: 'Circular handoff dependency detected' });
  }

  return errors;
}

