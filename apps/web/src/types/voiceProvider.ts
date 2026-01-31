/**
 * Voice Provider Types
 * 
 * Common interface for voice/TTS providers (Azure, ElevenLabs)
 * Enables switching between providers with a unified API
 */

import { SessionStatus } from './voiceAgent';

export type VoiceProviderType = 'azure' | 'elevenlabs';

export interface VoiceSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onTranscript?: (role: string, text: string, isDone?: boolean) => void;
  onEvent?: (event: any) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onConversationComplete?: () => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
  customPrompts?: Record<string, string>;
}

export interface VoiceConnectOptions {
  audioElement?: HTMLAudioElement;
  customInstructions?: string;
  skipInitialGreeting?: boolean;
  voice?: string;
  customMicStream?: MediaStream;
  agentConfig?: {
    name: string;
    instructions: string;
    voice: string;
    tools?: any[];
    handoffs?: string[];
  };
  allJourneyAgents?: Map<string, {
    name: string;
    instructions: string;
    voice: string;
    handoffs?: string[];
  }>;
  screens?: Array<{
    id: string;
    events?: Array<{ id: string; delay?: number }>;
    sections?: Array<{ elements?: Array<{ events?: Array<{ id: string; delay?: number }> }> }>;
  }>;
  onEventTrigger?: (eventId: string, agentName: string) => void;
  onEndCall?: (reason?: string) => void;
  elevenLabsAgentId?: string;
  elevenLabsVoiceId?: string;
}

export interface VoiceSession {
  status: SessionStatus;
  connect: (options: VoiceConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: unknown) => void;
  setMicMuted: (muted: boolean) => void;
  sendContextualUpdate?: (message: string) => void;
  sendUserMessage?: (message: string) => void;
}

export interface VoiceProviderConfig {
  provider: VoiceProviderType;
  elevenLabsAgentId?: string;
  elevenLabsVoiceId?: string;
  azureDeploymentName?: string;
}
