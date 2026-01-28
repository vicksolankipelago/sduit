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
  screen: screenProp,
  allScreens = [],
  showDeviceFrame = true,
  editable = false,
  selectedElementId,
  onElementSelect,
}) => {
  const {
    currentScreen,
    triggerEvent: contextTriggerEvent,
    interpolateString,
    evaluateConditions,
    goBack,
    navigationStack,
  } = useScreenContext();

  // Use currentScreen from context if available (for navigation), otherwise use prop
  const screen = currentScreen || screenProp;

  // Wrap triggerEvent to always include allScreens for navigation
  const triggerEvent = useCallback((eventId: string) => {
    contextTriggerEvent(eventId, allScreens);
  }, [contextTriggerEvent, allScreens]);
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

  // Pre-compute rendered sections using useMemo to avoid side effects during render
  const renderedSections = useMemo(() => {
    let counter = 0;
    const renderSectionContent = (section: Section, sectionIndex: number, startIndex: number) => {
      const filteredElements = filterElements(section.elements);
      if (filteredElements.length === 0) return { node: null, nextIndex: startIndex };
      
      const sectionClassName = [
        'screen-preview-section',
        `screen-preview-section-${section.position}`,
        section.layout === 'grid' ? 'screen-preview-section-grid' : 'screen-preview-section-stack',
        section.direction === 'horizontal' ? 'screen-preview-section-horizontal' : 'screen-preview-section-vertical',
        section.scrollable !== false && section.position === 'body' ? 'screen-preview-section-scrollable' : '',
      ].filter(Boolean).join(' ');

      const node = (
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
      
      return { node, nextIndex: startIndex + filteredElements.length };
    };

    const fixedTop: React.ReactNode[] = [];
    const body: React.ReactNode[] = [];
    const fixedBottom: React.ReactNode[] = [];

    sectionsByPosition['fixed-top'].forEach((section, idx) => {
      const result = renderSectionContent(section, idx, counter);
      if (result.node) fixedTop.push(result.node);
      counter = result.nextIndex;
    });

    sectionsByPosition['body'].forEach((section, idx) => {
      const result = renderSectionContent(section, idx, counter);
      if (result.node) body.push(result.node);
      counter = result.nextIndex;
    });

    sectionsByPosition['fixed-bottom'].forEach((section, idx) => {
      const result = renderSectionContent(section, idx, counter);
      if (result.node) fixedBottom.push(result.node);
      counter = result.nextIndex;
    });

    return { fixedTop, body, fixedBottom };
  }, [sectionsByPosition, filterElements, renderElement]);

  const content = (
    <div className="screen-preview-container">
      {/* Navigation Bar */}
      {(screen.title || !editable || navigationStack.length > 1) && (
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
          {screen.title && (
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
      {renderedSections.fixedTop.length > 0 && (
        <div className="screen-preview-fixed-top">
          {renderedSections.fixedTop}
        </div>
      )}

      {/* Body Section (Scrollable) */}
      <div className="screen-preview-body">
        {renderedSections.body}
      </div>

      {/* Fixed Bottom Section */}
      {renderedSections.fixedBottom.length > 0 && (
        <div className="screen-preview-fixed-bottom">
          {renderedSections.fixedBottom}
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

