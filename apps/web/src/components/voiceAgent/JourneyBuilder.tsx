import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import {
  Journey,
  Agent,
  DEFAULT_SYSTEM_PROMPT,
  validateJourney,
  Screen,
  TtsProvider,
  ELEVENLABS_VOICE_OPTIONS,
  AZURE_VOICE_OPTIONS,
  JourneyAiProposalScope,
  JourneyAiProposalResponse,
} from '../../types/journey';
import { loadJourney, loadJourneyForRuntime, saveJourney, deleteJourney, duplicateJourney } from '../../services/journeyStorage';
import {
  publishJourney as publishJourneyApi,
  unpublishJourney as unpublishJourneyApi,
  getPublishedJourney,
  createJourneyAiProposal,
  applyJourneyAiProposal,
} from '../../services/api/journeyService';
import { SCREEN_TEMPLATES } from '../../lib/voiceAgent/screenTemplates';
import { generateScreensFromPrompts, suggestionToScreen, ScreenSuggestion } from '../../services/aiScreenGenerator';
import SystemPromptEditor from './SystemPromptEditor';
import ToolEditor from './ToolEditor';
import { ScreenProvider } from '../../contexts/voiceAgent/ScreenContext';
import ScreenPreview from './ScreenPreview';
import {
  TrashIcon,
  FileTextIcon,
  EditIcon,
  RocketIcon,
  TargetIcon,
  HistoryIcon,
  SaveIcon,
  ToolIcon,
  SettingsIcon,
  MoreIcon,
  DownloadIcon,
  UploadIcon,
  LinkIcon,
  CheckIcon,
  LoaderIcon,
  CopyIcon,
  ZapIcon,
} from '../Icons';
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

interface AgentPromptDiff {
  agentId: string;
  agentName: string;
  before: string;
  after: string;
}

interface AgentScreenChange {
  agentId: string;
  agentName: string;
  addedScreenIds: string[];
  removedScreenIds: string[];
  updatedScreenIds: string[];
  screenPromptsChanged: boolean;
  beforeScreenPromptCount: number;
  afterScreenPromptCount: number;
}

interface JourneyProposalDiffSummary {
  systemPromptChanged: boolean;
  systemPromptBefore: string;
  systemPromptAfter: string;
  agentPromptDiffs: AgentPromptDiff[];
  agentScreenChanges: AgentScreenChange[];
}

const JOURNEY_AI_SCOPE_OPTIONS: Array<{ value: JourneyAiProposalScope; label: string }> = [
  { value: 'journey', label: 'Entire flow' },
  { value: 'agent', label: 'Agent prompts + config' },
  { value: 'screens', label: 'Agent screens only' },
];

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalizeJourneyFromDraft(draft: Journey): Journey {
  return {
    id: draft.id,
    name: draft.name || 'Untitled Flow',
    description: draft.description || '',
    systemPrompt: draft.systemPrompt || '',
    voice: draft.voice || undefined,
    voiceEnabled: draft.voiceEnabled ?? true,
    ttsProvider: draft.ttsProvider,
    elevenLabsConfig: draft.elevenLabsConfig,
    azureConfig: draft.azureConfig,
    research: draft.research,
    agents: Array.isArray(draft.agents) ? (draft.agents as Agent[]) : [],
    startingAgentId: draft.startingAgentId || '',
    createdAt: draft.createdAt || new Date().toISOString(),
    updatedAt: draft.updatedAt || new Date().toISOString(),
    version: draft.version || '1.0.0',
    customVariables: draft.customVariables,
  };
}

function summarizeJourneyProposalDiff(currentJourney: Journey, proposedJourneyDraft: Journey): JourneyProposalDiffSummary {
  const proposedJourney = normalizeJourneyFromDraft(proposedJourneyDraft);
  const currentAgentsById = new Map(currentJourney.agents.map((agent) => [agent.id, agent]));
  const proposedAgentsById = new Map(proposedJourney.agents.map((agent) => [agent.id, agent]));

  const allAgentIds = new Set<string>([
    ...currentAgentsById.keys(),
    ...proposedAgentsById.keys(),
  ]);

  const agentPromptDiffs: AgentPromptDiff[] = [];
  const agentScreenChanges: AgentScreenChange[] = [];

  allAgentIds.forEach((agentId) => {
    const beforeAgent = currentAgentsById.get(agentId);
    const afterAgent = proposedAgentsById.get(agentId);
    const agentName = afterAgent?.name || beforeAgent?.name || agentId;

    if ((beforeAgent?.prompt || '') !== (afterAgent?.prompt || '')) {
      agentPromptDiffs.push({
        agentId,
        agentName,
        before: beforeAgent?.prompt || '',
        after: afterAgent?.prompt || '',
      });
    }

    const beforeScreens = (Array.isArray(beforeAgent?.screens) ? beforeAgent?.screens : []) as Screen[];
    const afterScreens = (Array.isArray(afterAgent?.screens) ? afterAgent?.screens : []) as Screen[];
    const beforeScreenIds = new Set(beforeScreens.map((screen) => screen.id));
    const afterScreenIds = new Set(afterScreens.map((screen) => screen.id));

    const addedScreenIds = Array.from(afterScreenIds).filter((screenId) => !beforeScreenIds.has(screenId));
    const removedScreenIds = Array.from(beforeScreenIds).filter((screenId) => !afterScreenIds.has(screenId));
    const updatedScreenIds = Array.from(afterScreenIds).filter((screenId) => {
      if (!beforeScreenIds.has(screenId)) return false;
      const beforeScreen = beforeScreens.find((screen) => screen.id === screenId);
      const afterScreen = afterScreens.find((screen) => screen.id === screenId);
      return JSON.stringify(beforeScreen) !== JSON.stringify(afterScreen);
    });

    const beforeScreenPrompts = beforeAgent?.screenPrompts || {};
    const afterScreenPrompts = afterAgent?.screenPrompts || {};
    const screenPromptsChanged = JSON.stringify(beforeScreenPrompts) !== JSON.stringify(afterScreenPrompts);

    if (addedScreenIds.length > 0 || removedScreenIds.length > 0 || updatedScreenIds.length > 0 || screenPromptsChanged) {
      agentScreenChanges.push({
        agentId,
        agentName,
        addedScreenIds,
        removedScreenIds,
        updatedScreenIds,
        screenPromptsChanged,
        beforeScreenPromptCount: Object.keys(beforeScreenPrompts).length,
        afterScreenPromptCount: Object.keys(afterScreenPrompts).length,
      });
    }
  });

  return {
    systemPromptChanged: currentJourney.systemPrompt !== proposedJourney.systemPrompt,
    systemPromptBefore: currentJourney.systemPrompt || '',
    systemPromptAfter: proposedJourney.systemPrompt || '',
    agentPromptDiffs,
    agentScreenChanges,
  };
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
  const [showAiFlowEditModal, setShowAiFlowEditModal] = useState(false);
  const [aiFlowScope, setAiFlowScope] = useState<JourneyAiProposalScope>('journey');
  const [aiFlowRequest, setAiFlowRequest] = useState('');
  const [aiFlowFeedback, setAiFlowFeedback] = useState('');
  const [aiFlowTargetAgentId, setAiFlowTargetAgentId] = useState('');
  const [aiFlowTargetScreenIds, setAiFlowTargetScreenIds] = useState<string[]>([]);
  const [aiFlowProposal, setAiFlowProposal] = useState<JourneyAiProposalResponse | null>(null);
  const [isCreatingAiFlowProposal, setIsCreatingAiFlowProposal] = useState(false);
  const [aiFlowProposalError, setAiFlowProposalError] = useState<string | null>(null);
  const [isApplyingAiFlowProposal, setIsApplyingAiFlowProposal] = useState(false);
  const [aiFlowApplyError, setAiFlowApplyError] = useState<string | null>(null);
  const [aiFlowChangeNotes, setAiFlowChangeNotes] = useState('');
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const lastSavedJourneyRef = useRef<string | null>(null);
  
  // Auto-save state
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSaveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const hasInitialLoadRef = useRef(false);
  
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
        // Use loadJourneyForRuntime which auto-detects production vs development
        // In production: loads from Object Storage (source of truth)
        // In development: loads from database
        console.log(`[JourneyBuilder] Loading journey via runtime loader (auto-detects source)...`);
        let journeyToEdit = await loadJourneyForRuntime(editId);
        console.log(`[JourneyBuilder] Runtime loader result:`, journeyToEdit ? journeyToEdit.name : 'null');
        
        // Fallback: try loading from user's journeys (database) if runtime loader returned null
        if (!journeyToEdit) {
          console.log(`[JourneyBuilder] Runtime loader returned null, trying database fallback...`);
          journeyToEdit = await loadJourney(editId);
          console.log(`[JourneyBuilder] Database fallback result:`, journeyToEdit ? journeyToEdit.name : 'null');
        }
        
        if (journeyToEdit) {
          console.log(`[JourneyBuilder] Successfully loaded journey: ${journeyToEdit.name}`);
          setCurrentJourney(journeyToEdit);
          lastSavedJourneyRef.current = JSON.stringify(journeyToEdit);
          setSelectedAgentId(journeyToEdit.agents.length > 0 ? journeyToEdit.agents[0].id : null);
          setIsLoading(false);
          hasInitialLoadRef.current = true;
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

  // Auto-save: debounced save after each edit (1.5s delay)
  useEffect(() => {
    if (!hasInitialLoadRef.current || !currentJourney) return;
    if (currentJourney.id.startsWith('new-')) return;

    const currentJson = JSON.stringify(currentJourney);
    if (currentJson === lastSavedJourneyRef.current) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      setAutoSaveStatus('saving');
      try {
        console.log('[AutoSave] Saving journey...');
        const savedJourney = await saveJourney(currentJourney);
        if (savedJourney) {
          lastSavedJourneyRef.current = JSON.stringify(savedJourney);
          setHasUnsavedChanges(false);
          setAutoSaveStatus('saved');
          console.log('[AutoSave] Journey saved successfully');
          try {
            const channel = new BroadcastChannel('journey-updates');
            channel.postMessage({
              type: 'journey-saved',
              journeyId: savedJourney.id,
              timestamp: Date.now(),
            });
            channel.close();
          } catch (e) {}
          if (autoSaveStatusTimerRef.current) {
            clearTimeout(autoSaveStatusTimerRef.current);
          }
          autoSaveStatusTimerRef.current = setTimeout(() => setAutoSaveStatus('idle'), 2000);
        } else {
          setAutoSaveStatus('failed');
        }
      } catch (error) {
        console.error('[AutoSave] Failed:', error);
        setAutoSaveStatus('failed');
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentJourney]);

  // Cleanup auto-save timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (autoSaveStatusTimerRef.current) clearTimeout(autoSaveStatusTimerRef.current);
    };
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

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const errors = validateJourney(currentJourney);
    setValidationErrors(errors);

    if (errors.length > 0) {
      alert(`Cannot save: ${errors.length} validation error(s). Check the validation panel.`);
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setAutoSaveStatus('idle');
    try {
      const savedJourney = await saveJourney(currentJourney);
      if (savedJourney) {
        // Update currentJourney with the saved journey (may have new ID)
        setCurrentJourney(savedJourney);
        try {
          const channel = new BroadcastChannel('journey-updates');
          channel.postMessage({
            type: 'journey-saved',
            journeyId: savedJourney.id,
            timestamp: Date.now(),
          });
          channel.close();
        } catch (e) {
          // BroadcastChannel not supported
        }
        lastSavedJourneyRef.current = JSON.stringify(savedJourney);
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

  const toPublishComparable = (journeyLike: any) => JSON.stringify({
    name: journeyLike?.name || '',
    description: journeyLike?.description || '',
    systemPrompt: journeyLike?.systemPrompt || '',
    voice: journeyLike?.voice || null,
    voiceEnabled: journeyLike?.voiceEnabled ?? true,
    ttsProvider: journeyLike?.ttsProvider || 'elevenlabs',
    elevenLabsConfig: journeyLike?.elevenLabsConfig || null,
    agents: journeyLike?.agents || [],
    startingAgentId: journeyLike?.startingAgentId || '',
    version: journeyLike?.version || '1.0.0',
  });

  // Check publish status when journey loads
  useEffect(() => {
    const checkPublishStatus = async () => {
      if (currentJourney?.id && !currentJourney.id.startsWith('new-')) {
        try {
          const published = await getPublishedJourney(currentJourney.id);
          setIsPublished(!!published);
          if (published) {
            const journeyJson = toPublishComparable(currentJourney);
            const publishedJson = toPublishComparable(published);
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
      const savedJourney = await saveJourney(currentJourney);
      console.log('🚀 Save result:', savedJourney);
      
      if (!savedJourney) {
        alert('Failed to save journey before publishing');
        return;
      }
      
      // Update currentJourney with the saved journey (may have new ID)
      setCurrentJourney(savedJourney);
      lastSavedJourneyRef.current = JSON.stringify(savedJourney);
      setHasUnsavedChanges(false);
      
      console.log('🚀 Publishing journey with ID:', savedJourney.id);
      const result = await publishJourneyApi(savedJourney.id);
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

  const handleLaunch = async () => {
    if (!currentJourney) return;

    const errors = validateJourney(currentJourney);
    if (errors.length > 0) {
      alert(`Cannot launch: ${errors.length} validation error(s). Please fix them first.`);
      setValidationErrors(errors);
      return;
    }

    if (hasUnsavedChanges && !currentJourney.id.startsWith('new-')) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      try {
        console.log('[Launch] Saving journey before launch...');
        const savedJourney = await saveJourney(currentJourney);
        if (savedJourney) {
          lastSavedJourneyRef.current = JSON.stringify(savedJourney);
          setHasUnsavedChanges(false);
          console.log('[Launch] Journey saved successfully before launch');
        }
      } catch (error) {
        console.error('[Launch] Failed to save before launch:', error);
      }
    }

    onLaunchJourney(currentJourney);
  };

  const selectedAgent = currentJourney?.agents.find(a => a.id === selectedAgentId) || null;
  const availableHandoffTargets = currentJourney?.agents.filter(a => a.id !== selectedAgentId) || [];
  const aiFlowTargetAgent =
    currentJourney?.agents.find((agent) => agent.id === aiFlowTargetAgentId) || null;
  const aiFlowTargetAgentScreens = aiFlowTargetAgent?.screens || [];

  const aiProposalDiffSummary = useMemo(() => {
    if (!currentJourney || !aiFlowProposal) return null;
    return summarizeJourneyProposalDiff(
      currentJourney,
      aiFlowProposal.updatedJourneyDraft as Journey
    );
  }, [currentJourney, aiFlowProposal]);

  const handleOpenAiFlowEditor = () => {
    if (!currentJourney) return;
    if (currentJourney.id.startsWith('new-')) {
      alert('Save this flow first, then run AI flow editing.');
      return;
    }
    setShowAiFlowEditModal(true);
    setAiFlowProposal(null);
    setAiFlowProposalError(null);
    setAiFlowApplyError(null);
    setAiFlowTargetScreenIds([]);
    setAiFlowTargetAgentId(selectedAgentId || currentJourney.agents[0]?.id || '');
    if (!aiFlowRequest.trim()) {
      setAiFlowRequest('Update prompts and screens to improve flow consistency and clarity.');
    }
  };

  const handleCloseAiFlowEditor = () => {
    setShowAiFlowEditModal(false);
    setAiFlowProposalError(null);
    setAiFlowApplyError(null);
  };

  const handleToggleAiFlowScreen = (screenId: string) => {
    setAiFlowTargetScreenIds((previous) =>
      previous.includes(screenId)
        ? previous.filter((id) => id !== screenId)
        : [...previous, screenId]
    );
  };

  const handleGenerateAiFlowProposal = async () => {
    if (!currentJourney || isCreatingAiFlowProposal) return;

    const trimmedRequest = aiFlowRequest.trim();
    if (!trimmedRequest) {
      setAiFlowProposalError('Add a change request before generating a proposal.');
      return;
    }

    if ((aiFlowScope === 'agent' || aiFlowScope === 'screens') && !aiFlowTargetAgentId) {
      setAiFlowProposalError('Select an agent for agent/screen scoped edits.');
      return;
    }

    if (currentJourney.id.startsWith('new-')) {
      setAiFlowProposalError('Save this flow first before requesting AI edits.');
      return;
    }

    setIsCreatingAiFlowProposal(true);
    setAiFlowProposalError(null);
    setAiFlowApplyError(null);
    try {
      const proposal = await createJourneyAiProposal(currentJourney.id, {
        request: trimmedRequest,
        scope: aiFlowScope,
        agentId: aiFlowScope === 'journey' ? undefined : aiFlowTargetAgentId,
        screenIds:
          aiFlowScope === 'screens' && aiFlowTargetScreenIds.length > 0
            ? aiFlowTargetScreenIds
            : undefined,
        feedback: aiFlowFeedback.trim() || undefined,
      });
      setAiFlowProposal(proposal);
    } catch (error) {
      setAiFlowProposal(null);
      const message = error instanceof Error ? error.message : 'Failed to create AI proposal';
      setAiFlowProposalError(message);
    } finally {
      setIsCreatingAiFlowProposal(false);
    }
  };

  const handleApplyAiFlowProposal = async () => {
    if (!currentJourney || !aiFlowProposal || isApplyingAiFlowProposal) return;

    setIsApplyingAiFlowProposal(true);
    setAiFlowApplyError(null);
    try {
      const applyResult = await applyJourneyAiProposal(
        currentJourney.id,
        aiFlowProposal.proposalId,
        { changeNotes: aiFlowChangeNotes.trim() || undefined }
      );
      const normalizedJourney = normalizeJourneyFromDraft(applyResult.journey as Journey);

      setCurrentJourney(normalizedJourney);
      lastSavedJourneyRef.current = JSON.stringify(normalizedJourney);
      setHasUnsavedChanges(false);
      setAutoSaveStatus('idle');
      setAiFlowProposal(null);
      setAiFlowChangeNotes('');
      setAiFlowFeedback('');
      setShowAiFlowEditModal(false);

      if (selectedAgentId && !normalizedJourney.agents.some((agent) => agent.id === selectedAgentId)) {
        setSelectedAgentId(normalizedJourney.agents[0]?.id || null);
      }
      alert('AI proposal applied successfully.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply AI proposal';
      setAiFlowApplyError(message);
    } finally {
      setIsApplyingAiFlowProposal(false);
    }
  };

  useEffect(() => {
    if (!showAiFlowEditModal) return;
    if (aiFlowScope === 'journey') {
      setAiFlowTargetScreenIds([]);
      return;
    }
    if (!aiFlowTargetAgentId) {
      setAiFlowTargetAgentId(selectedAgentId || currentJourney?.agents[0]?.id || '');
    }
  }, [showAiFlowEditModal, aiFlowScope, aiFlowTargetAgentId, selectedAgentId, currentJourney?.agents]);

  useEffect(() => {
    if (aiFlowScope !== 'screens') {
      setAiFlowTargetScreenIds([]);
      return;
    }
    if (!aiFlowTargetAgentScreens.length) {
      setAiFlowTargetScreenIds([]);
      return;
    }
    const validScreenIds = new Set(aiFlowTargetAgentScreens.map((screen) => screen.id));
    setAiFlowTargetScreenIds((previous) =>
      previous.filter((screenId) => validScreenIds.has(screenId))
    );
  }, [aiFlowScope, aiFlowTargetAgentId, aiFlowTargetAgentScreens]);

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

  const handleEditScreen = async (screen: Screen) => {
    if (!currentJourney || !selectedAgent) return;
    try {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      await saveJourney(currentJourney);
      lastSavedJourneyRef.current = JSON.stringify(currentJourney);
      setHasUnsavedChanges(false);
      navigate(`/screens?journeyId=${currentJourney.id}&agentId=${selectedAgent.id}&screenId=${screen.id}`);
    } catch (err) {
      console.error('handleEditScreen: save/navigation failed', err);
    }
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

  const handleAddScreen = async (templateId?: string) => {
    if (!selectedAgent || !currentJourney) return;

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
    
    const updatedJourney = {
      ...currentJourney,
      agents: currentJourney.agents.map(a => a.id === updatedAgent.id ? updatedAgent : a),
    };
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    try {
      await saveJourney(updatedJourney);
      lastSavedJourneyRef.current = JSON.stringify(updatedJourney);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('handleAddScreen: save failed', err);
    }
    navigate(`/screens?journeyId=${currentJourney.id}&agentId=${selectedAgent.id}&screenId=${newScreen.id}`);
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
              aria-label="Back to flows"
              title="Back to flows"
              onClick={() => navigate('/')}
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
                <>
                  {autoSaveStatus !== 'idle' && (
                    <span className={`journey-autosave-status ${autoSaveStatus}`}>
                      {autoSaveStatus === 'saving' ? 'Saving...' : autoSaveStatus === 'saved' ? 'Saved' : 'Save failed'}
                    </span>
                  )}
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
                </>
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
                      {isAdmin && (
                        <button
                          className="journey-more-menu-item"
                          onClick={() => { handleOpenAiFlowEditor(); setShowMoreMenu(false); }}
                          disabled={disabled}
                        >
                          <ZapIcon size={14} /> AI Flow Edit
                        </button>
                      )}
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
                              <>
                                <button
                                  className="journey-ai-generate-btn"
                                  onClick={() => setShowAICustomizeModal(true)}
                                  disabled={disabled || isGeneratingScreens}
                                  type="button"
                                >
                                  ✨ AI Suggest
                                </button>
                                <button
                                  className="journey-agent-add-screen-btn"
                                  onClick={() => handleAddScreen()}
                                  disabled={disabled}
                                  type="button"
                                >
                                  + Add Screen
                                </button>
                              </>
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


      {/* AI Flow Edit Modal */}
      {showAiFlowEditModal && currentJourney && (
        <div className="journey-ai-modal-overlay" onClick={handleCloseAiFlowEditor}>
          <div className="journey-ai-modal journey-ai-flow-editor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="journey-ai-modal-header">
              <h3>AI Flow Editor</h3>
              <button onClick={handleCloseAiFlowEditor} className="journey-modal-close-btn">✕</button>
            </div>

            <div className="journey-ai-modal-content">
              <div className="journey-ai-flow-intro">
                <p>
                  Generate a draft proposal first, preview prompt/screen changes, then apply only when the draft looks correct.
                  Use feedback to rerun the proposal until it matches your intent.
                </p>
              </div>

              <div className="journey-ai-flow-field">
                <label htmlFor="journey-ai-flow-request">Requested update</label>
                <textarea
                  id="journey-ai-flow-request"
                  className="journey-ai-instructions-input"
                  value={aiFlowRequest}
                  onChange={(e) => setAiFlowRequest(e.target.value)}
                  placeholder="Example: tighten the intake prompts, add a consent screen, and align screen prompts to every new screen."
                  rows={4}
                />
              </div>

              <div className="journey-ai-flow-controls">
                <label className="journey-ai-flow-field">
                  <span>Scope</span>
                  <select
                    value={aiFlowScope}
                    onChange={(e) => setAiFlowScope(e.target.value as JourneyAiProposalScope)}
                  >
                    {JOURNEY_AI_SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {(aiFlowScope === 'agent' || aiFlowScope === 'screens') && (
                  <label className="journey-ai-flow-field">
                    <span>Target Agent</span>
                    <select
                      value={aiFlowTargetAgentId}
                      onChange={(e) => setAiFlowTargetAgentId(e.target.value)}
                    >
                      <option value="">Select an agent...</option>
                      {currentJourney.agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {aiFlowScope === 'screens' && (
                <div className="journey-ai-flow-field">
                  <label>Target Screens (optional)</label>
                  {!aiFlowTargetAgent ? (
                    <p className="journey-ai-flow-empty">Select an agent to choose screens.</p>
                  ) : aiFlowTargetAgentScreens.length === 0 ? (
                    <p className="journey-ai-flow-empty">This agent has no screens yet. Ask AI to create them.</p>
                  ) : (
                    <>
                      <div className="journey-ai-flow-screen-actions">
                        <button
                          type="button"
                          className="journey-ai-flow-secondary-btn"
                          onClick={() => setAiFlowTargetScreenIds([])}
                        >
                          Use All Screens
                        </button>
                        <span>
                          {aiFlowTargetScreenIds.length === 0
                            ? 'All screens included'
                            : `${aiFlowTargetScreenIds.length} selected`}
                        </span>
                      </div>
                      <div className="journey-ai-flow-screen-grid">
                        {aiFlowTargetAgentScreens.map((screen) => (
                          <label key={screen.id} className="journey-ai-flow-screen-option">
                            <input
                              type="checkbox"
                              checked={aiFlowTargetScreenIds.includes(screen.id)}
                              onChange={() => handleToggleAiFlowScreen(screen.id)}
                            />
                            <span>
                              <strong>{screen.id}</strong>
                              <small>{screen.title}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="journey-ai-flow-field">
                <label htmlFor="journey-ai-flow-feedback">Feedback for retry (optional)</label>
                <textarea
                  id="journey-ai-flow-feedback"
                  className="journey-ai-instructions-input"
                  value={aiFlowFeedback}
                  onChange={(e) => setAiFlowFeedback(e.target.value)}
                  placeholder="Example: keep existing screen IDs and do not alter tool-call event names."
                  rows={3}
                />
              </div>

              {aiFlowProposalError && (
                <div className="journey-ai-flow-error">
                  {aiFlowProposalError}
                </div>
              )}

              <div className="journey-ai-customize-actions">
                <button
                  className="journey-ai-cancel-btn"
                  onClick={handleCloseAiFlowEditor}
                >
                  Cancel
                </button>
                <button
                  className="journey-ai-generate-btn"
                  onClick={handleGenerateAiFlowProposal}
                  disabled={isCreatingAiFlowProposal}
                >
                  {isCreatingAiFlowProposal ? (
                    <><LoaderIcon size={14} className="spin-animation" /> Generating...</>
                  ) : aiFlowProposal ? (
                    'Regenerate Proposal'
                  ) : (
                    'Generate Proposal'
                  )}
                </button>
              </div>

              {aiFlowProposal && (
                <div className="journey-ai-proposal-preview">
                  <div className="journey-ai-proposal-header">
                    <div>
                      <h4>Proposal Preview</h4>
                      <p>{aiFlowProposal.summary}</p>
                    </div>
                    <span className={`journey-ai-proposal-status ${aiFlowProposal.isReadyToApply ? 'ready' : 'blocked'}`}>
                      {aiFlowProposal.isReadyToApply ? 'Ready to apply' : 'Needs fixes'}
                    </span>
                  </div>

                  <div className="journey-ai-proposal-meta">
                    <span>Scope: <strong>{aiFlowProposal.scope}</strong></span>
                    <span>Created: <strong>{formatDateTime(aiFlowProposal.createdAt)}</strong></span>
                    <span>Expires: <strong>{formatDateTime(aiFlowProposal.expiresAt)}</strong></span>
                  </div>

                  {aiFlowProposal.changedPaths.length > 0 && (
                    <div className="journey-ai-proposal-paths">
                      {aiFlowProposal.changedPaths.map((path) => (
                        <code key={path}>{path}</code>
                      ))}
                    </div>
                  )}

                  {(aiFlowProposal.validation.errors.length > 0 || aiFlowProposal.validation.warnings.length > 0) && (
                    <div className="journey-ai-proposal-validation">
                      {aiFlowProposal.validation.errors.length > 0 && (
                        <div>
                          <h5>Validation Errors ({aiFlowProposal.validation.errors.length})</h5>
                          <ul>
                            {aiFlowProposal.validation.errors.map((issue, index) => (
                              <li key={`${issue.path}-${index}`}>
                                <code>{issue.path}</code> - {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiFlowProposal.validation.warnings.length > 0 && (
                        <div>
                          <h5>Warnings ({aiFlowProposal.validation.warnings.length})</h5>
                          <ul>
                            {aiFlowProposal.validation.warnings.map((issue, index) => (
                              <li key={`${issue.path}-${index}`}>
                                <code>{issue.path}</code> - {issue.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {aiProposalDiffSummary && (
                    <div className="journey-ai-proposal-diff">
                      <div className="journey-ai-proposal-diff-stats">
                        <div>
                          <span>System Prompt</span>
                          <strong>{aiProposalDiffSummary.systemPromptChanged ? 'Updated' : 'No change'}</strong>
                        </div>
                        <div>
                          <span>Agent Prompts</span>
                          <strong>{aiProposalDiffSummary.agentPromptDiffs.length} changed</strong>
                        </div>
                        <div>
                          <span>Screen Groups</span>
                          <strong>{aiProposalDiffSummary.agentScreenChanges.length} changed</strong>
                        </div>
                      </div>

                      {aiProposalDiffSummary.systemPromptChanged && (
                        <div className="journey-ai-proposal-prompt-diff">
                          <h5>System Prompt Diff</h5>
                          <div className="journey-ai-proposal-prompt-columns">
                            <textarea value={aiProposalDiffSummary.systemPromptBefore} readOnly />
                            <textarea value={aiProposalDiffSummary.systemPromptAfter} readOnly />
                          </div>
                        </div>
                      )}

                      {aiProposalDiffSummary.agentPromptDiffs.length > 0 && (
                        <div className="journey-ai-proposal-prompt-diff">
                          <h5>Agent Prompt Diffs</h5>
                          {aiProposalDiffSummary.agentPromptDiffs.map((promptDiff) => (
                            <div key={promptDiff.agentId} className="journey-ai-proposal-agent-prompt">
                              <span>{promptDiff.agentName}</span>
                              <div className="journey-ai-proposal-prompt-columns">
                                <textarea value={promptDiff.before} readOnly />
                                <textarea value={promptDiff.after} readOnly />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {aiProposalDiffSummary.agentScreenChanges.length > 0 && (
                        <div className="journey-ai-proposal-screen-diff">
                          <h5>Screen + Screen Prompt Changes</h5>
                          {aiProposalDiffSummary.agentScreenChanges.map((screenChange) => (
                            <div key={screenChange.agentId} className="journey-ai-proposal-screen-card">
                              <span className="journey-ai-proposal-screen-card-title">{screenChange.agentName}</span>
                              <div className="journey-ai-proposal-screen-card-meta">
                                <span>Added: {screenChange.addedScreenIds.length}</span>
                                <span>Removed: {screenChange.removedScreenIds.length}</span>
                                <span>Updated: {screenChange.updatedScreenIds.length}</span>
                                {screenChange.screenPromptsChanged && (
                                  <span>
                                    Screen Prompts: {screenChange.beforeScreenPromptCount} to {screenChange.afterScreenPromptCount}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="journey-ai-flow-field">
                    <label htmlFor="journey-ai-change-notes">Change Notes (optional)</label>
                    <textarea
                      id="journey-ai-change-notes"
                      className="journey-ai-instructions-input"
                      value={aiFlowChangeNotes}
                      onChange={(e) => setAiFlowChangeNotes(e.target.value)}
                      placeholder="Optional note stored in version history, e.g. AI: refined prompts + updated intake screens."
                      rows={2}
                    />
                  </div>

                  {aiFlowApplyError && (
                    <div className="journey-ai-flow-error">
                      {aiFlowApplyError}
                    </div>
                  )}

                  <div className="journey-ai-customize-actions">
                    <button
                      className="journey-ai-cancel-btn"
                      onClick={() => setAiFlowProposal(null)}
                    >
                      Discard Proposal
                    </button>
                    <button
                      className="journey-ai-generate-btn"
                      onClick={handleApplyAiFlowProposal}
                      disabled={!aiFlowProposal.isReadyToApply || isApplyingAiFlowProposal}
                    >
                      {isApplyingAiFlowProposal ? (
                        <><LoaderIcon size={14} className="spin-animation" /> Applying...</>
                      ) : (
                        'Apply Proposal'
                      )}
                    </button>
                  </div>
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
