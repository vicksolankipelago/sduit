import React, { useState, useEffect } from 'react';
import './VersionHistory.css';

interface VersionSummary {
  id: string;
  journeyId: string;
  versionNumber: number;
  name: string;
  changeNotes: string | null;
  createdAt: string;
}

interface VersionDetail {
  id: string;
  journeyId: string;
  versionNumber: number;
  name: string;
  description: string;
  systemPrompt: string;
  voice: string | null;
  agents: any[];
  startingAgentId: string;
  changeNotes: string | null;
  createdAt: string;
}

interface RestoredJourney {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  voice: string | null;
  agents: any[];
  startingAgentId: string;
  createdAt: string;
  updatedAt: string;
  version: string;
}

interface VersionHistoryProps {
  journeyId: string;
  onClose: () => void;
  onRestore: (journey: RestoredJourney) => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
  journeyId,
  onClose,
  onRestore,
}) => {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VersionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadVersions();
  }, [journeyId]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/journeys/${journeyId}/versions`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load version history');
      }
      const data = await response.json();
      setVersions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionDetails = async (versionId: string) => {
    try {
      setIsLoadingDetails(true);
      setError(null);
      const response = await fetch(`/api/journeys/${journeyId}/versions/${versionId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load version details');
      }
      const data = await response.json();
      setSelectedVersion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load version details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedVersion) return;
    
    if (!window.confirm(`Restore to version ${selectedVersion.versionNumber}? This will create a new version with the restored content.`)) {
      return;
    }

    try {
      setIsRestoring(true);
      setError(null);
      const response = await fetch(`/api/journeys/${journeyId}/versions/${selectedVersion.id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to restore version');
      }
      const restored = await response.json();
      onRestore(restored);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore version');
    } finally {
      setIsRestoring(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAgentPromptPreview = (agent: any) => {
    const prompt = agent.prompt || '';
    return prompt.length > 100 ? prompt.substring(0, 100) + '...' : prompt;
  };

  return (
    <div className="version-history-overlay" onClick={onClose}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="version-history-header">
          <h2>Version History</h2>
          <button className="version-history-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {error && (
          <div className="version-history-error">
            {error}
          </div>
        )}

        <div className="version-history-content">
          <div className="version-history-list">
            <h3>Versions</h3>
            {isLoading ? (
              <div className="version-history-loading">Loading versions...</div>
            ) : versions.length === 0 ? (
              <div className="version-history-empty">No versions found</div>
            ) : (
              <ul>
                {versions.map((version, index) => (
                  <li
                    key={version.id}
                    className={`version-history-item ${selectedVersion?.id === version.id ? 'selected' : ''} ${index === 0 ? 'current' : ''}`}
                    onClick={() => loadVersionDetails(version.id)}
                  >
                    <div className="version-history-item-header">
                      <span className="version-number">v{version.versionNumber}</span>
                      {index === 0 && <span className="version-current-badge">Current</span>}
                    </div>
                    <div className="version-history-item-notes">
                      {version.changeNotes || 'No notes'}
                    </div>
                    <div className="version-history-item-date">
                      {formatDate(version.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="version-history-details">
            <h3>Version Details</h3>
            {isLoadingDetails ? (
              <div className="version-history-loading">Loading details...</div>
            ) : !selectedVersion ? (
              <div className="version-history-empty">Select a version to view details</div>
            ) : (
              <div className="version-details-content">
                <div className="version-details-section">
                  <h4>System Prompt</h4>
                  <pre className="version-details-prompt">
                    {selectedVersion.systemPrompt || '(No system prompt)'}
                  </pre>
                </div>

                <div className="version-details-section">
                  <h4>Agents ({selectedVersion.agents.length})</h4>
                  {selectedVersion.agents.map((agent: any) => (
                    <div key={agent.id} className="version-agent-item">
                      <div className="version-agent-name">{agent.name}</div>
                      <div className="version-agent-prompt">
                        {getAgentPromptPreview(agent)}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="version-details-actions">
                  <button
                    className="version-restore-btn"
                    onClick={handleRestore}
                    disabled={isRestoring || versions[0]?.id === selectedVersion.id}
                  >
                    {isRestoring ? 'Restoring...' : 'Restore This Version'}
                  </button>
                  {versions[0]?.id === selectedVersion.id && (
                    <p className="version-current-note">This is the current version</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionHistory;
