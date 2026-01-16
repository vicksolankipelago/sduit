import React from 'react';
import { AgentMessageCardElementState, AgentMessageCardElementStyle } from '../../../types/journey';
import { mapIOSColorToCSSVar } from '../../../hooks/usePelagoDesignSystem';
import './AgentMessageCardElement.css';

export interface AgentMessageCardElementProps {
  data: AgentMessageCardElementState;
  style?: AgentMessageCardElementStyle;
}

export const AgentMessageCardElement: React.FC<AgentMessageCardElementProps> = ({
  data,
  style,
}) => {
  const getCardStyle = (): React.CSSProperties => {
    const styles: React.CSSProperties = {};
    
    if (style?.backgroundColor) {
      const cssVar = mapIOSColorToCSSVar(style.backgroundColor);
      styles.backgroundColor = `var(${cssVar})`;
    }
    
    if (style?.cornerRadius) {
      styles.borderRadius = `${style.cornerRadius}px`;
    }
    
    return styles;
  };

  const formatTime = (timestamp?: string): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  return (
    <div 
      className="agent-message-card-element"
      style={getCardStyle()}
      data-element-id={data.id}
    >
      <div className="agent-message-card-header">
        <div className="agent-message-card-avatar">
          {data.avatar || '🤖'}
        </div>
        <div className="agent-message-card-meta">
          <div className="agent-message-card-name pelago-body-2-bold">
            {data.agentName || 'Agent'}
          </div>
          {data.timestamp && (
            <div className="agent-message-card-time pelago-caption-2-regular">
              {formatTime(data.timestamp)}
            </div>
          )}
        </div>
      </div>
      <div className="agent-message-card-message pelago-body-1-regular">
        {data.message}
      </div>
    </div>
  );
};

export default AgentMessageCardElement;

