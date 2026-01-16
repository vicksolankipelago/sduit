import React, { useState } from 'react';
import './AgentPromptEditor.css';

interface AgentPromptEditorProps {
  disabled?: boolean;
  onPromptsChange?: (prompts: Record<string, string>) => void;
}

const DEFAULT_PROMPTS = {
  greeter: `You MUST speak in English only. You're a warm, empathetic counsellor at Pelago. Welcome them naturally and ask what brings them here. When they mention the substance they want help with, acknowledge it warmly. The conversation will flow naturally—you don't need to announce transitions. Keep it brief and warm. Make them feel heard and safe. Never mention technical issues or other agents.`,
  motivationAgent: `You're continuing the conversation. They've already shared what they want help with. Explore what matters to them—what's driving this decision? Listen for motivations and goals (family, health, personal). Reflect back what you hear. Once you've understood a few key items, acknowledge how meaningful these are. Be genuinely curious, not interrogating. Never mention next steps or technical processes.`,
  baselineCalculationAgent: `FINAL STAGE - Three parts: 1) Ask about typical week (what, how much, when) 2) Calculate & explain baseline in standard drinks (12oz beer=1, 5oz wine=1, 1.5oz liquor=1), connect to their goals 3) FINAL CLOSING: "This gives us a really clear picture. You've been so open today, and that takes courage. With what you've shared—your reasons for wanting to change and where you're at now—we have everything we need to build a plan that works for you." Then STOP. Session ends automatically. Be supportive, not judgemental.`,
};

const AGENT_NAMES = {
  greeter: 'Greeter Agent',
  motivationAgent: 'Motivation Agent',
  baselineCalculationAgent: 'Baseline Calculation Agent',
};

const AgentPromptEditor: React.FC<AgentPromptEditorProps> = ({ 
  disabled = false, 
  onPromptsChange 
}) => {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [activeAgent, setActiveAgent] = useState<string>('greeter');

  const handlePromptChange = (agentName: string, newPrompt: string) => {
    const updatedPrompts = {
      ...prompts,
      [agentName]: newPrompt,
    };
    setPrompts(updatedPrompts);
    
    // Notify parent of changes
    if (onPromptsChange) {
      onPromptsChange(updatedPrompts);
    }
  };

  const handleReset = (agentName: string) => {
    const updatedPrompts = { ...prompts };
    delete updatedPrompts[agentName];
    setPrompts(updatedPrompts);
    
    if (onPromptsChange) {
      onPromptsChange(updatedPrompts);
    }
  };

  const handleResetAll = () => {
    setPrompts({});
    if (onPromptsChange) {
      onPromptsChange({});
    }
  };

  const getCurrentPrompt = (agentName: string): string => {
    return prompts[agentName] || DEFAULT_PROMPTS[agentName as keyof typeof DEFAULT_PROMPTS] || '';
  };

  const isModified = (agentName: string): boolean => {
    return agentName in prompts;
  };

  const hasAnyModifications = (): boolean => {
    return Object.keys(prompts).length > 0;
  };

  return (
    <div className={`agent-prompt-editor expanded ${disabled ? 'disabled' : ''}`}>
      {disabled && (
        <div className="prompt-disabled-banner">
          <span className="prompt-disabled-notice">⚠️ Disconnect voice session to edit prompts</span>
        </div>
      )}

      {!disabled && (
        <div className="prompt-editor-content">
          <div className="prompt-editor-description">
            <p>Customise the instructions for each agent. These prompts control how the agents behave during the conversation.</p>
          </div>

          <div className="prompt-agent-tabs">
            {Object.entries(AGENT_NAMES).map(([agentKey, agentLabel]) => (
              <button
                key={agentKey}
                className={`prompt-tab ${activeAgent === agentKey ? 'active' : ''} ${isModified(agentKey) ? 'modified' : ''}`}
                onClick={() => setActiveAgent(agentKey)}
              >
                {agentLabel}
                {isModified(agentKey) && <span className="tab-modified-dot">●</span>}
              </button>
            ))}
          </div>

          <div className="prompt-editor-panel">
            <div className="prompt-panel-header">
              <h4>{AGENT_NAMES[activeAgent as keyof typeof AGENT_NAMES]}</h4>
              <div className="prompt-panel-actions">
                {isModified(activeAgent) && (
                  <button
                    className="prompt-action-button reset"
                    onClick={() => handleReset(activeAgent)}
                    title="Reset to default"
                  >
                    ↺ Reset
                  </button>
                )}
              </div>
            </div>

            <textarea
              className="prompt-textarea"
              value={getCurrentPrompt(activeAgent)}
              onChange={(e) => handlePromptChange(activeAgent, e.target.value)}
              placeholder={`Enter custom instructions for ${AGENT_NAMES[activeAgent as keyof typeof AGENT_NAMES]}...`}
              rows={8}
            />

            {isModified(activeAgent) && (
              <div className="prompt-modified-notice">
                ✓ Using custom prompt for this agent
              </div>
            )}
          </div>

          {hasAnyModifications() && (
            <div className="prompt-editor-footer">
              <button
                className="prompt-action-button reset-all"
                onClick={handleResetAll}
              >
                Reset All to Defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AgentPromptEditor;

