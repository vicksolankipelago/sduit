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
  // Client tools must be passed at hook initialization, not at connect time
  clientTools?: Record<string, (params: any) => Promise<any> | any>;
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
  // Note: clientTools are now passed via ElevenLabsSessionCallbacks at hook initialization
  // Dynamic variables to inject into the agent's prompt
  dynamicVariables?: Record<string, string>;
  // Override the agent's system prompt (must be enabled in ElevenLabs dashboard Security settings)
  promptOverride?: string;
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

  // Client tools must be defined at hook initialization for ElevenLabs SDK
  const rawClientTools = callbacks.clientTools;
  
  // Wrap client tools with logging to debug tool invocations
  const clientTools = rawClientTools ? Object.fromEntries(
    Object.entries(rawClientTools).map(([name, handler]) => [
      name,
      async (params: any) => {
        console.log(`🔧 [CLIENT TOOL CALLED] ${name}`, params);
        elevenLabsLogger.info(`Client tool called: ${name}`, params);
        try {
          const result = await handler(params);
          console.log(`🔧 [CLIENT TOOL RESULT] ${name}:`, result);
          return result;
        } catch (error) {
          console.error(`🔧 [CLIENT TOOL ERROR] ${name}:`, error);
          throw error;
        }
      }
    ])
  ) : undefined;
  
  // Debug: Log client tools at initialization
  // NOTE: Client tools are configured in ElevenLabs dashboard, not passed here
  // Passing clientTools via SDK was causing connection issues
  console.log('🔧 ElevenLabs useConversation init - clientTools from callbacks:', 
    clientTools ? Object.keys(clientTools) : 'none',
    '(will use dashboard config, not SDK clientTools)');
  
  const conversation = useConversation({
    // IMPORTANT: Do NOT pass clientTools here - it causes connection issues!
    // Client tools must be configured in the ElevenLabs dashboard instead.
    // The callback clientTools are only used for local handlers (dispatching events, etc.)
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
    // Note: clientTools removed - passing empty object caused connection issues
    // Client tools should be configured in the ElevenLabs dashboard instead
  });

  const connect = useCallback(async (options: ElevenLabsConnectOptions) => {
    console.log('🚀 ElevenLabs connect() called with options:', {
      hasAgentId: !!options.elevenLabsAgentId,
      agentId: options.elevenLabsAgentId,
      hasPromptOverride: !!options.promptOverride,
      promptOverrideLength: options.promptOverride?.length,
      hasDynamicVars: !!options.dynamicVariables,
      dynamicVarKeys: options.dynamicVariables ? Object.keys(options.dynamicVariables) : [],
    });
    
    const agentId = options.elevenLabsAgentId;
    
    if (!agentId) {
      console.error('🔴 ElevenLabs Agent ID is missing!');
      elevenLabsLogger.error('ElevenLabs Agent ID is required');
      throw new Error('ElevenLabs Agent ID is required. Please configure it in the flow settings.');
    }

    elevenLabsLogger.info('=== Starting ElevenLabs Connection ===');
    elevenLabsLogger.info('Agent ID:', agentId);
    console.log('🔌 ElevenLabs Agent ID validated:', agentId);
    updateStatus('CONNECTING');

    // NOTE: Do NOT request microphone permission here!
    // The ElevenLabs SDK handles microphone internally via startSession.
    // Requesting it separately causes conflicts and connection failures.

    try {
      // Use simple connection like the working test page
      // Let the ElevenLabs agent use its dashboard configuration
      // Only pass dynamic variables if needed for template substitution
      const sessionConfig: any = {
        agentId,
        connectionType: 'webrtc' as const,
      };
      
      // Pass dynamic variables at root level (for {{variable}} substitution in prompts)
      // Note: ElevenLabs SDK expects 'dynamicVariables' at root, NOT 'variables' inside overrides
      if (options.dynamicVariables && Object.keys(options.dynamicVariables).length > 0) {
        sessionConfig.dynamicVariables = options.dynamicVariables;
        elevenLabsLogger.info('Passing dynamic variables:', Object.keys(options.dynamicVariables));
        console.log('🔗 Dynamic variables set:', Object.keys(options.dynamicVariables));
      }
      
      // Pass prompt override if provided (must be enabled in ElevenLabs dashboard Security settings)
      // ElevenLabs may have limits on prompt size, so warn if very large
      const MAX_PROMPT_SIZE = 100000; // 100KB limit to be safe
      if (options.promptOverride) {
        if (options.promptOverride.length > MAX_PROMPT_SIZE) {
          console.warn(`⚠️ Prompt override is very large (${options.promptOverride.length} chars), may cause issues`);
          elevenLabsLogger.warn('Prompt override exceeds recommended size:', options.promptOverride.length);
        }
        sessionConfig.overrides = {
          agent: {
            prompt: {
              prompt: options.promptOverride,
            },
          },
        };
        elevenLabsLogger.info('Passing prompt override:', options.promptOverride.length, 'chars');
        console.log('📝 Prompt override enabled, length:', options.promptOverride.length);
      }
      
      elevenLabsLogger.info('Using direct agentId connection (public agent)');
      console.log('🔌 Using direct agentId connection:', agentId);
      // Log config without the full prompt (which can be very large)
      const configForLog = {
        ...sessionConfig,
        dynamicVariables: sessionConfig.dynamicVariables 
          ? `[${Object.keys(sessionConfig.dynamicVariables).length} vars]` 
          : undefined,
        overrides: sessionConfig.overrides ? {
          agent: sessionConfig.overrides.agent ? {
            prompt: { prompt: `[${sessionConfig.overrides.agent?.prompt?.prompt?.length || 0} chars]` }
          } : undefined,
        } : undefined,
      };
      console.log('🔌 Session config:', JSON.stringify(configForLog, null, 2));

      elevenLabsLogger.info('Starting session with config:', { 
        agentId: sessionConfig.agentId,
        connectionType: sessionConfig.connectionType,
        hasOverrides: !!sessionConfig.overrides,
      });
      console.log('🚀 About to call conversation.startSession...');

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
