import React, { useState } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../../types/journey';
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
  const [showPreview, setShowPreview] = useState(false);

  const handleReset = () => {
    if (window.confirm('Reset to default system prompt? This will replace your current prompt.')) {
      onChange(DEFAULT_SYSTEM_PROMPT);
    }
  };

  const characterCount = value?.length || 0;
  const lineCount = value?.split('\n').length || 0;

  return (
    <div className={`system-prompt-editor ${disabled ? 'disabled' : ''}`}>
      <div className="system-prompt-header">
        <div className="system-prompt-title">
          <h3>🌍 System Prompt</h3>
          <span className="system-prompt-subtitle">
            Global instructions shared by all agents in this journey
          </span>
        </div>
        <div className="system-prompt-actions">
          <button
            className="system-prompt-action-btn"
            onClick={() => setShowPreview(!showPreview)}
            type="button"
          >
            {showPreview ? '✏️ Edit' : '👁️ Preview'}
          </button>
          <button
            className="system-prompt-action-btn"
            onClick={handleReset}
            disabled={disabled}
            type="button"
          >
            🔄 Reset to Default
          </button>
        </div>
      </div>

      <div className="system-prompt-info">
        <p>
          The system prompt defines core behaviors, communication style, and principles
          that all agents in this journey will follow. Individual agents combine this
          with their own specific prompts.
        </p>
        <div className="prompt-formula">
          <span className="formula-part system">System Prompt</span>
          <span className="formula-plus">+</span>
          <span className="formula-part agent">Agent Prompt</span>
          <span className="formula-equals">=</span>
          <span className="formula-result">Final Instructions</span>
        </div>
      </div>

      {showPreview ? (
        <div className="system-prompt-preview">
          <div className="preview-content">
            {value || <span className="preview-empty">No system prompt defined</span>}
          </div>
        </div>
      ) : (
        <div className="system-prompt-editor-area">
          <textarea
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
      )}

      <div className="system-prompt-tips">
        <h4>💡 Tips for effective system prompts:</h4>
        <ul>
          <li>Define core personality traits and communication style</li>
          <li>Set boundaries (what agents should/shouldn't do)</li>
          <li>Establish tone and language guidelines</li>
          <li>Keep it concise - agents will add their own specific instructions</li>
        </ul>
      </div>
    </div>
  );
};

export default SystemPromptEditor;

