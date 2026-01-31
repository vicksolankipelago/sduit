/**
 * ElevenLabs Connection Test Page
 * 
 * A simple test page to verify ElevenLabs Conversational AI connection works
 * with the provided agent ID, prompt overrides, and client tools.
 */

import { useState, useCallback } from 'react';
import { useElevenLabsSession } from '../hooks/voiceAgent/useElevenLabsSession';

const TEST_AGENT_ID = 'agent_7001kga118rtf1q9c72ay45512ad';

export default function ElevenLabsTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
    console.log(`[ElevenLabs Test] ${message}`);
  }, []);

  const { status, connect, disconnect, isSpeaking } = useElevenLabsSession({
    onConnectionChange: (s) => {
      addLog(`Connection status: ${s}`);
      setIsConnected(s === 'CONNECTED');
    },
    onTranscript: (role, text) => {
      addLog(`${role}: ${text}`);
    },
    onModeChange: (mode) => {
      addLog(`Mode: ${mode}`);
    },
    onConversationComplete: () => {
      addLog('Conversation complete');
    },
  });

  const testClientTools = {
    end_call: async (params: { reason?: string }) => {
      addLog(`Tool called: end_call with reason: ${params.reason || 'none'}`);
      return { success: true, message: 'Call ended' };
    },
    show_screen: async (params: { screenId: string }) => {
      addLog(`Tool called: show_screen with screenId: ${params.screenId}`);
      return { success: true, screenId: params.screenId };
    },
    collect_data: async (params: { key: string; value: string }) => {
      addLog(`Tool called: collect_data - ${params.key}: ${params.value}`);
      return { success: true };
    },
  };

  const handleConnect = async () => {
    addLog('Starting connection...');
    try {
      await connect({
        elevenLabsAgentId: TEST_AGENT_ID,
        agentConfig: {
          name: 'Test Agent',
          instructions: 'You are a helpful test assistant. Keep responses brief.',
          voice: 'alloy',
        },
        clientTools: testClientTools,
        dynamicVariables: {
          user_name: 'Test User',
          session_id: `test_${Date.now()}`,
        },
      });
      addLog('Connection initiated successfully');
    } catch (error: any) {
      addLog(`Connection error: ${error.message}`);
    }
  };

  const handleDisconnect = async () => {
    addLog('Disconnecting...');
    await disconnect();
    addLog('Disconnected');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>ElevenLabs Connection Test</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <p><strong>Agent ID:</strong> {TEST_AGENT_ID}</p>
        <p><strong>Status:</strong> <span style={{ color: isConnected ? 'green' : 'gray' }}>{status}</span></p>
        <p><strong>Speaking:</strong> {isSpeaking ? 'Yes' : 'No'}</p>
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
          <li>Agent ID: Using your ElevenLabs dashboard agent</li>
          <li>Prompt Override: Custom instructions passed to agent</li>
          <li>Client Tools: end_call, show_screen, collect_data</li>
          <li>Dynamic Variables: user_name, session_id</li>
        </ul>
      </div>

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
