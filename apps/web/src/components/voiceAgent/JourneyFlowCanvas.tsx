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

const DRAG_THRESHOLD = 5; // Pixels of movement before considered a drag

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
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [pendingClickAgentId, setPendingClickAgentId] = useState<string | null>(null);

  const handleMouseDown = (agentId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    // Store starting position to detect drag vs click
    setDragStart({ x: e.clientX, y: e.clientY });
    setHasDragged(false);
    setDraggingAgentId(agentId);
    setPendingClickAgentId(agentId);
  };

  useEffect(() => {
    if (!draggingAgentId) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      // Check if we've moved enough to be considered a drag
      const deltaX = Math.abs(e.clientX - dragStart.x);
      const deltaY = Math.abs(e.clientY - dragStart.y);
      
      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        setHasDragged(true);
        setPendingClickAgentId(null); // Cancel pending click
        
        const rect = canvasRef.current.getBoundingClientRect();
        const x = Math.max(100, Math.min(e.clientX - rect.left, rect.width - 100));
        const y = Math.max(60, Math.min(e.clientY - rect.top, rect.height - 60));

        onAgentMove(draggingAgentId, { x, y });
      }
    };

    const handleMouseUp = () => {
      // If we didn't drag, trigger click
      if (!hasDragged && pendingClickAgentId) {
        onAgentSelect(pendingClickAgentId);
      }
      setDraggingAgentId(null);
      setPendingClickAgentId(null);
      setHasDragged(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingAgentId, dragStart, hasDragged, pendingClickAgentId, onAgentMove, onAgentSelect]);

  // Auto-layout agents if they don't have positions
  useEffect(() => {
    const needsLayout = agents.some(a => !a.position || (a.position.x === 0 && a.position.y === 0));
    if (!needsLayout || !canvasRef.current) return;

    // Wait for canvas to be properly sized
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0) return;
    
    // Ensure cards are positioned with enough margin from edges
    // Card is ~180px wide, with transform -50%, so need at least 100px from edge
    const minX = 120;
    const centerX = Math.max(minX, rect.width / 2);
    const startY = 120;
    const spacing = 160;

    agents.forEach((agent, index) => {
      if (!agent.position || (agent.position.x === 0 && agent.position.y === 0)) {
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
          >
            {isStarting && <div className="agent-node-badge">START</div>}
            
            <div className="agent-node-content">
              <div className="agent-node-header">
                <div className="agent-node-name">{agent.name}</div>
                <div className="agent-node-voice">{agent.voice}</div>
              </div>
              
              <div className="agent-node-stats">
                <span className="agent-stat">
                  {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                </span>
                <span className="agent-stat">
                  {agent.handoffs.length} handoff{agent.handoffs.length !== 1 ? 's' : ''}
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

