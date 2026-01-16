import React, { useState, useRef, useEffect } from 'react';
import { Agent } from '../../types/journey';
import './JourneyFlowCanvas.css';

interface JourneyFlowCanvasProps {
  agents: Agent[];
  startingAgentId: string | null;
  selectedAgentId: string | null;
  onAgentSelect: (agentId: string) => void;
  onAgentMove: (agentId: string, position: { x: number; y: number }) => void;
  onAddAgent: () => void;
  onSetStartingAgent: (agentId: string) => void;
}

const JourneyFlowCanvas: React.FC<JourneyFlowCanvasProps> = ({
  agents,
  startingAgentId,
  selectedAgentId,
  onAgentSelect,
  onAgentMove,
  onAddAgent,
  onSetStartingAgent,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingAgentId, setDraggingAgentId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (agentId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    const agent = agents.find(a => a.id === agentId);
    if (!agent || !agent.position) return;

    setDraggingAgentId(agentId);
    setDragOffset({
      x: e.clientX - agent.position.x,
      y: e.clientY - agent.position.y,
    });
    onAgentSelect(agentId);
  };

  useEffect(() => {
    if (!draggingAgentId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.max(60, Math.min(e.clientX - rect.left - dragOffset.x, rect.width - 60));
      const y = Math.max(60, Math.min(e.clientY - rect.top - dragOffset.y, rect.height - 60));

      onAgentMove(draggingAgentId, { x, y });
    };

    const handleMouseUp = () => {
      setDraggingAgentId(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingAgentId, dragOffset, onAgentMove]);

  // Auto-layout agents if they don't have positions
  useEffect(() => {
    const needsLayout = agents.some(a => !a.position);
    if (!needsLayout || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const startY = 100;
    const spacing = 180;

    agents.forEach((agent, index) => {
      if (!agent.position) {
        onAgentMove(agent.id, {
          x: centerX,
          y: startY + (index * spacing),
        });
      }
    });
  }, [agents, onAgentMove]);

  const renderConnection = (fromAgent: Agent, toAgentId: string) => {
    const toAgent = agents.find(a => a.id === toAgentId);
    if (!fromAgent.position || !toAgent?.position) return null;

    const x1 = fromAgent.position.x;
    const y1 = fromAgent.position.y + 40; // Bottom of node
    const x2 = toAgent.position.x;
    const y2 = toAgent.position.y - 40; // Top of node

    // Calculate curved path
    const controlY = (y1 + y2) / 2;
    const path = `M ${x1} ${y1} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${y2}`;

    return (
      <path
        key={`${fromAgent.id}-${toAgentId}`}
        d={path}
        stroke="#1DB954"
        strokeWidth="2"
        fill="none"
        markerEnd="url(#arrowhead)"
        className="flow-connection"
      />
    );
  };

  return (
    <div className="journey-flow-canvas" ref={canvasRef}>
      {/* SVG Layer for connections */}
      <svg className="flow-connections-svg">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="#1DB954" />
          </marker>
        </defs>
        {agents.map(agent =>
          agent.handoffs.map(targetId => renderConnection(agent, targetId))
        )}
      </svg>

      {/* Agent Nodes */}
      {agents.map(agent => {
        const position = agent.position || { x: 100, y: 100 };
        const isStarting = agent.id === startingAgentId;
        const isSelected = agent.id === selectedAgentId;
        const isDragging = agent.id === draggingAgentId;

        return (
          <div
            key={agent.id}
            className={`flow-agent-node ${isStarting ? 'starting' : ''} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''}`}
            style={{
              left: `${position.x}px`,
              top: `${position.y}px`,
            }}
            onMouseDown={(e) => handleMouseDown(agent.id, e)}
            onClick={() => onAgentSelect(agent.id)}
          >
            {isStarting && <div className="agent-node-badge">START</div>}
            
            <div className="agent-node-content">
              <div className="agent-node-header">
                <div className="agent-node-name">{agent.name}</div>
                <div className="agent-node-voice">{agent.voice}</div>
              </div>
              
              <div className="agent-node-stats">
                <span className="agent-stat">
                  🔧 {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                </span>
                <span className="agent-stat">
                  ➡️ {agent.handoffs.length} handoff{agent.handoffs.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {!isStarting && (
              <button
                className="agent-node-set-start"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetStartingAgent(agent.id);
                }}
                title="Set as starting agent"
              >
                ⭐
              </button>
            )}
          </div>
        );
      })}

      {/* Add Agent Button */}
      <button className="flow-add-agent-btn" onClick={onAddAgent} type="button">
        + Add Agent
      </button>

      {/* Empty State */}
      {agents.length === 0 && (
        <div className="flow-empty-state">
          <h3>No agents in this journey</h3>
          <p>Click "Add Agent" to create your first agent</p>
        </div>
      )}
    </div>
  );
};

export default JourneyFlowCanvas;

