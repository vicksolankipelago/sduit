/**
 * ElevenLabs Connection Test Page
 * 
 * A simple test page using the ElevenLabs SDK DIRECTLY (not our wrapper)
 * to verify the connection works with the basic SDK example.
 */

import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';

const TEST_AGENT_ID = 'agent_7001kga118rtf1q9c72ay45512ad';

export default function ElevenLabsTest() {
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logEntry]);
    console.log(`[ElevenLabs Test] ${message}`);
  }, []);

  // Use the ElevenLabs SDK DIRECTLY - exactly like the docs example
  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      addLog(`Connected! ID: ${conversationId}`);
    },
    onDisconnect: () => {
      addLog('Disconnected');
    },
    onError: (error) => {
      addLog(`Error: ${error}`);
      console.error('ElevenLabs error:', error);
    },
    onMessage: (message) => {
      addLog(`Message: ${JSON.stringify(message).substring(0, 100)}...`);
    },
    onModeChange: ({ mode }) => {
      addLog(`Mode: ${mode}`);
    },
  });

  const handleConnect = async () => {
    addLog('Connecting...');
    console.log('🟢 handleConnect clicked');
    
    try {
      // Simple connection - exactly like the docs
      const conversationId = await conversation.startSession({
        agentId: TEST_AGENT_ID,
        connectionType: 'webrtc',
      });
      
      addLog(`Session started: ${conversationId}`);
      console.log('🟢 Session started:', conversationId);
    } catch (error: any) {
      addLog(`Error: ${error.message || error}`);
      console.error('🔴 Connection error:', error);
    }
  };

  const handleDisconnect = async () => {
    addLog('Disconnecting...');
    await conversation.endSession();
  };

  const isConnected = conversation.status === 'connected';

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px' }}>ElevenLabs Connection Test (Direct SDK)</h1>
      
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <p><strong>Agent ID:</strong> {TEST_AGENT_ID}</p>
        <p><strong>Status:</strong> <span style={{ color: isConnected ? 'green' : 'gray' }}>{conversation.status}</span></p>
        <p><strong>Speaking:</strong> {conversation.isSpeaking ? 'Yes' : 'No'}</p>
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
