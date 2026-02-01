/**
 * Simple ElevenLabs Connection Test
 * 
 * Minimal test to verify WebRTC connection with ElevenLabs Conversational AI
 */

import { useConversation } from '@elevenlabs/react';
import { useState, useCallback } from 'react';

const AGENT_ID = 'agent_7001kga118rtf1q9c72ay45512ad';

export default function ElevenLabsSimpleTest() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logEntry]);
    console.log(logEntry);
  }, []);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      addLog(`✅ CONNECTED! Conversation ID: ${conversationId}`);
      setIsConnected(true);
    },
    onDisconnect: (details) => {
      addLog(`🔌 DISCONNECTED - reason: ${JSON.stringify(details)}`);
      setIsConnected(false);
    },
    onMessage: (message) => {
      addLog(`💬 Message from ${message.source}: ${message.message?.substring(0, 100)}...`);
    },
    onError: (error) => {
      addLog(`❌ ERROR: ${JSON.stringify(error)}`);
    },
    onModeChange: (data) => {
      addLog(`🎤 Mode: ${data.mode}`);
    },
    onStatusChange: (statusData) => {
      addLog(`📊 Status: ${statusData.status}`);
    },
  });

  const handleConnect = async () => {
    addLog('🚀 Starting connection...');
    
    // Step 1: Request microphone permission first (per ElevenLabs docs)
    addLog('🎤 Requesting microphone permission...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('🎤 Microphone permission GRANTED');
      // Keep stream briefly, then release
      setTimeout(() => {
        stream.getTracks().forEach(t => t.stop());
        addLog('🎤 Released initial mic stream');
      }, 1000);
    } catch (err: any) {
      addLog(`❌ Microphone DENIED: ${err.message}`);
      return;
    }

    // Step 2: Start ElevenLabs session
    addLog(`🔌 Calling startSession with agentId: ${AGENT_ID}`);
    try {
      const conversationId = await conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',
      });
      addLog(`✅ startSession returned: ${conversationId}`);
    } catch (err: any) {
      addLog(`❌ startSession failed: ${err.message}`);
      console.error('Full error:', err);
    }
  };

  const handleDisconnect = async () => {
    addLog('🔌 Disconnecting...');
    try {
      await conversation.endSession();
      addLog('✅ Disconnected');
    } catch (err: any) {
      addLog(`❌ Disconnect error: ${err.message}`);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui', maxWidth: 800, margin: '0 auto' }}>
      <h1>ElevenLabs Simple Test</h1>
      
      <div style={{ marginBottom: 20, padding: 15, background: '#f5f5f5', borderRadius: 8 }}>
        <p><strong>Agent ID:</strong> {AGENT_ID}</p>
        <p><strong>Status:</strong> {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
        <p><strong>Speaking:</strong> {conversation.isSpeaking ? 'Yes' : 'No'}</p>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 10 }}>
        <button
          onClick={handleConnect}
          disabled={isConnected}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            background: isConnected ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: isConnected ? 'not-allowed' : 'pointer',
          }}
        >
          Connect
        </button>
        <button
          onClick={handleDisconnect}
          disabled={!isConnected}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            background: !isConnected ? '#ccc' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: !isConnected ? 'not-allowed' : 'pointer',
          }}
        >
          Disconnect
        </button>
        <button
          onClick={() => setLogs([])}
          style={{
            padding: '12px 24px',
            fontSize: 16,
            background: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: 5,
            cursor: 'pointer',
          }}
        >
          Clear Logs
        </button>
      </div>

      <div style={{ marginBottom: 20, padding: 15, background: '#e3f2fd', borderRadius: 8 }}>
        <h3>Expected Behavior:</h3>
        <ol style={{ margin: 0, paddingLeft: 20 }}>
          <li>Click Connect → Microphone prompt should appear</li>
          <li>Grant permission → Status becomes "connected"</li>
          <li>Agent should speak its first message</li>
          <li>You should be able to talk and agent responds</li>
        </ol>
      </div>

      <div>
        <h3>Logs:</h3>
        <div style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: 15,
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 13,
          maxHeight: 400,
          overflow: 'auto',
        }}>
          {logs.length === 0 ? (
            <div style={{ color: '#888' }}>No logs yet. Click Connect to start.</div>
          ) : (
            logs.map((log, i) => (
              <div key={i} style={{ marginBottom: 4 }}>{log}</div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
