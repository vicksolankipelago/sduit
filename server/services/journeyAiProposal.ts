import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export type JourneyAiProposalScope = "journey" | "agent" | "screens";

export interface JourneyAiProposalRequestInput {
  request: string;
  scope: JourneyAiProposalScope;
  agentId?: string;
  screenIds?: string[];
  feedback?: string;
}

export interface JourneyAiProposalGenerationInput extends JourneyAiProposalRequestInput {
  journey: Record<string, unknown>;
}

export interface JourneyAiProposalGenerationResult {
  summary: string;
  changedPaths: string[];
  updatedJourneyDraft: Record<string, unknown>;
  rawModelOutput?: string;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry).trim())
    .filter((entry) => Boolean(entry));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseBedrockToken(bearerToken: string) {
  let accessKeyId = "";
  let secretAccessKey = "";

  if (bearerToken.startsWith("ABSK")) {
    try {
      const encodedCredentials = bearerToken.substring(4);
      const decodedCredentials = Buffer.from(encodedCredentials, "base64").toString("utf-8");

      if (decodedCredentials.includes(":")) {
        [accessKeyId, secretAccessKey] = decodedCredentials.split(":");
      }
    } catch {
      return { accessKeyId: "", secretAccessKey: "" };
    }
  } else if (bearerToken.includes(":")) {
    [accessKeyId, secretAccessKey] = bearerToken.split(":");
  }

  return { accessKeyId, secretAccessKey };
}

function stripCodeFences(text: string): string {
  return text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();
}

function coerceSummary(value: unknown): string {
  const summary = asString(value).trim();
  return summary || "AI proposal generated";
}

function mergeJourneyDraft(
  baseJourney: Record<string, unknown>,
  candidateDraft: unknown
): Record<string, unknown> {
  const candidate = isObject(candidateDraft) ? candidateDraft : {};
  const editableKeys = [
    "name",
    "description",
    "systemPrompt",
    "voice",
    "voiceEnabled",
    "ttsProvider",
    "elevenLabsConfig",
    "agents",
    "startingAgentId",
    "version",
  ];

  const merged: Record<string, unknown> = { ...baseJourney };
  editableKeys.forEach((key) => {
    if (key in candidate) {
      merged[key] = candidate[key];
    }
  });

  // Hard-preserve identity fields for draft proposals
  merged.id = baseJourney.id;
  if ("userId" in baseJourney) merged.userId = baseJourney.userId;
  if ("createdAt" in baseJourney) merged.createdAt = baseJourney.createdAt;
  if ("updatedAt" in baseJourney) merged.updatedAt = baseJourney.updatedAt;
  if ("status" in baseJourney) merged.status = baseJourney.status;
  if ("isPublished" in baseJourney) merged.isPublished = baseJourney.isPublished;
  if ("publishedAt" in baseJourney) merged.publishedAt = baseJourney.publishedAt;

  return merged;
}

function buildPrompt(input: JourneyAiProposalGenerationInput): string {
  const scopeLine = `Scope: ${input.scope}`;
  const agentLine = input.agentId ? `Target Agent ID: ${input.agentId}` : "Target Agent ID: (none)";
  const screenLine =
    input.screenIds && input.screenIds.length > 0
      ? `Target Screen IDs: ${input.screenIds.join(", ")}`
      : "Target Screen IDs: (none)";

  const feedbackLine = input.feedback?.trim()
    ? `Feedback on previous proposal:\n${input.feedback.trim()}`
    : "Feedback on previous proposal: (none)";

  return `You are editing a Server-Driven UI (SDUI) journey configuration.

Return ONLY valid JSON (no markdown, no code fences) using this exact object shape:
{
  "summary": "short summary of changes",
  "changedPaths": ["journey.systemPrompt", "journey.agents[0].prompt"],
  "updatedJourneyDraft": { ... full journey object ... }
}

Hard rules:
- Keep journey.id unchanged.
- Keep existing agent and screen IDs unless the request explicitly asks to rename/regenerate IDs.
- Keep handoff targets valid.
- Keep screenPrompts keys aligned to real screen IDs.
- Keep navigation deeplinks valid for the updated screen set.
- Include a FULL journey object in updatedJourneyDraft (not a partial patch).
- If scope is "agent" or "screens", limit edits to that area as much as possible.

User request:
${input.request}

${scopeLine}
${agentLine}
${screenLine}
${feedbackLine}

Current journey JSON:
${JSON.stringify(input.journey, null, 2)}`;
}

export async function generateJourneyAiProposal(
  input: JourneyAiProposalGenerationInput
): Promise<JourneyAiProposalGenerationResult> {
  const bearerToken = process.env.AWS_BEARER_TOKEN_BEDROCK;
  if (!bearerToken) {
    throw new Error("AWS_BEARER_TOKEN_BEDROCK not configured");
  }

  const { accessKeyId, secretAccessKey } = parseBedrockToken(bearerToken);
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("Failed to parse AWS bearer token for Bedrock");
  }

  const bedrockClient = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: { accessKeyId, secretAccessKey },
  });

  const modelId = "global.anthropic.claude-opus-4-5-20251101-v1:0";
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 12288,
    temperature: 0.2,
    system:
      "You are a strict JSON SDUI flow editor for the Pelago journey builder. Never output markdown.",
    messages: [
      {
        role: "user",
        content: buildPrompt(input),
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  const bedrockResponse = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(bedrockResponse.body));

  let content = "";
  if (Array.isArray(responseBody.content)) {
    content = responseBody.content
      .filter((block: { type?: string; text?: string }) => block.type === "text")
      .map((block: { text?: string }) => block.text || "")
      .join("\n");
  }

  const cleanedContent = stripCodeFences(content);
  const parsed = JSON.parse(cleanedContent);
  const parsedObject = isObject(parsed) ? parsed : {};

  const summary = coerceSummary(parsedObject.summary);
  const changedPaths = asStringArray(parsedObject.changedPaths);
  const updatedJourneyDraft = mergeJourneyDraft(input.journey, parsedObject.updatedJourneyDraft);

  return {
    summary,
    changedPaths,
    updatedJourneyDraft,
    rawModelOutput: cleanedContent,
  };
}
