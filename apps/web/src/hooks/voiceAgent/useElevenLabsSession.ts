/**
 * ElevenLabs Session Hook
 * 
 * Manages voice sessions with ElevenLabs Conversational AI
 * Mirrors the useAzureWebRTCSession interface for provider interchangeability
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useConversation } from '@elevenlabs/react';
import { SessionStatus } from '../../types/voiceAgent';
import { logger } from '../../utils/logger';

const elevenLabsLogger = logger;

export interface ElevenLabsSessionCallbacks {
  customPrompts?: Record<string, string>;
  onConnectionChange?: (status: SessionStatus) => void;
  onTranscript?: (role: string, text: string, isDone?: boolean) => void;
  onEvent?: (event: any) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onConversationComplete?: () => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
  onError?: (error: string, details?: any) => void;
}

export interface ElevenLabsConnectOptions {
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
  // Client-side tools that the ElevenLabs agent can call
  clientTools?: Record<string, (params: any) => Promise<any>>;
  // Dynamic variables to inject into the agent's prompt
  dynamicVariables?: Record<string, string>;
}

export function useElevenLabsSession(callbacks: ElevenLabsSessionCallbacks = {}) {
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const conversationIdRef = useRef<string | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const callbacksRef = useRef(callbacks);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const updateStatus = useCallback((s: SessionStatus) => {
    setStatus(s);
    callbacksRef.current.onConnectionChange?.(s);
  }, []);

  // Store client tools reference for dynamic updates
  const clientToolsRef = useRef<Record<string, (params: any) => Promise<any>>>({});

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      elevenLabsLogger.info('ElevenLabs conversation connected, ID:', conversationId);
      console.log('✅ ElevenLabs onConnect callback fired, conversationId:', conversationId);
      updateStatus('CONNECTED');
    },
    onDisconnect: (details?: { reason?: string }) => {
      const reason = details?.reason || 'unknown';
      elevenLabsLogger.info('ElevenLabs conversation disconnected, reason:', reason);
      console.log('🔌 ElevenLabs onDisconnect - reason:', reason, 'details:', details);
      
      // Only report as error if it's an unexpected disconnect (not user/agent initiated)
      const normalReasons = ['user', 'agent', 'user_ended', 'agent_ended', 'call_ended', 'normal'];
      const isNormalDisconnect = normalReasons.some(r => reason.toLowerCase().includes(r.toLowerCase()));
      if (!isNormalDisconnect) {
        callbacksRef.current.onError?.(`Disconnected (${reason})`, details);
      }
      
      updateStatus('DISCONNECTED');
      callbacksRef.current.onConversationComplete?.();
    },
    onMessage: (message) => {
      elevenLabsLogger.debug('ElevenLabs message:', message);
      console.log('💬 ElevenLabs message:', message.source, message.message?.substring(0, 50));
      if (message.source === 'user') {
        callbacksRef.current.onTranscript?.('user', message.message, true);
      } else if (message.source === 'ai') {
        callbacksRef.current.onTranscript?.('assistant', message.message, true);
      }
      callbacksRef.current.onEvent?.(message);
    },
    onError: (error: unknown) => {
      const errorObj = error as any;
      const errorMessage = typeof error === 'string' ? error : (errorObj?.message || JSON.stringify(error));
      elevenLabsLogger.error('ElevenLabs error:', error);
      console.error('🔴 ElevenLabs SDK onError callback:', error);
      callbacksRef.current.onError?.(`SDK Error: ${errorMessage}`, error);
      updateStatus('DISCONNECTED');
    },
    onModeChange: (data) => {
      const mode = data.mode === 'speaking' ? 'speaking' : 'listening';
      elevenLabsLogger.debug('Mode changed:', mode);
      console.log('🔊 ElevenLabs mode changed:', mode);
      callbacksRef.current.onModeChange?.(mode);
    },
    onStatusChange: (statusData) => {
      elevenLabsLogger.debug('Status changed:', statusData);
      console.log('📊 ElevenLabs status changed:', statusData.status);
      if (statusData.status === 'connected') {
        updateStatus('CONNECTED');
      } else if (statusData.status === 'connecting') {
        updateStatus('CONNECTING');
      } else {
        updateStatus('DISCONNECTED');
      }
    },
    // Client-side tools - these are called by the ElevenLabs agent
    clientTools: clientToolsRef.current,
  });

  const connect = useCallback(async (options: ElevenLabsConnectOptions) => {
    const agentId = options.elevenLabsAgentId;
    
    if (!agentId) {
      elevenLabsLogger.error('ElevenLabs Agent ID is required');
      throw new Error('ElevenLabs Agent ID is required. Please configure it in the flow settings.');
    }

    elevenLabsLogger.info('=== Starting ElevenLabs Connection ===');
    elevenLabsLogger.info('Agent ID:', agentId);
    updateStatus('CONNECTING');

    // Request microphone permission before starting ElevenLabs session
    // This must happen in response to user action for browser to allow it
    console.log('🎤 Requesting microphone permission for ElevenLabs...');
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('🎤 Microphone permission granted for ElevenLabs');
      // Stop the stream immediately - ElevenLabs SDK will request its own
      micStream.getTracks().forEach(track => track.stop());
    } catch (micError: any) {
      console.error('🔴 Microphone permission denied:', micError);
      callbacksRef.current.onError?.(`Microphone access denied: ${micError?.message || micError}`, micError);
      updateStatus('DISCONNECTED');
      throw new Error(`Microphone access denied: ${micError?.message || 'Please allow microphone access to use voice.'}`);
    }

    // Register client tools if provided
    if (options.clientTools) {
      elevenLabsLogger.info('Registering client tools:', Object.keys(options.clientTools));
      Object.assign(clientToolsRef.current, options.clientTools);
    }

    try {
      const overrides: any = {};
      
      // Build combined prompt: system prompt + agent instructions + custom instructions
      // Priority: customInstructions can override, but systemPrompt is always prepended
      const promptParts: string[] = [];
      
      // Always include system prompt first if provided
      if (options.systemPrompt) {
        promptParts.push(options.systemPrompt);
        elevenLabsLogger.info('Including system prompt in ElevenLabs agent');
      }
      
      // Add agent instructions (which may already include system prompt for backwards compatibility)
      if (options.customInstructions) {
        promptParts.push(options.customInstructions);
      } else if (options.agentConfig?.instructions) {
        promptParts.push(options.agentConfig.instructions);
      }
      
      // If we have any prompt content, pass it to ElevenLabs
      if (promptParts.length > 0) {
        const combinedPrompt = promptParts.join('\n\n');
        overrides.agent = {
          prompt: {
            prompt: combinedPrompt,
          },
        };
        elevenLabsLogger.info(`Overriding agent prompt with combined instructions (${combinedPrompt.length} chars)`);
      }
      
      // Pass dynamic variables for template substitution
      if (options.dynamicVariables && Object.keys(options.dynamicVariables).length > 0) {
        overrides.variables = options.dynamicVariables;
        elevenLabsLogger.info('Passing dynamic variables:', Object.keys(options.dynamicVariables));
      }
      
      // Override voice if specified
      if (options.elevenLabsVoiceId || options.voice) {
        overrides.tts = {
          voiceId: options.elevenLabsVoiceId || options.voice,
        };
      }
      
      // Set first message if greeting not skipped
      if (options.skipInitialGreeting === false && options.agentConfig?.name) {
        if (!overrides.agent) overrides.agent = {};
        overrides.agent.firstMessage = `Hello! I'm ${options.agentConfig.name}. How can I help you today?`;
      }

      // Use direct agentId connection (public agent approach)
      // This is the recommended pattern from ElevenLabs React SDK docs
      let sessionConfig: any = {
        agentId,
        connectionType: 'webrtc' as const,
        overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
      };
      
      elevenLabsLogger.info('Using direct agentId connection (public agent)');
      console.log('🔌 Using direct agentId connection:', agentId);

      // Add connection delay for Safari/iOS to allow audio mode switching
      // This helps prevent the SDK's mic access from timing out
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isSafari || isIOS) {
        sessionConfig.connectionDelay = {
          ios: 3000,
          default: 2000,
        };
        elevenLabsLogger.info('Safari/iOS detected, adding connection delay');
        console.log('🍎 Safari/iOS detected, adding 2-3s connection delay');
      }

      elevenLabsLogger.info('Starting session with config:', { 
        hasSignedUrl: !!sessionConfig.signedUrl,
        hasToken: !!sessionConfig.conversationToken,
        hasAgentId: !!sessionConfig.agentId,
        connectionType: sessionConfig.connectionType,
        hasConnectionDelay: !!sessionConfig.connectionDelay,
      });
      console.log('🚀 About to call conversation.startSession...');
      console.log('🚀 Session config:', JSON.stringify({
        hasSignedUrl: !!sessionConfig.signedUrl,
        hasToken: !!sessionConfig.conversationToken,
        hasAgentId: !!sessionConfig.agentId,
        connectionType: sessionConfig.connectionType,
        hasOverrides: !!sessionConfig.overrides,
        hasConnectionDelay: !!sessionConfig.connectionDelay,
      }));

      let conversationId: string;
      try {
        conversationId = await conversation.startSession(sessionConfig);
        console.log('✅ conversation.startSession returned:', conversationId);
      } catch (startError: any) {
        console.error('🔴 conversation.startSession threw:', startError);
        console.error('🔴 Error name:', startError?.name);
        console.error('🔴 Error message:', startError?.message);
        console.error('🔴 Error stack:', startError?.stack);
        callbacksRef.current.onError?.(`Session start failed: ${startError?.message || startError}`, startError);
        updateStatus('DISCONNECTED');
        throw startError;
      }
      
      conversationIdRef.current = conversationId;
      agentIdRef.current = agentId;
      
      elevenLabsLogger.info('Session started, conversation ID:', conversationId);
      console.log('✅ Session started successfully, ID:', conversationId);
      updateStatus('CONNECTED');
      
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      elevenLabsLogger.error('Failed to start ElevenLabs session:', error);
      console.error('🔴 Failed to start ElevenLabs session:', error);
      callbacksRef.current.onError?.(`Connection failed: ${errorMessage}`, error);
      updateStatus('DISCONNECTED');
      throw error;
    }
  }, [conversation, updateStatus]);

  const disconnect = useCallback(async () => {
    elevenLabsLogger.info('Disconnecting ElevenLabs session...');
    try {
      await conversation.endSession();
    } catch (error) {
      elevenLabsLogger.warn('Error ending session:', error);
    }
    conversationIdRef.current = null;
    agentIdRef.current = null;
    updateStatus('DISCONNECTED');
    elevenLabsLogger.info('Disconnected');
  }, [conversation, updateStatus]);

  const sendMessage = useCallback((message: unknown) => {
    elevenLabsLogger.debug('sendMessage called (ElevenLabs uses sendUserMessage instead)');
    if (typeof message === 'object' && message !== null && 'text' in message) {
      conversation.sendUserMessage((message as { text: string }).text);
    }
  }, [conversation]);

  const sendUserMessage = useCallback((text: string) => {
    elevenLabsLogger.debug('Sending user message:', text);
    conversation.sendUserMessage(text);
  }, [conversation]);

  const sendContextualUpdate = useCallback((text: string) => {
    elevenLabsLogger.debug('Sending contextual update:', text);
    conversation.sendContextualUpdate(text);
  }, [conversation]);

  const setMicMuted = useCallback((muted: boolean) => {
    elevenLabsLogger.debug(`Setting mic muted: ${muted}`);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendMessage,
    setMicMuted,
    sendUserMessage,
    sendContextualUpdate,
    isSpeaking: conversation.isSpeaking,
    getInputVolume: conversation.getInputVolume,
    getOutputVolume: conversation.getOutputVolume,
  };
}
