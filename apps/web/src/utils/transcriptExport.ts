/**
 * Transcript Export Utility
 *
 * Exports voice agent session data as JSON files for prompt testing and iteration.
 */

import { TranscriptItem, LoggedEvent, AgentConfig } from '../types/voiceAgent';
import { Journey } from '../types/journey';

export interface SessionExport {
  // Metadata
  sessionId: string;
  exportedAt: string;
  duration: {
    startMs: number;
    endMs: number;
    totalSeconds: number;
  };

  // Journey/Agent configuration
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
    agents: any[];
    startingAgentId: string;
    version: string;
  };
  agent?: {
    id: string;
    name: string;
    prompt: string;
    tools: Array<{
      name: string;
      description: string;
    }>;
  };

  // Conversation data
  transcript: TranscriptItem[];
  events: LoggedEvent[];

  // Summary stats
  stats: {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    toolCalls: number;
    breadcrumbs: number;
  };

  // Prolific study tracking
  prolific?: {
    participantId?: string;
    studyId?: string;
    sessionId?: string;
  };
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
  prolific?: {
    participantId?: string;
    studyId?: string;
    sessionId?: string;
  };
}): SessionExport {
  const { sessionId, transcript, events, journey, agentConfig, prolific } = params;

  // Calculate duration from transcript timestamps
  const messageTimes = transcript
    .filter(t => t.createdAtMs)
    .map(t => t.createdAtMs);

  const startMs = messageTimes.length > 0 ? Math.min(...messageTimes) : Date.now();
  const endMs = messageTimes.length > 0 ? Math.max(...messageTimes) : Date.now();

  // Calculate stats - only count completed messages with content
  const messages = transcript.filter(t => t.type === 'MESSAGE' && t.status === 'DONE' && t.title);
  const userMessages = messages.filter(t => t.role === 'user');
  const assistantMessages = messages.filter(t => t.role === 'assistant');
  const breadcrumbs = transcript.filter(t => t.type === 'BREADCRUMB');
  const toolCalls = events.filter(e =>
    e.eventName === 'response.function_call_arguments.done'
  );

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
    agent: agentConfig ? {
      id: agentConfig.name,
      name: agentConfig.name,
      prompt: agentConfig.instructions,
      tools: agentConfig.tools.map(t => ({
        name: t.name,
        description: t.description,
      })),
    } : undefined,
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
