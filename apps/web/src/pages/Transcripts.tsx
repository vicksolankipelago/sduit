import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  listUserSessions,
  loadSessionById,
  deleteSessionById,
  getSessionCount,
  SessionListItem,
} from '../services/api/sessionService';
import { SessionExport, downloadSessionExport, downloadFormattedTranscript } from '../utils/transcriptExport';
import { TranscriptNotes } from '../components/voiceAgent/TranscriptNotes';
import { listNotes, getNoteCounts, TranscriptNote } from '../services/api/notesService';
import './Transcripts.css';

type ViewMode = 'list' | 'detail';
type DetailTab = 'transcript' | 'events' | 'info';

const PAGE_SIZE = 10;

export const TranscriptsPage: React.FC = () => {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [currentSession, setCurrentSession] = useState<SessionExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('transcript');
  const [error, setError] = useState<string | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<Record<string, { messageCount: number }>>({});
  const [noteCounts, setNoteCounts] = useState<Record<string, number>>({});

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Notes state
  const [notesMessageIndex, setNotesMessageIndex] = useState<number | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const [sessionNotes, setSessionNotes] = useState<TranscriptNote[]>([]);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getNotesForMessage = (messageIndex: number) => {
    return sessionNotes.filter(n => n.messageIndex === messageIndex && !n.parentId);
  };

  // Load sessions on mount and when page changes
  useEffect(() => {
    if (user) {
      loadSessions(currentPage);
    } else {
      setLoading(false);
    }
  }, [user, currentPage]);

  const loadSessions = async (page: number) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const [data, count] = await Promise.all([
        listUserSessions(PAGE_SIZE, offset),
        getSessionCount(),
      ]);
      setSessions(data);
      setTotalCount(count);
      
      // Fetch note counts for all sessions
      if (data.length > 0) {
        const sessionIds = data.map(s => s.sessionId);
        try {
          const counts = await getNoteCounts(sessionIds);
          setNoteCounts(counts);
        } catch (noteErr) {
          console.error('Failed to load note counts:', noteErr);
        }
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleSessionClick = async (session: SessionListItem) => {
    setDetailLoading(true);
    setError(null);
    try {
      const fullSession = await loadSessionById(session.id);
      if (fullSession) {
        setCurrentSession(fullSession);
        setViewMode('detail');
        setDetailTab('transcript');
        // Load notes for this session
        try {
          const notes = await listNotes(fullSession.sessionId);
          setSessionNotes(notes);
        } catch (noteErr) {
          console.error('Failed to load notes:', noteErr);
          setSessionNotes([]);
        }
      } else {
        setError('Session not found');
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError('Failed to load session details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleNotesClose = async () => {
    setShowNotes(false);
    setNotesMessageIndex(null);
    // Reload notes to show updated count
    if (currentSession) {
      try {
        const notes = await listNotes(currentSession.sessionId);
        setSessionNotes(notes);
      } catch (err) {
        console.error('Failed to reload notes:', err);
      }
    }
  };

  const handleDelete = async (e: React.MouseEvent, session: SessionListItem) => {
    e.stopPropagation();
    if (!confirm('Delete this transcript? This cannot be undone.')) return;

    try {
      await deleteSessionById(session.id);
      setTotalCount((prev) => prev - 1);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      // If we deleted the last item on this page and there are more pages, go back
      if (sessions.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
      setError('Failed to delete session');
    }
  };

  const handleBack = () => {
    setViewMode('list');
    setCurrentSession(null);
  };

  const handleDownloadJSON = () => {
    if (currentSession) {
      downloadSessionExport(currentSession);
    }
  };

  const handleDownloadText = () => {
    if (currentSession) {
      downloadFormattedTranscript(currentSession);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const mergeTranscriptMessages = (items: SessionExport['transcript']) => {
    const merged: SessionExport['transcript'] = [];
    const appendText = (base: string, next: string) => {
      const trimmedNext = next.trim();
      if (!trimmedNext) return base;
      if (!base) return trimmedNext;
      if (/^[,.:;!?)]/.test(trimmedNext)) {
        return `${base}${trimmedNext}`;
      }
      return `${base} ${trimmedNext}`;
    };

    for (const item of items) {
      if (item.type !== 'MESSAGE' || !item.title) {
        merged.push(item);
        continue;
      }

      const last = merged[merged.length - 1];
      if (last && last.type === 'MESSAGE' && last.role === item.role) {
        const mergedTitle = appendText(last.title || '', item.title || '');
        merged[merged.length - 1] = {
          ...last,
          title: mergedTitle,
          timestamp: item.timestamp,
          createdAtMs: item.createdAtMs,
          status: item.status,
        };
        continue;
      }

      merged.push(item);
    }

    return merged;
  };

  const filterEvents = (events: SessionExport['events']) => {
    return events.filter((event) => {
      const name = event.eventName || '';
      const hasDelta = typeof (event.eventData as any)?.delta === 'string';
      return !name.includes('delta') && !hasDelta;
    });
  };

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      const updates: Record<string, { messageCount: number }> = {};
      await Promise.all(
        sessions.map(async (session) => {
          try {
            const fullSession = await loadSessionById(session.id);
            if (!fullSession) return;
            const mergedMessages = mergeTranscriptMessages(fullSession.transcript)
              .filter((item) => item.type === 'MESSAGE' && item.title);
            updates[session.id] = { messageCount: mergedMessages.length };
          } catch (err) {
            console.warn('Failed to load session metrics:', err);
          }
        })
      );

      if (!cancelled && Object.keys(updates).length > 0) {
        setSessionMetrics((prev) => ({ ...prev, ...updates }));
      }
    };

    if (sessions.length > 0) {
      loadMetrics();
    }

    return () => {
      cancelled = true;
    };
  }, [sessions]);

  // Not logged in state
  if (!user) {
    return (
      <div className="transcripts-page">
        <div className="transcripts-empty">
          <div className="transcripts-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2>Sign in to view transcripts</h2>
          <p>Session transcripts are saved to the cloud when you're signed in.</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="transcripts-page">
        <div className="transcripts-loading">
          <div className="transcripts-spinner" />
          <p>Loading transcripts...</p>
        </div>
      </div>
    );
  }

  // Detail view
  if (viewMode === 'detail' && currentSession) {
    const mergedTranscript = mergeTranscriptMessages(currentSession.transcript);
    const transcriptMessages = mergedTranscript.filter((item) => item.type === 'MESSAGE' && item.title);
    const filteredEvents = filterEvents(currentSession.events);
    const userMessages = transcriptMessages.filter((item) => item.role === 'user');
    const assistantMessages = transcriptMessages.filter((item) => item.role === 'assistant');

    return (
      <div className="transcripts-page">
        <div className="transcripts-detail">
          {/* Header */}
          <div className="transcripts-detail-header">
            <button className="transcripts-back-btn" onClick={handleBack}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Back
            </button>
            <div className="transcripts-detail-title">
              <h1>{currentSession.journey?.name || 'Untitled Session'}</h1>
              <span className="transcripts-detail-date">
                {new Date(currentSession.exportedAt).toLocaleString()}
              </span>
            </div>
            <div className="transcripts-detail-actions">
              <button className="transcripts-action-btn" onClick={handleDownloadText} title="Download as text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Text
              </button>
              <button className="transcripts-action-btn" onClick={handleDownloadJSON} title="Download as JSON">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                JSON
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="transcripts-tabs">
            <button
              className={`transcripts-tab ${detailTab === 'transcript' ? 'active' : ''}`}
              onClick={() => setDetailTab('transcript')}
            >
              Transcript
            </button>
            <button
              className={`transcripts-tab ${detailTab === 'events' ? 'active' : ''}`}
              onClick={() => setDetailTab('events')}
            >
              Events ({filteredEvents.length})
            </button>
            <button
              className={`transcripts-tab ${detailTab === 'info' ? 'active' : ''}`}
              onClick={() => setDetailTab('info')}
            >
              Info
            </button>
          </div>

          {/* Tab Content */}
          <div className="transcripts-tab-content">
            {detailTab === 'transcript' && (
              <div className="transcripts-conversation-wrapper">
                <div className={`transcripts-conversation ${showNotes ? 'with-notes' : ''}`}>
                  {transcriptMessages
                    .map((item, index) => (
                      <div
                        key={item.itemId || index}
                        className={`transcripts-message ${item.role === 'user' ? 'user' : 'assistant'} ${notesMessageIndex === index ? 'selected' : ''}`}
                      >
                        <div className="transcripts-message-role">
                          {item.role === 'user' ? (user?.firstName || 'User') : 'Agent'}
                        </div>
                        <div className="transcripts-message-content">{item.title}</div>
                        <div className="transcripts-message-footer">
                          <div className="transcripts-message-time">{item.timestamp}</div>
                          <button
                            className={`transcripts-add-note-btn ${getNotesForMessage(index).length > 0 ? 'has-notes' : ''}`}
                            onClick={() => {
                              setNotesMessageIndex(index);
                              setShowNotes(true);
                            }}
                            title={getNotesForMessage(index).length > 0 ? `${getNotesForMessage(index).length} note(s)` : 'Add note'}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                            </svg>
                            {getNotesForMessage(index).length > 0 ? `${getNotesForMessage(index).length}` : 'Note'}
                          </button>
                        </div>
                      </div>
                    ))}
                  {transcriptMessages.length === 0 && (
                    <div className="transcripts-empty-tab">No messages in this session</div>
                  )}
                </div>
                {showNotes && currentSession && (
                  <TranscriptNotes
                    sessionId={currentSession.sessionId}
                    messageIndex={notesMessageIndex}
                    onClose={handleNotesClose}
                  />
                )}
              </div>
            )}

            {detailTab === 'events' && (
              <div className="transcripts-events">
                {filteredEvents.map((event, index) => (
                  <div key={index} className="transcripts-event">
                    <div className="transcripts-event-name">{event.eventName}</div>
                    <div className="transcripts-event-time">{event.timestamp}</div>
                    {event.eventData && (
                      <pre className="transcripts-event-data">
                        {JSON.stringify(event.eventData, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {filteredEvents.length === 0 && (
                  <div className="transcripts-empty-tab">No events recorded</div>
                )}
              </div>
            )}

            {detailTab === 'info' && (
              <div className="transcripts-info">
                <div className="transcripts-info-section">
                  <h3>Session</h3>
                  <div className="transcripts-info-grid">
                    <div className="transcripts-info-item">
                      <span className="label">Session ID</span>
                      <span className="value">{currentSession.sessionId}</span>
                    </div>
                    <div className="transcripts-info-item">
                      <span className="label">Duration</span>
                      <span className="value">{formatDuration(currentSession.duration.totalSeconds)}</span>
                    </div>
                    <div className="transcripts-info-item">
                      <span className="label">Exported</span>
                      <span className="value">{new Date(currentSession.exportedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {currentSession.journey && (
                  <div className="transcripts-info-section">
                    <h3>Journey</h3>
                    <div className="transcripts-info-grid">
                      <div className="transcripts-info-item">
                        <span className="label">Name</span>
                        <span className="value">{currentSession.journey.name}</span>
                      </div>
                      <div className="transcripts-info-item">
                        <span className="label">Voice</span>
                        <span className="value">{currentSession.journey.voice}</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentSession.agent && (
                  <div className="transcripts-info-section">
                    <h3>Agent</h3>
                    <div className="transcripts-info-grid">
                      <div className="transcripts-info-item">
                        <span className="label">Name</span>
                        <span className="value">{currentSession.agent.name}</span>
                      </div>
                      <div className="transcripts-info-item">
                        <span className="label">Tools</span>
                        <span className="value">{currentSession.agent.tools.length} tools</span>
                      </div>
                    </div>
                    {currentSession.agent.prompt && (
                      <div className="transcripts-info-prompt">
                        <span className="label">Prompt</span>
                        <pre className="transcripts-info-prompt-text">{currentSession.agent.prompt}</pre>
                      </div>
                    )}
                  </div>
                )}

                <div className="transcripts-info-section">
                  <h3>Stats</h3>
                  <div className="transcripts-info-grid">
                    <div className="transcripts-info-item">
                      <span className="label">Total Messages</span>
                      <span className="value">{transcriptMessages.length}</span>
                    </div>
                    <div className="transcripts-info-item">
                      <span className="label">User Messages</span>
                      <span className="value">{userMessages.length}</span>
                    </div>
                    <div className="transcripts-info-item">
                      <span className="label">Assistant Messages</span>
                      <span className="value">{assistantMessages.length}</span>
                    </div>
                    <div className="transcripts-info-item">
                      <span className="label">Tool Calls</span>
                      <span className="value">{currentSession.stats.toolCalls}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="transcripts-page">
      <div className="transcripts-header">
        <h1>Transcripts</h1>
        <p>Review your saved voice session transcripts {totalCount > 0 && `(${totalCount} total)`}</p>
      </div>

      {error && <div className="transcripts-error">{error}</div>}

      {detailLoading && (
        <div className="transcripts-loading-overlay">
          <div className="transcripts-spinner" />
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="transcripts-empty">
          <div className="transcripts-empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <h2>No transcripts yet</h2>
          <p>Complete a voice session to see your transcript here.</p>
        </div>
      ) : (
        <>
          <div className="transcripts-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="transcripts-list-item"
                onClick={() => handleSessionClick(session)}
              >
                <div className="transcripts-list-item-main">
                  <span className="transcripts-list-item-title">
                    {session.userName || 'Unknown User'}
                  </span>
                  {session.journeyName && (
                    <span className="transcripts-list-item-journey">
                      {session.journeyName}
                    </span>
                  )}
                </div>
                <div className="transcripts-list-item-meta">
                  <span className="transcripts-list-item-stats">
                    {(sessionMetrics[session.id]?.messageCount ?? session.messageCount)} messages • {formatDuration(session.durationSeconds)}
                    {(noteCounts[session.sessionId] ?? 0) > 0 && (
                      <> • {noteCounts[session.sessionId]} comment{noteCounts[session.sessionId] !== 1 ? 's' : ''}</>
                    )}
                  </span>
                  <span className="transcripts-list-item-time">{formatRelativeTime(session.createdAt)}</span>
                </div>
                <button
                  className="transcripts-list-item-delete"
                  onClick={(e) => handleDelete(e, session)}
                  title="Delete transcript"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="transcripts-pagination">
              <button
                className="transcripts-pagination-btn"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Previous
              </button>
              <span className="transcripts-pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="transcripts-pagination-btn"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TranscriptsPage;
