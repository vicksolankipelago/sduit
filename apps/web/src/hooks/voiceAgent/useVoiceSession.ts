/**
 * Unified Voice Session Hook
 * 
 * Provides a provider-agnostic interface for voice sessions.
 * Automatically switches between Azure and ElevenLabs based on configuration.
 */

import { useCallback, useMemo } from 'react';
import { useAzureWebRTCSession, type AzureWebRTCSessionCallbacks, type AzureWebRTCConnectOptions } from './useAzureWebRTCSession';
import { useElevenLabsSession, type ElevenLabsSessionCallbacks, type ElevenLabsConnectOptions } from './useElevenLabsSession';
import { TtsProvider } from '../../types/journey';
import { SessionStatus } from '../../types/voiceAgent';

export interface VoiceSessionCallbacks {
  customPrompts?: Record<string, string>;
  onConnectionChange?: (status: SessionStatus) => void;
  onTranscript?: (role: string, text: string, isDone?: boolean) => void;
  onEvent?: (event: any) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onConversationComplete?: () => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
}

export interface VoiceConnectOptions {
  audioElement?: HTMLAudioElement;
  customInstructions?: string;
  skipInitialGreeting?: boolean;
  voice?: string;
  customMicStream?: MediaStream;
  // System prompt - global instructions shared by all agents
  systemPrompt?: string;
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
  // Dynamic variables to inject into the agent's prompt
  dynamicVariables?: Record<string, string>;
}

export interface VoiceSession {
  status: SessionStatus;
  connect: (options: VoiceConnectOptions) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: unknown) => void;
  setMicMuted: (muted: boolean) => void;
  provider: TtsProvider;
  sendContextualUpdate?: (message: string) => void;
  sendUserMessage?: (message: string) => void;
}

export function useVoiceSession(
  provider: TtsProvider = 'azure',
  callbacks: VoiceSessionCallbacks = {}
): VoiceSession {
  const azureCallbacks: AzureWebRTCSessionCallbacks = useMemo(() => ({
    customPrompts: callbacks.customPrompts,
    onConnectionChange: callbacks.onConnectionChange,
    onTranscript: callbacks.onTranscript,
    onEvent: callbacks.onEvent,
    onAgentHandoff: callbacks.onAgentHandoff,
    onToolCall: callbacks.onToolCall,
    onConversationComplete: callbacks.onConversationComplete,
  }), [callbacks]);

  const elevenLabsCallbacks: ElevenLabsSessionCallbacks = useMemo(() => ({
    customPrompts: callbacks.customPrompts,
    onConnectionChange: callbacks.onConnectionChange,
    onTranscript: callbacks.onTranscript,
    onEvent: callbacks.onEvent,
    onAgentHandoff: callbacks.onAgentHandoff,
    onToolCall: callbacks.onToolCall,
    onConversationComplete: callbacks.onConversationComplete,
    onModeChange: callbacks.onModeChange,
  }), [callbacks]);

  const azureSession = useAzureWebRTCSession(azureCallbacks);
  const elevenLabsSession = useElevenLabsSession(elevenLabsCallbacks);

  const connect = useCallback(async (options: VoiceConnectOptions) => {
    if (provider === 'elevenlabs') {
      const elevenLabsOptions: ElevenLabsConnectOptions = {
        ...options,
        elevenLabsAgentId: options.elevenLabsAgentId,
        elevenLabsVoiceId: options.elevenLabsVoiceId || options.voice,
        // Ensure system prompt is passed to ElevenLabs
        systemPrompt: options.systemPrompt,
      };
      return elevenLabsSession.connect(elevenLabsOptions);
    } else {
      const azureOptions: AzureWebRTCConnectOptions = options;
      return azureSession.connect(azureOptions);
    }
  }, [provider, azureSession, elevenLabsSession]);

  const disconnect = useCallback(() => {
    if (provider === 'elevenlabs') {
      elevenLabsSession.disconnect();
    } else {
      azureSession.disconnect();
    }
  }, [provider, azureSession, elevenLabsSession]);

  const sendMessage = useCallback((message: unknown) => {
    if (provider === 'elevenlabs') {
      elevenLabsSession.sendMessage(message);
    } else {
      azureSession.sendMessage(message);
    }
  }, [provider, azureSession, elevenLabsSession]);

  const setMicMuted = useCallback((muted: boolean) => {
    if (provider === 'elevenlabs') {
      elevenLabsSession.setMicMuted(muted);
    } else {
      azureSession.setMicMuted(muted);
    }
  }, [provider, azureSession, elevenLabsSession]);

  const sendContextualUpdate = useCallback((message: string) => {
    if (provider === 'elevenlabs') {
      elevenLabsSession.sendContextualUpdate?.(message);
    }
  }, [provider, elevenLabsSession]);

  const sendUserMessage = useCallback((message: string) => {
    if (provider === 'elevenlabs') {
      elevenLabsSession.sendUserMessage?.(message);
    }
  }, [provider, elevenLabsSession]);

  return {
    status: provider === 'elevenlabs' ? elevenLabsSession.status : azureSession.status,
    connect,
    disconnect,
    sendMessage,
    setMicMuted,
    provider,
    sendContextualUpdate: provider === 'elevenlabs' ? sendContextualUpdate : undefined,
    sendUserMessage: provider === 'elevenlabs' ? sendUserMessage : undefined,
  };
}
