import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Journey, Agent, DEFAULT_SYSTEM_PROMPT, validateJourney, Screen, TtsProvider, ELEVENLABS_VOICE_OPTIONS, AZURE_VOICE_OPTIONS } from '../../types/journey';
import { loadJourney, saveJourney, deleteJourney, duplicateJourney } from '../../services/journeyStorage';
import { publishJourney as publishJourneyApi, unpublishJourney as unpublishJourneyApi, getPublishedJourney } from '../../services/api/journeyService';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { generateScreensFromPrompts, suggestionToScreen, ScreenSuggestion } from '../../services/aiScreenGenerator';
import SystemPromptEditor from './SystemPromptEditor';
import ToolEditor from './ToolEditor';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import ScreenPreview from './ScreenPreview';
import { TrashIcon, FileTextIcon, EditIcon, RocketIcon, TargetIcon, HistoryIcon, SaveIcon, ToolIcon, SettingsIcon, MoreIcon, DownloadIcon, UploadIcon, LinkIcon } from '../Icons';
import VersionHistory from './VersionHistory';
import { useAuth } from '../../contexts/AuthContext';
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
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentJourney, setCurrentJourney] = useState<Journey | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('detail');
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  
  // AI Screen Generation state
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [showAICustomizeModal, setShowAICustomizeModal] = useState(false);
  const [aiCustomInstructions, setAiCustomInstructions] = useState('');
  const [aiGeneratedSuggestions, setAiGeneratedSuggestions] = useState<ScreenSuggestion[]>([]);
  const [isGeneratingScreens, setIsGeneratingScreens] = useState(false);
  const [_aiGenerationError, setAiGenerationError] = useState<string | null>(null);
  const [previewingSuggestion, setPreviewingSuggestion] = useState<ScreenSuggestion | null>(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  
  // Publishing state
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  
  // Embedded agent editor state
  const [agentEditorTab, setAgentEditorTab] = useState<'config' | 'tools' | 'screens'>('config');
  const [showScreensJsonView, setShowScreensJsonView] = useState(false);
  const [screensJsonValue, setScreensJsonValue] = useState('');

  useEffect(() => {
    // Load flow based on URL params
    const initAndLoad = async () => {
      // Check if we should auto-create a new flow
      if (searchParams.get('new') === 'true') {
        const newJourney: Journey = {
          id: `new-${uuidv4()}`,
          name: 'New Flow',
          description: 'Describe your flow',
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          voiceEnabled: true,
          agents: [],
          startingAgentId: '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: '1.0.0',
        };
        setCurrentJourney(newJourney);
        setSelectedAgentId(null);
        setIsLoading(false);
        // Clear the query param so refreshing doesn't create another new flow
        setSearchParams({}, { replace: true });
        return;
      }
      
      // Check if we should load a specific flow for editing
      const editId = searchParams.get('id');
      if (editId) {
        const journeyToEdit = await loadJourney(editId);
        if (journeyToEdit) {
          setCurrentJourney(journeyToEdit);
          setSelectedAgentId(journeyToEdit.agents.length > 0 ? journeyToEdit.agents[0].id : null);
          setIsLoading(false);
          // Clear the query param
          setSearchParams({}, { replace: true });
          return;
        }
      }
      
      // No flow specified - redirect to main flows page
      navigate('/');
    };
    
    initAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateNewJourney = () => {
    const newJourney: Journey = {
      id: `new-${uuidv4()}`,
      name: 'New Flow',
      description: 'Describe your flow',
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      voiceEnabled: true,
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

  const handleSaveJourney = async () => {
    if (!currentJourney || isSaving) return;

    const errors = validateJourney(currentJourney);
    setValidationErrors(errors);

    if (errors.length > 0) {
      alert(`Cannot save: ${errors.length} validation error(s). Check the validation panel.`);
      return;
    }

    setIsSaving(true);
    try {
      const saved = await saveJourney(currentJourney);
      if (saved) {
        try {
          const channel = new BroadcastChannel('journey-updates');
          channel.postMessage({
            type: 'journey-saved',
            journeyId: currentJourney.id,
            timestamp: Date.now(),
          });
          channel.close();
          console.log('📢 Broadcast journey update:', currentJourney.id);
        } catch (e) {
          console.warn('BroadcastChannel not supported, manual refresh may be needed');
        }
        alert(`Flow "${currentJourney.name}" saved successfully!`);
      } else {
        alert('Failed to save flow');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteJourney = (journeyId: string) => {
    if (window.confirm('Delete this flow? This cannot be undone.')) {
      deleteJourney(journeyId);
      if (currentJourney?.id === journeyId) {
        navigate('/');
      }
    }
  };

  // Check publish status when journey loads
  useEffect(() => {
    const checkPublishStatus = async () => {
      if (currentJourney?.id && !currentJourney.id.startsWith('new-')) {
        try {
          const published = await getPublishedJourney(currentJourney.id);
          setIsPublished(!!published);
          if (published) {
            const journeyJson = JSON.stringify({
              name: currentJourney.name,
              description: currentJourney.description,
              systemPrompt: currentJourney.systemPrompt,
              agents: currentJourney.agents,
              startingAgentId: currentJourney.startingAgentId,
            });
            const publishedJson = JSON.stringify({
              name: published.name,
              description: published.description,
              systemPrompt: published.systemPrompt,
              agents: published.agents,
              startingAgentId: published.startingAgentId,
            });
            setHasUnpublishedChanges(journeyJson !== publishedJson);
          } else {
            setHasUnpublishedChanges(false);
          }
        } catch {
          setIsPublished(false);
          setHasUnpublishedChanges(false);
        }
      }
    };
    checkPublishStatus();
  }, [currentJourney]);

  const handlePublish = async () => {
    if (!currentJourney) return;
    
    const errors = validateJourney(currentJourney);
    if (errors.length > 0) {
      alert(`Cannot publish: ${errors.length} validation error(s). Please fix them first.`);
      return;
    }
    
    const confirmMsg = isPublished 
      ? 'Update the published version with your current changes?'
      : 'Publish this flow to production? It will be available for live use.';
    
    if (!window.confirm(confirmMsg)) return;
    
    setIsPublishing(true);
    try {
      await saveJourney(currentJourney);
      const result = await publishJourneyApi(currentJourney.id);
      if (result.success) {
        setIsPublished(true);
        setHasUnpublishedChanges(false);
        alert('Flow published successfully!');
      } else {
        alert('Failed to publish flow');
      }
    } catch (error) {
      console.error('Publish error:', error);
      alert('Failed to publish flow');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!currentJourney) return;
    
    if (!window.confirm('Unpublish this flow? It will no longer be available for live use.')) return;
    
    setIsPublishing(true);
    try {
      const result = await unpublishJourneyApi(currentJourney.id);
      if (result.success) {
        setIsPublished(false);
        setHasUnpublishedChanges(false);
        alert('Flow unpublished successfully');
      } else {
        alert('Failed to unpublish flow');
      }
    } catch (error) {
      console.error('Unpublish error:', error);
      alert('Failed to unpublish flow');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExport = async () => {
    if (!currentJourney) return;
    
    try {
      const response = await fetch(`/api/journeys/${currentJourney.id}/export`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to export journey');
      }
      
      const exportData = await response.json();
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentJourney.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export flow');
    }
  };

  const handleImport = async () => {
    if (!currentJourney) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.journey) {
          alert('Invalid import file: missing journey data');
          return;
        }
        
        if (!window.confirm(`Import config from "${file.name}"? This will update the current flow with the imported settings.`)) {
          return;
        }
        
        const response = await fetch(`/api/journeys/${currentJourney.id}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: text,
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to import');
        }
        
        const result = await response.json();
        
        setCurrentJourney({
          ...currentJourney,
          ...result.journey,
        });
        
        alert('Flow updated successfully from import!');
      } catch (error) {
        console.error('Import error:', error);
        alert('Failed to import flow: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    };
    
    input.click();
  };

  const handleShareLink = async () => {
    if (!currentJourney) return;
    
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/preview/${currentJourney.id}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      prompt('Copy this link:', shareUrl);
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
  const availableHandoffTargets = currentJourney?.agents.filter(a => a.id !== selectedAgentId) || [];

  // Sync JSON value when selected agent or screens change
  useEffect(() => {
    if (selectedAgent && showScreensJsonView) {
      const jsonObj = {
        screens: selectedAgent.screens || [],
        screenPrompts: selectedAgent.screenPrompts || {},
      };
      setScreensJsonValue(JSON.stringify(jsonObj, null, 2));
    }
  }, [selectedAgent?.id, selectedAgent?.screens, selectedAgent?.screenPrompts, showScreensJsonView]);

  const handleToggleHandoff = (targetAgentId: string) => {
    if (!selectedAgent) return;
    const handoffs = selectedAgent.handoffs.includes(targetAgentId)
      ? selectedAgent.handoffs.filter(id => id !== targetAgentId)
      : [...selectedAgent.handoffs, targetAgentId];
    handleUpdateAgent({ ...selectedAgent, handoffs });
  };

  const handleEditScreen = (screen: Screen) => {
    navigate('/screens', { 
      state: { 
        editScreen: screen,
        agentId: selectedAgent?.id,
        agentName: selectedAgent?.name,
        journeyId: currentJourney?.id
      } 
    });
  };

  const handleDeleteAgent = () => {
    if (!currentJourney || !selectedAgentId) return;
    if (!window.confirm('Delete this agent? This cannot be undone.')) return;
    
    const updatedAgents = currentJourney.agents.filter(a => a.id !== selectedAgentId);
    const newStartingAgentId = currentJourney.startingAgentId === selectedAgentId 
      ? (updatedAgents.length > 0 ? updatedAgents[0].id : '')
      : currentJourney.startingAgentId;
    
    setCurrentJourney({
      ...currentJourney,
      agents: updatedAgents,
      startingAgentId: newStartingAgentId,
    });
    setSelectedAgentId(updatedAgents.length > 0 ? updatedAgents[0].id : null);
  };

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
    
    // Navigate to Screen Builder with the new screen
    navigate('/screens', { 
      state: { 
        editScreen: newScreen,
        agentId: selectedAgent.id,
        agentName: selectedAgent.name,
        journeyId: currentJourney?.id
      } 
    });
  };

  const handleRemoveScreen = (index: number) => {
    if (!selectedAgent || !selectedAgent.screens) return;

    const updatedScreens = selectedAgent.screens.filter((_, i) => i !== index);

    handleUpdateAgent({
      ...selectedAgent,
      screens: updatedScreens,
    });
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
                disabled={disabled || !isAdmin}
                className="journey-name-input"
              />
              <span className={`journey-status-badge ${isPublished ? (hasUnpublishedChanges ? 'has-changes' : 'published') : 'draft'}`}>
                {isPublished ? (hasUnpublishedChanges ? 'Unpublished Changes' : 'Published') : 'Draft'}
              </span>
              <label className="journey-voice-toggle" title={currentJourney.voiceEnabled !== false ? 'Voice enabled - users interact via voice' : 'Voice disabled - users interact via buttons'}>
                <input
                  type="checkbox"
                  checked={currentJourney.voiceEnabled !== false}
                  onChange={(e) => setCurrentJourney({ ...currentJourney, voiceEnabled: e.target.checked })}
                  disabled={disabled || !isAdmin}
                />
                <span className="journey-voice-toggle-slider"></span>
                <span className="journey-voice-toggle-label">{currentJourney.voiceEnabled !== false ? '🎙️ Voice' : '👆 Buttons'}</span>
              </label>
              {currentJourney.voiceEnabled !== false && (
                <select
                  className="journey-provider-select"
                  value={currentJourney.ttsProvider || 'elevenlabs'}
                  onChange={(e) => {
                    const provider = e.target.value as TtsProvider;
                    const defaultVoice = provider === 'elevenlabs' 
                      ? ELEVENLABS_VOICE_OPTIONS[0].value 
                      : AZURE_VOICE_OPTIONS[0].value;
                    setCurrentJourney({ 
                      ...currentJourney, 
                      ttsProvider: provider,
                      voice: defaultVoice,
                      elevenLabsConfig: provider === 'elevenlabs' ? (currentJourney.elevenLabsConfig || {}) : undefined
                    });
                  }}
                  disabled={disabled || !isAdmin}
                  title="Select voice provider"
                >
                  <option value="azure">Azure OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              )}
            </div>
          )}
        </div>
        <div className="journey-header-actions">
          {currentJourney && (
            <>
              {isAdmin && (
                <button className="journey-action-btn" onClick={handleSaveJourney} disabled={disabled || isSaving}>
                  <SaveIcon size={14} /> {isSaving ? 'Saving...' : 'Save'}
                </button>
              )}
              {isAdmin && (isPublished ? (
                <button 
                  className={`journey-action-btn publish ${hasUnpublishedChanges ? 'has-changes' : ''}`}
                  onClick={handlePublish} 
                  disabled={disabled || isPublishing}
                  title={hasUnpublishedChanges ? 'You have unpublished changes' : 'Update published version'}
                >
                  <RocketIcon size={14} /> {isPublishing ? 'Publishing...' : hasUnpublishedChanges ? 'Publish Changes' : 'Republish'}
                </button>
              ) : (
                <button 
                  className="journey-action-btn publish"
                  onClick={handlePublish} 
                  disabled={disabled || isPublishing}
                >
                  <RocketIcon size={14} /> {isPublishing ? 'Publishing...' : 'Publish'}
                </button>
              ))}
              <button className="journey-action-btn launch" onClick={handleLaunch} disabled={disabled}>
                <RocketIcon size={14} /> Test
              </button>
              <div className="journey-more-menu-container">
                <button 
                  className={`journey-action-btn more-btn ${showMoreMenu ? 'active' : ''}`}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  disabled={disabled}
                >
                  <MoreIcon size={16} />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="journey-more-menu-backdrop" onClick={() => setShowMoreMenu(false)} />
                    <div className="journey-more-menu">
                      <button
                        className="journey-more-menu-item"
                        onClick={() => { setShowVersionHistory(true); setShowMoreMenu(false); }}
                        disabled={disabled}
                      >
                        <HistoryIcon size={14} /> History
                      </button>
                      <button 
                        className="journey-more-menu-item" 
                        onClick={() => { handleExport(); setShowMoreMenu(false); }} 
                        disabled={disabled}
                      >
                        <DownloadIcon size={14} /> Export
                      </button>
                      <button 
                        className="journey-more-menu-item" 
                        onClick={() => { handleShareLink(); setShowMoreMenu(false); }} 
                        disabled={disabled}
                      >
                        <LinkIcon size={14} /> Share Link
                      </button>
                      {isAdmin && (
                        <button 
                          className="journey-more-menu-item" 
                          onClick={() => { handleImport(); setShowMoreMenu(false); }} 
                          disabled={disabled}
                        >
                          <UploadIcon size={14} /> Import
                        </button>
                      )}
                      {isAdmin && isPublished && (
                        <button 
                          className="journey-more-menu-item danger"
                          onClick={() => { handleUnpublish(); setShowMoreMenu(false); }} 
                          disabled={disabled || isPublishing}
                        >
                          Unpublish
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <div className="journey-more-menu-divider" />
                          <button
                            className="journey-more-menu-item danger"
                            onClick={() => { handleDeleteJourney(currentJourney.id); setShowMoreMenu(false); }}
                            disabled={disabled}
                          >
                            <TrashIcon size={14} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="journey-builder-layout">
        {/* Center Panel - Main Content */}
        <div className="journey-main-panel">
          {isLoading ? (
            <div className="journey-loading">
              <p>Loading...</p>
            </div>
          ) : !currentJourney ? (
            <div className="journey-welcome">
              <h2>Welcome to Flow Builder</h2>
              <p>Create multi-agent conversation flows with visual editing</p>
              <button className="journey-welcome-btn" onClick={handleCreateNewJourney} type="button">
                <TargetIcon size={16} /> Create New Flow
              </button>
            </div>
          ) : (
            <div className="journey-editor">
              {/* Journey Description */}
              <div className="journey-description-section">
                <div className="journey-description-field">
                  <div className="journey-description-header">
                    <label className="journey-description-label">Description</label>
                    {isAdmin && !isEditingDescription && !disabled && (
                      <button
                        className="journey-description-edit-btn"
                        onClick={() => setIsEditingDescription(true)}
                        type="button"
                      >
                        <EditIcon size={12} /> Edit
                      </button>
                    )}
                  </div>
                  {isEditingDescription && isAdmin ? (
                    <div className="journey-description-edit-wrapper">
                      <textarea
                        value={currentJourney.description}
                        onChange={(e) => setCurrentJourney({ ...currentJourney, description: e.target.value })}
                        placeholder="Describe this flow..."
                        disabled={disabled}
                        rows={2}
                        autoFocus
                      />
                      <button
                        className="journey-description-done-btn"
                        onClick={() => setIsEditingDescription(false)}
                        type="button"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <p className="journey-description-text">
                      {currentJourney.description || 'No description'}
                    </p>
                  )}
                </div>
              </div>

              {/* System Prompt */}
              <SystemPromptEditor
                value={currentJourney.systemPrompt}
                onChange={(systemPrompt) => setCurrentJourney({ ...currentJourney, systemPrompt })}
                disabled={disabled || !isAdmin}
              />

              {/* Voice Settings Section */}
              <div className="journey-voice-settings-section">
                <div className="journey-voice-settings-header">
                  <label className="journey-voice-settings-label">Voice Settings</label>
                </div>
                <div className="journey-voice-settings-content">
                  <div className="journey-voice-settings-row">
                    <label className="journey-voice-settings-item">
                      <span>Voice Mode</span>
                      <select
                        className="journey-voice-settings-select"
                        value={currentJourney.voiceEnabled !== false ? 'voice' : 'buttons'}
                        onChange={(e) => setCurrentJourney({ 
                          ...currentJourney, 
                          voiceEnabled: e.target.value === 'voice' 
                        })}
                        disabled={disabled || !isAdmin}
                      >
                        <option value="voice">Voice (users speak)</option>
                        <option value="buttons">Buttons (users click)</option>
                      </select>
                    </label>
                    
                    {currentJourney.voiceEnabled !== false && (
                      <label className="journey-voice-settings-item">
                        <span>Voice Provider</span>
                        <select
                          className="journey-voice-settings-select"
                          value={currentJourney.ttsProvider || 'elevenlabs'}
                          onChange={(e) => {
                            const provider = e.target.value as TtsProvider;
                            const defaultVoice = provider === 'elevenlabs' 
                              ? ELEVENLABS_VOICE_OPTIONS[0].value 
                              : AZURE_VOICE_OPTIONS[0].value;
                            setCurrentJourney({ 
                              ...currentJourney, 
                              ttsProvider: provider,
                              voice: defaultVoice,
                              elevenLabsConfig: provider === 'elevenlabs' ? (currentJourney.elevenLabsConfig || {}) : undefined
                            });
                          }}
                          disabled={disabled || !isAdmin}
                        >
                          <option value="azure">Azure OpenAI</option>
                          <option value="elevenlabs">ElevenLabs</option>
                        </select>
                      </label>
                    )}
                  </div>
                  
                  {/* ElevenLabs Configuration */}
                  {currentJourney.voiceEnabled !== false && (currentJourney.ttsProvider === 'elevenlabs' || !currentJourney.ttsProvider) && (
                    <div className="journey-voice-settings-elevenlabs">
                      <div className="journey-agent-field">
                        <label>ElevenLabs Agent ID</label>
                        <input
                          type="text"
                          className="journey-provider-config-input"
                          value={currentJourney.elevenLabsConfig?.agentId || ''}
                          onChange={(e) => setCurrentJourney({
                            ...currentJourney,
                            elevenLabsConfig: {
                              ...currentJourney.elevenLabsConfig,
                              agentId: e.target.value
                            }
                          })}
                          placeholder="e.g., agent_abc123xyz"
                          disabled={disabled || !isAdmin}
                        />
                        <div className="journey-provider-config-hint">
                          Get your Agent ID from the ElevenLabs Conversational AI dashboard
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Agent Selector */}
              <div className="journey-agent-selector">
                <div className="journey-agent-selector-header">
                  <label className="journey-agent-selector-label">Agent</label>
                </div>
                <div className="journey-agent-selector-row">
                  <select
                    className="journey-agent-dropdown"
                    value={selectedAgentId || ''}
                    onChange={(e) => {
                      if (e.target.value === '__add_new__') {
                        handleAddAgent();
                      } else {
                        setSelectedAgentId(e.target.value || null);
                        setAgentEditorTab('config');
                      }
                    }}
                    disabled={disabled}
                  >
                    {currentJourney.agents.length === 0 ? (
                      <option value="">No agents - add one below</option>
                    ) : (
                      <>
                        <option value="">Select an agent...</option>
                        {currentJourney.agents.map(agent => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}{currentJourney.startingAgentId === agent.id ? ' (Starting)' : ''}
                          </option>
                        ))}
                      </>
                    )}
                    {isAdmin && <option value="__add_new__">+ Add New Agent</option>}
                  </select>
                  {isAdmin && selectedAgent && (
                    <button
                      className="journey-agent-delete-btn"
                      onClick={handleDeleteAgent}
                      disabled={disabled}
                      title="Delete agent"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Embedded Agent Editor */}
              {selectedAgent && (
                <div className="journey-agent-editor">
                  {/* Agent Editor Tabs */}
                  <div className="journey-agent-editor-tabs">
                    <button
                      className={`journey-agent-tab ${agentEditorTab === 'config' ? 'active' : ''}`}
                      onClick={() => setAgentEditorTab('config')}
                      type="button"
                    >
                      <SettingsIcon size={14} /> Configuration
                    </button>
                    <button
                      className={`journey-agent-tab ${agentEditorTab === 'tools' ? 'active' : ''}`}
                      onClick={() => setAgentEditorTab('tools')}
                      type="button"
                    >
                      <ToolIcon size={14} /> Tools
                      {selectedAgent.tools.length > 0 && (
                        <span className="journey-agent-tab-badge">{selectedAgent.tools.length}</span>
                      )}
                    </button>
                    <button
                      className={`journey-agent-tab ${agentEditorTab === 'screens' ? 'active' : ''}`}
                      onClick={() => setAgentEditorTab('screens')}
                      type="button"
                    >
                      <FileTextIcon size={14} /> Screens
                      {selectedAgent.screens && selectedAgent.screens.length > 0 && (
                        <span className="journey-agent-tab-badge">{selectedAgent.screens.length}</span>
                      )}
                    </button>
                  </div>

                  <div className="journey-agent-editor-content">
                    {/* Configuration Tab */}
                    {agentEditorTab === 'config' && (
                      <>
                        <div className="journey-agent-section">
                          <h4>Basic Information</h4>
                          <div className="journey-agent-field">
                            <label>Agent Name</label>
                            <input
                              type="text"
                              value={selectedAgent.name}
                              onChange={(e) => handleUpdateAgent({ ...selectedAgent, name: e.target.value })}
                              placeholder="Agent Name"
                              disabled={disabled || !isAdmin}
                            />
                          </div>
                          <div className="journey-agent-field">
                            <label>Voice</label>
                            <select
                              value={selectedAgent.voice}
                              onChange={(e) => handleUpdateAgent({ ...selectedAgent, voice: e.target.value })}
                              disabled={disabled || !isAdmin}
                            >
                              {(currentJourney?.ttsProvider === 'elevenlabs' ? ELEVENLABS_VOICE_OPTIONS : AZURE_VOICE_OPTIONS).map(option => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="journey-agent-field">
                            <label>Handoff Description</label>
                            <input
                              type="text"
                              value={selectedAgent.handoffDescription || ''}
                              onChange={(e) => handleUpdateAgent({ ...selectedAgent, handoffDescription: e.target.value })}
                              placeholder="Describe this agent's role in the flow"
                              disabled={disabled || !isAdmin}
                            />
                          </div>
                        </div>

                        <div className="journey-agent-section">
                          <h4>Agent Prompt</h4>
                          <div className="journey-agent-field">
                            <label>Instructions</label>
                            <textarea
                              value={selectedAgent.prompt}
                              onChange={(e) => handleUpdateAgent({ ...selectedAgent, prompt: e.target.value })}
                              placeholder="Define specific instructions for this agent..."
                              disabled={disabled || !isAdmin}
                              rows={10}
                            />
                          </div>
                        </div>

                        <div className="journey-agent-section">
                          <h4>Handoffs</h4>
                          <p className="journey-agent-section-desc">Select which agents this agent can hand off to</p>
                          {availableHandoffTargets.length === 0 ? (
                            <div className="journey-handoff-empty">
                              No other agents available. Create more agents to enable handoffs.
                            </div>
                          ) : (
                            <div className="journey-handoff-list">
                              {availableHandoffTargets.map(targetAgent => (
                                <label key={targetAgent.id} className="journey-handoff-option">
                                  <input
                                    type="checkbox"
                                    checked={selectedAgent.handoffs.includes(targetAgent.id)}
                                    onChange={() => handleToggleHandoff(targetAgent.id)}
                                    disabled={disabled || !isAdmin}
                                  />
                                  <span>{targetAgent.name}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="journey-agent-section">
                          <h4>Starting Agent</h4>
                          <label className="journey-starting-agent-option">
                            <input
                              type="checkbox"
                              checked={currentJourney.startingAgentId === selectedAgent.id}
                              onChange={() => setCurrentJourney({ ...currentJourney, startingAgentId: selectedAgent.id })}
                              disabled={disabled || !isAdmin}
                            />
                            <span>Set as starting agent</span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* Tools Tab */}
                    {agentEditorTab === 'tools' && (
                      <div className="journey-agent-section">
                        <ToolEditor
                          tools={selectedAgent.tools}
                          onChange={(tools) => handleUpdateAgent({ ...selectedAgent, tools })}
                          disabled={disabled || !isAdmin}
                        />
                      </div>
                    )}

                    {/* Screens Tab */}
                    {agentEditorTab === 'screens' && (
                      <div className="journey-agent-section journey-agent-screens-section">
                        <div className="journey-agent-screens-header">
                          <h4>Screens (SDUI)</h4>
                          <div className="journey-agent-screens-actions">
                            <div className="journey-screens-view-toggle">
                              <button
                                className={`journey-view-toggle-btn ${!showScreensJsonView ? 'active' : ''}`}
                                onClick={() => setShowScreensJsonView(false)}
                                type="button"
                              >
                                UI
                              </button>
                              <button
                                className={`journey-view-toggle-btn ${showScreensJsonView ? 'active' : ''}`}
                                onClick={() => {
                                  const jsonObj = {
                                    screens: selectedAgent.screens || [],
                                    screenPrompts: selectedAgent.screenPrompts || {},
                                  };
                                  setScreensJsonValue(JSON.stringify(jsonObj, null, 2));
                                  setShowScreensJsonView(true);
                                }}
                                type="button"
                              >
                                JSON
                              </button>
                            </div>
                            {isAdmin && !showScreensJsonView && (
                              <button
                                className="journey-agent-add-screen-btn"
                                onClick={() => handleAddScreen()}
                                disabled={disabled}
                                type="button"
                              >
                                + Add Screen
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="journey-agent-section-desc">
                          Define screen-based UI for this agent. Screens enable visual interactions alongside voice.
                        </p>

                        {showScreensJsonView ? (
                          <div className="journey-screens-json-view">
                            <textarea
                              className="journey-screens-json-editor"
                              value={screensJsonValue}
                              onChange={(e) => setScreensJsonValue(e.target.value)}
                              disabled={disabled || !isAdmin}
                              spellCheck={false}
                              placeholder='{"screens": [], "screenPrompts": {}}'
                            />
                            {isAdmin && (
                              <div className="journey-screens-json-actions">
                                <button
                                  className="journey-screens-json-save-btn"
                                  onClick={() => {
                                    try {
                                      const parsed = JSON.parse(screensJsonValue);
                                      if (parsed.screens && Array.isArray(parsed.screens)) {
                                        handleUpdateAgent({
                                          ...selectedAgent,
                                          screens: parsed.screens,
                                          screenPrompts: parsed.screenPrompts ?? selectedAgent.screenPrompts,
                                        });
                                        alert('Screens updated. Click "Save" to persist changes.');
                                      } else {
                                        alert('Invalid JSON: "screens" must be an array');
                                      }
                                    } catch (e) {
                                      alert('Invalid JSON format: ' + (e instanceof Error ? e.message : 'Parse error'));
                                    }
                                  }}
                                  disabled={disabled}
                                  type="button"
                                >
                                  Apply Changes
                                </button>
                              </div>
                            )}
                          </div>
                        ) : !selectedAgent.screens || selectedAgent.screens.length === 0 ? (
                          <div className="journey-screens-empty">
                            <p>No screens defined yet.</p>
                            {isAdmin && (
                              <button 
                                onClick={() => handleAddScreen()} 
                                disabled={disabled}
                                className="journey-agent-add-screen-empty-btn"
                                type="button"
                              >
                                + Create First Screen
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="journey-agent-screens-list">
                            {selectedAgent.screens.map((screen, index) => (
                              <div key={screen.id} className="journey-agent-screen-item">
                                <div className="journey-agent-screen-item-header">
                                  <strong>{screen.id}</strong>
                                  <span className="journey-agent-screen-item-title">{screen.title}</span>
                                </div>
                                <div className="journey-agent-screen-item-meta">
                                  {screen.sections.length} section(s), {screen.sections.reduce((acc, s) => acc + s.elements.length, 0)} element(s)
                                </div>
                                {isAdmin && (
                                  <div className="journey-agent-screen-item-actions">
                                    <button onClick={() => handleEditScreen(screen)} disabled={disabled} type="button">
                                      <EditIcon size={12} /> Edit
                                    </button>
                                    <button onClick={() => handleRemoveScreen(index)} disabled={disabled} type="button">
                                      <TrashIcon size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

      {/* Version History Modal */}
      {showVersionHistory && currentJourney && (
        <VersionHistory
          journeyId={currentJourney.id}
          onClose={() => setShowVersionHistory(false)}
          onRestore={(restored) => {
            // The server returns a fully normalized Journey object
            setCurrentJourney({
              ...restored,
              agents: restored.agents as Agent[],
              voice: restored.voice || undefined,
            } as Journey);
            setShowVersionHistory(false);
          }}
        />
      )}
    </div>
  );
};

export default JourneyBuilder;

