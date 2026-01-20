import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './UIShowcase.css';

// Import SDUI elements
import { ElementMetadataRegistry, getElementsByCategory } from '../lib/voiceAgent/elementRegistry';
import { getElementComponent } from '../lib/voiceAgent/elementRegistry';
import { Screen, ElementConfig, ElementType } from '../types/journey';
import { StandaloneScreen, StandaloneScreenListItem, createStandaloneScreen } from '../types/screen';
import { ScreenProvider } from '../contexts/voiceAgent/ScreenContext';
import ScreenPreview from '../components/voiceAgent/ScreenPreview';
import ElementPropertyEditor from '../components/voiceAgent/ElementPropertyEditor';
import {
  listScreens,
  loadScreen,
  saveScreen,
  deleteScreen,
  duplicateScreen,
} from '../services/screenStorage';

type TabMode = 'screens' | 'elements' | 'builder';

const UIShowcase: React.FC = () => {
  const [showcaseMode, setShowcaseMode] = useState<TabMode>('screens');
  const [selectedCategory, setSelectedCategory] = useState<'core' | 'card' | 'interactive' | 'advanced'>('core');

  // Screens list state
  const [screensList, setScreensList] = useState<StandaloneScreenListItem[]>([]);
  const [isLoadingScreens, setIsLoadingScreens] = useState(true);
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);

  // Builder state
  const [builderScreen, setBuilderScreen] = useState<StandaloneScreen>(() => createStandaloneScreen(uuidv4(), 'New Screen'));

  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [draggedElementIndex, setDraggedElementIndex] = useState<number | null>(null);
  const [_dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Load screens on mount
  useEffect(() => {
    loadScreensList();
  }, []);

  const loadScreensList = async () => {
    setIsLoadingScreens(true);
    const screens = await listScreens();
    setScreensList(screens);
    setIsLoadingScreens(false);
  };

  const handleCreateScreen = () => {
    const newScreen = createStandaloneScreen(uuidv4(), 'New Screen');
    setBuilderScreen(newScreen);
    setEditingScreenId(null);
    setSelectedElementIndex(null);
    setShowcaseMode('builder');
  };

  const handleEditScreen = async (screenId: string) => {
    const screen = await loadScreen(screenId);
    if (screen) {
      setBuilderScreen(screen);
      setEditingScreenId(screenId);
      setSelectedElementIndex(null);
      setShowcaseMode('builder');
    }
  };

  const handleDuplicateScreen = async (screenId: string) => {
    const duplicated = await duplicateScreen(screenId);
    if (duplicated) {
      await loadScreensList();
    }
  };

  const handleDeleteScreen = async (screenId: string) => {
    if (window.confirm('Are you sure you want to delete this screen?')) {
      await deleteScreen(screenId);
      await loadScreensList();
    }
  };

  const handleSaveScreen = async () => {
    const success = await saveScreen(builderScreen);
    if (success) {
      await loadScreensList();
      setEditingScreenId(builderScreen.id);
    }
  };

  const handleAddElement = (elementType: ElementType) => {
    const metadata = ElementMetadataRegistry[elementType];
    if (!metadata) return;

    const newElement: ElementConfig = {
      type: elementType,
      state: {
        ...metadata.defaultData,
        id: `${elementType}_${uuidv4()}`,
      },
      style: metadata.defaultStyle,
      events: [],
    };

    const updatedSections = builderScreen.sections.map(section => {
      if (section.position === 'body') {
        return {
          ...section,
          elements: [...section.elements, newElement],
        };
      }
      return section;
    });

    // If no body section exists, create one
    if (!builderScreen.sections.some(s => s.position === 'body')) {
      updatedSections.push({
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [newElement],
      });
    }

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections.length > 0 ? updatedSections : [{
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [newElement],
      }],
    });
  };

  const handleClearBuilder = () => {
    setBuilderScreen({
      ...builderScreen,
      sections: builderScreen.sections.map(section => ({
        ...section,
        elements: [],
      })),
    });
    setSelectedElementIndex(null);
  };

  const handleRemoveElement = (index: number) => {
    const updatedSections = builderScreen.sections.map(section => {
      if (section.position === 'body') {
        return {
          ...section,
          elements: section.elements.filter((_, i) => i !== index),
        };
      }
      return section;
    });

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections,
    });

    if (selectedElementIndex === index) {
      setSelectedElementIndex(null);
    } else if (selectedElementIndex !== null && selectedElementIndex > index) {
      setSelectedElementIndex(selectedElementIndex - 1);
    }
  };

  const handleUpdateElement = (index: number, updates: Partial<ElementConfig>) => {
    const updatedSections = builderScreen.sections.map(section => {
      if (section.position === 'body') {
        return {
          ...section,
          elements: section.elements.map((el, i) =>
            i === index ? { ...el, ...updates } : el
          ),
        };
      }
      return section;
    });

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections,
    });
  };

  const currentElements = builderScreen.sections.find(s => s.position === 'body')?.elements || [];
  const selectedElement = selectedElementIndex !== null ? currentElements[selectedElementIndex] : null;
  const selectedElementId = selectedElement?.state.id as string | undefined;

  const handleElementSelectFromPreview = (elementId: string, _sectionIndex: number, _elementIndex: number) => {
    const bodySection = builderScreen.sections.find(s => s.position === 'body');
    if (!bodySection) return;

    const index = bodySection.elements.findIndex(el => el.state.id === elementId);
    if (index !== -1) {
      setSelectedElementIndex(index);
    }
  };

  void draggedElementIndex; void _dragOverIndex; void setDraggedElementIndex; void setDragOverIndex;

  const handleMoveElementUp = (index: number) => {
    if (index === 0) return;

    const updatedElements = [...currentElements];
    [updatedElements[index - 1], updatedElements[index]] = [updatedElements[index], updatedElements[index - 1]];

    const updatedSections = builderScreen.sections.map(section => {
      if (section.position === 'body') {
        return {
          ...section,
          elements: updatedElements,
        };
      }
      return section;
    });

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections,
    });

    if (selectedElementIndex === index) {
      setSelectedElementIndex(index - 1);
    } else if (selectedElementIndex === index - 1) {
      setSelectedElementIndex(index);
    }
  };

  const handleMoveElementDown = (index: number) => {
    if (index === currentElements.length - 1) return;

    const updatedElements = [...currentElements];
    [updatedElements[index], updatedElements[index + 1]] = [updatedElements[index + 1], updatedElements[index]];

    const updatedSections = builderScreen.sections.map(section => {
      if (section.position === 'body') {
        return {
          ...section,
          elements: updatedElements,
        };
      }
      return section;
    });

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections,
    });

    if (selectedElementIndex === index) {
      setSelectedElementIndex(index + 1);
    } else if (selectedElementIndex === index + 1) {
      setSelectedElementIndex(index);
    }
  };

  const handleScreenTitleChange = (title: string) => {
    setBuilderScreen({
      ...builderScreen,
      title,
    });
  };

  return (
    <div className="ui-showcase">
      {/* Header */}
      <div className="ui-showcase-header">
        <h2 className="ui-showcase-title">Screens</h2>
        {showcaseMode === 'screens' && (
          <button className="ui-showcase-create-btn" onClick={handleCreateScreen}>
            Create Screen
          </button>
        )}
        {showcaseMode === 'builder' && (
          <div className="ui-showcase-builder-actions">
            <button className="ui-showcase-back-btn" onClick={() => setShowcaseMode('screens')}>
              Back to Screens
            </button>
            <button className="ui-showcase-save-btn" onClick={handleSaveScreen}>
              Save Screen
            </button>
          </div>
        )}
      </div>

      {/* Mode Tabs */}
      <div className="ui-showcase-tabs">
        <button
          className={`ui-showcase-tab ${showcaseMode === 'screens' ? 'active' : ''}`}
          onClick={() => setShowcaseMode('screens')}
        >
          Screens
        </button>
        <button
          className={`ui-showcase-tab ${showcaseMode === 'builder' ? 'active' : ''}`}
          onClick={() => setShowcaseMode('builder')}
        >
          Screen Builder
        </button>
        <button
          className={`ui-showcase-tab ${showcaseMode === 'elements' ? 'active' : ''}`}
          onClick={() => setShowcaseMode('elements')}
        >
          Element Gallery
        </button>
      </div>

      {/* Screens List Mode */}
      {showcaseMode === 'screens' && (
        <div className="ui-showcase-screens-list">
          {isLoadingScreens ? (
            <div className="ui-showcase-loading">Loading screens...</div>
          ) : screensList.length === 0 ? (
            <div className="ui-showcase-empty">
              <h3>No screens yet</h3>
              <p>Click "Create Screen" to get started</p>
            </div>
          ) : (
            <div className="ui-showcase-screens-grid">
              {screensList.map((screen) => (
                <div key={screen.id} className="ui-showcase-screen-card">
                  <div className="ui-showcase-screen-card-preview">
                    <div className="ui-showcase-screen-card-icon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                  </div>
                  <div className="ui-showcase-screen-card-content">
                    <h3 className="ui-showcase-screen-card-title">{screen.title}</h3>
                    <p className="ui-showcase-screen-card-meta">
                      {screen.sectionCount} sections · {screen.elementCount} elements
                    </p>
                  </div>
                  <div className="ui-showcase-screen-card-actions">
                    <button
                      className="ui-showcase-screen-card-btn ui-showcase-screen-card-btn-primary"
                      onClick={() => handleEditScreen(screen.id)}
                    >
                      Edit
                    </button>
                    <button
                      className="ui-showcase-screen-card-btn"
                      onClick={() => handleDuplicateScreen(screen.id)}
                    >
                      Duplicate
                    </button>
                    <button
                      className="ui-showcase-screen-card-btn ui-showcase-screen-card-btn-danger"
                      onClick={() => handleDeleteScreen(screen.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Element Gallery Mode */}
      {showcaseMode === 'elements' && (
        <div className="ui-showcase-content">
          {/* Category Filter */}
          <div className="ui-showcase-category-tabs">
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'core' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('core')}
            >
              Core Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'card' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('card')}
            >
              Card Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'interactive' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('interactive')}
            >
              Interactive Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'advanced' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('advanced')}
            >
              Advanced Elements
            </button>
          </div>

          {/* Element Grid */}
          <div className="ui-showcase-grid">
            {getElementsByCategory(selectedCategory).map((metadata) => {
              const Component = getElementComponent(metadata.type);

              if (!Component) return null;

              const previewScreen: Screen = {
                id: `preview-${metadata.type}`,
                title: 'Preview',
                sections: [],
              };

              return (
                <div key={metadata.type} className="ui-showcase-item">
                  <div className="ui-showcase-item-header">
                    <h3>
                      {metadata.icon} {metadata.displayName}
                    </h3>
                    <span className="ui-showcase-item-tag">{metadata.type}</span>
                  </div>
                  <div className="ui-showcase-item-description">
                    {metadata.description}
                  </div>
                  <div className="ui-showcase-item-preview">
                    <ScreenProvider initialScreen={previewScreen}>
                      <Component
                        data={metadata.defaultData}
                        style={metadata.defaultStyle}
                        onEventTrigger={(eventId: string) => console.log('Event:', eventId)}
                      />
                    </ScreenProvider>
                  </div>
                  <div className="ui-showcase-item-code">
                    <details>
                      <summary>View JSON Config</summary>
                      <pre>{JSON.stringify({
                        type: metadata.type,
                        data: metadata.defaultData,
                        style: metadata.defaultStyle,
                      }, null, 2)}</pre>
                    </details>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Screen Builder Mode */}
      {showcaseMode === 'builder' && (
        <div className="ui-showcase-builder">
          {/* Left Sidebar - Element Palette */}
          <div className="ui-showcase-builder-sidebar">
            {/* Screen Title */}
            <div className="ui-showcase-builder-section">
              <h3>Screen Settings</h3>
              <div className="ui-showcase-builder-field">
                <label>Screen Title</label>
                <input
                  type="text"
                  value={builderScreen.title}
                  onChange={(e) => handleScreenTitleChange(e.target.value)}
                  placeholder="Enter screen title"
                />
              </div>
            </div>

            <div className="ui-showcase-builder-section">
              <h3>Element Palette</h3>
              <p>Click to add elements</p>

              {(['core', 'card', 'interactive', 'advanced'] as const).map(category => (
                <div key={category} className="ui-showcase-builder-category">
                  <h4>{category.charAt(0).toUpperCase() + category.slice(1)}</h4>
                  <div className="ui-showcase-builder-elements">
                    {getElementsByCategory(category).map(metadata => (
                      <button
                        key={metadata.type}
                        className="ui-showcase-builder-element-btn"
                        onClick={() => handleAddElement(metadata.type)}
                        title={metadata.description}
                      >
                        <span className="ui-showcase-builder-element-icon">{metadata.icon}</span>
                        <span className="ui-showcase-builder-element-name">{metadata.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Added Elements List */}
            {currentElements.length > 0 && (
              <div className="ui-showcase-builder-section">
                <h3>Elements in Screen</h3>
                <p className="ui-showcase-drag-hint">Click to select</p>
                <div className="ui-showcase-builder-elements-list">
                  {currentElements.map((element, index) => (
                    <div
                      key={index}
                      className={`ui-showcase-builder-element-item ${selectedElementIndex === index ? 'selected' : ''}`}
                      onClick={() => setSelectedElementIndex(index)}
                    >
                      <div className="ui-showcase-builder-element-item-content">
                        <span className="ui-showcase-builder-element-item-icon">
                          {ElementMetadataRegistry[element.type]?.icon}
                        </span>
                        <span className="ui-showcase-builder-element-item-name">
                          {ElementMetadataRegistry[element.type]?.displayName}
                        </span>
                      </div>
                      <div className="ui-showcase-builder-element-item-actions">
                        <button
                          className="ui-showcase-builder-element-item-move"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveElementUp(index);
                          }}
                          disabled={index === 0}
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          className="ui-showcase-builder-element-item-move"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveElementDown(index);
                          }}
                          disabled={index === currentElements.length - 1}
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          className="ui-showcase-builder-element-item-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveElement(index);
                          }}
                          title="Remove element"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentElements.length > 0 && (
              <button
                className="ui-showcase-builder-clear-btn"
                onClick={handleClearBuilder}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Center - Live Preview */}
          <div className="ui-showcase-builder-preview">
            <ScreenProvider initialScreen={builderScreen}>
              <ScreenPreview
                screen={builderScreen}
                allScreens={[builderScreen]}
                showDeviceFrame={true}
                editable={true}
                selectedElementId={selectedElementId}
                onElementSelect={handleElementSelectFromPreview}
              />
            </ScreenProvider>
          </div>

          {/* Right Sidebar - Element Editor */}
          <div className="ui-showcase-builder-editor">
            {selectedElement ? (
              <div className="ui-showcase-builder-section">
                <h3>
                  {ElementMetadataRegistry[selectedElement.type]?.icon} Edit Element
                </h3>
                <div className="ui-showcase-builder-element-type">
                  {ElementMetadataRegistry[selectedElement.type]?.displayName}
                </div>

                <ElementPropertyEditor
                  element={selectedElement}
                  onChange={(updates) => handleUpdateElement(selectedElementIndex!, updates)}
                  onRemove={() => handleRemoveElement(selectedElementIndex!)}
                  onMoveUp={() => handleMoveElementUp(selectedElementIndex!)}
                  onMoveDown={() => handleMoveElementDown(selectedElementIndex!)}
                  canMoveUp={selectedElementIndex !== 0}
                  canMoveDown={selectedElementIndex !== currentElements.length - 1}
                />
              </div>
            ) : (
              <div className="ui-showcase-builder-empty-editor">
                <p>Click an element in the preview or select from the list to edit its properties</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default UIShowcase;
