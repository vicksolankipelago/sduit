/**
 * ElevenLabs Session Hook
 * 
 * Manages voice sessions with ElevenLabs Conversational AI
 * Uses the vanilla @elevenlabs/client SDK directly (not the React hook)
 * to support dynamic prompt overrides at runtime.
 * 
 * The React useConversation hook only accepts overrides at initialization time,
 * but we need to pass dynamic prompts based on journeys loaded at runtime.
 * 
 * Authentication: Uses secure token-based auth via AWS API Gateway.
 * The token endpoint generates conversation tokens server-side, keeping
 * the ElevenLabs API key secure.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Conversation } from '@elevenlabs/client';
import { SessionStatus } from '../../types/voiceAgent';
import { logger } from '../../utils/logger';
import { buildElevenLabsOverrides } from './buildElevenLabsOverrides';

const elevenLabsLogger = logger;

// AWS API Gateway endpoint for ElevenLabs session tokens
const ELEVENLABS_TOKEN_ENDPOINT = 'https://un4a8jbuha.execute-api.us-east-2.amazonaws.com/prod/ai-voice-agent/11labs/session';

/**
 * Fetches a conversation token from the secure AWS endpoint
 * This keeps the ElevenLabs API key on the server side
 */
async function fetchConversationToken(agentId: string): Promise<string> {
  const url = `${ELEVENLABS_TOKEN_ENDPOINT}/${agentId}`;
  console.log('🔑 Fetching conversation token from:', url);
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch conversation token: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  if (!data.token) {
    throw new Error('Token endpoint did not return a token');
  }
  
  console.log('🔑 Conversation token received successfully');
  return data.token;
}

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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const agentIdRef = useRef<string | null>(null);
  const callbacksRef = useRef(callbacks);
  // Store the conversation instance for the vanilla SDK
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);

  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const updateStatus = useCallback((s: SessionStatus) => {
    setStatus(s);
    callbacksRef.current.onConnectionChange?.(s);
  }, []);

  // Client tools - wrapped with logging for debugging
  const rawClientTools = callbacks.clientTools;
  const clientToolsRef = useRef(rawClientTools);
  useEffect(() => {
    clientToolsRef.current = rawClientTools;
  }, [rawClientTools]);
  
  // Create wrapped client tools with logging
  const getWrappedClientTools = useCallback(() => {
    const raw = clientToolsRef.current;
    if (!raw) return undefined;
    
    return Object.fromEntries(
      Object.entries(raw).map(([name, handler]) => [
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
    );
  }, []);
  
  console.log('🔧 ElevenLabs hook init - using vanilla SDK for dynamic overrides');

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

    elevenLabsLogger.info('=== Starting ElevenLabs Connection (Vanilla SDK) ===');
    elevenLabsLogger.info('Agent ID:', agentId);
    console.log('🔌 ElevenLabs Agent ID validated:', agentId);
    updateStatus('CONNECTING');

    try {
      // Fetch conversation token from secure AWS endpoint
      // This keeps the ElevenLabs API key server-side for security
      console.log('🔑 Fetching conversation token for agent:', agentId);
      const conversationToken = await fetchConversationToken(agentId);
      console.log('🔑 Token fetched successfully, starting session...');
      
      // Build session config for the vanilla SDK using conversationToken (private WebRTC mode)
      // This is more secure than using agentId directly (public mode)
      const sessionConfig: Parameters<typeof Conversation.startSession>[0] = {
        conversationToken,
        connectionType: 'webrtc',
        // Callbacks for the vanilla SDK
        onConnect: ({ conversationId }) => {
          elevenLabsLogger.info('ElevenLabs conversation connected, ID:', conversationId);
          console.log('✅ ElevenLabs onConnect callback fired, conversationId:', conversationId);
          conversationIdRef.current = conversationId;
          updateStatus('CONNECTED');
        },
        onDisconnect: (details) => {
          const reason = (details as any)?.reason || 'unknown';
          elevenLabsLogger.info('ElevenLabs conversation disconnected, reason:', reason);
          console.log('🔌 ElevenLabs onDisconnect - reason:', reason);
          
          const normalReasons = ['user', 'agent', 'user_ended', 'agent_ended', 'call_ended', 'normal'];
          const isNormalDisconnect = normalReasons.some(r => reason.toLowerCase().includes(r.toLowerCase()));
          if (!isNormalDisconnect) {
            callbacksRef.current.onError?.(`Disconnected (${reason})`, details);
          }
          
          conversationRef.current = null;
          updateStatus('DISCONNECTED');
          callbacksRef.current.onConversationComplete?.();
        },
        onMessage: (message) => {
          elevenLabsLogger.debug('ElevenLabs message:', message);
          const msg = message as any;
          console.log('💬 ElevenLabs message:', msg.source, msg.message?.substring?.(0, 50));
          if (msg.source === 'user') {
            callbacksRef.current.onTranscript?.('user', msg.message, true);
          } else if (msg.source === 'ai') {
            callbacksRef.current.onTranscript?.('assistant', msg.message, true);
          }
          callbacksRef.current.onEvent?.(message);
        },
        onError: (error) => {
          const errorMessage = typeof error === 'string' ? error : ((error as any)?.message || JSON.stringify(error));
          elevenLabsLogger.error('ElevenLabs error:', error);
          console.error('🔴 ElevenLabs SDK onError callback:', error);
          callbacksRef.current.onError?.(`SDK Error: ${errorMessage}`, error);
          updateStatus('DISCONNECTED');
        },
        onModeChange: (data) => {
          const mode = (data as any).mode === 'speaking' ? 'speaking' : 'listening';
          elevenLabsLogger.debug('Mode changed:', mode);
          console.log('🔊 ElevenLabs mode changed:', mode);
          setIsSpeaking(mode === 'speaking');
          callbacksRef.current.onModeChange?.(mode);
        },
        onStatusChange: (statusData) => {
          elevenLabsLogger.debug('Status changed:', statusData);
          console.log('📊 ElevenLabs status changed:', (statusData as any).status);
        },
      };
      
      // Pass dynamic variables at root level (for {{variable}} substitution in prompts)
      if (options.dynamicVariables && Object.keys(options.dynamicVariables).length > 0) {
        (sessionConfig as any).dynamicVariables = options.dynamicVariables;
        elevenLabsLogger.info('Passing dynamic variables:', Object.keys(options.dynamicVariables));
        console.log('🔗 Dynamic variables set:', Object.keys(options.dynamicVariables));
      }
      
      // Pass prompt and/or voice overrides if provided
      // The vanilla SDK supports overrides directly in startSession()!
      const overrides = buildElevenLabsOverrides({
        promptOverride: options.promptOverride,
        elevenLabsVoiceId: options.elevenLabsVoiceId,
      });

      if (overrides) {
        if (options.promptOverride) {
          console.log('📝 Prompt override requested, length:', options.promptOverride.length, 'chars');
          console.log('📝 First 200 chars:', options.promptOverride.substring(0, 200));
          elevenLabsLogger.info('Prompt override enabled:', options.promptOverride.length, 'chars');
        }
        if (options.elevenLabsVoiceId) {
          console.log('🎙️ Voice override requested:', options.elevenLabsVoiceId);
          elevenLabsLogger.info('Voice override enabled:', options.elevenLabsVoiceId);
        }

        (sessionConfig as any).overrides = overrides;
        console.log('📋 Final overrides structure:', JSON.stringify(overrides, (key, value) => key === 'prompt' && typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value, 2));
        elevenLabsLogger.info('🔄 OVERRIDE SENT TO ELEVENLABS - prompt length:', options.promptOverride?.length, 'chars');
      }
      
      // Pass client tools if provided (wrapped with logging)
      const wrappedTools = getWrappedClientTools();
      if (wrappedTools) {
        (sessionConfig as any).clientTools = wrappedTools;
        elevenLabsLogger.info('Client tools registered:', Object.keys(wrappedTools));
        console.log('🔧 Client tools registered:', Object.keys(wrappedTools));
      }

      // Log config without the full prompt or token
      const configForLog = {
        agentId: agentId,
        hasConversationToken: !!conversationToken,
        connectionType: sessionConfig.connectionType,
        hasDynamicVariables: !!(sessionConfig as any).dynamicVariables,
        hasOverrides: !!(sessionConfig as any).overrides,
        overridePromptLength: (sessionConfig as any).overrides?.agent?.prompt?.prompt?.length || 0,
        overrideVoiceId: (sessionConfig as any).overrides?.agent?.tts?.voiceId || null,
        hasClientTools: !!wrappedTools,
        clientToolNames: wrappedTools ? Object.keys(wrappedTools) : [],
      };
      console.log('🔌 Session config (vanilla SDK, token auth):', JSON.stringify(configForLog, null, 2));
      console.log('🚀 About to call Conversation.startSession with conversationToken...');

      // Use the vanilla SDK's Conversation.startSession()
      const conversation = await Conversation.startSession(sessionConfig);
      conversationRef.current = conversation;
      agentIdRef.current = agentId;
      
      console.log('✅ Conversation.startSession returned successfully');
      elevenLabsLogger.info('Session started with vanilla SDK');
      
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      elevenLabsLogger.error('Failed to start ElevenLabs session:', error);
      console.error('🔴 Failed to start ElevenLabs session:', error);
      console.error('🔴 Error details:', error);
      callbacksRef.current.onError?.(`Connection failed: ${errorMessage}`, error);
      updateStatus('DISCONNECTED');
      throw error;
    }
  }, [updateStatus]);

  const disconnect = useCallback(async () => {
    elevenLabsLogger.info('Disconnecting ElevenLabs session...');
    try {
      if (conversationRef.current) {
        await conversationRef.current.endSession();
      }
    } catch (error) {
      elevenLabsLogger.warn('Error ending session:', error);
    }
    conversationRef.current = null;
    conversationIdRef.current = null;
    agentIdRef.current = null;
    updateStatus('DISCONNECTED');
    elevenLabsLogger.info('Disconnected');
  }, [updateStatus]);

  const sendMessage = useCallback((message: unknown) => {
    elevenLabsLogger.debug('sendMessage called (ElevenLabs uses sendUserMessage instead)');
    if (conversationRef.current && typeof message === 'object' && message !== null && 'text' in message) {
      conversationRef.current.sendUserMessage((message as { text: string }).text);
    }
  }, []);

  const sendUserMessage = useCallback((text: string) => {
    elevenLabsLogger.debug('Sending user message:', text);
    if (conversationRef.current) {
      conversationRef.current.sendUserMessage(text);
    }
  }, []);

  const sendContextualUpdate = useCallback((text: string) => {
    elevenLabsLogger.debug('Sending contextual update:', text);
    if (conversationRef.current) {
      conversationRef.current.sendContextualUpdate(text);
    }
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    elevenLabsLogger.debug(`Setting mic muted: ${muted}`);
    if (conversationRef.current) {
      conversationRef.current.setMicMuted(muted);
    }
  }, []);

  const getInputVolume = useCallback(() => {
    return conversationRef.current?.getInputVolume?.() ?? 0;
  }, []);

  const getOutputVolume = useCallback(() => {
    return conversationRef.current?.getOutputVolume?.() ?? 0;
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendMessage,
    setMicMuted,
    sendUserMessage,
    sendContextualUpdate,
    isSpeaking,
    getInputVolume,
    getOutputVolume,
  };
}
