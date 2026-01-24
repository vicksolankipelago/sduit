import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import './UIShowcase.css';

// Import SDUI elements
import { ElementMetadataRegistry, getElementsByCategory } from '../lib/voiceAgent/elementRegistry';
import { getElementComponent } from '../lib/voiceAgent/elementRegistry';
import { Screen, ElementConfig, ElementType, ScreenEvent, EventType } from '../types/journey';
import { StandaloneScreen, StandaloneScreenListItem, createStandaloneScreen } from '../types/screen';
import { ScreenProvider } from '../contexts/voiceAgent/ScreenContext';
import ScreenPreview from '../components/voiceAgent/ScreenPreview';
import ElementPropertyEditor from '../components/voiceAgent/ElementPropertyEditor';
import {
  listScreens,
  loadScreen,
  saveGlobalScreen,
  deleteScreen,
  duplicateScreen,
} from '../services/screenStorage';
import { listJourneys, loadJourney, saveJourney } from '../services/journeyStorage';

interface LocationState {
  editScreen?: Screen;
  agentId?: string;
  agentName?: string;
  journeyId?: string;
}

type TabMode = 'screens' | 'elements' | 'builder';

const UIShowcase: React.FC = () => {
  const location = useLocation();
  const [showcaseMode, setShowcaseMode] = useState<TabMode>('screens');
  const [selectedCategory, setSelectedCategory] = useState<'core' | 'card' | 'interactive' | 'advanced'>('core');

  // Screens list state
  const [screensList, setScreensList] = useState<StandaloneScreenListItem[]>([]);
  const [isLoadingScreens, setIsLoadingScreens] = useState(true);
  const [editingScreenId, setEditingScreenId] = useState<string | null>(null);
  const [editingAgentInfo, setEditingAgentInfo] = useState<{ agentId?: string; agentName?: string; journeyId?: string } | null>(null);
  const [editingScreenSource, setEditingScreenSource] = useState<'new' | 'global' | 'journey'>('new');

  // Builder state
  const [builderScreen, setBuilderScreen] = useState<StandaloneScreen>(() => createStandaloneScreen(uuidv4(), 'New Screen'));

  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [draggedElementIndex, setDraggedElementIndex] = useState<number | null>(null);
  const [_dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Check for navigation state with a screen to edit
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.editScreen) {
      // Convert Screen to StandaloneScreen format
      const standaloneScreen: StandaloneScreen = {
        ...state.editScreen,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setBuilderScreen(standaloneScreen);
      setEditingScreenId(state.editScreen.id);
      setEditingAgentInfo({ 
        agentId: state.agentId, 
        agentName: state.agentName,
        journeyId: state.journeyId 
      });
      setEditingScreenSource(state.journeyId ? 'journey' : 'new');
      setSelectedElementIndex(null);
      setShowcaseMode('builder');
      
      // Clear the state to prevent re-opening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load screens on mount
  useEffect(() => {
    loadScreensList();
  }, []);

  const loadScreensList = async () => {
    setIsLoadingScreens(true);
    
    // Load global screens
    const globalScreens = await listScreens();
    const globalScreensWithSource: StandaloneScreenListItem[] = globalScreens.map(s => ({
      ...s,
      source: { type: 'global' as const }
    }));
    
    // Load screens from journeys
    const journeyScreens: StandaloneScreenListItem[] = [];
    try {
      const journeyList = await listJourneys();
      for (const journeyItem of journeyList) {
        const journey = await loadJourney(journeyItem.id);
        if (journey?.agents) {
          for (const agent of journey.agents) {
            if (agent.screens && agent.screens.length > 0) {
              for (const screen of agent.screens) {
                const elementCount = screen.sections?.reduce(
                  (count, section) => count + (section.elements?.length || 0),
                  0
                ) || 0;
                
                journeyScreens.push({
                  id: `${journey.id}:${agent.id}:${screen.id}`,
                  title: screen.title || 'Untitled Screen',
                  sectionCount: screen.sections?.length || 0,
                  elementCount,
                  updatedAt: journey.updatedAt || new Date().toISOString(),
                  source: {
                    type: 'journey',
                    journeyId: journey.id,
                    journeyName: journey.name,
                    agentId: agent.id,
                    agentName: agent.name
                  }
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading journey screens:', error);
    }
    
    // Merge both lists
    setScreensList([...globalScreensWithSource, ...journeyScreens]);
    setIsLoadingScreens(false);
  };

  const handleCreateScreen = () => {
    const newScreen = createStandaloneScreen(uuidv4(), 'New Screen');
    setBuilderScreen(newScreen);
    setEditingScreenId(null);
    setEditingAgentInfo(null);
    setEditingScreenSource('new');
    setSelectedElementIndex(null);
    setShowcaseMode('builder');
  };

  const handleEditScreen = async (screenId: string) => {
    // Check if this is a journey screen (compound ID: journeyId:agentId:screenId)
    if (screenId.includes(':')) {
      const [journeyId, agentId, actualScreenId] = screenId.split(':');
      const journey = await loadJourney(journeyId);
      if (journey) {
        const agent = journey.agents.find(a => a.id === agentId);
        if (agent?.screens) {
          const screen = agent.screens.find(s => s.id === actualScreenId);
          if (screen) {
            const standaloneScreen: StandaloneScreen = {
              ...screen,
              createdAt: journey.createdAt || new Date().toISOString(),
              updatedAt: journey.updatedAt || new Date().toISOString(),
            };
            setBuilderScreen(standaloneScreen);
            setEditingScreenId(actualScreenId);
            setEditingAgentInfo({ agentId: agent.id, agentName: agent.name, journeyId });
            setEditingScreenSource('journey');
            setSelectedElementIndex(null);
            setShowcaseMode('builder');
            return;
          }
        }
      }
    } else {
      // Global screen
      const screen = await loadScreen(screenId);
      if (screen) {
        setBuilderScreen(screen);
        setEditingScreenId(screenId);
        setEditingAgentInfo(null);
        setEditingScreenSource('global');
        setSelectedElementIndex(null);
        setShowcaseMode('builder');
      }
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
    try {
      if (editingScreenSource === 'journey' && editingAgentInfo?.journeyId && editingAgentInfo?.agentId) {
        // Save to journey
        const journey = await loadJourney(editingAgentInfo.journeyId);
        if (journey) {
          const agentIndex = journey.agents.findIndex(a => a.id === editingAgentInfo.agentId);
          if (agentIndex >= 0) {
            const agent = journey.agents[agentIndex];
            const screenIndex = agent.screens?.findIndex(s => s.id === editingScreenId) ?? -1;
            
            // Convert StandaloneScreen back to Screen format
            const updatedScreen: Screen = {
              id: builderScreen.id,
              title: builderScreen.title,
              sections: builderScreen.sections,
            };
            
            if (screenIndex >= 0 && agent.screens) {
              agent.screens[screenIndex] = updatedScreen;
            } else if (agent.screens) {
              agent.screens.push(updatedScreen);
            } else {
              agent.screens = [updatedScreen];
            }
            
            journey.agents[agentIndex] = agent;
            journey.updatedAt = new Date().toISOString();
            await saveJourney(journey);
            await loadScreensList();
            alert('Screen saved to journey!');
          }
        }
      } else if (editingScreenSource === 'global' && editingScreenId) {
        // Save to global API
        const savedScreen = await saveGlobalScreen(builderScreen);
        if (savedScreen) {
          await loadScreensList();
          setEditingScreenId(savedScreen.id);
          alert('Screen saved!');
        }
      } else {
        // Save as new global screen
        const savedScreen = await saveGlobalScreen(builderScreen);
        if (savedScreen) {
          await loadScreensList();
          setEditingScreenId(savedScreen.id);
          setEditingScreenSource('global');
          alert('Screen created!');
        }
      }
    } catch (error) {
      console.error('Failed to save screen:', error);
      alert('Failed to save screen');
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
  
  // Find the selected element across all sections
  const findSelectedElement = (): { element: ElementConfig | null; sectionPosition: string | null } => {
    if (selectedElementIndex === null) return { element: null, sectionPosition: null };
    
    // First check body section (primary section for editing)
    const bodySection = builderScreen.sections.find(s => s.position === 'body');
    if (bodySection && selectedElementIndex < bodySection.elements.length) {
      return { element: bodySection.elements[selectedElementIndex], sectionPosition: 'body' };
    }
    
    return { element: null, sectionPosition: null };
  };
  
  const { element: selectedElement, sectionPosition: selectedSectionPosition } = findSelectedElement();
  const selectedElementId = selectedElement?.state.id as string | undefined;

  const handleElementSelectFromPreview = (elementId: string, _sectionIndex: number, _elementIndex: number) => {
    // Search all sections for the element
    for (const section of builderScreen.sections) {
      const index = section.elements.findIndex(el => el.state.id === elementId);
      if (index !== -1) {
        // For now, we support editing body section elements primarily
        // Store the element ID so we can find it later
        if (section.position === 'body') {
          setSelectedElementIndex(index);
        } else {
          // For non-body sections, find the equivalent position in body
          // or add support for tracking section position
          const bodySection = builderScreen.sections.find(s => s.position === 'body');
          if (bodySection) {
            const bodyIndex = bodySection.elements.findIndex(el => el.state.id === elementId);
            if (bodyIndex !== -1) {
              setSelectedElementIndex(bodyIndex);
            }
          }
        }
        return;
      }
    }
  };
  
  // Suppress unused variable warnings
  void selectedSectionPosition;

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

  const handleAddEvent = () => {
    const newEvent: ScreenEvent = {
      id: `event-${uuidv4().slice(0, 8)}`,
      type: 'onLoad',
      action: [],
    };
    setBuilderScreen({
      ...builderScreen,
      events: [...(builderScreen.events || []), newEvent],
    });
  };

  const handleRemoveEvent = (index: number) => {
    const updatedEvents = [...(builderScreen.events || [])];
    updatedEvents.splice(index, 1);
    setBuilderScreen({
      ...builderScreen,
      events: updatedEvents,
    });
  };

  const handleUpdateEvent = (index: number, updates: Partial<ScreenEvent>) => {
    const updatedEvents = [...(builderScreen.events || [])];
    updatedEvents[index] = { ...updatedEvents[index], ...updates };
    setBuilderScreen({
      ...builderScreen,
      events: updatedEvents,
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
              {screensList.map((screen) => {
                const isJourneyScreen = screen.source?.type === 'journey';
                return (
                  <div 
                    key={screen.id} 
                    className="ui-showcase-screen-card ui-showcase-screen-card-clickable"
                    onClick={() => handleEditScreen(screen.id)}
                  >
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
                      <h3 className="ui-showcase-screen-card-title">{screen.title || screen.id}</h3>
                      <p className="ui-showcase-screen-card-meta">
                        {screen.sectionCount} sections · {screen.elementCount} elements
                      </p>
                      {isJourneyScreen && screen.source?.journeyName && (
                        <p className="ui-showcase-screen-card-source">
                          {screen.source.journeyName} → {screen.source.agentName || 'Agent'}
                        </p>
                      )}
                    </div>
                    {!isJourneyScreen && (
                      <div className="ui-showcase-screen-card-actions" onClick={(e) => e.stopPropagation()}>
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
                    )}
                  </div>
                );
              })}
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
                      {metadata.displayName}
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
              <div className="ui-showcase-builder-screen-props">
                <h3>Screen Properties</h3>
                
                <div className="ui-showcase-screen-events">
                  <div className="ui-showcase-screen-events-header">
                    <h4>Events</h4>
                    <button 
                      className="ui-showcase-add-event-btn"
                      onClick={handleAddEvent}
                    >
                      + Add Event
                    </button>
                  </div>
                  
                  {(builderScreen.events || []).length === 0 ? (
                    <p className="ui-showcase-empty-state">
                      No events defined. Events allow navigation and state updates when the screen loads or elements are interacted with.
                    </p>
                  ) : (
                    <div className="ui-showcase-events-list">
                      {(builderScreen.events || []).map((event, index) => (
                        <div key={index} className="ui-showcase-event-item">
                          <div className="ui-showcase-event-header">
                            <input
                              type="text"
                              value={event.id}
                              onChange={(e) => handleUpdateEvent(index, { id: e.target.value })}
                              placeholder="event-id"
                              className="ui-showcase-event-id"
                            />
                            <select
                              value={event.type}
                              onChange={(e) => handleUpdateEvent(index, { type: e.target.value as EventType })}
                              className="ui-showcase-event-type"
                            >
                              <option value="onStart">onStart</option>
                              <option value="onLoad">onLoad</option>
                              <option value="onSubmit">onSubmit</option>
                              <option value="onClose">onClose</option>
                              <option value="onAppear">onAppear</option>
                              <option value="onDisappear">onDisappear</option>
                              <option value="onSelected">onSelected</option>
                              <option value="onToggle">onToggle</option>
                              <option value="onToggleOn">onToggleOn</option>
                              <option value="onToggleOff">onToggleOff</option>
                              <option value="onAnimationComplete">onAnimationComplete</option>
                              <option value="custom">custom</option>
                            </select>
                            <button
                              onClick={() => handleRemoveEvent(index)}
                              className="ui-showcase-event-remove"
                              title="Remove event"
                            >
                              ×
                            </button>
                          </div>
                          
                          <div className="ui-showcase-event-actions">
                            <label>Actions (JSON):</label>
                            <textarea
                              value={JSON.stringify(event.action, null, 2)}
                              onChange={(e) => {
                                try {
                                  const action = JSON.parse(e.target.value);
                                  handleUpdateEvent(index, { action });
                                } catch {
                                  // Invalid JSON, ignore
                                }
                              }}
                              rows={4}
                              placeholder='[{"type": "navigation", "deeplink": "screen://next-screen"}]'
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default UIShowcase;
