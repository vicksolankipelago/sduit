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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "5000");

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent API server is running" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Voice Agent API server is running" });
});

async function main() {
  setupAuth(app);
  
  app.use("/api/journeys", isAuthenticated, journeysRouter);
  app.use("/api/voice-sessions", isAuthenticated, voiceSessionsRouter);
  app.use("/api/feedback", isAuthenticated, feedbackRouter);
  
  app.get("/api/debug/env", (req, res) => {
    res.json({
      AZURE_OPENAI_ENDPOINT: !!process.env.AZURE_OPENAI_ENDPOINT,
      AZURE_OPENAI_API_KEY: !!process.env.AZURE_OPENAI_API_KEY,
      AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "(default: test-gpt-realtime)",
      OPENAI_API_VERSION: process.env.OPENAI_API_VERSION || "(default: 2025-04-01-preview)",
      endpoint_value: process.env.AZURE_OPENAI_ENDPOINT ? process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, "") : "NOT SET",
    });
  });

  app.get("/api/session", async (req, res) => {
    try {
      let endpoint = process.env.AZURE_OPENAI_ENDPOINT;
      const apiKey = process.env.AZURE_OPENAI_API_KEY;
      const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "test-gpt-realtime";
      const apiVersion = process.env.OPENAI_API_VERSION || "2025-04-01-preview";

      if (endpoint && endpoint.endsWith("/")) {
        endpoint = endpoint.slice(0, -1);
      }

      if (!apiKey) {
        console.error("AZURE_OPENAI_API_KEY environment variable is not set");
        return res.status(500).json({
          error: "Azure OpenAI API key not configured",
          details: "AZURE_OPENAI_API_KEY environment variable is missing",
        });
      }

      if (!endpoint) {
        console.error("AZURE_OPENAI_ENDPOINT environment variable is not set");
        return res.status(500).json({
          error: "Azure OpenAI endpoint not configured",
          details: "AZURE_OPENAI_ENDPOINT environment variable is missing",
        });
      }

      console.log("Creating ephemeral key for WebRTC connection...");

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
        console.error("Failed to create session:", response.status, errorText);
        return res.status(response.status).json({
          error: "Failed to create ephemeral session",
          details: errorText,
        });
      }

      const sessionData = await response.json();
      console.log("Ephemeral key created:", sessionData.id);

      const regionMatch = endpoint.match(/-(swedencentral|eastus2)\.openai\.azure\.com/);
      const region = regionMatch ? regionMatch[1] : "swedencentral";

      res.json({
        ...sessionData,
        webrtcUrl: `https://${region}.realtimeapi-preview.ai.azure.com/v1/realtimertc`,
        deployment: deploymentName,
        region: region,
      });
    } catch (err: any) {
      console.error("Error creating ephemeral key:", err.message);
      res.status(500).json({
        error: "Failed to create ephemeral key",
        details: err.message,
      });
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
          console.log("Decoded ABSK token successfully");
        }
      } catch (error: any) {
        console.error("Failed to decode token:", error.message);
      }
    } else if (bearerToken.includes(":")) {
      [accessKeyId, secretAccessKey] = bearerToken.split(":");
    }

    return { accessKeyId, secretAccessKey };
  }

  app.post("/generate-screens", async (req, res) => {
    const { systemPrompt, agentPrompt, agentName, existingScreens, customInstructions } = req.body;

    if (!systemPrompt || !agentPrompt) {
      return res.status(400).json({
        error: "systemPrompt and agentPrompt are required",
      });
    }

    const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
    if (!bearerToken) {
      return res.status(500).json({
        error: "AWS_BEARER_TOKEN_BEDROCK not configured. Please set it in .env file.",
      });
    }

    try {
      const { accessKeyId, secretAccessKey } = parseBedrockToken(bearerToken);

      if (!accessKeyId || !secretAccessKey) {
        return res.status(500).json({
          error: "Failed to parse AWS bearer token. Ensure it's in ABSK format.",
        });
      }

      const bedrockClient = new BedrockRuntimeClient({
        region: process.env.AWS_REGION || "us-east-1",
        credentials: { accessKeyId, secretAccessKey },
      });

      const modelId = "global.anthropic.claude-opus-4-5-20251101-v1:0";
      console.log(`Generating screens using Bedrock (Claude Opus 4.5)`);

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

      console.log("Sending request to Bedrock...");
      const apiResponse = await bedrockClient.send(command);

      const responseBody = JSON.parse(new TextDecoder().decode(apiResponse.body));
      console.log("Received response from Bedrock");

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

      console.log(`Generated ${suggestions.length} screen suggestions`);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error generating screens:", error);
      res.status(500).json({
        error: error.message || "Failed to generate screens",
      });
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
    console.log(`API Server running on port ${PORT}`);
  });
}

main().catch(console.error);
