/**
 * Module Normalization Utility
 *
 * Normalizes SDUI screens and modules to iOS-compatible format.
 * Ensures consistent handling of null values, empty arrays, and proper field names.
 */

// ============================================================================
// iOS-Compatible Type Definitions
// ============================================================================

export interface IOSModule {
  id: string;
  state: Record<string, unknown>;
  conditions: IOSEventConditions[];
  screens: IOSScreen[];
}

export interface IOSScreen {
  id: string;
  title: string | null;
  hidesBackButton?: boolean;
  analyticsProperties: Record<string, unknown> | null;
  state?: Record<string, unknown>;
  sections: IOSSection[];
  events: IOSScreenEvent[];
}

export interface IOSSection {
  id: string;
  title: string | null;
  position: string;
  layout: string;
  direction: string;
  scrollable: boolean;
  elements: IOSElement[];
}

export interface IOSElement {
  type: string;
  state: Record<string, unknown>;
  style?: Record<string, unknown>;
  events?: IOSScreenEvent[];
  conditions?: IOSEventConditions[];
  analyticsProperties?: Record<string, unknown>;
}

export interface IOSScreenEvent {
  id: string;
  type: string;
  conditions: IOSEventConditions[];
  action: Array<Record<string, unknown>>;
  analyticsName?: string;
  delay?: number;
}

export interface IOSEventConditions {
  rules?: Record<string, unknown>;
  state?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

// ============================================================================
// Input Types (from Journey storage)
// ============================================================================

interface RawScreen {
  id: string;
  title?: string | null;
  hidesBackButton?: boolean;
  analyticsProperties?: Record<string, unknown> | null;
  state?: Record<string, unknown>;
  sections: RawSection[];
  events?: RawScreenEvent[];
  screenPrompt?: string;
}

interface RawSection {
  id: string;
  title?: string | null;
  position: string;
  layout?: string;
  direction?: string;
  scrollable?: boolean;
  elements: RawElement[];
}

interface RawElement {
  type: string;
  state: Record<string, unknown>;
  style?: Record<string, unknown>;
  events?: RawScreenEvent[];
  conditions?: unknown[];
  analyticsProperties?: Record<string, unknown>;
}

interface RawScreenEvent {
  id: string;
  type: string;
  conditions?: unknown[];
  action: Array<Record<string, unknown>>;
  analyticsName?: string;
  delay?: number;
}

interface RawAgent {
  id: string;
  name: string;
  prompt?: string;
  screens?: RawScreen[];
  screenPrompts?: Record<string, string>;
  tools?: unknown[];
  handoffs?: string[];
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Optional URL prefix for navigation deeplinks.
 *
 * Most mobile clients in this project consume plain screen IDs in deeplink
 * actions (e.g., "about-you"). Prefixing to full URLs can break CTA navigation
 * if the client does not parse URL deeplinks.
 *
 * Set SDUI_PREFIX_DEEPLINKS=true only when a client explicitly requires full URLs.
 */
const DEEPLINK_BASE_URL = "https://links.pelagohealth.com/onboarding/";
const SHOULD_PREFIX_DEEPLINKS = process.env.SDUI_PREFIX_DEEPLINKS === "true";

// ============================================================================
// Normalization Functions
// ============================================================================

/**
 * Normalize a navigation deeplink to a full URL.
 * If the deeplink is already a full URL (starts with http/https), it is returned as-is.
 * Otherwise, the base URL prefix is prepended.
 */
function normalizeDeeplink(deeplink: string): string {
  if (!deeplink) return deeplink;
  if (deeplink.startsWith("http://") || deeplink.startsWith("https://")) {
    return deeplink;
  }
  if (!SHOULD_PREFIX_DEEPLINKS) {
    return deeplink;
  }
  return `${DEEPLINK_BASE_URL}${deeplink}`;
}

/**
 * Normalize action deeplinks in an array of event actions.
 * Finds navigation actions and prefixes their deeplinks with the base URL.
 */
function normalizeActions(actions: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  if (!actions || !Array.isArray(actions)) return actions;
  return actions.map((action) => {
    if (action.type === "navigation" && typeof action.deeplink === "string") {
      return { ...action, deeplink: normalizeDeeplink(action.deeplink as string) };
    }
    // Recursively normalize nested actions (onSuccess, onError in serviceCall)
    const normalized = { ...action };
    if (Array.isArray(normalized.onSuccess)) {
      normalized.onSuccess = normalizeActions(normalized.onSuccess as Array<Record<string, unknown>>);
    }
    if (Array.isArray(normalized.onError)) {
      normalized.onError = normalizeActions(normalized.onError as Array<Record<string, unknown>>);
    }
    return normalized;
  });
}

/**
 * Normalize event conditions to always be an array
 */
function normalizeConditions(conditions: unknown[] | undefined | null): IOSEventConditions[] {
  if (!conditions || !Array.isArray(conditions)) {
    return [];
  }
  return conditions.map((c) => {
    if (typeof c === "object" && c !== null) {
      return c as IOSEventConditions;
    }
    return {};
  });
}

/**
 * Normalize a screen event to iOS format
 */
function normalizeEvent(event: RawScreenEvent): IOSScreenEvent {
  return {
    id: event.id,
    type: event.type,
    conditions: normalizeConditions(event.conditions),
    action: normalizeActions(event.action || []),
    ...(event.analyticsName && { analyticsName: event.analyticsName }),
    ...(event.delay !== undefined && { delay: event.delay }),
  };
}

/**
 * Normalize an element to iOS format
 */
function normalizeElement(
  element: RawElement,
  context: { screenId: string; sectionId: string; elementIndex: number }
): IOSElement {
  const fallbackId = `${context.screenId}_${context.sectionId}_${element.type}_${context.elementIndex}`;
  const stateWithId: Record<string, unknown> = {
    ...(element.state || {}),
    id:
      typeof element.state?.id === "string" && element.state.id.length > 0
        ? element.state.id
        : fallbackId,
  };

  const normalized: IOSElement = {
    type: element.type,
    state: stateWithId,
  };

  if (element.style) {
    normalized.style = element.style;
  }

  if (element.events && element.events.length > 0) {
    normalized.events = element.events.map(normalizeEvent);
  }

  if (element.conditions && element.conditions.length > 0) {
    normalized.conditions = normalizeConditions(element.conditions);
  }

  if (element.analyticsProperties) {
    normalized.analyticsProperties = element.analyticsProperties;
  }

  return normalized;
}

/**
 * Normalize a section to iOS format
 */
function normalizeSection(section: RawSection, screenId: string): IOSSection {
  return {
    id: section.id,
    title: section.title ?? null,
    position: section.position,
    layout: section.layout || "stack",
    direction: section.direction || "vertical",
    scrollable: section.scrollable ?? true,
    elements: section.elements.map((element, elementIndex) =>
      normalizeElement(element, {
        screenId,
        sectionId: section.id,
        elementIndex,
      })
    ),
  };
}

/**
 * Normalize a screen to iOS format
 */
export function normalizeScreenForIOS(screen: RawScreen): IOSScreen {
  return {
    id: screen.id,
    title: screen.title || null,
    hidesBackButton: screen.hidesBackButton,
    analyticsProperties: screen.analyticsProperties ?? null,
    ...(screen.state && { state: screen.state }),
    sections: screen.sections.map((section) => normalizeSection(section, screen.id)),
    events: (screen.events || []).map(normalizeEvent),
  };
}

/**
 * Normalize an agent to iOS module format
 */
export function normalizeAgentToModule(agent: RawAgent): IOSModule {
  if (!agent.screens || agent.screens.length === 0) {
    return {
      id: agent.id,
      state: {},
      conditions: [],
      screens: [],
    };
  }

  return {
    id: agent.id,
    state: {},
    conditions: [],
    screens: agent.screens.map(normalizeScreenForIOS),
  };
}

/**
 * Extract screen prompts from agent
 */
export function extractScreenPrompts(agent: RawAgent): Record<string, string> {
  return agent.screenPrompts || {};
}

/**
 * Create full iOS module response with metadata
 */
export function createModuleResponse(
  agent: RawAgent,
  journeyMetadata: {
    journeyId: string;
    journeyName: string;
    version: string;
    publishedAt?: string;
  }
): {
  module: IOSModule;
  screenPrompts: Record<string, string>;
  metadata: typeof journeyMetadata;
} {
  return {
    module: normalizeAgentToModule(agent),
    screenPrompts: extractScreenPrompts(agent),
    metadata: journeyMetadata,
  };
}
