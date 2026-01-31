import React, { useState, useRef, useEffect } from 'react';
import { EditIcon } from '../Icons';
import './SystemPromptEditor.css';

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = value?.length || 0;
  const lineCount = value?.split('\n').length || 0;

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleEditClick = () => {
    setIsEditing(true);
    setIsExpanded(true);
  };

  const handleDone = () => {
    setIsEditing(false);
  };

  const COLLAPSED_LINES = 3;
  const MAX_COLLAPSED_CHARS = 300;
  const lines = value?.split('\n') || [];
  
  // Truncate by both lines and characters for a compact view
  let displayText = '';
  let isTruncated = false;
  
  if (isExpanded) {
    displayText = value || '';
  } else {
    const collapsedLines = lines.slice(0, COLLAPSED_LINES);
    let tempText = collapsedLines.join('\n');
    
    // Also limit by character count
    if (tempText.length > MAX_COLLAPSED_CHARS) {
      tempText = tempText.slice(0, MAX_COLLAPSED_CHARS).trim() + '...';
      isTruncated = true;
    } else if (lines.length > COLLAPSED_LINES) {
      isTruncated = true;
    }
    displayText = tempText;
  }
  
  const shouldShowExpand = isTruncated || lines.length > COLLAPSED_LINES;

  return (
    <div className={`system-prompt-editor ${disabled ? 'disabled' : ''}`}>
      <div className="system-prompt-header">
        <div className="system-prompt-title">
          <label className="section-label">System Prompt</label>
          <span className="system-prompt-subtitle">
            Global instructions shared by all agents in this journey
          </span>
        </div>
        {!isEditing && !disabled && (
          <button 
            className="system-prompt-edit-btn"
            onClick={handleEditClick}
            title="Edit prompt"
          >
            <EditIcon size={14} />
            Edit
          </button>
        )}
        {isEditing && (
          <button 
            className="system-prompt-done-btn"
            onClick={handleDone}
          >
            Done
          </button>
        )}
      </div>

      <div className="system-prompt-editor-area">
        {isEditing ? (
          <div className="system-prompt-textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="system-prompt-textarea"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Define global instructions for all agents..."
              disabled={disabled}
              rows={16}
            />
          </div>
        ) : (
          <div className="system-prompt-text-view">
            <pre className="system-prompt-text">
              {displayText || <span className="system-prompt-placeholder">No system prompt defined</span>}
            </pre>
            {shouldShowExpand && !isExpanded && (
              <button 
                className="system-prompt-expand-btn"
                onClick={() => setIsExpanded(true)}
              >
                Show full prompt ({lineCount} lines, {characterCount} chars)
              </button>
            )}
            {isExpanded && shouldShowExpand && (
              <button 
                className="system-prompt-expand-btn"
                onClick={() => setIsExpanded(false)}
              >
                Show less
              </button>
            )}
          </div>
        )}
        <div className="system-prompt-stats">
          <span>{lineCount} lines</span>
          <span>•</span>
          <span>{characterCount} characters</span>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptEditor;
