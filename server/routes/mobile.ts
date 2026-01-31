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

    // Return mobile-optimized journey format
    return apiResponse.success(res, {
      id: journey.journeyId,
      name: journey.name,
      description: journey.description,
      systemPrompt: journey.systemPrompt,
      voice: journey.voice,
      ttsProvider: journey.ttsProvider || 'elevenlabs',
      elevenLabsConfig: journey.elevenLabsConfig,
      agents: journey.agents,
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

    mobileLogger.info(
      `Configured journey ${journeyId} with ${Object.keys(variables).length} variables`
    );

    return apiResponse.success(res, {
      id: substitutedJourney.journeyId,
      name: substitutedJourney.name,
      description: substitutedJourney.description,
      systemPrompt: substitutedJourney.systemPrompt,
      voice: substitutedJourney.voice,
      agents: substitutedJourney.agents,
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
