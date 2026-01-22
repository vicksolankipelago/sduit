import React, { useRef } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const characterCount = value?.length || 0;
  const lineCount = value?.split('\n').length || 0;

  return (
    <div className={`system-prompt-editor ${disabled ? 'disabled' : ''}`}>
      <div className="system-prompt-header">
        <div className="system-prompt-title">
          <label className="section-label">System Prompt</label>
          <span className="system-prompt-subtitle">
            Global instructions shared by all agents in this journey
          </span>
        </div>
      </div>

      <div className="system-prompt-editor-area">
        <div className="system-prompt-textarea-wrapper">
          <textarea
            ref={textareaRef}
            className="system-prompt-textarea"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Define global instructions for all agents..."
            disabled={disabled}
            rows={12}
          />
          <div className="system-prompt-stats">
            <span>{lineCount} lines</span>
            <span>•</span>
            <span>{characterCount} characters</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPromptEditor;
