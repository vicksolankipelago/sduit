import React, { useState, useRef } from 'react';
import { Screen, Journey } from '../../types/journey';
import { useVariables } from '../../hooks/useVariables';
import VariablePanel from './VariablePanel';
import './PromptEditor.css';

export interface PromptEditorProps {
  screens: Screen[];
  screenPrompts: Record<string, string>;
  onChange: (screenPrompts: Record<string, string>) => void;
  disabled?: boolean;
  journey?: Journey | null;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  screens,
  screenPrompts,
  onChange,
  disabled = false,
  journey = null,
}) => {
  const [selectedScreenId, setSelectedScreenId] = useState<string>(
    screens.length > 0 ? screens[0].id : ''
  );
  const [showVariables, setShowVariables] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { variables, variablesByCategory } = useVariables(journey);

  const handlePromptChange = (screenId: string, prompt: string) => {
    onChange({
      ...screenPrompts,
      [screenId]: prompt,
    });
  };

  const handleInsertVariable = (variableName: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentPrompt = screenPrompts[selectedScreenId] || '';
    const variableText = `{{${variableName}}}`;

    const newPrompt =
      currentPrompt.substring(0, start) +
      variableText +
      currentPrompt.substring(end);

    handlePromptChange(selectedScreenId, newPrompt);

    // Restore cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const selectedScreen = screens.find(s => s.id === selectedScreenId);
  const currentPrompt = screenPrompts[selectedScreenId] || '';

  // Get available events for the selected screen
  const availableEvents = selectedScreen?.events?.map(e => e.id) || [];
  const elementEvents = selectedScreen?.sections
    .flatMap(section => section.elements)
    .flatMap(element => element.events || [])
    .map(e => e.id) || [];
  const allEvents = [...new Set([...availableEvents, ...elementEvents])];

  if (screens.length === 0) {
    return (
      <div className="prompt-editor-empty">
        <p>No screens defined yet. Add screens to this agent first.</p>
      </div>
    );
  }

  return (
    <div className="prompt-editor">
      <div className="prompt-editor-header">
        <div className="prompt-editor-title-row">
          <div>
            <h3>Screen Prompts</h3>
            <p className="prompt-editor-description">
              Define voice agent behavior for each screen
            </p>
          </div>
          <button
            className={`prompt-editor-variables-btn ${showVariables ? 'active' : ''}`}
            onClick={() => setShowVariables(!showVariables)}
            type="button"
          >
            📋 Variables
          </button>
        </div>
      </div>

      {/* Screen Tabs */}
      <div className="prompt-editor-tabs">
        {screens.map(screen => (
          <button
            key={screen.id}
            className={`prompt-editor-tab ${selectedScreenId === screen.id ? 'active' : ''}`}
            onClick={() => setSelectedScreenId(screen.id)}
            disabled={disabled}
          >
            {screen.title || screen.id}
            {!screenPrompts[screen.id] && (
              <span className="prompt-editor-tab-warning" title="No prompt defined">⚠️</span>
            )}
          </button>
        ))}
      </div>

      {/* Prompt Editor */}
      <div className={`prompt-editor-content ${showVariables ? 'with-variables' : ''}`}>
        <div className="prompt-editor-main">
          <div className="prompt-editor-meta">
            <div className="prompt-editor-meta-item">
              <strong>Screen ID:</strong> <code>{selectedScreenId}</code>
            </div>
            {allEvents.length > 0 && (
              <div className="prompt-editor-meta-item">
                <strong>Available Events:</strong>
                <div className="prompt-editor-events">
                  {allEvents.map(eventId => (
                    <code key={eventId} className="prompt-editor-event-tag">
                      {eventId}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          <textarea
            ref={textareaRef}
            className="prompt-editor-textarea"
            value={currentPrompt}
            onChange={(e) => handlePromptChange(selectedScreenId, e.target.value)}
            disabled={disabled}
            placeholder={`Define voice agent behavior for "${selectedScreen?.title || selectedScreenId}" screen...

Use {{variableName}} to insert dynamic values like {{memberName}} or {{primaryGoal}}

Example:
**Purpose:** Welcome screen where voice agent starts

**Instructions:**
1. Greet {{memberName}} warmly
2. Ask if they're ready to start
3. Wait for confirmation
4. IMMEDIATELY emit function call: trigger_event with arguments {"eventId": "next_step_event"}`}
            rows={20}
          />

          <div className="prompt-editor-template-help">
            <h4>State Variables:</h4>
            <ul>
              <li><code>{'{$moduleData.key}'}</code> - Module state data</li>
              <li><code>{'{$screenData.key}'}</code> - Screen state data</li>
            </ul>
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
    </div>
  );
};

export default PromptEditor;

