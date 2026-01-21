import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Agent, VOICE_OPTIONS, Screen } from '../../types/journey';
import ToolEditor from './ToolEditor';
import { ScreenEditor } from './ScreenEditor';
import ScreenPreview from './ScreenPreview';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { getAvailableTemplates, loadPromptTemplate, PromptTemplateKey } from '../../utils/promptTemplates';
import './AgentNodeEditor.css';

interface AgentNodeEditorProps {
  agent: Agent | null;
  allAgents: Agent[];
  onChange: (agent: Agent) => void;
  onClose: () => void;
  disabled?: boolean;
}

const AgentNodeEditor: React.FC<AgentNodeEditorProps> = ({
  agent,
  allAgents,
  onChange,
  onClose,
  disabled = false,
}) => {
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'tools' | 'screens'>('config');
  const [editingScreenIndex, setEditingScreenIndex] = useState<number | null>(null);
  const [previewScreenIndex, setPreviewScreenIndex] = useState<number | null>(null);

  // Bounds-checking safety net - only reset indices if they're out of bounds
  useEffect(() => {
    const maxIndex = (agent?.screens?.length ?? 0) - 1;
    if (editingScreenIndex !== null && editingScreenIndex > maxIndex) {
      setEditingScreenIndex(maxIndex >= 0 ? maxIndex : null);
    }
    if (previewScreenIndex !== null && previewScreenIndex > maxIndex) {
      setPreviewScreenIndex(maxIndex >= 0 ? maxIndex : null);
    }
  }, [agent?.screens?.length, editingScreenIndex, previewScreenIndex]);

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

  const handleLoadTemplate = async (templateKey: PromptTemplateKey) => {
    setLoadingTemplate(true);
    setShowTemplateMenu(false);
    try {
      const templateContent = await loadPromptTemplate(templateKey);
      handleUpdate({ prompt: templateContent });
      console.log(`✅ Loaded template: ${templateKey}`);
    } catch (error) {
      console.error('Failed to load template:', error);
      alert('Failed to load prompt template. Please try again.');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const availableHandoffTargets = allAgents.filter(a => a.id !== agent.id);
  const availableTemplates = getAvailableTemplates();

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

    const updatedAgent = {
      ...agent,
      screens: [...(agent.screens || []), newScreen],
      screenPrompts: { ...(agent.screenPrompts || {}), [newScreen.id]: '' },
    };

    const newIndex = (agent.screens || []).length;
    onChange(updatedAgent);
    setEditingScreenIndex(newIndex);
    setPreviewScreenIndex(null);
  };

  const handleUpdateScreen = (index: number, screen: Screen) => {
    if (!agent.screens) return;

    const updatedScreens = [...agent.screens];
    updatedScreens[index] = screen;

    onChange({
      ...agent,
      screens: updatedScreens,
    });
  };

  const handleDeleteScreen = (index: number) => {
    if (!agent.screens) return;
    
    const screenToDelete = agent.screens[index];
    const { [screenToDelete.id]: _, ...remainingPrompts } = agent.screenPrompts || {};
    const updatedScreens = agent.screens.filter((_, i) => i !== index);
    
    onChange({
      ...agent,
      screens: updatedScreens,
      screenPrompts: remainingPrompts,
    });
    
    // Update editing index
    if (editingScreenIndex !== null) {
      if (index === editingScreenIndex) {
        // Deleted the screen we were editing - select adjacent or close
        if (updatedScreens.length === 0) {
          setEditingScreenIndex(null);
        } else {
          setEditingScreenIndex(Math.min(index, updatedScreens.length - 1));
        }
      } else if (index < editingScreenIndex) {
        // Deleted a screen before the one we were editing - decrement to stay on same logical screen
        setEditingScreenIndex(editingScreenIndex - 1);
      }
      // If deleted screen is after editingScreenIndex, no change needed
    }
    
    // Update preview index (same logic)
    if (previewScreenIndex !== null) {
      if (index === previewScreenIndex) {
        if (updatedScreens.length === 0) {
          setPreviewScreenIndex(null);
        } else {
          setPreviewScreenIndex(Math.min(index, updatedScreens.length - 1));
        }
      } else if (index < previewScreenIndex) {
        setPreviewScreenIndex(previewScreenIndex - 1);
      }
    }
  };

  return (
    <div className={`agent-node-editor ${disabled ? 'disabled' : ''}`}>
      <div className="agent-editor-header">
        <h3>⚙️ {agent.name}</h3>
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
          📝 Configuration
        </button>
        <button
          className={`agent-tab ${activeTab === 'tools' ? 'active' : ''}`}
          onClick={() => setActiveTab('tools')}
          type="button"
        >
          🔧 Tools
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
          <div className="agent-section-header-with-actions">
            <h4>Agent Prompt</h4>
            <div className="prompt-template-actions">
              <button
                className="load-template-btn"
                onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                disabled={disabled || loadingTemplate}
                type="button"
                title="Load a prompt template"
              >
                {loadingTemplate ? '⏳ Loading...' : '📄 Load Template'}
              </button>
            </div>
          </div>

          {showTemplateMenu && (
            <div className="template-menu">
              <div className="template-menu-header">
                <span>Select a template:</span>
                <button
                  className="template-menu-close"
                  onClick={() => setShowTemplateMenu(false)}
                  type="button"
                >
                  ✕
                </button>
              </div>
              <div className="template-list">
                {availableTemplates.map((template) => (
                  <button
                    key={template.key}
                    className="template-option"
                    onClick={() => handleLoadTemplate(template.key)}
                    type="button"
                  >
                    <div className="template-option-label">{template.label}</div>
                    <div className="template-option-description">{template.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          <div className="agent-field">
            <label>Instructions</label>
            <textarea
              value={agent.prompt}
              onChange={(e) => handleUpdate({ prompt: e.target.value })}
              placeholder="Define specific instructions for this agent..."
              disabled={disabled || loadingTemplate}
              rows={10}
            />
            <span className="agent-field-hint">
              Combined with system prompt to create final instructions for this agent.
              Use "Load Template" to load pre-configured prompts like voice_agent_prompt.txt
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

            <div className="agent-screen-templates">
              <span className="agent-screen-templates-label">From template:</span>
              {SCREEN_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  className="agent-screen-template-btn"
                  onClick={() => handleAddScreen(template.id)}
                  disabled={disabled}
                  title={template.description}
                  type="button"
                >
                  {template.icon} {template.name}
                </button>
              ))}
            </div>
            
            {!agent.screens || agent.screens.length === 0 ? (
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
              <div className="agent-screens-grid">
                <div className="agent-screens-list">
                  {agent.screens.map((screen, index) => (
                    <div 
                      key={screen.id}
                      className={`agent-screen-item ${editingScreenIndex === index ? 'editing' : ''} ${previewScreenIndex === index ? 'previewing' : ''}`}
                    >
                      <div className="agent-screen-item-header">
                        <strong>{screen.title}</strong>
                        <span className="agent-screen-item-id">{screen.id}</span>
                      </div>
                      <div className="agent-screen-item-meta">
                        {screen.sections.length} section(s), {' '}
                        {screen.sections.reduce((acc, s) => acc + s.elements.length, 0)} element(s)
                      </div>
                      <div className="agent-screen-item-actions">
                        <button 
                          onClick={() => setEditingScreenIndex(index)} 
                          disabled={disabled}
                          type="button"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => setPreviewScreenIndex(index)} 
                          disabled={disabled}
                          type="button"
                        >
                          👁️ Preview
                        </button>
                        <button 
                          onClick={() => handleDeleteScreen(index)} 
                          disabled={disabled}
                          type="button"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {editingScreenIndex !== null && agent.screens[editingScreenIndex] && (
                  <div className="agent-screen-editor-panel">
                    <ScreenEditor
                      screen={agent.screens[editingScreenIndex]}
                      onChange={(screen) => handleUpdateScreen(editingScreenIndex, screen)}
                      onClose={() => setEditingScreenIndex(null)}
                      disabled={disabled}
                    />
                  </div>
                )}

                {previewScreenIndex !== null && agent.screens[previewScreenIndex] && (
                  <div className="agent-screen-preview-panel">
                    <div className="agent-screen-preview-header">
                      <h4>Preview: {agent.screens[previewScreenIndex].title}</h4>
                      <button onClick={() => setPreviewScreenIndex(null)} type="button">✕</button>
                    </div>
                    <ScreenProvider initialScreen={agent.screens[previewScreenIndex]}>
                      <ScreenPreview
                        screen={agent.screens[previewScreenIndex]}
                        allScreens={agent.screens}
                        showDeviceFrame={true}
                      />
                    </ScreenProvider>
                  </div>
                )}
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

