import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Journey, JourneyListItem, Agent, DEFAULT_SYSTEM_PROMPT, validateJourney, Screen } from '../../types/journey';
import { listJourneys, loadJourney, saveJourney, deleteJourney, duplicateJourney } from '../../services/journeyStorage';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { downloadAgentAsModule } from '../../services/screenExport';
import { generateScreensFromPrompts, suggestionToScreen, ScreenSuggestion } from '../../services/aiScreenGenerator';
import JourneyFlowCanvas from './JourneyFlowCanvas';
import AgentNodeEditor from './AgentNodeEditor';
import SystemPromptEditor from './SystemPromptEditor';
import ScreenEditor from './ScreenEditor';
import PromptEditor from './PromptEditor';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import ScreenPreview from './ScreenPreview';
import './JourneyBuilder.css';

interface JourneyBuilderProps {
  onLaunchJourney: (journey: Journey) => void;
  disabled?: boolean;
}

const JourneyBuilder: React.FC<JourneyBuilderProps> = ({
  onLaunchJourney,
  disabled = false,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [journeys, setJourneys] = useState<JourneyListItem[]>([]);
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [builderTab, setBuilderTab] = useState<'flow' | 'screens' | 'prompts'>('flow');
  const [editingScreenIndex, setEditingScreenIndex] = useState<number | null>(null);
  const [previewScreenIndex, setPreviewScreenIndex] = useState<number | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // AI Screen Generation state
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [showAICustomizeModal, setShowAICustomizeModal] = useState(false);
  const [aiCustomInstructions, setAiCustomInstructions] = useState('');
  const [aiGeneratedSuggestions, setAiGeneratedSuggestions] = useState<ScreenSuggestion[]>([]);
  const [isGeneratingScreens, setIsGeneratingScreens] = useState(false);
  const [_aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [previewingSuggestion, setPreviewingSuggestion] = useState<ScreenSuggestion | null>(null);

  useEffect(() => {
    // Load default journeys from codebase (async)
    const initAndLoad = async () => {
      const journeyList = await listJourneys();
      setJourneys(journeyList);
      
      // Check if we should auto-create a new flow
      if (searchParams.get('new') === 'true') {
        const newJourney: Journey = {
          id: uuidv4(),
          name: 'New Flow',
          description: 'Describe your flow',
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          agents: [],
          startingAgentId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        };
        setCurrentJourney(newJourney);
        setSelectedAgentId(null);
        setViewMode('detail');
        // Clear the query param so refreshing doesn't create another new flow
        setSearchParams({}, { replace: true });
      }
      
      // Check if we should load a specific flow for editing
      const editId = searchParams.get('id');
      if (editId) {
        const journeyToEdit = await loadJourney(editId);
        if (journeyToEdit) {
          setCurrentJourney(journeyToEdit);
          setSelectedAgentId(null);
          setViewMode('detail');
          // Clear the query param
          setSearchParams({}, { replace: true });
        }
      }
    };
    
    initAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshJourneyList = async () => {
    const journeyList = await listJourneys();
    setJourneys(journeyList);
  };

  const handleCreateNewJourney = () => {
    const newJourney: Journey = {
      id: uuidv4(),
      name: 'New Flow',
      description: 'Describe your flow',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      agents: [],
      startingAgentId: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: '1.0.0',
    };
    
    setCurrentJourney(newJourney);
    setSelectedAgentId(null);
    setViewMode('detail');
  };

  const handleLoadJourney = async (journeyId: string) => {
    if (currentJourney?.id === journeyId) {
      setViewMode('detail');
      return;
    }
    const journey = await loadJourney(journeyId);
    if (journey) {
      setCurrentJourney(journey);
      setSelectedAgentId(null);
      setViewMode('detail');
    }
  };

  const handleSaveJourney = async () => {
    if (!currentJourney) return;

    const errors = validateJourney(currentJourney);
    setValidationErrors(errors);

    if (errors.length > 0) {
      alert(`Cannot save: ${errors.length} validation error(s). Check the validation panel.`);
      return;
    }

    const saved = await saveJourney(currentJourney);
    if (saved) {
      refreshJourneyList();
      alert(`Flow "${currentJourney.name}" saved successfully!`);
    } else {
      alert('Failed to save flow');
    }
  };

  const handleDeleteJourney = (journeyId: string) => {
    if (window.confirm('Delete this flow? This cannot be undone.')) {
      deleteJourney(journeyId);
      refreshJourneyList();
      if (currentJourney?.id === journeyId) {
        setCurrentJourney(null);
        setViewMode('list');
      }
    }
  };

  // Temporarily unused - can be re-enabled when duplicate button is added to UI
  void duplicateJourney; // Silence unused import warning

  const handleAddAgent = () => {
    if (!currentJourney) return;

    const newAgent: Agent = {
      id: uuidv4(),
      name: 'New Agent',
      voice: 'sage',
      prompt: 'Define agent-specific behavior and instructions here...',
      tools: [],
      handoffs: [],
      handoffDescription: '',
      position: { x: 300, y: 100 + (currentJourney.agents.length * 180) },
    };

    const updatedJourney = {
      ...currentJourney,
      agents: [...currentJourney.agents, newAgent],
      startingAgentId: currentJourney.startingAgentId || newAgent.id,
    };

    setCurrentJourney(updatedJourney);
    setSelectedAgentId(newAgent.id);
  };

  const handleUpdateAgent = (agent: Agent) => {
    if (!currentJourney) return;

    setCurrentJourney({
      ...currentJourney,
      agents: currentJourney.agents.map(a => a.id === agent.id ? agent : a),
    });
  };

  const handleDeleteAgent = (agentId: string) => {
    if (!currentJourney) return;
    if (window.confirm('Delete this agent?')) {
      const updatedAgents = currentJourney.agents.filter(a => a.id !== agentId);
      
      // Remove references from other agents' handoffs
      const cleanedAgents = updatedAgents.map(a => ({
        ...a,
        handoffs: a.handoffs.filter(id => id !== agentId),
      }));

      setCurrentJourney({
        ...currentJourney,
        agents: cleanedAgents,
        startingAgentId: currentJourney.startingAgentId === agentId 
          ? (cleanedAgents[0]?.id || '') 
          : currentJourney.startingAgentId,
      });

      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }
    }
  };

  const handleLaunch = () => {
    if (!currentJourney) return;

    const errors = validateJourney(currentJourney);
    if (errors.length > 0) {
      alert(`Cannot launch: ${errors.length} validation error(s). Please fix them first.`);
      setValidationErrors(errors);
      return;
    }

    onLaunchJourney(currentJourney);
  };

  const handleBackToList = () => {
    navigate('/');
  };

  const selectedAgent = currentJourney?.agents.find(a => a.id === selectedAgentId) || null;

  const handleAddScreen = (templateId?: string) => {
    if (!selectedAgent) return;

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
      ...selectedAgent,
      screens: [...(selectedAgent.screens || []), newScreen],
      screenPrompts: selectedAgent.screenPrompts || {},
    };

    handleUpdateAgent(updatedAgent);
    setEditingScreenIndex((selectedAgent.screens || []).length);
  };

  const handleExportAgent = () => {
    if (!selectedAgent) return;
    
    try {
      downloadAgentAsModule(selectedAgent);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to export agent');
    }
  };

  const handleUpdateScreen = (index: number, screen: Screen) => {
    if (!selectedAgent || !selectedAgent.screens) return;

    const updatedScreens = [...selectedAgent.screens];
    updatedScreens[index] = screen;

    handleUpdateAgent({
      ...selectedAgent,
      screens: updatedScreens,
    });
  };

  const handleRemoveScreen = (index: number) => {
    if (!selectedAgent || !selectedAgent.screens) return;

    const updatedScreens = selectedAgent.screens.filter((_, i) => i !== index);

    handleUpdateAgent({
      ...selectedAgent,
      screens: updatedScreens,
    });

    if (editingScreenIndex === index) {
      setEditingScreenIndex(null);
    }
  };

  // AI Screen Generation handlers
  const handleShowAICustomizeModal = () => {
    setShowAICustomizeModal(true);
  };

  const handleAIGenerateScreens = async () => {
    if (!selectedAgent || !currentJourney) return;
    
    setShowAICustomizeModal(false);
    setIsGeneratingScreens(true);
    setAiGenerationError(null);
    
    try {
      const suggestions = await generateScreensFromPrompts({
        systemPrompt: currentJourney.systemPrompt,
        agentPrompt: selectedAgent.prompt,
        agentName: selectedAgent.name,
        existingScreens: selectedAgent.screens,
        customInstructions: aiCustomInstructions.trim() || undefined
      });
      
      setAiGeneratedSuggestions(suggestions);
      setShowAIGenerateModal(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate screens';
      setAiGenerationError(errorMessage);
      alert('Failed to generate screens: ' + errorMessage);
    } finally {
      setIsGeneratingScreens(false);
    }
  };

  const handleAcceptAISuggestion = (suggestion: ScreenSuggestion) => {
    if (!selectedAgent) return;
    
    const newScreen = suggestionToScreen(suggestion);
    
    const updatedAgent = {
      ...selectedAgent,
      screens: [...(selectedAgent.screens || []), newScreen],
      screenPrompts: selectedAgent.screenPrompts || {},
    };
    
    handleUpdateAgent(updatedAgent);
    
    // Remove from suggestions
    setAiGeneratedSuggestions(prev => 
      prev.filter(s => s !== suggestion)
    );
    
    // If no more suggestions, close modal
    if (aiGeneratedSuggestions.length === 1) {
      setShowAIGenerateModal(false);
    }
  };

  const handlePreviewSuggestion = (suggestion: ScreenSuggestion) => {
    setPreviewingSuggestion(suggestion);
  };

  const handleCloseAIModal = () => {
    setShowAIGenerateModal(false);
    setAiGeneratedSuggestions([]);
    setPreviewingSuggestion(null);
    setAiGenerationError(null);
  };

  const handleUpdateScreenPrompts = (screenPrompts: Record<string, string>) => {
    if (!selectedAgent) return;

    handleUpdateAgent({
      ...selectedAgent,
      screenPrompts,
    });
  };

  return (
    <div className="journey-builder">
      {/* Top Bar */}
      <div className="journey-builder-header">
        <div className="journey-header-left">
          {viewMode === 'detail' && (
            <button
              className="journey-back-btn"
              onClick={handleBackToList}
              type="button"
              aria-label="Back to flows"
              title="Back to flows"
            >
              ←
            </button>
          )}
          {viewMode === 'detail' && currentJourney && (
            <div className="journey-current-name">
              <input
                type="text"
                value={currentJourney.name}
                onChange={(e) => setCurrentJourney({ ...currentJourney, name: e.target.value })}
                placeholder="Flow Name"
                disabled={disabled}
                className="journey-name-input"
              />
            </div>
          )}
        </div>
        <div className="journey-header-actions">
          {viewMode === 'list' ? (
            <button className="journey-create-btn" onClick={handleCreateNewJourney} type="button">
              + New Flow
            </button>
          ) : currentJourney && (
            <>
              <button className="journey-action-btn" onClick={handleSaveJourney} disabled={disabled}>
                💾 Save
              </button>
              <button
                className="journey-action-btn danger"
                onClick={() => handleDeleteJourney(currentJourney.id)}
                disabled={disabled}
              >
                🗑️ Delete
              </button>
              <button className="journey-action-btn launch" onClick={handleLaunch} disabled={disabled}>
                🚀 Launch Flow
              </button>
            </>
          )}
        </div>
      </div>

      <div className="journey-builder-layout">
        {/* Center Panel - Main Content */}
        <div className="journey-main-panel">
          {viewMode === 'list' ? (
            <div className="journey-list-view">
              <div className="journey-list-view-header">
                <h2>Flows</h2>
                <p>Select a flow to view and edit details.</p>
              </div>
              {journeys.length === 0 ? (
                <div className="journey-list-empty">
                  <p>No flows yet</p>
                  <button className="journey-create-empty-btn" onClick={handleCreateNewJourney} type="button">
                    Create Your First Flow
                  </button>
                </div>
              ) : (
                <div className="journey-list-items">
                  {journeys.map(journey => (
                    <div
                      key={journey.id}
                      className={`journey-list-item ${currentJourney?.id === journey.id ? 'active' : ''}`}
                    >
                      <div className="journey-item-content" onClick={() => handleLoadJourney(journey.id)}>
                        <div className="journey-item-name">{journey.name}</div>
                        <div className="journey-item-meta">
                          {journey.agentCount} agent{journey.agentCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="journey-item-actions" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : !currentJourney ? (
            <div className="journey-welcome">
              <h2>Welcome to Flow Builder</h2>
              <p>Create multi-agent conversation flows with visual editing</p>
              <button className="journey-welcome-btn" onClick={handleCreateNewJourney} type="button">
                🎯 Create New Flow
              </button>
            </div>
          ) : (
            <div className="journey-editor">
              {/* Journey Description */}
              <div className="journey-description-field">
                <label className="journey-description-label">Description</label>
                <textarea
                  value={currentJourney.description}
                  onChange={(e) => setCurrentJourney({ ...currentJourney, description: e.target.value })}
                  placeholder="Describe this flow..."
                  disabled={disabled}
                  rows={2}
                />
              </div>

              {/* System Prompt */}
              <SystemPromptEditor
                value={currentJourney.systemPrompt}
                onChange={(systemPrompt) => setCurrentJourney({ ...currentJourney, systemPrompt })}
                disabled={disabled}
                journey={currentJourney}
              />

              {/* Builder Tabs */}
              {selectedAgentId && (
                <div className="journey-builder-tabs">
                  <button
                    className={`journey-builder-tab ${builderTab === 'flow' ? 'active' : ''}`}
                    onClick={() => setBuilderTab('flow')}
                  >
                    🔄 Agent Flow
                  </button>
                  <button
                    className={`journey-builder-tab ${builderTab === 'screens' ? 'active' : ''}`}
                    onClick={() => setBuilderTab('screens')}
                  >
                    📱 Screens
                  </button>
                  <button
                    className={`journey-builder-tab ${builderTab === 'prompts' ? 'active' : ''}`}
                    onClick={() => setBuilderTab('prompts')}
                  >
                    📝 Prompts
                  </button>
                </div>
              )}

              {/* Flow Canvas */}
              {(!selectedAgentId || builderTab === 'flow') && (
                <div className="journey-flow-section">
                  <h4>Agent Flow</h4>
                  <JourneyFlowCanvas
                    agents={currentJourney.agents}
                    startingAgentId={currentJourney.startingAgentId}
                    selectedAgentId={selectedAgentId}
                    onAgentSelect={(agentId) => {
                      setSelectedAgentId(agentId);
                      // Only open modal if not dragging
                      if (!isDragging) {
                        setShowAgentModal(true);
                      }
                    }}
                    onAgentMove={(agentId, position) => {
                      setIsDragging(true);
                      setTimeout(() => setIsDragging(false), 100);
                      const updatedAgents = currentJourney.agents.map(a =>
                        a.id === agentId ? { ...a, position } : a
                      );
                      setCurrentJourney({ ...currentJourney, agents: updatedAgents });
                    }}
                    onAddAgent={handleAddAgent}
                    onSetStartingAgent={(agentId) => {
                      setCurrentJourney({ ...currentJourney, startingAgentId: agentId });
                    }}
                  />
                </div>
              )}

              {/* Screens Tab */}
              {selectedAgentId && builderTab === 'screens' && (
                <div className="journey-screens-section">
                  <div className="journey-screens-header">
                    <h4>Screens for {selectedAgent?.name}</h4>
                    <div className="journey-screens-header-actions">
                      <div className="journey-add-screen-dropdown">
                        <button 
                          className="journey-add-screen-btn"
                          onClick={() => handleAddScreen()}
                          disabled={disabled}
                        >
                          + Add Screen
                        </button>
                        <div className="journey-screen-templates">
                          <span className="journey-screen-templates-label">From template:</span>
                          {SCREEN_TEMPLATES.map(template => (
                            <button
                              key={template.id}
                              className="journey-screen-template-btn"
                              onClick={() => handleAddScreen(template.id)}
                              disabled={disabled}
                              title={template.description}
                            >
                              {template.icon} {template.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        className="journey-ai-generate-btn"
                        onClick={handleShowAICustomizeModal}
                        disabled={disabled || isGeneratingScreens}
                        title="Use AI to generate screen suggestions based on agent prompts"
                      >
                        {isGeneratingScreens ? '⏳ Generating...' : '🤖 AI Auto-Generate'}
                      </button>
                      {selectedAgent?.screens && selectedAgent.screens.length > 0 && (
                        <button
                          className="journey-export-agent-btn"
                          onClick={handleExportAgent}
                          disabled={disabled}
                        >
                          💾 Export Module
                        </button>
                      )}
                    </div>
                  </div>

                  {!selectedAgent?.screens || selectedAgent.screens.length === 0 ? (
                    <div className="journey-screens-empty">
                      <p>No screens defined for this agent yet.</p>
                      <button onClick={() => handleAddScreen()} disabled={disabled} className="journey-add-screen-empty-btn">
                        + Create First Screen
                      </button>
                    </div>
                  ) : (
                    <div className="journey-screens-grid">
                      {/* Screen List */}
                      <div className="journey-screens-list">
                        {selectedAgent.screens.map((screen, index) => (
                          <div 
                            key={screen.id}
                            className={`journey-screen-item ${editingScreenIndex === index ? 'editing' : ''} ${previewScreenIndex === index ? 'previewing' : ''}`}
                          >
                            <div className="journey-screen-item-header">
                              <strong>{screen.title}</strong>
                              <span className="journey-screen-item-id">{screen.id}</span>
                            </div>
                            <div className="journey-screen-item-meta">
                              {screen.sections.length} section(s), {' '}
                              {screen.sections.reduce((acc, s) => acc + s.elements.length, 0)} element(s)
                            </div>
                            <div className="journey-screen-item-actions">
                              <button onClick={() => setEditingScreenIndex(index)} disabled={disabled}>
                                ✏️ Edit
                              </button>
                              <button onClick={() => setPreviewScreenIndex(index)} disabled={disabled}>
                                👁️ Preview
                              </button>
                              <button onClick={() => handleRemoveScreen(index)} disabled={disabled}>
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Screen Editor */}
                      {editingScreenIndex !== null && selectedAgent.screens[editingScreenIndex] && (
                        <div className="journey-screen-editor-panel">
                          <ScreenEditor
                            screen={selectedAgent.screens[editingScreenIndex]}
                            onChange={(screen) => handleUpdateScreen(editingScreenIndex, screen)}
                            onClose={() => setEditingScreenIndex(null)}
                            disabled={disabled}
                          />
                        </div>
                      )}

                      {/* Screen Preview */}
                      {previewScreenIndex !== null && selectedAgent.screens[previewScreenIndex] && (
                        <div className="journey-screen-preview-panel">
                          <div className="journey-screen-preview-header">
                            <h4>Preview: {selectedAgent.screens[previewScreenIndex].title}</h4>
                            <button onClick={() => setPreviewScreenIndex(null)}>✕</button>
                          </div>
                          <ScreenProvider initialScreen={selectedAgent.screens[previewScreenIndex]}>
                            <ScreenPreview
                              screen={selectedAgent.screens[previewScreenIndex]}
                              allScreens={selectedAgent.screens}
                              showDeviceFrame={true}
                            />
                          </ScreenProvider>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Prompts Tab */}
              {selectedAgentId && builderTab === 'prompts' && (
                <div className="journey-prompts-section">
                  <h4>Prompts for {selectedAgent?.name}</h4>
                  <div className="journey-prompts-overview">
                    <div className="journey-prompt-block">
                      <div className="journey-prompt-block-header">
                        <span>System Prompt</span>
                        <span className="journey-prompt-block-meta">Applies to all agents</span>
                      </div>
                      <textarea
                        value={currentJourney.systemPrompt}
                        onChange={(e) => setCurrentJourney({ ...currentJourney, systemPrompt: e.target.value })}
                        placeholder="Define global instructions for all agents..."
                        disabled={disabled}
                        rows={8}
                      />
                    </div>
                    <div className="journey-prompt-block">
                      <div className="journey-prompt-block-header">
                        <span>Agent Prompt</span>
                        <span className="journey-prompt-block-meta">Specific to this agent</span>
                      </div>
                      <textarea
                        value={selectedAgent?.prompt || ''}
                        onChange={(e) => {
                          if (!selectedAgent) return;
                          handleUpdateAgent({ ...selectedAgent, prompt: e.target.value });
                        }}
                        placeholder="Define specific instructions for this agent..."
                        disabled={disabled}
                        rows={8}
                      />
                    </div>
                  </div>
                  {!selectedAgent?.screens || selectedAgent.screens.length === 0 ? (
                    <div className="journey-prompts-empty">
                      <p>No screens defined. Add screens first to create prompts.</p>
                    </div>
                  ) : (
                    <PromptEditor
                      screens={selectedAgent.screens}
                      screenPrompts={selectedAgent.screenPrompts || {}}
                      onChange={handleUpdateScreenPrompts}
                      disabled={disabled}
                      journey={currentJourney}
                    />
                  )}
                </div>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="journey-validation-errors">
                  <h4>⚠️ Validation Errors</h4>
                  <ul>
                    {validationErrors.map((error, index) => (
                      <li key={index}>
                        <strong>{error.field}:</strong> {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Agent Editor Modal */}
      {currentJourney && showAgentModal && selectedAgent && (
        <div className="agent-editor-modal-overlay" onClick={() => setShowAgentModal(false)}>
          <div className="agent-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="agent-editor-modal-header">
              <h2>Edit Agent: {selectedAgent.name}</h2>
              <button
                className="agent-editor-modal-close"
                onClick={() => setShowAgentModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="agent-editor-modal-content">
              <AgentNodeEditor
                agent={selectedAgent}
                allAgents={currentJourney.agents}
                onChange={handleUpdateAgent}
                onClose={() => {
                  setSelectedAgentId(null);
                  setShowAgentModal(false);
                }}
                disabled={disabled}
              />
              
              {selectedAgent && (
                <div style={{ padding: '1.5rem 2rem' }}>
                  <button
                    className="agent-delete-btn"
                    onClick={() => {
                      handleDeleteAgent(selectedAgent.id);
                      setShowAgentModal(false);
                    }}
                    disabled={disabled}
                    type="button"
                  >
                    🗑️ Delete Agent
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Customization Modal */}
      {showAICustomizeModal && (
        <div className="journey-ai-modal-overlay" onClick={() => setShowAICustomizeModal(false)}>
          <div className="journey-ai-modal journey-ai-customize-modal" onClick={(e) => e.stopPropagation()}>
            <div className="journey-ai-modal-header">
              <h3>🤖 Customize AI Screen Generation</h3>
              <button onClick={() => setShowAICustomizeModal(false)} className="journey-modal-close-btn">✕</button>
            </div>
            
            <div className="journey-ai-modal-content">
              <div className="journey-ai-customize-intro">
                <p>
                  The AI will analyze your system and agent prompts to generate relevant screens. 
                  You can provide additional instructions to guide the generation process.
                </p>
              </div>
              
              <div className="journey-ai-customize-field">
                <label htmlFor="ai-custom-instructions">
                  <strong>Custom Instructions (Optional)</strong>
                </label>
                <textarea
                  id="ai-custom-instructions"
                  className="journey-ai-instructions-input"
                  value={aiCustomInstructions}
                  onChange={(e) => setAiCustomInstructions(e.target.value)}
                  placeholder="Example: Focus on data collection screens, use calming colors, include progress indicators..."
                  rows={5}
                />
                <p className="journey-ai-instructions-hint">
                  💡 Try specifying: screen types, design preferences, specific information to collect, tone, or UI patterns.
                </p>
              </div>
              
              <div className="journey-ai-customize-actions">
                <button
                  className="journey-ai-cancel-btn"
                  onClick={() => setShowAICustomizeModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="journey-ai-generate-btn"
                  onClick={handleAIGenerateScreens}
                  disabled={isGeneratingScreens}
                >
                  {isGeneratingScreens ? '⏳ Generating...' : '✨ Generate Screens'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Screen Generation Modal */}
      {showAIGenerateModal && (
        <div className="journey-ai-modal-overlay" onClick={handleCloseAIModal}>
          <div className="journey-ai-modal" onClick={(e) => e.stopPropagation()}>
            <div className="journey-ai-modal-header">
              <h3>🤖 AI-Generated Screen Suggestions</h3>
              <button onClick={handleCloseAIModal} className="journey-modal-close-btn">✕</button>
            </div>
            
            <div className="journey-ai-modal-content">
              {aiGeneratedSuggestions.length === 0 ? (
                <div className="journey-ai-empty">
                  <p>No suggestions generated. Try again or check your prompts.</p>
                </div>
              ) : (
                <>
                  <div className="journey-ai-intro">
                    <p>Based on your system and agent prompts, here are suggested screens that complement the conversation flow:</p>
                  </div>
                  
                  {aiGeneratedSuggestions.map((suggestion, idx) => (
                    <div key={idx} className="journey-ai-suggestion">
                      <div className="journey-ai-suggestion-header">
                        <div>
                          <h4>{suggestion.title}</h4>
                          <span className="journey-ai-suggestion-type">{suggestion.screenType}</span>
                        </div>
                      </div>
                      
                      <p className="journey-ai-suggestion-description">
                        <strong>Purpose:</strong> {suggestion.description}
                      </p>
                      
                      <p className="journey-ai-suggestion-reasoning">
                        <strong>Why this screen?</strong> {suggestion.reasoning}
                      </p>
                      
                      <div className="journey-ai-suggestion-elements">
                        <strong>Includes {suggestion.elements.length} elements:</strong>
                        <div className="journey-ai-element-list">
                          {suggestion.elements.slice(0, 5).map((el, i) => (
                            <span key={i} className="journey-ai-element-badge">
                              {el.type}
                            </span>
                          ))}
                          {suggestion.elements.length > 5 && (
                            <span className="journey-ai-element-badge">
                              +{suggestion.elements.length - 5} more
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="journey-ai-suggestion-actions">
                        <button 
                          onClick={() => handleAcceptAISuggestion(suggestion)}
                          className="journey-ai-accept-btn"
                        >
                          ✓ Add This Screen
                        </button>
                        <button 
                          onClick={() => handlePreviewSuggestion(suggestion)}
                          className="journey-ai-preview-btn"
                        >
                          👁️ Preview
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal for AI Suggestions */}
      {previewingSuggestion && (
        <div className="journey-ai-modal-overlay" onClick={() => setPreviewingSuggestion(null)}>
          <div className="journey-ai-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="journey-ai-modal-header">
              <h3>Preview: {previewingSuggestion.title}</h3>
              <button onClick={() => setPreviewingSuggestion(null)} className="journey-modal-close-btn">✕</button>
            </div>
            
            <div className="journey-ai-preview-content">
              <ScreenProvider initialScreen={suggestionToScreen(previewingSuggestion)}>
                <ScreenPreview
                  screen={suggestionToScreen(previewingSuggestion)}
                  allScreens={[suggestionToScreen(previewingSuggestion)]}
                  showDeviceFrame={true}
                  editable={false}
                />
              </ScreenProvider>
            </div>
            
            <div className="journey-ai-preview-actions">
              <button 
                onClick={() => {
                  handleAcceptAISuggestion(previewingSuggestion);
                  setPreviewingSuggestion(null);
                }}
                className="journey-ai-accept-btn"
              >
                ✓ Add This Screen
              </button>
              <button 
                onClick={() => setPreviewingSuggestion(null)}
                className="journey-ai-cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JourneyBuilder;

