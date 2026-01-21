import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
  Screen, 
  Section, 
  ElementConfig, 
  ScreenEvent, 
  SectionPosition,
  ElementType,
  EventType,
} from '../../types/journey';
import { getElementMetadata, getElementsByCategory, ElementMetadataRegistry } from '../../lib/voiceAgent/elementRegistry';
import ElementPropertyEditor from './ElementPropertyEditor';
import { SettingsIcon, LayersIcon, ZapIcon, TrashIcon } from '../Icons';
import './ScreenEditor.css';

export interface ScreenEditorProps {
  screen: Screen;
  onChange: (screen: Screen) => void;
  onClose: () => void;
  disabled?: boolean;
}

export const ScreenEditor: React.FC<ScreenEditorProps> = ({
  screen,
  onChange,
  onClose,
  disabled = false,
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'sections' | 'events'>('config');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);

  const handleScreenUpdate = (updates: Partial<Screen>) => {
    onChange({ ...screen, ...updates });
  };

  const handleAddSection = (position: SectionPosition) => {
    const newSection: Section = {
      id: uuidv4(),
      position,
      layout: 'stack',
      direction: 'vertical',
      scrollable: position === 'body',
      elements: [],
    };

    handleScreenUpdate({
      sections: [...screen.sections, newSection],
    });
    setSelectedSectionId(newSection.id);
  };

  const handleRemoveSection = (sectionId: string) => {
    handleScreenUpdate({
      sections: screen.sections.filter(s => s.id !== sectionId),
    });
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<Section>) => {
    handleScreenUpdate({
      sections: screen.sections.map(s => 
        s.id === sectionId ? { ...s, ...updates } : s
      ),
    });
  };

  const handleAddElement = (sectionId: string, elementType: ElementType) => {
    const metadata = getElementMetadata(elementType);
    if (!metadata) return;

    const newElement: ElementConfig = {
      type: elementType,
      state: {
        ...metadata.defaultData,
        id: uuidv4(),
      },
      style: metadata.defaultStyle,
      events: [],
    };

    const updatedSections = screen.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          elements: [...section.elements, newElement],
        };
      }
      return section;
    });

    handleScreenUpdate({ sections: updatedSections });
  };

  const handleRemoveElement = (sectionId: string, elementIndex: number) => {
    const updatedSections = screen.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          elements: section.elements.filter((_, i) => i !== elementIndex),
        };
      }
      return section;
    });

    handleScreenUpdate({ sections: updatedSections });
    setSelectedElementIndex(null);
  };

  const handleUpdateElement = (sectionId: string, elementIndex: number, updates: Partial<ElementConfig>) => {
    const updatedSections = screen.sections.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          elements: section.elements.map((el, i) => 
            i === elementIndex ? { ...el, ...updates } : el
          ),
        };
      }
      return section;
    });

    handleScreenUpdate({ sections: updatedSections });
  };

  const handleMoveElementUp = (sectionId: string, elementIndex: number) => {
    if (elementIndex === 0) return;

    const updatedSections = screen.sections.map(section => {
      if (section.id === sectionId) {
        const elements = [...section.elements];
        [elements[elementIndex - 1], elements[elementIndex]] = [elements[elementIndex], elements[elementIndex - 1]];
        return { ...section, elements };
      }
      return section;
    });

    handleScreenUpdate({ sections: updatedSections });
    setSelectedElementIndex(elementIndex - 1);
  };

  const handleMoveElementDown = (sectionId: string, elementIndex: number) => {
    const section = screen.sections.find(s => s.id === sectionId);
    if (!section || elementIndex === section.elements.length - 1) return;

    const updatedSections = screen.sections.map(sec => {
      if (sec.id === sectionId) {
        const elements = [...sec.elements];
        [elements[elementIndex], elements[elementIndex + 1]] = [elements[elementIndex + 1], elements[elementIndex]];
        return { ...sec, elements };
      }
      return sec;
    });

    handleScreenUpdate({ sections: updatedSections });
    setSelectedElementIndex(elementIndex + 1);
  };

  const handleAddEvent = () => {
    const newEvent: ScreenEvent = {
      id: `event_${uuidv4()}`,
      type: 'onStart',
      action: [],
    };

    handleScreenUpdate({
      events: [...(screen.events || []), newEvent],
    });
  };

  const handleRemoveEvent = (eventIndex: number) => {
    handleScreenUpdate({
      events: (screen.events || []).filter((_, i) => i !== eventIndex),
    });
  };

  const selectedSection = screen.sections.find(s => s.id === selectedSectionId);

  return (
    <div className="screen-editor">
      <div className="screen-editor-header">
        <h2>Edit Screen</h2>
        <button onClick={onClose} className="screen-editor-close" disabled={disabled}>
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="screen-editor-tabs">
        <button
          className={`screen-editor-tab ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <SettingsIcon size={14} /> Configuration
        </button>
        <button
          className={`screen-editor-tab ${activeTab === 'sections' ? 'active' : ''}`}
          onClick={() => setActiveTab('sections')}
        >
          <LayersIcon size={14} /> Sections & Elements
        </button>
        <button
          className={`screen-editor-tab ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <ZapIcon size={14} /> Events
        </button>
      </div>

      <div className="screen-editor-content">
        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="screen-editor-config">
            <div className="screen-editor-field">
              <label>Screen ID</label>
              <input
                type="text"
                value={screen.id}
                onChange={(e) => handleScreenUpdate({ id: e.target.value })}
                disabled={disabled}
                placeholder="screen-id"
              />
            </div>

            <div className="screen-editor-field">
              <label>Title</label>
              <input
                type="text"
                value={screen.title}
                onChange={(e) => handleScreenUpdate({ title: e.target.value })}
                disabled={disabled}
                placeholder="Screen Title"
              />
            </div>

            <div className="screen-editor-field">
              <label>
                <input
                  type="checkbox"
                  checked={screen.hidesBackButton || false}
                  onChange={(e) => handleScreenUpdate({ hidesBackButton: e.target.checked })}
                  disabled={disabled}
                />
                Hide Back Button
              </label>
            </div>

            <div className="screen-editor-field">
              <label>Initial State (JSON)</label>
              <textarea
                value={JSON.stringify(screen.state || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const state = JSON.parse(e.target.value);
                    handleScreenUpdate({ state });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                disabled={disabled}
                rows={6}
                placeholder='{}'
              />
            </div>
          </div>
        )}

        {/* Sections Tab */}
        {activeTab === 'sections' && (
          <div className="screen-editor-sections">
            <div className="screen-editor-section-list">
              <div className="screen-editor-section-list-header">
                <h3>Sections</h3>
                <div className="screen-editor-section-add-buttons">
                  <button onClick={() => handleAddSection('fixed-top')} disabled={disabled} title="Add Fixed Top Section">
                    + Top
                  </button>
                  <button onClick={() => handleAddSection('body')} disabled={disabled} title="Add Body Section">
                    + Body
                  </button>
                  <button onClick={() => handleAddSection('fixed-bottom')} disabled={disabled} title="Add Bottom Section">
                    + Bottom
                  </button>
                </div>
              </div>

              {screen.sections.length === 0 ? (
                <div className="screen-editor-empty-state">
                  No sections yet. Add a section to start building.
                </div>
              ) : (
                <div className="screen-editor-section-items">
                  {screen.sections.map((section) => (
                    <div
                      key={section.id}
                      className={`screen-editor-section-item ${selectedSectionId === section.id ? 'selected' : ''}`}
                      onClick={() => setSelectedSectionId(section.id)}
                    >
                      <div className="screen-editor-section-item-header">
                        <strong>{section.position}</strong>
                        <span className="screen-editor-section-item-count">
                          {section.elements.length} element(s)
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveSection(section.id);
                          }}
                          disabled={disabled}
                          className="screen-editor-section-item-remove"
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Section Editor */}
            {selectedSection && (
              <div className="screen-editor-section-editor">
                <h3>Edit Section: {selectedSection.position}</h3>

                <div className="screen-editor-field">
                  <label>Section Title (optional)</label>
                  <input
                    type="text"
                    value={selectedSection.title || ''}
                    onChange={(e) => handleUpdateSection(selectedSection.id, { title: e.target.value })}
                    disabled={disabled}
                    placeholder="Section Title"
                  />
                </div>

                <div className="screen-editor-field">
                  <label>Layout</label>
                  <select
                    value={selectedSection.layout || 'stack'}
                    onChange={(e) => handleUpdateSection(selectedSection.id, { layout: e.target.value as any })}
                    disabled={disabled}
                  >
                    <option value="stack">Stack</option>
                    <option value="grid">Grid</option>
                  </select>
                </div>

                <div className="screen-editor-field">
                  <label>Direction</label>
                  <select
                    value={selectedSection.direction || 'vertical'}
                    onChange={(e) => handleUpdateSection(selectedSection.id, { direction: e.target.value as any })}
                    disabled={disabled}
                  >
                    <option value="vertical">Vertical</option>
                    <option value="horizontal">Horizontal</option>
                  </select>
                </div>

                {/* Elements List */}
                <div className="screen-editor-elements">
                  <div className="screen-editor-elements-header">
                    <h4>Elements</h4>
                    <button onClick={() => {
                      // Show element palette
                      setSelectedElementIndex(null);
                    }} disabled={disabled} className="screen-editor-add-element-btn">
                      + Add Element
                    </button>
                  </div>

                  {/* Element Palette (Simple version) */}
                  {selectedElementIndex === null && (
                    <div className="screen-editor-element-palette">
                      {(['core', 'card', 'interactive', 'advanced'] as const).map(category => (
                        <div key={category} className="screen-editor-element-category">
                          <h5>{category.charAt(0).toUpperCase() + category.slice(1)} Elements</h5>
                          <div className="screen-editor-element-palette-items">
                            {getElementsByCategory(category).map(metadata => (
                              <button
                                key={metadata.type}
                                className="screen-editor-element-palette-item"
                                onClick={() => handleAddElement(selectedSection.id, metadata.type)}
                                disabled={disabled}
                                title={metadata.description}
                              >
                                <span className="screen-editor-element-palette-icon">{metadata.icon}</span>
                                <span className="screen-editor-element-palette-name">{metadata.displayName}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Elements List */}
                  <div className="screen-editor-elements-list">
                    {selectedSection.elements.map((element, index) => (
                      <div
                        key={index}
                        className={`screen-editor-element-item ${selectedElementIndex === index ? 'selected' : ''}`}
                        onClick={() => setSelectedElementIndex(index)}
                      >
                        <div className="screen-editor-element-item-header">
                          <strong>{element.type}</strong>
                          <span className="screen-editor-element-item-id">
                            {(element.state.id as string) || '(no id)'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveElement(selectedSection.id, index);
                            }}
                            disabled={disabled}
                            className="screen-editor-element-item-remove"
                          >
                            <TrashIcon size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Element Editor */}
                  {selectedElementIndex !== null && selectedSection.elements[selectedElementIndex] && (
                    <div className="screen-editor-element-editor">
                      <h4>
                        {ElementMetadataRegistry[selectedSection.elements[selectedElementIndex].type]?.icon} Edit Element
                      </h4>
                      <div className="screen-editor-element-type-badge">
                        {ElementMetadataRegistry[selectedSection.elements[selectedElementIndex].type]?.displayName}
                      </div>
                      
                      <ElementPropertyEditor
                        element={selectedSection.elements[selectedElementIndex]}
                        onChange={(updates) => handleUpdateElement(selectedSection.id, selectedElementIndex, updates)}
                        onRemove={() => handleRemoveElement(selectedSection.id, selectedElementIndex)}
                        onMoveUp={() => handleMoveElementUp(selectedSection.id, selectedElementIndex)}
                        onMoveDown={() => handleMoveElementDown(selectedSection.id, selectedElementIndex)}
                        canMoveUp={selectedElementIndex !== 0}
                        canMoveDown={selectedElementIndex !== selectedSection.elements.length - 1}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="screen-editor-events">
            <div className="screen-editor-events-header">
              <h3>Screen Events</h3>
              <button onClick={handleAddEvent} disabled={disabled}>
                + Add Event
              </button>
            </div>

            {(screen.events || []).length === 0 ? (
              <div className="screen-editor-empty-state">
                No events defined. Events allow navigation and state updates.
              </div>
            ) : (
              <div className="screen-editor-events-list">
                {(screen.events || []).map((event, index) => (
                  <div key={index} className="screen-editor-event-item">
                    <div className="screen-editor-event-item-header">
                      <input
                        type="text"
                        value={event.id}
                        onChange={(e) => {
                          const updatedEvents = [...(screen.events || [])];
                          updatedEvents[index] = { ...event, id: e.target.value };
                          handleScreenUpdate({ events: updatedEvents });
                        }}
                        disabled={disabled}
                        placeholder="event-id"
                        className="screen-editor-event-id-input"
                      />
                      <select
                        value={event.type}
                        onChange={(e) => {
                          const updatedEvents = [...(screen.events || [])];
                          updatedEvents[index] = { ...event, type: e.target.value as EventType };
                          handleScreenUpdate({ events: updatedEvents });
                        }}
                        disabled={disabled}
                      >
                        <option value="onStart">onStart</option>
                        <option value="onLoad">onLoad</option>
                        <option value="onSelected">onSelected</option>
                        <option value="onToggle">onToggle</option>
                        <option value="onToggleOn">onToggleOn</option>
                        <option value="onToggleOff">onToggleOff</option>
                        <option value="custom">custom</option>
                      </select>
                      <button
                        onClick={() => handleRemoveEvent(index)}
                        disabled={disabled}
                        className="screen-editor-event-remove"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>

                    <div className="screen-editor-event-actions">
                      <label>Actions (JSON):</label>
                      <textarea
                        value={JSON.stringify(event.action, null, 2)}
                        onChange={(e) => {
                          try {
                            const action = JSON.parse(e.target.value);
                            const updatedEvents = [...(screen.events || [])];
                            updatedEvents[index] = { ...event, action };
                            handleScreenUpdate({ events: updatedEvents });
                          } catch {
                            // Invalid JSON, ignore
                          }
                        }}
                        disabled={disabled}
                        rows={6}
                        placeholder='[{"type": "navigation", "deeplink": "https://links.pelagohealth.com/module/screen"}]'
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenEditor;

