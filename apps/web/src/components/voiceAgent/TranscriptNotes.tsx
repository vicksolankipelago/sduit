import React, { useState, useEffect } from 'react';
import { TranscriptNote, listNotes, createNote, updateNote, deleteNote } from '../../services/api/notesService';
import './TranscriptNotes.css';

interface TranscriptNotesProps {
  sessionId: string;
  messageIndex: number | null;
  onClose: () => void;
}

export const TranscriptNotes: React.FC<TranscriptNotesProps> = ({
  sessionId,
  messageIndex,
  onClose,
}) => {
  const [notes, setNotes] = useState<TranscriptNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [sessionId]);

  const loadNotes = async () => {
    try {
      const allNotes = await listNotes(sessionId);
      setNotes(allNotes);
    } catch (error) {
      console.error('Failed to load notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteContent.trim() || messageIndex === null) return;
    
    setSubmitting(true);
    try {
      const note = await createNote(sessionId, {
        messageIndex,
        content: newNoteContent.trim(),
      });
      setNotes([...notes, note]);
      setNewNoteContent('');
    } catch (error) {
      console.error('Failed to create note:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    
    const parentNote = notes.find(n => n.id === parentId);
    if (!parentNote) return;
    
    setSubmitting(true);
    try {
      const note = await createNote(sessionId, {
        messageIndex: parentNote.messageIndex,
        content: replyContent.trim(),
        parentId,
      });
      setNotes([...notes, note]);
      setReplyContent('');
      setReplyingTo(null);
    } catch (error) {
      console.error('Failed to create reply:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (note: TranscriptNote) => {
    const newStatus = note.status === 'todo' ? 'done' : 'todo';
    try {
      const updated = await updateNote(sessionId, note.id, { status: newStatus });
      setNotes(notes.map(n => n.id === note.id ? updated : n));
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Delete this note?')) return;
    
    try {
      await deleteNote(sessionId, noteId);
      setNotes(notes.filter(n => n.id !== noteId && n.parentId !== noteId));
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const filteredNotes = messageIndex !== null 
    ? notes.filter(n => n.messageIndex === messageIndex)
    : notes;

  const topLevelNotes = filteredNotes.filter(n => !n.parentId);
  const getReplies = (noteId: string) => filteredNotes.filter(n => n.parentId === noteId);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="transcript-notes-panel">
      <div className="transcript-notes-header">
        <h3>
          {messageIndex !== null ? `Notes for Message #${messageIndex + 1}` : 'All Notes'}
        </h3>
        <button className="transcript-notes-close" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="transcript-notes-loading">Loading notes...</div>
      ) : (
        <>
          <div className="transcript-notes-list">
            {topLevelNotes.length === 0 ? (
              <div className="transcript-notes-empty">No notes yet</div>
            ) : (
              topLevelNotes.map(note => (
                <div key={note.id} className={`transcript-note ${note.status}`}>
                  <div className="transcript-note-header">
                    <div className="transcript-note-user">
                      <span className={`transcript-note-role ${note.userRole}`}>
                        {note.userRole}
                      </span>
                      <span className="transcript-note-name">{note.userName}</span>
                    </div>
                    <span className="transcript-note-time">{formatTime(note.createdAt)}</span>
                  </div>
                  <div className="transcript-note-content">{note.content}</div>
                  <div className="transcript-note-actions">
                    <button
                      className={`transcript-note-status-btn ${note.status}`}
                      onClick={() => handleToggleStatus(note)}
                    >
                      {note.status === 'todo' ? (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                          Todo
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                          Done
                        </>
                      )}
                    </button>
                    <button
                      className="transcript-note-reply-btn"
                      onClick={() => setReplyingTo(replyingTo === note.id ? null : note.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                      </svg>
                      Reply
                    </button>
                    <button
                      className="transcript-note-delete-btn"
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>

                  {replyingTo === note.id && (
                    <div className="transcript-note-reply-form">
                      <textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        rows={2}
                      />
                      <div className="transcript-note-reply-actions">
                        <button onClick={() => setReplyingTo(null)}>Cancel</button>
                        <button 
                          className="primary"
                          onClick={() => handleReply(note.id)}
                          disabled={!replyContent.trim() || submitting}
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  )}

                  {getReplies(note.id).map(reply => (
                    <div key={reply.id} className={`transcript-note-reply ${reply.status}`}>
                      <div className="transcript-note-header">
                        <div className="transcript-note-user">
                          <span className={`transcript-note-role ${reply.userRole}`}>
                            {reply.userRole}
                          </span>
                          <span className="transcript-note-name">{reply.userName}</span>
                        </div>
                        <span className="transcript-note-time">{formatTime(reply.createdAt)}</span>
                      </div>
                      <div className="transcript-note-content">{reply.content}</div>
                      <div className="transcript-note-actions">
                        <button
                          className={`transcript-note-status-btn ${reply.status}`}
                          onClick={() => handleToggleStatus(reply)}
                        >
                          {reply.status === 'todo' ? 'Todo' : 'Done'}
                        </button>
                        <button
                          className="transcript-note-delete-btn"
                          onClick={() => handleDeleteNote(reply.id)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {messageIndex !== null && (
            <div className="transcript-notes-add">
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="Add a note..."
                rows={3}
              />
              <button
                className="transcript-notes-add-btn"
                onClick={handleAddNote}
                disabled={!newNoteContent.trim() || submitting}
              >
                {submitting ? 'Adding...' : 'Add Note'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TranscriptNotes;
