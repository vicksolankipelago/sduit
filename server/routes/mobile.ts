/**
 * Mobile API Routes
 *
 * Public endpoints for iOS/Android apps to:
 * - Get Azure WebRTC session credentials
 * - Fetch journey configurations with variable substitution
 * - List available production journeys
 *
 * These endpoints are intentionally public (no authentication) to allow
 * mobile apps to connect without requiring backend auth integration.
 */

import { Router, Request, Response } from "express";
import { publishedFlowStorage, PublishedFlowData } from "../services/publishedFlowStorage";
import { storage } from "../storage";
import { logger } from "../utils/logger";
import * as apiResponse from "../utils/response";
import { createModuleResponse, normalizeAgentToModule } from "../utils/moduleNormalize";

const router = Router();
const mobileLogger = logger.namespace("Mobile");

// ============================================================================
// Azure Session Endpoint
// ============================================================================

/**
 * GET /api/mobile/session
 *
 * Creates an ephemeral session key for Azure OpenAI WebRTC connection.
 * The mobile app uses this key to establish a direct WebRTC connection
 * to Azure OpenAI's realtime API.
 *
 * Response:
 * {
 *   ephemeralKey: string,      // Short-lived token for WebRTC auth
 *   webrtcUrl: string,         // Azure WebRTC endpoint URL
 *   deployment: string,        // Azure deployment name
 *   region: string,            // Azure region
 *   expiresAt: string          // Token expiration timestamp
 * }
 */
router.get("/session", async (_req: Request, res: Response) => {
  try {
    let endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "test-gpt-realtime";
    const apiVersion = process.env.OPENAI_API_VERSION || "2025-04-01-preview";

    if (endpoint && endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }

    if (!apiKey) {
      mobileLogger.error("AZURE_OPENAI_API_KEY environment variable is not set");
      return apiResponse.configError(
        res,
        "Azure OpenAI API key not configured",
        "Server configuration error"
      );
    }

    if (!endpoint) {
      mobileLogger.error("AZURE_OPENAI_ENDPOINT environment variable is not set");
      return apiResponse.configError(
        res,
        "Azure OpenAI endpoint not configured",
        "Server configuration error"
      );
    }

    mobileLogger.info("Creating ephemeral key for mobile WebRTC connection...");

    const sessionsUrl = `${endpoint}/openai/realtimeapi/sessions?api-version=${apiVersion}`;

    const response = await fetch(sessionsUrl, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: deploymentName,
        voice: "sage",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      mobileLogger.error("Failed to create session:", response.status, errorText);
      return apiResponse.error(
        res,
        "Failed to create Azure session",
        response.status,
        "SESSION_CREATE_FAILED",
        errorText
      );
    }

    const sessionData = await response.json();
    mobileLogger.info("Ephemeral key created for mobile:", sessionData.id);

    // Extract region from endpoint
    const regionMatch = endpoint.match(/-(swedencentral|eastus2)\.openai\.azure\.com/);
    const region = regionMatch ? regionMatch[1] : "swedencentral";

    // Return mobile-friendly response with ephemeral key
    return apiResponse.success(res, {
      ephemeralKey: sessionData.client_secret?.value || sessionData.key,
      webrtcUrl: `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`,
      deployment: deploymentName,
      region: region,
      sessionId: sessionData.id,
      expiresAt: sessionData.expires_at || new Date(Date.now() + 60000).toISOString(),
    });
  } catch (err: any) {
    mobileLogger.error("Error creating ephemeral key for mobile:", err.message);
    return apiResponse.serverError(res, "Failed to create session", err.message);
  }
});

// ============================================================================
// Journey Endpoints
// ============================================================================

/**
 * GET /api/mobile/journeys
 *
 * Lists all published journeys available for mobile apps.
 * Returns lightweight list without full journey content.
 *
 * Response:
 * {
 *   journeys: [
 *     { id, name, description, publishedAt }
 *   ]
 * }
 */
router.get("/journeys", async (_req: Request, res: Response) => {
  try {
    const flows = await publishedFlowStorage.listPublishedFlows();

    return apiResponse.success(res, {
      journeys: flows.map((flow) => ({
        id: flow.journeyId,
        name: flow.name,
        description: flow.description,
        publishedAt: flow.publishedAt,
      })),
    });
  } catch (error: any) {
    mobileLogger.error("Error listing journeys for mobile:", error.message);
    return apiResponse.serverError(res, "Failed to list journeys");
  }
});

/**
 * GET /api/mobile/journey/:journeyId
 *
 * Gets full journey configuration for a published journey.
 * This is the raw journey without variable substitution.
 *
 * Response: Full journey object with agents, screens, prompts, tools
 */
router.get("/journey/:journeyId", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;

    // First try to get from published flows (production)
    let journey = await publishedFlowStorage.getPublishedFlow(journeyId);

    // If not found in published, try to get from draft storage (for development/testing)
    if (!journey) {
      const draftJourney = await storage.getJourney(journeyId);
      if (draftJourney) {
        // Convert draft to published format for consistent response
        journey = {
          id: draftJourney.id,
          journeyId: draftJourney.id,
          name: draftJourney.name,
          description: draftJourney.description || "",
          systemPrompt: draftJourney.systemPrompt,
          voice: draftJourney.voice,
          agents: draftJourney.agents as any[],
          startingAgentId: draftJourney.startingAgentId,
          version: draftJourney.version,
          publishedAt: draftJourney.updatedAt?.toISOString() || new Date().toISOString(),
          publishedByUserId: "",
        };
      }
    }

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // Inject system tools into agents so mobile app can register client tool handlers
    const agentsWithTools = injectSystemTools(journey.agents);

    // Return mobile-optimized journey format
    return apiResponse.success(res, {
      id: journey.journeyId,
      name: journey.name,
      description: journey.description,
      systemPrompt: journey.systemPrompt,
      voice: journey.voice,
      ttsProvider: journey.ttsProvider || 'elevenlabs',
      elevenLabsConfig: journey.elevenLabsConfig,
      agents: agentsWithTools,
      startingAgentId: journey.startingAgentId,
      version: journey.version,
      publishedAt: journey.publishedAt,
    });
  } catch (error: any) {
    mobileLogger.error("Error getting journey for mobile:", error.message);
    return apiResponse.serverError(res, "Failed to get journey");
  }
});

/**
 * POST /api/mobile/journey/:journeyId/configure
 *
 * Gets journey configuration with variable substitution applied.
 * Mobile app sends user-specific variables (e.g., memberName, primaryGoal)
 * and receives the journey with all {{variable}} placeholders replaced.
 *
 * Request Body:
 * {
 *   variables: {
 *     memberName: "Jack",
 *     primaryGoal: "drink less",
 *     ...
 *   }
 * }
 *
 * Response: Journey with substituted prompts
 */
router.post("/journey/:journeyId/configure", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;
    const { variables = {} } = req.body;

    // First try to get from published flows (production)
    let journey = await publishedFlowStorage.getPublishedFlow(journeyId);

    // If not found in published, try to get from draft storage (for development/testing)
    if (!journey) {
      const draftJourney = await storage.getJourney(journeyId);
      if (draftJourney) {
        journey = {
          id: draftJourney.id,
          journeyId: draftJourney.id,
          name: draftJourney.name,
          description: draftJourney.description || "",
          systemPrompt: draftJourney.systemPrompt,
          voice: draftJourney.voice,
          agents: draftJourney.agents as any[],
          startingAgentId: draftJourney.startingAgentId,
          version: draftJourney.version,
          publishedAt: draftJourney.updatedAt?.toISOString() || new Date().toISOString(),
          publishedByUserId: "",
        };
      }
    }

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // Apply variable substitution to prompts
    const substitutedJourney = substituteVariables(journey, variables);

    // Inject system tools into agents so mobile app can register client tool handlers
    const agentsWithTools = injectSystemTools(substitutedJourney.agents);

    mobileLogger.info(
      `Configured journey ${journeyId} with ${Object.keys(variables).length} variables`
    );

    return apiResponse.success(res, {
      id: substitutedJourney.journeyId,
      name: substitutedJourney.name,
      description: substitutedJourney.description,
      systemPrompt: substitutedJourney.systemPrompt,
      voice: substitutedJourney.voice,
      agents: agentsWithTools,
      startingAgentId: substitutedJourney.startingAgentId,
      version: substitutedJourney.version,
      publishedAt: substitutedJourney.publishedAt,
      // Include list of variables that were substituted
      appliedVariables: Object.keys(variables),
    });
  } catch (error: any) {
    mobileLogger.error("Error configuring journey for mobile:", error.message);
    return apiResponse.serverError(res, "Failed to configure journey");
  }
});

// ============================================================================
// iOS SDUI Module Endpoints
// ============================================================================

/**
 * GET /api/mobile/journey/:journeyId/module/:agentId
 *
 * Gets a single agent's screens formatted as an iOS-compatible SDUI module.
 * This is the preferred endpoint for iOS apps that need to display SDUI screens.
 *
 * Response:
 * {
 *   module: {
 *     id: string,
 *     state: {},
 *     conditions: [],
 *     screens: [ ...normalized iOS screens... ]
 *   },
 *   screenPrompts: { [screenId]: string },
 *   metadata: {
 *     journeyId: string,
 *     journeyName: string,
 *     version: string,
 *     publishedAt: string
 *   }
 * }
 */
router.get("/journey/:journeyId/module/:agentId", async (req: Request, res: Response) => {
  try {
    const { journeyId, agentId } = req.params;

    // First try to get from published flows (production)
    let journey = await publishedFlowStorage.getPublishedFlow(journeyId);

    // If not found in published, try to get from draft storage (for development/testing)
    if (!journey) {
      const draftJourney = await storage.getJourney(journeyId);
      if (draftJourney) {
        journey = {
          id: draftJourney.id,
          journeyId: draftJourney.id,
          name: draftJourney.name,
          description: draftJourney.description || "",
          systemPrompt: draftJourney.systemPrompt,
          voice: draftJourney.voice,
          agents: draftJourney.agents as any[],
          startingAgentId: draftJourney.startingAgentId,
          version: draftJourney.version,
          publishedAt: draftJourney.updatedAt?.toISOString() || new Date().toISOString(),
          publishedByUserId: "",
        };
      }
    }

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    // Find the requested agent and inject system tools
    const agents = injectSystemTools(journey.agents || []);
    const agent = agents.find((a: any) => a.id === agentId);

    if (!agent) {
      return apiResponse.notFound(res, "Agent");
    }

    // Create iOS-compatible module response
    const moduleResponse = createModuleResponse(agent, {
      journeyId: journey.journeyId,
      journeyName: journey.name,
      version: journey.version,
      publishedAt: journey.publishedAt,
    });

    mobileLogger.info(
      `Returned iOS module for journey ${journeyId}, agent ${agentId} with ${moduleResponse.module.screens.length} screens`
    );

    return apiResponse.success(res, moduleResponse);
  } catch (error: any) {
    mobileLogger.error("Error getting iOS module:", error.message);
    return apiResponse.serverError(res, "Failed to get module");
  }
});

/**
 * GET /api/mobile/journey/:journeyId/modules
 *
 * Gets all agents in a journey formatted as iOS-compatible SDUI modules.
 * Useful when iOS needs to preload all modules for a journey.
 *
 * Response:
 * {
 *   journeyId: string,
 *   journeyName: string,
 *   startingAgentId: string,
 *   modules: [
 *     {
 *       module: { id, state, conditions, screens },
 *       screenPrompts: { [screenId]: string }
 *     }
 *   ]
 * }
 */
router.get("/journey/:journeyId/modules", async (req: Request, res: Response) => {
  try {
    const { journeyId } = req.params;

    // First try to get from published flows (production)
    let journey = await publishedFlowStorage.getPublishedFlow(journeyId);

    // If not found in published, try to get from draft storage (for development/testing)
    if (!journey) {
      const draftJourney = await storage.getJourney(journeyId);
      if (draftJourney) {
        journey = {
          id: draftJourney.id,
          journeyId: draftJourney.id,
          name: draftJourney.name,
          description: draftJourney.description || "",
          systemPrompt: draftJourney.systemPrompt,
          voice: draftJourney.voice,
          agents: draftJourney.agents as any[],
          startingAgentId: draftJourney.startingAgentId,
          version: draftJourney.version,
          publishedAt: draftJourney.updatedAt?.toISOString() || new Date().toISOString(),
          publishedByUserId: "",
        };
      }
    }

    if (!journey) {
      return apiResponse.notFound(res, "Journey");
    }

    const agents = injectSystemTools(journey.agents || []);
    const modules = agents.map((agent: any) => ({
      module: normalizeAgentToModule(agent),
      screenPrompts: agent.screenPrompts || {},
    }));

    mobileLogger.info(
      `Returned ${modules.length} iOS modules for journey ${journeyId}`
    );

    return apiResponse.success(res, {
      journeyId: journey.journeyId,
      journeyName: journey.name,
      version: journey.version,
      startingAgentId: journey.startingAgentId,
      publishedAt: journey.publishedAt,
      modules,
    });
  } catch (error: any) {
    mobileLogger.error("Error getting iOS modules:", error.message);
    return apiResponse.serverError(res, "Failed to get modules");
  }
});

// ============================================================================
// Health Check
// ============================================================================

/**
 * GET /api/mobile/health
 *
 * Health check endpoint for mobile apps to verify API availability.
 */
router.get("/health", (_req: Request, res: Response) => {
  return apiResponse.success(res, {
    status: "ok",
    service: "mobile-api",
    timestamp: new Date().toISOString(),
    azureConfigured: !!(
      process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY
    ),
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * System tool definitions that are automatically available to all voice agents.
 *
 * In the web app, these tools are added at runtime:
 * - Azure path: journeyRuntime.ts adds them programmatically
 * - ElevenLabs path: VoiceAgent.tsx hardcodes them as elevenLabsClientTools
 *
 * But they are NOT stored in the journey's agent.tools[] array, so when served
 * to mobile apps, we need to inject them here to ensure the iOS app can register
 * the correct client tool handlers with the ElevenLabs SDK.
 */
const SYSTEM_TOOLS = [
  {
    id: "system_trigger_event",
    name: "trigger_event",
    description: "Trigger a screen event to navigate to the next screen or perform a UI action. Use the eventId that matches the current screen's available events.",
    parameters: {
      type: "object" as const,
      properties: {
        eventId: {
          type: "string",
          description: "The event ID to trigger (must match a registered event on the current screen)"
        },
        delay: {
          type: "number",
          description: "Optional delay in seconds before triggering the event"
        }
      },
      required: ["eventId"],
      additionalProperties: false,
    }
  },
  {
    id: "system_record_input",
    name: "record_input",
    description: "Record the user's spoken response. Use after the user answers a question to save their input.",
    parameters: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          description: "Type of input being captured: 'text' (open response), 'goals' (list of goals), 'intention' (weekly focus)",
          enum: ["text", "goals", "intention"],
        },
        title: {
          type: "string",
          description: "Title/label for the recorded input"
        },
        summary: {
          type: "string",
          description: "One-line summary of the user's response"
        },
        description: {
          type: "string",
          description: "Detailed description of the user's response (2-3 sentences)"
        },
        storeKey: {
          type: "string",
          description: "Base key for module state storage (stores summary at {key}Summary, description at {key}Description)"
        },
        nextEventId: {
          type: "string",
          description: "Optional event ID to trigger after recording (combines record + navigate)"
        },
        delay: {
          type: "number",
          description: "Optional delay in seconds before triggering the nextEventId"
        }
      },
      required: ["title"],
      additionalProperties: false,
    }
  },
  {
    id: "system_end_call",
    name: "end_call",
    description: "End the voice call and disconnect the session.",
    parameters: {
      type: "object" as const,
      properties: {
        reason: {
          type: "string",
          description: "Reason for ending the call"
        },
        delaySeconds: {
          type: "number",
          description: "Optional delay in seconds before disconnecting"
        }
      },
      required: [],
      additionalProperties: false,
    }
  },
  {
    id: "system_set_reminder_time",
    name: "set_reminder_time",
    description: "Save the user's preferred daily reminder time. Pass the time exactly as the user said it - the system converts to UTC automatically.",
    parameters: {
      type: "object" as const,
      properties: {
        time: {
          type: "string",
          description: "The reminder time as the user said it (e.g., '8 PM', '9 AM', '20:00')"
        }
      },
      required: ["time"],
      additionalProperties: false,
    }
  },
  {
    id: "system_set_goals",
    name: "set_goals",
    description: "Save a structured list of the user's goals with categories and progress tracking. Call this after the user shares their desired outcomes. This populates the goals checklist card on the outcomes screen.",
    parameters: {
      type: "object" as const,
      properties: {
        goals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              goal: {
                type: "string",
                description: "A concise description of the goal in the member's own words"
              },
              categories: {
                type: "array",
                items: { type: "string" },
                description: "Categories this goal falls into. Valid: health, relationships, emotional_wellbeing, financial, habits, personal_growth, mindfulness"
              },
              progress: {
                type: "number",
                description: "Progress percentage 0-100. Always 0 at intake."
              }
            },
            required: ["goal", "categories", "progress"],
          },
          description: "Array of goal objects with goal text, categories, and progress"
        }
      },
      required: ["goals"],
      additionalProperties: false,
    }
  },
  {
    id: "system_capture_weekly_focus",
    name: "capture_weekly_focus",
    description: "Capture the member's weekly focus and optionally link it to one of their goals. Stores weeklyFocus, weeklyFocusGoal, and weeklyFocusCaption in module state. The quote card element on the weekly-focus screen reads these values to display the focus.",
    parameters: {
      type: "object" as const,
      properties: {
        focus: {
          type: "string",
          description: "The member's weekly focus in their own words"
        },
        relatedGoal: {
          type: "string",
          description: "The goal this focus relates to, if relevant. Should match one of the goals from set_goals."
        }
      },
      required: ["focus"],
      additionalProperties: false,
    }
  },
  {
    id: "system_set_checkin_frequency",
    name: "set_checkin_frequency",
    description: "DEPRECATED: Check-in frequency is now saved automatically by the select_*_commitment events. This is a no-op kept for backward compatibility.",
    parameters: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Number of days per week to check in (7=daily, 4=few times, 1=once)"
        }
      },
      required: ["days"],
      additionalProperties: false,
    }
  },
];

/**
 * Injects system tool definitions into each agent's tools array.
 * System tools (trigger_event, record_input, etc.) are added at runtime in the
 * web app but not stored in the journey data. This function ensures the mobile
 * app receives the tool schemas so it can register client tool handlers.
 *
 * Only injects tools that aren't already present (by name) to avoid duplicates.
 */
function injectSystemTools(agents: any[]): any[] {
  if (!agents || !Array.isArray(agents)) return agents;

  return agents.map((agent: any) => {
    const existingToolNames = new Set(
      (agent.tools || []).map((t: any) => t.name)
    );

    const toolsToAdd = SYSTEM_TOOLS.filter(
      (st) => !existingToolNames.has(st.name)
    );

    if (toolsToAdd.length === 0) return agent;

    return {
      ...agent,
      tools: [...(agent.tools || []), ...toolsToAdd],
    };
  });
}

/**
 * Substitutes {{variable}} placeholders in journey prompts with provided values.
 *
 * @param journey - The journey configuration
 * @param variables - Map of variable names to values
 * @returns Journey with substituted prompts
 */
function substituteVariables(
  journey: PublishedFlowData,
  variables: Record<string, string>
): PublishedFlowData {
  const substitute = (text: string | null | undefined): string => {
    if (!text) return text || "";

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      // Replace both {{key}} and {{ key }} formats
      const patterns = [
        new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g"),
      ];

      for (const pattern of patterns) {
        result = result.replace(pattern, value);
      }
    }
    return result;
  };

  // Deep clone the journey to avoid mutating the original
  const substituted: PublishedFlowData = JSON.parse(JSON.stringify(journey));

  // Substitute in system prompt
  substituted.systemPrompt = substitute(substituted.systemPrompt);

  // Substitute in agent prompts and screen prompts
  if (substituted.agents && Array.isArray(substituted.agents)) {
    substituted.agents = substituted.agents.map((agent: any) => ({
      ...agent,
      prompt: substitute(agent.prompt),
      // Handle screen prompts if they exist
      screenPrompts: agent.screenPrompts
        ? Object.fromEntries(
            Object.entries(agent.screenPrompts).map(([screenId, prompt]) => [
              screenId,
              substitute(prompt as string),
            ])
          )
        : agent.screenPrompts,
    }));
  }

  return substituted;
}

export default router;
