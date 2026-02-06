#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const SECTION_POSITIONS = new Set(["fixed-top", "body", "fixed-bottom"]);
const PLACEHOLDER_NAV_TARGETS = new Set(["next-screen", "prev-screen"]);

function usage() {
  console.log(
    "Usage: node skills/sduit-sdui-flow-assistant/scripts/validate_flow_bundle.mjs <journey-json-path> [--json] [--strict]"
  );
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value : "";
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content);
}

function normalizeJourneyPayload(data) {
  if (isObject(data) && isObject(data.journey)) {
    return data.journey;
  }
  return data;
}

function collectPromptEventIds(promptText) {
  const ids = new Set();
  const text = asString(promptText);
  const regexes = [
    /"eventId"\s*:\s*"([^"]+)"/g,
    /'eventId'\s*:\s*'([^']+)'/g,
    /eventId\s*[:=]\s*["']([^"']+)["']/g,
  ];

  for (const regex of regexes) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const id = asString(match[1]).trim();
      if (id) ids.add(id);
    }
  }

  return ids;
}

function parseNavigationTarget(deeplink) {
  const raw = asString(deeplink).trim();
  if (!raw) return { raw: "", target: "", isUrl: false };

  if (raw.includes("://")) {
    try {
      const url = new URL(raw);
      const pathParts = url.pathname.split("/").filter(Boolean);
      return {
        raw,
        target: pathParts[pathParts.length - 1] || "",
        isUrl: true,
      };
    } catch {
      return { raw, target: raw, isUrl: false };
    }
  }

  return { raw, target: raw, isUrl: false };
}

function collectEventIds(screen) {
  const ids = new Set();
  const add = (event) => {
    const eventId = asString(event?.id).trim();
    if (eventId) ids.add(eventId);
  };

  for (const event of asArray(screen?.events)) add(event);

  for (const section of asArray(screen?.sections)) {
    for (const element of asArray(section?.elements)) {
      for (const event of asArray(element?.events)) add(event);
    }
  }

  return ids;
}

function validateScreen(screen, screenIndex, screenIds, errors, warnings) {
  const screenPath = `screens[${screenIndex}]`;
  const screenId = asString(screen?.id).trim();
  if (!screenId) {
    errors.push(`${screenPath}: missing screen id`);
  }

  const sections = asArray(screen?.sections);
  if (sections.length === 0) {
    warnings.push(`${screenPath}: no sections`);
  }

  const sectionIds = new Set();
  const availableEventIds = collectEventIds(screen);

  sections.forEach((section, sectionIndex) => {
    const sectionPath = `${screenPath}.sections[${sectionIndex}]`;
    const sectionId = asString(section?.id).trim();

    if (!sectionId) {
      errors.push(`${sectionPath}: missing section id`);
    } else if (sectionIds.has(sectionId)) {
      errors.push(`${sectionPath}: duplicate section id "${sectionId}"`);
    } else {
      sectionIds.add(sectionId);
    }

    const position = asString(section?.position).trim();
    if (!SECTION_POSITIONS.has(position)) {
      errors.push(
        `${sectionPath}: invalid section position "${position}" (expected one of fixed-top, body, fixed-bottom)`
      );
    }

    const elements = asArray(section?.elements);
    if (elements.length === 0) {
      warnings.push(`${sectionPath}: no elements`);
    }

    elements.forEach((element, elementIndex) => {
      const elementPath = `${sectionPath}.elements[${elementIndex}]`;
      const elementType = asString(element?.type).trim();
      if (!elementType) {
        errors.push(`${elementPath}: missing element type`);
      }

      if (!isObject(element?.state)) {
        errors.push(`${elementPath}: missing element state object`);
      } else {
        const elementStateId = asString(element.state.id).trim();
        if (!elementStateId) {
          warnings.push(`${elementPath}: state.id is empty`);
        }
      }

      asArray(element?.events).forEach((event, eventIndex) => {
        validateEvent(
          event,
          `${elementPath}.events[${eventIndex}]`,
          screenIds,
          availableEventIds,
          errors,
          warnings
        );
      });
    });
  });

  asArray(screen?.events).forEach((event, eventIndex) => {
    validateEvent(
      event,
      `${screenPath}.events[${eventIndex}]`,
      screenIds,
      availableEventIds,
      errors,
      warnings
    );
  });

  return availableEventIds;
}

function validateEvent(event, eventPath, screenIds, availableEventIds, errors, warnings) {
  const eventId = asString(event?.id).trim();
  if (!eventId) {
    errors.push(`${eventPath}: missing event id`);
  }

  const actions = asArray(event?.action);
  if (actions.length === 0) {
    warnings.push(`${eventPath}: event has no actions`);
    return;
  }

  actions.forEach((action, actionIndex) => {
    const actionPath = `${eventPath}.action[${actionIndex}]`;
    const actionType = asString(action?.type).trim();
    if (!actionType) {
      errors.push(`${actionPath}: missing action type`);
      return;
    }

    if (actionType === "navigation") {
      const deeplink = asString(action?.deeplink).trim();
      if (!deeplink) {
        errors.push(`${actionPath}: navigation action missing deeplink`);
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
        warnings.push(
          `${actionPath}: URL deeplink target "${parsed.target}" not found in screen IDs (may be external, verify manually)`
        );
      } else {
        errors.push(
          `${actionPath}: deeplink "${deeplink}" does not resolve to an existing screen id`
        );
      }
    }

    if (actionType === "toolCall") {
      const toolName = asString(action?.tool).trim();
      if (!toolName) {
        errors.push(`${actionPath}: toolCall action missing tool name`);
      }
    }
  });
}

function validateJourneyBundle(journey) {
  const errors = [];
  const warnings = [];

  if (!isObject(journey)) {
    errors.push("journey payload is not an object");
    return { errors, warnings };
  }

  const journeyId = asString(journey.id).trim();
  if (!journeyId) errors.push("missing journey.id");
  if (!asString(journey.name).trim()) warnings.push("missing or empty journey.name");
  if (!asString(journey.systemPrompt).trim()) warnings.push("missing or empty journey.systemPrompt");

  const agents = asArray(journey.agents);
  if (agents.length === 0) {
    errors.push("journey.agents must be a non-empty array");
    return { errors, warnings };
  }

  const agentIds = new Set();
  const duplicateAgentIds = new Set();
  for (const agent of agents) {
    const agentId = asString(agent?.id).trim();
    if (!agentId) continue;
    if (agentIds.has(agentId)) duplicateAgentIds.add(agentId);
    agentIds.add(agentId);
  }

  for (const dup of duplicateAgentIds) {
    errors.push(`duplicate agent id "${dup}"`);
  }

  const startingAgentId = asString(journey.startingAgentId).trim();
  if (!startingAgentId) {
    errors.push("missing journey.startingAgentId");
  } else if (!agentIds.has(startingAgentId)) {
    errors.push(`startingAgentId "${startingAgentId}" does not exist in agents`);
  }

  agents.forEach((agent, agentIndex) => {
    const agentPath = `agents[${agentIndex}]`;
    const agentId = asString(agent?.id).trim();
    const agentName = asString(agent?.name).trim();
    const agentPrompt = asString(agent?.prompt).trim();

    if (!agentId) errors.push(`${agentPath}: missing agent id`);
    if (!agentName) errors.push(`${agentPath}: missing agent name`);
    if (!agentPrompt) warnings.push(`${agentPath}: missing or empty agent prompt`);

    const handoffs = asArray(agent?.handoffs);
    handoffs.forEach((handoffId, handoffIndex) => {
      const targetId = asString(handoffId).trim();
      if (!targetId) {
        errors.push(`${agentPath}.handoffs[${handoffIndex}]: empty handoff target`);
      } else if (!agentIds.has(targetId)) {
        errors.push(`${agentPath}.handoffs[${handoffIndex}]: unknown target "${targetId}"`);
      }
    });

    const screens = asArray(agent?.screens);
    const screenPrompts = isObject(agent?.screenPrompts) ? agent.screenPrompts : {};

    if (!isObject(screenPrompts) && agent?.screenPrompts !== undefined) {
      errors.push(`${agentPath}.screenPrompts must be an object`);
    }

    const screenIds = new Set();
    screens.forEach((screen, screenIndex) => {
      const screenId = asString(screen?.id).trim();
      if (screenId && screenIds.has(screenId)) {
        errors.push(`${agentPath}.screens[${screenIndex}]: duplicate screen id "${screenId}"`);
      }
      if (screenId) screenIds.add(screenId);
    });

    Object.keys(screenPrompts).forEach((screenId) => {
      if (!screenIds.has(screenId)) {
        errors.push(`${agentPath}.screenPrompts["${screenId}"] has no matching screen`);
      }
    });

    if (screens.length > 0) {
      if (!isObject(agent?.screenPrompts) || Object.keys(screenPrompts).length === 0) {
        warnings.push(`${agentPath}: screens exist but screenPrompts is empty`);
      }

      screens.forEach((screen, screenIndex) => {
        const availableEventIds = validateScreen(
          screen,
          screenIndex,
          screenIds,
          errors,
          warnings
        );

        const screenId = asString(screen?.id).trim();
        const prompt = asString(screenPrompts[screenId]);

        if (!prompt) {
          warnings.push(`${agentPath}.screens[${screenIndex}] (${screenId}): no screen prompt`);
          return;
        }

        const promptEventIds = collectPromptEventIds(prompt);
        promptEventIds.forEach((eventId) => {
          if (!availableEventIds.has(eventId)) {
            warnings.push(
              `${agentPath}.screenPrompts["${screenId}"]: references eventId "${eventId}" not present on that screen`
            );
          }
        });
      });
    }
  });

  return { errors, warnings };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const jsonOutput = args.includes("--json");
  const strictMode = args.includes("--strict");
  const fileArg = args.find((arg) => !arg.startsWith("--"));

  if (!fileArg) {
    usage();
    process.exit(1);
  }

  const journeyPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(journeyPath)) {
    console.error(`File not found: ${journeyPath}`);
    process.exit(1);
  }

  let journeyData;
  try {
    journeyData = normalizeJourneyPayload(readJsonFile(journeyPath));
  } catch (error) {
    console.error(`Failed to read JSON: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const result = validateJourneyBundle(journeyData);
  const status =
    result.errors.length > 0 || (strictMode && result.warnings.length > 0) ? "failed" : "passed";

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          file: journeyPath,
          status,
          strictMode,
          errors: result.errors,
          warnings: result.warnings,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Validation ${status.toUpperCase()}: ${journeyPath}`);
    console.log(`Errors: ${result.errors.length}`);
    result.errors.forEach((error) => console.log(`- ${error}`));
    console.log(`Warnings: ${result.warnings.length}`);
    result.warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  if (status === "failed") {
    process.exit(1);
  }
}

main();
