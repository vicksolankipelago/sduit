/**
 * ElevenLabs Connection Test Page
 *
 * A simple test page using the ElevenLabs SDK DIRECTLY (not our wrapper)
 * to verify the connection works with the basic SDK example.
 *
 * Also tests client tools to verify they're being called.
 */

import { useState, useCallback, useRef } from 'react';
import { Conversation } from '@elevenlabs/client';

const TEST_AGENT_ID = 'agent_7001kga118rtf1q9c72ay45512ad';

export default function ElevenLabsTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [useOverride, setUseOverride] = useState(false);
  const [useClientTools, setUseClientTools] = useState(true);
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toolCalls, setToolCalls] = useState<string[]>([]);
  const conversationRef = useRef<Awaited<ReturnType<typeof Conversation.startSession>> | null>(null);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logEntry]);
    console.log(`[ElevenLabs Test] ${message}`);
  }, []);

  // Client tools matching VoiceAgent.tsx
  const clientTools = {
    trigger_event: async (params: { eventId: string; delay?: number }) => {
      const { eventId, delay = 0 } = params;
      const msg = `🔧 trigger_event called: ${eventId}${delay ? ` (delay: ${delay}s)` : ''}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return `Event triggered: ${eventId}`;
    },
    record_input: async (params: { title: string; summary?: string; storeKey?: string; nextEventId?: string; delay?: number }) => {
      const msg = `🔧 record_input called: ${params.title}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return `Recorded: ${params.title}`;
    },
    end_call: async (params: { reason?: string; delaySeconds?: number }) => {
      const msg = `🔧 end_call called: ${params.reason || 'No reason'}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return 'Call ending';
    },
    navigate_to_screen: async (params: { screen_id: string }) => {
      const msg = `🔧 navigate_to_screen called: ${params.screen_id}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return {
        success: true,
        event_id: null,
        from_screen: null,
        next_screen: params.screen_id,
        current_screen: params.screen_id,
        delay_seconds: 0,
        reason: 'navigation_triggered',
        message: `Navigated to: ${params.screen_id}`,
      };
    },
    navigate_to: async (params: { screen?: string; screen_id?: string; delay?: number }) => {
      const screen = params.screen ?? params.screen_id;
      const msg = `🔧 navigate_to called: ${screen}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return {
        success: true,
        event_id: null,
        from_screen: null,
        next_screen: screen ?? null,
        current_screen: screen ?? null,
        delay_seconds: params.delay ?? 0,
        reason: 'navigation_triggered',
        message: `Navigation to "${screen}" triggered.`,
      };
    },
    switch_agent: async (params: { agent_id?: string; agent_name?: string }) => {
      const msg = `🔧 switch_agent called: ${params.agent_id || params.agent_name}`;
      addLog(msg);
      setToolCalls(prev => [...prev, msg]);
      return `Switched to: ${params.agent_id || params.agent_name}`;
    },
  };

  const handleConnect = async () => {
    addLog('Connecting with VANILLA SDK (not React hook)...');
    addLog(`Override enabled: ${useOverride}`);
    addLog(`Client tools enabled: ${useClientTools}`);
    console.log('🟢 handleConnect clicked, useOverride:', useOverride, 'useClientTools:', useClientTools);
    setStatus('connecting');
    setToolCalls([]);

    try {
      const sessionConfig: Parameters<typeof Conversation.startSession>[0] = {
        agentId: TEST_AGENT_ID,
        connectionType: 'webrtc',
        onConnect: ({ conversationId }) => {
          addLog(`✅ Connected! ID: ${conversationId}`);
          setStatus('connected');
        },
        onDisconnect: () => {
          addLog('Disconnected');
          setStatus('disconnected');
          conversationRef.current = null;
        },
        onError: (error) => {
          addLog(`❌ Error: ${error}`);
          console.error('ElevenLabs error:', error);
        },
        onMessage: (message) => {
          const msg = message as any;
          if (msg.source === 'user') {
            addLog(`👤 User: ${msg.message}`);
          } else if (msg.source === 'ai') {
            addLog(`🤖 AI: ${msg.message}`);
          } else {
            addLog(`Message: ${JSON.stringify(message).substring(0, 100)}...`);
          }
        },
        onModeChange: (data) => {
          const mode = (data as any).mode;
          addLog(`🔊 Mode: ${mode}`);
          setIsSpeaking(mode === 'speaking');
        },
        onAgentToolRequest: (request) => {
          addLog(`🧰 agent_tool_request: ${(request as any)?.tool_name || 'unknown'}`);
        },
        onAgentToolResponse: (response) => {
          const toolName = (response as any)?.tool_name || 'unknown';
          const status = (response as any)?.is_error ? 'error' : ((response as any)?.is_called ? 'called' : 'not_called');
          addLog(`🧰 agent_tool_response: ${toolName} (${status})`);
        },
        onUnhandledClientToolCall: (toolCall) => {
          addLog(`🔴 unhandled_client_tool_call: ${(toolCall as any)?.tool_name || 'unknown'}`);
          console.error('ElevenLabs unhandled_client_tool_call', toolCall);
        },
      };

      // Add client tools if enabled
      if (useClientTools) {
        (sessionConfig as any).clientTools = clientTools;
        addLog(`🔧 Client tools registered: ${Object.keys(clientTools).join(', ')}`);
      }

      // Test: Pass override directly to vanilla SDK's startSession
      if (useOverride) {
        (sessionConfig as any).overrides = {
          agent: {
            prompt: {
              prompt: "You are a friendly test assistant. Respond with SHORT answers. Start by saying 'Hello! Override is working!'",
            },
          },
        };
        addLog('📝 Sending prompt override to vanilla SDK startSession');
        console.log('📝 Prompt override:', (sessionConfig as any).overrides);
      }

      addLog('🚀 Calling Conversation.startSession...');
      console.log('🚀 Session config:', {
        agentId: sessionConfig.agentId,
        connectionType: sessionConfig.connectionType,
        hasClientTools: !!(sessionConfig as any).clientTools,
        hasOverrides: !!(sessionConfig as any).overrides,
      });

      // Use vanilla SDK directly - this SHOULD support overrides in startSession
      const conversation = await Conversation.startSession(sessionConfig);
      conversationRef.current = conversation;

      addLog(`✅ Session started successfully`);
      console.log('🟢 Vanilla SDK session started');
    } catch (error: any) {
      addLog(`❌ Error: ${error.message || error}`);
      console.error('🔴 Connection error:', error);
      setStatus('disconnected');
    }
  };

  const handleDisconnect = async () => {
    addLog('Disconnecting...');
    if (conversationRef.current) {
      await conversationRef.current.endSession();
    }
    setStatus('disconnected');
  };

  const isConnected = status === 'connected';

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>ElevenLabs Connection Test (Direct SDK)</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <p><strong>Agent ID:</strong> {TEST_AGENT_ID}</p>
        <p><strong>Status:</strong> <span style={{ color: isConnected ? 'green' : 'gray' }}>{status}</span></p>
        <p><strong>Speaking:</strong> {isSpeaking ? 'Yes' : 'No'}</p>
        <p><strong>SDK:</strong> Vanilla @elevenlabs/client (not React hook)</p>
      </div>

      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={useOverride}
            onChange={(e) => setUseOverride(e.target.checked)}
            disabled={isConnected}
          />
          <span>
            <strong>Enable Prompt Override</strong> - When checked, sends a custom prompt to startSession
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={useClientTools}
            onChange={(e) => setUseClientTools(e.target.checked)}
            disabled={isConnected}
          />
          <span>
            <strong>Enable Client Tools</strong> - Register trigger_event, record_input, end_call, etc.
          </span>
        </label>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={handleConnect}
          disabled={isConnected}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: isConnected ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: isConnected ? 'not-allowed' : 'pointer',
          }}
        >
          Connect
        </button>
        <button
          onClick={handleDisconnect}
          disabled={!isConnected}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: !isConnected ? '#ccc' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: !isConnected ? 'not-allowed' : 'pointer',
          }}
        >
          Disconnect
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Clear Logs
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Test Features:</h3>
        <ul>
          <li>Using ElevenLabs SDK directly (not our wrapper)</li>
          <li>Agent ID: {TEST_AGENT_ID}</li>
          <li>Connection Type: WebRTC</li>
          <li>Client Tools: trigger_event, navigate_to, record_input, end_call, navigate_to_screen, switch_agent</li>
        </ul>
      </div>

      {toolCalls.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Tool Calls ({toolCalls.length}):</h3>
          <div style={{
            backgroundColor: '#e8f5e9',
            padding: '10px',
            borderRadius: '8px',
            fontFamily: 'monospace',
            fontSize: '13px',
          }}>
            {toolCalls.map((call, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>{call}</div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3>Connection Logs:</h3>
        <div style={{
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          padding: '15px',
          borderRadius: '8px',
          height: '300px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '13px',
        }}>
          {logs.length === 0 ? (
            <p style={{ color: '#666' }}>No logs yet. Click Connect to start.</p>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '5px' }}>{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
