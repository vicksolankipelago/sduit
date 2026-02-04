import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { Journey, Agent, DEFAULT_SYSTEM_PROMPT, validateJourney, Screen, TtsProvider, ELEVENLABS_VOICE_OPTIONS, AZURE_VOICE_OPTIONS } from '../../types/journey';
import { loadJourney, saveJourney, deleteJourney, duplicateJourney, loadProductionJourney } from '../../services/journeyStorage';
import { publishJourney as publishJourneyApi, unpublishJourney as unpublishJourneyApi, getPublishedJourney } from '../../services/api/journeyService';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { generateScreensFromPrompts, suggestionToScreen, ScreenSuggestion } from '../../services/aiScreenGenerator';
import SystemPromptEditor from './SystemPromptEditor';
import ToolEditor from './ToolEditor';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import ScreenPreview from './ScreenPreview';
import { TrashIcon, FileTextIcon, EditIcon, RocketIcon, TargetIcon, HistoryIcon, SaveIcon, ToolIcon, SettingsIcon, MoreIcon, DownloadIcon, UploadIcon, LinkIcon, CheckIcon, LoaderIcon, CopyIcon } from '../Icons';
import VersionHistory from './VersionHistory';
import { useAuth } from '../../contexts/AuthContext';
import './JourneyBuilder.css';

interface PreviewCredential {
  id: string;
  username: string;
  label: string | null;
  status: 'active' | 'expired' | 'revoked';
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

interface NewCredentialResponse {
  id: string;
  username: string;
  password: string;
  label: string | null;
  expiresAt: string | null;
}

interface BulkCredential {
  username: string;
  password: string;
  label: string | null;
}

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
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedJourneyRef = useRef<string | null>(null);
  
  // Publishing state
  const [isPublished, setIsPublished] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false);
  
  // Embedded agent editor state
  const [agentEditorTab, setAgentEditorTab] = useState<'config' | 'tools' | 'screens'>('config');
  const [showScreensJsonView, setShowScreensJsonView] = useState(false);
  const [screensJsonValue, setScreensJsonValue] = useState('');

  // Preview Access state
  const [previewCredentials, setPreviewCredentials] = useState<PreviewCredential[]>([]);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);
  const [showPreviewAccessSection, setShowPreviewAccessSection] = useState(false);
  const [showCreateCredentialForm, setShowCreateCredentialForm] = useState(false);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [credentialFormLabel, setCredentialFormLabel] = useState('');
  const [credentialFormExpiresAt, setCredentialFormExpiresAt] = useState('');
  const [bulkCount, setBulkCount] = useState('10');
  const [bulkLabelPrefix, setBulkLabelPrefix] = useState('');
  const [isCreatingCredential, setIsCreatingCredential] = useState(false);
  const [newCredential, setNewCredential] = useState<NewCredentialResponse | null>(null);
  const [bulkCredentials, setBulkCredentials] = useState<BulkCredential[]>([]);
  const [showCredentialModal, setShowCredentialModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
        lastSavedJourneyRef.current = JSON.stringify(newJourney);
        setSelectedAgentId(null);
        setIsLoading(false);
        // Clear the query param so refreshing doesn't create another new flow
        setSearchParams({}, { replace: true });
        return;
      }
      
      // Check if we should load a specific flow for editing
      const editId = searchParams.get('id');
      console.log(`[JourneyBuilder] Loading flow with id: ${editId}`);
      if (editId) {
        // First try loading from user's journeys (database)
        console.log(`[JourneyBuilder] Trying to load from user journeys...`);
        let journeyToEdit = await loadJourney(editId);
        console.log(`[JourneyBuilder] User journey result:`, journeyToEdit ? journeyToEdit.name : 'null');
        
        // If not found in user journeys, try loading from published flows (for admin editing)
        if (!journeyToEdit) {
          console.log(`[JourneyBuilder] Journey ${editId} not found in user journeys, trying published flows...`);
          journeyToEdit = await loadProductionJourney(editId);
          console.log(`[JourneyBuilder] Production journey result:`, journeyToEdit ? journeyToEdit.name : 'null');
        }
        
        if (journeyToEdit) {
          console.log(`[JourneyBuilder] Successfully loaded journey: ${journeyToEdit.name}`);
          setCurrentJourney(journeyToEdit);
          lastSavedJourneyRef.current = JSON.stringify(journeyToEdit);
          setSelectedAgentId(journeyToEdit.agents.length > 0 ? journeyToEdit.agents[0].id : null);
          setIsLoading(false);
          // Clear the query param
          setSearchParams({}, { replace: true });
          return;
        }
        console.log(`[JourneyBuilder] Failed to load journey ${editId} from any source, redirecting to home`);
      }
      
      // No flow specified - redirect to main flows page
      console.log(`[JourneyBuilder] No flow to load, redirecting to home`);
      navigate('/');
    };
    
    initAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track unsaved changes
  useEffect(() => {
    if (!currentJourney || !lastSavedJourneyRef.current) {
      setHasUnsavedChanges(false);
      return;
    }
    
    const currentJson = JSON.stringify(currentJourney);
    const hasChanges = currentJson !== lastSavedJourneyRef.current;
    setHasUnsavedChanges(hasChanges);
    
    if (hasChanges) {
      console.log('📝 Unsaved changes detected');
    }
  }, [currentJourney]);

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
    setSaveSuccess(false);
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
        } catch (e) {
          // BroadcastChannel not supported
        }
        lastSavedJourneyRef.current = JSON.stringify(currentJourney);
        setHasUnsavedChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert('Failed to save flow');
      }
    } catch (err) {
      alert('Error saving flow: ' + (err as Error).message);
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
    console.log('🚀 Publish button clicked', { currentJourney: currentJourney?.name, isPublishing });
    
    if (!currentJourney) {
      console.warn('🚀 No journey to publish');
      return;
    }
    
    if (isPublishing) {
      console.warn('🚀 Already publishing, ignoring click');
      return;
    }
    
    const errors = validateJourney(currentJourney);
    console.log('🚀 Validation result:', errors.length, 'errors');
    if (errors.length > 0) {
      alert(`Cannot publish: ${errors.length} validation error(s). Please fix them first.`);
      return;
    }
    
    const confirmMsg = isPublished 
      ? 'Update the published version with your current changes?'
      : 'Publish this flow to production? It will be available for live use.';
    
    if (!window.confirm(confirmMsg)) return;
    
    setIsPublishing(true);
    console.log('🚀 Starting publish...');
    try {
      // First save the journey
      console.log('🚀 Saving journey before publish...');
      const saved = await saveJourney(currentJourney);
      console.log('🚀 Save result:', saved);
      
      if (saved) {
        // Update lastSavedJourneyRef since we just saved
        lastSavedJourneyRef.current = JSON.stringify(currentJourney);
        setHasUnsavedChanges(false);
      }
      
      console.log('🚀 Publishing journey...');
      const result = await publishJourneyApi(currentJourney.id);
      console.log('🚀 Publish result:', result);
      if (result.success) {
        setIsPublished(true);
        setHasUnpublishedChanges(false);
        alert('Flow published successfully!');
      } else {
        console.error('🚀 Publish returned false');
        alert('Failed to publish flow');
      }
    } catch (error) {
      console.error('🚀 Publish error:', error);
      alert('Failed to publish flow: ' + (error as Error).message);
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

  const handleDuplicate = async () => {
    if (!currentJourney) return;
    
    const newJourney = await duplicateJourney(currentJourney.id);
    if (newJourney) {
      // Navigate to the duplicated journey
      navigate(`/builder?id=${newJourney.id}`);
    }
  };

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

  // Preview Access API functions
  const fetchPreviewCredentials = useCallback(async () => {
    if (!currentJourney?.id || currentJourney.id.startsWith('new-')) return;
    
    setIsLoadingCredentials(true);
    try {
      const response = await fetch(`/api/admin/preview-credentials?journeyId=${currentJourney.id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch credentials');
      const data = await response.json();
      setPreviewCredentials(data);
    } catch (error) {
      console.error('Error fetching preview credentials:', error);
    } finally {
      setIsLoadingCredentials(false);
    }
  }, [currentJourney?.id]);

  const handleCreatePreviewCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentJourney?.id || currentJourney.id.startsWith('new-')) {
      alert('Please save the journey first before creating preview credentials.');
      return;
    }

    setIsCreatingCredential(true);
    try {
      if (isBulkMode) {
        const response = await fetch('/api/admin/preview-credentials/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            journeyId: currentJourney.id,
            count: parseInt(bulkCount) || 10,
            labelPrefix: bulkLabelPrefix || undefined,
            expiresAt: credentialFormExpiresAt || undefined,
          }),
        });
        if (!response.ok) throw new Error('Failed to create credentials');
        const data = await response.json();
        setBulkCredentials(data.credentials);
        setShowBulkModal(true);
        setShowCreateCredentialForm(false);
        setBulkCount('10');
        setBulkLabelPrefix('');
        setCredentialFormExpiresAt('');
        fetchPreviewCredentials();
      } else {
        const response = await fetch('/api/admin/preview-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            journeyId: currentJourney.id,
            label: credentialFormLabel || undefined,
            expiresAt: credentialFormExpiresAt || undefined,
          }),
        });
        if (!response.ok) throw new Error('Failed to create credential');
        const data = await response.json();
        setNewCredential(data);
        setShowCredentialModal(true);
        setShowCreateCredentialForm(false);
        setCredentialFormLabel('');
        setCredentialFormExpiresAt('');
        fetchPreviewCredentials();
      }
    } catch (error) {
      console.error('Error creating preview credential:', error);
      alert('Failed to create credential');
    } finally {
      setIsCreatingCredential(false);
    }
  };

  const handleRevokeCredential = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/preview-credentials/${id}/revoke`, {
        method: 'PATCH',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to revoke credential');
      fetchPreviewCredentials();
    } catch (error) {
      console.error('Error revoking credential:', error);
      alert('Failed to revoke credential');
    }
  };

  const handleDeleteCredential = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/preview-credentials/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete credential');
      setDeleteConfirmId(null);
      fetchPreviewCredentials();
    } catch (error) {
      console.error('Error deleting credential:', error);
      alert('Failed to delete credential');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const downloadCredentialsCSV = (creds: BulkCredential[]) => {
    const csvContent = creds.map(c => `${c.username},${c.password}`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview-credentials-${currentJourney?.name?.replace(/[^a-z0-9]/gi, '_') || 'journey'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatCredentialDate = (dateString: string | null): string => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Fetch preview credentials when expanding the section
  useEffect(() => {
    if (showPreviewAccessSection && currentJourney?.research?.isExternal) {
      fetchPreviewCredentials();
    }
  }, [showPreviewAccessSection, fetchPreviewCredentials, currentJourney?.research?.isExternal]);

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
            </div>
          )}
        </div>
        <div className="journey-header-actions">
          {currentJourney && (
            <>
              {isAdmin && (
                <button 
                  className={`journey-action-btn ${hasUnsavedChanges ? 'has-changes' : ''} ${isSaving ? 'saving' : ''} ${saveSuccess ? 'success' : ''}`} 
                  onClick={handleSaveJourney}
                  disabled={disabled || isSaving}
                  title={hasUnsavedChanges ? 'You have unsaved changes' : 'Save flow'}
                >
                  {isSaving ? (
                    <><LoaderIcon size={14} /> Saving...</>
                  ) : saveSuccess ? (
                    <><CheckIcon size={14} /> Saved!</>
                  ) : hasUnsavedChanges ? (
                    <><SaveIcon size={14} /> Save*</>
                  ) : (
                    <><SaveIcon size={14} /> Save</>
                  )}
                </button>
              )}
              {isAdmin && (isPublished ? (
                <button 
                  className={`journey-action-btn publish ${isPublishing ? 'publishing' : ''} ${hasUnpublishedChanges ? 'has-changes' : ''}`}
                  onClick={handlePublish} 
                  disabled={disabled || isPublishing}
                  title={hasUnpublishedChanges ? 'You have unpublished changes' : 'Update published version'}
                >
                  {isPublishing ? (
                    <><LoaderIcon size={14} /> Publishing...</>
                  ) : hasUnpublishedChanges ? (
                    <><RocketIcon size={14} /> Publish Changes</>
                  ) : (
                    <><RocketIcon size={14} /> Republish</>
                  )}
                </button>
              ) : (
                <button 
                  className={`journey-action-btn publish ${isPublishing ? 'publishing' : ''}`}
                  onClick={handlePublish} 
                  disabled={disabled || isPublishing}
                >
                  {isPublishing ? (
                    <><LoaderIcon size={14} /> Publishing...</>
                  ) : (
                    <><RocketIcon size={14} /> Publish</>
                  )}
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
                          onClick={() => { handleDuplicate(); setShowMoreMenu(false); }} 
                          disabled={disabled}
                        >
                          <CopyIcon size={14} /> Duplicate
                        </button>
                      )}
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

              {/* Research Settings */}
              <div className="journey-research-settings">
                <div className="journey-research-settings-header">
                  <label className="journey-research-settings-label">Research Settings</label>
                </div>
                <div className="journey-research-settings-content">
                  <label className="journey-research-settings-item">
                    <span>Study Type</span>
                    <select
                      className="journey-research-settings-select"
                      value={currentJourney.research?.isExternal ? 'external' : 'internal'}
                      onChange={(e) => {
                        const isExternal = e.target.value === 'external';
                        setCurrentJourney({
                          ...currentJourney,
                          research: {
                            ...currentJourney.research,
                            isExternal,
                            prolific: isExternal ? (currentJourney.research?.prolific || { enabled: false }) : undefined
                          }
                        });
                      }}
                      disabled={disabled || !isAdmin}
                    >
                      <option value="internal">Internal (Team use)</option>
                      <option value="external">External (Research participants)</option>
                    </select>
                  </label>

                  {currentJourney.research?.isExternal && (
                    <>
                      {/* Study URL - always shown when External */}
                      <div className="journey-study-url-field">
                        <label>Study URL</label>
                        <div className="journey-study-url-container">
                          <input
                            type="text"
                            className="journey-provider-config-input journey-study-url-input"
                            value={`${window.location.origin}/voice-agent?flow=${currentJourney.id}&PROLIFIC_PID={{%PROLIFIC_PID%}}&SESSION_ID={{%SESSION_ID%}}&STUDY_ID={{%STUDY_ID%}}`}
                            readOnly
                          />
                          <button
                            type="button"
                            className="journey-copy-url-btn"
                            onClick={(e) => {
                              const url = `${window.location.origin}/voice-agent?flow=${currentJourney.id}&PROLIFIC_PID={{%PROLIFIC_PID%}}&SESSION_ID={{%SESSION_ID%}}&STUDY_ID={{%STUDY_ID%}}`;
                              navigator.clipboard.writeText(url);
                              const btn = e.currentTarget;
                              btn.textContent = 'Copied!';
                              setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
                            }}
                            title="Copy URL to clipboard"
                          >
                            Copy
                          </button>
                        </div>
                        <div className="journey-provider-config-hint">
                          Copy this URL into Prolific. The placeholders will be replaced with participant data.
                        </div>
                      </div>

                      <label className="journey-research-settings-item">
                        <span>Prolific Integration</span>
                        <select
                          className="journey-research-settings-select"
                          value={currentJourney.research?.prolific?.enabled ? 'enabled' : 'disabled'}
                          onChange={(e) => {
                            const enabled = e.target.value === 'enabled';
                            setCurrentJourney({
                              ...currentJourney,
                              research: {
                                ...currentJourney.research!,
                                prolific: {
                                  ...currentJourney.research?.prolific,
                                  enabled
                                }
                              }
                            });
                          }}
                          disabled={disabled || !isAdmin}
                        >
                          <option value="disabled">Disabled</option>
                          <option value="enabled">Enabled</option>
                        </select>
                      </label>

                      {currentJourney.research?.prolific?.enabled && (
                        <div className="journey-research-prolific-config">
                          <div className="journey-agent-field">
                            <label>Completion Code</label>
                            <input
                              type="text"
                              className="journey-provider-config-input"
                              value={currentJourney.research?.prolific?.completionCode || ''}
                              onChange={(e) => setCurrentJourney({
                                ...currentJourney,
                                research: {
                                  ...currentJourney.research!,
                                  prolific: {
                                    ...currentJourney.research?.prolific!,
                                    completionCode: e.target.value
                                  }
                                }
                              })}
                              placeholder="e.g., C1ABC2XY"
                              disabled={disabled || !isAdmin}
                            />
                            <div className="journey-provider-config-hint">
                              Code for participants who complete the full study
                            </div>
                          </div>
                          <div className="journey-agent-field">
                            <label>Screen-Out Code</label>
                            <input
                              type="text"
                              className="journey-provider-config-input"
                              value={currentJourney.research?.prolific?.screenOutCode || ''}
                              onChange={(e) => setCurrentJourney({
                                ...currentJourney,
                                research: {
                                  ...currentJourney.research!,
                                  prolific: {
                                    ...currentJourney.research?.prolific!,
                                    screenOutCode: e.target.value
                                  }
                                }
                              })}
                              placeholder="e.g., S1XYZ2AB"
                              disabled={disabled || !isAdmin}
                            />
                            <div className="journey-provider-config-hint">
                              Code for participants who are screened out (didn't qualify)
                            </div>
                          </div>
                          <div className="journey-agent-field">
                            <label>Study ID (Optional)</label>
                            <input
                              type="text"
                              className="journey-provider-config-input"
                              value={currentJourney.research?.prolific?.studyId || ''}
                              onChange={(e) => setCurrentJourney({
                                ...currentJourney,
                                research: {
                                  ...currentJourney.research!,
                                  prolific: {
                                    ...currentJourney.research?.prolific!,
                                    studyId: e.target.value
                                  }
                                }
                              })}
                              placeholder="e.g., 65abc123def456"
                              disabled={disabled || !isAdmin}
                            />
                            <div className="journey-provider-config-hint">
                              Prolific Study ID for validation
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Preview Access - Only show for External studies */}
              {currentJourney.research?.isExternal && (
                <div className="journey-preview-access-settings">
                  <div className="journey-preview-access-header">
                    <div className="journey-preview-access-header-left">
                      <label className="journey-preview-access-label">Preview Access</label>
                      <span className="journey-preview-access-count">
                        {previewCredentials.filter(c => c.status === 'active').length} active credential(s)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="journey-preview-access-toggle-btn"
                      onClick={() => setShowPreviewAccessSection(!showPreviewAccessSection)}
                      disabled={currentJourney.id.startsWith('new-')}
                    >
                      {showPreviewAccessSection ? 'Hide' : 'Manage'}
                    </button>
                  </div>

                  {currentJourney.id.startsWith('new-') && (
                    <div className="journey-preview-access-save-notice">
                      Save the journey first to manage preview credentials.
                    </div>
                  )}

                  {showPreviewAccessSection && !currentJourney.id.startsWith('new-') && (
                    <div className="journey-preview-access-content">
                      <div className="journey-preview-access-actions">
                        <button
                          type="button"
                          className="journey-preview-access-create-btn"
                          onClick={() => setShowCreateCredentialForm(!showCreateCredentialForm)}
                        >
                          {showCreateCredentialForm ? 'Cancel' : '+ Create Access'}
                        </button>
                      </div>

                      {showCreateCredentialForm && (
                        <form className="journey-preview-access-form" onSubmit={handleCreatePreviewCredential}>
                          <div className="journey-preview-access-mode-toggle">
                            <button
                              type="button"
                              className={`journey-preview-mode-btn ${!isBulkMode ? 'active' : ''}`}
                              onClick={() => setIsBulkMode(false)}
                            >
                              Single
                            </button>
                            <button
                              type="button"
                              className={`journey-preview-mode-btn ${isBulkMode ? 'active' : ''}`}
                              onClick={() => setIsBulkMode(true)}
                            >
                              Bulk
                            </button>
                          </div>

                          {isBulkMode ? (
                            <div className="journey-preview-access-form-row">
                              <div className="journey-preview-access-form-group">
                                <label>Number of Credentials</label>
                                <input
                                  type="number"
                                  value={bulkCount}
                                  onChange={(e) => setBulkCount(e.target.value)}
                                  min="1"
                                  max="500"
                                  placeholder="10"
                                />
                              </div>
                              <div className="journey-preview-access-form-group">
                                <label>Label Prefix (optional)</label>
                                <input
                                  type="text"
                                  value={bulkLabelPrefix}
                                  onChange={(e) => setBulkLabelPrefix(e.target.value)}
                                  placeholder="e.g., Participant"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="journey-preview-access-form-row">
                              <div className="journey-preview-access-form-group">
                                <label>Label (optional)</label>
                                <input
                                  type="text"
                                  value={credentialFormLabel}
                                  onChange={(e) => setCredentialFormLabel(e.target.value)}
                                  placeholder="e.g., Test User 1"
                                />
                              </div>
                            </div>
                          )}

                          <div className="journey-preview-access-form-row">
                            <div className="journey-preview-access-form-group">
                              <label>Expires At (optional)</label>
                              <input
                                type="datetime-local"
                                value={credentialFormExpiresAt}
                                onChange={(e) => setCredentialFormExpiresAt(e.target.value)}
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="journey-preview-access-submit-btn"
                            disabled={isCreatingCredential}
                          >
                            {isCreatingCredential ? 'Creating...' : (isBulkMode ? `Create ${bulkCount || 10} Credentials` : 'Create Credential')}
                          </button>
                        </form>
                      )}

                      {isLoadingCredentials ? (
                        <div className="journey-preview-access-loading">Loading credentials...</div>
                      ) : previewCredentials.length === 0 ? (
                        <div className="journey-preview-access-empty">
                          No preview credentials yet. Create one to grant access to preview users.
                        </div>
                      ) : (
                        <div className="journey-preview-access-table-wrapper">
                          <table className="journey-preview-access-table">
                            <thead>
                              <tr>
                                <th>Username</th>
                                <th>Label</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewCredentials.map((cred) => (
                                <tr key={cred.id}>
                                  <td className="journey-preview-username-cell">
                                    <code>{cred.username}</code>
                                  </td>
                                  <td>{cred.label || '—'}</td>
                                  <td>
                                    <span className={`journey-preview-status-badge journey-preview-status-${cred.status}`}>
                                      {cred.status}
                                    </span>
                                  </td>
                                  <td>{formatCredentialDate(cred.createdAt)}</td>
                                  <td className="journey-preview-actions-cell">
                                    {deleteConfirmId === cred.id ? (
                                      <div className="journey-preview-delete-confirm">
                                        <span>Delete?</span>
                                        <button
                                          type="button"
                                          className="journey-preview-action-btn journey-preview-confirm-btn"
                                          onClick={() => handleDeleteCredential(cred.id)}
                                        >
                                          Yes
                                        </button>
                                        <button
                                          type="button"
                                          className="journey-preview-action-btn journey-preview-cancel-btn"
                                          onClick={() => setDeleteConfirmId(null)}
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <>
                                        {cred.status === 'active' && (
                                          <button
                                            type="button"
                                            className="journey-preview-action-btn journey-preview-revoke-btn"
                                            onClick={() => handleRevokeCredential(cred.id)}
                                          >
                                            Revoke
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="journey-preview-action-btn journey-preview-delete-btn"
                                          onClick={() => setDeleteConfirmId(cred.id)}
                                        >
                                          Delete
                                        </button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Single Credential Modal */}
              {showCredentialModal && newCredential && (
                <div className="journey-preview-modal-overlay" onClick={() => setShowCredentialModal(false)}>
                  <div className="journey-preview-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>Credential Created</h3>
                    <div className="journey-preview-modal-warning">
                      ⚠️ Copy the password now! It won't be shown again.
                    </div>
                    <div className="journey-preview-modal-field">
                      <label>Username</label>
                      <div className="journey-preview-modal-value">
                        <code>{newCredential.username}</code>
                        <button type="button" onClick={() => copyToClipboard(newCredential.username)}>Copy</button>
                      </div>
                    </div>
                    <div className="journey-preview-modal-field">
                      <label>Password</label>
                      <div className="journey-preview-modal-value">
                        <code>{newCredential.password}</code>
                        <button type="button" onClick={() => copyToClipboard(newCredential.password)}>Copy</button>
                      </div>
                    </div>
                    {newCredential.label && (
                      <div className="journey-preview-modal-field">
                        <label>Label</label>
                        <span>{newCredential.label}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      className="journey-preview-modal-close-btn"
                      onClick={() => setShowCredentialModal(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Bulk Credentials Modal */}
              {showBulkModal && bulkCredentials.length > 0 && (
                <div className="journey-preview-modal-overlay" onClick={() => setShowBulkModal(false)}>
                  <div className="journey-preview-modal journey-preview-bulk-modal" onClick={(e) => e.stopPropagation()}>
                    <h3>{bulkCredentials.length} Credentials Created</h3>
                    <div className="journey-preview-modal-warning">
                      ⚠️ Download or copy these credentials now! Passwords won't be shown again.
                    </div>
                    <div className="journey-preview-bulk-actions">
                      <button
                        type="button"
                        className="journey-preview-bulk-action-btn"
                        onClick={() => downloadCredentialsCSV(bulkCredentials)}
                      >
                        Download CSV
                      </button>
                      <button
                        type="button"
                        className="journey-preview-bulk-action-btn"
                        onClick={() => {
                          const csv = bulkCredentials.map(c => `${c.username},${c.password}`).join('\n');
                          copyToClipboard(csv);
                        }}
                      >
                        Copy All as CSV
                      </button>
                    </div>
                    <div className="journey-preview-bulk-preview">
                      <p className="journey-preview-bulk-preview-label">Preview (first 5):</p>
                      <pre className="journey-preview-bulk-preview-content">
                        {bulkCredentials.slice(0, 5).map(c => `${c.username},${c.password}`).join('\n')}
                        {bulkCredentials.length > 5 && `\n... and ${bulkCredentials.length - 5} more`}
                      </pre>
                    </div>
                    <button
                      type="button"
                      className="journey-preview-modal-close-btn"
                      onClick={() => setShowBulkModal(false)}
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

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

