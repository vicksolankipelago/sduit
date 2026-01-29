import { useCallback, useRef, useState } from 'react';
import { SessionStatus } from '../../types/voiceAgent';
import { voiceAgentLogger } from '../../utils/logger';
import {
  getInitialAgent,
  getNextAgent,
  executeTool,
  createSessionUpdate,
  type ToolContext,
  type AzureAgentConfig,
} from '../../config/voiceAgent/azureAgentAdapter';

export interface AzureWebRTCSessionCallbacks {
  customPrompts?: Record<string, string>;
  onConnectionChange?: (status: SessionStatus) => void;
  onTranscript?: (role: string, text: string, isDone?: boolean) => void;
  onEvent?: (event: any) => void;
  onAgentHandoff?: (fromAgent: string, toAgent: string) => void;
  onToolCall?: (toolName: string, args: any, result: any) => void;
  onConversationComplete?: () => void; // Callback for full conversation end (agent + persona)
}

export interface AzureWebRTCConnectOptions {
  audioElement?: HTMLAudioElement;
  customInstructions?: string; // Override default agent instructions (e.g., for persona)
  skipInitialGreeting?: boolean; // Skip auto-greeting (useful for persona)
  voice?: string; // Voice to use (e.g., 'alloy', 'echo', 'shimmer', 'sage')
  customMicStream?: MediaStream; // Custom microphone stream (for routing agent audio to persona)
  agentConfig?: { name: string; instructions: string; voice: string; tools?: any[]; handoffs?: string[] }; // Journey agent configuration
  allJourneyAgents?: Map<string, { name: string; instructions: string; voice: string; handoffs?: string[] }>; // All agents in journey for handoffs
  onEventTrigger?: (eventId: string, agentName: string) => void; // Callback for trigger_event tool
  onEndCall?: (reason?: string) => void; // Callback for end_call system tool
}

export function useAzureWebRTCSession(callbacks: AzureWebRTCSessionCallbacks = {}) {
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null); // Store microphone stream for cleanup
  const [status, setStatus] = useState<SessionStatus>('DISCONNECTED');
  const currentAgentRef = useRef<string>('greeter');
  const lastToolCalledRef = useRef<string | undefined>(undefined);
  const isAssistantSpeakingRef = useRef<boolean>(false);
  const journeyAgentsMapRef = useRef<Map<string, any>>(new Map()); // Store journey agents for handoffs

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
    },
    [callbacks.onConnectionChange],
  );

  const connect = useCallback(
    async ({ audioElement, customInstructions, skipInitialGreeting, voice, customMicStream, agentConfig, allJourneyAgents, onEventTrigger, onEndCall }: AzureWebRTCConnectOptions) => {
      if (peerConnectionRef.current) {
        voiceAgentLogger.warn('Already connected, skipping');
        return;
      }

      voiceAgentLogger.info('=== Starting WebRTC Connection ===');
      voiceAgentLogger.info('Starting WebRTC connection to Azure OpenAI...');
      updateStatus('CONNECTING');

      try {
        // Step 1: Get ephemeral key from our server
        voiceAgentLogger.info('Step 1: Fetching ephemeral key from /api/session...');
        const sessionResponse = await fetch('/api/session');
        
        voiceAgentLogger.info('Session response status:', sessionResponse.status, sessionResponse.statusText);
        
        if (!sessionResponse.ok) {
          const errorBody = await sessionResponse.text();
          voiceAgentLogger.error('=== Session Fetch Failed ===');
          voiceAgentLogger.error('Status:', sessionResponse.status);
          voiceAgentLogger.error('Response body:', errorBody);
          throw new Error(`Failed to get session: ${sessionResponse.statusText}. Details: ${errorBody}`);
        }
        
        const sessionData = await sessionResponse.json();
        voiceAgentLogger.info('Session data received:', {
          hasClientSecret: !!sessionData.client_secret,
          hasWebrtcUrl: !!sessionData.webrtcUrl,
          deployment: sessionData.deployment,
          region: sessionData.region,
          sessionId: sessionData.id,
          expiresAt: sessionData.expires_at,
        });
        
        const ephemeralKey = sessionData.client_secret?.value;
        const webrtcUrl = sessionData.webrtcUrl;
        const deployment = sessionData.deployment;
        
        if (!ephemeralKey || !webrtcUrl) {
          voiceAgentLogger.error('=== Invalid Session Data ===');
          voiceAgentLogger.error('ephemeralKey present:', !!ephemeralKey);
          voiceAgentLogger.error('webrtcUrl present:', !!webrtcUrl);
          voiceAgentLogger.error('Full sessionData:', JSON.stringify(sessionData));
          throw new Error('Invalid session data from server');
        }
        
        voiceAgentLogger.info('Ephemeral key received (length:', ephemeralKey.length, ')');
        voiceAgentLogger.info('WebRTC URL:', webrtcUrl);
        voiceAgentLogger.info('Deployment:', deployment);

        // Step 2: Create RTCPeerConnection
        voiceAgentLogger.debug('Creating RTCPeerConnection...');
        const peerConnection = new RTCPeerConnection();
        peerConnectionRef.current = peerConnection;

        // Step 3: Set up audio element for receiving model's voice
        if (audioElement) {
          peerConnection.ontrack = (event) => {
            voiceAgentLogger.debug('Received audio track from model');
            audioElement.srcObject = event.streams[0];
          };
        }

        // Step 4: Add user's microphone (or custom stream for persona)
        voiceAgentLogger.debug('Requesting microphone access...');
        const stream = customMicStream || await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000,
          }
        });
        // Store stream ref for cleanup (only if we own it, not custom)
        if (!customMicStream) {
          micStreamRef.current = stream;
          voiceAgentLogger.debug('Using microphone with echo cancellation enabled');
        } else {
          voiceAgentLogger.debug('Using custom audio stream (routed from agent)');
        }
        const audioTrack = stream.getAudioTracks()[0];
        peerConnection.addTrack(audioTrack, stream);
        voiceAgentLogger.debug('Microphone added to peer connection');

        // Step 5: Create data channel for events
        voiceAgentLogger.debug('Creating data channel...');
        const dataChannel = peerConnection.createDataChannel('oai-events');
        dataChannelRef.current = dataChannel;

        dataChannel.addEventListener('open', () => {
          voiceAgentLogger.info('Data channel opened');
          updateStatus('CONNECTED');
          
          // Initialize with journey agent if provided, otherwise use default greeter agent
          let initialAgent: AzureAgentConfig = agentConfig 
            ? { ...agentConfig, tools: agentConfig.tools || [], handoffs: agentConfig.handoffs || [] }
            : getInitialAgent();
          
          // Store all journey agents for handoff support
          if (allJourneyAgents) {
            journeyAgentsMapRef.current = allJourneyAgents;
            voiceAgentLogger.info(`Journey Mode: Loaded ${allJourneyAgents.size} agent(s) with screen support`);
          } else {
            journeyAgentsMapRef.current.clear();
            voiceAgentLogger.debug('Multi-Agent Mode: Using legacy handoff system');
          }
          
          // Apply custom prompt if provided (for non-journey agents)
          if (!agentConfig && callbacks.customPrompts && callbacks.customPrompts[initialAgent.name]) {
            voiceAgentLogger.debug('Using custom prompt for', initialAgent.name);
            initialAgent = {
              ...initialAgent,
              instructions: callbacks.customPrompts[initialAgent.name]
            };
          }
          
          currentAgentRef.current = initialAgent.name;
          
          // Use custom instructions if provided (for persona), otherwise use agent config
          let agentToUse = initialAgent;
          if (customInstructions) {
            voiceAgentLogger.debug('Using custom instructions for this session');
            agentToUse = {
              ...initialAgent,
              instructions: customInstructions
            };
          }
          
          const sessionConfig = createSessionUpdate(agentToUse, undefined, voice);
          
          voiceAgentLogger.debug('Sending initial session configuration for agent:', initialAgent.name);
          const instructionsStr = typeof agentToUse.instructions === 'string' ? agentToUse.instructions : '';
          voiceAgentLogger.debug('Agent instructions preview:', instructionsStr.substring(0, 200) + '...');
          if (voice) {
            voiceAgentLogger.debug('Using voice:', voice);
          }
          dataChannel.send(JSON.stringify(sessionConfig));
          
          // Notify about initial agent
          callbacks.onEvent?.({ 
            type: 'agent_initialized', 
            agentName: initialAgent.name 
          });
          
          // Trigger agent to greet the user first (unless disabled, e.g., for persona)
          if (!skipInitialGreeting) {
            voiceAgentLogger.debug('Triggering initial agent greeting...');
            setTimeout(() => {
              if (dataChannel.readyState === 'open') {
                dataChannel.send(JSON.stringify({
                  type: 'response.create'
                }));
                voiceAgentLogger.debug('Initial response triggered');
              }
            }, 1000);
          } else {
            voiceAgentLogger.debug('Skipping initial greeting (persona mode)');
          }
        });

        // Store conversation context for tool detection
        const conversationContextRef = {
          lastUserMessage: '',
          lastAssistantMessage: ''
        };
        
        // Track if baseline agent has given closing statement
        let baselineAgentHasCompletedRef = false;
        let pendingDisconnectRef = false; // Flag for when we're waiting for audio to finish
        let pendingEndCallReason: string | undefined = undefined; // Reason for end_call if pending
        
        dataChannel.addEventListener('message', async (event) => {
          try {
            const realtimeEvent = JSON.parse(event.data);
            voiceAgentLogger.debug('Received event:', realtimeEvent.type);
            
            callbacks.onEvent?.(realtimeEvent);
            
            // Handle transcripts and build conversation context
            if (realtimeEvent.type === 'conversation.item.input_audio_transcription.completed') {
              conversationContextRef.lastUserMessage = realtimeEvent.transcript;
              callbacks.onTranscript?.('user', realtimeEvent.transcript, true);
            } 
            // Track when assistant starts speaking
            else if (realtimeEvent.type === 'response.audio_transcript.delta') {
              isAssistantSpeakingRef.current = true;
              conversationContextRef.lastAssistantMessage += realtimeEvent.delta;
              callbacks.onTranscript?.('assistant', realtimeEvent.delta, false);
            }
            // Track when assistant response is complete
            else if (realtimeEvent.type === 'response.audio_transcript.done') {
              if (isAssistantSpeakingRef.current) {
                callbacks.onTranscript?.('assistant', '', true); // Signal completion
                isAssistantSpeakingRef.current = false;
                
                // If we're waiting to disconnect after conversation completion, do it now
                if (pendingDisconnectRef) {
                  voiceAgentLogger.debug('Audio finished - now disconnecting');
                  pendingDisconnectRef = false;
                  
                  // Small delay to ensure audio fully finishes playing
                  setTimeout(() => {
                    // Check if this was triggered by end_call tool (pendingEndCallReason is set to a string)
                    if (pendingEndCallReason !== undefined) {
                      if (onEndCall) {
                        voiceAgentLogger.debug('Executing end call callback after audio completion...');
                        onEndCall(pendingEndCallReason || undefined);
                      } else {
                        voiceAgentLogger.debug('No end call callback - disconnecting directly');
                        disconnect();
                      }
                      pendingEndCallReason = undefined;
                    } else if (callbacks.onConversationComplete) {
                      callbacks.onConversationComplete();
                    } else {
                      disconnect();
                    }
                  }, 1000); // Just 1 second buffer after audio transcript done
                }
              }
            }
            
            // Handle function calls from Azure
            else if (realtimeEvent.type === 'response.function_call_arguments.done') {
              const { call_id, name, arguments: argsString } = realtimeEvent;
              voiceAgentLogger.debug(`Function call from Azure: ${name}`, { call_id });
              
              try {
                const args = JSON.parse(argsString);
                voiceAgentLogger.debug('Args:', args);
                
                // Execute trigger_event tool for screen navigation
                if (name === 'trigger_event' && args.eventId) {
                  const { eventId, delay: rawDelay } = args;
                  
                  // Parse delay robustly
                  let delay = 0;
                  if (typeof rawDelay === 'number') {
                    delay = rawDelay;
                  } else if (typeof rawDelay === 'string') {
                    delay = parseFloat(rawDelay);
                    if (isNaN(delay)) delay = 0;
                  }
                  
                  // Enforce default delay for specific events if not provided
                  // Dynamically enforce delay for navigation events (any event starting with 'navigate_to_')
                  if (delay === 0 && eventId.startsWith('navigate_to_')) {
                    delay = 2;
                    voiceAgentLogger.warn(`Enforcing default 2s delay for navigation event '${eventId}'`);
                  }

                  voiceAgentLogger.debug(`Triggering event: ${eventId} (delay: ${delay}s)`);
                  
                  const trigger = () => {
                    // Call the event trigger callback
                    if (onEventTrigger) {
                      onEventTrigger(eventId, currentAgentRef.current);
                    }
                    
                    // Notify callback
                    callbacks.onToolCall?.(name, args, `Event "${eventId}" triggered successfully`);
                  };

                  if (delay > 0) {
                    setTimeout(trigger, delay * 1000);
                  } else {
                    trigger();
                  }
                  
                  // Send function output back to Azure immediately to keep conversation flowing
                  // The actual navigation will happen after the delay
                  dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: call_id,
                      output: JSON.stringify({ success: true, message: `Event "${eventId}" scheduled with ${delay}s delay` })
                    }
                  }));
                  
                  // Tell Azure to continue the response
                  dataChannel.send(JSON.stringify({ type: 'response.create' }));
                }
                // Execute record_input tool for capturing user responses
                else if (name === 'record_input' && args.title) {
                  const { title, summary = '', description: _description = '', nextEventId, delay: rawDelay } = args;
                  voiceAgentLogger.debug(`Recording input - Title: ${title}, Summary: ${summary}, NextEvent: ${nextEventId}`);
                  
                  // Parse delay robustly
                  let delay = 2; // Default delay if not provided
                  if (typeof rawDelay === 'number') {
                    delay = rawDelay;
                  } else if (typeof rawDelay === 'string') {
                    delay = parseFloat(rawDelay);
                    if (isNaN(delay)) delay = 2;
                  }
                  
                  const result = `Input recorded successfully: ${title}`;
                  
                  // Notify callback - record_input is handled like any other tool
                  // We pass the full args including nextEventId so the callback can handle navigation
                  callbacks.onToolCall?.(name, args, result);
                  
                  // Handle automatic navigation if requested (journey mode handles its own navigation)
                  if (nextEventId && onEventTrigger) {
                    // Dynamically enforce delay for navigation events (any event starting with 'navigate_to_')
                    const enforcedDelay = delay > 0 ? delay : (
                      nextEventId.startsWith('navigate_to_') ? 2 : 0
                    );
                    voiceAgentLogger.debug(`Auto-scheduling event '${nextEventId}' with ${enforcedDelay}s delay from record_input`);
                    setTimeout(() => {
                      voiceAgentLogger.debug(`Triggering auto-event: ${nextEventId}`);
                      onEventTrigger(nextEventId, currentAgentRef.current);
                    }, enforcedDelay * 1000);
                  }
                  
                  // Send function output back to Azure
                  dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: call_id,
                      output: JSON.stringify({ success: true, message: result })
                    }
                  }));
                  
                  // Tell Azure to continue the response
                  dataChannel.send(JSON.stringify({ type: 'response.create' }));
                }
                // Execute end_call system tool for ending the session
                else if (name === 'end_call') {
                  const { reason } = args;
                  voiceAgentLogger.info(`End call triggered${reason ? `: ${reason}` : ''}`);
                  
                  const result = `Call ending${reason ? `: ${reason}` : ''}`;
                  
                  // Notify callback
                  callbacks.onToolCall?.(name, args, result);
                  
                  // Send function output back to Azure before disconnecting
                  dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                      type: 'function_call_output',
                      call_id: call_id,
                      output: JSON.stringify({ success: true, message: result })
                    }
                  }));
                  
                  // Tell Azure to continue the response (for any closing audio)
                  dataChannel.send(JSON.stringify({ type: 'response.create' }));
                  
                  // Store reason and set pending flag to wait for audio completion
                  pendingEndCallReason = reason || '';
                  pendingDisconnectRef = true;
                  voiceAgentLogger.debug('End call requested - waiting for audio to finish before disconnecting...');
                }
                
                lastToolCalledRef.current = name;
              } catch (err) {
                voiceAgentLogger.error('Error handling function call:', err);
              }
            }
            
            // Handle response completion - trigger client-side tool detection and agent handoffs
            else if (realtimeEvent.type === 'response.done') {
              voiceAgentLogger.debug('Response complete - checking for client-side tools and handoffs');
              
              // If end_call was requested and we're waiting for disconnect, do it now
              // This handles the case where no additional audio is generated after end_call
              if (pendingDisconnectRef && pendingEndCallReason !== undefined) {
                voiceAgentLogger.debug('Response done with pending end_call - disconnecting now');
                pendingDisconnectRef = false;

                // Small delay to ensure any audio finishes
                setTimeout(() => {
                  if (onEndCall) {
                    voiceAgentLogger.debug('Executing end call callback from response.done...');
                    onEndCall(pendingEndCallReason || undefined);
                  } else {
                    voiceAgentLogger.debug('No end call callback - disconnecting directly');
                    disconnect();
                  }
                  pendingEndCallReason = undefined;
                }, 500);
                return; // Skip other processing since we're ending
              }
              
              // Tools execute client-side, not in Azure
              await detectAndExecuteClientSideTools(conversationContextRef);
              
              // Check if baseline agent has completed its closing statement
              if (currentAgentRef.current === 'baselineCalculationAgent') {
                const assistantMsg = conversationContextRef.lastAssistantMessage.toLowerCase();
                
                // Detect TRUE closing phrases (final wrap-up, not just baseline calculation)
                // Looking for phrases that indicate the END of the entire conversation
                const hasClosingPhrase = (
                  // Must include "clear picture" AND "everything we need"
                  assistantMsg.includes('clear picture') && 
                  assistantMsg.includes('everything we need') &&
                  // AND must include one of these wrap-up phrases
                  (assistantMsg.includes('build a plan that works for you') ||
                   assistantMsg.includes("you've got this") ||
                   assistantMsg.includes('walk this path together'))
                );
                
                if (hasClosingPhrase && !baselineAgentHasCompletedRef) {
                  voiceAgentLogger.info('Baseline agent has completed its FINAL closing statement');
                  baselineAgentHasCompletedRef = true;
                  
                  // Log completion
                  callbacks.onEvent?.({
                    type: 'conversation_complete',
                    agent: 'baselineCalculationAgent',
                    message: 'Onboarding conversation completed successfully'
                  });
                  
                  // Set flag to disconnect once audio finishes
                  pendingDisconnectRef = true;
                  voiceAgentLogger.debug('Waiting for audio to finish before disconnecting...');
                }
              }
              
              // Then check for handoffs
              checkForAgentHandoff(dataChannel, realtimeEvent);
              
              // Reset assistant message for next turn
              conversationContextRef.lastAssistantMessage = '';
            }
            
          } catch (err) {
            voiceAgentLogger.error('Error parsing event:', err);
          }
        });
        
        /**
         * Detect and execute client-side tools based on conversation context
         * Tools don't run in Azure - they trigger UI cards locally
         */
        const detectAndExecuteClientSideTools = async (context: { lastUserMessage: string, lastAssistantMessage: string }) => {
          const currentAgent = currentAgentRef.current;
          const userMsg = context.lastUserMessage.toLowerCase();

          voiceAgentLogger.debug('Detecting client-side tools for agent:', currentAgent);
          voiceAgentLogger.debug('User:', context.lastUserMessage.substring(0, 100));
          voiceAgentLogger.debug('Assistant:', context.lastAssistantMessage.substring(0, 100));
          
          let toolTriggered = false;
          
          try {
            // Create context for tool execution
            const toolContext: ToolContext = {
              addTranscriptBreadcrumb: (message, data) => {
                callbacks.onEvent?.({
                  type: 'transcript_breadcrumb',
                  message,
                  data
                });
              },
              sendEvent: (event) => {
                callbacks.onEvent?.(event);
              },
              triggerEventUI: callbacks.onEvent,
              triggerFunctionUI: callbacks.onToolCall as any,
            };
            
            // Greeter agent: detect substance mention
            if (currentAgent === 'greeter' && (userMsg.includes('drink') || userMsg.includes('alcohol') || 
                userMsg.includes('tobacco') || userMsg.includes('smok') || userMsg.includes('opioid'))) {
              
              let substance = 'alcohol';
              if (userMsg.includes('tobacco') || userMsg.includes('smok') || userMsg.includes('cigarette')) {
                substance = 'tobacco';
              } else if (userMsg.includes('opioid')) {
                substance = 'opioids';
              }
              
              voiceAgentLogger.debug('Triggering log_substance:', substance);
              const result = await executeTool('log_substance', { substance }, toolContext);
              lastToolCalledRef.current = 'log_substance';
              callbacks.onToolCall?.('log_substance', { substance }, result);
              toolTriggered = true;
            }
            
            // Motivation agent: detect motivation/goal mentions
            else if (currentAgent === 'motivationAgent' && userMsg.length > 20) {
              // Simple heuristic: if user gave a substantial response, log it as motivation
              const entryType = (userMsg.includes('want') || userMsg.includes('goal') || userMsg.includes('achieve')) ? 'goal' : 'motivation';
              const content = context.lastUserMessage;
              
              // Detect category
              let category = 'personal';
              if (userMsg.includes('family') || userMsg.includes('kids') || userMsg.includes('children')) category = 'family';
              else if (userMsg.includes('health') || userMsg.includes('feel')) category = 'health';
              else if (userMsg.includes('work') || userMsg.includes('job')) category = 'career';
              
              voiceAgentLogger.debug('Triggering log_motivation_or_goal:', entryType, content.substring(0, 50));
              const result = await executeTool('log_motivation_or_goal', { entryType, content, category }, toolContext);
              lastToolCalledRef.current = 'log_motivation_or_goal';
              callbacks.onToolCall?.('log_motivation_or_goal', { entryType, content, category }, result);
              toolTriggered = true;
            }
            
            // Baseline agent: detect drink mentions
            else if (currentAgent === 'baselineCalculationAgent' &&
                     (userMsg.includes('beer') || userMsg.includes('wine') || userMsg.includes('drink'))) {
              // This is simplified - in reality you'd parse out drink details
              voiceAgentLogger.debug('User mentioned drinks - tool would be triggered with parsed details');
              // For now, just mark as attempted
              // In a full implementation, you'd parse: drinkType, amount, frequency from the message
            }
            
            if (toolTriggered) {
              voiceAgentLogger.debug('Client-side tool executed successfully');
            } else {
              voiceAgentLogger.debug('No tool triggered for this turn');
            }
            
          } catch (err: unknown) {
            voiceAgentLogger.error('Error executing client-side tool:', err);
          }
        };
        
        /**
         * Check if agent handoff should occur
         */
        const checkForAgentHandoff = (channel: RTCDataChannel, event?: any) => {
          const handoffAttempt = {
            currentAgent: currentAgentRef.current,
            lastTool: lastToolCalledRef.current,
            eventType: event?.type
          };
          
          voiceAgentLogger.debug('Checking for agent handoff...', handoffAttempt);
          
          // Log handoff attempt to session logs
          if (callbacks.onEvent) {
            callbacks.onEvent({
              type: 'handoff_attempt',
              ...handoffAttempt
            });
          }
          
          // Check if we have journey agents (screen-based)
          let nextAgent = null;
          if (journeyAgentsMapRef.current.size > 0) {
            // Journey mode: Check current agent's handoffs
            const currentJourneyAgent = journeyAgentsMapRef.current.get(currentAgentRef.current);
            if (currentJourneyAgent?.handoffs && currentJourneyAgent.handoffs.length > 0) {
              // This agent has handoffs configured - check if conditions are met
              // For now, handoffs are manual (triggered by tools or explicit logic)
              voiceAgentLogger.debug(`Current agent has ${currentJourneyAgent.handoffs.length} potential handoff(s):`, currentJourneyAgent.handoffs);
              // Handoff logic would go here based on tools or conditions
            }
            // Don't log anything for journey agents without handoffs - they use screen navigation
          } else {
            // Legacy mode: Use old handoff system
            nextAgent = getNextAgent(
              currentAgentRef.current, 
              lastToolCalledRef.current
            );
          }
          
          if (nextAgent) {
            voiceAgentLogger.info(`Agent handoff triggered: ${currentAgentRef.current} -> ${nextAgent.name}`);
            
            // Apply custom prompt if provided
            let agentToUse = nextAgent;
            if (callbacks.customPrompts && callbacks.customPrompts[nextAgent.name]) {
              voiceAgentLogger.debug('Using custom prompt for', nextAgent.name);
              agentToUse = {
                ...nextAgent,
                instructions: callbacks.customPrompts[nextAgent.name]
              };
            }
            
            const fromAgent = currentAgentRef.current;
            currentAgentRef.current = nextAgent.name;
            lastToolCalledRef.current = undefined;
            
            // Update session with new agent configuration
            const sessionConfig = createSessionUpdate(agentToUse);
            voiceAgentLogger.debug('Sending session update for new agent:', nextAgent.name);
            channel.send(JSON.stringify(sessionConfig));
            
            // Notify about handoff
            callbacks.onAgentHandoff?.(fromAgent, nextAgent.name);
            callbacks.onEvent?.({
              type: 'agent_handoff',
              from: fromAgent,
              to: nextAgent.name,
              trigger: lastToolCalledRef.current
            });
          }
          // Removed handoff_not_triggered event - too noisy and adds no value
        };

        dataChannel.addEventListener('close', () => {
          voiceAgentLogger.debug('Data channel closed');
          updateStatus('DISCONNECTED');
        });

        dataChannel.addEventListener('error', (event) => {
          voiceAgentLogger.error('Data channel error:', event);
        });

        // Step 6: Create and send SDP offer
        voiceAgentLogger.debug('Creating SDP offer...');
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        voiceAgentLogger.debug('Local SDP set');

        // Step 7: Send offer to Azure and get answer
        voiceAgentLogger.debug('Sending SDP offer to Azure...');
        let sdpUrl: string;
        try {
          const url = new URL(webrtcUrl);
          if (!deployment) {
            throw new Error('Missing deployment name for WebRTC connection');
          }
          url.searchParams.set('model', deployment);
          sdpUrl = url.toString();
        } catch (error: any) {
          throw new Error(`Invalid WebRTC URL: ${webrtcUrl}. ${error?.message || ''}`.trim());
        }

        voiceAgentLogger.info('SDP URL:', sdpUrl);
        voiceAgentLogger.info('Ephemeral key length:', ephemeralKey.length);
        voiceAgentLogger.info('Ephemeral key prefix:', ephemeralKey.substring(0, 10) + '...');
        voiceAgentLogger.info('SDP offer length:', offer.sdp?.length);
        voiceAgentLogger.info('SDP offer first 100 chars:', offer.sdp?.substring(0, 100));
        
        const headers: Record<string, string> = {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        };
        voiceAgentLogger.info('Request headers:', JSON.stringify(headers));
        
        let sdpResponse: Response;
        try {
          sdpResponse = await fetch(sdpUrl, {
            method: 'POST',
            body: offer.sdp,
            headers,
            mode: 'cors'
          });
        } catch (fetchError: any) {
          voiceAgentLogger.error('=== Fetch Error (CORS/Network) ===');
          voiceAgentLogger.error('Error name:', fetchError?.name);
          voiceAgentLogger.error('Error message:', fetchError?.message);
          voiceAgentLogger.error('Full error:', fetchError);
          throw new Error(`Network error during SDP exchange: ${fetchError?.message || 'Unknown fetch error'}`);
        }

        voiceAgentLogger.info('SDP response status:', sdpResponse.status, sdpResponse.statusText);

        if (!sdpResponse.ok) {
          const errorBody = await sdpResponse.text();
          voiceAgentLogger.error('=== SDP Exchange Failed ===');
          voiceAgentLogger.error('Status:', sdpResponse.status);
          voiceAgentLogger.error('Status Text:', sdpResponse.statusText);
          voiceAgentLogger.error('Response body:', errorBody);
          throw new Error(`SDP exchange failed: ${sdpResponse.status} ${sdpResponse.statusText}. ${errorBody}`);
        }

        const answerSdp = await sdpResponse.text();
        voiceAgentLogger.debug('Received SDP answer from Azure');

        // Step 8: Set remote description
        const answer: RTCSessionDescriptionInit = {
          type: 'answer',
          sdp: answerSdp
        };
        await peerConnection.setRemoteDescription(answer);
        voiceAgentLogger.info('Remote SDP set - WebRTC connection established!');

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
          voiceAgentLogger.debug('Connection state:', peerConnection.connectionState);
          if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
            updateStatus('DISCONNECTED');
          }
        };

      } catch (err: unknown) {
        const error = err as Error;
        voiceAgentLogger.error('Error establishing WebRTC connection:', error.message);
        voiceAgentLogger.error('Full error:', err);
        updateStatus('DISCONNECTED');
        alert(`Failed to connect: ${error.message || 'Unknown error'}`);
        throw err;
      }
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    voiceAgentLogger.debug('Disconnecting WebRTC session...');

    // Stop microphone stream tracks to release the mic
    if (micStreamRef.current) {
      voiceAgentLogger.debug('Stopping microphone tracks...');
      micStreamRef.current.getTracks().forEach(track => {
        track.stop();
        voiceAgentLogger.debug(`Stopped track: ${track.kind}`);
      });
      micStreamRef.current = null;
    }

    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Reset agent state
    currentAgentRef.current = 'greeter';
    lastToolCalledRef.current = undefined;
    isAssistantSpeakingRef.current = false;

    updateStatus('DISCONNECTED');
    voiceAgentLogger.info('Disconnected');
  }, [updateStatus]);

  const sendMessage = useCallback((message: unknown) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(message));
    } else {
      voiceAgentLogger.warn('Cannot send message: data channel not open');
    }
  }, []);

  const setMicMuted = useCallback((muted: boolean) => {
    if (micStreamRef.current) {
      micStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !muted;
        voiceAgentLogger.debug(`Microphone ${muted ? 'muted' : 'unmuted'} (track.enabled = ${track.enabled})`);
      });
    } else {
      voiceAgentLogger.warn('Cannot mute: no microphone stream available');
    }
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendMessage,
    setMicMuted,
  };
}

