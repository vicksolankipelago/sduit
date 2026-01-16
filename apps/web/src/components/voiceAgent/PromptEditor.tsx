import React, { useState } from 'react';
import { Screen } from '../../types/journey';
import './PromptEditor.css';

export interface PromptEditorProps {
  screens: Screen[];
  screenPrompts: Record<string, string>;
  onChange: (screenPrompts: Record<string, string>) => void;
  disabled?: boolean;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  screens,
  screenPrompts,
  onChange,
  disabled = false,
}) => {
  const [selectedScreenId, setSelectedScreenId] = useState<string>(
    screens.length > 0 ? screens[0].id : ''
  );

  const handlePromptChange = (screenId: string, prompt: string) => {
    onChange({
      ...screenPrompts,
      [screenId]: prompt,
    });
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
        <h3>Screen Prompts</h3>
        <p className="prompt-editor-description">
          Define voice agent behavior for each screen
        </p>
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
      <div className="prompt-editor-content">
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
          className="prompt-editor-textarea"
          value={currentPrompt}
          onChange={(e) => handlePromptChange(selectedScreenId, e.target.value)}
          disabled={disabled}
          placeholder={`Define voice agent behavior for "${selectedScreen?.title || selectedScreenId}" screen...

Example:
**Purpose:** Welcome screen where voice agent starts

**Instructions:**
1. Greet the user warmly
2. Ask if they're ready to start
3. Wait for confirmation
4. IMMEDIATELY emit function call: trigger_event with arguments {"eventId": "next_step_event"}

**Navigation:**
After user confirms, trigger:
- Event ID: next_step_event
- Tool call: trigger_event with arguments {"eventId": "next_step_event"}`}
          rows={20}
        />

        <div className="prompt-editor-template-help">
          <h4>Template Variables:</h4>
          <ul>
            <li><code>{'{{memberName}}'}</code> - User's name</li>
            <li><code>{'{{mainSubstance}}'}</code> - Primary substance</li>
            <li><code>{'{{primaryGoal}}'}</code> - User's goal</li>
            <li><code>{'{$moduleData.key}'}</code> - Module state data</li>
            <li><code>{'{$screenData.key}'}</code> - Screen state data</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PromptEditor;

