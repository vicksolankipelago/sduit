/**
 * Transcript Export Utility
 *
 * Exports voice agent session data as JSON files for prompt testing and iteration.
 */

import { TranscriptItem, LoggedEvent, AgentConfig } from '../types/voiceAgent';
import { Journey, Screen } from '../types/journey';

export interface SessionExport {
  sessionId: string;
  exportedAt: string;
  duration: {
    startMs: number;
    endMs: number;
    totalSeconds: number;
  };

  journey?: {
    id: string;
    name: string;
    voice: string;
  };
  journeyConfig?: {
    id: string;
    name: string;
    description: string;
    systemPrompt: string;
    voice: string | null;
    agents: Array<{
      id: string;
      name: string;
      prompt: string;
      tools: Array<{
        name: string;
        description: string;
        parameters?: any;
      }>;
      screens?: Array<{
        id: string;
        title?: string;
        sections?: any[];
        events?: any[];
      }>;
      handoffs: string[];
    }>;
    startingAgentId: string;
    version: string;
  };

  voiceConfig?: {
    provider: 'elevenlabs' | 'azure' | string;
    elevenLabs?: {
      agentId?: string;
      voiceId?: string;
      modelId?: string;
    };
    azure?: {
      deploymentName?: string;
    };
  };
  agent?: {
    id: string;
    name: string;
    prompt: string;
    tools: Array<{
      name: string;
      description: string;
      parameters?: any;
    }>;
  };

  screens?: Array<{
    id: string;
    title?: string;
    type?: string;
    components?: any[];
  }>;

  transcript: TranscriptItem[];
  events: LoggedEvent[];

  stats: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    breadcrumbs: number;
  };

  prolific?: {
    participantId?: string;
    studyId?: string;
    sessionId?: string;
  };

  flowContext?: Record<string, any>;
  variableSubstitution?: {
    pqData?: Record<string, any>;
    flowContextKeys?: string[];
  };
  debugLogs?: Array<{
    timestamp: string;
    type: string;
    message: string;
    details?: any;
  }>;
}

/**
 * Creates a session export object from the current state
 */
export function createSessionExport(params: {
  sessionId: string;
  transcript: TranscriptItem[];
  events: LoggedEvent[];
  journey?: Journey;
  agentConfig?: AgentConfig;
  screens?: Screen[];
  prolific?: {
    participantId?: string;
    studyId?: string;
    sessionId?: string;
  };
  flowContext?: Record<string, any>;
  debugLogs?: Array<{
    timestamp: string;
    type: string;
    message: string;
    details?: any;
  }>;
  pqData?: Record<string, any>;
}): SessionExport {
  const { sessionId, transcript, events, journey, agentConfig, screens, prolific, flowContext, debugLogs, pqData } = params;

  const messageTimes = transcript
    .filter(t => t.createdAtMs)
    .map(t => t.createdAtMs);

  const startMs = messageTimes.length > 0 ? Math.min(...messageTimes) : Date.now();
  const endMs = messageTimes.length > 0 ? Math.max(...messageTimes) : Date.now();

  const messages = transcript.filter(t => t.type === 'MESSAGE' && t.status === 'DONE' && t.title);
  const userMessages = messages.filter(t => t.role === 'user');
  const assistantMessages = messages.filter(t => t.role === 'assistant');
  const breadcrumbs = transcript.filter(t => t.type === 'BREADCRUMB');
  const toolCalls = events.filter(e =>
    e.eventName === 'response.function_call_arguments.done'
  );

  const journeyConfig = journey ? {
    id: journey.id,
    name: journey.name,
    description: journey.description,
    systemPrompt: journey.systemPrompt,
    voice: journey.voice || null,
    agents: journey.agents.map(a => ({
      id: a.id,
      name: a.name,
      prompt: a.prompt,
      tools: a.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
      screens: a.screens?.map(s => ({
        id: s.id,
        title: s.title,
        sections: s.sections,
        events: s.events,
      })),
      handoffs: a.handoffs,
    })),
    startingAgentId: journey.startingAgentId,
    version: journey.version,
  } : undefined;

  const exportScreens = screens?.map(s => ({
    id: s.id,
    title: s.title,
    type: 'screen' as const,
    components: s.sections,
  }));

  return {
    sessionId,
    exportedAt: new Date().toISOString(),
    duration: {
      startMs,
      endMs,
      totalSeconds: Math.round((endMs - startMs) / 1000),
    },
    journey: journey ? {
      id: journey.id,
      name: journey.name,
      voice: journey.voice || 'default',
    } : undefined,
    journeyConfig,
    voiceConfig: journey ? {
      provider: journey.ttsProvider || 'elevenlabs',
      elevenLabs: journey.elevenLabsConfig ? {
        agentId: journey.elevenLabsConfig.agentId,
        voiceId: journey.elevenLabsConfig.voiceId,
        modelId: journey.elevenLabsConfig.modelId,
      } : undefined,
      azure: journey.azureConfig ? {
        deploymentName: journey.azureConfig.deploymentName,
      } : undefined,
    } : undefined,
    agent: agentConfig ? {
      id: agentConfig.name,
      name: agentConfig.name,
      prompt: agentConfig.instructions,
      tools: agentConfig.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    } : undefined,
    screens: exportScreens,
    transcript,
    events,
    stats: {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      toolCalls: toolCalls.length,
      breadcrumbs: breadcrumbs.length,
    },
    prolific,
    flowContext,
    variableSubstitution: (pqData || flowContext) ? {
      pqData,
      flowContextKeys: flowContext ? Object.keys(flowContext) : undefined,
    } : undefined,
    debugLogs,
  };
}

/**
 * Downloads the session export as a JSON file
 */
export function downloadSessionExport(sessionExport: SessionExport): void {
  const filename = `transcript_${sessionExport.sessionId}_${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(sessionExport, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats transcript for human-readable review
 */
export function formatTranscriptForReview(sessionExport: SessionExport): string {
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push(`SESSION: ${sessionExport.sessionId}`);
  lines.push(`Exported: ${sessionExport.exportedAt}`);
  lines.push(`Duration: ${sessionExport.duration.totalSeconds}s`);
  lines.push('='.repeat(80));
  lines.push('');

  if (sessionExport.agent?.prompt) {
    lines.push('--- AGENT PROMPT ---');
    lines.push(sessionExport.agent.prompt);
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  if (sessionExport.agent?.tools && sessionExport.agent.tools.length > 0) {
    lines.push('--- TOOL DEFINITIONS ---');
    for (const tool of sessionExport.agent.tools) {
      lines.push(`Tool: ${tool.name}`);
      lines.push(`  Description: ${tool.description}`);
      if (tool.parameters) {
        lines.push(`  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`);
      }
      lines.push('');
    }
    lines.push('-'.repeat(80));
    lines.push('');
  }

  if (sessionExport.screens && sessionExport.screens.length > 0) {
    lines.push('--- SCREEN CONFIGURATIONS ---');
    for (const screen of sessionExport.screens) {
      lines.push(`Screen: ${screen.id} (${screen.title || 'untitled'})`);
      if (screen.components) {
        lines.push(`  Components: ${JSON.stringify(screen.components, null, 2)}`);
      }
      lines.push('');
    }
    lines.push('-'.repeat(80));
    lines.push('');
  }

  if (sessionExport.flowContext && Object.keys(sessionExport.flowContext).length > 0) {
    lines.push('--- VARIABLES / FLOW CONTEXT ---');
    for (const [key, value] of Object.entries(sessionExport.flowContext)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`  ${key}: ${displayValue}`);
    }
    lines.push('');
    lines.push('-'.repeat(80));
    lines.push('');
  }

  lines.push('--- CONVERSATION ---');
  lines.push('');

  for (const item of sessionExport.transcript) {
    if (item.type === 'MESSAGE' && item.title) {
      const role = item.role === 'user' ? 'USER' : 'ASSISTANT';
      lines.push(`[${item.timestamp}] ${role}:`);
      lines.push(item.title);
      lines.push('');
    } else if (item.type === 'BREADCRUMB') {
      lines.push(`[${item.timestamp}] 📍 ${item.title}`);
      if (item.data) {
        lines.push(`   Data: ${JSON.stringify(item.data)}`);
      }
      lines.push('');
    }
  }

  if (sessionExport.debugLogs && sessionExport.debugLogs.length > 0) {
    lines.push('-'.repeat(80));
    lines.push('');
    lines.push('--- SESSION DEBUG LOGS ---');
    lines.push('');
    for (const log of sessionExport.debugLogs) {
      lines.push(`[${log.timestamp}] ${log.type.toUpperCase()}: ${log.message}`);
      if (log.details) {
        lines.push(`   Details: ${JSON.stringify(log.details)}`);
      }
    }
    lines.push('');
  }

  lines.push('='.repeat(80));
  lines.push('STATS:');
  lines.push(`  Total messages: ${sessionExport.stats.totalMessages}`);
  lines.push(`  User messages: ${sessionExport.stats.userMessages}`);
  lines.push(`  Assistant messages: ${sessionExport.stats.assistantMessages}`);
  lines.push(`  Tool calls: ${sessionExport.stats.toolCalls}`);
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Formats tool call data for human-readable display
 */
function formatToolCall(toolName: string, args: Record<string, any>): string {
  const lines: string[] = [];
  lines.push(`    Tool: ${toolName}`);

  // Format arguments in a readable way (no raw JSON)
  if (args && Object.keys(args).length > 0) {
    lines.push('    Parameters:');
    for (const [key, value] of Object.entries(args)) {
      // Handle nested objects/arrays gracefully
      const displayValue = typeof value === 'object'
        ? (Array.isArray(value) ? value.join(', ') : JSON.stringify(value, null, 2).split('\n').join('\n        '))
        : String(value);
      lines.push(`      - ${key}: ${displayValue}`);
    }
  }

  return lines.join('\n');
}

/**
 * Formats transcript for non-developer readability
 * Strips JSON, clearly labels speakers, and formats tool calls nicely
 */
export function formatTranscriptForSharing(
  sessionExport: SessionExport,
  options: { includeToolCalls?: boolean; includeTimestamps?: boolean } = {}
): string {
  const { includeToolCalls = true, includeTimestamps = true } = options;
  const lines: string[] = [];
  const divider = '─'.repeat(60);

  // Header
  lines.push('');
  lines.push('╔' + '═'.repeat(58) + '╗');
  lines.push('║' + '  VOICE AGENT CONVERSATION TRANSCRIPT'.padEnd(58) + '║');
  lines.push('╚' + '═'.repeat(58) + '╝');
  lines.push('');

  // Session info
  lines.push(`Session ID: ${sessionExport.sessionId}`);
  lines.push(`Date: ${new Date(sessionExport.exportedAt).toLocaleString()}`);
  lines.push(`Duration: ${Math.floor(sessionExport.duration.totalSeconds / 60)}m ${sessionExport.duration.totalSeconds % 60}s`);
  if (sessionExport.journey?.name) {
    lines.push(`Journey: ${sessionExport.journey.name}`);
  }
  if (sessionExport.agent?.name) {
    lines.push(`Agent: ${sessionExport.agent.name}`);
  }

  // Voice configuration
  if (sessionExport.voiceConfig) {
    lines.push('');
    lines.push('Voice Configuration:');
    lines.push(`  Provider: ${sessionExport.voiceConfig.provider}`);
    if (sessionExport.voiceConfig.elevenLabs) {
      if (sessionExport.voiceConfig.elevenLabs.agentId) {
        lines.push(`  ElevenLabs Agent ID: ${sessionExport.voiceConfig.elevenLabs.agentId}`);
      }
      if (sessionExport.voiceConfig.elevenLabs.voiceId) {
        lines.push(`  ElevenLabs Voice ID: ${sessionExport.voiceConfig.elevenLabs.voiceId}`);
      }
      if (sessionExport.voiceConfig.elevenLabs.modelId) {
        lines.push(`  ElevenLabs Model ID: ${sessionExport.voiceConfig.elevenLabs.modelId}`);
      }
    }
    if (sessionExport.voiceConfig.azure?.deploymentName) {
      lines.push(`  Azure Deployment: ${sessionExport.voiceConfig.azure.deploymentName}`);
    }
  }

  if (sessionExport.flowContext && Object.keys(sessionExport.flowContext).length > 0) {
    lines.push('');
    lines.push('Variables:');
    for (const [key, value] of Object.entries(sessionExport.flowContext)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`  ${key}: ${displayValue}`);
    }
  }
  lines.push('');
  lines.push(divider);
  lines.push('');

  // Build a map of tool calls from events for richer tool call display
  const toolCallMap = new Map<string, { name: string; args: any; result?: any }>();
  for (const event of sessionExport.events) {
    if (event.eventName === 'response.function_call_arguments.done') {
      const data = event.eventData;
      if (data.name && data.call_id) {
        toolCallMap.set(data.call_id, {
          name: data.name,
          args: data.arguments ? JSON.parse(data.arguments) : {},
        });
      }
    }
  }

  // Process transcript items
  let lastRole: string | undefined;

  for (const item of sessionExport.transcript) {
    if (item.type === 'MESSAGE' && item.title) {
      const role = item.role === 'user' ? 'MEMBER' : 'COACH';
      const timestamp = includeTimestamps ? `[${item.timestamp}] ` : '';

      // Add spacing between different speakers
      if (lastRole && lastRole !== role) {
        lines.push('');
      }

      lines.push(`${timestamp}${role}:`);
      lines.push(`  "${item.title}"`);
      lines.push('');

      lastRole = role;
    } else if (item.type === 'BREADCRUMB' && includeToolCalls) {
      // Format breadcrumbs (tool calls/events) nicely
      const timestamp = includeTimestamps ? `[${item.timestamp}] ` : '';

      // Check if this is a tool-related breadcrumb
      if (item.title?.includes('Tool') || item.title?.includes('tool')) {
        lines.push(`${timestamp}[ACTION]`);
        if (item.data) {
          // Extract tool name and args from data
          const toolName = item.data.toolName || item.data.name || item.title;
          const args = item.data.args || item.data.arguments || {};
          lines.push(formatToolCall(toolName, args));
        } else {
          lines.push(`    ${item.title}`);
        }
        lines.push('');
      } else if (item.title?.includes('handoff') || item.title?.includes('Handoff')) {
        lines.push(`${timestamp}[HANDOFF]`);
        lines.push(`    ${item.title}`);
        lines.push('');
      } else if (item.title?.includes('screen') || item.title?.includes('Screen')) {
        lines.push(`${timestamp}[SCREEN CHANGE]`);
        lines.push(`    ${item.title}`);
        lines.push('');
      }

      lastRole = undefined;
    }
  }

  if (sessionExport.debugLogs && sessionExport.debugLogs.length > 0) {
    lines.push('');
    lines.push(divider);
    lines.push('');
    lines.push('SESSION DEBUG LOGS');
    lines.push('');
    for (const log of sessionExport.debugLogs) {
      const timestamp = includeTimestamps ? `[${log.timestamp}] ` : '';
      lines.push(`${timestamp}${log.type.toUpperCase()}: ${log.message}`);
      if (log.details) {
        lines.push(`   Details: ${JSON.stringify(log.details)}`);
      }
    }
    lines.push('');
  }

  // Footer with stats
  lines.push(divider);
  lines.push('');
  lines.push('CONVERSATION SUMMARY');
  lines.push(`  Total exchanges: ${sessionExport.stats.totalMessages}`);
  lines.push(`  Member messages: ${sessionExport.stats.userMessages}`);
  lines.push(`  Coach responses: ${sessionExport.stats.assistantMessages}`);
  if (includeToolCalls && sessionExport.stats.toolCalls > 0) {
    lines.push(`  Actions taken: ${sessionExport.stats.toolCalls}`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Downloads just the prompt as a text file
 */
export function downloadPrompt(prompt: string, sessionId: string): void {
  const filename = `prompt_${sessionId}_${Date.now()}.txt`;
  const blob = new Blob([prompt], { type: 'text/plain' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads transcript in human-readable format (for sharing with non-developers)
 */
export function downloadFormattedTranscript(
  sessionExport: SessionExport,
  options: { includeToolCalls?: boolean; includeTimestamps?: boolean } = {}
): void {
  const formatted = formatTranscriptForSharing(sessionExport, options);
  const filename = `conversation_${sessionExport.sessionId}_${Date.now()}.txt`;
  const blob = new Blob([formatted], { type: 'text/plain' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads both prompt and transcript as separate files
 */
export function downloadPromptAndTranscript(sessionExport: SessionExport): void {
  // Download prompt if available
  if (sessionExport.agent?.prompt) {
    downloadPrompt(sessionExport.agent.prompt, sessionExport.sessionId);
  }

  // Small delay to avoid browser blocking multiple downloads
  setTimeout(() => {
    downloadFormattedTranscript(sessionExport);
  }, 100);
}
