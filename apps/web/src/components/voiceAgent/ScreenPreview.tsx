import React, { useCallback, useMemo } from 'react';
import { Screen, ElementConfig, Section, AnyCodable } from '../../types/journey';
import { useScreenContext } from '../../contexts/voiceAgent/ScreenContext';
import { getElementComponent } from '../../lib/voiceAgent/elementRegistry';
import { ScreenErrorBoundary, ElementErrorBoundary } from './ErrorBoundary';
import './ScreenPreview.css';

export interface ScreenPreviewProps {
  screen: Screen;
  allScreens?: Screen[];
  showDeviceFrame?: boolean;
  editable?: boolean;
  selectedElementId?: string;
  onElementSelect?: (elementId: string, sectionIndex: number, elementIndex: number) => void;
}

export const ScreenPreview: React.FC<ScreenPreviewProps> = ({
  screen,
  allScreens = [],
  showDeviceFrame = true,
  editable = false,
  selectedElementId,
  onElementSelect,
}) => {
  const {
    triggerEvent,
    interpolateString,
    evaluateConditions,
    goBack,
    navigationStack,
  } = useScreenContext();
  const resolveInterpolations = useCallback((value: AnyCodable): AnyCodable => {
    if (typeof value === 'string') {
      return interpolateString(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => resolveInterpolations(item));
    }

    if (value && typeof value === 'object') {
      const resolved: Record<string, AnyCodable> = {};
      Object.entries(value).forEach(([key, entryValue]) => {
        resolved[key] = resolveInterpolations(entryValue);
      });
      return resolved;
    }

    return value;
  }, [interpolateString]);

  // Filter elements based on conditions
  const filterElements = (elements: ElementConfig[]): ElementConfig[] => {
    return elements.filter(element => {
      if (!element.conditions || element.conditions.length === 0) return true;
      return evaluateConditions(element.conditions);
    });
  };

  // Render a single element
  const renderElement = (element: ElementConfig, index: number, sectionIndex: number, totalIndex: number) => {
    const Component = getElementComponent(element.type);
    
    if (!Component) {
      return (
        <div key={index} className="screen-preview-unknown-element">
          Unknown element type: {element.type}
        </div>
      );
    }

    // Interpolate text fields in state
    const interpolatedData = resolveInterpolations(element.state);

    const elementId = element.state.id as string;
    const isSelected = editable && selectedElementId === elementId;

    const handleClick = (e: React.MouseEvent) => {
      if (editable && onElementSelect) {
        e.stopPropagation();
        onElementSelect(elementId, sectionIndex, index);
      }
    };

    const interpolatedDataRecord = interpolatedData as Record<string, AnyCodable>;

    return (
      <div
        key={`element-${elementId || index}`}
        className={`screen-preview-element ${editable ? 'screen-preview-element-editable' : ''} ${isSelected ? 'screen-preview-element-selected' : ''}`}
        onClick={handleClick}
        data-element-id={elementId}
        style={{ animationDelay: `${totalIndex * 0.3 + 0.2}s` }}
      >
        <ElementErrorBoundary elementType={element.type} elementId={elementId}>
          <Component
            data={interpolatedDataRecord}
            style={element.style}
            events={element.events}
            onEventTrigger={triggerEvent}
            interpolatedText={
              typeof interpolatedDataRecord?.text === 'string'
                ? interpolatedDataRecord.text
                : undefined
            }
            interpolatedTitle={
              typeof interpolatedDataRecord?.title === 'string'
                ? interpolatedDataRecord.title
                : undefined
            }
            interpolatedDescription={
              typeof interpolatedDataRecord?.description === 'string'
                ? interpolatedDataRecord.description
                : undefined
            }
          />
        </ElementErrorBoundary>
        {isSelected && editable && (
          <div className="screen-preview-element-selected-indicator">
            Selected
          </div>
        )}
      </div>
    );
  };

  // Render a section
  const renderSection = (section: Section, sectionIndex: number, startIndex: number): number => {
    const filteredElements = filterElements(section.elements);
    
    if (filteredElements.length === 0) return startIndex;

    const sectionClassName = [
      'screen-preview-section',
      `screen-preview-section-${section.position}`,
      section.layout === 'grid' ? 'screen-preview-section-grid' : 'screen-preview-section-stack',
      section.direction === 'horizontal' ? 'screen-preview-section-horizontal' : 'screen-preview-section-vertical',
      section.scrollable !== false && section.position === 'body' ? 'screen-preview-section-scrollable' : '',
    ].filter(Boolean).join(' ');

    const rendered = (
      <div key={section.id} className={sectionClassName}>
        {section.title && (
          <div className="screen-preview-section-title pelago-caption-2-bold">
            {section.title}
          </div>
        )}
        <div className="screen-preview-section-elements">
          {filteredElements.map((element, index) => renderElement(element, index, sectionIndex, startIndex + index))}
        </div>
      </div>
    );

    sectionRenderCache.push(rendered);
    return startIndex + filteredElements.length;
  };

  // Group sections by position
  const sectionsByPosition = useMemo(() => {
    const grouped: Record<string, Section[]> = {
      'fixed-top': [],
      'body': [],
      'fixed-bottom': [],
    };

    screen.sections.forEach(section => {
      grouped[section.position].push(section);
    });

    return grouped;
  }, [screen.sections]);

  const handleBack = () => {
    if (navigationStack.length > 1) {
      goBack(allScreens);
    }
  };

  // Helper to render sections sequentially and track element count for animations
  const sectionRenderCache: React.ReactNode[] = [];
  let elementCounter = 0;

  const content = (
    <div className="screen-preview-container">
      {/* Navigation Bar */}
      {(!editable || navigationStack.length > 1) && (
        <div className="screen-preview-nav-bar">
          {!screen.hidesBackButton && navigationStack.length > 1 && (
            <button 
              className="screen-preview-back-button"
              onClick={handleBack}
              aria-label="Go back"
            >
              ← Back
            </button>
          )}
          {!editable && (
            <>
              <div className="screen-preview-title pelago-body-1-bold">
                {screen.title}
              </div>
              <div className="screen-preview-nav-spacer" />
            </>
          )}
        </div>
      )}

      {/* Fixed Top Section */}
      {sectionsByPosition['fixed-top'].length > 0 && (
        <div className="screen-preview-fixed-top">
          {sectionsByPosition['fixed-top'].forEach((section, idx) => {
            elementCounter = renderSection(section, idx, elementCounter);
          })}
          {sectionRenderCache.splice(0, sectionRenderCache.length)}
        </div>
      )}

      {/* Body Section (Scrollable) */}
      <div className="screen-preview-body">
        {sectionsByPosition['body'].forEach((section, idx) => {
          elementCounter = renderSection(section, idx, elementCounter);
        })}
        {sectionRenderCache.splice(0, sectionRenderCache.length)}
      </div>

      {/* Fixed Bottom Section */}
      {sectionsByPosition['fixed-bottom'].length > 0 && (
        <div className="screen-preview-fixed-bottom">
          {sectionsByPosition['fixed-bottom'].forEach((section, idx) => {
            elementCounter = renderSection(section, idx, elementCounter);
          })}
          {sectionRenderCache.splice(0, sectionRenderCache.length)}
        </div>
      )}
    </div>
  );

  if (showDeviceFrame) {
    return (
      <ScreenErrorBoundary screenId={screen.id}>
        <div className="screen-preview-device-frame">
          <div className="screen-preview-device-notch" />
          {content}
          <div className="screen-preview-device-home-indicator" />
        </div>
      </ScreenErrorBoundary>
    );
  }

  return <ScreenErrorBoundary screenId={screen.id}>{content}</ScreenErrorBoundary>;
};

export default ScreenPreview;

