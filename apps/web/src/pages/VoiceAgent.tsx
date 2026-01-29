import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './VoiceAgent.css';

// Context Providers
import { TranscriptProvider } from '../contexts/voiceAgent/TranscriptContext';
import { EventProvider } from '../contexts/voiceAgent/EventContext';
import { AgentUIProvider } from '../contexts/voiceAgent/AgentUIContext';

// Hooks
import { useTranscript } from '../contexts/voiceAgent/TranscriptContext';
import { useEvent } from '../contexts/voiceAgent/EventContext';
import { useAgentUI } from '../contexts/voiceAgent/AgentUIContext';
import { useAzureWebRTCSession } from '../hooks/voiceAgent/useAzureWebRTCSession';
import useAudioDownload from '../hooks/voiceAgent/useAudioDownload';
import { useStreamingRecording } from '../hooks/voiceAgent/useStreamingRecording';
import { VoiceAgentAudioRouter } from '../utils/voiceAgent/audioRouting';

// Components
import AgentUIRenderer from '../components/voiceAgent/AgentUIRenderer';
import SessionLogViewer, { LogEntry } from '../components/voiceAgent/SessionLogViewer';
import MemberPersonaEditor from '../components/voiceAgent/MemberPersonaEditor';
import FeedbackForm from '../components/voiceAgent/FeedbackForm';
import VoiceControlBar from '../components/voiceAgent/VoiceControlBar';
import { ErrorBoundary } from '../components/voiceAgent/ErrorBoundary';
import { useAudioLevel } from '../hooks/voiceAgent/useAudioLevel';
import { EditIcon, SettingsIcon } from '../components/Icons';

import { SessionStatus, TranscriptItem } from '../types/voiceAgent';
import { Journey, JourneyListItem } from '../types/journey';
import {
  createSessionExport,
  downloadSessionExport,
  downloadPrompt,
  downloadFormattedTranscript,
  downloadPromptAndTranscript
} from '../utils/transcriptExport';
import { JourneyRuntime, getStartingAgentName, setEventTriggerCallback } from '../lib/voiceAgent/journeyRuntime';
import { listJourneysForRuntime, loadJourneyForRuntime } from '../services/journeyStorage';
import { PQData, substitutePromptVariables, DEFAULT_PQ_DATA } from '../utils/promptTemplates';
import { useAuth } from '../contexts/AuthContext';
import { saveSession, DebouncedSessionSaver } from '../services/api/sessionService';

// Main Voice Agent Component
function VoiceAgentContent() {
  const {
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
    transcriptItems,
  } = useTranscript();
  const { logServerEvent, loggedEvents } = useEvent();
  const {
    triggerFunctionUI,
    triggerEventUI,
    enableScreenRendering,
    disableScreenRendering,
    navigateToScreen,
    moduleState,
    updateModuleState,
    setAgents,
    switchToAgent,
    flowContext,
    updateFlowContext,
    mergeModuleStateToFlowContext,
  } = useAgentUI();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const currentAgentRef = useRef<string>('greeter');

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
      
      // Track actual audio playback to control speaking state
      const handleAudioPlay = () => {
        console.log('🔊 Audio started playing');
        setIsAgentSpeaking(true);
      };
      
      const handleAudioEnded = () => {
        console.log('🔇 Audio ended');
        setIsAgentSpeaking(false);
      };
      
      const handleAudioPause = () => {
        // Only set speaking to false if audio is actually paused (not just buffering)
        if (sdkAudioElement.ended) {
          console.log('⏸️ Audio paused/ended');
          setIsAgentSpeaking(false);
        }
      };
      
      sdkAudioElement.addEventListener('play', handleAudioPlay);
      sdkAudioElement.addEventListener('ended', handleAudioEnded);
      sdkAudioElement.addEventListener('pause', handleAudioPause);
      
      return () => {
        sdkAudioElement.removeEventListener('play', handleAudioPlay);
        sdkAudioElement.removeEventListener('ended', handleAudioEnded);
        sdkAudioElement.removeEventListener('pause', handleAudioPause);
      };
    }
  }, [sdkAudioElement]);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const [_shape] = useState<'oval' | 'rectangle'>('oval');
  const [_substance] = useState<string | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});
  const [sessionLogs, setSessionLogs] = useState<LogEntry[]>([]);
  // Testing Persona state - OFF by default
  const [personaEnabled, setPersonaEnabled] = useState(() => {
    const saved = localStorage.getItem('voice-agent-persona-enabled');
    // Default to false (OFF) - only enable if explicitly saved as true
    return saved ? JSON.parse(saved) : false;
  });
  const [personaDescription, setPersonaDescription] = useState(() => {
    return localStorage.getItem('voice-agent-persona-description') || '';
  });
  const [pqData, setPQData] = useState<Partial<PQData>>(() => {
    const saved = localStorage.getItem('voice-agent-pq-data');
    return saved ? JSON.parse(saved) : {};
  });
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem('voice-agent-selected-voice') || '';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [availableJourneys, setAvailableJourneys] = useState<JourneyListItem[]>([]);
  const [journeysLoading, setJourneysLoading] = useState(true);
  
  // Voice control state
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [_isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [_hasScreensVisible, setHasScreensVisible] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  
  // Non-voice mode state
  const [isNonVoiceMode, setIsNonVoiceMode] = useState(false);
  
  // Feedback form state
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackSessionId, setFeedbackSessionId] = useState<string | null>(null);
  
  // Microphone permission error state
  const [micPermissionError, setMicPermissionError] = useState(false);
  
  // Journey transition state - prevents journeys list from showing during flow transitions
  const [isTransitioningJourney, setIsTransitioningJourney] = useState(false);
  
  // Ref to store current journey for event handlers (avoids closure issues)
  const currentJourneyRef = useRef<Journey | null>(null);
  
  // Notification permission popup state
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  
  // Preview mode state (when accessed via shared link)
  const [isPreviewMode] = useState(() => {
    return localStorage.getItem('voice-agent-preview-mode') === 'true';
  });
  const [previewLoading, setPreviewLoading] = useState(() => {
    return localStorage.getItem('voice-agent-preview-mode') === 'true';
  });
  
  // Session tracking for transcript export
  const sessionIdRef = useRef<string>(`session_${Date.now()}`);
  // Track the combined prompt sent to the agent for export
  const combinedPromptRef = useRef<string>('');
  // Ref to hold the latest connectToRealtime function (avoids stale closure in event handlers)
  const connectToRealtimeRef = useRef<((journeyOverride?: Journey, flowContextOverride?: Record<string, any>, options?: { skipScreenReset?: boolean }) => Promise<void>) | null>(null);
  // Real-time session saver with debouncing
  const sessionSaverRef = useRef<DebouncedSessionSaver>(
    new DebouncedSessionSaver(500, (error) => {
      console.error('Real-time save error:', error);
    })
  );

  // Track audio level from microphone for visualization - keeping hook call to avoid disrupting audio flow
  useAudioLevel(micStream);

  // Buffer for accumulating assistant responses
  const assistantResponseBuffer = useRef<string>('');
  const assistantResponseStartTime = useRef<Date | null>(null);
  const currentMessageIdsRef = useRef<{ user?: string; assistant?: string }>({});
  // Track which itemIds have been queued to prevent duplicate saves
  const queuedItemIdsRef = useRef<Set<string>>(new Set());
  // Buffer for accumulating user message text (since text comes in chunks)
  const userMessageBuffer = useRef<string>('');

  const { startRecording, stopRecording } = useAudioDownload();

  // Streaming recording - uploads to server in real-time
  const {
    startRecording: startStreamingRecording,
    stopRecording: stopStreamingRecording,
  } = useStreamingRecording({
    chunkDuration: 5000, // 5 second chunks
    onChunkUploaded: (chunkIndex) => {
      console.log(`📤 Chunk ${chunkIndex + 1} uploaded to storage`);
    },
    onError: (error) => {
      addLog('warning', `Recording upload error: ${error.message}`);
    },
  });

  const addLog = (type: LogEntry['type'], message: string, details?: any) => {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      type,
      message,
      details
    };
    setSessionLogs(prev => [...prev, logEntry]);
    
    // Also log to console with appropriate styling
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 
                 type === 'agent' ? '🤖' : type === 'tool' ? '🔧' : type === 'event' ? '📢' : 'ℹ️';
    console.log(`${icon} [${type.toUpperCase()}] ${message}`, details || '');
  };

  // Load default journeys on first mount
  useEffect(() => {
    const loadJourneys = async () => {
      setJourneysLoading(true);
      try {
        // Refresh journey list on mount - uses production flows in production mode
        const journeyList = await listJourneysForRuntime();
        console.log('📋 Available journeys on mount:', journeyList.map(j => `${j.name} (${j.id})`));
        setAvailableJourneys(journeyList);

        // Check if there's a journey to auto-launch (from Journey Builder or preview mode)
        const launchJourneyId = localStorage.getItem('voice-agent-launch-journey');
        if (launchJourneyId) {
          localStorage.removeItem('voice-agent-launch-journey'); // Clear flag
          const journeyToLaunch = await loadJourneyForRuntime(launchJourneyId);
          if (journeyToLaunch) {
            setCurrentJourney(journeyToLaunch);
            setPreviewLoading(false); // Journey loaded, hide loading overlay
            addLog('info', `🚀 Launching journey: ${journeyToLaunch.name}`);
            // Auto-start after a brief delay
            setTimeout(() => {
              connectToRealtime(journeyToLaunch);
            }, 500);
            return;
          }
        }
        // If no journey to launch, clear preview loading anyway
        setPreviewLoading(false);

        if (!currentJourney && journeyList.length > 0) {
          // Auto-load first journey but don't start it
          const firstJourney = await loadJourneyForRuntime(journeyList[0].id);
          if (firstJourney) {
            setCurrentJourney(firstJourney);
            addLog('info', `📋 Journey ready: ${firstJourney.name}`);
          }
        }
      } finally {
        setJourneysLoading(false);
      }
    };

    loadJourneys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Start a non-voice session (no microphone, no WebRTC)
  const startNonVoiceSession = useCallback((journey: Journey) => {
    console.log('🚀 Starting non-voice session for journey:', journey.name);
    addLog('info', `🔇 Starting non-voice session: ${journey.name}`);

    // Generate new session ID
    sessionIdRef.current = `session_${Date.now()}`;
    
    // Reset session state
    sessionSaverRef.current.reset();
    queuedItemIdsRef.current.clear();
    setSessionLogs([]);

    // Store all agents for non-voice navigation
    if (setAgents) {
      setAgents(journey.agents);
    }

    // Find starting agent
    const startingAgentConfig = journey.agents.find(a => a.id === journey.startingAgentId);
    if (!startingAgentConfig) {
      addLog('error', 'Starting agent not found in journey');
      return;
    }

    const startingAgentName = startingAgentConfig.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
    currentAgentRef.current = startingAgentName;

    // Enable screen rendering with starting agent's screens
    if (startingAgentConfig.screens && startingAgentConfig.screens.length > 0) {
      addLog('info', `📱 Showing first screen: ${startingAgentConfig.screens[0].id}`);
      enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
      setHasScreensVisible(true);
    } else {
      addLog('warning', '⚠️ Starting agent has no screens configured');
    }

    // Set session status to connected (non-voice active)
    setSessionStatus('CONNECTED');
    setIsNonVoiceMode(true);
    addLog('success', `✅ Non-voice session started`);
  }, [addLog, enableScreenRendering, setAgents]);

  // Listen for toolCallAction events (from ScreenContext) for navigate_to_agent
  useEffect(() => {
    console.log('🔌🔌🔌 VoiceAgent: Setting up toolCallAction listener 🔌🔌🔌');
    console.log('🔌 currentJourney:', currentJourney?.name);
    console.log('🔌 currentJourneyRef.current:', currentJourneyRef.current?.name);
    
    const handleToolCallAction = (event: Event) => {
      console.log('🔧🔧🔧 VoiceAgent received toolCallAction event! 🔧🔧🔧');
      const customEvent = event as CustomEvent;
      const { tool, params } = customEvent.detail;
      
      console.log('🔧 Tool:', tool, 'Params:', params);
      
      if (tool === 'navigate_to_agent' && params.agentId) {
        addLog('info', `🔄 Navigating to agent: ${params.agentId}`);
        if (switchToAgent) {
          switchToAgent(params.agentId);
        }
      }
      
      if (tool === 'end_session' || tool === 'complete_quiz') {
        addLog('info', `📞 Session complete`);
        // For non-voice mode, just disconnect (no feedback form needed)
        setSessionStatus('DISCONNECTED');
        setIsNonVoiceMode(false);
        disableScreenRendering?.();
        setHasScreensVisible(false);
      }
      
      // Handle start_journey tool - load and start a new journey with flow context
      if (tool === 'start_journey' && params.journeyId) {
        console.log('🔗🔗🔗 START_JOURNEY TRIGGERED 🔗🔗🔗');
        console.log('🔗 journeyId:', params.journeyId);
        console.log('🔗 current sessionStatus:', sessionStatus);
        addLog('info', `🔗 Starting linked journey: ${params.journeyId}`);
        
        // Set transitioning flag to prevent journeys list from showing
        setIsTransitioningJourney(true);
        console.log('🔗 Set isTransitioningJourney to true');
        
        // Synchronously merge current moduleState with flowContext for data passing
        // This ensures all quiz answers are available to the next journey
        const mergedFlowContext = {
          ...(flowContext || {}),
          ...(moduleState || {}),
        };
        
        console.log('🔗 Merged flow context:', mergedFlowContext);
        
        // Also update the flowContext state for future use
        if (updateFlowContext && moduleState) {
          updateFlowContext(moduleState);
        }
        
        addLog('info', `🔗 Merged flow context keys: ${Object.keys(mergedFlowContext).join(', ')}`);
        
        // Load and start the target journey with merged context
        const loadAndStartJourney = async () => {
          try {
            console.log('🔗 Fetching journey from API...');
            // Try authenticated endpoint first, fall back to public preview endpoint
            let response = await fetch(`/api/journeys/${params.journeyId}`, {
              credentials: 'include', // Include cookies for authentication
            });
            
            // If auth fails, try the public preview endpoint
            if (response.status === 401) {
              console.log('🔗 Auth failed, trying preview endpoint...');
              response = await fetch(`/api/journeys/preview/${params.journeyId}`);
            }
            
            if (!response.ok) {
              throw new Error(`Failed to load journey: ${response.status} ${response.statusText}`);
            }
            const targetJourney = await response.json();
            console.log('🔗 Loaded journey:', targetJourney.name, 'voiceEnabled:', targetJourney.voiceEnabled);
            addLog('success', `📥 Loaded journey: ${targetJourney.name}`);
            
            // Exit non-voice mode since we're starting a voice journey
            setIsNonVoiceMode(false);
            
            // Set the new journey
            setCurrentJourney(targetJourney);
            
            // Set all agents for the new journey (for multi-agent navigation)
            if (setAgents) {
              setAgents(targetJourney.agents);
            }
            
            // IMMEDIATELY update screens to show the new journey's first screen
            // This provides visual feedback during the voice connection setup
            const startingAgentConfig = targetJourney.agents?.find(
              (a: any) => a.id === targetJourney.startingAgentId
            );
            
            if (startingAgentConfig?.screens && startingAgentConfig.screens.length > 0) {
              console.log('🔗 Immediately showing new journey screens:', startingAgentConfig.screens[0].id);
              enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
              setHasScreensVisible(true);
            }
            
            // Force session to disconnected state first
            setSessionStatus('DISCONNECTED');
            
            // Connect to voice session with the new journey
            console.log('🔗 About to schedule connectToRealtime call...');
            requestAnimationFrame(() => {
              setTimeout(() => {
                console.log('🔗 Calling connectToRealtimeRef.current');
                if (connectToRealtimeRef.current) {
                  connectToRealtimeRef.current(targetJourney, mergedFlowContext);
                } else {
                  console.error('🔗 connectToRealtimeRef.current is null!');
                }
              }, 100);
            });
          } catch (error) {
            console.error('🔗 Failed to start journey:', error);
            addLog('error', `Failed to start journey: ${error}`);
            setIsTransitioningJourney(false); // Clear flag on error
          }
        };
        
        loadAndStartJourney();
        return; // Prevent other handlers from running
      }
      
      // Handle enable_voice tool - activate voice mode mid-flow while keeping current screens
      if (tool === 'enable_voice') {
        console.log('🎤🎤🎤 ENABLE_VOICE TRIGGERED IN VOICEAGENT 🎤🎤🎤');
        alert('VoiceAgent received enable_voice!'); // Debug alert
        addLog('info', '🎤 Enabling voice mode mid-flow');
        
        // Log current state for debugging
        console.log('🎤 Current state:', {
          sessionStatus,
          isNonVoiceMode,
          currentJourneyRef: currentJourneyRef.current?.name,
          connectToRealtimeRef: !!connectToRealtimeRef.current,
        });
        
        // Get journey from ref SYNCHRONOUSLY (avoid closure issues)
        const journey = currentJourneyRef.current;
        if (!journey) {
          console.error('🎤 ERROR: No journey in currentJourneyRef!');
          alert('ERROR: No journey found!'); // Debug alert
          addLog('error', 'No journey found - cannot enable voice');
          return;
        }
        
        if (!connectToRealtimeRef.current) {
          console.error('🎤 ERROR: connectToRealtimeRef.current is null!');
          alert('ERROR: connectToRealtimeRef is null!'); // Debug alert
          addLog('error', 'Voice connection function not available');
          return;
        }
        
        // Set transitioning flag to prevent flows list from flashing
        setIsTransitioningJourney(true);
        
        // Exit non-voice mode
        setIsNonVoiceMode(false);
        
        // Force session to disconnected state to allow reconnection
        setSessionStatus('DISCONNECTED');
        
        // Merge flow context for data passing
        const mergedContext = {
          ...(flowContext || {}),
          ...(moduleState || {}),
        };
        
        // Update flowContext state for consistency
        if (updateFlowContext && moduleState) {
          updateFlowContext(moduleState);
        }
        
        addLog('info', `🎤 Flow context keys: ${Object.keys(mergedContext).join(', ')}`);
        
        // Create a modified journey with voiceEnabled=true to force voice mode
        const voiceEnabledJourney = {
          ...journey,
          voiceEnabled: true, // Override to force voice mode
        };
        
        console.log('🎤 Calling connectToRealtime SYNCHRONOUSLY (preserves user gesture for mic permission)');
        console.log('🎤 Journey:', voiceEnabledJourney.name, 'voiceEnabled:', voiceEnabledJourney.voiceEnabled);
        
        // CRITICAL: Call connectToRealtime SYNCHRONOUSLY to preserve user gesture context
        // Mic permission requires direct user gesture - setTimeout loses this context!
        try {
          connectToRealtimeRef.current(voiceEnabledJourney, mergedContext, { skipScreenReset: true });
          console.log('🎤 connectToRealtime call initiated');
        } catch (err) {
          console.error('🎤 ERROR calling connectToRealtime:', err);
          addLog('error', `Failed to enable voice: ${err}`);
          setIsTransitioningJourney(false);
        }
        
        return;
      }
    };
    
    window.addEventListener('toolCallAction', handleToolCallAction as EventListener);
    
    return () => {
      window.removeEventListener('toolCallAction', handleToolCallAction as EventListener);
    };
  }, [addLog, switchToAgent, disableScreenRendering, enableScreenRendering, setAgents, flowContext, moduleState, updateFlowContext, currentJourney]);

  const connectToRealtime = async (journeyOverride?: Journey, flowContextOverride?: Record<string, any>, options?: { skipScreenReset?: boolean }) => {
    console.log('🎙️🎙️🎙️ connectToRealtime CALLED 🎙️🎙️🎙️');
    console.log('🎙️ Arguments:', {
      journeyOverride: journeyOverride?.name,
      flowContextOverrideKeys: flowContextOverride ? Object.keys(flowContextOverride) : null,
      options,
    });
    console.log('🎙️ Current state:', {
      sessionStatus,
      isNonVoiceMode,
      currentJourney: currentJourney?.name,
    });
    
    // When called with journeyOverride (from start_journey or enable_voice), skip the session status check
    // because we just set it to DISCONNECTED but the closure has the old value
    if (!journeyOverride && sessionStatus !== "DISCONNECTED") {
      console.log('🎙️ EARLY EXIT: sessionStatus is not DISCONNECTED and no journeyOverride');
      addLog('warning', 'Session not disconnected - cannot connect');
      return;
    }

    // Use provided journey or fall back to current journey state
    const journeyToUse = journeyOverride || currentJourney;
    console.log('🎙️ Using journey:', journeyToUse?.name, 'voiceEnabled:', journeyToUse?.voiceEnabled);

    // Check if we have a journey to run
    if (!journeyToUse) {
      console.log('🎙️ EARLY EXIT: No journey to use');
      addLog('error', 'No journey selected. Please load or create a journey first.');
      return;
    }

    // Check if this is a non-voice journey (voiceEnabled is explicitly false)
    // Handle all falsy values including undefined, null, or false
    const isVoiceEnabled = journeyToUse.voiceEnabled !== false;
    console.log('🔊 Journey voiceEnabled check:', {
      voiceEnabled: journeyToUse.voiceEnabled,
      isVoiceEnabled,
      typeofVoiceEnabled: typeof journeyToUse.voiceEnabled,
    });
    
    if (!isVoiceEnabled) {
      console.log('🔇 EARLY EXIT: Starting non-voice session instead');
      addLog('info', '🔇 Non-voice journey detected');
      startNonVoiceSession(journeyToUse);
      return;
    }

    // Voice mode: Check microphone permission before connecting
    console.log('🎤 Requesting microphone permission...');
    addLog('info', '🎤 Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      console.log('🎤 Microphone permission GRANTED');
      addLog('success', '🎤 Microphone permission granted');
      // Permission granted - stop the stream immediately (connection will request again)
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error('🎤 MICROPHONE PERMISSION DENIED:', error);
      setMicPermissionError(true);
      addLog('error', `Microphone access denied: ${error}`);
      setIsTransitioningJourney(false);
      return;
    }

    // Generate new session ID for this session
    sessionIdRef.current = `session_${Date.now()}`;
    
    // Reset the real-time saver for the new session
    sessionSaverRef.current.reset();
    // Clear the queued item IDs set for the new session
    queuedItemIdsRef.current.clear();
    // Clear message buffers
    userMessageBuffer.current = '';
    assistantResponseBuffer.current = '';

    console.log('🚀 connectToRealtime called with journey:', journeyToUse.name, 'ID:', journeyToUse.id);

    // Apply PQ data substitution to agent prompts
    const pqDataToUse = { ...DEFAULT_PQ_DATA, ...pqData };
    const journeyWithPQData = {
      ...journeyToUse,
      systemPrompt: journeyToUse.systemPrompt ? substitutePromptVariables(journeyToUse.systemPrompt, pqDataToUse) : journeyToUse.systemPrompt,
      agents: journeyToUse.agents.map(agent => ({
        ...agent,
        prompt: substitutePromptVariables(agent.prompt, pqDataToUse),
      })),
    };
    addLog('info', '📝 Applied PQ data to prompts', { memberName: pqDataToUse.memberName, primaryGoal: pqDataToUse.primaryGoal });

    // Create event trigger handler for screen navigation (needed before runtime.convert)
    const handleEventTrigger = (eventId: string, agentName: string) => {
      addLog('event', `📢 Screen event triggered: ${eventId}`, { agentName });
      
      // Special handling for feedback screen event (triggered by end_call tool)
      if (eventId === 'show_feedback_screen') {
        addLog('info', '📋 Feedback screen event triggered - navigating to feedback screen');
        // Navigate to a feedback screen if it exists in the journey
        const currentAgentConfig = journeyWithPQData.agents.find(a => {
          const name = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
          return name === agentName;
        });
        
        // Look for a screen with id containing 'feedback' or navigate to the first feedback screen
        const feedbackScreen = currentAgentConfig?.screens?.find(s => 
          s.id.toLowerCase().includes('feedback') || 
          s.id.toLowerCase().includes('goodbye') ||
          s.id.toLowerCase().includes('end')
        );
        
        if (feedbackScreen && navigateToScreen) {
          addLog('info', `📱 Navigating to feedback screen: ${feedbackScreen.id}`);
          navigateToScreen(feedbackScreen.id);
        } else {
          addLog('warning', '⚠️ No feedback screen found in journey - feedback modal will be shown after disconnect');
        }
        return;
      }
      
      // Special handling for permissions_screen_event - show notification permission popup
      if (eventId === 'permissions_screen_event') {
        addLog('info', '🔔 Notification permission request triggered - showing popup');
        setShowNotificationPopup(true);
        return;
      }
      
      // Find the current agent to get its screens
      const currentAgentConfig = journeyWithPQData.agents.find(a => {
        const name = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
        return name === agentName;
      });
      
      if (currentAgentConfig?.screens) {
        // Screens are already shown at session start, just process the navigation
        addLog('info', `📱 Processing event "${eventId}" within ${currentAgentConfig.screens.length} screen(s)`);
        
        // Find the event in the current screens - check both screen-level and element-level events
        let foundEvent = null;
        
        // First check screen-level events
        const screenLevelEvents = currentAgentConfig.screens.flatMap(screen => screen.events || []);
        foundEvent = screenLevelEvents.find(e => e.id === eventId);
        
        // If not found, check element-level events (in buttons, etc.)
        if (!foundEvent) {
          for (const screen of currentAgentConfig.screens) {
            for (const section of screen.sections) {
              for (const element of section.elements) {
                if (element.events) {
                  const elementEvent = element.events.find((e: any) => e.id === eventId);
                  if (elementEvent) {
                    foundEvent = elementEvent;
                    break;
                  }
                }
              }
              if (foundEvent) break;
            }
            if (foundEvent) break;
          }
        }
        
        if (foundEvent && foundEvent.action) {
          // Look for navigation action
          const navAction = foundEvent.action.find((a: any) => a.type === 'navigation');
          const stateAction = foundEvent.action.find((a: any) => a.type === 'stateUpdate');

          if (navAction) {
            const deeplink = (navAction as any).deeplink;
            // Use the deeplink directly as the screen ID
            const targetScreenId = deeplink;
            
            // Validate that the target screen exists
            if (currentAgentConfig?.screens) {
              const targetScreen = currentAgentConfig.screens.find(s => s.id === targetScreenId);
              if (!targetScreen) {
                addLog('error', `❌ Navigation error: Screen "${targetScreenId}" not found. Please check flow configuration.`);
                console.error(`Navigation error: Screen "${targetScreenId}" not found in screens:`, currentAgentConfig.screens.map(s => s.id));
                return;
              }
            }
            
            addLog('info', `🎯 Navigating to screen: ${targetScreenId}`);
            navigateToScreen?.(targetScreenId);
          }

          if (stateAction) {
            addLog('info', `📝 Event "${eventId}" executed state update`);
            // State updates are handled by the ScreenContext when the event is triggered
          }

          if (!navAction && !stateAction) {
            addLog('warning', `⚠️ Event "${eventId}" found but has no navigation or state action`);
          }
        } else {
          addLog('warning', `⚠️ Event "${eventId}" not found in screens or elements`);
        }
      }
    };
    
    // Convert journey to runtime agents with flow context for {{key}} prompt interpolation
    // Use override if provided (from start_journey), otherwise use current context state
    const effectiveFlowContext = flowContextOverride || flowContext || {};
    const runtime = new JourneyRuntime({
      callbacks: {
        onEventTrigger: handleEventTrigger,
      },
      flowContext: effectiveFlowContext,
    });
    const { startingAgent } = runtime.convert(journeyWithPQData);
    if (!startingAgent) {
      addLog('error', 'Journey has no starting agent configured');
      return;
    }
    
    // Log flow context if present
    if (Object.keys(effectiveFlowContext).length > 0) {
      addLog('info', '🔗 Flow context applied to prompts', { keys: Object.keys(effectiveFlowContext) });
    }

    const startingAgentName = getStartingAgentName(journeyWithPQData);
    currentAgentRef.current = startingAgentName;
    
    // Also set the legacy callback for backwards compatibility
    setEventTriggerCallback(handleEventTrigger);
    
    // Note: record_input is now handled through onToolCall in useAzureWebRTCSession,
    // so we don't need to set a separate callback here

    // Check if starting agent has screens
    const startingAgentConfig = journeyWithPQData.agents.find(a => a.id === journeyWithPQData.startingAgentId);
    
    if (startingAgentConfig?.screens && startingAgentConfig.screens.length > 0) {
      addLog('info', `🎨 Screen system ready with ${startingAgentConfig.screens.length} screens`);
      
      // Skip screen reset when enabling voice mid-flow (screens are already showing)
      if (!options?.skipScreenReset) {
        addLog('info', `📱 Showing first screen: ${startingAgentConfig.screens[0].id}`);
        // Show the first screen immediately when session starts
        enableScreenRendering?.(startingAgentConfig.screens, startingAgentConfig.screens[0].id);
        setHasScreensVisible(true);
      } else {
        addLog('info', `📱 Keeping current screen (skipScreenReset=true)`);
      }
    } else {
      addLog('warning', '⚠️ Starting agent has no screens configured');
    }

    // Clear previous session logs
    setSessionLogs([]);
    addLog('info', `Initiating connection with journey: ${journeyToUse.name}`);
    addLog('info', `Starting agent: ${startingAgent.name}`);

    try {
      // Get starting agent config (reuse the one we already found with PQ data applied)
      const startingAgentConfigForConnect = journeyWithPQData.agents.find(a => a.id === journeyWithPQData.startingAgentId);
      if (!startingAgentConfigForConnect) {
        throw new Error('Starting agent not found in journey');
      }

      // Build combined instructions: system + agent + screen prompts
      const instructionParts = [
        journeyWithPQData.systemPrompt,
        startingAgentConfigForConnect.prompt,
      ];

      // Add all screen prompts if agent has screens
      if (startingAgentConfigForConnect.screens && startingAgentConfigForConnect.screenPrompts) {
        const screenPromptsText = Object.entries(startingAgentConfigForConnect.screenPrompts)
          .map(([screenId, prompt]) => `\n## SCREEN: ${screenId}\n${prompt}`)
          .join('\n\n');
        
        if (screenPromptsText) {
          instructionParts.push(screenPromptsText);
        }
      }

      const combinedInstructions = instructionParts.filter(Boolean).join('\n\n');

      // Store combined prompt for export
      combinedPromptRef.current = combinedInstructions;

      // Create journey agent config for WebRTC session
      // Convert journey tools to Azure format
      const azureTools = (startingAgentConfigForConnect.tools || []).map(tool => ({
        type: 'function' as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      }));

      // Use settings override, then journey voice, then agent voice
      const journeyVoice = selectedVoice || journeyWithPQData.voice || startingAgentConfigForConnect.voice || 'shimmer';

      const journeyAgentConfig = {
        name: startingAgentName,
        instructions: combinedInstructions,
        voice: journeyVoice,
        tools: azureTools, // Send tools to Azure so it knows to call them
        handoffs: startingAgentConfigForConnect.handoffs || [],
      };

      // Build map of all journey agents for handoff support
      const allJourneyAgentsMap = new Map();
      journeyWithPQData.agents.forEach(agent => {
        const agentName = agent.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());

        // Build instructions for this agent
        const agentInstructionParts = [
          journeyWithPQData.systemPrompt,
          agent.prompt,
        ];

        // Add screen prompts if agent has screens
        if (agent.screens && agent.screenPrompts) {
          const screenPromptsText = Object.entries(agent.screenPrompts)
            .map(([screenId, prompt]) => `\n## SCREEN: ${screenId}\n${prompt}`)
            .join('\n\n');

          if (screenPromptsText) {
            agentInstructionParts.push(screenPromptsText);
          }
        }

        allJourneyAgentsMap.set(agentName, {
          name: agentName,
          instructions: agentInstructionParts.filter(Boolean).join('\n\n'),
          voice: selectedVoice || journeyWithPQData.voice || agent.voice || 'shimmer', // Use journey voice for consistency
          handoffs: agent.handoffs || [],
        });
      });

      addLog('info', `📋 Agent configuration prepared (${combinedInstructions.length} chars)`);
      addLog('info', `🎵 Using voice: ${journeyAgentConfig.voice}`);
      addLog('info', `👥 Journey has ${allJourneyAgentsMap.size} agent(s) configured`);

      if (personaEnabled && personaDescription) {
        // Persona mode: Set up audio routing destinations first
        audioRouterRef.current = new VoiceAgentAudioRouter();
        const { personaMicStream, agentMicStream } = 
          await audioRouterRef.current.setupBidirectionalRouting(sdkAudioElement!, personaAudioElement);
        
        // Connect agent with routed mic and journey agent config
        await connect({
          audioElement: sdkAudioElement,
          customMicStream: agentMicStream,
          agentConfig: journeyAgentConfig,
          allJourneyAgents: allJourneyAgentsMap,
          onEventTrigger: handleEventTrigger,
          onEndCall: handleEndCall,
        });
        addLog('success', 'Successfully initiated voice agent connection');
        
        addLog('info', '🎭 Connecting persona voice session...');
        
        // Small delay to ensure agent connection is stable
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        try {
          await connectPersona({
            audioElement: personaAudioElement,
            customMicStream: personaMicStream, // Route agent audio to persona
            skipInitialGreeting: true, // Persona waits for agent to speak first
            voice: 'shimmer', // Use different voice to distinguish from agent (alloy)
            customInstructions: `${personaDescription}

You are role-playing as this person in a conversation with a counsellor from Pelago (a substance use recovery program). 

CRITICAL: You will hear the counsellor speaking through your microphone. Respond immediately and naturally when you hear them speak. Don't wait for silence - jump in with your response.

Respond naturally and authentically as this person would. Keep responses conversational and realistic - usually 1-3 sentences unless asked for more detail.

Important guidelines:
- Respond as the person described, not as an AI
- Be honest about your struggles and motivations  
- Show realistic emotions and reactions
- Don't be overly formal or clinical
- Answer questions directly but naturally
- You can express uncertainty, concern, hope, or other genuine emotions
- Speak in a natural, conversational tone
- Respond promptly when you hear the counsellor speak`,
          } as any);
        } catch (personaErr: any) {
          console.error("Error connecting persona:", personaErr);
          addLog('error', '🎭 Failed to connect persona', { error: personaErr.message });
        }
      } else {
        // Normal mode: Connect agent with regular microphone and journey agent config
        console.log('🎙️ About to call connect() with agentConfig:', journeyAgentConfig.name);
        console.log('🎙️ sdkAudioElement:', !!sdkAudioElement);
        addLog('info', '🎙️ Initiating WebRTC connection...');
        await connect({
          audioElement: sdkAudioElement,
          agentConfig: journeyAgentConfig,
          allJourneyAgents: allJourneyAgentsMap,
          onEventTrigger: handleEventTrigger,
          onEndCall: handleEndCall,
        });
        console.log('🎙️ connect() completed');
        addLog('success', 'Successfully initiated voice agent connection');
      }
      
      // Configure real-time saver with session info (only if user is authenticated)
      if (user) {
        // Read Prolific params from localStorage (set by MobilePreview page)
        const prolificPid = localStorage.getItem('prolific-pid');
        const prolificStudyId = localStorage.getItem('prolific-study-id');
        const prolificSessionId = localStorage.getItem('prolific-session-id');
        
        const prolificData = (prolificPid || prolificStudyId || prolificSessionId) ? {
          participantId: prolificPid || undefined,
          studyId: prolificStudyId || undefined,
          sessionId: prolificSessionId || undefined,
        } : undefined;
        
        sessionSaverRef.current.configure(
          sessionIdRef.current,
          journeyToUse ? {
            id: journeyToUse.id,
            name: journeyToUse.name,
            voice: journeyToUse.voice,
          } : undefined,
          {
            id: startingAgentName,
            name: startingAgentName,
            prompt: combinedInstructions,
            tools: azureTools,
          },
          prolificData
        );
      }
    } catch (err: any) {
      console.error("Error connecting to Azure OpenAI:", err);
      addLog('error', 'Failed to connect to Azure OpenAI', { error: err.message });
      setSessionStatus("DISCONNECTED");
    }
  };

  // Keep connectToRealtimeRef updated with latest function
  useEffect(() => {
    connectToRealtimeRef.current = connectToRealtime;
  });
  
  // Keep currentJourneyRef updated with latest journey
  useEffect(() => {
    currentJourneyRef.current = currentJourney;
  }, [currentJourney]);

  // Export transcript when session ends
  const exportSessionTranscript = () => {
    if (transcriptItems.length === 0) {
      addLog('warning', 'No transcript to export');
      return;
    }

    // Create agent config with the combined prompt for export
    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: [],
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
    });

    // Download formatted transcript (human-readable) instead of raw JSON
    downloadFormattedTranscript(sessionExport);
    addLog('success', `📥 Transcript exported: ${sessionExport.stats.totalMessages} messages`);
  };

  // Download just the prompt
  const exportPrompt = () => {
    if (!combinedPromptRef.current) {
      addLog('warning', 'No prompt to export');
      return;
    }
    downloadPrompt(combinedPromptRef.current, sessionIdRef.current);
    addLog('success', '📥 Prompt exported');
  };

  // Download both prompt and transcript
  const exportPromptAndTranscript = () => {
    if (transcriptItems.length === 0 && !combinedPromptRef.current) {
      addLog('warning', 'Nothing to export');
      return;
    }

    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: [],
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
    });

    downloadPromptAndTranscript(sessionExport);
    addLog('success', '📥 Prompt and transcript exported');
  };

  // Download raw JSON export (for developers/iteration)
  const exportRawSession = () => {
    if (transcriptItems.length === 0) {
      addLog('warning', 'No session data to export');
      return;
    }

    const agentConfig = combinedPromptRef.current ? {
      name: currentAgentRef.current,
      publicDescription: '',
      instructions: combinedPromptRef.current,
      tools: [],
    } : undefined;

    const sessionExport = createSessionExport({
      sessionId: sessionIdRef.current,
      transcript: transcriptItems,
      events: loggedEvents,
      journey: currentJourney || undefined,
      agentConfig,
    });

    downloadSessionExport(sessionExport);
    addLog('success', '📥 Raw session JSON exported');
  };

  const disconnectFromRealtime = async (forceShowFeedback: boolean = false) => {
    addLog('info', 'Disconnecting from session...');

    // Flush any pending real-time saves first
    if (user) {
      try {
        await sessionSaverRef.current.flush();
      } catch (error) {
        console.error('Failed to flush pending saves:', error);
      }
    }

    // Auto-save complete session if authenticated and has transcript
    let sessionSaved = false;
    if (user && transcriptItems.length > 0) {
      try {
        const agentConfig = combinedPromptRef.current ? {
          name: currentAgentRef.current,
          publicDescription: '',
          instructions: combinedPromptRef.current,
          tools: [],
        } : undefined;

        const sessionExport = createSessionExport({
          sessionId: sessionIdRef.current,
          transcript: transcriptItems,
          events: loggedEvents,
          journey: currentJourney || undefined,
          agentConfig,
        });

        await saveSession(sessionExport);
        addLog('success', 'Session auto-saved to cloud');
        sessionSaved = true;
        
        // Set feedback session ID for feedback form
        setFeedbackSessionId(sessionIdRef.current);
      } catch (error) {
        console.error('Failed to auto-save session:', error);
        addLog('warning', 'Failed to auto-save session to cloud');
      }
    }

    // Reset the real-time saver
    sessionSaverRef.current.reset();

    disconnect();

    // Disconnect persona if connected
    if (personaStatus !== 'DISCONNECTED') {
      disconnectPersona();
      addLog('info', '🎭 Persona disconnected');
    }

    // Clean up audio routing
    if (audioRouterRef.current) {
      audioRouterRef.current.cleanup();
      audioRouterRef.current = null;
    }

    // Disable screen rendering mode
    if (disableScreenRendering) {
      disableScreenRendering();
    }

    setSessionStatus("DISCONNECTED");
    addLog('success', 'Disconnected successfully');
    
    // Show feedback form if session was saved successfully, in preview mode, or force requested (end_call tool)
    if (sessionSaved || isPreviewMode || forceShowFeedback) {
      // Ensure feedbackSessionId is set for the form to render
      if (!feedbackSessionId) {
        setFeedbackSessionId(sessionIdRef.current);
      }
      setShowFeedbackForm(true);
    }
  };

  // Removed sendSimulatedUserMessage - not needed for Azure WebSocket

  // Audio is handled by the WebSocket client

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      // Don't create a separate mic stream - it causes feedback/crackling
      // The WebRTC connection already has the microphone
      // We'll set micStream to null to disable audio visualization
      // This prevents duplicate microphone access which causes issues

      // Start recording when audio stream becomes available
      // The audio stream is assigned asynchronously via ontrack event
      const checkAndStartRecording = () => {
        if (audioElementRef.current?.srcObject) {
          const remoteStream = audioElementRef.current.srcObject as MediaStream;
          startRecording(remoteStream);

          // Also start streaming recording to server (pass session ID to link with transcript)
          startStreamingRecording(remoteStream, sessionIdRef.current).catch((error) => {
            console.error('Failed to start streaming recording:', error);
            addLog('warning', 'Streaming recording failed to start');
          });
          return true;
        }
        return false;
      };

      // Try immediately, then poll until audio stream is available
      if (!checkAndStartRecording()) {
        console.log('🎙️ Audio stream not ready, polling...');
        const pollInterval = setInterval(() => {
          if (checkAndStartRecording()) {
            console.log('🎙️ Audio stream found, recording started');
            clearInterval(pollInterval);
          }
        }, 100);
        // Clean up after 10 seconds to avoid infinite polling
        setTimeout(() => {
          clearInterval(pollInterval);
          console.log('🎙️ Polling timed out waiting for audio stream');
        }, 10000);
      } else {
        console.log('🎙️ Recording started immediately');
      }
    }

    // Cleanup on disconnect
    if (sessionStatus === "DISCONNECTED") {
      // If we ever add mic visualization, ensure those tracks are stopped
      if (micStream) {
        console.log('🧹 Cleaning up microphone stream');
        micStream.getTracks().forEach(track => track.stop());
        setMicStream(null);
      }
      // Always stop recording to release mic usage
      stopRecording();

      // Stop streaming recording
      stopStreamingRecording().catch((error) => {
        console.error('Failed to stop streaming recording:', error);
      });
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  // Suppress unused customPrompts setter (kept for future prompt customization feature)
  void setCustomPrompts;

  const handlePersonaChange = (enabled: boolean, description: string) => {
    setPersonaEnabled(enabled);
    setPersonaDescription(description);

    // Persist to localStorage
    localStorage.setItem('voice-agent-persona-enabled', JSON.stringify(enabled));
    localStorage.setItem('voice-agent-persona-description', description);

    if (enabled) {
      addLog('info', '🎭 Persona voice testing enabled', { description: description.substring(0, 100) });
    } else {
      addLog('info', '🎭 Persona voice testing disabled');
    }
  };

  const handlePQDataChange = (data: Partial<PQData>) => {
    setPQData(data);
    localStorage.setItem('voice-agent-pq-data', JSON.stringify(data));
    addLog('info', '📝 PQ data updated', { memberName: data.memberName, primaryGoal: data.primaryGoal });
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    localStorage.setItem('voice-agent-selected-voice', voice);
    addLog('info', voice ? `🎵 Voice set to ${voice}` : '🎵 Voice set to journey default');
  };

  // Persona session - uses same implementation as voice agent
  const personaAudioElement = document.createElement('audio');
  personaAudioElement.autoplay = true;
  
  const audioRouterRef = useRef<VoiceAgentAudioRouter | null>(null);
  
  const {
    connect: connectPersona,
    disconnect: disconnectPersona,
    status: personaStatus,
  } = useAzureWebRTCSession();

  const {
    connect,
    disconnect,
    sendMessage: _sendMessage,
    setMicMuted,
  } = useAzureWebRTCSession({
    customPrompts, // Pass custom prompts to the hook
    onConnectionChange: (s) => {
      setSessionStatus(s as SessionStatus);
      if (s === 'CONNECTING') {
        addLog('info', 'Connecting to Azure OpenAI...');
      } else if (s === 'CONNECTED') {
        addLog('success', 'Connected to Azure OpenAI WebRTC');
        // Clear transitioning flag when connection succeeds
        setIsTransitioningJourney(false);
      } else if (s === 'DISCONNECTED') {
        addLog('info', 'Disconnected from Azure OpenAI');
        // Also clear transitioning flag on disconnect
        setIsTransitioningJourney(false);
      }
    },
    onTranscript: (role: string, text: string, isDone?: boolean) => {
      const roleKey = role as 'user' | 'assistant';
      const ensureMessageId = (): { id: string; isNew: boolean } => {
        const existingId = currentMessageIdsRef.current[roleKey];
        if (existingId) return { id: existingId, isNew: false };
        const newId = `msg_${role}_${Date.now()}`;
        currentMessageIdsRef.current[roleKey] = newId;
        addTranscriptMessage(newId, roleKey, text, false);
        return { id: newId, isNew: true };
      };

      // Log transcripts
      if (role === 'user') {
        const { id: messageId, isNew } = ensureMessageId();
        // Accumulate user message text
        userMessageBuffer.current += text;
        // Only append if not a new message (new messages already have the text)
        if (messageId && text && !isNew) {
          updateTranscriptMessage(messageId, text, true);
        }
        if (isDone) {
          const fullUserText = userMessageBuffer.current.trim();
          updateTranscriptItem(messageId, { status: 'DONE' });
          currentMessageIdsRef.current.user = undefined;
          // Queue completed user message for real-time saving
          // Construct the complete TranscriptItem directly instead of looking up from state
          if (user && messageId && !queuedItemIdsRef.current.has(messageId)) {
            queuedItemIdsRef.current.add(messageId);
            const completeUserMessage: TranscriptItem = {
              itemId: messageId,
              type: 'MESSAGE',
              role: 'user',
              title: fullUserText,
              expanded: false,
              timestamp: new Date().toISOString(),
              createdAtMs: Date.now(),
              status: 'DONE',
              isHidden: false,
            };
            sessionSaverRef.current.queueMessage(completeUserMessage);
          }
          // Reset user message buffer
          userMessageBuffer.current = '';
        }
        addLog('info', `User: ${text}`);
      } else {
        // Accumulate assistant response tokens
        if (!assistantResponseStartTime.current) {
          assistantResponseStartTime.current = new Date();
          // Don't set speaking state here - let audio element events handle it
        }
        assistantResponseBuffer.current += text;
        const { id: messageId, isNew } = ensureMessageId();
        // Only append if not a new message (new messages already have the text)
        if (messageId && text && !isNew) {
          updateTranscriptMessage(messageId, text, true);
        }
        
        // Only log when response is complete
        if (isDone) {
          const fullResponse = assistantResponseBuffer.current.trim();
          if (fullResponse) {
            addLog('info', `Assistant: ${fullResponse}`);
            
            // Persona will naturally hear agent via microphone - no manual routing needed
          }
          // Mark message complete + reset buffer
          updateTranscriptItem(messageId, { status: 'DONE' });
          currentMessageIdsRef.current.assistant = undefined;
          // Queue completed assistant message for real-time saving
          // Construct the complete TranscriptItem directly instead of looking up from state
          if (user && messageId && !queuedItemIdsRef.current.has(messageId)) {
            queuedItemIdsRef.current.add(messageId);
            const completeAssistantMessage: TranscriptItem = {
              itemId: messageId,
              type: 'MESSAGE',
              role: 'assistant',
              title: fullResponse,
              expanded: false,
              timestamp: assistantResponseStartTime.current?.toISOString() || new Date().toISOString(),
              createdAtMs: assistantResponseStartTime.current?.getTime() || Date.now(),
              status: 'DONE',
              isHidden: false,
            };
            sessionSaverRef.current.queueMessage(completeAssistantMessage);
          }
          assistantResponseBuffer.current = '';
          assistantResponseStartTime.current = null;
          // Don't set speaking to false here - let audio element events handle it
          // This way the orb stays "speaking" until audio actually finishes playing
        }
      }
    },
    onEvent: (event) => {
      logServerEvent(event);
      
      // Handle agent initialization
      if (event.type === 'agent_initialized') {
        addLog('agent', `Agent initialized: ${event.agentName}`, { agentName: event.agentName });
      }
      
      // Handle agent handoffs
      if (event.type === 'agent_handoff') {
        currentAgentRef.current = event.to;
        addLog('success', `✅ Agent Handoff: ${event.from} → ${event.to}`, { from: event.from, to: event.to });
      }
      
      // Handle tool execution errors (logged but not shown to AI)
      if (event.type === 'tool_execution_error') {
        addLog('error', `Tool Error: ${event.toolName} - ${event.error}`, event);
      }
      
      // Handle handoff attempts for debugging
      if (event.type === 'handoff_attempt') {
        addLog('info', `🔍 Checking Handoff: Current="${event.currentAgent}", Last Tool="${event.lastTool || 'none'}"`, event);
      }
      
      // Removed handoff_not_triggered logging - too noisy and doesn't add value to user
      // These are expected events when no handoff criteria is met
      
      // Handle conversation completion
      if (event.type === 'conversation_complete') {
        addLog('success', `🎉 ${event.message}`, event);
        addLog('info', 'Session will automatically disconnect once audio finishes...', {});
      }
      
      // Handle custom events from tools (like substance_selected, drink_logged, etc.)
      if (event.type === 'substance_selected' || 
          event.type === 'motivation_logged' || 
          event.type === 'goal_logged' ||
          event.type === 'drink_logged' ||
          event.type === 'baseline_calculated') {
        addLog('event', `Event: ${event.type}`, event);
        triggerEventUI(event.type, event);
      }
    },
    onToolCall: (toolName, args, result) => {
      // Check if result contains an internal error (for session log display only)
      const isError = typeof result === 'string' && result.includes('[INTERNAL ERROR:');
      const logType = isError ? 'error' : 'tool';
      
      addLog(logType, `Tool executed: ${toolName}`, { args, result });
      
      // Handle record_input tool specifically - update screen state
      if (toolName === 'record_input' && args.title) {
        const { title, summary = '', description = '', storeKey } = args;
        addLog('info', `📝 Recording input - Title: ${title}, Summary: ${summary}`);
        
        // Dispatch a custom event that ScreenProvider can listen to
        // This will update the screen state with the recorded input
        const event = new CustomEvent('recordInput', {
          detail: {
            title,
            summary,
            description,
            timestamp: Date.now(),
            storeKey,
          },
        });
        window.dispatchEvent(event);
        
        // Also update the global module state in AgentUIContext to ensure persistence
        if (storeKey && summary && updateModuleState) {
          updateModuleState({ [storeKey]: summary });
          addLog('info', `✅ Updated persistent module state: ${storeKey}`);
        }
        
        addLog('info', `✅ Recorded input dispatched to screen state`);
      }
      
      // Handle end_call tool - disconnect and show feedback modal
      if (toolName === 'end_call') {
        addLog('info', `📞 End call requested${args.reason ? `: ${args.reason}` : ''}`);
        // Use setTimeout to allow the tool response to be sent before disconnecting
        // Pass true to force show feedback form (same behavior as user tapping end call)
        setTimeout(() => {
          disconnectFromRealtime(true);
        }, 500);
      }
      
      // Trigger UI card for this function call with current agent context
      triggerFunctionUI(toolName, args, currentAgentRef.current);
    },
    onAgentHandoff: (from, to) => {
      currentAgentRef.current = to;
      addLog('agent', `Agent handoff complete: ${from} → ${to}`, { from, to });
      
      // Update screen rendering if new agent has different screens
      if (currentJourney) {
        const newAgentConfig = currentJourney.agents.find(a => {
          const agentName = a.name.replace(/[^a-zA-Z0-9]+(.)/g, (_, char) => char.toUpperCase()).replace(/^(.)/, (char) => char.toLowerCase());
          return agentName === to;
        });
        
        if (newAgentConfig?.screens && newAgentConfig.screens.length > 0) {
          addLog('info', `📱 Switching to ${to}'s screens (${newAgentConfig.screens.length} screens)`);
          enableScreenRendering?.(newAgentConfig.screens, newAgentConfig.screens[0].id);
        }
      }
    },
    onConversationComplete: () => {
      // This callback is triggered when the conversation naturally ends
      // Disconnect both agent and persona (if active)
      console.log('🎬 Conversation complete - disconnecting all sessions');
      disconnectFromRealtime();
    },
  });


  const handleToggleKeyboard = () => {
    setShowKeyboardInput(!showKeyboardInput);
    addLog('info', `Keyboard input ${!showKeyboardInput ? 'enabled' : 'disabled'}`);
  };

  const handleToggleMute = () => {
    const newMutedState = !isMicMuted;
    setIsMicMuted(newMutedState);
    setMicMuted(newMutedState);
    addLog('info', `Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
  };

  const handleEndCall = () => {
    if (sessionStatus === 'CONNECTED') {
      disconnectFromRealtime();
    }
  };

  // Check microphone permission before starting
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      // Permission granted - stop the stream immediately (we just needed to check)
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionError(false);
      return true;
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermissionError(true);
      return false;
    }
  }, []);

  const handleStartJourney = useCallback(async (journeyId: string) => {
    console.log('🚀 handleStartJourney called with journeyId:', journeyId);
    
    if (sessionStatus !== 'DISCONNECTED') {
      addLog('warning', 'Please disconnect current session first');
      return;
    }

    try {
      const journey = await loadJourneyForRuntime(journeyId);
      if (journey) {
        addLog('info', `🎯 Starting journey: ${journey.name} (ID: ${journeyId})`);
        console.log('📝 Journey details:', { name: journey.name, id: journey.id, agents: journey.agents.length, voiceEnabled: journey.voiceEnabled });
        
        // For voice journeys, check microphone permission first
        if (journey.voiceEnabled !== false) {
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            addLog('error', 'Microphone access is required to start the journey');
            return;
          }
        }
        
        // Update state for UI
        setCurrentJourney(journey);
        
        // Set initial module state for testing
        updateModuleState?.({
          checkInStreak: '7', // Simulate 7-day streak
        });
        
        // Pass the journey directly to connectToRealtime to avoid state closure issues
        setTimeout(() => {
          connectToRealtime(journey); // Pass journey directly, don't rely on state
        }, 300);
      } else {
        addLog('error', `Failed to load journey with ID: ${journeyId}`);
        console.error('❌ Journey not found:', journeyId);
      }
    } catch (error) {
      console.error('❌ Error starting journey:', error);
      addLog('error', `Error starting journey: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [sessionStatus, addLog, setCurrentJourney, connectToRealtime, checkMicrophonePermission]);

  // Show loading overlay while preview mode is loading the journey
  if (previewLoading) {
    return (
      <div className="voice-agent voice-agent-preview-loading">
        <div className="preview-loading-content">
          <div className="preview-loading-spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="voice-agent">
      <AgentUIRenderer
        bottomBar={sessionStatus === 'CONNECTED' && !isNonVoiceMode ? (
          <VoiceControlBar
            isListening={true}
            isMuted={isMicMuted}
            onToggleKeyboard={handleToggleKeyboard}
            onToggleMute={handleToggleMute}
            onEndCall={handleEndCall}
            showKeyboardInput={showKeyboardInput}
          />
        ) : undefined}
        onOpenSettings={sessionStatus === 'CONNECTED' && !isPreviewMode && !isNonVoiceMode ? () => setSettingsOpen(true) : undefined}
        onExit={sessionStatus === 'CONNECTED' && isNonVoiceMode ? () => {
          setSessionStatus('DISCONNECTED');
          setIsNonVoiceMode(false);
          disableScreenRendering?.();
          setHasScreensVisible(false);
          addLog('info', 'Non-voice session ended');
        } : undefined}
        showNotificationPopup={showNotificationPopup}
        onNotificationAllow={() => {
          setShowNotificationPopup(false);
          updateModuleState?.({ notificationsEnabled: true });
          console.log('🔔 Notifications enabled');
        }}
        onNotificationDeny={() => {
          setShowNotificationPopup(false);
          updateModuleState?.({ notificationsEnabled: false });
          console.log('🔔 Notifications denied');
        }}
      />
      
      {/* Header - Show when disconnected and NOT in preview mode or transitioning */}
      {sessionStatus === 'DISCONNECTED' && !isPreviewMode && !isTransitioningJourney && (
        <div className="voice-agent-header">
          <h2 className="voice-agent-title">Flows</h2>
          {isAdmin && (
            <button
              className="voice-agent-create-btn"
              onClick={() => navigate('/builder?new=true')}
            >
              Create Flow
            </button>
          )}
        </div>
      )}

      {/* Persona Settings Panel */}
      {settingsOpen && sessionStatus === 'DISCONNECTED' && (
        <div className="voice-agent-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="voice-agent-settings-panel voice-agent-settings-compact" onClick={(e) => e.stopPropagation()}>
            <div className="voice-agent-settings-header">
              <h2>Member Settings</h2>
              <button
                className="voice-agent-settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="voice-agent-settings-content">
              <MemberPersonaEditor
                disabled={sessionStatus !== 'DISCONNECTED'}
                onPersonaChange={handlePersonaChange}
                onPQDataChange={handlePQDataChange}
                onVoiceChange={handleVoiceChange}
                onSave={() => setSettingsOpen(false)}
                initialEnabled={personaEnabled}
                initialDescription={personaDescription}
                initialPQData={pqData}
                initialVoice={selectedVoice}
              />
            </div>
          </div>
        </div>
      )}

      {/* Session Logs Panel - Only during active session */}
      {settingsOpen && sessionStatus === 'CONNECTED' && (
        <div className="voice-agent-settings-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="voice-agent-settings-panel" onClick={(e) => e.stopPropagation()}>
            <div className="voice-agent-settings-header">
              <h2>Session Logs</h2>
              <button
                className="voice-agent-settings-close"
                onClick={() => setSettingsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="voice-agent-settings-content">
              {/* Export Controls */}
              <div className="voice-agent-export-controls">
                <h3>Export Session</h3>
                <div className="voice-agent-export-buttons">
                  <button
                    className="voice-agent-export-btn"
                    onClick={exportPromptAndTranscript}
                    title="Download both the prompt and a formatted transcript"
                  >
                    Download Prompt + Transcript
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-secondary"
                    onClick={exportPrompt}
                    title="Download just the prompt that was sent to the agent"
                  >
                    Prompt Only
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-secondary"
                    onClick={exportSessionTranscript}
                    title="Download human-readable conversation transcript"
                  >
                    Transcript Only
                  </button>
                  <button
                    className="voice-agent-export-btn voice-agent-export-btn-tertiary"
                    onClick={exportRawSession}
                    title="Download raw JSON for developer iteration"
                  >
                    Raw JSON (Dev)
                  </button>
                </div>
              </div>

              <SessionLogViewer logs={sessionLogs} />
            </div>
          </div>
        </div>
      )}

      {/* Journeys Content - Hide in preview mode and during journey transitions */}
      {!isPreviewMode && !isTransitioningJourney && (
      <div className="voice-agent-content">
        <div className="voice-agent-session-view">
          {sessionStatus === 'DISCONNECTED' ? (
            <div className="journeys-grid-container">
              <div className="journeys-grid">
                {availableJourneys.map((journey) => {
                    // Map journey names to gradient backgrounds and icons
                    const getJourneyStyle = (name: string) => {
                      if (name.toLowerCase().includes('intake')) {
                        return { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', icon: '🎙️' };
                      }
                      if (name.toLowerCase().includes('mental') || name.toLowerCase().includes('screening')) {
                        return { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', icon: '🧠' };
                      }
                      if (name.toLowerCase().includes('january') || name.toLowerCase().includes('dry')) {
                        return { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', icon: '🎯' };
                      }
                      return { gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)', icon: '✨' };
                    };
                    
                    const style = getJourneyStyle(journey.name);
                    
                    return (
                      <div key={journey.id} className="journey-card">
                        <div
                          className="journey-card-image-placeholder"
                          style={{ background: style.gradient }}
                        >
                          <span className="journey-card-icon">{style.icon}</span>
                          <div className="journey-card-actions">
                            {isAdmin && (
                              <button
                                className="journey-card-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/builder?id=${journey.id}`);
                                }}
                                title="Edit flow"
                              >
                                <EditIcon size={14} />
                              </button>
                            )}
                            <button
                              className="journey-card-settings-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettingsOpen(true);
                              }}
                              title="Configure testing persona"
                            >
                              <SettingsIcon size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="journey-card-header">
                          <h3 className="journey-card-title">{journey.name}</h3>
                          <span className="journey-card-badge">{journey.agentCount} {journey.agentCount === 1 ? 'agent' : 'agents'}</span>
                        </div>
                        <p className="journey-card-description">{journey.description}</p>
                        <button
                          className="journey-card-start-btn"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Start button clicked for journey:', journey.id);
                            handleStartJourney(journey.id);
                          }}
                          disabled={sessionStatus !== 'DISCONNECTED'}
                          type="button"
                        >
                          Start
                        </button>
                      </div>
                    );
                  })}
                  
                  {journeysLoading && (
                    <div className="journeys-loading-state">
                      <p>Loading flows...</p>
                    </div>
                  )}
                  {!journeysLoading && availableJourneys.length === 0 && (
                    <div className="journeys-empty-state">
                      <h3>No flows available</h3>
                      <p>Click "Create Flow" to get started</p>
                    </div>
                  )}
              </div>

            </div>
          ) : null}
        </div>
      </div>
      )}
      
      {/* Microphone Permission Error Modal */}
      {micPermissionError && (
        <div className="voice-agent-settings-overlay" onClick={() => setMicPermissionError(false)}>
          <div className="mic-permission-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mic-permission-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
              </svg>
            </div>
            <h3>Microphone Access Required</h3>
            <p>To start this flow, we need access to your microphone. Please enable microphone permissions in your browser settings and try again.</p>
            <div className="mic-permission-instructions">
              <strong>How to enable:</strong>
              <ol>
                <li>Click the lock or settings icon in your browser's address bar</li>
                <li>Find "Microphone" in the permissions list</li>
                <li>Change the setting to "Allow"</li>
                <li>Refresh the page and try again</li>
              </ol>
            </div>
            <button 
              className="mic-permission-btn"
              onClick={() => setMicPermissionError(false)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
      
      {/* Feedback Form Modal */}
      {showFeedbackForm && feedbackSessionId && (
        <FeedbackForm
          voiceSessionId={feedbackSessionId}
          isPreviewMode={isPreviewMode}
          onSubmit={() => {
            setShowFeedbackForm(false);
            setFeedbackSessionId(null);
          }}
          onSkip={() => {
            setShowFeedbackForm(false);
            setFeedbackSessionId(null);
          }}
        />
      )}
      
    </div>
  );
}

// Wrapper with Providers
const VoiceAgent: React.FC = () => {
  return (
    <ErrorBoundary componentName="VoiceAgent">
      <TranscriptProvider>
        <EventProvider>
          <AgentUIProvider>
            <VoiceAgentContent />
          </AgentUIProvider>
        </EventProvider>
      </TranscriptProvider>
    </ErrorBoundary>
  );
};

export default VoiceAgent;
