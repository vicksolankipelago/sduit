import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Agent, Journey } from '../types/journey';
import { loadJourneyForRuntime, saveJourney } from '../services/journeyStorage';
import AgentNodeEditor from '../components/voiceAgent/AgentNodeEditor';
import { TrashIcon, SaveIcon } from '../components/Icons';
import './AgentEditor.css';

export const AgentEditorPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [journey, setJourney] = useState<Journey | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const journeyId = searchParams.get('journeyId');
  const agentId = searchParams.get('agentId');

  useEffect(() => {
    const loadData = async () => {
      if (!journeyId || !agentId) {
        navigate('/');
        return;
      }

      const loadedJourney = await loadJourneyForRuntime(journeyId);
      if (!loadedJourney) {
        navigate('/');
        return;
      }

      const foundAgent = loadedJourney.agents.find(a => a.id === agentId);
      if (!foundAgent) {
        navigate(`/builder?id=${journeyId}`);
        return;
      }

      setJourney(loadedJourney);
      setAgent(foundAgent);
      setIsLoading(false);
      setHasLoaded(true);
    };

    loadData();
  }, [journeyId, agentId, navigate]);

  useEffect(() => {
    if (!hasLoaded || !journey) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await saveJourney(journey);
        setSaveStatus('saved');
        if (saveStatusTimerRef.current) {
          clearTimeout(saveStatusTimerRef.current);
        }
        saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('failed');
      }
    }, 1500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [journey, hasLoaded]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
    };
  }, []);

  const handleBack = async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (journey) {
      try {
        await saveJourney(journey);
      } catch (err) {
        console.error('Failed to save before navigating back:', err);
      }
    }
    navigate(`/builder?id=${journeyId}`);
  };

  const handleAgentChange = (updatedAgent: Agent) => {
    setAgent(updatedAgent);
    if (journey) {
      const updatedJourney = {
        ...journey,
        agents: journey.agents.map(a => a.id === updatedAgent.id ? updatedAgent : a),
        updatedAt: new Date().toISOString(),
      };
      setJourney(updatedJourney);
    }
  };

  const handleSave = async () => {
    if (!journey) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    
    setIsSaving(true);
    setSaveStatus('saving');
    try {
      await saveJourney(journey);
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) {
        clearTimeout(saveStatusTimerRef.current);
      }
      saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save:', error);
      setSaveStatus('failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!journey || !agent) return;
    
    if (!window.confirm(`Delete agent "${agent.name}"? This cannot be undone.`)) {
      return;
    }

    const updatedJourney = {
      ...journey,
      agents: journey.agents.filter(a => a.id !== agent.id),
      updatedAt: new Date().toISOString(),
    };

    await saveJourney(updatedJourney);
    navigate(`/builder?id=${journeyId}`);
  };

  if (isLoading) {
    return (
      <div className="agent-editor-page">
        <div className="agent-editor-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!journey || !agent) {
    return null;
  }

  return (
    <div className="agent-editor-page">
      <div className="agent-editor-page-header">
        <div className="agent-editor-page-header-left">
          <button className="agent-editor-back-btn" onClick={handleBack} type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Flow
          </button>
          <div className="agent-editor-page-title">
            <h1>{agent.name}</h1>
            <span className="agent-editor-page-subtitle">{journey.name}</span>
          </div>
        </div>
        <div className="agent-editor-page-actions">
          {saveStatus === 'saving' && (
            <span className="agent-editor-save-status saving">Saving...</span>
          )}
          {saveStatus === 'saved' && (
            <span className="agent-editor-save-status saved">Saved</span>
          )}
          {saveStatus === 'failed' && (
            <span className="agent-editor-save-status failed">Save failed</span>
          )}
          <button 
            className="agent-editor-save-btn" 
            onClick={handleSave}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? 'Saving...' : <><SaveIcon size={14} /> Save</>}
          </button>
          <button 
            className="agent-editor-delete-btn" 
            onClick={handleDelete}
            type="button"
          >
            <TrashIcon size={14} /> Delete
          </button>
        </div>
      </div>

      <div className="agent-editor-page-content">
        <AgentNodeEditor
          agent={agent}
          allAgents={journey.agents}
          journeyId={journeyId || undefined}
          onChange={handleAgentChange}
          onClose={handleBack}
          onSave={handleSave}
          disabled={false}
        />
      </div>
    </div>
  );
};
