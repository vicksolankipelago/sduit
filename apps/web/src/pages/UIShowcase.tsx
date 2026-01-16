import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './UIShowcase.css';

// Import SDUI elements
import { ElementMetadataRegistry, getElementsByCategory } from '../lib/voiceAgent/elementRegistry';
import { getElementComponent } from '../lib/voiceAgent/elementRegistry';
import { Screen, ElementConfig, ElementType } from '../types/journey';
import { ScreenProvider } from '../contexts/voiceAgent/ScreenContext';
import ScreenPreview from '../components/voiceAgent/ScreenPreview';
import ElementPropertyEditor from '../components/voiceAgent/ElementPropertyEditor';

const UIShowcase: React.FC = () => {
  const [showcaseMode, setShowcaseMode] = useState<'elements' | 'builder'>('builder');
  const [selectedCategory, setSelectedCategory] = useState<'core' | 'card' | 'interactive' | 'advanced'>('core');
  
  // Builder state
  const [builderScreen, setBuilderScreen] = useState<Screen>({
    id: 'preview-screen',
    title: 'Preview',
    sections: [
      {
        id: 'body-section',
        position: 'body',
        layout: 'stack',
        direction: 'vertical',
        scrollable: true,
        elements: [],
      },
    ],
  });
  
  const [selectedElementIndex, setSelectedElementIndex] = useState<number | null>(null);
  const [draggedElementIndex, setDraggedElementIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

    setBuilderScreen({
      ...builderScreen,
      sections: updatedSections,
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

  const handleElementSelectFromPreview = (elementId: string, sectionIndex: number, elementIndex: number) => {
    // Find the element in the body section by ID
    const bodySection = builderScreen.sections.find(s => s.position === 'body');
    if (!bodySection) return;

    const index = bodySection.elements.findIndex(el => el.state.id === elementId);
    if (index !== -1) {
      setSelectedElementIndex(index);
    }
  };

  const handleDragStart = (index: number, e: React.DragEvent) => {
    setDraggedElementIndex(index);
    
    // Create custom drag image
    const element = e.currentTarget as HTMLElement;
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    ghost.style.width = element.offsetWidth + 'px';
    ghost.style.opacity = '0.8';
    ghost.style.transform = 'rotate(2deg)';
    ghost.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, element.offsetWidth / 2, 20);
    
    setTimeout(() => {
      document.body.removeChild(ghost);
    }, 0);
  };

  const handleDragOver = (index: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedElementIndex === null) return;
    setDragOverIndex(index);
  };

  const handleDrop = (dropIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    if (draggedElementIndex === null) return;

    const updatedElements = [...currentElements];
    const [draggedElement] = updatedElements.splice(draggedElementIndex, 1);
    
    // Adjust drop index if dragging down
    const actualDropIndex = draggedElementIndex < dropIndex ? dropIndex : dropIndex;
    updatedElements.splice(actualDropIndex, 0, draggedElement);

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

    // Update selected index
    if (selectedElementIndex === draggedElementIndex) {
      setSelectedElementIndex(actualDropIndex);
    } else if (selectedElementIndex !== null) {
      if (draggedElementIndex < selectedElementIndex && actualDropIndex >= selectedElementIndex) {
        setSelectedElementIndex(selectedElementIndex - 1);
      } else if (draggedElementIndex > selectedElementIndex && actualDropIndex <= selectedElementIndex) {
        setSelectedElementIndex(selectedElementIndex + 1);
      }
    }

    setDraggedElementIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedElementIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveElementUp = (index: number) => {
    if (index === 0) return; // Already at top

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

    // Update selected index
    if (selectedElementIndex === index) {
      setSelectedElementIndex(index - 1);
    } else if (selectedElementIndex === index - 1) {
      setSelectedElementIndex(index);
    }
  };

  const handleMoveElementDown = (index: number) => {
    if (index === currentElements.length - 1) return; // Already at bottom

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

    // Update selected index
    if (selectedElementIndex === index) {
      setSelectedElementIndex(index + 1);
    } else if (selectedElementIndex === index + 1) {
      setSelectedElementIndex(index);
    }
  };

  return (
    <div className="ui-showcase">
      {/* Mode Tabs */}
      <div className="ui-showcase-tabs">
        <button
          className={`ui-showcase-tab ${showcaseMode === 'builder' ? 'active' : ''}`}
          onClick={() => setShowcaseMode('builder')}
        >
          🎨 Screen Builder
        </button>
        <button
          className={`ui-showcase-tab ${showcaseMode === 'elements' ? 'active' : ''}`}
          onClick={() => setShowcaseMode('elements')}
        >
          📦 Element Gallery
        </button>
      </div>

      {/* Element Gallery Mode */}
      {showcaseMode === 'elements' && (
        <div className="ui-showcase-content">
          {/* Category Filter */}
          <div className="ui-showcase-category-tabs">
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'core' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('core')}
            >
              ⚡ Core Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'card' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('card')}
            >
              🃏 Card Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'interactive' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('interactive')}
            >
              🎮 Interactive Elements
            </button>
            <button
              className={`ui-showcase-category-tab ${selectedCategory === 'advanced' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('advanced')}
            >
              ✨ Advanced Elements
            </button>
          </div>

          {/* Element Grid */}
          <div className="ui-showcase-grid">
            {getElementsByCategory(selectedCategory).map((metadata) => {
              const Component = getElementComponent(metadata.type);
              
              if (!Component) return null;

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
                    <Component
                      data={metadata.defaultData}
                      style={metadata.defaultStyle}
                      onEventTrigger={(eventId: string) => console.log('Event:', eventId)}
                    />
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
                <p className="ui-showcase-drag-hint">Drag to reorder</p>
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
                          🗑️
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
                🗑️ Clear All
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
