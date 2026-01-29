import React, { useState } from 'react';
import './MemberPersonaEditor.css';
import { PQData, DEFAULT_PQ_DATA } from '../../utils/promptTemplates';
import { VOICE_OPTIONS } from '../../types/journey';

interface MemberPersonaEditorProps {
  disabled?: boolean;
  onPersonaChange?: (enabled: boolean, description: string) => void;
  onPQDataChange?: (pqData: Partial<PQData>) => void;
  onVoiceChange?: (voice: string) => void;
  onSave?: () => void;
  initialEnabled?: boolean;
  initialDescription?: string;
  initialPQData?: Partial<PQData>;
  initialVoice?: string;
}

const EXAMPLE_PERSONAS = [
  {
    name: 'Motivated by Family',
    description: 'You are a 35-year-old parent struggling with alcohol use. You drink 3-4 beers daily and want to quit because you want to be more present for your children and partner. You feel guilty about how drinking affects your family time and relationships.'
  },
  {
    name: 'Health-Focused Professional',
    description: 'You are a 42-year-old professional who has been drinking wine nightly to unwind. You\'ve noticed health impacts and want to improve your fitness and energy levels. You\'re motivated by wanting to feel better physically and be more productive at work.'
  },
  {
    name: 'Social Drinker Seeking Control',
    description: 'You are a 28-year-old who drinks heavily in social situations. You struggle with saying no when friends are drinking. You want to cut back because you\'re tired of hangovers and want to pursue other hobbies like playing basketball.'
  },
  {
    name: 'Long-term Heavy User',
    description: 'You are a 50-year-old who has been drinking heavily for 20+ years. You experience withdrawal symptoms when trying to quit. You\'re motivated by wanting to improve your health before it\'s too late and regain relationships you\'ve damaged.'
  },
  {
    name: 'Custom',
    description: ''
  }
];

const MemberPersonaEditor: React.FC<MemberPersonaEditorProps> = ({
  disabled = false,
  onPersonaChange,
  onPQDataChange,
  onVoiceChange,
  onSave,
  initialEnabled = false,
  initialDescription = '',
  initialPQData = {},
  initialVoice = '',
}) => {
  const [personaEnabled, setPersonaEnabled] = useState(initialEnabled);
  const [selectedPreset, setSelectedPreset] = useState('Custom');
  const [personaDescription, setPersonaDescription] = useState(initialDescription);
  const [pqData] = useState<Partial<PQData>>({ ...DEFAULT_PQ_DATA, ...initialPQData });
  const [selectedVoice, setSelectedVoice] = useState(initialVoice);
  const [hasChanges, setHasChanges] = useState(false);

  const handleTogglePersona = (enabled: boolean) => {
    if (disabled) return;
    setPersonaEnabled(enabled);
    setHasChanges(true);
  };

  const handlePresetSelect = (presetName: string) => {
    if (disabled) return;
    setSelectedPreset(presetName);
    const preset = EXAMPLE_PERSONAS.find(p => p.name === presetName);
    if (preset) {
      setPersonaDescription(preset.description);
      setHasChanges(true);
    }
  };

  const handleDescriptionChange = (description: string) => {
    if (disabled) return;
    setPersonaDescription(description);
    setHasChanges(true);
  };

  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    setHasChanges(true);
  };

  const handleSave = () => {
    if (onPersonaChange) {
      onPersonaChange(personaEnabled, personaDescription);
    }
    if (onPQDataChange) {
      onPQDataChange(pqData);
    }
    if (onVoiceChange) {
      onVoiceChange(selectedVoice);
    }
    setHasChanges(false);
    if (onSave) {
      onSave();
    }
  };

  return (
    <div className={`member-persona-editor-clean ${disabled ? 'disabled' : ''}`}>
      {disabled && (
        <div className="persona-disabled-banner">
          <span className="persona-disabled-notice">Disconnect voice session to edit settings</span>
        </div>
      )}

      <div className="persona-editor-content-clean">
          {/* Member Profile (PQ Data) - Always visible at top */}
          <div className="pq-section">
            <h3 className="section-title">Member Profile</h3>

            <div className="pq-fields-grid">
              <div className="pq-field">
                <label className="pq-field-label">Voice</label>
                <select
                  className="pq-field-select"
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                >
                  <option value="">Use journey default</option>
                  {VOICE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pq-info-note">
              <p>Member context data (goals, motivation, learning topics, etc.) is automatically populated from the Personalization Quiz answers when voice mode is activated.</p>
            </div>
          </div>

          {/* Persona Testing - At bottom */}
          <div className="persona-section">
            <h3 className="section-title">Automated Testing</h3>

            <div className="persona-toggle-row">
              <label className="persona-switch">
                <input
                  type="checkbox"
                  checked={personaEnabled}
                  onChange={(e) => handleTogglePersona(e.target.checked)}
                  disabled={disabled}
                />
                <span className="persona-switch-slider"></span>
              </label>
              <span className="persona-toggle-label">
                {personaEnabled ? 'Persona Testing Enabled' : 'Persona Testing Disabled'}
              </span>
            </div>

            {personaEnabled && (
              <>
                <div className="persona-presets">
                  <label className="pq-field-label">Preset Personas</label>
                  <div className="persona-preset-buttons">
                    {EXAMPLE_PERSONAS.map((preset) => (
                      <button
                        key={preset.name}
                        className={`persona-preset-btn ${selectedPreset === preset.name ? 'active' : ''}`}
                        onClick={() => handlePresetSelect(preset.name)}
                        disabled={disabled}
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pq-field">
                  <label className="pq-field-label">Persona Description</label>
                  <textarea
                    className="pq-field-textarea"
                    value={personaDescription}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    placeholder="Describe the member persona in detail..."
                    rows={4}
                    disabled={disabled}
                  />
                </div>
              </>
            )}
          </div>

          {/* Save button */}
          <div className="persona-actions-clean">
            <button
              className="persona-save-btn"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Settings
            </button>
            {hasChanges && (
              <span className="persona-unsaved-indicator">Unsaved changes</span>
            )}
          </div>
        </div>
    </div>
  );
};

export default MemberPersonaEditor;
