import React, { useState, useEffect, useRef } from 'react';
import { useScreenContext } from '../../../contexts/voiceAgent/ScreenContext';
import { OpenQuestionElementState, OpenQuestionElementStyle } from '../../../types/journey';
import './OpenQuestionElement.css';

export interface OpenQuestionElementProps {
  data: OpenQuestionElementState;
  style?: OpenQuestionElementStyle;
  events?: any[];
  onEventTrigger?: (eventId: string) => void;
}

export const OpenQuestionElement: React.FC<OpenQuestionElementProps> = ({
  data,
  style: _style,
  events: _events,
  onEventTrigger: _onEventTrigger,
}) => {
  const { screenState, currentScreen } = useScreenContext();
  const [recordedTitle, setRecordedTitle] = useState<string | null>(null);
  const [recordedSummary, setRecordedSummary] = useState<string | null>(null);
  const [recordedDescription, setRecordedDescription] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [questionMinimized, setQuestionMinimized] = useState(false);
  const [processedTimestamp, setProcessedTimestamp] = useState<number | null>(null);
  const currentScreenIdRef = useRef<string | null>(null);
  const elementIdRef = useRef<string>(data.id);
  const summaryShownAtRef = useRef<number | null>(null); // Track when summary was shown

  // Reset state when screen changes or element ID changes
  useEffect(() => {
    const screenId = currentScreen?.id;
    const elementId = data.id;
    
    // Check if screen changed or element changed
    if (screenId && screenId !== currentScreenIdRef.current) {
      // Don't reset if we're currently showing a summary - let it finish displaying
      if (showSummary && summaryShownAtRef.current) {
        const timeSinceShown = Date.now() - summaryShownAtRef.current;
        if (timeSinceShown < 2000) {
          console.log('📝 OpenQuestionElement: Screen changed but summary still showing, delaying reset', {
            timeSinceShown,
            oldScreen: currentScreenIdRef.current,
            newScreen: screenId
          });
          // Update screen ref but don't reset state yet
          currentScreenIdRef.current = screenId;
          return;
        }
      }
      
      console.log('📝 OpenQuestionElement: Screen changed, resetting state', { 
        oldScreen: currentScreenIdRef.current, 
        newScreen: screenId 
      });
      currentScreenIdRef.current = screenId;
      // Reset all state when screen changes
      setRecordedTitle(null);
      setRecordedSummary(null);
      setRecordedDescription(null);
      setShowSummary(false);
      setQuestionMinimized(false);
      setProcessedTimestamp(null);
      summaryShownAtRef.current = null;
    } else if (elementId !== elementIdRef.current) {
      // Element changed (different question on same screen)
      console.log('📝 OpenQuestionElement: Element changed, resetting state', { 
        oldElement: elementIdRef.current, 
        newElement: elementId 
      });
      elementIdRef.current = elementId;
      setRecordedTitle(null);
      setRecordedSummary(null);
      setRecordedDescription(null);
      setShowSummary(false);
      setQuestionMinimized(false);
      setProcessedTimestamp(null);
      summaryShownAtRef.current = null;
    }
  }, [currentScreen?.id, data.id]);

  // Listen for screen state changes
  useEffect(() => {
    // Try to get values - they might be wrapped in .value or direct
    const titleRaw = screenState?.recordedInputTitle;
    const summaryRaw = screenState?.recordedInputSummary;
    const timestampRaw = screenState?.recordedInputTimestamp;
    
    const title = (titleRaw?.value ?? titleRaw) as string | undefined;
    const summary = (summaryRaw?.value ?? summaryRaw) as string | undefined;
    const description = (screenState?.recordedInputDescription?.value ?? screenState?.recordedInputDescription) as string | undefined;
    const timestamp = (timestampRaw?.value ?? timestampRaw) as number | undefined;

    console.log('📝 OpenQuestionElement: State check', { 
      title, 
      summary, 
      timestamp, 
      processedTimestamp,
      hasTitle: !!title,
      hasSummary: !!summary && summary.length > 0,
      timestampMatch: timestamp === processedTimestamp
    });

    // Only process if we have valid data
    if (title && summary && summary.length > 0) {
      // Use timestamp for deduplication if available, otherwise use title+summary combination
      const dedupeKey = timestamp ?? `${title}:${summary}`;
      const currentDedupeKey = processedTimestamp ?? (recordedTitle && recordedSummary ? `${recordedTitle}:${recordedSummary}` : null);
      
      // Skip if we've already processed this exact update
      if (dedupeKey === currentDedupeKey) {
        console.log('📝 OpenQuestionElement: Skipping duplicate update', { dedupeKey });
        return;
      }
      
      console.log('📝 OpenQuestionElement: Processing record_input', { title, summary, timestamp, dedupeKey });
      
      // Use timestamp if available, otherwise use a numeric key based on title+summary
      setProcessedTimestamp(timestamp ?? Date.now());
      setRecordedTitle(title);
      setRecordedSummary(summary);
      setRecordedDescription(description || null);

      // Animate to summary state
      setQuestionMinimized(true);
      
      // After a brief delay, show the summary
      setTimeout(() => {
        const now = Date.now();
        summaryShownAtRef.current = now;
        setShowSummary(true);
        
        console.log('📝 OpenQuestionElement: Summary shown at', now);
        
        // Navigation is now controlled by the voice agent calling trigger_event with a delay parameter
        // We no longer trigger navigation automatically from the component
      }, 300);
    }


  }, [screenState, processedTimestamp, recordedTitle, recordedSummary]);

  return (
    <div 
      className="open-question-element"
      data-element-id={data.id}
    >
      {showSummary && recordedTitle && recordedSummary ? (
        // Summary state - show title as caption and summary as header
        <div className="open-question-summary">
          <div className="open-question-title pelago-caption-2-regular">
            {recordedTitle}
          </div>
          <div className="open-question-summary-text pelago-header-1">
            {recordedSummary}
          </div>
        </div>
      ) : (
        // Question state - show large question text
        <div 
          className={`open-question-text pelago-header-2 ${questionMinimized ? 'minimized' : ''}`}
        >
          {data.question}
        </div>
      )}
    </div>
  );
};

export default OpenQuestionElement;

