import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Agent, VOICE_OPTIONS, Screen } from '../../types/journey';
import ToolEditor from './ToolEditor';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { SettingsIcon, FileTextIcon, ToolIcon, EditIcon, TrashIcon, UploadIcon } from '../Icons';
import { updateScreenDeeplinks } from '../../lib/voiceAgent/screenUtils';
import './AgentNodeEditor.css';

interface AgentNodeEditorProps {
  agent: Agent | null;
  allAgents: Agent[];
  journeyId?: string;
  onChange: (agent: Agent) => void;
  onClose: () => void;
  disabled?: boolean;
}

const AgentNodeEditor: React.FC<AgentNodeEditorProps> = ({
  agent,
  allAgents,
  journeyId,
  onChange,
  onClose,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'config' | 'tools' | 'screens'>('config');
  const [showScreensCodeView, setShowScreensCodeView] = useState(false);
  const screensImportRef = useRef<HTMLInputElement>(null);

  if (!agent) {
    return (
      <div className="agent-node-editor-empty">
        <p>Select an agent from the flow to edit its configuration</p>
      </div>
    );
  }

  const handleUpdate = (updates: Partial<Agent>) => {
    onChange({ ...agent, ...updates });
  };

  const handleToggleHandoff = (targetAgentId: string) => {
    const handoffs = agent.handoffs.includes(targetAgentId)
      ? agent.handoffs.filter(id => id !== targetAgentId)
      : [...agent.handoffs, targetAgentId];
    handleUpdate({ handoffs });
  };

  const availableHandoffTargets = allAgents.filter(a => a.id !== agent.id);

  const handleAddScreen = (templateId?: string) => {
    let newScreen: Screen;

    if (templateId) {
      const template = SCREEN_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        newScreen = template.createScreen();
        newScreen.id = `${templateId}_${Date.now()}`;
      } else {
        newScreen = {
          id: `screen_${uuidv4()}`,
          title: 'New Screen',
          sections: [],
          events: [],
        };
      }
    } else {
      newScreen = {
        id: `screen_${uuidv4()}`,
        title: 'New Screen',
        sections: [],
        events: [],
      };
    }

    const newScreens = [...(agent.screens || []), newScreen];
    const updatedScreens = updateScreenDeeplinks(newScreens);
    
    const updatedAgent = {
      ...agent,
      screens: updatedScreens,
      screenPrompts: { ...(agent.screenPrompts || {}), [newScreen.id]: '' },
    };

    onChange(updatedAgent);
    
    // Navigate to Screen Builder with the new screen
    navigate('/screens', { 
      state: { 
        editScreen: newScreen,
        agentId: agent.id,
        agentName: agent.name,
        journeyId
      } 
    });
  };

  const handleEditScreen = (screen: Screen) => {
    navigate('/screens', { 
      state: { 
        editScreen: screen,
        agentId: agent.id,
        agentName: agent.name,
        journeyId
      } 
    });
  };

  const handleDeleteScreen = (index: number) => {
    if (!agent.screens) return;
    
    const screenToDelete = agent.screens[index];
    const { [screenToDelete.id]: _, ...remainingPrompts } = agent.screenPrompts || {};
    const filteredScreens = agent.screens.filter((_, i) => i !== index);
    const updatedScreens = updateScreenDeeplinks(filteredScreens);
    
    onChange({
      ...agent,
      screens: updatedScreens,
      screenPrompts: remainingPrompts,
    });
  };

  const handleImportScreens = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        
        if (Array.isArray(imported)) {
          const updatedScreens = updateScreenDeeplinks(imported);
          handleUpdate({ screens: updatedScreens });
        } else if (imported.screens && Array.isArray(imported.screens)) {
          const updatedScreens = updateScreenDeeplinks(imported.screens);
          handleUpdate({ 
            screens: updatedScreens,
            screenPrompts: imported.screenPrompts ?? agent.screenPrompts,
          });
        }
      } catch {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    
    if (screensImportRef.current) {
      screensImportRef.current.value = '';
    }
  };

  return (
    <div className={`agent-node-editor ${disabled ? 'disabled' : ''}`}>
      <div className="agent-editor-header">
        <h3><SettingsIcon size={16} /> {agent.name}</h3>
        <button
          className="agent-editor-close"
          onClick={onClose}
          type="button"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="agent-editor-tabs">
        <button
          className={`agent-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
          type="button"
        >
          <FileTextIcon size={14} /> Configuration
        </button>
        <button
          className={`agent-tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
          type="button"
        >
          <ToolIcon size={14} /> Tools
          {agent.tools.length > 0 && (
            <span className="agent-tab-badge">{agent.tools.length}</span>
          )}
        </button>
        <button
          className={`agent-tab ${activeTab === 'screens' ? 'active' : ''}`}
          onClick={() => setActiveTab('screens')}
          type="button"
        >
          📱 Screens
          {agent.screens && agent.screens.length > 0 && (
            <span className="agent-tab-badge">{agent.screens.length}</span>
          )}
        </button>
      </div>

      <div className="agent-editor-content">
        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <>
            {/* Basic Info */}
            <div className="agent-section">
              <h4>Basic Information</h4>
          
          <div className="agent-field">
            <label>Agent Name</label>
            <input
              type="text"
              value={agent.name}
              onChange={(e) => handleUpdate({ name: e.target.value })}
              placeholder="Agent Name"
              disabled={disabled}
            />
          </div>

          <div className="agent-field">
            <label>Voice</label>
            <select
              value={agent.voice}
              onChange={(e) => handleUpdate({ voice: e.target.value })}
              disabled={disabled}
            >
              {VOICE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="agent-field">
            <label>Handoff Description</label>
            <input
              type="text"
              value={agent.handoffDescription || ''}
              onChange={(e) => handleUpdate({ handoffDescription: e.target.value })}
              placeholder="Describe this agent's role in the flow"
              disabled={disabled}
            />
          </div>
        </div>

        {/* Prompt */}
        <div className="agent-section">
          <h4>Agent Prompt</h4>
          <div className="agent-field">
            <label>Instructions</label>
            <textarea
              value={agent.prompt}
              onChange={(e) => handleUpdate({ prompt: e.target.value })}
              placeholder="Define specific instructions for this agent..."
              disabled={disabled}
              rows={10}
            />
            <span className="agent-field-hint">
              Combined with system prompt to create final instructions for this agent.
            </span>
          </div>
        </div>

            {/* Handoffs */}
            <div className="agent-section">
              <h4>Handoffs</h4>
              <p className="agent-section-description">
                Select which agents this agent can hand off to
              </p>
              
              {availableHandoffTargets.length === 0 ? (
                <div className="handoff-empty">
                  No other agents available. Create more agents to enable handoffs.
                </div>
              ) : (
                <div className="handoff-list">
                  {availableHandoffTargets.map(targetAgent => (
                    <label key={targetAgent.id} className="handoff-option">
                      <input
                        type="checkbox"
                        checked={agent.handoffs.includes(targetAgent.id)}
                        onChange={() => handleToggleHandoff(targetAgent.id)}
                        disabled={disabled}
                      />
                      <span className="handoff-label">{targetAgent.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className="agent-section">
            <ToolEditor
              tools={agent.tools}
              onChange={(tools) => handleUpdate({ tools })}
              disabled={disabled}
            />
          </div>
        )}

        {/* Screens Tab */}
        {activeTab === 'screens' && (
          <div className="agent-section agent-screens-section">
            <div className="agent-screens-header">
              <h4>Screens (SDUI)</h4>
              <div className="agent-screens-actions">
                <div className="agent-screens-view-toggle">
                  <button
                    className={`agent-view-toggle-btn ${!showScreensCodeView ? 'active' : ''}`}
                    onClick={() => setShowScreensCodeView(false)}
                    type="button"
                  >
                    List
                  </button>
                  <button
                    className={`agent-view-toggle-btn ${showScreensCodeView ? 'active' : ''}`}
                    onClick={() => setShowScreensCodeView(true)}
                    type="button"
                  >
                    Code
                  </button>
                </div>
                <input
                  ref={screensImportRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportScreens}
                  style={{ display: 'none' }}
                />
                <button
                  className="agent-import-btn"
                  onClick={() => screensImportRef.current?.click()}
                  disabled={disabled}
                  type="button"
                  title="Import screens from JSON"
                >
                  <UploadIcon size={14} /> Import
                </button>
                <button
                  className="agent-add-screen-btn"
                  onClick={() => handleAddScreen()}
                  disabled={disabled}
                  type="button"
                >
                  + Add Screen
                </button>
              </div>
            </div>
            <p className="agent-section-description">
              Define screen-based UI for this agent. Screens enable visual interactions alongside voice.
            </p>

            {showScreensCodeView ? (
              <div className="agent-screens-code-view">
                <textarea
                  className="agent-screens-code-editor"
                  value={JSON.stringify({ screens: agent.screens || [], screenPrompts: agent.screenPrompts || {} }, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (parsed.screens && Array.isArray(parsed.screens)) {
                        handleUpdate({ 
                          screens: parsed.screens,
                          screenPrompts: parsed.screenPrompts ?? agent.screenPrompts,
                        });
                      }
                    } catch {
                      // Invalid JSON, ignore
                    }
                  }}
                  disabled={disabled}
                  spellCheck={false}
                />
              </div>
            ) : !agent.screens || agent.screens.length === 0 ? (
              <div className="screens-empty">
                <p>No screens defined yet.</p>
                <button 
                  onClick={() => handleAddScreen()} 
                  disabled={disabled}
                  className="agent-add-screen-empty-btn"
                  type="button"
                >
                  + Create First Screen
                </button>
              </div>
            ) : (
              <div className="agent-screens-list">
                {agent.screens.map((screen, index) => (
                  <div 
                    key={screen.id}
                    className="agent-screen-item"
                  >
                    <div className="agent-screen-item-header">
                      <strong>{screen.id}</strong>
                      <span className="agent-screen-item-id">{screen.title}</span>
                    </div>
                    <div className="agent-screen-item-meta">
                      {screen.sections.length} section(s), {' '}
                      {screen.sections.reduce((acc, s) => acc + s.elements.length, 0)} element(s)
                    </div>
                    <div className="agent-screen-item-actions">
                      <button 
                        onClick={() => handleEditScreen(screen)} 
                        disabled={disabled}
                        type="button"
                      >
                        <EditIcon size={12} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteScreen(index)} 
                        disabled={disabled}
                        type="button"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {agent.screens && agent.screens.length > 0 && (
              <div className="screens-prompt-status">
                {agent.screenPrompts && Object.keys(agent.screenPrompts).length > 0 ? (
                  <span className="screens-prompt-ok">
                    ✓ {Object.keys(agent.screenPrompts).length} prompt(s) defined
                  </span>
                ) : (
                  <span className="screens-prompt-warning">
                    ⚠️ No prompts defined
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentNodeEditor;

