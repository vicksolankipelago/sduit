import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { setupAuth, isAuthenticated } from "./auth";
import journeysRouter from "./routes/journeys";
import voiceSessionsRouter from "./routes/voiceSessions";
import feedbackRouter from "./routes/feedback";
import screensRouter from "./routes/screens";
import recordingsRouter from "./routes/recordings";
import mobileRouter from "./routes/mobile";
import previewCredentialsRouter from "./routes/previewCredentials";
import quizRouter from "./routes/quiz";
import fileUpload from "express-fileupload";
import { serverLogger, sessionLogger, bedrockLogger } from "./utils/logger";
import * as apiResponse from "./utils/response";
import { storage } from "./storage";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "5000");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  abortOnLimit: true,
}));

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent API server is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent API server is running" });
});

async function main() {
  setupAuth(app);
  
  // Public routes for production runtime - must be registered before authenticated routes
  const { publishedFlowStorage } = await import("./services/publishedFlowStorage");
  
  app.get("/api/journeys/environment", (req, res) => {
    res.json({
      isProduction: process.env.NODE_ENV === "production",
      environment: process.env.NODE_ENV || "development",
    });
  });
  
  app.get("/api/journeys/production/list", async (req, res) => {
    try {
      const flows = await publishedFlowStorage.listPublishedFlows();
      res.json(flows);
    } catch (error) {
      console.error("Error listing production flows:", error);
      res.status(500).json({ message: "Failed to list production flows" });
    }
  });
  
  app.get("/api/journeys/production/:journeyId", async (req, res) => {
    try {
      const flow = await publishedFlowStorage.getPublishedFlow(req.params.journeyId);
      if (!flow) {
        return res.status(404).json({ message: "Flow not found in production" });
      }
      res.json(flow);
    } catch (error) {
      console.error("Error getting production flow:", error);
      res.status(500).json({ message: "Failed to get production flow" });
    }
  });
  
  // Public preview endpoint - registered BEFORE authenticated routes
  // This allows the start_journey flow to fetch journey data without auth
  app.get("/api/journeys/preview/:id", async (req, res) => {
    try {
      const journey = await storage.getJourney(req.params.id as string);
      
      if (!journey) {
        return res.status(404).json({ success: false, error: { message: "Journey not found", code: "NOT_FOUND" } });
      }

      // Return only the data needed for preview rendering
      return res.json({
        id: journey.id,
        name: journey.name,
        agents: journey.agents,
        startingAgentId: journey.startingAgentId,
        voiceEnabled: journey.voiceEnabled ?? true,
        systemPrompt: journey.systemPrompt,
        voice: journey.voice,
      });
    } catch (error) {
      console.error("Error fetching journey preview:", error);
      return res.status(500).json({ success: false, error: { message: "Failed to load journey preview", code: "SERVER_ERROR" } });
    }
  });

  // Mobile API routes - public endpoints for iOS/Android apps
  app.use("/api/mobile", mobileRouter);

  app.use("/api/journeys", isAuthenticated, journeysRouter);
  app.use("/api/voice-sessions", isAuthenticated, voiceSessionsRouter);
  app.use("/api/feedback", isAuthenticated, feedbackRouter);
  app.use("/api/screens", isAuthenticated, screensRouter);
  app.use("/api/admin/preview-credentials", previewCredentialsRouter);
  app.use("/api/recordings", recordingsRouter);
  app.use("/api/quiz", isAuthenticated, quizRouter);
  
  app.get("/api/debug/env", (req, res) => {
    res.json({
      AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
      AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "(default: gpt-realtime)",
      OPENAI_API_VERSION: process.env.OPENAI_API_VERSION || "(default: 2025-04-01-preview)",
      endpoint_value: process.env.AZURE_OPENAI_ENDPOINT ? process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "") : "NOT SET",
    });
  });

  app.get("/api/session", async (req, res) => {
    try {
      let endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-realtime";
      const apiVersion = process.env.OPENAI_API_VERSION || "2025-04-01-preview";

      // Comprehensive logging for Azure configuration
      sessionLogger.info("=== Azure OpenAI Session Request ===");
      sessionLogger.info("Configuration:", {
        endpoint: endpoint ? `${endpoint.substring(0, 30)}...` : "NOT SET",
        apiKeySet: !!apiKey,
        apiKeyLength: apiKey ? apiKey.length : 0,
        deploymentName,
        apiVersion,
      });

      if (endpoint && endpoint.endsWith("/")) {
        endpoint = endpoint.slice(0, -1);
        sessionLogger.info("Normalized endpoint (removed trailing slash)");
      }

      if (!apiKey) {
        sessionLogger.error("AZURE_OPENAI_API_KEY environment variable is not set");
        return apiResponse.configError(res, "Azure OpenAI API key not configured", "AZURE_OPENAI_API_KEY environment variable is missing");
      }

      if (!endpoint) {
        sessionLogger.error("AZURE_OPENAI_ENDPOINT environment variable is not set");
        return apiResponse.configError(res, "Azure OpenAI endpoint not configured", "AZURE_OPENAI_ENDPOINT environment variable is missing");
      }

      sessionLogger.info("Creating ephemeral key for WebRTC connection...");

      const sessionsUrl = `${endpoint}/openai/realtimeapi/sessions?api-version=${apiVersion}`;
      sessionLogger.info("Sessions URL:", sessionsUrl);

      const requestBody = {
        model: deploymentName,
        voice: "sage",
      };
      sessionLogger.info("Request body:", JSON.stringify(requestBody));

      const response = await fetch(sessionsUrl, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      sessionLogger.info("Response status:", response.status, response.statusText);
      sessionLogger.info("Response headers:", JSON.stringify(Object.fromEntries(response.headers.entries())));

      if (!response.ok) {
        const errorText = await response.text();
        sessionLogger.error("=== Azure OpenAI Error Details ===");
        sessionLogger.error("Status:", response.status);
        sessionLogger.error("Status Text:", response.statusText);
        sessionLogger.error("Error Body:", errorText);
        
        // Parse error for more details
        try {
          const errorJson = JSON.parse(errorText);
          sessionLogger.error("Error Code:", errorJson.error?.code);
          sessionLogger.error("Error Message:", errorJson.error?.message);
          sessionLogger.error("Inner Error:", JSON.stringify(errorJson.error?.innererror));
          
          // Provide actionable guidance
          if (errorJson.error?.code === "DeploymentNotFound") {
            sessionLogger.error("=== DEPLOYMENT NOT FOUND ===");
            sessionLogger.error(`The deployment '${deploymentName}' does not exist in your Azure OpenAI resource.`);
            sessionLogger.error("Please check:");
            sessionLogger.error("1. The deployment name in AZURE_OPENAI_DEPLOYMENT_NAME matches your Azure portal");
            sessionLogger.error("2. The deployment is a 'gpt-4o-realtime-preview' model");
            sessionLogger.error("3. The endpoint region matches where the deployment was created");
          }
        } catch (e) {
          sessionLogger.error("Could not parse error as JSON");
        }
        
        return apiResponse.error(res, "Failed to create ephemeral session", response.status, "SESSION_CREATE_FAILED", errorText);
      }

      const sessionData = await response.json();
      sessionLogger.info("=== Session Created Successfully ===");
      sessionLogger.info("Session ID:", sessionData.id);
      sessionLogger.info("Session expires:", sessionData.expires_at);
      sessionLogger.info("Has client_secret:", !!sessionData.client_secret);

      // Get region from Azure response headers (most reliable) or fall back to endpoint pattern
      const azureRegionHeader = response.headers.get("x-ms-region");
      sessionLogger.info("Azure x-ms-region header:", azureRegionHeader);
      
      // Map Azure region names to WebRTC endpoint regions
      // IMPORTANT: The WebRTC region must match where the Azure resource is deployed
      const regionMapping: Record<string, string> = {
        "central us": "centralus",
        "east us": "eastus",
        "east us 2": "eastus2",
        "west us": "westus",
        "west us 2": "westus2",
        "sweden central": "swedencentral",
        "west europe": "westeurope",
        "north europe": "northeurope",
      };
      
      let region = "eastus2"; // default
      if (azureRegionHeader) {
        const normalizedRegion = azureRegionHeader.toLowerCase();
        region = regionMapping[normalizedRegion] || normalizedRegion.replace(/\s+/g, '');
        sessionLogger.info("Region from Azure header:", region);
      } else {
        // Fallback: detect from endpoint URL
        const openaiRegionMatch = endpoint.match(/-(swedencentral|eastus2|eastus|westus|westus2|westeurope|northeurope)\.openai\.azure\.com/i);
        const cogServicesMatch = endpoint.match(/-(us|eu|uk|au)/i) || endpoint.match(/(eastus|westus|swedencentral|westeurope)/i);
        
        if (openaiRegionMatch) {
          region = openaiRegionMatch[1].toLowerCase();
        } else if (cogServicesMatch) {
          const matched = cogServicesMatch[1].toLowerCase();
          if (matched.includes('us') || matched === 'eastus' || matched === 'westus') {
            region = "eastus2";
          } else if (matched.includes('eu') || matched === 'swedencentral' || matched === 'westeurope') {
            region = "swedencentral";
          }
        }
        sessionLogger.info("Region from endpoint pattern:", region);
      }
      sessionLogger.info("Final WebRTC region:", region);

      const responseData = {
        ...sessionData,
        webrtcUrl: `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`,
        deployment: deploymentName,
        region: region,
      };
      sessionLogger.info("WebRTC URL:", responseData.webrtcUrl);

      res.json(responseData);
    } catch (err: any) {
      sessionLogger.error("=== Unexpected Error ===");
      sessionLogger.error("Error creating ephemeral key:", err.message);
      sessionLogger.error("Stack:", err.stack);
      return apiResponse.serverError(res, "Failed to create ephemeral key", err.message);
    }
  });

  app.post("/api/session", async (req, res) => {
    return (app as any)._router.handle(req, res);
  });

  function parseBedrockToken(bearerToken: string) {
    let accessKeyId = "";
    let secretAccessKey = "";

    if (bearerToken.startsWith("ABSK")) {
      try {
        const encodedCredentials = bearerToken.substring(4);
        const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf-8");

        if (decodedCredentials.includes(":")) {
          [accessKeyId, secretAccessKey] = decodedCredentials.split(":");
          bedrockLogger.debug("Decoded ABSK token successfully");
        }
      } catch (error: any) {
        bedrockLogger.error("Failed to decode token:", error.message);
      }
    } else if (bearerToken.includes(":")) {
      [accessKeyId, secretAccessKey] = bearerToken.split(":");
    }

    return { accessKeyId, secretAccessKey };
  }

  app.post("/generate-screens", async (req, res) => {
    const { systemPrompt, agentPrompt, agentName, existingScreens, customInstructions } = req.body;

    if (!systemPrompt || typeof systemPrompt !== 'string') {
      return apiResponse.validationError(res, "systemPrompt is required and must be a string");
    }
    if (!agentPrompt || typeof agentPrompt !== 'string') {
      return apiResponse.validationError(res, "agentPrompt is required and must be a string");
    }
    if (agentName && typeof agentName !== 'string') {
      return apiResponse.validationError(res, "agentName must be a string");
    }
    if (existingScreens && !Array.isArray(existingScreens)) {
      return apiResponse.validationError(res, "existingScreens must be an array");
    }

    const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
    if (!bearerToken) {
      return apiResponse.configError(res, "AWS_BEARER_TOKEN_BEDROCK not configured", "Please set it in .env file");
    }

    try {
      const { accessKeyId, secretAccessKey } = parseBedrockToken(bearerToken);

      if (!accessKeyId || !secretAccessKey) {
        return apiResponse.configError(res, "Failed to parse AWS bearer token", "Ensure it's in ABSK format");
      }

      const bedrockClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: { accessKeyId, secretAccessKey },
      });

      const modelId = "global.anthropic.claude-opus-4-5-20251101-v1:0";
      bedrockLogger.info("Generating screens using Bedrock (Claude Opus 4.5)");

      const elementDefaults = {
        button: { state: { id: "", title: "Button", isDisabled: false }, style: { style: "primary", size: "large" } },
        textBlock: { state: { id: "", text: "Text content" }, style: { style: "body1", alignment: "leading" } },
        image: { state: { id: "", imageName: "placeholder" }, style: { width: 200, height: 200, contentMode: "fit" } },
        spacer: { state: { id: "" }, style: { height: 16, isFlexible: false, direction: "vertical" } },
        loadingView: { state: { id: "" } },
        imageCard: {
          state: { id: "", title: "Title", description: "Description" },
          style: { imageName: "Success", imageWidth: 72, imageHeight: 72, backgroundColor: "backgroundTeaGreen", cornerRadius: 8 },
        },
        checklistCard: {
          state: { id: "", title: "Checklist", itemTitles: ["Item 1", "Item 2"] },
          style: { backgroundColor: "backgroundLightTeaGreen", cornerRadius: 12 },
        },
        toggleCard: {
          state: { id: "", title: "Toggle", description: "Description", isToggled: false },
          style: { backgroundColor: "secondaryDisabled", borderColor: "secondaryDefault", cornerRadius: 8 },
        },
        largeQuestion: {
          state: {
            id: "",
            title: "Question?",
            options: [{ id: "opt1", title: "Option 1", description: "Description" }],
          },
        },
        circularStepper: { state: { id: "", value: 0, minValue: 0, maxValue: 10, step: 1, label: "Count" } },
        miniWidget: {
          state: { id: "", title: "Widget", value: "0", icon: "chart" },
          style: { backgroundColor: "backgroundLightCard", cornerRadius: 8 },
        },
        agentMessageCard: {
          state: { id: "", message: "Message", agentName: "Agent", avatar: "robot" },
          style: { backgroundColor: "backgroundLightCard", cornerRadius: 12 },
        },
      };

      const generationPrompt = `You are a UX designer for a voice-guided mental health application called Pelago.

Analyse the following agent configuration and suggest appropriate mobile UI screens:

SYSTEM PROMPT:
${systemPrompt}

AGENT PROMPT:
${agentPrompt}

AGENT NAME: ${agentName}

${existingScreens?.length ? `EXISTING SCREENS (don't duplicate these): ${existingScreens.map((s: any) => s.title).join(", ")}` : ""}

${customInstructions ? `CUSTOM INSTRUCTIONS FROM USER:\n${customInstructions}\n\nPlease incorporate these specific requirements into your screen designs.\n` : ""}

Available UI Elements with their COMPLETE DEFAULT VALUES:
${JSON.stringify(elementDefaults, null, 2)}

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "screens": [
    {
      "screenType": "question",
      "title": "Select Your Focus",
      "description": "Helps members choose their primary area of focus",
      "reasoning": "The agent asks about focus areas, so this screen provides a visual way to select options",
      "elements": [
        {
          "type": "textBlock",
          "state": { "text": "What would you like to focus on?" },
          "style": { "style": "heading2", "alignment": "center" }
        }
      ]
    }
  ]
}`;

      const requestBody = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 12288,
        temperature: 0.7,
        system: "You are a UX designer specialising in mental health and voice-guided mobile applications. Return only valid JSON with no markdown formatting.",
        messages: [
          {
            role: "user",
            content: generationPrompt,
          },
        ],
      };

      const command = new InvokeModelCommand({
        modelId: modelId,
        contentType: "application/json",
        accept: "application/json",
        body: JSON.stringify(requestBody),
      });

      bedrockLogger.info("Sending request to Bedrock...");
      const bedrockResponse = await bedrockClient.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));
      bedrockLogger.info("Received response from Bedrock");

      let content = "";
      if (responseBody.content && Array.isArray(responseBody.content)) {
        content = responseBody.content
          .filter((block: any) => block.type === "text")
          .map((block: any) => block.text)
          .join("\n");
      }

      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

      const parsed = JSON.parse(content);
      const suggestions = Array.isArray(parsed) ? parsed : (parsed.screens || []);

      bedrockLogger.info(`Generated ${suggestions.length} screen suggestions`);

      return apiResponse.success(res, { suggestions });
    } catch (error: any) {
      bedrockLogger.error("Error generating screens:", error);
      return apiResponse.serverError(res, error.message || "Failed to generate screens");
    }
  });

  const distPath = path.join(__dirname, "../apps/web/dist");
  app.use(express.static(distPath));
  
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api") && !req.path.startsWith("/health")) {
      res.sendFile(path.join(distPath, "index.html"));
    } else {
      next();
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    serverLogger.info(`API Server running on port ${PORT}`);
  });
}

main().catch((err) => serverLogger.error("Server startup failed:", err));
