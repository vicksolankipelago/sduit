import React, { useRef, useEffect } from 'react';
import './SessionLogViewer.css';
import { Journey } from '../../types/journey';

export interface LogEntry {
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent' | 'tool' | 'event';
  message: string;
  details?: any;
}

interface SessionLogViewerProps {
  logs: LogEntry[];
  journey?: Journey | null;
  currentAgentName?: string;
  combinedPrompt?: string;
  flowContext?: Record<string, any>;
}

const SessionLogViewer: React.FC<SessionLogViewerProps> = ({ logs, journey, currentAgentName, combinedPrompt, flowContext }) => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogIcon = (type: LogEntry['type']): string => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'agent': return '🤖';
      case 'tool': return '🔧';
      case 'event': return '📢';
      default: return 'ℹ️';
    }
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  };

  const formatDetails = (details: any): string => {
    if (!details) return '';
    try {
      return JSON.stringify(details, null, 2);
    } catch {
      return String(details);
    }
  };

  return (
    <div className="session-log-viewer expanded">
      <div className="log-viewer-header">
        <div className="log-header-left">
          <h3 className="log-title">Session Logs</h3>
          <span className="log-count">{logs.length} entries</span>
        </div>
        <div className="log-header-actions">
          <button
            className="log-action-button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(
                logs.map(log => 
                  `[${formatTime(log.timestamp)}] ${getLogIcon(log.type)} ${log.message}${
                    log.details ? '\n' + formatDetails(log.details) : ''
                  }`
                ).join('\n')
              );
            }}
            title="Copy all logs"
          >
            📋 Copy
          </button>
          <button
            className="log-action-button"
            onClick={(e) => {
              e.stopPropagation();
              const sections: string[] = [];

              sections.push('='.repeat(80));
              sections.push('SESSION DEBUG EXPORT');
              sections.push(`Exported: ${new Date().toISOString()}`);
              sections.push('='.repeat(80));
              sections.push('');

              if (combinedPrompt) {
                sections.push('--- AGENT PROMPT ---');
                sections.push(combinedPrompt);
                sections.push('');
                sections.push('-'.repeat(80));
                sections.push('');
              }

              const currentAgent = journey?.agents?.find(
                a => a.name === currentAgentName || a.id === currentAgentName
              );

              if (currentAgent?.tools && currentAgent.tools.length > 0) {
                sections.push('--- TOOL DEFINITIONS ---');
                for (const tool of currentAgent.tools) {
                  sections.push(`Tool: ${tool.name}`);
                  sections.push(`  Description: ${tool.description}`);
                  if (tool.parameters) {
                    sections.push(`  Parameters: ${JSON.stringify(tool.parameters, null, 2)}`);
                  }
                  sections.push('');
                }
                sections.push('-'.repeat(80));
                sections.push('');
              }

              if (currentAgent?.screens && currentAgent.screens.length > 0) {
                sections.push('--- SCREEN CONFIGURATIONS ---');
                for (const screen of currentAgent.screens) {
                  sections.push(`Screen: ${screen.id} (${screen.title || 'untitled'})`);
                  sections.push(`  Sections: ${JSON.stringify(screen.sections, null, 2)}`);
                  if (screen.events) {
                    sections.push(`  Events: ${JSON.stringify(screen.events, null, 2)}`);
                  }
                  sections.push('');
                }
                sections.push('-'.repeat(80));
                sections.push('');
              }

              if (flowContext && Object.keys(flowContext).length > 0) {
                sections.push('--- VARIABLES / FLOW CONTEXT ---');
                for (const [key, value] of Object.entries(flowContext)) {
                  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                  sections.push(`  ${key}: ${displayValue}`);
                }
                sections.push('');
                sections.push('-'.repeat(80));
                sections.push('');
              }

              sections.push('--- SESSION LOGS ---');
              sections.push('');
              for (const log of logs) {
                sections.push(
                  `[${formatTime(log.timestamp)}] ${log.type.toUpperCase()}: ${log.message}${
                    log.details ? '\n' + formatDetails(log.details) : ''
                  }`
                );
                sections.push('');
              }

              const content = sections.join('\n');
              const blob = new Blob([content], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `session-debug-${Date.now()}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            title="Download debug export with full context"
          >
            💾 Export
          </button>
        </div>
      </div>

      <div className="log-content" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div className="log-empty-state">
            <p>No logs yet. Start a session to see real-time events.</p>
          </div>
        ) : (
          <div className="log-entries">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className="log-icon">{getLogIcon(log.type)}</span>
                <span className="log-message">{log.message}</span>
                {log.details && (
                  <details className="log-details">
                    <summary>Details</summary>
                    <pre>{formatDetails(log.details)}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionLogViewer;








