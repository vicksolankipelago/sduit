const SECTION_POSITIONS = new Set(["fixed-top", "body", "fixed-bottom"]);
const PLACEHOLDER_NAV_TARGETS = new Set(["next-screen", "prev-screen"]);

export interface JourneyDraftValidationIssue {
  code: string;
  path: string;
  message: string;
}

export interface JourneyDraftValidationResult {
  errors: JourneyDraftValidationIssue[];
  warnings: JourneyDraftValidationIssue[];
  isValid: boolean;
}

type ValidationLevel = "error" | "warning";
type IssueCollector = JourneyDraftValidationIssue[];

function addIssue(
  collection: IssueCollector,
  code: string,
  path: string,
  message: string
) {
  collection.push({ code, path, message });
}

function add(
  level: ValidationLevel,
  errors: IssueCollector,
  warnings: IssueCollector,
  code: string,
  path: string,
  message: string
) {
  const target = level === "error" ? errors : warnings;
  addIssue(target, code, path, message);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseNavigationTarget(deeplink: string): {
  raw: string;
  target: string;
  isUrl: boolean;
} {
  const raw = asString(deeplink).trim();
  if (!raw) return { raw: "", target: "", isUrl: false };

  if (!raw.includes("://")) {
    return { raw, target: raw, isUrl: false };
  }

  try {
    const parsed = new URL(raw);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      raw,
      target: parts[parts.length - 1] || "",
      isUrl: true,
    };
  } catch {
    return { raw, target: raw, isUrl: false };
  }
}

function collectPromptEventIds(promptText: string): Set<string> {
  const ids = new Set<string>();
  const text = asString(promptText);

  const patterns = [
    /"eventId"\s*:\s*"([^"]+)"/g,
    /'eventId'\s*:\s*'([^']+)'/g,
    /eventId\s*[:=]\s*["']([^"']+)["']/g,
  ];

  patterns.forEach((pattern) => {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const id = asString(match[1]).trim();
      if (id) ids.add(id);
    }
  });

  return ids;
}

function validateEvent(
  event: unknown,
  eventPath: string,
  screenIds: Set<string>,
  eventIdCounts: Map<string, number>,
  errors: IssueCollector,
  warnings: IssueCollector
) {
  const safeEvent = isObject(event) ? event : {};
  const eventId = asString(safeEvent.id).trim();
  if (!eventId) {
    add(
      "error",
      errors,
      warnings,
      "EVENT_ID_MISSING",
      eventPath,
      "Event is missing id"
    );
  } else {
    const count = (eventIdCounts.get(eventId) || 0) + 1;
    eventIdCounts.set(eventId, count);
    if (count > 1) {
      add(
        "error",
        errors,
        warnings,
        "EVENT_ID_DUPLICATE",
        eventPath,
        `Duplicate event id "${eventId}" found on the same screen`
      );
    }
  }

  const actions = asArray(safeEvent.action);
  if (actions.length === 0) {
    add(
      "warning",
      errors,
      warnings,
      "EVENT_ACTION_EMPTY",
      eventPath,
      "Event has no actions"
    );
    return;
  }

  actions.forEach((action, actionIndex) => {
    const actionPath = `${eventPath}.action[${actionIndex}]`;
    const safeAction = isObject(action) ? action : {};
    const actionType = asString(safeAction.type).trim();

    if (!actionType) {
      add(
        "error",
        errors,
        warnings,
        "ACTION_TYPE_MISSING",
        actionPath,
        "Action is missing type"
      );
      return;
    }

    if (actionType === "navigation") {
      const deeplink = asString(safeAction.deeplink).trim();
      if (!deeplink) {
        add(
          "error",
          errors,
          warnings,
          "NAVIGATION_DEEPLINK_MISSING",
          actionPath,
          "Navigation action is missing deeplink"
        );
        return;
      }

      const parsed = parseNavigationTarget(deeplink);
      if (PLACEHOLDER_NAV_TARGETS.has(parsed.target)) {
        return;
      }

      if (screenIds.has(parsed.target)) {
        return;
      }

      if (parsed.isUrl) {
        add(
          "warning",
          errors,
          warnings,
          "NAVIGATION_EXTERNAL_TARGET",
          actionPath,
          `URL deeplink target "${parsed.target}" is not a screen id (verify this is intentional)`
        );
      } else {
        add(
          "error",
          errors,
          warnings,
          "NAVIGATION_TARGET_UNKNOWN",
          actionPath,
          `Deeplink "${deeplink}" does not resolve to an existing screen id`
        );
      }
    }

    if (actionType === "toolCall") {
      const toolName = asString(safeAction.tool).trim();
      if (!toolName) {
        add(
          "error",
          errors,
          warnings,
          "TOOLCALL_NAME_MISSING",
          actionPath,
          "toolCall action is missing tool name"
        );
      }
    }
  });
}

function validateScreen(
  screen: unknown,
  agentPath: string,
  screenIndex: number,
  screenIds: Set<string>,
  errors: IssueCollector,
  warnings: IssueCollector
): Set<string> {
  const safeScreen = isObject(screen) ? screen : {};
  const screenPath = `${agentPath}.screens[${screenIndex}]`;
  const screenId = asString(safeScreen.id).trim();

  if (!screenId) {
    add(
      "error",
      errors,
      warnings,
      "SCREEN_ID_MISSING",
      screenPath,
      "Screen is missing id"
    );
  }

  if (!asString(safeScreen.title).trim()) {
    add(
      "warning",
      errors,
      warnings,
      "SCREEN_TITLE_EMPTY",
      screenPath,
      "Screen title is empty"
    );
  }

  const eventIdCounts = new Map<string, number>();
  const sectionIds = new Set<string>();
  const sections = asArray(safeScreen.sections);

  if (sections.length === 0) {
    add(
      "warning",
      errors,
      warnings,
      "SCREEN_SECTIONS_EMPTY",
      screenPath,
      "Screen has no sections"
    );
  }

  sections.forEach((section, sectionIndex) => {
    const safeSection = isObject(section) ? section : {};
    const sectionPath = `${screenPath}.sections[${sectionIndex}]`;
    const sectionId = asString(safeSection.id).trim();
    const position = asString(safeSection.position).trim();

    if (!sectionId) {
      add(
        "error",
        errors,
        warnings,
        "SECTION_ID_MISSING",
        sectionPath,
        "Section is missing id"
      );
    } else if (sectionIds.has(sectionId)) {
      add(
        "error",
        errors,
        warnings,
        "SECTION_ID_DUPLICATE",
        sectionPath,
        `Duplicate section id "${sectionId}" found on screen`
      );
    } else {
      sectionIds.add(sectionId);
    }

    if (!SECTION_POSITIONS.has(position)) {
      add(
        "error",
        errors,
        warnings,
        "SECTION_POSITION_INVALID",
        sectionPath,
        `Invalid section position "${position}"; expected fixed-top, body, or fixed-bottom`
      );
    }

    const elements = asArray(safeSection.elements);
    if (elements.length === 0) {
      add(
        "warning",
        errors,
        warnings,
        "SECTION_ELEMENTS_EMPTY",
        sectionPath,
        "Section has no elements"
      );
    }

    elements.forEach((element, elementIndex) => {
      const safeElement = isObject(element) ? element : {};
      const elementPath = `${sectionPath}.elements[${elementIndex}]`;
      const elementType = asString(safeElement.type).trim();

      if (!elementType) {
        add(
          "error",
          errors,
          warnings,
          "ELEMENT_TYPE_MISSING",
          elementPath,
          "Element is missing type"
        );
      }

      if (!isObject(safeElement.state)) {
        add(
          "error",
          errors,
          warnings,
          "ELEMENT_STATE_MISSING",
          elementPath,
          "Element is missing state object"
        );
      } else if (!asString(safeElement.state.id).trim()) {
        add(
          "warning",
          errors,
          warnings,
          "ELEMENT_STATE_ID_EMPTY",
          elementPath,
          "Element state.id is empty"
        );
      }

      asArray(safeElement.events).forEach((event, eventIndex) => {
        validateEvent(
          event,
          `${elementPath}.events[${eventIndex}]`,
          screenIds,
          eventIdCounts,
          errors,
          warnings
        );
      });
    });
  });

  asArray(safeScreen.events).forEach((event, eventIndex) => {
    validateEvent(
      event,
      `${screenPath}.events[${eventIndex}]`,
      screenIds,
      eventIdCounts,
      errors,
      warnings
    );
  });

  return new Set(eventIdCounts.keys());
}

export function validateJourneyDraft(draft: unknown): JourneyDraftValidationResult {
  const errors: JourneyDraftValidationIssue[] = [];
  const warnings: JourneyDraftValidationIssue[] = [];

  if (!isObject(draft)) {
    add(
      "error",
      errors,
      warnings,
      "JOURNEY_PAYLOAD_INVALID",
      "journey",
      "Journey draft payload must be an object"
    );
    return { errors, warnings, isValid: false };
  }

  if (!asString(draft.id).trim()) {
    add(
      "error",
      errors,
      warnings,
      "JOURNEY_ID_MISSING",
      "journey.id",
      "Journey id is required"
    );
  }

  if (!asString(draft.name).trim()) {
    add(
      "warning",
      errors,
      warnings,
      "JOURNEY_NAME_EMPTY",
      "journey.name",
      "Journey name is empty"
    );
  }

  if (!asString(draft.systemPrompt).trim()) {
    add(
      "warning",
      errors,
      warnings,
      "SYSTEM_PROMPT_EMPTY",
      "journey.systemPrompt",
      "System prompt is empty"
    );
  }

  const agents = asArray(draft.agents);
  if (agents.length === 0) {
    add(
      "error",
      errors,
      warnings,
      "AGENTS_EMPTY",
      "journey.agents",
      "Journey must include at least one agent"
    );
    return { errors, warnings, isValid: false };
  }

  const agentIds = new Set<string>();
  agents.forEach((agent, agentIndex) => {
    const safeAgent = isObject(agent) ? agent : {};
    const agentId = asString(safeAgent.id).trim();
    const agentPath = `journey.agents[${agentIndex}]`;

    if (!agentId) {
      add(
        "error",
        errors,
        warnings,
        "AGENT_ID_MISSING",
        `${agentPath}.id`,
        "Agent id is required"
      );
    } else if (agentIds.has(agentId)) {
      add(
        "error",
        errors,
        warnings,
        "AGENT_ID_DUPLICATE",
        `${agentPath}.id`,
        `Duplicate agent id "${agentId}" found`
      );
    } else {
      agentIds.add(agentId);
    }
  });

  const startingAgentId = asString(draft.startingAgentId).trim();
  if (!startingAgentId) {
    add(
      "error",
      errors,
      warnings,
      "STARTING_AGENT_MISSING",
      "journey.startingAgentId",
      "startingAgentId is required"
    );
  } else if (!agentIds.has(startingAgentId)) {
    add(
      "error",
      errors,
      warnings,
      "STARTING_AGENT_UNKNOWN",
      "journey.startingAgentId",
      `startingAgentId "${startingAgentId}" does not exist in agents`
    );
  }

  agents.forEach((agent, agentIndex) => {
    const safeAgent = isObject(agent) ? agent : {};
    const agentPath = `journey.agents[${agentIndex}]`;
    const agentId = asString(safeAgent.id).trim();

    if (!asString(safeAgent.name).trim()) {
      add(
        "error",
        errors,
        warnings,
        "AGENT_NAME_MISSING",
        `${agentPath}.name`,
        "Agent name is required"
      );
    }

    if (!asString(safeAgent.prompt).trim()) {
      add(
        "error",
        errors,
        warnings,
        "AGENT_PROMPT_MISSING",
        `${agentPath}.prompt`,
        "Agent prompt is required"
      );
    }

    asArray(safeAgent.handoffs).forEach((handoffId, handoffIndex) => {
      const target = asString(handoffId).trim();
      const handoffPath = `${agentPath}.handoffs[${handoffIndex}]`;
      if (!target) {
        add(
          "error",
          errors,
          warnings,
          "HANDOFF_ID_EMPTY",
          handoffPath,
          "Handoff target cannot be empty"
        );
      } else if (!agentIds.has(target)) {
        add(
          "error",
          errors,
          warnings,
          "HANDOFF_TARGET_UNKNOWN",
          handoffPath,
          `Handoff target "${target}" does not exist`
        );
      }
    });

    const screens = asArray(safeAgent.screens);
    const screenIds = new Set<string>();
    screens.forEach((screen, screenIndex) => {
      const safeScreen = isObject(screen) ? screen : {};
      const screenId = asString(safeScreen.id).trim();
      const screenPath = `${agentPath}.screens[${screenIndex}].id`;
      if (!screenId) return;
      if (screenIds.has(screenId)) {
        add(
          "error",
          errors,
          warnings,
          "SCREEN_ID_DUPLICATE",
          screenPath,
          `Duplicate screen id "${screenId}" found`
        );
      } else {
        screenIds.add(screenId);
      }
    });

    const screenPromptsRaw = safeAgent.screenPrompts;
    const hasScreenPrompts = isObject(screenPromptsRaw);
    if (screenPromptsRaw !== undefined && !hasScreenPrompts) {
      add(
        "error",
        errors,
        warnings,
        "SCREEN_PROMPTS_INVALID",
        `${agentPath}.screenPrompts`,
        "screenPrompts must be an object map"
      );
    }

    const screenPrompts = hasScreenPrompts
      ? (screenPromptsRaw as Record<string, unknown>)
      : {};

    if (screens.length > 0 && !hasScreenPrompts) {
      add(
        "warning",
        errors,
        warnings,
        "SCREEN_PROMPTS_MISSING",
        `${agentPath}.screenPrompts`,
        "Agent has screens but no screenPrompts map"
      );
    }

    Object.keys(screenPrompts).forEach((screenId) => {
      if (!screenIds.has(screenId)) {
        add(
          "error",
          errors,
          warnings,
          "SCREEN_PROMPT_ORPHANED",
          `${agentPath}.screenPrompts.${screenId}`,
          `screenPrompts key "${screenId}" has no matching screen`
        );
      }
    });

    screens.forEach((screen, screenIndex) => {
      const safeScreen = isObject(screen) ? screen : {};
      const screenId = asString(safeScreen.id).trim();
      const availableEventIds = validateScreen(
        screen,
        agentPath,
        screenIndex,
        screenIds,
        errors,
        warnings
      );

      if (!screenId) return;
      const promptValue = screenPrompts[screenId];
      const promptText = asString(promptValue);
      const promptPath = `${agentPath}.screenPrompts.${screenId}`;

      if (!promptText.trim()) {
        add(
          "warning",
          errors,
          warnings,
          "SCREEN_PROMPT_EMPTY",
          promptPath,
          "Screen prompt is empty"
        );
        return;
      }

      const referencedEventIds = collectPromptEventIds(promptText);
      referencedEventIds.forEach((eventId) => {
        if (!availableEventIds.has(eventId)) {
          add(
            "warning",
            errors,
            warnings,
            "SCREEN_PROMPT_EVENT_UNKNOWN",
            promptPath,
            `Prompt references eventId "${eventId}" that is not defined on this screen`
          );
        }
      });
    });

    if (!agentId && screens.length > 0) {
      add(
        "warning",
        errors,
        warnings,
        "AGENT_WITHOUT_ID_HAS_SCREENS",
        `${agentPath}.screens`,
        "Agent has screens but missing id"
      );
    }
  });

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
  };
}
