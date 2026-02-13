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
 * Authentication: Uses server-issued session auth (signed URL or conversation token)
 * so the ElevenLabs API key stays server-side.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { Conversation } from '@elevenlabs/client';
import { SessionStatus } from '../../types/voiceAgent';
import { logger } from '../../utils/logger';
import { buildElevenLabsOverrides } from './buildElevenLabsOverrides';

const elevenLabsLogger = logger;

const ELEVENLABS_AWS_ENDPOINT = 'https://un4a8jbuha.execute-api.us-east-2.amazonaws.com/prod/ai-voice-intake-call/11labs/session';
const ELEVENLABS_LOCAL_ENDPOINT = '/api/elevenlabs/session';

/**
 * Session auth payload expected by Conversation.startSession().
 * WebSocket mode exposes audio alignment events used by agent word reveal timing.
 */
type ElevenLabsSessionAuth =
  | {
      mode: 'websocket';
      signedUrl: string;
      source: 'local' | 'aws';
    }
  | {
      mode: 'webrtc';
      conversationToken: string;
      source: 'local' | 'aws';
    }
  | {
      mode: 'public';
      agentId: string;
      source: 'local' | 'aws';
    };

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseSessionAuthPayload(
  payload: unknown,
  source: 'local' | 'aws',
  fallbackAgentId: string
): ElevenLabsSessionAuth | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const conversationToken =
    toNonEmptyString(record.conversationToken) ?? toNonEmptyString(record.token);
  if (conversationToken) {
    return { mode: 'webrtc', conversationToken, source };
  }

  const signedUrl = toNonEmptyString(record.signedUrl) ?? toNonEmptyString(record.signed_url);
  if (signedUrl) {
    return { mode: 'websocket', signedUrl, source };
  }

  if (record.publicAgent === true) {
    const publicAgentId = toNonEmptyString(record.agentId) ?? fallbackAgentId;
    return { mode: 'public', agentId: publicAgentId, source };
  }

  return null;
}

async function fetchSessionAuthFromUrl(
  url: string,
  source: 'local' | 'aws',
  agentId: string
): Promise<ElevenLabsSessionAuth | null> {
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return parseSessionAuthPayload(payload, source, agentId);
}

function isUsableSessionAuth(auth: ElevenLabsSessionAuth | null): auth is ElevenLabsSessionAuth {
  return auth !== null;
}

/**
 * Fetches ElevenLabs session auth.
 * Prefers WebRTC auth for voice quality/latency, but still accepts
 * websocket auth when that is what the session endpoint returns.
 */
async function fetchElevenLabsSessionAuth(agentId: string): Promise<ElevenLabsSessionAuth> {
  const localPreferredUrl = `${ELEVENLABS_LOCAL_ENDPOINT}?agentId=${encodeURIComponent(agentId)}&transport=webrtc`;
  console.log('🔑 Fetching ElevenLabs session auth from local server (prefer WebRTC):', localPreferredUrl);

  try {
    const localPreferredAuth = await fetchSessionAuthFromUrl(localPreferredUrl, 'local', agentId);
    if (isUsableSessionAuth(localPreferredAuth)) {
      console.log('🔑 Session auth received from local server:', localPreferredAuth.mode);
      return localPreferredAuth;
    }
    console.warn('🔑 Local preferred WebRTC auth did not return usable session auth');
  } catch (err) {
    console.warn('🔑 Local preferred WebRTC request failed:', err);
  }

  const awsUrl = `${ELEVENLABS_AWS_ENDPOINT}/${agentId}?transport=webrtc`;
  console.log('🔑 Fetching ElevenLabs session auth from AWS endpoint:', awsUrl);

  try {
    const awsAuth = await fetchSessionAuthFromUrl(awsUrl, 'aws', agentId);
    if (isUsableSessionAuth(awsAuth)) {
      console.log('🔑 Session auth received from AWS endpoint:', awsAuth.mode);
      return awsAuth;
    }
    console.warn('🔑 AWS endpoint did not return usable session auth');
  } catch (err) {
    console.warn('🔑 AWS endpoint request failed:', err);
  }

  const localFallbackUrl = `${ELEVENLABS_LOCAL_ENDPOINT}?agentId=${encodeURIComponent(agentId)}`;
  console.log('🔑 Retrying ElevenLabs session auth from local server (any transport):', localFallbackUrl);
  const localFallbackResponse = await fetch(localFallbackUrl);
  if (!localFallbackResponse.ok) {
    const errorText = await localFallbackResponse.text();
    throw new Error(`Failed to fetch ElevenLabs session auth: ${localFallbackResponse.status} - ${errorText}`);
  }

  const localFallbackPayload = await localFallbackResponse.json();
  const localFallbackAuth = parseSessionAuthPayload(localFallbackPayload, 'local', agentId);
  if (!isUsableSessionAuth(localFallbackAuth)) {
    throw new Error('Session endpoint did not return a usable signed URL, conversation token, or public agent configuration');
  }

  console.log('🔑 Session auth received from local server (fallback):', localFallbackAuth.mode);
  return localFallbackAuth;
}

export interface ElevenLabsSessionCallbacks {
  customPrompts?: Record<string, string>;
  onConnectionChange?: (status: SessionStatus) => void;
  onTranscript?: (role: string, text: string, isDone?: boolean) => void;
  onAudioAlignment?: (alignment: unknown) => void;
  onEvent?: (event: any) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onConversationComplete?: () => void;
  onModeChange?: (mode: 'speaking' | 'listening') => void;
  onVadScore?: (vadScore: number) => void;
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
    const wrapped = Object.fromEntries(
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

    const normalizeNavigateToResponse = (params: any, rawResult: any) => {
      const screen = params?.screen ?? params?.screen_id ?? null;
      const eventId = params?.eventId ?? params?.event_id ?? null;
      const resultObject = rawResult && typeof rawResult === 'object' && !Array.isArray(rawResult)
        ? rawResult as Record<string, any>
        : null;

      const success = resultObject
        ? (resultObject.success ?? true)
        : true;
      const nextScreen = resultObject?.next_screen ?? screen;
      const currentScreen = resultObject?.current_screen ?? nextScreen;
      const reason = resultObject?.reason ?? (success ? 'navigation_triggered' : 'navigation_failed');
      const message = typeof resultObject?.message === 'string'
        ? resultObject.message
        : success
          ? `Navigation to "${nextScreen ?? 'unknown'}" triggered.`
          : `Navigation to "${nextScreen ?? 'unknown'}" failed.`;

      return {
        success,
        event_id: resultObject?.event_id ?? eventId,
        from_screen: resultObject?.from_screen ?? null,
        next_screen: nextScreen,
        current_screen: currentScreen,
        delay_seconds: resultObject?.delay_seconds ?? 0,
        reason,
        message,
      };
    };

    // Backward-compat aliasing:
    // If the dashboard uses `navigate_to` but runtime only exposes `navigate_to_screen`,
    // register `navigate_to` as an alias so ElevenLabs doesn't report "unhandled".
    const wrappedRecord = wrapped as Record<string, (params: any) => Promise<any> | any>;
    if (!wrappedRecord.navigate_to) {
      if (wrappedRecord.navigate_to_screen) {
        wrappedRecord.navigate_to = async (params: any) => {
          const screen = params?.screen ?? params?.screen_id;
          const result = await wrappedRecord.navigate_to_screen({ screen_id: screen });
          return normalizeNavigateToResponse(params, result);
        };
      } else if (wrappedRecord.trigger_event) {
        // Last-resort compatibility: allow event-style usage if provided by the model.
        wrappedRecord.navigate_to = async (params: any) => {
          const eventId = params?.eventId ?? params?.event_id;
          if (!eventId) {
            return {
              success: false,
              event_id: null,
              from_screen: null,
              next_screen: params?.screen ?? params?.screen_id ?? null,
              current_screen: null,
              delay_seconds: 0,
              reason: 'missing_event_id',
              message: 'navigate_to fallback requires eventId when trigger_event is used as compatibility mode.',
            };
          }

          const result = await wrappedRecord.trigger_event({ eventId, delay: params?.delay });
          return normalizeNavigateToResponse(params, result);
        };
      } else {
        // Ensure navigate_to is always registered so the SDK never emits
        // unhandled_client_tool_call for this tool name.
        wrappedRecord.navigate_to = async (params: any) => normalizeNavigateToResponse(params, {
          success: false,
          event_id: null,
          from_screen: null,
          next_screen: params?.screen ?? params?.screen_id ?? null,
          current_screen: null,
          delay_seconds: 0,
          reason: 'navigate_to_not_configured',
          message: 'navigate_to is not configured in client tools.',
        });
      }
    }

    // Normalize navigate_to responses consistently (including native handlers)
    // so ElevenLabs assignment paths like response.current_screen are stable.
    if (wrappedRecord.navigate_to) {
      const originalNavigateTo = wrappedRecord.navigate_to;
      wrappedRecord.navigate_to = async (params: any) => {
        const result = await originalNavigateTo(params);
        return normalizeNavigateToResponse(params, result);
      };
    }

    return wrappedRecord;
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
      // Fetch server-side session auth (signed URL or token). We prefer websocket
      // when available because it exposes audio alignment timestamps for word sync.
      console.log('🔑 Fetching session auth for agent:', agentId);
      const sessionAuth = await fetchElevenLabsSessionAuth(agentId);
      console.log('🔑 Session auth fetched successfully:', {
        mode: sessionAuth.mode,
        source: sessionAuth.source,
      });

      const sessionConfig: Record<string, any> = {
        // Callbacks for the vanilla SDK
        onConnect: ({ conversationId }: { conversationId: string }) => {
          elevenLabsLogger.info('ElevenLabs conversation connected, ID:', conversationId);
          console.log('✅ ElevenLabs onConnect callback fired, conversationId:', conversationId);
          conversationIdRef.current = conversationId;
          updateStatus('CONNECTED');
        },
        onDisconnect: (details: any) => {
          const reason = (details as any)?.reason || 'unknown';
          const message = (details as any)?.message || '';
          const context = (details as any)?.context;
          elevenLabsLogger.info('ElevenLabs conversation disconnected, reason:', reason);
          console.log('🔌 ElevenLabs onDisconnect - reason:', reason, 'message:', message);
          console.log('🔌 ElevenLabs onDisconnect - full details:', JSON.stringify(details, null, 2));
          if (context) {
            console.log('🔌 ElevenLabs onDisconnect - context type:', context?.type, 'reason:', context?.reason, 'code:', context?.code);
          }
          
          const normalReasons = ['user', 'agent', 'user_ended', 'agent_ended', 'call_ended', 'normal'];
          const isNormalDisconnect = normalReasons.some(r => reason.toLowerCase().includes(r.toLowerCase()));
          if (!isNormalDisconnect) {
            callbacksRef.current.onError?.(`Disconnected (${reason})`, details);
          }
          
          conversationRef.current = null;
          updateStatus('DISCONNECTED');
          callbacksRef.current.onConversationComplete?.();
        },
        onMessage: (message: any) => {
          elevenLabsLogger.debug('ElevenLabs message:', message);
          const msg = message as any;
          console.log('💬 ElevenLabs onMessage:', JSON.stringify({
            source: msg.source,
            role: msg.role,
            type: msg.type,
            message: msg.message?.substring?.(0, 100),
          }));
          if (msg.source === 'user') {
            callbacksRef.current.onTranscript?.('user', msg.message, true);
          } else if (msg.source === 'ai') {
            callbacksRef.current.onTranscript?.('assistant', msg.message, true);
          }
          callbacksRef.current.onEvent?.(message);
        },
        onError: (error: any, errorDetails?: any) => {
          const errorMessage = typeof error === 'string' ? error : ((error as any)?.message || JSON.stringify(error));
          elevenLabsLogger.error('ElevenLabs error:', error);
          console.error('🔴 ElevenLabs SDK onError callback:', error);
          console.error('🔴 ElevenLabs SDK onError details:', errorDetails);
          console.error('🔴 ElevenLabs SDK onError full:', JSON.stringify({ error, errorDetails }, null, 2));
          callbacksRef.current.onError?.(`SDK Error: ${errorMessage}`, error);
          updateStatus('DISCONNECTED');
        },
        onModeChange: (data: any) => {
          const mode = (data as any).mode === 'speaking' ? 'speaking' : 'listening';
          elevenLabsLogger.debug('Mode changed:', mode);
          console.log('🔊 ElevenLabs mode changed:', mode);
          setIsSpeaking(mode === 'speaking');
          callbacksRef.current.onModeChange?.(mode);
        },
        onVadScore: (vadData: any) => {
          const rawScore = Number((vadData as any)?.vadScore ?? 0);
          const normalizedScore = Number.isFinite(rawScore)
            ? Math.max(0, Math.min(rawScore, 1))
            : 0;
          callbacksRef.current.onVadScore?.(normalizedScore);
        },
        onStatusChange: (statusData: any) => {
          elevenLabsLogger.debug('Status changed:', statusData);
          console.log('📊 ElevenLabs onStatusChange:', JSON.stringify(statusData));
        },
        onInterruption: (interruptionData: any) => {
          console.log('⚡ ElevenLabs onInterruption:', JSON.stringify(interruptionData));
          elevenLabsLogger.info('Interruption event:', interruptionData);
          callbacksRef.current.onEvent?.({
            type: 'interruption',
            ...interruptionData,
          });
        },
        onCanSendFeedbackChange: (data: any) => {
          console.log('📋 ElevenLabs onCanSendFeedbackChange:', JSON.stringify(data));
        },
        onAgentToolRequest: (request: any) => {
          elevenLabsLogger.info('Agent tool request:', request);
          console.log('🧰 ElevenLabs onAgentToolRequest:', JSON.stringify(request));
          callbacksRef.current.onEvent?.({
            type: 'agent_tool_request',
            ...request,
          });
        },
        onAgentToolResponse: (response: any) => {
          elevenLabsLogger.info('Agent tool response:', response);
          console.log('🧰 ElevenLabs onAgentToolResponse:', JSON.stringify(response));
          callbacksRef.current.onEvent?.({
            type: 'agent_tool_response',
            ...response,
          });
        },
        onUnhandledClientToolCall: (toolCall: any) => {
          elevenLabsLogger.error('Unhandled client tool call:', toolCall);
          console.error('🔴 ElevenLabs onUnhandledClientToolCall:', JSON.stringify(toolCall));
          callbacksRef.current.onEvent?.({
            type: 'unhandled_client_tool_call',
            ...toolCall,
          });
          callbacksRef.current.onError?.(
            `Unhandled client tool call: ${toolCall.tool_name}`,
            toolCall
          );
        },
        onDebug: (debugData: any) => {
          const eventType = debugData?.type || 'unknown';
          console.log(`🔍 ElevenLabs onDebug [${eventType}]:`, JSON.stringify(debugData, (key, value) => {
            if (key === 'prompt' && typeof value === 'string' && value.length > 200) return value.substring(0, 200) + '...';
            if (key === 'audio_base_64' && typeof value === 'string') return `[audio ${value.length} chars]`;
            return value;
          }));
          if (eventType === 'conversation_initiation_client_data') {
            const msg = debugData.message;
            const hasOverride = !!msg?.conversation_config_override;
            const overridePromptLen = msg?.conversation_config_override?.agent?.prompt?.prompt?.length || 0;
            const hasDynVars = !!msg?.dynamic_variables;
            console.log('🔍 SDK INIT: override=' + hasOverride + ', promptLen=' + overridePromptLen + ', dynVars=' + hasDynVars);
            elevenLabsLogger.info('🔍 SDK INITIATION DATA: hasOverride=' + hasOverride + ', promptLen=' + overridePromptLen + ', hasDynVars=' + hasDynVars);
          }
          if (eventType === 'agent_response' || eventType === 'agent_response_correction') {
            console.log('🤖 ElevenLabs agent response event:', eventType);
          }
          if (eventType === 'user_transcript' || eventType === 'user_transcription') {
            console.log('👤 ElevenLabs user transcript event:', eventType);
          }
          if (eventType === 'conversation_metadata' || eventType === 'config') {
            console.log('⚙️ ElevenLabs config/metadata event:', JSON.stringify(debugData));
          }
          if (eventType === 'tentative_agent_response') {
            console.log('💭 ElevenLabs tentative response:', debugData?.response?.substring?.(0, 100));
          }
          if (eventType === 'audio_element_ready') {
            console.log('🔈 ElevenLabs audio element ready');
          }
          if (eventType === 'parsing_error') {
            console.error('🔴 ElevenLabs parsing error:', debugData?.message, debugData?.error);
          }
          callbacksRef.current.onEvent?.({
            type: 'debug_' + eventType,
            ...debugData,
          });
        },
      };

      if (sessionAuth.mode === 'websocket') {
        (sessionConfig as any).signedUrl = sessionAuth.signedUrl;
        (sessionConfig as any).connectionType = 'websocket';
      } else if (sessionAuth.mode === 'webrtc') {
        (sessionConfig as any).conversationToken = sessionAuth.conversationToken;
        (sessionConfig as any).connectionType = 'webrtc';
      } else {
        (sessionConfig as any).agentId = sessionAuth.agentId;
        (sessionConfig as any).connectionType = 'webrtc';
      }

      if (callbacksRef.current.onAudioAlignment) {
        (sessionConfig as any).onAudioAlignment = (alignment: unknown) => {
          callbacksRef.current.onAudioAlignment?.(alignment);
        };
      }
      
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
        authMode: sessionAuth.mode,
        authSource: sessionAuth.source,
        hasConversationToken: !!(sessionConfig as any).conversationToken,
        hasSignedUrl: !!(sessionConfig as any).signedUrl,
        connectionType: sessionConfig.connectionType,
        hasDynamicVariables: !!(sessionConfig as any).dynamicVariables,
        hasOverrides: !!(sessionConfig as any).overrides,
        overridePromptLength: (sessionConfig as any).overrides?.agent?.prompt?.prompt?.length || 0,
        overrideVoiceId: (sessionConfig as any).overrides?.tts?.voiceId || null,
        hasClientTools: !!wrappedTools,
        clientToolNames: wrappedTools ? Object.keys(wrappedTools) : [],
      };
      console.log('🔌 Session config (vanilla SDK):', JSON.stringify(configForLog, null, 2));
      console.log(`🚀 About to call Conversation.startSession using ${sessionConfig.connectionType} transport...`);

      // Use the vanilla SDK's Conversation.startSession()
      const conversation = await Conversation.startSession(
        sessionConfig as Parameters<typeof Conversation.startSession>[0]
      );
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
