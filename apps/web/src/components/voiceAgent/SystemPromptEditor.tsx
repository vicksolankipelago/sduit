import React, { useState, useRef } from 'react';
import { DEFAULT_SYSTEM_PROMPT, Journey } from '../../types/journey';
import { useVariables } from '../../hooks/useVariables';
import VariablePanel from './VariablePanel';
import './SystemPromptEditor.css';

interface SystemPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  journey?: Journey | null;
}

const SystemPromptEditor: React.FC<SystemPromptEditorProps> = ({
  value,
  onChange,
  disabled = false,
  journey = null,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [showVariables, setShowVariables] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { variables, variablesByCategory } = useVariables(journey);

  const handleInsertVariable = (variableName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = value || '';
    const variableText = `{{${variableName}}}`;

    const newValue =
      currentValue.substring(0, start) +
      variableText +
      currentValue.substring(end);

    onChange(newValue);

    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

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
            className={`system-prompt-action-btn ${showVariables ? 'active' : ''}`}
            onClick={() => setShowVariables(!showVariables)}
            type="button"
          >
            📋 Variables
          </button>
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
        <div className={`system-prompt-editor-area ${showVariables ? 'with-variables' : ''}`}>
          <div className="system-prompt-textarea-wrapper">
            <textarea
              ref={textareaRef}
              className="system-prompt-textarea"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Define global instructions for all agents...&#10;&#10;Use {{variableName}} to insert dynamic values like {{memberName}} or {{primaryGoal}}"
              disabled={disabled}
              rows={12}
            />
            <div className="system-prompt-stats">
              <span>{lineCount} lines</span>
              <span>•</span>
              <span>{characterCount} characters</span>
            </div>
          </div>
          {showVariables && (
            <VariablePanel
              variables={variables}
              variablesByCategory={variablesByCategory}
              onInsert={handleInsertVariable}
              mode="default"
              disabled={disabled}
            />
          )}
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

